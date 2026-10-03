import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hash,stable} from '../src/platform/contracts.js';
import {buildCanoShadowFromRaw,validateCanoShadow,computeCanoRevisionIdentity} from '../src/ingress/manual-cano-semantic.js';
import {reduceCanoLedger,validateCanoRevisionWrapper,wrapCanoRevision} from '../src/ingress/manual-cano-lineage.js';

const corpus=JSON.parse(await readFile(new URL('../fixtures/manual-cano-offline/corpus.json',import.meta.url),'utf8'));
const target={dataset_id:'cano.operation.an-thoi',scope:{category:'cano',service_area:'An Thới, Phú Quốc',operational_day:'2030-01-15',timezone:'Asia/Ho_Chi_Minh',mapping_id:'manual-cano-an-thoi-v1'}};

async function dispatch(vector){
  const input=structuredClone(vector.input||{});
  if(vector.entry_point.startsWith('buildCanoShadowFromRaw'))return buildCanoShadowFromRaw(input.raw_utf8,input.provenance);
  if(vector.entry_point==='validateCanoShadow')return validateCanoShadow(input.shadow);
  if(vector.entry_point==='validateCanoRevisionWrapper')return validateCanoRevisionWrapper(input.wrapper);
  if(vector.entry_point==='reduceCanoLedger')return reduceCanoLedger({...input,evaluation_time:input.evaluation_time||vector.evaluation_time||corpus.fixed_default_evaluation_time});
  throw new Error('UNKNOWN_VECTOR_ENTRY_POINT '+vector.entry_point);
}
function expectedCodes(vector){return vector.expected?.reason_codes||[];}
function assertExpected(vector,out){
  const e=vector.expected||{};
  if(e.shadow)assert.deepEqual(out,e.shadow,vector.id+' shadow');
  if(e.ledger_status)assert.equal(out.ledger_status??out.status,e.ledger_status,vector.id+' ledger_status');
  if(e.projection_status)assert.equal(out.projection?.state??out.projection_status,e.projection_status,vector.id+' projection_status');
  if(e.projection_state)assert.equal(out.projection?.state,e.projection_state,vector.id+' projection_state');
  if(e.retained_revision_count!==undefined)assert.equal(out.retained_revision_count,e.retained_revision_count,vector.id+' retained count');
  if(e.terminal_revision_id!==undefined)assert.equal(out.projection?.terminal_revision_id,e.terminal_revision_id,vector.id+' terminal');
  if(e.reported_state!==undefined)assert.equal(out.projection?.reported_state,e.reported_state,vector.id+' state');
  if(e.revision_id)assert.equal(out.revision_id,e.revision_id,vector.id+' revision');
  if(e.normalized_record_digest)assert.equal(out.normalized_record_digest,e.normalized_record_digest,vector.id+' digest');
  if(e.source_author!==undefined)assert.equal(out.normalized_record?.source_author,e.source_author,vector.id+' source_author');
  if(e.publication_admitted!==undefined)assert.equal(out.publication_admitted,e.publication_admitted,vector.id+' publication');
  if(e.action_eligible!==undefined)assert.equal(out.action_eligible,e.action_eligible,vector.id+' action');
  for(const code of expectedCodes(vector))assert.ok((out.reason_codes||out.projection?.reason_codes||[]).includes(code),vector.id+' missing '+code);
  if(e.duplicate_revision_ids)assert.deepEqual(out.duplicate_revision_ids,e.duplicate_revision_ids,vector.id+' duplicates');
}
async function expectVector(vector){
  try{
    const out=await dispatch(vector);
    if(vector.expected?.status==='INVALID'&&vector.entry_point!=='reduceCanoLedger')assert.fail(vector.id+' expected error');
    if(['VALIDATION_ERROR','SCHEMA_REJECT'].includes(vector.expected?.status))assert.fail(vector.id+' expected error');
    assertExpected(vector,out);return {kind:'return',out};
  }catch(error){
    const codes=expectedCodes(vector);
    assert.ok(codes.includes(error.code),`${vector.id} unexpected error ${error.code||error.message}`);
    return {kind:'throw',code:error.code};
  }
}

