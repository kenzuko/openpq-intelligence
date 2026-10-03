import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './support.js';
import {hash} from '../src/platform/contracts.js';
import {gitBlobSha} from '../src/ingress/cano-real-shadow.js';
import {CONTINUOUS_PROFILE_VERSION,continuousArtifactRefs,continuousArtifactDocuments,buildContinuousCandidate,validateContinuousProfile} from '../src/platform/domain-continuous-admission.js';
import {ISOLATED_ACCOUNT_ID} from '../src/platform/domain-bridge-admission.js';
import {domainSnapshotServing,domainLegacyView} from '../src/platform/domain-serving.js';
import {decodeOwnedSource,DOMAIN_RUNTIME_URLS} from '../src/ingress/domain-source-common.js';
import {verifyAuthoritySnapshot} from '../src/platform/authority-snapshot.js';
import {verifyDomainRecoveryClosure,DOMAIN_RECOVERY_CLOSURE_VERSION} from '../src/platform/domain-recovery-closure.js';
const meta=JSON.parse(await readFile(new URL('./data/domains/SOURCE_PINS.json',import.meta.url),'utf8'));
const raw=JSON.parse(await readFile(new URL('./data/domains/weather_compact.json',import.meta.url),'utf8'));
async function source(time,extra={}){
 const raw_utf8=JSON.stringify({...raw,generated_at:time,...extra})+'\n';
 return {raw_utf8,pin:{...meta.pins.weather_compact,source_pointer:{...meta.pins.weather_compact.source_pointer,commit_sha:'a'.repeat(40)},payload_sha256:await hash(raw_utf8),git_blob_sha:await gitBlobSha(new TextEncoder().encode(raw_utf8))}};
}
async function profile(){
 const p={contract_version:CONTINUOUS_PROFILE_VERSION,environment_id:'isolated-test',dataset_id:'weather.compact.bridge.phu-quoc',domain:'weather_compact',fixture_only:false,producer:{source_kind:'OWNER_REPOSITORY_SNAPSHOT',repository:'kenzuko/Jotrip-Weather',path:'data/weather-runtime/compact.json'},operator_principal_ids:['operator'],reference_policy:{lease_ms:240000,max_snapshot_age_ms:600000,future_skew_ms:0},artifact_refs:{}};
 p.artifact_refs=await continuousArtifactRefs(p);return p;
}
test('continuous reference profile admits a new exact source pin without authority/profile rotation and denies regression atomically',async()=>{
 const p=await profile(),s=await setup({semanticProfile:p,dataset_id:p.dataset_id,environment_id:'isolated-test',account_id:ISOLATED_ACCOUNT_ID,domainOperator:true});
 const now=Date.now(),firstTime=new Date(now-10000).toISOString(),nextTime=new Date(now-5000).toISOString();
 const build=async(time,id,revision,extra={})=>buildContinuousCandidate(p,s.trust,{...await source(time,extra),operator_principal_id:'operator',evaluation_time:new Date(Date.now()).toISOString(),candidate_id:id,expected_revision:revision,logical_slot:revision});
 const commit=async(c,id)=>{const prepared=await s.call('prepare',c,'test-only-operator');assert.equal(prepared.status,200,JSON.stringify(prepared));return s.call('commit',{...s.trust,command_id:id,digest:prepared.body.digest,expires_at:c.valid_to},'test-only-operator');};
 try{
  const first=await build(firstTime,'continuous-first',0),a=await commit(first,'commit-first');assert.equal(a.status,200,JSON.stringify(a));
  const next=await build(nextTime,'continuous-next',1,{reference_test_revision:2}),b=await commit(next,'commit-next');assert.equal(b.status,200,JSON.stringify(b));assert.equal(b.body.receipt.revision,2);
  assert.equal(first.semantic_profile_hash,next.semantic_profile_hash);assert.notEqual(first.semantic_admission.input_hash,next.semantic_admission.input_hash);
  assert.equal(next.decision.effect,'ABSTAIN');assert.equal(next.semantic_admission.source_policies_activated,false);
  const regression=await commit(await build(firstTime,'continuous-old',2),'commit-old');assert.equal(regression.status,409);assert.equal(regression.body.error,'CONTINUOUS_SOURCE_REGRESSION');
  const collision=await commit(await build(nextTime,'continuous-collision',2,{reference_test_revision:3}),'commit-collision');assert.equal(collision.status,409);assert.equal(collision.body.error,'CONTINUOUS_SOURCE_REGRESSION');
  const renewed=await commit(await build(nextTime,'continuous-renew',2,{reference_test_revision:2}),'commit-renew');assert.equal(renewed.status,200);assert.equal(renewed.body.receipt.revision,3);
  assert.equal((await s.call('export',{},'test-only-operator')).status,200);
  const bucket=await s.mf.getR2Bucket('CANONICAL','core'),generation=JSON.parse(await (await bucket.get(renewed.body.receipt.key)).text()),signed=JSON.parse(await (await bucket.get(`checkpoints/${s.trust.authority_instance_id}/${s.trust.recovery_generation}/latest.json`)).text());
  s.principals.find(x=>x.id==='operator').permissions.push('recovery-export');await s.mf.setOptions(s.options());
  const archiveBucket=await s.mf.getR2Bucket('CANONICAL','core');
  const snapshot=(await s.call('recovery-export',{},'test-only-operator')).body,checked=await verifyAuthoritySnapshot(snapshot,s.trust),generations=[];
  for(const row of checked.tables.prepared){const prepared=JSON.parse(row.body);generations.push({key:prepared.key,content:JSON.parse(await (await archiveBucket.get(prepared.key)).text())});}
  const archive={contract_version:DOMAIN_RECOVERY_CLOSURE_VERSION,snapshot,profile:p,artifact_documents:continuousArtifactDocuments(p),generations,publication:signed};
  const closure=await verifyDomainRecoveryClosure(archive,s.trust,new Date(now+86400000).toISOString());assert.equal(closure.watermark.revision,3);assert.equal(closure.prepared_generation_objects_verified,5);assert.equal(closure.display_lease_expired,true);
  const missing=structuredClone(archive);missing.generations.shift();await assert.rejects(verifyDomainRecoveryClosure(missing,s.trust,new Date(now).toISOString()),/GENERATIONS_INCOMPLETE/);
  const view=await domainSnapshotServing(generation,Date.now());assert.equal(view.serving.operational_action_allowed,false);assert.deepEqual(await domainLegacyView(generation,signed,s.trust),JSON.parse((await source(nextTime,{reference_test_revision:2})).raw_utf8));
 }finally{await s.mf.dispose();}
});
test('continuous reference source age, exact producer path, raw/blob provenance, and operator are independently enforced',async()=>{
 const p=await profile(),s=await setup({semanticProfile:p,dataset_id:p.dataset_id,environment_id:'isolated-test',account_id:ISOLATED_ACCOUNT_ID,domainOperator:true});
 const build=async(input)=>buildContinuousCandidate(p,s.trust,{...input,operator_principal_id:'operator',evaluation_time:new Date(Date.now()).toISOString(),candidate_id:'continuous-deny'});
 try{
  await assert.rejects(build(await source(new Date(Date.now()-600001).toISOString())),/SNAPSHOT_AGE_DENIED/);
  await assert.rejects(build(await source(new Date(Date.now()+60000).toISOString())),/SNAPSHOT_AGE_DENIED/);
  const value=await source(new Date(Date.now()-1000).toISOString());await assert.rejects(build({...value,pin:{...value.pin,source_pointer:{...value.pin.source_pointer,path:'data/weather-runtime/current.json'}}}),/SOURCE_DENIED/);
  await assert.rejects(build({...value,pin:{...value.pin,git_blob_sha:'b'.repeat(40)}}),/GIT_BLOB_MISMATCH/);
  const c=await build(value);assert.notEqual((await s.call('prepare',c,'test-only-live')).status,200);
  c.decision.effect='POSITIVE';assert.notEqual((await s.call('prepare',c,'test-only-operator')).status,200);
  await assert.rejects(validateContinuousProfile(p,{...s.trust,environment_id:'production'}),/SCOPE_DENIED/);
  await assert.rejects(validateContinuousProfile(p,{...s.trust,account_id:'b'.repeat(32)}),/SCOPE_DENIED/);
 }finally{await s.mf.dispose();}
});
test('public source admission allows exact owned routes and rejects other host/path/query or editorial companion scope',async()=>{
 const raw_utf8=JSON.stringify(raw),pin={source_kind:'OWNER_PUBLIC_RUNTIME',source_pointer:{url:DOMAIN_RUNTIME_URLS.weather_compact},payload_sha256:await hash(raw_utf8),git_blob_sha:null};
 await decodeOwnedSource('weather_compact',{pin,raw_utf8});
 for(const url of ['https://other.invalid/weather/data/weather-runtime/compact.json',DOMAIN_RUNTIME_URLS.weather_compact+'?source=old','https://openphuquoc.com/weather/data/weather-runtime/current.json'])await assert.rejects(decodeOwnedSource('weather_compact',{pin:{...pin,source_pointer:{url}},raw_utf8}),/ORIGIN_DENIED/);
 const p=await profile();const invalid={...p,domain:'nearme',dataset_id:'directory.bridge.phu-quoc',producer:{source_kind:'OWNER_PUBLIC_RUNTIME',url:'https://openphuquoc.com/data/home-support.json'}};
 await assert.rejects(validateContinuousProfile(invalid,{environment_id:'isolated-test',account_id:ISOLATED_ACCOUNT_ID,dataset_id:invalid.dataset_id}),/PRODUCER_DENIED/);
});

