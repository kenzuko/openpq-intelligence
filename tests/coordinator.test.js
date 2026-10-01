import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,iso} from './support.js';

test('SQLite DO publication and Runtime adversarial integration', {timeout:120000}, async t=>{
  const s=await setup();t.after(()=>s.mf.dispose());
  const prepare=async c=>{const r=await s.call('prepare',c);assert.equal(r.status,200,JSON.stringify(r));return r.body;};
  const state=async()=> (await s.call('read',undefined,'test-only-read')).body.state;
  const control=async(body)=>s.call('control',{command_id:crypto.randomUUID(),expected_control_revision:(await state()).control_revision,expires_at:iso(Date.now()+60000),reason:'adversarial fixture',...body},'test-only-operator');
  await t.test('shadow, backfill, reader and alternate locator cannot promote',async()=>{
    for(const token of ['test-only-shadow','test-only-backfill','test-only-read','test-only-wrong']) {
      const r=await s.call('prepare',s.make(),token);assert.equal(r.status,403);
    }
    assert.equal((await state()).revision,0);
  });
  await t.test('unregistered native DO instance cannot bootstrap',async()=>{
    const ns=await s.mf.getDurableObjectNamespace('DATASETS','core');
    const r=await ns.get(ns.idFromName('wrong-instance')).fetch('https://core/bootstrap',{method:'POST',headers:{authorization:'Bearer test-only-operator'},body:JSON.stringify({...s.trust,owner:'pilot',epoch:1})});
    assert.equal(r.status,409);assert.equal((await r.json()).error,'AUTHORITY_INSTANCE_UNREGISTERED');
  });
  await t.test('two writers race at one revision: exactly one wins',async()=>{
    const a=await prepare(s.make()),b=await prepare(s.make());
    const results=await Promise.all([s.commit(a,'race-a'),s.commit(b,'race-b')]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const winner=results.find(r=>r.status===200);s.winner=winner.body.receipt;
    assert.equal((await state()).revision,1);
    const retry=await s.commit({digest:s.winner.digest},s.winner.command_id);assert.deepEqual(retry.body.receipt,s.winner);
    const clash=await s.commit({digest:s.winner.digest===a.digest?b.digest:a.digest},s.winner.command_id);assert.equal(clash.body.error,'COMMAND_DIGEST_CONFLICT');
  });
  await t.test('Runtime independently reads the committed immutable blob',async()=>{
    const r=await s.runtime.fetch('https://runtime/datasets/cano.operation');assert.equal(r.status,200);const b=await r.json();
    assert.equal(b.receipt.revision,1);assert.equal(b.serving.decision_eligibility,'ELIGIBLE');assert.equal(b.serving.authority,'VERIFIED');
    assert.equal((await s.runtime.fetch('https://runtime/datasets/cano.operation',{method:'POST'})).status,405);
  });
  await t.test('control mutation invalidates in-flight prepared publication and validation',async()=>{
    const p=await prepare(s.make({expected_revision:1}));assert.equal((await control({action:'FREEZE',frozen:true})).status,200);
    assert.equal((await s.commit(p)).body.error,'RECOMPUTE_REQUIRED');
    const r=await s.runtime.fetch('https://runtime/datasets/cano.operation');assert.equal((await r.json()).serving.decision_eligibility,'UNVERIFIED');
    assert.equal((await control({action:'FREEZE',frozen:false})).status,200);
  });
  await t.test('owner transfer fences old writers even with unchanged data revision',async()=>{
    const p=await prepare(s.make({expected_revision:1,expected_control_revision:2}));
    assert.equal((await control({action:'TRANSFER',owner:'new-pilot'})).status,200);
    assert.equal((await s.commit(p)).body.error,'OWNER_EPOCH_DENIED');
    assert.equal((await s.call('prepare',s.make({expected_revision:1,expected_control_revision:3}))).body.error,'OWNER_EPOCH_DENIED');
    const q=await s.call('prepare',s.make({expected_revision:1,expected_control_revision:3}),'test-only-next');assert.equal(q.status,200);
    assert.equal((await s.commit(q.body,'new-owner','test-only-next')).status,200);
  });
  await t.test('expired commands and stale positive sources do not advance authority',async()=>{
    const stale=s.make({expected_revision:2,expected_control_revision:3,inputs:[{source_id:'expired-manual',source_type:'MANUAL',source_time:iso(Date.now()-60000),valid_to:iso(Date.now()+60000),max_age_ms:1000}]});
    const p=await s.call('prepare',stale,'test-only-next');assert.equal(p.status,200);
    assert.equal((await s.commit(p.body,'stale','test-only-next')).body.error,'POSITIVE_SOURCE_STALE');
    const expired=await s.call('commit',{...s.trust,command_id:'expired',digest:p.body.digest,expires_at:iso(Date.now()-1)},'test-only-next');assert.equal(expired.body.error,'COMMAND_EXPIRED');
    assert.equal((await state()).revision,2);
  });
  await t.test('signed outbox export is retryable and cold Runtime fails closed for GO',async()=>{
    assert.equal((await s.call('export',{},'test-only-read')).status,403);
    const exported=await s.call('export',{},'test-only-operator');assert.equal(exported.status,200,JSON.stringify(exported));assert.deepEqual(exported.body.exported,[1,2]);
    assert.deepEqual((await s.call('export',{},'test-only-operator')).body.exported,[]);
    // Remove all Core credentials. Cold Runtime can use the signed projection only.
    s.principals.length=0;await s.mf.setOptions(s.options());
    const runtime=await s.mf.getWorker('runtime');const r=await runtime.fetch('https://runtime/datasets/cano.operation');assert.equal(r.status,200,await r.clone().text());
    const b=await r.json();assert.equal(b.receipt.revision,2);assert.equal(b.serving.fallback,true);assert.equal(b.serving.decision_eligibility,'UNVERIFIED');
    assert.equal(b.serving.authority,'UNVERIFIED');
    const bucket=await s.mf.getR2Bucket('CANONICAL','core');await bucket.put(b.receipt.key,'tampered');
    const corrupt=await runtime.fetch('https://runtime/datasets/cano.operation');assert.equal(corrupt.status,503);assert.equal((await corrupt.json()).error,'GENERATION_HASH_INVALID');
  });
});