test('F12 R2 vectors pass behavioral implementation',async()=>{
  assert.equal(corpus.r2_vectors.length,19);
  for(const vector of corpus.r2_vectors)await expectVector(vector);
});

test('supplemental F11 graph/fence vectors retained under R2 where not superseded',async()=>{
  for(const vector of corpus.supplemental_graph_vectors)await expectVector(vector);
});

test('exact raw fixture bytes are preserved and actual M6 normalizer is used',async()=>{
  const bytes=await readFile(new URL('../fixtures/manual-cano-offline/base.raw.json',import.meta.url));
  assert.notEqual(bytes.at(-1),10,'fixture must have no trailing newline');
  const raw=bytes.toString('utf8');
  assert.equal(await hash(raw),'2e14a78dfcc48c7a1df1e3f3815c26e81648b516323025af04ea56eff2aa2313');
  const vector=corpus.r2_vectors.find(v=>v.id==='F12-TV-01');
  assert.equal(raw,vector.input.raw_utf8);
  const shadow=await buildCanoShadowFromRaw(raw,vector.input.provenance);
  assert.equal(shadow.normalized_record.source.payload_sha256,vector.input.provenance.payload_sha256);
  assert.equal(shadow.normalized_record.source_time,'2030-01-14T23:15:00.000Z');
});

test('raw missing author is quarantined by real normalizeManualCano path, never invented',async()=>{
  const base=JSON.parse(await readFile(new URL('../fixtures/manual-cano-offline/base.raw.json',import.meta.url),'utf8'));
  base.confirmed_by='synthetic-missing-author';
  const raw=JSON.stringify(base);
  const provenance={repository:'kenzuko/Jotrip-Lab',commit_sha:'3333333333333333333333333333333333333333',path:'data/marine_ops/manual-confirmations/2030-01-15-cano-an-thoi.json',payload_sha256:await hash(raw)};
  const shadow=await buildCanoShadowFromRaw(raw,provenance);
  assert.equal(shadow.normalized_record.source_author,null);
  assert.equal(shadow.normalized_record.normalization_status,'QUARANTINED');
  assert.deepEqual(shadow.normalized_record.reason_codes,['MANUAL_AUTHOR_NOT_EXPLICIT']);
  const wrapper=await wrapCanoRevision(shadow);
  const ledger=await reduceCanoLedger({wrappers:[wrapper],target,evaluation_time:'2030-01-15T12:00:00.000Z'});
  assert.equal(ledger.projection.state,'QUARANTINED');
  assert.equal(ledger.action_eligible,false);assert.equal(ledger.publication_admitted,false);
});

test('Vietnam midnight calendar rolls correctly across month and year boundaries',async()=>{
  for(const [date,recorded,day,validTo,commit] of [
    ['31/01/2030','2030-01-31T23:59:59+07:00','2030-01-31','2030-01-31T17:00:00.000Z','4'.repeat(40)],
    ['31/12/2030','2030-12-31T23:59:59+07:00','2030-12-31','2030-12-31T17:00:00.000Z','5'.repeat(40)]
  ]){
    const base=JSON.parse(await readFile(new URL('../fixtures/manual-cano-offline/base.raw.json',import.meta.url),'utf8'));
    base.date=date;base.recorded_at_vn=recorded;base.valid_scope=`Ngày ${date} - cano du lịch An Thới, Phú Quốc`;
    const raw=JSON.stringify(base),provenance={repository:'kenzuko/Jotrip-Lab',commit_sha:commit,path:`data/marine_ops/manual-confirmations/${day}-cano-an-thoi.json`,payload_sha256:await hash(raw)};
    const shadow=await buildCanoShadowFromRaw(raw,provenance);
    assert.equal(shadow.normalized_record.scope.operational_day,day);
    assert.equal(shadow.normalized_record.valid_to,validTo);
  }
});

