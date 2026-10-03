import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {hash} from '../src/platform/contracts.js';
import {auditRealCanoShadow,gitBlobSha,sha256Bytes} from '../src/ingress/cano-real-shadow.js';
import {loadRealCanoShadow} from '../src/ingress/cano-real-shadow-local.js';

function source({state='RUNNING',confirmed_by='kenzuko',recorded_at_vn='2030-01-15T06:15:00+07:00',category='cano',date='15/01/2030'}={}){
 return JSON.stringify({schema_version:'marine-ops-manual-1.0',category,date,state,valid_scope:`Ngày ${date} - cano du lịch An Thới, Phú Quốc`,recorded_at_vn,confirmed_by,evidence:{category:'cano',source:'JOTRIP_FIELD_CONFIRMATION',source_tier:'FIELD',evidence_class:'DIRECT',area:'Phú Quốc / An Thới',evidence_note:'SYNTHETIC TEST ONLY'}});
}
async function setup(rawValues=[source()]){
 const bytes=rawValues.map(raw=>typeof raw==='string'?new TextEncoder().encode(raw):raw);
 const records=await Promise.all(bytes.map(async(raw,index)=>({source_pointer:{repository:'kenzuko/Jotrip-Lab',commit_sha:String(index+1).repeat(40),path:'data/marine_ops/manual-confirmations/2030-01-15-cano-an-thoi.json'},raw_file:'raw/'+index+'.json',payload_sha256:await sha256Bytes(raw),git_blob_sha:await gitBlobSha(raw)})));
 const manifest={contract_version:'openpq-cano-real-shadow-intake-v1',mode:'SHADOW_ONLY',fixture_only:true,source_kind:'SYNTHETIC_TEST',dataset_id:'cano.operation.an-thoi',snapshot_commit_sha:'a'.repeat(40),evaluation_time:'2030-01-15T00:00:00.000Z',records};
 return {manifest,loaded_records:bytes.map((raw,index)=>({index,bytes:raw}))};
}
async function run(s){const digest=await hash(JSON.stringify(s.manifest));return auditRealCanoShadow({...s,manifest_payload_sha256:digest,expected_manifest_sha256:digest});}
const closed=r=>{assert.equal(r.real_data_admission,false);assert.equal(r.production_ready,false);assert.equal(r.action_eligible,false);assert.equal(r.publication_admitted,false);assert.equal(r.operator_authenticated,false);assert.equal(r.batch_projection,'NOT_ADMITTED');};

