import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,iso} from './support.js';

test('production configuration is denied before accessing bindings',async t=>{
  const s=await setup();t.after(()=>s.mf.dispose());const options=s.options();
  options.workers[0].bindings.ENVIRONMENT_ID='production';options.workers[2].bindings.ENVIRONMENT_ID='production';await s.mf.setOptions(options);
  for(const name of ['core','runtime']){
    const worker=await s.mf.getWorker(name);const r=await worker.fetch('https://service/health');assert.equal(r.status,503);assert.equal((await r.json()).error,'PRODUCTION_GATE_CLOSED');
  }
});
test('publication validity, correction lineage, SQLite eviction and export failure', {timeout:120000},async t=>{
  const s=await setup();t.after(()=>s.mf.dispose());
  const state=async()=> (await s.call('read',undefined,'test-only-read')).body.state;
  const prepare=async c=>{const r=await s.call('prepare',c);assert.equal(r.status,200,JSON.stringify(r));return r.body;};
  await t.test('partial or conflicting evidence cannot authorize a positive decision',async()=>{
    for(const quality of [{completeness:'PARTIAL',resolution:'RESOLVED'},{completeness:'COMPLETE',resolution:'CONFLICTING'}]) {
      const p=await prepare(s.make({quality}));assert.equal((await s.commit(p)).body.error,'POSITIVE_EVIDENCE_INSUFFICIENT');
    }
    assert.equal((await state()).revision,0);
  });
  await t.test('unsupported artifact and expired generation cannot advance active reference',async()=>{
    const p=await prepare(s.make({artifacts:{...s.trust.artifacts,policy:'b'.repeat(64)}}));assert.equal((await s.commit(p)).body.error,'ACTIVATION_MISMATCH');
    assert.equal((await s.call('prepare',s.make({valid_to:iso(Date.now()-1)}))).body.error,'CANDIDATE_EXPIRED');
  });
  await t.test('missing positive policy activation denies an otherwise valid candidate',async()=>{
    const original=s.trust.approved_positive_decision_types;delete s.trust.approved_positive_decision_types;await s.mf.setOptions(s.options());
    const p=await prepare(s.make());assert.equal((await s.commit(p)).body.error,'POSITIVE_POLICY_NOT_ACTIVATED');assert.equal((await state()).revision,0);
    s.trust.approved_positive_decision_types=original;await s.mf.setOptions(s.options());
  });
  await t.test('normal obsolete slot rejected; explicit correction requires permission and lineage',async()=>{
    assert.equal((await s.commit(await prepare(s.make()))).status,200);
    const p=await prepare(s.make({expected_revision:1,logical_slot:9}));assert.equal((await s.commit(p)).body.error,'OBSOLETE_SLOT');
    const q=await prepare(s.make({expected_revision:1,logical_slot:9,operation:'CORRECTION',supersedes_revision:1,reason:'fixture correction'}));
    assert.equal((await s.commit(q)).body.error,'CORRECTION_DENIED');assert.equal((await s.commit(q,'correction','test-only-operator')).status,200);
    const current=await state();assert.equal(current.active.previous_revision,1);assert.equal(current.active.operation,'CORRECTION');
  });
  await t.test('active reference and command deduplication survive DO eviction',async()=>{
    const before=await state();await s.mf.unsafeEvictDurableObject('core','DatasetCoordinator',{id:s.trust.native_id});
    const after=await state();assert.deepEqual(after,before);
    const retry=await s.commit({digest:after.active.digest},after.active.command_id,'test-only-operator');assert.equal(retry.body.receipt.revision,2);assert.equal((await state()).revision,2);
  });
  await t.test('failed signing/export does not roll back committed publication',async()=>{
    const opts=s.options();opts.workers[0].bindings.RECEIPT_SIGNING_JSON='{}';await s.mf.setOptions(opts);
    assert.equal((await s.call('export',{},'test-only-operator')).body.error,'SIGNER_UNAVAILABLE');assert.equal((await state()).revision,2);
    await s.mf.setOptions(s.options());assert.deepEqual((await s.call('export',{},'test-only-operator')).body.exported,[1,2]);
  });
  await t.test('frozen publication can retract but cannot issue a new positive decision',async()=>{
    const ctrl=await s.call('control',{command_id:'freeze',expected_control_revision:0,expires_at:iso(Date.now()+60000),action:'FREEZE',frozen:true,reason:'fixture incident'},'test-only-operator');assert.equal(ctrl.status,200);
    const p=await prepare(s.make({expected_revision:2,expected_control_revision:1}));assert.equal((await s.commit(p)).body.error,'PUBLICATION_FROZEN');
    const q=await prepare(s.make({expected_revision:2,expected_control_revision:1,operation:'RETRACTION',supersedes_revision:2,reason:'fixture retraction',decision:{type:'cano.operation.fixture',kind:'FACT',effect:'ABSTAIN',action_until:iso(Date.now()+60000),minimum_evidence_met:false,reason_codes:['RETRACTED']}}));
    assert.equal((await s.commit(q,'retraction','test-only-operator')).status,200);
    const runtime=await s.mf.getWorker('runtime');const r=await runtime.fetch('https://runtime/datasets/cano.operation');assert.equal((await r.json()).serving.decision_eligibility,'REVOKED');
  });
});
