import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup,iso} from './support.js';
import {hash} from '../src/platform/contracts.js';
import {packAdmissionProfile,validateSemanticAdmission} from '../src/platform/semantic-admission.js';
import {REAL_PROFILE_VERSION,REAL_BUNDLE_VERSION,realCanoArtifactRefs,validateRealCanoProfile,buildRealCanoCandidate} from '../src/platform/real-cano-admission.js';
import {servingView} from '../src/platform/serving.js';
import {gitBlobSha} from '../src/ingress/cano-real-shadow.js';
import {fileURLToPath} from 'node:url';

const AT='2026-10-03T00:30:00.000Z',OP='test-only-operator',copy=x=>JSON.parse(JSON.stringify(x));
async function fixture({native=true,replayClock=true,manualOperator=true,editProfile=null}={}){
 const source=JSON.parse(await readFile(new URL('./data/real-cano/SOURCE.json',import.meta.url),'utf8'));
 assert.equal(source.fixture_only,false);
 const raw_utf8=await readFile(new URL('./data/real-cano/2026-10-03-cano-an-thoi.json',import.meta.url),'utf8');
 const {raw_file,...pin}=source.record;
 const bundle={contract_version:REAL_BUNDLE_VERSION,raw_utf8,...pin};
 const profile={contract_version:REAL_PROFILE_VERSION,environment_id:'local-test',dataset_id:'cano.operation.an-thoi',source_kind:'OWNER_REPOSITORY_SNAPSHOT',fixture_only:false,source_records:[pin],operator_principal_ids:['operator'],artifact_refs:{}};
 if(editProfile)editProfile(profile);profile.artifact_refs=await realCanoArtifactRefs(profile);
 const s=native?await setup({semanticProfile:profile,dataset_id:profile.dataset_id,manualOperator,realSourceReplayClock:replayClock}):null;
 const trust=s?.trust||{environment_id:'local-test',dataset_id:profile.dataset_id,semantic_profile_hash:await hash(profile),artifacts:Object.fromEntries(Object.entries(profile.artifact_refs).map(([k,v])=>[k,v.hash]))};
 const evaluation_time=replayClock?AT:iso(Date.now());
 const c=native?await buildRealCanoCandidate(profile,trust,{bundle,operator_principal_id:'operator',evaluation_time,candidate_id:'real-cano-recorded-fact',logical_slot:10}):null;
 return {s,profile,trust,bundle,c,actor:{id:'operator',environment_id:'local-test',dataset_id:profile.dataset_id,mode:'LIVE',permissions:['promote','manual-source-admit']}};
}
async function noPublication(s){
 assert.equal((await s.call('read',undefined,'test-only-read')).body.state.revision,0);
 assert.equal((await (await s.mf.getR2Bucket('CANONICAL','core')).list({prefix:'generations/'})).objects.length,0);
}
const commit=(s,p,id='real-recorded-commit',token=OP)=>s.call('commit',{...s.trust,command_id:id,digest:p.digest,expires_at:'2026-10-03T01:00:00.000Z'},token);

