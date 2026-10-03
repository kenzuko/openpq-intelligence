import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAuthority,principalSecrets,prepareCloud} from '../scripts/cloud/prepare.js';
import {denyProbe} from '../scripts/cloud/s3-deny-probe.js';
import {hash} from '../src/platform/contracts.js';
import {principal,authorize,PRINCIPAL_SECRET_NAMES} from '../src/platform/auth.js';
import {BUCKET} from '../scripts/cloud/preflight.js';
const account='a'.repeat(32),namespace='b'.repeat(32),native='c'.repeat(64);
const config={endpoint:`https://${account}.r2.cloudflarestorage.com`,bucket:BUCKET,access_key:'synthetic-read-id',secret:'synthetic-read-secret'};
test('cloud fixture authority binds actual IDs and publishes only public receipt keys',async()=>{
  const plan={account_id:account,dataset_id:'fixture.cano.operation.123',object_name:'isolated-test/fixture.cano.operation.123'};
  const a=await makeAuthority(plan,namespace,native,config);assert.equal(a.trust.account_id,account);assert.equal(a.trust.namespace_id,namespace);assert.equal(a.trust.native_id,native);assert.ok(!a.trust.receipt_keys['proof-key'].d);
  const without={...a.trust};delete without.locator_artifact_hash;assert.equal(await hash(without),a.trust.locator_artifact_hash);
  const principals=JSON.parse(a.coreSecrets.PRINCIPALS_JSON);assert.deepEqual(principals.find(p=>p.id==='proof-read').permissions,['read']);assert.ok(!JSON.stringify(a.trust).includes(config.secret));
  const runtime=JSON.parse(a.runtimeSecrets.S3_READONLY_CONFIG);assert.deepEqual(runtime,config);assert.equal(a.runtimeSecrets.CONTROL_READ_TOKEN,a.tokens.read);
  assert.equal(a.runtimeSecrets.CONTROL_READ_TOKENS_JSON,'');assert.equal(a.coreSecrets.SEMANTIC_REGISTRY_9,'');assert.equal(a.coreSecrets.SEMANTIC_PROFILE_3,'');assert.equal(a.coreSecrets.TRUST_JSON_6,'');assert.equal(a.runtimeSecrets.TRUST_JSON_6,'');
  await assert.rejects(makeAuthority(plan,'invalid',native,config));
});
test('write-denial probe is restricted to isolated bucket, scope and disposable proof key',async()=>{
  const calls=[];const fetcher=async(url,opts)=>{calls.push({url,opts});return new Response(null,{status:403});};
  assert.equal((await denyProbe(config,account,'PUT','proof-deny/fixture.json',fetcher)).status,403);assert.equal((await denyProbe(config,account,'DELETE','proof-deny/fixture.json',fetcher)).status,403);
  assert.ok(calls.every(c=>c.url.startsWith(config.endpoint+'/'+BUCKET+'/proof-deny/')));
  await assert.rejects(denyProbe({...config,bucket:'production'},account,'PUT','proof-deny/a',fetcher));await assert.rejects(denyProbe(config,account,'DELETE','generations/active',fetcher));
  await assert.rejects(denyProbe(config,account,'PUT','proof-deny/a',async()=>new Response(null,{status:200})),/READ_CREDENTIAL_WRITE_NOT_DENIED/);
});

test('long cloud dataset packs every capability below the secret limit without changing authority',async()=>{
  const dataset='fixture.cano.operation.'+'z'.repeat(64);
  const a=await makeAuthority({account_id:account,dataset_id:dataset,object_name:'isolated-test/'+dataset},namespace,native,config);
  assert.ok(Object.values({...a.coreSecrets,...a.runtimeSecrets}).every(v=>Buffer.byteLength(v)<=5000));
  const entries=PRINCIPAL_SECRET_NAMES.flatMap(name=>JSON.parse(a.coreSecrets[name]));
  assert.equal(entries.length,8);assert.ok(JSON.parse(a.coreSecrets.PRINCIPALS_JSON_2).length>0);
  for(const [name,token] of Object.entries(a.tokens)){
    const actor=await principal(new Request('https://test/',{headers:{authorization:'Bearer '+token}}),a.coreSecrets);
    assert.equal(actor.id,'proof-'+name);
    if(name==='wrong')assert.throws(()=>authorize(actor,'promote',a.trust),/CAPABILITY_LOCATOR_DENIED/);
    else if(name==='exporter'){authorize(actor,'export',a.trust);assert.deepEqual(actor.permissions,['export']);for(const permission of ['read','promote','control','bootstrap'])assert.throws(()=>authorize(actor,permission,a.trust),/CAPABILITY_DENIED/);}
    else authorize(actor,name==='read'?'read':'promote',a.trust);
  }
  assert.equal(a.coreSecrets.PRINCIPALS_JSON_3,'[]');
});
test('capability packing rejects oversized values and exhaustion before deployment',()=>{
  assert.throws(()=>principalSecrets([{token:'x'.repeat(5000)}]),/CAPABILITY_SECRET_TOO_LARGE/);
  assert.throws(()=>principalSecrets(Array.from({length:PRINCIPAL_SECRET_NAMES.length+1},()=>({token:'x'.repeat(3000)}))),/CAPABILITY_SHARDS_EXHAUSTED/);
  assert.equal(principalSecrets([{token:'small'}]).PRINCIPALS_JSON_2,'[]');
});
test('malformed capability shard fails closed even when another shard contains the supplied token',async()=>{
  const request=new Request('https://test/',{headers:{authorization:'Bearer valid'}});
  await assert.rejects(principal(request,{PRINCIPALS_JSON:'[{"token":"valid"}]',PRINCIPALS_JSON_2:'{}'}),/AUTH_CONFIGURATION_INVALID/);
  const actor=await principal(request,{PRINCIPALS_JSON:'[{"token":"valid","id":"legacy"}]'});
  assert.equal(actor.id,'legacy');
});


test('authority preparation refuses a running unattended feed before writing configs',async()=>{
 await assert.rejects(prepareCloud({active_ingestion:true},'must-not-rotate'),/ACTIVE_INGESTION_MUST_BE_PAUSED/);
});
