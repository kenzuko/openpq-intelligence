import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
import {normalizeManualCano,stagingView,stagingKey} from '../src/ingress/manual-cano.js';
import {hash,stable} from '../src/platform/contracts.js';
const commit='e19d30df1fe068d44f66f89278b749deb7b3c3cb';
const input=async(day='2026-10-01')=>{const raw=await readFile('fixtures/manual-cano-source/'+day+'-cano-an-thoi.json','utf8');return {raw,provenance:{repository:'kenzuko/Jotrip-Lab',commit_sha:commit,path:'data/marine_ops/manual-confirmations/'+day+'-cano-an-thoi.json',payload_sha256:await hash(raw)}};};
const change=async(body,mutate)=>{const data=JSON.parse(body.raw);mutate(data);const raw=JSON.stringify(data);return {raw,provenance:{...body.provenance,payload_sha256:await hash(raw)}};};
test('actual owner manual snapshot preserves original source time, reported status and explicit day expiry',async()=>{
  const body=await input(),record=await normalizeManualCano(body.raw,body.provenance);
  assert.equal(record.normalization_status,'NORMALIZED_SHADOW');assert.equal(record.reported_state,'RUNNING');assert.equal(record.source_time,'2026-09-30T23:23:00.000Z');assert.equal(record.valid_to,'2026-10-01T17:00:00.000Z');assert.equal(record.publication_admitted,false);
  assert.equal(stagingView(record,Date.parse('2026-10-01T12:00:00Z')).action_eligible,false);
  assert.equal(stagingView(record,Date.parse(record.valid_to)).freshness,'EXPIRED');
  assert.equal(stagingView(record,Date.parse(record.valid_from)-1).freshness,'NOT_YET_EFFECTIVE');
  assert.ok(!stable(record).includes('confirmation_channel'));assert.ok(!stable(record).includes('evidence_note'));
});
test('history without explicit source author is quarantined rather than assigned an invented operator',async()=>{
  for(const day of ['2026-09-30','2026-09-27']){const b=await input(day),r=await normalizeManualCano(b.raw,b.provenance);assert.equal(r.normalization_status,'QUARANTINED');assert.equal(r.source_author,null);assert.ok(r.reason_codes.includes('MANUAL_AUTHOR_NOT_EXPLICIT'));assert.equal(stagingView(r,Date.parse('2026-10-01T12:00:00Z')).freshness,'EXPIRED');}
});
test('day/time/path/scope/type/hash mismatches cannot normalize as the pilot',async()=>{
  const b=await input();
  for(const mutate of [d=>delete d.recorded_at_vn,d=>d.recorded_at_vn='2026-10-01T06:23:00Z',d=>d.recorded_at_vn='2026-10-02T06:23:00+07:00',d=>d.date='31/02/2026',d=>d.category='ferry',d=>d.evidence.area='Phú Quốc',d=>d.evidence.evidence_class='INFERRED',d=>d.state='OPEN']){
    const altered=await change(b,mutate);await assert.rejects(normalizeManualCano(altered.raw,altered.provenance));
  }
  await assert.rejects(normalizeManualCano(b.raw,{...b.provenance,path:'data/private.json'}),/MANUAL_PATH_SCOPE_MISMATCH/);
  await assert.rejects(normalizeManualCano(b.raw,{...b.provenance,payload_sha256:'0'.repeat(64)}),/MANUAL_PAYLOAD_HASH_MISMATCH/);
  await assert.rejects(normalizeManualCano(b.raw,{...b.provenance,repository:'other/repo'}),/MANUAL_ORIGIN_FORBIDDEN/);
});
test('repeat fetch does not refresh source time or change content identity; author mismatch stays quarantined',async()=>{
  const b=await input(),a=await normalizeManualCano(b.raw,b.provenance),c=await normalizeManualCano(b.raw,{...b.provenance,retrieved_at:'2026-10-01T12:00:00Z'});assert.deepEqual(a,c);assert.equal(stagingKey(a),stagingKey(c));
  assert.ok(stagingView(a,Date.parse('2026-10-01T12:00:00Z')).source_age_ms>stagingView(a,Date.parse('2026-10-01T01:00:00Z')).source_age_ms);
  const altered=await change(b,d=>d.confirmed_by='untrusted');assert.equal((await normalizeManualCano(altered.raw,altered.provenance)).normalization_status,'QUARANTINED');
});
test('native staging Worker writes only staging keys, deduplicates, denies deletes/publication and bounds streamed input',async t=>{
  const token='synthetic-stage-capability',bindings={ENVIRONMENT_ID:'local-test',STAGING_BUCKET:'openpq-intelligence-canonical-isolated-test',STAGING_TOKEN_HASH:await hash(token),SOURCE_COMMIT_SHA:commit,STAGING_TOKEN_EXPIRES_AT:new Date(Date.now()+600000).toISOString()};
  const opts={modules:true,scriptPath:fileURLToPath(new URL('../src/workers/staging.js',import.meta.url)),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',r2Buckets:{STAGING:'staging-bucket'},bindings};
  const mf=new Miniflare(opts);t.after(()=>mf.dispose());const bucket=await mf.getR2Bucket('STAGING');await bucket.put('generations/sentinel.json','unchanged');
  const call=async(path,body,method=body?'POST':'GET',credential=token)=>{const response=await mf.dispatchFetch('https://staging'+path,{method,headers:{authorization:'Bearer '+credential},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};
  const body=await input();assert.equal((await call('/stage',body,'POST','wrong')).status,401);
  const first=await call('/stage',body);assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.body.created,true);assert.equal(first.body.view.action_eligible,false);
  const again=await call('/stage',body);assert.equal(again.body.created,false);assert.equal(again.body.record_digest,first.body.record_digest);
  const read=await call('/read?digest='+first.body.record_digest);assert.equal(read.status,200,JSON.stringify(read));assert.equal(read.body.stored_sha256,first.body.stored_sha256);
  for(const path of ['/commit','/prepare','/control','/export'])assert.equal((await call(path,{})).status,404);
  assert.equal((await call('/stage',undefined,'DELETE')).status,405);
  assert.equal(await (await bucket.get('generations/sentinel.json')).text(),'unchanged');
  const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('x'.repeat(20000)));controller.close();}});
  const oversized=await mf.dispatchFetch('https://staging/stage',{method:'POST',headers:{authorization:'Bearer '+token},body:stream,duplex:'half'});assert.equal(oversized.status,413);
  await bucket.put(first.body.key,'{}');assert.equal((await call('/read?digest='+first.body.record_digest)).body.error,'STAGING_OBJECT_CORRUPT');assert.equal((await call('/stage',body)).body.error,'STAGING_IMMUTABLE_CONFLICT');
  await mf.setOptions({...opts,bindings:{...bindings,STAGING_TOKEN_EXPIRES_AT:'2026-01-01T00:00:00Z'}});assert.equal((await call('/stage',body)).status,401);
  await mf.setOptions({...opts,bindings:{...bindings,ENVIRONMENT_ID:'production'}});assert.equal((await call('/stage',body)).status,503);
});
test('staging deployment config rejects production accounts, routes, inheritance and command bindings',async()=>{
  const {stagingConfig,assertStagingConfig}=await import('../src/ingress/staging-config.js');
  const account='a'.repeat(32),prod='b'.repeat(32),config=stagingConfig(account,commit,'2026-10-01T17:00:00Z');
  assertStagingConfig(config,account,[prod]);
  assert.throws(()=>assertStagingConfig(config,account,[account]),/STAGING_PRODUCTION_ACCOUNT_FORBIDDEN/);
  for(const alter of [c=>c.routes=['public.example.com/*'],c=>c.triggers={crons:['* * * * *']},c=>c.services=[{binding:'CORE_COMMAND'}],c=>c.env={},c=>c.r2_buckets[0].bucket_name='production']){
    const c=structuredClone(config);alter(c);assert.throws(()=>assertStagingConfig(c,account,[prod]));
  }
});
