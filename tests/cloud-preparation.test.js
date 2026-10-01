import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAuthority} from '../scripts/cloud/prepare.js';
import {denyProbe} from '../scripts/cloud/s3-deny-probe.js';
import {hash} from '../src/platform/contracts.js';
import {BUCKET} from '../scripts/cloud/preflight.js';
const account='a'.repeat(32),namespace='b'.repeat(32),native='c'.repeat(64);
const config={endpoint:`https://${account}.r2.cloudflarestorage.com`,bucket:BUCKET,access_key:'synthetic-read-id',secret:'synthetic-read-secret'};
test('cloud fixture authority binds actual IDs and publishes only public receipt keys',async()=>{
  const plan={account_id:account,dataset_id:'fixture.cano.operation.123',object_name:'isolated-test/fixture.cano.operation.123'};
  const a=await makeAuthority(plan,namespace,native,config);assert.equal(a.trust.account_id,account);assert.equal(a.trust.namespace_id,namespace);assert.equal(a.trust.native_id,native);assert.ok(!a.trust.receipt_keys['proof-key'].d);
  const without={...a.trust};delete without.locator_artifact_hash;assert.equal(await hash(without),a.trust.locator_artifact_hash);
  const principals=JSON.parse(a.coreSecrets.PRINCIPALS_JSON);assert.deepEqual(principals.find(p=>p.id==='proof-read').permissions,['read']);assert.ok(!JSON.stringify(a.trust).includes(config.secret));
  const runtime=JSON.parse(a.runtimeSecrets.S3_READONLY_CONFIG);assert.deepEqual(runtime,config);assert.equal(a.runtimeSecrets.CONTROL_READ_TOKEN,a.tokens.read);
  await assert.rejects(makeAuthority(plan,'invalid',native,config));
});
test('write-denial probe is restricted to isolated bucket, scope and disposable proof key',async()=>{
  const calls=[];const fetcher=async(url,opts)=>{calls.push({url,opts});return new Response(null,{status:403});};
  assert.equal((await denyProbe(config,account,'PUT','proof-deny/fixture.json',fetcher)).status,403);assert.equal((await denyProbe(config,account,'DELETE','proof-deny/fixture.json',fetcher)).status,403);
  assert.ok(calls.every(c=>c.url.startsWith(config.endpoint+'/'+BUCKET+'/proof-deny/')));
  await assert.rejects(denyProbe({...config,bucket:'production'},account,'PUT','proof-deny/a',fetcher));await assert.rejects(denyProbe(config,account,'DELETE','generations/active',fetcher));
  await assert.rejects(denyProbe(config,account,'PUT','proof-deny/a',async()=>new Response(null,{status:200})),/READ_CREDENTIAL_WRITE_NOT_DENIED/);
});
