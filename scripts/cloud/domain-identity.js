import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {makeAuthority,principalSecrets} from './prepare.js';
import {BUCKET,WORKERS} from './preflight.js';
import {hash,requireThat} from '../../src/platform/contracts.js';
import {DOMAIN_DATASETS} from '../../src/ingress/domain-source-common.js';
import {ISOLATED_ACCOUNT_ID,ISOLATED_DOMAIN_PROFILE_VERSION,domainBridgeArtifactRefs,validateDomainBridgeProfile} from '../../src/platform/domain-bridge-admission.js';
import {ISOLATED_REAL_PROFILE_VERSION,realCanoArtifactRefs,validateRealCanoProfile} from '../../src/platform/real-cano-admission.js';
import {packConfig,TRUST_BINDINGS,PROFILE_REGISTRY_BINDINGS} from '../../src/platform/trusted-config.js';
import {captureReferenceLease} from './domain-lease.js';
const plan=JSON.parse(await readFile('.cloud-proof/plan.private.json','utf8'));
requireThat(plan.account_id===ISOLATED_ACCOUNT_ID,'ISOLATED_ACCOUNT_PIN_REQUIRED');
const api=async path=>{const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+plan.account_id+path,{headers:{authorization:'Bearer '+process.env.CF_TEST_API_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});requireThat(r.ok,'DOMAIN_IDENTITY_API_DENIED');const b=await r.json();requireThat(b.success,'DOMAIN_IDENTITY_API_FAILED');return b.result;};
const subdomain=(await api('/workers/subdomain')).subdomain;requireThat(/^[a-z0-9-]+$/.test(subdomain),'SUBDOMAIN_INVALID');
const namespaces=(await api('/workers/durable_objects/namespaces')).filter(n=>n.script===WORKERS[0]&&n.class==='DatasetCoordinator');requireThat(namespaces.length===1,'NAMESPACE_AMBIGUOUS');
const origins=Object.fromEntries(WORKERS.slice(0,3).map((name,i)=>[['core','runtime','operator'][i],'https://'+name+'.'+subdomain+'.workers.dev']));
const identities={};
for(const [dataset,object] of Object.entries(plan.objects)){
 let probe;
 for(let i=0;i<24;i++){
  const r=await fetch(origins.core+'/probe?dataset_id='+encodeURIComponent(dataset),{headers:{authorization:'Bearer '+plan.provisioning_token},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(r.ok){const b=await r.json();if(b.object_name===object&&b.dataset_id===dataset){probe=b;break;}}
  if(i<23)await new Promise(resolve=>setTimeout(resolve,2500));
 }
 requireThat(probe&&/^[a-f0-9]{64}$/.test(probe.native_id),'DOMAIN_NATIVE_PROBE_FAILED');identities[dataset]=probe;
}
const readConfig={endpoint:'https://'+plan.account_id+'.r2.cloudflarestorage.com',bucket:BUCKET,access_key:process.env.R2_TEST_READ_ACCESS_KEY_ID,secret:process.env.R2_TEST_READ_SECRET_ACCESS_KEY};
requireThat(readConfig.access_key&&readConfig.secret,'R2_READ_CREDENTIAL_REQUIRED');
const meta=JSON.parse(await readFile('tests/data/domains/SOURCE_PINS.json','utf8')),cano=JSON.parse(await readFile('tests/data/real-cano/SOURCE.json','utf8'));
const authorities={},profiles={},tokens={},principals=[],reads={};let signer;
const lease=captureReferenceLease(Date.now());
for(const [domain,dataset] of [...Object.entries(DOMAIN_DATASETS),['cano','cano.operation.an-thoi']]){
 const identity=identities[dataset],a=await makeAuthority({...plan,dataset_id:dataset,object_name:identity.object_name},namespaces[0].id,identity.native_id,readConfig);
 signer??=JSON.parse(a.coreSecrets.RECEIPT_SIGNING_JSON);
 const profile=domain==='cano'?{contract_version:ISOLATED_REAL_PROFILE_VERSION,environment_id:'isolated-test',dataset_id:dataset,source_kind:'OWNER_REPOSITORY_SNAPSHOT',fixture_only:false,source_records:[(({raw_file,...pin})=>pin)(cano.record)],operator_principal_ids:['bridge-operator-'+domain],artifact_refs:{}}:{contract_version:ISOLATED_DOMAIN_PROFILE_VERSION,environment_id:'isolated-test',dataset_id:dataset,domain,fixture_only:false,source_pin:meta.pins[domain],operator_principal_ids:['bridge-operator-'+domain],test_window:lease,artifact_refs:{}};
 profile.artifact_refs=await (domain==='cano'?realCanoArtifactRefs(profile):domainBridgeArtifactRefs(profile));
 const trust={...a.trust,authority_instance_id:'bridge-'+process.env.GITHUB_RUN_ID+'-'+domain,recovery_generation:'bridge-generation-'+process.env.GITHUB_RUN_ID,receipt_keys:{[signer.key_id]:Object.values(authorities)[0]?.receipt_keys[signer.key_id]||a.trust.receipt_keys[signer.key_id]},approved_positive_decision_types:[],semantic_profile_hash:await hash(profile),artifacts:Object.fromEntries(Object.entries(profile.artifact_refs).map(([k,v])=>[k,v.hash]))};
 delete trust.locator_artifact_hash;trust.locator_artifact_hash=await hash(trust);
 await (domain==='cano'?validateRealCanoProfile(profile,trust):validateDomainBridgeProfile(profile,trust));
 const actor=(id,token,permissions)=>({...trust,id,token,mode:'LIVE',owner:'bridge-owner',epoch:1,permissions});
 principals.push(actor('bridge-operator-'+domain,a.tokens.operator,['read','bootstrap','control','promote','export',domain==='cano'?'manual-source-admit':'domain-source-admit']),actor('bridge-read-'+domain,a.tokens.read,['read']));
 authorities[dataset]=trust;profiles[dataset]=profile;tokens[dataset]={operator:a.tokens.operator,read:a.tokens.read};reads[dataset]=a.tokens.read;
}
const coreSecrets={...packConfig(authorities,TRUST_BINDINGS),...packConfig(profiles,PROFILE_REGISTRY_BINDINGS),SEMANTIC_PROFILE_1:'',SEMANTIC_PROFILE_2:'',SEMANTIC_PROFILE_3:'',...principalSecrets(principals),RECEIPT_SIGNING_JSON:JSON.stringify(signer)};
const runtimeSecrets={...packConfig(authorities,TRUST_BINDINGS),CONTROL_READ_TOKEN:'',CONTROL_READ_TOKENS_JSON:JSON.stringify(reads),S3_READONLY_CONFIG:JSON.stringify(readConfig)};
requireThat(Object.values({...coreSecrets,...runtimeSecrets}).every(v=>Buffer.byteLength(v)<=5000),'DOMAIN_CLOUD_SECRET_OVERSIZE');
for(const [name,value] of [['core-secrets',coreSecrets],['runtime-secrets',runtimeSecrets],['domain.private',{authorities,profiles,tokens,origins}]])await writeFile('.cloud-proof/'+name+'.json',JSON.stringify(value),{mode:0o600});
await writeFile('.cloud-proof/domain-locators.public.json',JSON.stringify(authorities,null,2)+'\n');
await writeFile('.cloud-proof/domain-profiles.public.json',JSON.stringify(profiles,null,2)+'\n');
const config=JSON.parse(await readFile('.cloud-proof/core.json','utf8'));config.main='../src/workers/core.js';config.vars={ENVIRONMENT_ID:'isolated-test'};await writeFile('.cloud-proof/core.json',JSON.stringify(config));
console.log('Pinned eleven native locators, captured source profiles and dataset-scoped capabilities. Operational action remains disabled.');
