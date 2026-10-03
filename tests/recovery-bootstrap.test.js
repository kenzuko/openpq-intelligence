import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {recoveryFixture} from './recovery-support.js';
import {frozenRecoveryState} from '../src/platform/recovery-bootstrap.js';
import {hash} from '../src/platform/contracts.js';
import {verifyAuthoritySnapshot} from '../src/platform/authority-snapshot.js';
import {verifyAttestation} from '../src/platform/receipts.js';

test('fresh native recovery starts frozen, archives history, rejects old tokens and remains closed after real restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'openpq-recovery-'));let s;try{
  s=await recoveryFixture({persistPath:dir});assert.equal(s.local_fencing.http_status,401);
  assert.equal((await s.call('bootstrap',{...s.trust,owner:'bypass',epoch:8},'new-operator')).status,409);
  assert.equal((await s.call('recovery-bootstrap',{},'new-operator')).status,403);
  assert.equal((await s.call('recovery-bootstrap',{},'test-only-live')).status,401);
  const restored=await s.call('recovery-bootstrap',{});assert.equal(restored.status,200,JSON.stringify(restored));
  const state=restored.body.state;assert.equal(state.epoch,8);assert.equal(state.frozen,true);assert.equal(state.active,null);assert.equal(state.revision,0);assert.equal(state.recovery.source_watermark.revision,1);assert.equal(state.recovery.historical_commands_imported,false);assert.equal(restored.body.writer_resumed,false);
  assert.equal((await s.runtime()).status,503);
  assert.equal((await s.call('recovery-bootstrap',{})).status,409);
  const unfreeze=()=>s.call('control',{command_id:'unsafe-unfreeze',action:'FREEZE',frozen:false,reason:'must remain gated',expected_control_revision:0,expires_at:new Date(Date.now()+60000).toISOString()},'new-operator');
  assert.equal((await unfreeze()).body.error,'RECOVERY_RESUME_GATE_CLOSED');
  const observation=(await s.call('read',undefined,'new-read')).body.instance_observation.incarnation_id;
  await s.restart();const reread=await s.call('read',undefined,'new-read');assert.deepEqual(reread.body.state,state);assert.notEqual(reread.body.instance_observation.incarnation_id,observation);assert.equal((await unfreeze()).body.error,'RECOVERY_RESUME_GATE_CLOSED');
  const exportResult=await s.call('recovery-export',{});assert.equal(exportResult.status,200);
  const checked=await verifyAuthoritySnapshot(exportResult.body,s.trust);assert.equal(checked.tables.commands.length,0);assert.equal(checked.tables.outbox.length,0);assert.equal(checked.tables.audit.length,1);
  const prepared=await s.call('prepare',s.make(), 'new-operator');assert.equal(prepared.status,200);
  const normal=await s.call('commit',{...s.trust,command_id:'new-normal',digest:prepared.body.digest,expires_at:new Date(Date.now()+60000).toISOString()},'new-operator');assert.equal(normal.body.error,'PUBLICATION_FROZEN');
 }finally{if(s)await s.dispose();await rm(dir,{recursive:true,force:true});}
});

test('old receipt cannot become a new checkpoint; explicit frozen retraction uses only new generation and signer',async()=>{
 const s=await recoveryFixture();try{
  assert.equal((await s.call('recovery-bootstrap',{})).status,200);
  const bucket=await s.mf.getR2Bucket('CANONICAL','core'),key=`checkpoints/${s.trust.authority_instance_id}/${s.trust.recovery_generation}/latest.json`;
  await bucket.put(key,JSON.stringify(s.oldEnvelope));assert.notEqual((await s.runtime()).status,200);await assert.rejects(verifyAttestation(s.oldEnvelope,s.trust));
  const p=await s.call('prepare',s.make({operation:'RETRACTION',supersedes_revision:0,reason:'recovery remains closed'}),'new-operator');assert.equal(p.status,200);
  const commit=await s.call('commit',{...s.trust,command_id:'new-retraction',digest:p.body.digest,expires_at:new Date(Date.now()+60000).toISOString()},'new-operator');assert.equal(commit.status,200,JSON.stringify(commit));assert.equal(commit.body.receipt.epoch,8);
  assert.equal((await s.call('export',{},'new-operator')).status,409);
  // Remove only the deliberately injected local test corruption; production export must not overwrite it.
  await bucket.delete(key);assert.equal((await s.call('export',{},'new-operator')).status,200);
  const envelope=JSON.parse(await (await bucket.get(key)).text());assert.equal(envelope.key_id,'recovered-key');assert.equal((await verifyAttestation(envelope,s.trust)).recovery_generation,s.trust.recovery_generation);
  const view=await s.runtime();assert.equal(view.status,200,JSON.stringify(view));assert.equal(view.body.decision.effect,'ABSTAIN');assert.equal(view.body.serving.decision_eligibility,'REVOKED');assert.equal((await s.call('read',undefined,'new-read')).body.state.frozen,true);
 }finally{await s.dispose();}
});

test('restore fails before native mutation for tampered archive or invalid migration/key/epoch/positive trust',async()=>{
 const s=await recoveryFixture();try{
  const check=async(target,plan=s.plan)=>frozenRecoveryState(s.snapshot,{...plan,target_authority_hash:await hash(target)},target,s.signer,new Date().toISOString());
  await assert.rejects(check({...s.trust,recovery_generation:s.source.trust.recovery_generation}),/NEW_GENERATION/);
  await assert.rejects(check({...s.trust,native_id:s.source.trust.native_id}),/FRESH_NATIVE/);
  await assert.rejects(check({...s.trust,authority_locator_version:s.source.trust.authority_locator_version}),/LOCATOR_MIGRATION/);
  await assert.rejects(check({...s.trust,receipt_keys:s.source.trust.receipt_keys}),/FRESH_SIGNER/);
  await assert.rejects(check(s.trust,{...s.plan,old_epoch_high_watermark:0}),/HIGH_WATERMARK/);
  await assert.rejects(check({...s.trust,approved_positive_decision_types:['cano.operation.fixture']}),/POSITIVE_POLICIES/);
  await assert.rejects(check(s.trust,{...s.plan,snapshot_digest:'0'.repeat(64)}),/SNAPSHOT_PIN/);
  await (await s.mf.getR2Bucket('CANONICAL','core')).put(s.plan.snapshot_key,JSON.stringify({...s.snapshot,pages:[]}));
  assert.equal((await s.call('recovery-bootstrap',{})).body.error,'RECOVERY_SNAPSHOT_PIN_MISMATCH');assert.equal((await s.call('read',undefined,'new-read')).body.state,null);
 }finally{await s.dispose();}
});

test('concurrent recovery bootstraps install exactly one frozen state and audit record',async()=>{
 const s=await recoveryFixture();try{
  const results=await Promise.all([s.call('recovery-bootstrap',{}),s.call('recovery-bootstrap',{})]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
  const checked=await verifyAuthoritySnapshot((await s.call('recovery-export',{})).body,s.trust);assert.equal(checked.tables.audit.length,1);assert.equal(checked.manifest.control.epoch,8);
 }finally{await s.dispose();}
});
