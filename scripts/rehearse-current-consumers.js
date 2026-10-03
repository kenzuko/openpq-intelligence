import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {setup} from '../tests/support.js';
import {hash} from '../src/platform/contracts.js';
import {DOMAIN_RUNTIME_URLS,NEARME_COMPANION_RUNTIME_URLS,DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {CONTINUOUS_PROFILE_VERSION,continuousArtifactRefs,buildContinuousCandidate} from '../src/platform/domain-continuous-admission.js';
import {ISOLATED_ACCOUNT_ID} from '../src/platform/domain-bridge-admission.js';
import {domainLegacyView,domainSnapshotServing} from '../src/platform/domain-serving.js';
import {rehearseNearMeConsumer} from '../src/ingress/nearme-consumer.js';
const dir=process.argv[2]||'.consumer-audit',capture=JSON.parse(await readFile(dir+'/CAPTURE.json','utf8'));
async function input(url){
 const row=capture.captures.find(x=>x.url.replace(/\/$/,'')===url.replace(/\/$/,''));assert.equal(row?.status,'CAPTURED_JSON_OBJECT');
 const raw_utf8=await readFile(dir+'/'+row.file,'utf8');assert.equal(await hash(raw_utf8),row.sha256);
 return {raw_utf8,pin:{source_kind:'OWNER_PUBLIC_RUNTIME',source_pointer:{url},payload_sha256:row.sha256,git_blob_sha:null}};
}
const evidence={contract:'openpq-current-consumer-native-rehearsal-v1',cloud_authority_proof:false,production_ready:false,cases:[]};
for(const [domain,url]of Object.entries(DOMAIN_RUNTIME_URLS)){
 const p={contract_version:CONTINUOUS_PROFILE_VERSION,environment_id:'isolated-test',dataset_id:DOMAIN_DATASETS[domain],domain,fixture_only:false,producer:{source_kind:'OWNER_PUBLIC_RUNTIME',url},operator_principal_ids:['operator'],reference_policy:{lease_ms:240000,max_snapshot_age_ms:domain==='nearme'?31*86400000:86400000,future_skew_ms:0},artifact_refs:{}};
 // This is an explicit reference ceiling. It never activates observation/model/provider freshness policy.
 p.artifact_refs=await continuousArtifactRefs(p);
 const s=await setup({semanticProfile:p,dataset_id:p.dataset_id,environment_id:'isolated-test',account_id:ISOLATED_ACCOUNT_ID,domainOperator:true});
 try{
  const value=await input(url),c=await buildContinuousCandidate(p,s.trust,{...value,operator_principal_id:'operator',evaluation_time:new Date(Date.now()).toISOString(),candidate_id:'current-'+domain});
  const a=await s.call('prepare',c,'test-only-operator');assert.equal(a.status,200,JSON.stringify(a));const b=await s.call('commit',{...s.trust,command_id:'current-commit',digest:a.body.digest,expires_at:c.valid_to},'test-only-operator');assert.equal(b.status,200,JSON.stringify(b));
  assert.equal((await s.call('export',{},'test-only-operator')).status,200);
  const bucket=await s.mf.getR2Bucket('CANONICAL','core'),g=JSON.parse(await (await bucket.get(b.body.receipt.key)).text()),signed=JSON.parse(await (await bucket.get(`checkpoints/${s.trust.authority_instance_id}/${s.trust.recovery_generation}/latest.json`)).text());
  assert.deepEqual(await domainLegacyView(g,signed,s.trust),JSON.parse(value.raw_utf8));const view=await domainSnapshotServing(g,Date.now());
  evidence.cases.push({domain,status:'PASS',records:view.projection.records.length,issues:view.projection.issues,metadata:view.projection.metadata,input_sha256:value.pin.payload_sha256,profile_hash:s.trust.semantic_profile_hash,revision:b.body.receipt.revision,decision:'ABSTAIN',source_policies_activated:false});
 }finally{await s.mf.dispose();}
}
const near=await rehearseNearMeConsumer({index:await input(DOMAIN_RUNTIME_URLS.nearme),support:await input(NEARME_COMPANION_RUNTIME_URLS[0]),venues:await input(NEARME_COMPANION_RUNTIME_URLS[1])});
evidence.cases.push({domain:'nearme-three-source-consumer',status:'PASS',merged_count:near.merged_count,rows_digest:near.rows_digest,companion_authority_admitted:false,live_open_confirmed:false});
await writeFile(dir+'/NATIVE_REHEARSAL.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({native_cases:evidence.cases.length,status:'PASS',production_ready:false}));
