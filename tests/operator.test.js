import test from 'node:test';
import assert from 'node:assert/strict';
import operator from '../src/workers/operator.js';
test('separate console forwards individual capability and rejects unsupported paths or production',async()=>{
  let forwarded;
  const env={ENVIRONMENT_ID:'isolated-test',CORE_COMMAND:{fetch:async(url,init)=>{forwarded={url,init};return Response.json({state:{control_revision:1}});}}};
  const r=await operator.fetch(new Request('https://console/api/datasets/cano.operation/control',{method:'POST',headers:{authorization:'Bearer fixture'},body:'{}'}),env);
  assert.equal(r.status,200);assert.equal(forwarded.init.headers.authorization,'Bearer fixture');assert.equal(forwarded.url,'https://core/datasets/cano.operation/control');
  assert.equal((await operator.fetch(new Request('https://console/api/datasets/cano.operation/bootstrap'),env)).status,404);
  assert.equal((await operator.fetch(new Request('https://console/'),{...env,ENVIRONMENT_ID:'production'})).status,503);
  const ui=await operator.fetch(new Request('https://console/'),env);assert.equal(ui.headers.get('cache-control'),'no-store');assert.match(ui.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
