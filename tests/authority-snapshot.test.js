import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.js';
import {sealAuthoritySnapshot,verifyAuthoritySnapshot} from '../src/platform/authority-snapshot.js';

test('empty bootstrapped authority snapshot is verifiable and an oversized row set fails closed',async()=>{
 const s=await setup();try{
  await enable(s);const checked=await verifyAuthoritySnapshot(await snapshot(s),s.trust);
  assert.equal(checked.manifest.watermark.revision,0);assert.equal(checked.manifest.control.active,null);
  const tables=structuredClone(checked.tables);tables.commands=Array.from({length:4097},(_,i)=>({id:String(i).padStart(8,'0'),digest:'0'.repeat(64),result:'{}'}));
  await assert.rejects(sealAuthoritySnapshot({authority:s.trust,control:checked.manifest.control,tables,captured_at:checked.manifest.captured_at},{key_id:'local-key',private_jwk:s.privateKey}),/SNAPSHOT_TOO_LARGE/);
 }finally{await s.mf.dispose();}
});

async function enable(s){s.principals.find(x=>x.id==='operator').permissions.push('recovery-export');await s.mf.setOptions(s.options());}
async function publish(s,revision,id){const c=s.make({expected_revision:revision,logical_slot:10+revision});const p=await s.call('prepare',c);assert.equal(p.status,200);const committed=await s.commit(p.body,id);assert.equal(committed.status,200);return {c,p:p.body,committed:committed.body.receipt};}
async function snapshot(s){const r=await s.call('recovery-export',{},'test-only-operator');assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}

test('native atomic snapshot authenticates control, audit, commands and mixed pending/exported outbox without changing authority',async()=>{
 const s=await setup();try{
  await enable(s);await publish(s,0,'first');assert.equal((await s.call('export',{},'test-only-operator')).status,200);
  const second=await publish(s,1,'second');assert.equal((await s.commit(second.p,'second')).body.receipt.revision,2);
  assert.equal((await s.call('prepare',s.make({expected_revision:2,logical_slot:99}))).status,200);
  assert.equal((await s.call('control',{command_id:'freeze',action:'FREEZE',frozen:true,reason:'native recovery test',expected_control_revision:0,expires_at:new Date(Date.now()+60000).toISOString()},'test-only-operator')).status,200);
  const before=(await s.call('read',undefined,'test-only-read')).body.state;
  const raw=await snapshot(s),checked=await verifyAuthoritySnapshot(raw,s.trust);
  assert.deepEqual(checked.manifest.control,before);assert.deepEqual(checked.manifest.watermark,{revision:2,control_revision:1,epoch:1});
  assert.equal(checked.tables.prepared.length,3);assert.equal(checked.tables.commands.length,3);assert.equal(checked.tables.audit.length,3);
  assert.deepEqual(checked.tables.outbox.map(x=>x.exported),[1,0]);assert.equal(checked.verification.control_authenticity_verified,true);assert.equal(checked.verification.audit_authenticity_verified,true);assert.equal(checked.verification.full_system_restore_proven,false);assert.equal(checked.verification.resume_writer,false);
  assert.deepEqual((await s.call('read',undefined,'test-only-read')).body.state,before);
  assert.doesNotMatch(JSON.stringify(raw),/private_jwk|PRINCIPALS_JSON|test-only-(?:operator|live)/);
 }finally{await s.mf.dispose();}
});
test('ordinary publication exporter and source writer cannot obtain an authority snapshot',async()=>{
 const s=await setup();try{
  await publish(s,0,'only');assert.equal((await s.call('recovery-export',{},'test-only-live')).status,403);assert.equal((await s.call('recovery-export',{},'test-only-read')).status,403);assert.equal((await s.call('recovery-export',{},'test-only-operator')).status,403);
  assert.equal((await s.call('export',{},'test-only-operator')).status,200);
  await enable(s);s.principals.find(x=>x.id==='operator').mode='SHADOW';await s.mf.setOptions(s.options());assert.equal((await s.call('recovery-export',{},'test-only-operator')).status,403);
 }finally{await s.mf.dispose();}
});
test('snapshot rejects wrong trust, missing/reordered pages, payload mutation and control tampering',async()=>{
 const s=await setup();try{
  await enable(s);await publish(s,0,'first');const raw=await snapshot(s);assert.equal((await verifyAuthoritySnapshot(raw,s.trust)).verification.status,'SIGNED_NATIVE_AUTHORITY_TABLES_PASS');
  await assert.rejects(verifyAuthoritySnapshot(raw,{...s.trust,native_id:'a'.repeat(64)}));
  const missing=structuredClone(raw);missing.pages.pop();await assert.rejects(verifyAuthoritySnapshot(missing,s.trust),/PAGE_COUNT/);
  const order=structuredClone(raw);order.pages.reverse();await assert.rejects(verifyAuthoritySnapshot(order,s.trust),/PAGE_HASH/);
  const payload=structuredClone(raw);payload.pages[0].codec.sha256='0'.repeat(64);await assert.rejects(verifyAuthoritySnapshot(payload,s.trust),/PAGE_HASH/);
  const control=structuredClone(raw);control.envelope.receipt.control.frozen=true;await assert.rejects(verifyAuthoritySnapshot(control,s.trust),/SIGNATURE/);
 }finally{await s.mf.dispose();}
});
test('signed but inconsistent snapshot cannot hide corrupt generation or missing commit audit',async()=>{
 const s=await setup();try{
  await enable(s);await publish(s,0,'first');const checked=await verifyAuthoritySnapshot(await snapshot(s),s.trust),signer={key_id:'local-key',private_jwk:s.privateKey};
  const input={authority:s.trust,control:checked.manifest.control,tables:structuredClone(checked.tables),captured_at:checked.manifest.captured_at};
  const p=JSON.parse(input.tables.prepared[0].body);p.payload.corrupt_test_only=true;input.tables.prepared[0].body=JSON.stringify(p);
  await assert.rejects(verifyAuthoritySnapshot(await sealAuthoritySnapshot(input,signer),s.trust),/GENERATION_HASH/);
  input.tables=structuredClone(checked.tables);input.tables.audit=[];await assert.rejects(verifyAuthoritySnapshot(await sealAuthoritySnapshot(input,signer),s.trust),/COMMIT_AUDIT/);
 }finally{await s.mf.dispose();}
});
test('commit during snapshot compression leaves a coherent captured watermark and does not roll back current state',async()=>{
 const s=await setup();try{
  await enable(s);await publish(s,0,'first');const prepared=await s.call('prepare',s.make({expected_revision:1,logical_slot:11}));assert.equal(prepared.status,200);
  const [raw,committed]=await Promise.all([snapshot(s),s.commit(prepared.body,'second')]);assert.equal(committed.status,200);
  const checked=await verifyAuthoritySnapshot(raw,s.trust);assert.ok([1,2].includes(checked.manifest.watermark.revision));assert.equal(checked.tables.outbox.length,checked.manifest.watermark.revision);assert.equal((await s.call('read',undefined,'test-only-read')).body.state.revision,2);
 }finally{await s.mf.dispose();}
});
