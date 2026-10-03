import {waitForDomainRuntime} from './domain-readiness.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {hash,requireThat,ContractError} from '../../src/platform/contracts.js';
import {buildDomainBridgeCandidate} from '../../src/platform/domain-bridge-admission.js';
import {buildRealCanoCandidate} from '../../src/platform/real-cano-admission.js';
import {domainLegacyView} from '../../src/platform/domain-serving.js';
import {S3ReadonlyReader} from '../../src/platform/s3-reader.js';
import {verifyAttestation} from '../../src/platform/receipts.js';
import {buildBackup} from '../../src/preparation/recovery.js';
import {savePortableBackup,loadPortableBackup} from '../preparation/portable-backup.js';
import {principalSecrets} from './prepare.js';
import {PRINCIPAL_SECRET_NAMES} from '../../src/platform/auth.js';
import {waitForCapabilityStatus} from './capability-readiness.js';
const root='.cloud-proof/',mode=process.argv[2]||'prove';
const privateProof=JSON.parse(await readFile(root+'domain.private.json','utf8'));
const {authorities,profiles,tokens,origins}=privateProof;
let report={status:'REAL_CLOUD_BRIDGE_RUNNING',cases:[],datasets:[],source_capture:'PINNED_PREVIOUS_CAPTURE_NOT_CURRENT_SOURCE_HEALTH',production_enabled:false,operational_action_allowed:false,full_system_restore_proven:false,code_sha:process.env.GITHUB_SHA,run_id:process.env.GITHUB_RUN_ID};
const save=()=>writeFile(root+'domain-evidence.json',JSON.stringify(report,null,2)+'\n');
const check=async(name,fn)=>{try{await fn();report.cases.push({name,status:'PASS'});}catch(e){report.cases.push({name,status:'FAIL',error:e instanceof ContractError?e.code:'DOMAIN_PROOF_FAILED'});throw e;}finally{await save();}};
const core=async(dataset,path,body,token=tokens[dataset].operator)=>{const r=await fetch(origins.core+'/datasets/'+dataset+'/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await r.json();report.core_observations??=[];report.core_observations.push({dataset_id:dataset,path,status:r.status,error:typeof value.error==='string'&&/^[A-Z0-9_]{1,100}$/.test(value.error)?value.error:null});return {status:r.status,body:value};};
const runtime=async dataset=>{const start=Date.now();const r=await fetch(origins.runtime+'/datasets/'+dataset,{redirect:'error',signal:AbortSignal.timeout(15000)}),body=await r.json();report.runtime_observations??=[];report.runtime_observations.push({dataset_id:dataset,status:r.status,elapsed_ms:Date.now()-start,authority:body.serving?.authority??null,fallback:body.serving?.fallback??null,eligibility:body.serving?.decision_eligibility??null,receipt_digest:body.receipt?.digest??null,control_observation:body.serving?.control_observation??null,error:typeof body.error==='string'&&/^[A-Z0-9_]{1,100}$/.test(body.error)?body.error:null});return {status:r.status,body};};
const command=(args)=>{const r=spawnSync('node_modules/.bin/wrangler',args,{stdio:'pipe',encoding:'utf8',env:{...process.env,CLOUDFLARE_API_TOKEN:process.env.CF_TEST_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:Object.values(authorities)[0].account_id,WRANGLER_SEND_METRICS:'false'}});requireThat(r.status===0,'DOMAIN_DEPLOY_COMMAND_FAILED',503);};
const ids=Object.keys(authorities);
try{
 if(mode==='prove'){
  await check('final Core has no temporary native probe',async()=>{await waitForCapabilityStatus(()=>fetch(origins.core+'/probe',{signal:AbortSignal.timeout(15000)}),404,{failureCode:'DOMAIN_PROBE_STILL_PRESENT'});});
  const reader=new S3ReadonlyReader(JSON.parse(JSON.parse(await readFile(root+'runtime-secrets.json','utf8')).S3_READONLY_CONFIG));
  await mkdir(root+'domain-backups',{recursive:true});
  const samples=[];
  for(const dataset of ids){
   await check(dataset+' authenticated native admission, exact legacy parity and portable signed backup',async()=>{
    const trust=authorities[dataset],profile=profiles[dataset],isCano=dataset==='cano.operation.an-thoi';
    const boot=await core(dataset,'bootstrap',{...trust,owner:'bridge-owner',epoch:1});requireThat(boot.status===200,'DOMAIN_BOOTSTRAP_FAILED');
    requireThat((await core(dataset,'bootstrap',{...trust,owner:'bridge-owner',epoch:1})).status===409,'DOMAIN_BOOTSTRAP_REPEATED');
    const raw_utf8=await readFile(isCano?'tests/data/real-cano/2026-10-03-cano-an-thoi.json':'tests/data/domains/'+profile.domain+'.json','utf8');
    const evaluation_time=new Date().toISOString(),options={raw_utf8,operator_principal_id:'bridge-operator-'+(isCano?'cano':profile.domain),evaluation_time,candidate_id:'cloud-owned-'+(isCano?'cano':profile.domain),logical_slot:10};
    const c=isCano?await buildRealCanoCandidate(profile,trust,{...options,bundle:{contract_version:'openpq-real-cano-bundle-isolated-v1',raw_utf8,...profile.source_records[0]}}):await buildDomainBridgeCandidate(profile,trust,options);
    const forged=structuredClone(c);forged.decision.effect='POSITIVE';requireThat((await core(dataset,'prepare',forged)).status!==200,'DOMAIN_POSITIVE_ACTION_ACCEPTED');
    const other=ids.find(x=>x!==dataset);requireThat((await core(dataset,'read',undefined,tokens[other].operator)).status===403,'DOMAIN_CROSS_DATASET_READ_ALLOWED');
    const p=await core(dataset,'prepare',c);requireThat(p.status===200,'DOMAIN_PREPARE_FAILED');
    const cmd={...trust,command_id:'domain-commit-'+dataset.replace(/[^a-zA-Z0-9_-]/g,'-'),digest:p.body.digest,expires_at:new Date(Date.now()+60000).toISOString()};
    const committed=await core(dataset,'commit',cmd);requireThat(committed.status===200,'DOMAIN_COMMIT_FAILED');
    const retried=await core(dataset,'commit',cmd);requireThat(retried.status===200&&await hash(retried.body.receipt)===await hash(committed.body.receipt),'DOMAIN_RETRY_DIVERGED');
    const served=await waitForDomainRuntime(()=>runtime(dataset),{authority:'VERIFIED',fallback:false,receipt_digest:p.body.digest});
    requireThat(served.body.receipt.digest===p.body.digest,'DOMAIN_RUNTIME_DIGEST_MISMATCH');
    const exported=await core(dataset,'export',{});requireThat(exported.status===200,'DOMAIN_EXPORT_FAILED');
    const generation=JSON.parse(await reader.get(committed.body.receipt.key));
    const envelope=JSON.parse(await reader.get(`checkpoints/${trust.authority_instance_id}/${trust.recovery_generation}/latest.json`));
    const receipt=await verifyAttestation(envelope,trust);requireThat(receipt.digest===p.body.digest,'DOMAIN_CHECKPOINT_DIGEST_MISMATCH');
    if(!isCano){const bridgeResponse=await fetch(origins.runtime+'/datasets/'+dataset+'/legacy-reference',{redirect:'error',signal:AbortSignal.timeout(15000)});requireThat(bridgeResponse.status===200&&bridgeResponse.headers.get('x-openpq-source-snapshot')==='reference-only'&&bridgeResponse.headers.get('x-openpq-decision-eligibility')==='ABSTAIN'&&bridgeResponse.headers.get('x-openpq-receipt-digest')===p.body.digest&&await hash(await bridgeResponse.text())===await hash(raw_utf8),'DOMAIN_CONSUMER_BRIDGE_PARITY_FAILED');requireThat(await hash(await domainLegacyView(generation,envelope,trust))===await hash(JSON.parse(raw_utf8)),'DOMAIN_LEGACY_PARITY_FAILED');requireThat(served.body.serving.freshness==='SOURCE_SNAPSHOT_REFERENCE','DOMAIN_REFERENCE_LABEL_MISSING');samples.push({kind:'profile',value:profile},{kind:'bundle',value:c.semantic_bundle},{kind:'proof',value:c.semantic_admission},{kind:'projection',value:served.body.data},{kind:'codec',value:c.semantic_bundle.encoded_source});}
    else requireThat(generation.semantic_bundle.raw_utf8===raw_utf8&&served.body.data.real_manual_cano.fixture_only===false,'CANO_EXACT_SOURCE_MISMATCH');
    const state=(await core(dataset,'read')).body.state;
    const backup=await buildBackup({environment_id:'isolated-test',authority:trust,created_at:new Date().toISOString(),watermark:{revision:state.revision,control_revision:state.control_revision},required_keys:['control','receipt',receipt.key],records:[{key:'control',kind:'CONTROL',content:state},{key:'receipt',kind:'RECEIPT',content:envelope},{key:receipt.key,kind:'GENERATION',content:generation},...['AUDIT','REGISTRY','SCHEDULER','DEPLOY'].map(kind=>({key:kind.toLowerCase(),kind,content:{captured_source_reference:true,full_authoritative_export:false,code_sha:process.env.GITHUB_SHA}}))]});
    const destination=root+'domain-backups/'+(isCano?'cano':profile.domain);await savePortableBackup(backup,trust,destination);const verification=(await loadPortableBackup(destination,trust)).verification;requireThat(verification.publication_receipt_authenticity_verified,'DOMAIN_BACKUP_SIGNATURE_FAILED');
    report.datasets.push({dataset_id:dataset,domain:isCano?'cano':profile.domain,source_pin:isCano?profile.source_records[0]:profile.source_pin,profile_hash:trust.semantic_profile_hash,receipt_digest:receipt.digest,revision:receipt.revision,record_count:isCano?1:served.body.data.records.length,decision_eligibility:served.body.serving.decision_eligibility,source_time:generation.inputs[0].source_time,display_expires_at:generation.valid_to,backup_status:verification.status,fixture_only:false,production_enabled:false});
   });
  }
  await writeFile(root+'ISOLATED_SCHEMA_SAMPLES.json',JSON.stringify(samples)+'\n');
  await check('all eleven sources coexist after admission',async()=>{for(const dataset of ids){const s=await runtime(dataset);requireThat(s.status===200&&s.body.receipt.digest===report.datasets.find(x=>x.dataset_id===dataset).receipt_digest&&s.body.serving.decision_eligibility==='ABSTAIN','DOMAIN_COEXISTENCE_FAILED');}});
  await check('read authority outage serves signed references with no operational action',async()=>{
   const secrets=JSON.parse(await readFile(root+'core-secrets.json','utf8')),entries=PRINCIPAL_SECRET_NAMES.flatMap(k=>JSON.parse(secrets[k]||'[]'));
   await writeFile(root+'read-outage.private.json',JSON.stringify(principalSecrets(entries.filter(x=>!x.id.startsWith('bridge-read-')))),{mode:0o600});
   command(['secret','bulk',root+'read-outage.private.json','--config',root+'core.json']);command(['deploy','--config',root+'core.json']);command(['deploy','--config',root+'runtime.json']);
   await waitForCapabilityStatus(()=>core(ids[0],'read',undefined,tokens[ids[0]].read),401,{failureCode:'DOMAIN_READ_OUTAGE_NOT_OBSERVED'});
   for(const dataset of ids)await waitForDomainRuntime(()=>runtime(dataset),{authority:'UNVERIFIED',fallback:true,receipt_digest:report.datasets.find(x=>x.dataset_id===dataset).receipt_digest});
   command(['secret','bulk',root+'core-secrets.json','--config',root+'core.json']);command(['deploy','--config',root+'core.json']);command(['deploy','--config',root+'runtime.json']);
   await waitForCapabilityStatus(()=>core(ids[0],'read',undefined,tokens[ids[0]].read),200,{failureCode:'DOMAIN_READ_RESTORE_NOT_OBSERVED'});
   for(const dataset of ids){await waitForCapabilityStatus(()=>core(dataset,'read',undefined,tokens[dataset].read),200,{failureCode:'DOMAIN_DATASET_READ_RESTORE_NOT_OBSERVED'});await waitForDomainRuntime(()=>runtime(dataset),{authority:'VERIFIED',fallback:false,receipt_digest:report.datasets.find(x=>x.dataset_id===dataset).receipt_digest});}
  });
  report.status='REAL_CLOUD_BRIDGE_SUBSET_PASS';await save();
 }else if(mode==='cleanup'){
  report=JSON.parse(await readFile(root+'domain-evidence.json','utf8'));
  await check('temporary source admission capabilities closed with positive Runtime witness',async()=>{
   const secrets=JSON.parse(await readFile(root+'core-secrets.json','utf8')),entries=PRINCIPAL_SECRET_NAMES.flatMap(k=>JSON.parse(secrets[k]||'[]')).filter(x=>x.id.startsWith('bridge-read-'));
   await writeFile(root+'operator-close.private.json',JSON.stringify(principalSecrets(entries)),{mode:0o600});command(['secret','bulk',root+'operator-close.private.json','--config',root+'core.json']);command(['deploy','--config',root+'core.json']);
   await waitForCapabilityStatus(()=>core(ids[0],'read'),401,{failureCode:'DOMAIN_OPERATOR_REVOKE_NOT_OBSERVED'});
   if(report.datasets.length){const witness=await runtime(report.datasets[0].dataset_id);requireThat(witness.status===200&&witness.body.serving.authority==='VERIFIED','DOMAIN_CLEANUP_RUNTIME_WITNESS_FAILED');report.cleanup_witness={kind:'RUNTIME_PUBLICATION_READ',status:200};}else{const witness=await core(ids[0],'read',undefined,tokens[ids[0]].read);requireThat(witness.status===200&&witness.body.state?.dataset_id===ids[0],'DOMAIN_CLEANUP_CORE_WITNESS_FAILED');report.cleanup_witness={kind:'CORE_READ_UNPUBLISHED_LOCATOR',status:200};}report.cleanup='SUCCESS';
  });await save();
 }else throw new ContractError('DOMAIN_PROOF_MODE_INVALID');
}catch(error){report.status='REAL_CLOUD_BRIDGE_BLOCKED_OR_FAILED';report.error=error instanceof ContractError?error.code:'DOMAIN_PROOF_FAILED';await save();console.error(report.error);process.exitCode=1;}
