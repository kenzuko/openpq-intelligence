import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup,iso} from './support.js';
import {preparationFixture} from '../src/fixtures/preparation.js';
import {buildSemanticCandidate} from '../src/platform/semantic-admission.js';
import {normalizeManualCano} from '../src/ingress/manual-cano.js';
import {sha256Bytes,gitBlobSha} from '../src/ingress/cano-real-shadow.js';

async function profileFixture(){
 const at=iso(Date.now());const f=await preparationFixture({P05:{values:{max_source_age_ms:3600000,clock_skew_ms:0}}},'cano.operation',at);
 const profile={contract_version:'openpq-semantic-admission-local-v1',environment_id:'local-test',dataset_id:'cano.operation',source_kind:'SYNTHETIC_ONLY',artifacts:f.artifacts,policies:f.policy_inputs,artifact_refs:f.artifact_refs,target_scope:f.target_scope};
 return {f,profile};
}
async function emptyAuthority(s){
 assert.equal((await s.call('read',undefined,'test-only-read')).body.state.revision,0);
 const bucket=await s.mf.getR2Bucket('CANONICAL','core');assert.equal((await bucket.list({prefix:'generations/'})).objects.length,0);
}
test('actual real Cano record cannot replace synthetic semantic payload in native Coordinator',async()=>{
 const {f,profile}=await profileFixture(),s=await setup({semanticProfile:profile});
 try{
  const now=Date.now();for(const e of f.evidences){e.source_time=iso(now-100);e.collected_at=iso(now-50);e.received_at=iso(now-10);e.source_validity={valid_from:iso(now-100),valid_to:iso(now+3600000)};}
  for(const a of f.assertions){a.source_time=f.evidences[0].source_time;a.issued_at=a.source_time;a.valid_from=a.source_time;a.valid_to=iso(now+3600000);}
  const c=await buildSemanticCandidate(profile,s.trust,{evidences:f.evidences,assertions:f.assertions,evaluation_time:iso(now),candidate_id:'actual-manual-denied',logical_slot:10});
  const source=JSON.parse(await readFile(new URL('./data/real-cano/SOURCE.json',import.meta.url),'utf8'));assert.equal(source.fixture_only,false);
  const bytes=await readFile(new URL('./data/real-cano/2026-10-03-cano-an-thoi.json',import.meta.url));assert.equal(await sha256Bytes(bytes),source.record.payload_sha256);assert.equal(await gitBlobSha(bytes),source.record.git_blob_sha);
  const real=await normalizeManualCano(bytes.toString('utf8'),{...source.record.source_pointer,payload_sha256:source.record.payload_sha256});
  c.payload={real_manual_cano:real,fixture_only:false};const denied=await s.call('prepare',c);
  assert.notEqual(denied.status,200);assert.equal(denied.body.error,'SEMANTIC_OUTPUT_MISMATCH');await emptyAuthority(s);
 }finally{await s.mf.dispose();}
});
test('asserting real source kind in native trusted profile cannot activate real admission',async()=>{
 const {profile}=await profileFixture();profile.source_kind='OWNER_REPOSITORY_SNAPSHOT';const s=await setup({semanticProfile:profile});
 try{const denied=await s.call('prepare',s.make());assert.notEqual(denied.status,200);assert.equal(denied.body.error,'SEMANTIC_PROFILE_SCOPE_INVALID');await emptyAuthority(s);}finally{await s.mf.dispose();}
});