test('pinned actual source traverses native Coordinator SQLite/R2 and signed export as local ABSTAIN fact',async()=>{
 const {s,c}=await fixture();try{
  const p=await s.call('prepare',c,OP);assert.equal(p.status,200,JSON.stringify(p));
  const result=await commit(s,p.body);assert.equal(result.status,200,JSON.stringify(result));
  const receipt=result.body.receipt;assert.equal(receipt.revision,1);assert.equal(receipt.semantic_admission.operator_principal_id,'operator');assert.equal(receipt.semantic_admission.source_author_assurance,'SOURCE_RECORDED_ONLY');assert.equal(receipt.semantic_admission.action_allowed,false);
  const b=await s.mf.getR2Bucket('CANONICAL','core'),raw=await (await b.get(receipt.key)).text();assert.equal(await hash(raw),receipt.digest);const generation=JSON.parse(raw);
  assert.equal(generation.payload.real_manual_cano.record.reported_state,'RUNNING');assert.equal(generation.payload.real_manual_cano.record.source_time,'2026-10-02T23:06:00.000Z');assert.equal(generation.payload.real_manual_cano.fixture_only,false);assert.equal(generation.decision.effect,'ABSTAIN');
  assert.equal(servingView(generation,receipt,s.trust,null,Date.parse(AT)).decision_eligibility,'ABSTAIN');
  assert.equal((await s.call('export',{},OP)).status,200);
  const checkpoint=JSON.parse(await (await b.get(`checkpoints/${s.trust.authority_instance_id}/${s.trust.recovery_generation}/latest.json`)).text());assert.equal(checkpoint.receipt.semantic_admission.operator_principal_id,'operator');
  await s.mf.unsafeEvictDurableObject('core','DatasetCoordinator',{id:s.trust.native_id});assert.deepEqual((await commit(s,p.body)).body.receipt,receipt);
 }finally{await s.mf.dispose();}
});
test('promote alone, read, wrong locator, shadow/backfill and claimed operator cannot admit actual source',async()=>{
 const {s,c}=await fixture();try{for(const token of ['test-only-live','test-only-read','test-only-wrong','test-only-shadow','test-only-backfill'])assert.notEqual((await s.call('prepare',c,token)).status,200);await noPublication(s);
  const bad=copy(c);bad.semantic_admission.operator_principal_id='live';assert.equal((await s.call('prepare',bad,OP)).body.error,'REAL_CANO_OPERATOR_BINDING_MISMATCH');await noPublication(s);
 }finally{await s.mf.dispose();}
});
test('allowlisted principal without separate manual-source-admit capability is blocked before R2 writes',async()=>{
 const {s,c}=await fixture({manualOperator:false});try{assert.equal((await s.call('prepare',c,OP)).body.error,'REAL_CANO_OPERATOR_DENIED');await noPublication(s);}finally{await s.mf.dispose();}
});
test('native gate recomputes actual raw, pointer, outputs, proof and day bounds before storage',async()=>{
 const {s,c}=await fixture();try{
  const changes=[x=>x.semantic_bundle.raw_utf8+=' ',x=>x.semantic_bundle.source_pointer.commit_sha='f'.repeat(40),x=>x.semantic_bundle.git_blob_sha='f'.repeat(40),x=>x.payload.real_manual_cano.record.reported_state='SUSPENDED',x=>x.inputs[0].max_age_ms+=1,x=>x.inputs[0].source_time=AT,x=>x.semantic_admission.source_author_assurance='AUTHENTICATED_SOURCE_AUTHOR',x=>x.semantic_admission.preparation_hash='f'.repeat(64),x=>x.valid_to='2026-10-03T18:00:00.000Z',x=>x.artifacts.policy='f'.repeat(64),x=>x.semantic_profile_hash='f'.repeat(64),x=>x.semantic_bundle.extra=true,x=>x.semantic_bundle.payload_sha256=[x.semantic_bundle.payload_sha256],x=>x.semantic_bundle.source_pointer.path='data/marine_ops/manual-confirmations/2026-10-03-cano-phu-quoc.json'];
  for(const change of changes){const bad=copy(c);change(bad);const r=await s.call('prepare',bad,OP);assert.notEqual(r.status,200,JSON.stringify(r));}await noPublication(s);
 }finally{await s.mf.dispose();}
});
test('real source fact cannot become positive/restrictive action, correction or generic fixture publication',async()=>{
 const {s,c}=await fixture();try{for(const change of [x=>x.decision.effect='POSITIVE',x=>x.decision.effect='RESTRICTIVE',x=>x.decision.minimum_evidence_met=true,x=>x.payload.real_manual_cano.operational_action_allowed=true,x=>{x.operation='CORRECTION';x.supersedes_revision=0;x.reason='unreviewed amendment';},x=>{delete x.semantic_bundle;delete x.semantic_admission;}]){const bad=copy(c);change(bad);assert.notEqual((await s.call('prepare',bad,OP)).status,200);}assert.notEqual((await s.call('prepare',s.make(),OP)).status,200);await noPublication(s);}finally{await s.mf.dispose();}
});
test('current operator capability is rechecked on commit and on completed command replay',async()=>{
 const {s,c}=await fixture();try{
  const p=await s.call('prepare',c,OP);assert.equal(p.status,200);
  const actor=s.principals.find(p=>p.id==='operator');actor.permissions=actor.permissions.filter(x=>x!=='manual-source-admit');await s.mf.setOptions(s.options());
  assert.equal((await commit(s,p.body,'revoked')).body.error,'REAL_CANO_OPERATOR_DENIED');assert.equal((await s.call('read',undefined,'test-only-read')).body.state.revision,0);
  actor.permissions.push('manual-source-admit');await s.mf.setOptions(s.options());assert.equal((await commit(s,p.body,'granted')).status,200);
  actor.permissions=actor.permissions.filter(x=>x!=='manual-source-admit');await s.mf.setOptions(s.options());assert.equal((await commit(s,p.body,'granted')).body.error,'REAL_CANO_OPERATOR_DENIED');assert.equal((await s.call('read',undefined,'test-only-read')).body.state.revision,1);
 }finally{await s.mf.dispose();}
});
test('another currently allowlisted operator cannot commit or replay someone else bound generation',async()=>{
 const {s,c}=await fixture({editProfile:p=>p.operator_principal_ids.push('live')});try{
  s.principals.find(x=>x.id==='live').permissions.push('manual-source-admit');await s.mf.setOptions(s.options());const p=await s.call('prepare',c,OP);assert.equal(p.status,200);
  assert.equal((await commit(s,p.body,'other','test-only-live')).body.error,'REAL_CANO_OPERATOR_BINDING_MISMATCH');assert.equal((await commit(s,p.body,'same')).status,200);assert.equal((await commit(s,p.body,'same','test-only-live')).body.error,'REAL_CANO_OPERATOR_BINDING_MISMATCH');
 }finally{await s.mf.dispose();}
});
test('actual source remains expired at local midnight, cannot be renewed by evaluation/collector time',async()=>{
 const {s,c,profile,trust,actor}=await fixture();try{
  const env={ENVIRONMENT_ID:'local-test',...await packAdmissionProfile(profile)};
  assert.equal((await validateSemanticAdmission(env,trust,c,AT,actor)).action_allowed,false);
  for(const at of ['2026-10-02T23:05:59.999Z','2026-10-03T17:00:00.000Z','2026-10-04T00:30:00.000Z'])await assert.rejects(validateSemanticAdmission(env,trust,c,at,actor),/SOURCE_OUTSIDE_VALIDITY/);
  const view=servingView(c,{...trust,semantic_admission:c.semantic_admission,operation:'NORMAL'},trust,null,Date.parse(c.valid_to));assert.equal(view.freshness,'EXPIRED');assert.equal(view.decision_eligibility,'EXPIRED');
 }finally{await s.mf.dispose();}
});
test('trusted profile rejects same-day variants, wrong environment, unpinned bindings and source-kind laundering',async()=>{
 const {profile,trust}=await fixture({native:false});
 const duplicate=copy(profile);duplicate.source_records.push({...copy(profile.source_records[0]),payload_sha256:'f'.repeat(64)});duplicate.artifact_refs=await realCanoArtifactRefs(duplicate);await assert.rejects(validateRealCanoProfile(duplicate,{...trust,semantic_profile_hash:await hash(duplicate)}),/AMENDMENT_REVIEW_REQUIRED/);
 for(const change of [x=>x.environment_id='production',x=>x.dataset_id='ferry.operation',x=>x.fixture_only=true,x=>x.source_kind='SYNTHETIC_ONLY',x=>x.operator_principal_ids=[],x=>x.source_records[0].payload_sha256=[x.source_records[0].payload_sha256],x=>x.source_records[0].source_pointer.commit_sha=['f'.repeat(40)]]){const bad=copy(profile);change(bad);await assert.rejects(validateRealCanoProfile(bad,trust));}
 const bad=copy(profile);bad.operator_principal_ids=['live'];bad.artifact_refs=await realCanoArtifactRefs(bad);await assert.rejects(validateRealCanoProfile(bad,{...trust,artifacts:Object.fromEntries(Object.entries(bad.artifact_refs).map(([k,v])=>[k,v.hash]))}),/PROFILE_PIN_MISMATCH/);
});
test('even independently pinned raw with missing author or non-An-Thoi fields remains inadmissible',async()=>{
 const {profile,trust,bundle}=await fixture({native:false});
 for(const change of [x=>delete x.confirmed_by,x=>x.evidence.area='Phú Quốc',x=>x.state='UNKNOWN',x=>x.recorded_at_vn='2026-10-03T08:00:00+07:00']){
  const raw=JSON.parse(bundle.raw_utf8);change(raw);const b={...copy(bundle),raw_utf8:JSON.stringify(raw)};b.payload_sha256=await hash(b.raw_utf8);b.git_blob_sha=await gitBlobSha(new TextEncoder().encode(b.raw_utf8));
  const p=copy(profile);p.source_records=[{source_pointer:b.source_pointer,payload_sha256:b.payload_sha256,git_blob_sha:b.git_blob_sha}];p.artifact_refs=await realCanoArtifactRefs(p);const t={...trust,semantic_profile_hash:await hash(p),artifacts:Object.fromEntries(Object.entries(p.artifact_refs).map(([k,v])=>[k,v.hash]))};
  await assert.rejects(buildRealCanoCandidate(p,t,{bundle:b,operator_principal_id:'operator',evaluation_time:AT,candidate_id:'synthetic-negative-mutation'}));
 }
});
test('native Runtime rejects recorded fact display at exact midnight; Core cannot commit expired source',async()=>{
 const {s,c}=await fixture();try{
  const p=await s.call('prepare',c,OP);assert.equal(p.status,200);assert.equal((await commit(s,p.body,'midnight-published')).status,200);assert.equal((await s.call('export',{},OP)).status,200);
  const opts=s.options();opts.workers.find(w=>w.name==='runtime').scriptPath=fileURLToPath(new URL('./real-cano-expired-runtime.js',import.meta.url));await s.mf.setOptions(opts);
  const runtime=await s.mf.getWorker('runtime'),response=await runtime.fetch('https://runtime/datasets/cano.operation.an-thoi');assert.equal(response.status,503);assert.equal((await response.json()).error,'DISPLAY_EXPIRED');
 }finally{await s.mf.dispose();}
 const f=await fixture();try{
  const p=await f.s.call('prepare',f.c,OP);assert.equal(p.status,200);
  const opts=f.s.options();opts.workers.find(w=>w.name==='core').scriptPath=fileURLToPath(new URL('./real-cano-expired-core.js',import.meta.url));await f.s.mf.setOptions(opts);
  const r=await f.s.call('commit',{...f.s.trust,command_id:'midnight-denied',digest:p.body.digest,expires_at:'2026-10-03T18:00:00.000Z'},OP);assert.equal(r.body.error,'REAL_CANO_SOURCE_OUTSIDE_VALIDITY');assert.equal((await f.s.call('read',undefined,'test-only-read')).body.state.revision,0);
 }finally{await f.s.mf.dispose();}
});
