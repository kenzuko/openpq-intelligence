import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../src/platform/contracts.js';
import {assertion,canonical,evidence,fixtureReplay,registry,SEMANTIC_VERSION,sourceRegistry} from '../src/contracts/semantic.js';
import {semanticFixture} from '../src/fixtures/semantic.js';
const H='a'.repeat(64),R={artifact_id:'synthetic',version:'1',hash:H};
const source=()=>({source_id:'fixture',source_namespace:'fixture',provider:'synthetic',domain:'synthetic',source_type:'MANUAL',timezone:'Asia/Ho_Chi_Minh',upstream_origin:'one-origin',unit_semantics:'boolean',payload_mode:'DELTA',full_snapshot_completeness:false,mapping_ref:R,policy_refs:{license:R,retention:R,freshness:R},credential_reference:null,budget:{requests:1,concurrency:1,retries:0,payload_bytes:1024,timeout_ms:1000}});
test('semantic evidence preserves unknown source time and explicit raw retention disposition',()=>{
  const e=semanticFixture().evidences[0];evidence(e);
  assert.throws(()=>evidence({...e,payload_ref:'raw/fixture'}),/RAW_STORAGE_DISPOSITION_REQUIRED/);
  assert.throws(()=>evidence({...e,source_time_basis:'UNKNOWN'}),/UNKNOWN_TIME_MUST_BE_NULL/);
  evidence({...e,source_time:null,source_time_basis:'UNKNOWN',source_time_missing_reason:'SOURCE_OMITTED'});
  assert.throws(()=>evidence({...e,source_time:'2026-10-01 00:00:00'}),/UTC_REQUIRED/);
});
test('missing assertion values cannot silently become zero or null',()=>{
  const a=semanticFixture().assertions[0];assertion(a);
  assert.throws(()=>assertion({...a,missing_reason:'NO_SOURCE'}),/VALUE_OR_MISSING_REQUIRED/);
  assert.throws(()=>assertion({...a,value:null}),/NULL_IS_NOT_A_VALUE/);
  const {value,...missing}=a;assertion({...missing,missing_reason:'NO_SOURCE'});
  assertion({...a,value:0});assert.throws(()=>assertion({...a,valid_to:a.valid_from}),/VALIDITY_EMPTY/);
  assert.throws(()=>assertion({...a,author_ref:''}),/MANUAL_AUTHOR/);
});
test('source registry cannot invent full snapshot completeness for deltas or carry token values',()=>{
  sourceRegistry(source());assert.throws(()=>sourceRegistry({...source(),full_snapshot_completeness:true}),/DELTA_COMPLETENESS_FORBIDDEN/);
  assert.throws(()=>sourceRegistry({...source(),token:'synthetic-secret'}),/SOURCE_SECRET_OR_TRANSPORT_FORBIDDEN/);
  assert.throws(()=>sourceRegistry({...source(),budget:{}}),/BUDGET_requests_REQUIRED/);
});
test('registry lookup requires exact immutable version, content hash, kind and fixture environment',async()=>{
  const data={artifact_id:'source.fixture',version:'1',kind:'SOURCE',contract_version:SEMANTIC_VERSION,environment_id:'fixture-only',payload:source()};
  const item={...data,hash:await hash(data)};const reader=await registry([item]);
  const actual=reader.lookup(item,'SOURCE');assert.ok(Object.isFrozen(actual.payload.budget));
  item.payload.provider='changed';assert.equal(reader.lookup({...item,hash:actual.hash},'SOURCE').payload.provider,'synthetic');
  assert.throws(()=>reader.lookup({...item,version:'2'},'SOURCE'),/REGISTRY_REF_UNAVAILABLE/);
  assert.throws(()=>reader.lookup({...item,hash:H},'SOURCE'),/REGISTRY_REF_UNAVAILABLE/);
  assert.throws(()=>reader.lookup(item,'POLICY'),/REGISTRY_KIND_MISMATCH/);
  await assert.rejects(registry([item]),/ARTIFACT_CONTENT_MISMATCH/);
  await assert.rejects(registry([actual,actual]),/REGISTRY_VERSION_CONFLICT/);
  await assert.rejects(registry([{...actual,environment_id:'production'}]),/SEMANTIC_LIVE_ACTIVATION_FORBIDDEN/);
});
test('canonical preparation does not fabricate a committed revision and requires all artifact refs',()=>{
  const f=semanticFixture(),a=f.assertions[0];const c={contract_version:SEMANTIC_VERSION,dataset_id:'fixture',generation_id:'g1',retention_class:'SYNTHETIC',access_scope:'fixture-only',scope:f.target_scope,valid_from:a.valid_from,valid_to:a.valid_to,evaluation_time:f.evaluation_time,quality:a.quality,evidence_refs:['e1'],assertion_refs:['a1'],artifact_refs:Object.fromEntries(['source','mapping','adapter','resolver','rule','config','policy','schema'].map(k=>[k,R])),dependencies:[],replay_capability:'FULL_INPUTS_AVAILABLE',payload:{fixture:true}};
  canonical(c);assert.throws(()=>canonical({...c,publication_revision:1}),/PREPARED_IS_NOT_COMMITTED/);
  assert.throws(()=>canonical({...c,evidence_refs:['e1','e1']}),/EVIDENCE_REFS_REQUIRED/);
  assert.throws(()=>canonical({...c,artifact_refs:{}}),/OBJECT_REQUIRED/);
});
test('manual fixture expires at the operational-day boundary and cannot carry to tomorrow',async()=>{
  const f=semanticFixture();const result=await fixtureReplay(f);assert.equal(result.effect,'POSITIVE');assert.equal(result.action_until,'2026-10-01T17:00:00.000Z');
  f.evaluation_time='2026-10-01T17:00:00Z';assert.equal((await fixtureReplay(f)).effect,'ABSTAIN');
});
test('unknown, future, ambiguous, stale, wrong-scope and missing evidence all abstain',async()=>{
  for(const mutate of [f=>{f.evidences[0].source_time=null;f.evidences[0].source_time_basis='UNKNOWN';f.evidences[0].source_time_missing_reason='UNKNOWN';f.assertions[0].source_time=null;},f=>{f.evidences[0].source_time='2026-10-01T13:00:00Z';f.assertions[0].source_time=f.evidences[0].source_time;},f=>f.assertions[0].mapping_state='AMBIGUOUS',f=>f.policy.max_age_ms=1,f=>f.assertions[0].scope.subject_id='other',f=>{delete f.assertions[0].value;f.assertions[0].missing_reason='MISSING';},f=>f.evidences[0].source_validity={valid_from:'2026-10-01T00:00:00Z',valid_to:'2026-10-01T01:00:00Z'}]){
    const f=semanticFixture();mutate(f);assert.equal((await fixtureReplay(f)).effect,'ABSTAIN');
  }
});
test('scoped official closure precedes positive manual confirmation without changing source attribution',async()=>{
  const f=semanticFixture(),e={...f.evidences[0],evidence_id:'e2',source_type:'OFFICIAL_REPORT'},a={...f.assertions[0],assertion_id:'a2',evidence_ref:'e2',source_type:'OFFICIAL_REPORT',predicate:'synthetic.operational.closed',value:true};f.evidences.push(e);f.assertions.push(a);
  const before=JSON.stringify(f),result=await fixtureReplay(f);assert.equal(result.effect,'RESTRICTIVE');assert.deepEqual(result.assertion_refs,['a2']);assert.equal(JSON.stringify(f),before);
  f.assertions[1].scope={...f.target_scope,subject_id:'other'};assert.equal((await fixtureReplay(f)).effect,'POSITIVE');
});
test('replay is deterministic, distinguishes emitted history and binds prior history',async()=>{
  const f=semanticFixture(),a=await fixtureReplay(f);assert.deepEqual(await fixtureReplay(f),a);
  const emitted=await fixtureReplay({...f,record_kind:'EMITTED'});assert.notEqual(a.decision_id,emitted.decision_id);
  const history=await fixtureReplay({...f,prior_history_hash:'b'.repeat(64)});assert.notEqual(a.input_hash,history.input_hash);
  assert.equal(emitted.record_kind,'EMITTED');assert.equal(a.record_kind,'REPLAY');
});
test('replay rejects missing evidence linkage, duplicate IDs and real activation',async()=>{
  const f=semanticFixture();await assert.rejects(fixtureReplay({...f,evidences:[]}),/ASSERTION_EVIDENCE_MISMATCH/);
  await assert.rejects(fixtureReplay({...f,evidences:[...f.evidences,...f.evidences]}),/DUPLICATE_EVIDENCE_ID/);
  await assert.rejects(fixtureReplay({...f,assertions:[...f.assertions,...f.assertions]}),/DUPLICATE_ASSERTION_ID/);
  await assert.rejects(fixtureReplay({...f,policy:{...f.policy,environment_id:'production'}}),/FIXTURE_POLICY_REQUIRED/);
});
