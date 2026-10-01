import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,iso} from './support.js';
import {attest,exportCheckpoint,verifyAttestation} from '../src/platform/receipts.js';
import {servingView} from '../src/platform/serving.js';

test('actual external-await and lost-response failure injection', {timeout:120000},async t=>{
  const s=await setup({faults:true});t.after(()=>s.mf.dispose());
  const fault=await s.mf.getWorker('fault');
  const arm=async(operation,action)=>{const r=await fault.fetch('https://fault/arm',{method:'POST',body:JSON.stringify({operation,action})});assert.equal(r.status,200);};
  const release=()=>fault.fetch('https://fault/release');
  const waitEntered=async()=>{const deadline=Date.now()+10000;while(Date.now()<deadline){const b=await (await fault.fetch('https://fault/status')).json();if(b.entered)return b.entered;await new Promise(r=>setTimeout(r,10));}throw new Error('R2 gate never entered');};
  const state=async()=> (await s.call('read',undefined,'test-only-read')).body.state;
  const freeze=async()=>s.call('control',{command_id:crypto.randomUUID(),expected_control_revision:(await state()).control_revision,expires_at:iso(Date.now()+60000),action:'FREEZE',frozen:true,reason:'fault fixture'},'test-only-operator');
  await t.test('R2 upload failure, read failure and corrupt read cannot prepare active state',async()=>{
    for(const [operation,action,error] of [['put','FAIL','INTERNAL_ERROR'],['get','FAIL','INTERNAL_ERROR'],['get','CORRUPT','BLOB_VERIFY_FAILED']]){
      await arm(operation,action);const r=await s.call('prepare',s.make());assert.equal(r.body.error,error);assert.equal((await state()).revision,0);assert.equal((await state()).active,null);
    }
  });
  await t.test('control changes while prepare waits on R2: final transaction rejects',async()=>{
    await arm('get','WAIT');const preparing=s.call('prepare',s.make());await waitEntered();
    assert.equal((await freeze()).status,200);await release();const result=await preparing;assert.equal(result.body.error,'RECOMPUTE_REQUIRED');assert.equal((await state()).revision,0);
    const r=await s.call('control',{command_id:'unfreeze',expected_control_revision:1,expires_at:iso(Date.now()+60000),action:'FREEZE',frozen:false,reason:'fixture resume'},'test-only-operator');assert.equal(r.status,200);
  });
  await t.test('owner changes while upload waits: stale writer cannot complete prepare',async()=>{
    await arm('put','WAIT');const preparing=s.call('prepare',s.make({expected_control_revision:2}));await waitEntered();
    const transfer=await s.call('control',{command_id:'transfer',expected_control_revision:2,expires_at:iso(Date.now()+60000),action:'TRANSFER',owner:'new-pilot',reason:'fixture transfer'},'test-only-operator');assert.equal(transfer.status,200);
    await release();assert.equal((await preparing).body.error,'OWNER_EPOCH_DENIED');assert.equal((await state()).revision,0);
  });
  await t.test('commit response is lost after SQL transaction; retry returns same receipt',async()=>{
    const p=await s.call('prepare',s.make({expected_control_revision:3}),'test-only-next');assert.equal(p.status,200);
    const body={...s.trust,command_id:'lost-response',digest:p.body.digest,expires_at:iso(Date.now()+60000)};
    const core=await s.mf.getWorker('core');const lost=await core.fetch('https://core/datasets/cano.operation/commit',{method:'POST',headers:{authorization:'Bearer test-only-next','x-test-drop-response':'yes'},body:JSON.stringify(body)});assert.equal(lost.status,504);
    const before=await state();assert.equal(before.revision,1);
    const retry=await s.call('commit',body,'test-only-next');assert.deepEqual(retry.body.receipt,before.active);assert.equal((await state()).revision,1);
  });
});

test('cloud-like checkpoint CAS race on actual local R2 remains monotonic', {timeout:120000},async t=>{
  const s=await setup();t.after(()=>s.mf.dispose());const receipts=[];
  for(const expected_revision of [0,1]){const p=await s.call('prepare',s.make({expected_revision}));const c=await s.commit(p.body);assert.equal(c.status,200);receipts.push(c.body.receipt);}
  const envelopes=await Promise.all(receipts.map(r=>attest(r,'local-key',s.privateKey)));
  const bucket=await s.mf.getR2Bucket('CANONICAL','core');let arrivals=0,unlock;
  const barrier=new Promise(resolve=>unlock=resolve);
  const raced={get:key=>bucket.get(key),put:async(key,data,options)=>{if(key.endsWith('/latest.json')&&arrivals<2){arrivals++;if(arrivals===2)unlock();await barrier;}return bucket.put(key,data,options);}};
  const result=await Promise.all([exportCheckpoint(raced,envelopes[1]),exportCheckpoint(raced,envelopes[0])]);assert.ok(result.every(r=>r.exported));
  await exportCheckpoint(bucket,envelopes[0]);
  const latest=JSON.parse(await (await bucket.get(`checkpoints/${s.trust.authority_instance_id}/${s.trust.recovery_generation}/latest.json`)).text());assert.equal((await verifyAttestation(latest,s.trust)).revision,2);
});

test('future restrictive control clamps validation deadline before an outage', {timeout:120000},async t=>{
  const s=await setup();t.after(()=>s.mf.dispose());const effective=Date.now()+10000;
  const ctrl=await s.call('control',{command_id:'future-restriction',expected_control_revision:0,expires_at:iso(Date.now()+60000),action:'RESTRICT_AT',effective_from:iso(effective),reason:'fixture future closure'},'test-only-operator');assert.equal(ctrl.status,200);
  const candidate=s.make({expected_control_revision:1});const p=await s.call('prepare',candidate);const c=await s.commit(p.body);assert.equal(c.status,200);
  const v=await s.call('validate',{revision:1,digest:p.body.digest},'test-only-read');assert.equal(Date.parse(v.body.validation.expires_at),effective);
  const atClosure=servingView(candidate,c.body.receipt,s.trust,v.body.validation,effective);assert.equal(atClosure.authority,'UNVERIFIED');assert.equal(atClosure.decision_eligibility,'UNVERIFIED');
});
