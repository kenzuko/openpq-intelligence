import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setup} from './support.js';
import {hash} from '../src/platform/contracts.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {DOMAIN_PROFILE_VERSION,domainBridgeArtifactRefs,buildDomainBridgeCandidate,validateDomainBridgeProfile} from '../src/platform/domain-bridge-admission.js';
import {packDomainJson,unpackDomainJson} from '../src/platform/domain-codec.js';
import {domainLegacyView} from '../src/platform/domain-serving.js';

const meta=JSON.parse(await readFile(new URL('./data/domains/SOURCE_PINS.json',import.meta.url),'utf8')),AT=meta.evaluation_time,OP='test-only-operator';
const copy=x=>JSON.parse(JSON.stringify(x));
async function fixture(domain,{domainOperator=true,editProfile=null}={}){
 const raw_utf8=await readFile(new URL('./data/domains/'+domain+'.json',import.meta.url),'utf8');
 const profile={contract_version:DOMAIN_PROFILE_VERSION,environment_id:'local-test',dataset_id:DOMAIN_DATASETS[domain],domain,fixture_only:false,source_pin:copy(meta.pins[domain]),operator_principal_ids:['operator'],test_window:{valid_from:AT,valid_to:'2026-10-03T01:17:00.000Z',basis:'LOCAL_TEST_REHEARSAL_ONLY'},artifact_refs:{}};
 if(editProfile)editProfile(profile);profile.artifact_refs=await domainBridgeArtifactRefs(profile);
 const s=await setup({semanticProfile:profile,dataset_id:profile.dataset_id,domainOperator,domainReplayClock:true});
 const c=await buildDomainBridgeCandidate(profile,s.trust,{raw_utf8,operator_principal_id:'operator',evaluation_time:AT,candidate_id:domain+'-source-bridge',logical_slot:10});
 return {s,c,profile,legacy:JSON.parse(raw_utf8)};
}
const commit=(s,p,id='bridge-commit',token=OP)=>s.call('commit',{...s.trust,command_id:id,digest:p.digest,expires_at:'2026-10-03T01:16:59.000Z'},token);
async function empty(s){assert.equal((await s.call('read',undefined,'test-only-read')).body.state.revision,0);assert.equal((await (await s.mf.getR2Bucket('CANONICAL','core')).list({prefix:'generations/'})).objects.length,0);}

