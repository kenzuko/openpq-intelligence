import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForNativeProbe} from '../scripts/cloud/native-probe.js';

const plan={dataset_id:'fixture.cano.operation.new',object_name:'isolated-test/fixture.cano.operation.new',provisioning_token:'synthetic-secret'};
const current={dataset_id:plan.dataset_id,object_name:plan.object_name,native_id:'a'.repeat(64)};
test('native probe waits for new secret and exact deployment scope before pinning authority',async()=>{
  const responses=[new Response(null,{status:403}),Response.json({...current,dataset_id:'fixture.cano.operation.old'}),Response.json(current)];
  let calls=0,waits=0;
  const probe=await waitForNativeProbe('https://test',plan,{attempts:3,pause:async()=>{waits++;},fetcher:async(url,options)=>{
    calls++;assert.equal(url,'https://test/probe');assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,'Bearer '+plan.provisioning_token);return responses.shift();
  }});
  assert.deepEqual(probe,current);assert.equal(calls,3);assert.equal(waits,2);
});
test('native readiness exhaustion denies stale authority and reports safe specific status',async()=>{
  for(const [response,code] of [[Response.json({...current,object_name:'alternate'}),'NATIVE_PROBE_SCOPE_MISMATCH'],[new Response(null,{status:403}),'NATIVE_PROBE_HTTP_403']]){
    await assert.rejects(waitForNativeProbe('https://test',plan,{attempts:2,pause:async()=>{},fetcher:async()=>response.clone()}),new RegExp(code));
  }
});
test('native probe refuses malformed identity and distinguishes network failure without leaking details',async()=>{
  await assert.rejects(waitForNativeProbe('https://test',plan,{fetcher:async()=>Response.json({...current,native_id:'wrong'})}),/NATIVE_PROBE_INVALID_NATIVE_ID/);
  await assert.rejects(waitForNativeProbe('https://test',plan,{attempts:1,fetcher:async()=>{throw Error(plan.provisioning_token);}}),/NATIVE_PROBE_NETWORK_UNAVAILABLE/);
});