test('shadow preserves source time/day/hash and never turns metadata into authority',async()=>{
 const s=await setup(),r=await run(s);assert.equal(r.contract_ready_count,1);assert.equal(r.status,'CONTRACT_READY_SHADOW_BATCH');
 assert.equal(r.inputs[0].normalized_record.source_time,'2030-01-14T23:15:00.000Z');assert.equal(r.inputs[0].normalized_record.valid_to,'2030-01-15T17:00:00.000Z');
 assert.equal(r.inputs[0].normalized_record.source.payload_sha256,s.manifest.records[0].payload_sha256);closed(r);
});
test('expiry at local midnight and not-yet-effective time cannot produce action',async()=>{
 const s=await setup();s.manifest.evaluation_time='2030-01-15T17:00:00.000Z';const expired=await run(s);assert.equal(expired.inputs[0].view.freshness,'EXPIRED');closed(expired);
 s.manifest.evaluation_time='2030-01-14T23:14:59.000Z';const future=await run(s);assert.equal(future.status,'BLOCKED_SHADOW_BATCH');assert.equal(future.inputs[0].status,'QUARANTINED_SOURCE_TIME');closed(future);
});
test('missing recorded author quarantines the batch without filling an identity',async()=>{
 const s=await setup([source({confirmed_by:'unreviewed'})]),r=await run(s);assert.equal(r.quarantined_count,1);assert.equal(r.inputs[0].normalized_record.source_author,null);assert.ok(r.days[0].reason_codes.includes('REAL_CANO_SOURCE_METADATA_REVIEW_REQUIRED'));closed(r);
});
test('one missing raw file prevents promotion of the valid subset',async()=>{
 const s=await setup([source(),source()]);s.loaded_records[1]={index:1,load_error:'REAL_CANO_LOCAL_FILE_MISSING'};
 const r=await run(s);assert.equal(r.contract_ready_count,1);assert.equal(r.rejected_count,1);assert.equal(r.status,'BLOCKED_SHADOW_BATCH');assert.ok(r.days[0].reason_codes.includes('REAL_CANO_BATCH_PARTIAL_FAILURE_FENCE'));closed(r);
});
test('state change with newer time stays correction-review-required in either input order',async()=>{
 const s=await setup([source(),source({state:'SUSPENDED',recorded_at_vn:'2030-01-15T06:30:00+07:00'})]),r=await run(s);
 assert.equal(r.status,'BLOCKED_SHADOW_BATCH');assert.equal(r.days[0].raw_variant_sha256s.length,2);assert.equal(r.days[0].selected_record_id,null);assert.ok(r.days[0].reason_codes.includes('REAL_CANO_CORRECTION_REVIEW_REQUIRED'));closed(r);
 const reverse={manifest:{...s.manifest,records:[...s.manifest.records].reverse()},loaded_records:[...s.loaded_records].reverse().map((x,index)=>({...x,index}))};const q=await run(reverse);assert.deepEqual(q.days,r.days);
});
test('one pointer cannot identify two different contents, regardless of arrival order',async()=>{
 const s=await setup([source(),source({state:'SUSPENDED'})]);s.manifest.records[1].source_pointer=structuredClone(s.manifest.records[0].source_pointer);
 const r=await run(s);assert.equal(r.rejected_count,2);assert.equal(r.days.length,0);assert.ok(r.inputs.every(x=>x.reason_codes.includes('REAL_CANO_SOURCE_POINTER_CONFLICT')));closed(r);
});
test('exact occurrence replay is retained as duplicate without inventing correction edges',async()=>{
 const s=await setup();s.manifest.records.push(structuredClone(s.manifest.records[0]));s.loaded_records.push({...s.loaded_records[0],index:1});const r=await run(s);
 assert.equal(r.unique_normalized_occurrences,1);assert.equal(r.duplicate_occurrence_count,1);assert.equal(r.days[0].raw_variant_sha256s.length,1);assert.equal(r.days[0].selected_record_id,null);closed(r);
});
test('byte/hash mismatch and independently wrong Git blob SHA fail closed',async()=>{
 for(const kind of ['payload','git']){const s=await setup();if(kind==='payload')s.loaded_records[0].bytes=new TextEncoder().encode(source()+'\n');else s.manifest.records[0].git_blob_sha='b'.repeat(40);
  const r=await run(s);assert.equal(r.rejected_count,1);assert.ok(r.inputs[0].reason_codes.includes(kind==='payload'?'REAL_CANO_PAYLOAD_HASH_MISMATCH':'REAL_CANO_GIT_BLOB_MISMATCH'));closed(r);}
});
test('invalid UTF-8, oversized bytes and cross-day data are rejected without coercion',async()=>{
 for(const raw of [new Uint8Array([255]),new Uint8Array(8193),source({date:'16/01/2030',recorded_at_vn:'2030-01-16T06:15:00+07:00'})]){
  const r=await run(await setup([raw]));assert.equal(r.rejected_count,1);closed(r);}
});
test('manifest cannot claim activation, cross-source input or synthetic data as real',async()=>{
 const cases=[m=>{m.action_eligible=true;},m=>{m.source_kind='OWNER_REPOSITORY_SNAPSHOT';},m=>{m.records[0].source_pointer.repository='other/repo';},m=>{m.dataset_id='ferry.operation';},m=>{m.records[0].raw_file='../outside';}];
 for(const mutate of cases){const s=await setup();mutate(s.manifest);await assert.rejects(run(s));}
});
test('load omissions/duplicate indexes and mismatched external manifest pin are rejected',async()=>{
 const s=await setup();await assert.rejects(run({...s,loaded_records:[]}));await assert.rejects(run({...s,loaded_records:[{...s.loaded_records[0],index:2}]}));
 await assert.rejects(auditRealCanoShadow({...s,manifest_payload_sha256:'a'.repeat(64),expected_manifest_sha256:'b'.repeat(64)}));
});
test('local loader verifies manifest pin before raw reads and rejects symlinks/directories',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'openpq-real-cano-test-'));
 try{
  const s=await setup();await mkdir(path.join(root,'raw'));await writeFile(path.join(root,'raw/0.json'),s.loaded_records[0].bytes);
  const text=JSON.stringify(s.manifest);await writeFile(path.join(root,'manifest.json'),text);const pin=await hash(text);
  const opts={input_root:root,manifest_file:'manifest.json',expected_manifest_sha256:pin};closed(await loadRealCanoShadow(opts));
  await assert.rejects(loadRealCanoShadow({...opts,expected_manifest_sha256:'0'.repeat(64)}),e=>e.code==='REAL_CANO_MANIFEST_PIN_MISMATCH');
  await rm(path.join(root,'raw/0.json'));await symlink(path.join(root,'manifest.json'),path.join(root,'raw/0.json'));
  const symlinked=await loadRealCanoShadow(opts);assert.equal(symlinked.rejected_count,1);assert.ok(symlinked.inputs[0].reason_codes.includes('REAL_CANO_LOCAL_SYMLINK_DENIED'));
  await rm(path.join(root,'raw/0.json'));await mkdir(path.join(root,'raw/0.json'));const directory=await loadRealCanoShadow(opts);assert.equal(directory.rejected_count,1);closed(directory);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('another vehicle category cannot become a Cano confirmation',async()=>{
 const r=await run(await setup([source({category:'ferry'})]));assert.equal(r.rejected_count,1);assert.ok(r.inputs[0].reason_codes.includes('MANUAL_SOURCE_SCHEMA_DENIED'));closed(r);
});

test('async hashing cannot reinterpret caller-mutated pointer or raw bytes',async()=>{
 const s=await setup(),pin=await hash(JSON.stringify(s.manifest));
 const pending=auditRealCanoShadow({...s,manifest_payload_sha256:pin,expected_manifest_sha256:pin});
 s.manifest.records[0].source_pointer.commit_sha='b'.repeat(40);s.loaded_records[0].bytes.fill(255);
 const r=await pending;assert.equal(r.contract_ready_count,1);assert.equal(r.inputs[0].source_pointer.commit_sha,'1'.repeat(40));closed(r);
});
test('digest and commit arrays cannot pass through regexp string coercion',async()=>{
 for(const mutate of [m=>{m.snapshot_commit_sha=['a'.repeat(40)];},m=>{m.records[0].source_pointer.commit_sha=['1'.repeat(40)];}]){
  const s=await setup();mutate(s.manifest);await assert.rejects(run(s));
 }
});