for(const domain of ['weather','weather_forecast','weather_marine','weather_cloud','weather_compact','weather_meta','weather_manifest','airport','transit','nearme'])test(domain+' actual snapshot traverses native Core/SQLite/R2/receipt/Runtime and independently signed legacy readback',async()=>{
 const {s,c,legacy}=await fixture(domain);try{
  assert.ok(new TextEncoder().encode(JSON.stringify(c)).length<=262144,'candidate fits actual request bound');
  const p=await s.call('prepare',c,OP);assert.equal(p.status,200,JSON.stringify(p));const result=await commit(s,p.body);assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.body.receipt.semantic_admission.producer_independence,false);assert.equal(result.body.receipt.semantic_admission.source_policies_activated,false);
  const runtime=await s.mf.getWorker('runtime'),response=await runtime.fetch('https://runtime/datasets/'+s.trust.dataset_id);assert.equal(response.status,200,await response.clone().text());const served=await response.json();
  assert.equal(served.data.domain,domain);assert.equal(served.data.fixture_only,false);assert.equal(served.serving.authority,'VERIFIED');assert.equal(served.serving.freshness,'SOURCE_SNAPSHOT_REFERENCE');assert.equal(served.serving.decision_eligibility,'ABSTAIN');assert.equal(served.serving.domain_fields.operational_action_allowed,false);
  assert.equal((await s.call('export',{},OP)).status,200);const b=await s.mf.getR2Bucket('CANONICAL','core'),envelope=JSON.parse(await (await b.get(`checkpoints/${s.trust.authority_instance_id}/${s.trust.recovery_generation}/latest.json`)).text()),generation=JSON.parse(await (await b.get(result.body.receipt.key)).text());
  assert.deepEqual(await domainLegacyView(generation,envelope,s.trust),legacy);await assert.rejects(domainLegacyView(generation),/INDEPENDENT_RECEIPT_TRUST/);
  const bad=copy(envelope);bad.receipt.revision++;await assert.rejects(domainLegacyView(generation,bad,s.trust),/SIGNATURE_INVALID/);
  await s.mf.unsafeEvictDurableObject('core','DatasetCoordinator',{id:s.trust.native_id});assert.deepEqual((await commit(s,p.body)).body.receipt,result.body.receipt);
 }finally{await s.mf.dispose();}
});
test('domain admission denies wrong operator, actor claims, mode, source changes, forged encoded projection and positive effect before R2 writes',async()=>{
 const {s,c}=await fixture('transit');try{
  for(const token of ['test-only-live','test-only-read','test-only-shadow','test-only-backfill','test-only-wrong'])assert.notEqual((await s.call('prepare',c,token)).status,200);
  const changes=[x=>x.semantic_bundle.pin.payload_sha256='f'.repeat(64),x=>x.semantic_bundle.encoded_source.sha256='f'.repeat(64),x=>x.payload.domain_snapshot.operational_action_allowed=true,x=>x.payload.domain_snapshot.domain='weather',x=>x.semantic_admission.operator_principal_id='live',x=>x.semantic_admission.producer_independence=true,x=>x.semantic_admission.source_policies_activated=true,x=>x.decision.effect='POSITIVE',x=>x.decision.effect='RESTRICTIVE',x=>x.inputs[0].source_time=AT,x=>x.inputs[0].max_age_ms++,x=>x.valid_to='2026-10-03T01:18:00.000Z',x=>x.semantic_profile_hash='f'.repeat(64),x=>{x.operation='CORRECTION';x.supersedes_revision=0;x.reason='unapproved';}];
  for(const change of changes){const bad=copy(c);change(bad);assert.notEqual((await s.call('prepare',bad,OP)).status,200);}
  const altered=copy(c),projection=await unpackDomainJson(altered.payload.domain_snapshot.encoded_projection);projection.records[0].values.status='CANCELLED';altered.payload.domain_snapshot.encoded_projection=await packDomainJson(projection);assert.equal((await s.call('prepare',altered,OP)).body.error,'DOMAIN_OUTPUT_MISMATCH');
  await empty(s);
 }finally{await s.mf.dispose();}
});
test('source profile allowlist alone does not grant domain-source-admit and current capability revocation blocks commit/replay',async()=>{
 const missing=await fixture('airport',{domainOperator:false});try{assert.equal((await missing.s.call('prepare',missing.c,OP)).body.error,'DOMAIN_OPERATOR_DENIED');await empty(missing.s);}finally{await missing.s.mf.dispose();}
 const {s,c}=await fixture('airport');try{const p=await s.call('prepare',c,OP);assert.equal(p.status,200);const actor=s.principals.find(x=>x.id==='operator');actor.permissions=actor.permissions.filter(x=>x!=='domain-source-admit');await s.mf.setOptions(s.options());assert.equal((await commit(s,p.body,'revoked')).body.error,'DOMAIN_OPERATOR_DENIED');assert.equal((await s.call('read',undefined,'test-only-read')).body.state.revision,0);actor.permissions.push('domain-source-admit');await s.mf.setOptions(s.options());assert.equal((await commit(s,p.body,'granted')).status,200);actor.permissions=actor.permissions.filter(x=>x!=='domain-source-admit');await s.mf.setOptions(s.options());assert.equal((await commit(s,p.body,'granted')).body.error,'DOMAIN_OPERATOR_DENIED');}finally{await s.mf.dispose();}
});
test('Runtime reevaluates Airport source age at serve time while the snapshot lease remains valid',async()=>{
 const {s,c}=await fixture('airport');try{
  const p=await s.call('prepare',c,OP);assert.equal((await commit(s,p.body)).status,200);const r=await (await s.mf.getWorker('runtime')).fetch('https://runtime/datasets/'+s.trust.dataset_id);const first=await r.json();assert.equal(first.serving.domain_fields.fields[0].freshness,'WITHIN_USER_LAG_TARGET');
  const options=s.options();options.workers.find(w=>w.name==='runtime').scriptPath=fileURLToPath(new URL('./domain-later-runtime.js',import.meta.url));await s.mf.setOptions(options);const later=await (await s.mf.getWorker('runtime')).fetch('https://runtime/datasets/'+s.trust.dataset_id);assert.equal(later.status,200);const data=await later.json();assert.equal(data.serving.domain_fields.fields[0].freshness,'OUTSIDE_USER_LAG_TARGET');assert.equal(data.serving.decision_eligibility,'ABSTAIN');assert.equal(data.serving.freshness,'SOURCE_SNAPSHOT_REFERENCE');
 }finally{await s.mf.dispose();}
});
test('signed Runtime fallback stays reference-only and a test lease cannot be renewed by serving or committed after expiry',async()=>{
 const {s,c}=await fixture('weather');try{
  const p=await s.call('prepare',c,OP);assert.equal((await commit(s,p.body)).status,200);assert.equal((await s.call('export',{},OP)).status,200);s.principals.find(x=>x.id==='read').permissions=[];await s.mf.setOptions(s.options());
  const r=await (await s.mf.getWorker('runtime')).fetch('https://runtime/datasets/'+s.trust.dataset_id);assert.equal(r.status,200);const b=await r.json();assert.equal(b.serving.fallback,true);assert.equal(b.serving.authority,'UNVERIFIED');assert.equal(b.serving.decision_eligibility,'ABSTAIN');assert.equal(b.data.production_enabled,false);
  const options=s.options();options.workers.find(w=>w.name==='runtime').scriptPath=fileURLToPath(new URL('./domain-expired-runtime.js',import.meta.url));await s.mf.setOptions(options);const expired=await (await s.mf.getWorker('runtime')).fetch('https://runtime/datasets/'+s.trust.dataset_id);assert.equal(expired.status,503);assert.equal((await expired.json()).error,'DISPLAY_EXPIRED');
 }finally{await s.mf.dispose();}
 const f=await fixture('nearme');try{const p=await f.s.call('prepare',f.c,OP);const options=f.s.options();options.workers.find(w=>w.name==='core').scriptPath=fileURLToPath(new URL('./domain-expired-core.js',import.meta.url));await f.s.mf.setOptions(options);const denied=await f.s.call('commit',{...f.s.trust,command_id:'expired',digest:p.body.digest,expires_at:'2026-10-03T01:18:00.000Z'},OP);assert.equal(denied.body.error,'DOMAIN_TEST_LEASE_EXPIRED');assert.equal((await f.s.call('read',undefined,'test-only-read')).body.state.revision,0);}finally{await f.s.mf.dispose();}
});
test('domain profile scope, bounds, configuration pin and production environment remain closed',async()=>{
 const {s,profile}=await fixture('transit');try{
  for(const change of [x=>x.environment_id='production',x=>x.domain='cano',x=>x.fixture_only=true,x=>x.test_window.basis='PRODUCTION_APPROVED',x=>x.test_window.valid_to='2026-10-03T02:00:00.000Z',x=>x.operator_principal_ids=[]]){const bad=copy(profile);change(bad);await assert.rejects(validateDomainBridgeProfile(bad,s.trust));}
  const bad=copy(profile);bad.source_pin.source_pointer.commit_sha='f'.repeat(40);bad.artifact_refs=await domainBridgeArtifactRefs(bad);await assert.rejects(validateDomainBridgeProfile(bad,{...s.trust,artifacts:Object.fromEntries(Object.entries(bad.artifact_refs).map(([k,v])=>[k,v.hash]))}),/PROFILE_PIN_MISMATCH/);
 }finally{await s.mf.dispose();}
});
