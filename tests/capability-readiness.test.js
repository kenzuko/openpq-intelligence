import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForCapabilityStatus} from '../scripts/cloud/capability-readiness.js';
test('capability revoke waits for observed denial rather than secret update completion',async()=>{
  const responses=[200,200,401];let observation;
  await waitForCapabilityStatus(async()=>({status:responses.shift()}),401,{pause:async()=>{},observe:x=>observation=x});
  assert.equal(observation.attempts,3);assert.equal(observation.last_status,401);
});
test('capability restoration is separately observed and transient failures do not count as success',async()=>{
  let calls=0;
  await waitForCapabilityStatus(async()=>{calls++;if(calls===1)throw Error('private exception');return {status:calls===2?401:200};},200,{pause:async()=>{}});
  assert.equal(calls,3);
});
test('persistent capability state fails closed at deadline with phase-specific evidence',async()=>{
  let now=0,observation,calls=0;
  await assert.rejects(waitForCapabilityStatus(async()=>{calls++;return {status:200};},401,{clock:()=>now,timeout:10,interval:5,pause:async ms=>{now+=ms;},observe:x=>observation=x}),/READ_CAPABILITY_REVOKE_NOT_OBSERVED/);
  assert.equal(calls,3);assert.equal(observation.last_status,200);
  await assert.rejects(waitForCapabilityStatus(async()=>({status:401}),200,{attempts:1}),/READ_CAPABILITY_RESTORE_NOT_OBSERVED/);
});
