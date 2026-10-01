import test from 'node:test';
import assert from 'node:assert/strict';
import {instant,hash,stable,candidate} from '../src/platform/contracts.js';
import {attest,verifyAttestation,exportCheckpoint} from '../src/platform/receipts.js';
import {servingView} from '../src/platform/serving.js';

test('UTC and deterministic artifact contracts reject malformed input',async()=>{
  for(const time of ['2026-02-30T00:00:00Z','2026-01-01T00:00:00+07:00','not-a-date']) assert.throws(()=>instant(time,'TIME'));
  assert.equal(await hash({b:2,a:1}),await hash({a:1,b:2}));assert.throws(()=>stable({a:undefined}));assert.throws(()=>candidate({}));
});
test('source age advances with serve time; expired restrictive state never becomes OPEN',()=>{
  const now=Date.parse('2026-10-01T00:00:00Z');
  const trust={account_id:'synthetic-test-account',environment_id:'test',dataset_id:'cano',authority_instance_id:'one',authority_locator_version:'1',locator_artifact_hash:'a',namespace_id:'test-namespace',native_id:'a'.repeat(64),object_name:'test/cano',recovery_generation:'one'};
  const generation={...trust,valid_from:new Date(now-1000).toISOString(),valid_to:new Date(now+3600000).toISOString(),inputs:[{source_id:'manual',source_time:new Date(now-5000).toISOString(),valid_to:new Date(now+3600000).toISOString(),max_age_ms:10000}],quality:{completeness:'COMPLETE',resolution:'RESOLVED'},decision:{effect:'RESTRICTIVE',action_until:new Date(now+20000).toISOString(),minimum_evidence_met:true}};
  const receipt={...trust,revision:1,control_revision:0,operation:'NORMAL'};
  const validation={...trust,revision:1,control_revision:0,validated_at:new Date(now).toISOString(),expires_at:new Date(now+15000).toISOString(),positive_allowed:true};
  const first=servingView(generation,receipt,trust,validation,now);assert.equal(first.decision_eligibility,'ELIGIBLE');
  const stale=servingView(generation,receipt,trust,validation,now+6000);assert.equal(stale.freshness,'STALE');assert.equal(stale.decision_eligibility,'ABSTAIN');assert.equal(stale.inputs[0].age_ms,11000);
  const expired=servingView(generation,receipt,trust,validation,now+21000);assert.equal(expired.decision_eligibility,'EXPIRED');
  assert.throws(()=>servingView(generation,{...receipt,authority_instance_id:'alternate'},trust,validation,now));
});
test('signed checkpoint binds authority and content; forged and rotated receipts are rejected',async()=>{
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const priv=await crypto.subtle.exportKey('jwk',pair.privateKey),pub=await crypto.subtle.exportKey('jwk',pair.publicKey);
  const trust={account_id:'synthetic-test-account',environment_id:'test',dataset_id:'cano',authority_instance_id:'one',authority_locator_version:'1',locator_artifact_hash:'a',namespace_id:'test-namespace',native_id:'a'.repeat(64),object_name:'test/cano',recovery_generation:'one',receipt_keys:{key:pub}};
  const r={...trust,revision:1,digest:'b'};const envelope=await attest(r,'key',priv);assert.deepEqual(await verifyAttestation(envelope,trust),r);
  await assert.rejects(verifyAttestation({...envelope,receipt:{...r,revision:2}},trust));
  await assert.rejects(verifyAttestation(envelope,{...trust,recovery_generation:'two'}));
  await assert.rejects(verifyAttestation({...envelope,key_id:'untrusted'},trust));
  await assert.rejects(verifyAttestation(envelope,{...trust,native_id:'b'.repeat(64)}));
  await assert.rejects(verifyAttestation(envelope,{...trust,namespace_id:'alternate-namespace'}));
  await assert.rejects(verifyAttestation(envelope,{...trust,account_id:'alternate-account'}));
});
test('projection exhausted CAS is reported as retryable rather than successful',async()=>{
  const envelope={receipt:{authority_instance_id:'one',recovery_generation:'one',revision:1}};
  let puts=0;const bucket={put:async(key)=>{puts++;return key.includes('/receipts/')?{}:null;},get:async()=>null};
  assert.deepEqual(await exportCheckpoint(bucket,envelope),{exported:false,reason:'CAS_RETRY_BUDGET'});assert.equal(puts,6);
});