test('target and evaluation preflight reject invalid calendars before wrapper processing',async()=>{
  const invalidTarget=await reduceCanoLedger({wrappers:[{garbage:true}],target:{...target,scope:{...target.scope,operational_day:'2030-02-30'}},evaluation_time:'2030-01-15T12:00:00.000Z'});
  assert.deepEqual(invalidTarget.reason_codes,['TARGET_INVALID']);
  assert.equal(invalidTarget.contract_version,'openpq-cano-preflight-rejection-v1');
  const invalidClock=await reduceCanoLedger({wrappers:[{garbage:true}],target,evaluation_time:'2030-02-30T12:00:00.000Z'});
  assert.deepEqual(invalidClock.reason_codes,['EVALUATION_TIME_INVALID']);
});

test('explicit correction result is permutation deterministic and retains both revisions',async()=>{
  const cases=corpus.supplemental_graph_vectors.filter(v=>v.id.startsWith('F12-SUP-CORRECTION-PERM-'));
  assert.equal(cases.length,2);
  const [a,b]=await Promise.all(cases.map(dispatch));
  assert.equal(stable(a),stable(b));
  assert.equal(a.retained_revision_count,2);
  assert.equal(a.projection.state,'RESOLVED');
  assert.equal(a.projection.reported_state,'SUSPENDED');
});

test('reducers and validators do not mutate caller inputs',async()=>{
  const vector=corpus.r2_vectors.find(v=>v.id==='F12-TV-19');
  const before=stable(vector.input);
  await reduceCanoLedger(vector.input);
  assert.equal(stable(vector.input),before);
  const shadowVector=corpus.r2_vectors.find(v=>v.id==='F12-TV-05');
  const shadowBefore=stable(shadowVector.input.shadow);
  await assert.rejects(validateCanoShadow(shadowVector.input.shadow),/NORMALIZED_RECORD_INCONSISTENT/);
  assert.equal(stable(shadowVector.input.shadow),shadowBefore);
});

test('all offline outputs keep action/publication fences closed',async()=>{
  const valid=corpus.r2_vectors.find(v=>v.id==='F12-TV-01');
  const shadow=await buildCanoShadowFromRaw(valid.input.raw_utf8,valid.input.provenance);
  const wrapper=await wrapCanoRevision(shadow);
  const ledger=await reduceCanoLedger({wrappers:[wrapper],target,evaluation_time:'2030-01-15T12:00:00.000Z'});
  for(const value of [shadow,wrapper,ledger,ledger.projection]){assert.equal(value.action_eligible,false);assert.equal(value.publication_admitted,false);}
  assert.ok(!stable(shadow).includes('wire_eligible'));
});


test('rehashing cannot make fractional-second source time coherent',async()=>{
  const shadow=structuredClone(corpus.r2_vectors[0].expected.shadow);
  shadow.normalized_record.source_time=shadow.normalized_record.valid_from='2030-01-14T23:15:00.001Z';
  const ids=await computeCanoRevisionIdentity(shadow.normalized_record,shadow.source_pointer);
  shadow.normalized_record_digest=ids.normalized_record_digest;shadow.revision_id=ids.revision_id;
  await assert.rejects(validateCanoShadow(shadow),{code:'NORMALIZED_RECORD_INCONSISTENT'});
});

test('mixed validation stages report first errors in input order',async()=>{
  const shadow=corpus.r2_vectors[0].expected.shadow;
  const good=await wrapCanoRevision(shadow),bad=structuredClone(good);bad.wrapper_id='0'.repeat(64);
  const wrongTarget={...target,scope:{...target.scope,service_area:'Alternate'}};
  const ledger=await reduceCanoLedger({wrappers:[good,bad],target:wrongTarget,evaluation_time:'2030-01-15T12:00:00.000Z'});
  assert.deepEqual(ledger.validation_errors.map(e=>e.input_index),[0,1]);
  assert.deepEqual(ledger.validation_errors.map(e=>e.reason_codes[0]),['TARGET_BINDING_MISMATCH','CANO_WRAPPER_ID_MISMATCH']);
  assert.deepEqual(ledger.reason_codes,['TARGET_BINDING_MISMATCH','CANO_WRAPPER_ID_MISMATCH']);
  assert.equal(ledger.ledger_status,'INVALID');assert.equal(ledger.projection.state,'UNRESOLVED');
});
