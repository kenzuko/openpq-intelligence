import test from 'node:test';
import assert from 'node:assert/strict';
import {loseCommittedResponse,observeRestart} from '../scripts/cloud/response-loss.js';
test('response-loss fixture closes actual client socket only after upstream success',async()=>{
  let committed=0;
  const result=await loseCommittedResponse(async()=>{committed++;return new Response('private receipt');});
  assert.equal(committed,1);assert.equal(result.client_response_lost,true);
  await assert.rejects(loseCommittedResponse(async()=>new Response(null,{status:403})),/FAULT_UPSTREAM_COMMIT_FAILED/);
});
test('restart evidence requires a changed constructor incarnation, not a successful deploy alone',async()=>{
  let calls=0;
  const r=await observeRestart(async()=>{calls++;if(calls===1)throw Error('transient network failure');return {status:200,body:{instance_observation:{incarnation_id:calls===2?'old':'new'}}};},'old',{pause:async()=>{}});
  assert.equal(r.incarnation_id,'new');assert.equal(r.attempts,3);
  await assert.rejects(observeRestart(async()=>({status:200,body:{instance_observation:{incarnation_id:'old'}}}),'old',{attempts:1}),/COORDINATOR_RESTART_NOT_OBSERVED/);
});
