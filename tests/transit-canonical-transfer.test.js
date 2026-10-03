import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Miniflare,createFetchMock} from 'miniflare';
import {setup} from './support.js';
import {hash} from '../src/platform/contracts.js';
import {gitBlobSha} from '../src/ingress/cano-real-shadow.js';
import {continuousArtifactRefs,buildContinuousCandidate,validateContinuousProfile} from '../src/platform/domain-continuous-admission.js';
import {TRANSIT_FACT_PROFILE_VERSION} from '../src/platform/domain-continuous-contract.js';
import {TRANSIT_FACT_ACCOUNT,TRANSIT_FACT_ENVIRONMENT,TRANSIT_FACT_GATE,executionEnvironment,executionDataset} from '../src/platform/transit-execution-scope.js';
import {readTransitConsumer,TRANSIT_CANONICAL_ORIGIN,TRANSIT_LEGACY_URL} from '../src/platform/transit-consumer.js';
const AT='2026-10-03T21:46:00.000Z',NOW=Date.parse(AT);
const gate={ACCOUNT_ID:TRANSIT_FACT_ACCOUNT,CANONICAL_TRANSIT_GATE:TRANSIT_FACT_GATE};
test('actual workerd legacy gateway uses native outbound fetch and preserves UTF-8 bytes/CORS while rejecting writes',async()=>{
 const raw=await readFile(new URL('./data/transit-transfer/current-captured.json',import.meta.url),'utf8');
 const mock=createFetchMock();mock.disableNetConnect();const upstream=mock.get('https://raw.githubusercontent.com');upstream.intercept({path:'/kenzuko/transit-jotrip/main/data/network.json',method:'GET'}).reply(200,raw,{headers:{'content-type':'text/plain; charset=utf-8'}});
 const mf=new Miniflare({cf:false,modules:true,scriptPath:fileURLToPath(new URL('../src/workers/transit-consumer.js',import.meta.url)),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',fetchMock:mock,bindings:{TRANSIT_READER_MODE:'LEGACY'}});
 try{const r=await mf.dispatchFetch('https://reader/network.json');assert.equal(r.status,200,await r.clone().text());assert.equal(await r.text(),raw);assert.equal(r.headers.get('x-openpq-source-digest'),await hash(raw));assert.equal(r.headers.get('access-control-allow-origin'),'*');for(const method of ['POST','PUT','DELETE'])assert.equal((await mf.dispatchFetch('https://reader/network.json',{method})).status,405);
 }finally{await mf.dispose();await mock.close();}
});
test('reader requests manual redirects and rejects a supplied 302 instead of changing source origin',async()=>{
 let calls=0;
 await assert.rejects(readTransitConsumer({mode:'LEGACY'},{fetcher:async(url,options)=>{calls++;assert.equal(url,TRANSIT_LEGACY_URL);assert.equal(options.redirect,'manual');return new Response('redirect',{status:302,headers:{location:'https://untrusted.invalid/source'}});}}),/TRANSIT_READER_HTTP_302/);
 assert.equal(calls,1);
});
async function profile(){
 const p={contract_version:TRANSIT_FACT_PROFILE_VERSION,environment_id:TRANSIT_FACT_ENVIRONMENT,dataset_id:'transit.bridge.phu-quoc',domain:'transit',fixture_only:false,producer:{source_kind:'OWNER_REPOSITORY_SNAPSHOT',repository:'kenzuko/transit-jotrip',path:'data/network.json'},operator_principal_ids:['operator'],reference_policy:{lease_ms:300000,max_snapshot_age_ms:86400000,future_skew_ms:0},artifact_refs:{}};
 p.artifact_refs=await continuousArtifactRefs(p);return p;
}
test('production is closed except explicitly bound Transit facts; isolated/cross-domain/action grants cannot cross the gate',async()=>{
 for(const env of [{ENVIRONMENT_ID:'production'},{ENVIRONMENT_ID:TRANSIT_FACT_ENVIRONMENT},{ENVIRONMENT_ID:TRANSIT_FACT_ENVIRONMENT,...gate,ACCOUNT_ID:'c61a28455fe22f30619b35dd80c2d495'}])assert.throws(()=>executionEnvironment(env),/PRODUCTION_GATE_CLOSED/);
 const p=await profile(),base={environment_id:p.environment_id,account_id:TRANSIT_FACT_ACCOUNT,dataset_id:p.dataset_id,semantic_profile_hash:await hash(p),approved_positive_decision_types:[],artifacts:Object.fromEntries(Object.entries(p.artifact_refs).map(([k,v])=>[k,v.hash]))};
 await validateContinuousProfile(p,base);
 for(const change of [t=>t.dataset_id='cano.operation',t=>t.account_id='c61a28455fe22f30619b35dd80c2d495',t=>t.approved_positive_decision_types=['go'],t=>delete t.semantic_profile_hash]){const t=structuredClone(base);change(t);assert.throws(()=>executionDataset({ENVIRONMENT_ID:p.environment_id,...gate},t),/TRANSIT_FACT_EXECUTION_SCOPE_DENIED/);}
 for(const change of [x=>x.domain='airport',x=>x.producer.source_kind='OWNER_PUBLIC_RUNTIME',x=>x.producer.path='data/other.json']){const x=structuredClone(p);change(x);await assert.rejects(validateContinuousProfile(x,base));}
});
test('actual native Transit authority advances two captured source versions; reader switches, fails closed and rolls back without writer rollback',async()=>{
 const p=await profile(),s=await setup({semanticProfile:p,dataset_id:p.dataset_id,environment_id:p.environment_id,account_id:TRANSIT_FACT_ACCOUNT,domainOperator:true,coreScript:'tests/transit-transfer-clock-core.js',executionBindings:gate});
 const original=await readFile(new URL('./data/domains/transit.json',import.meta.url),'utf8');
 const current=await readFile(new URL('./data/transit-transfer/current-captured.json',import.meta.url),'utf8');
 const oldPin=JSON.parse(await readFile(new URL('./data/domains/SOURCE_PINS.json',import.meta.url),'utf8')).pins.transit;
 const currentPin=JSON.parse(await readFile(new URL('./data/transit-transfer/SOURCE_PIN.json',import.meta.url),'utf8'));
 const mock=createFetchMock();mock.disableNetConnect();let runtime;
 const rawHost=mock.get('https://'+TRANSIT_FACT_ACCOUNT+'.r2.cloudflarestorage.com');
 const publish=async(raw_utf8,n)=>{
  const pin=n===1?oldPin:currentPin;
  assert.equal(await hash(raw_utf8),pin.payload_sha256);assert.equal(await gitBlobSha(new TextEncoder().encode(raw_utf8)),pin.git_blob_sha);
  const c=await buildContinuousCandidate(p,s.trust,{raw_utf8,pin,operator_principal_id:'operator',evaluation_time:AT,candidate_id:'captured-version-'+n,expected_revision:n-1,logical_slot:n});
  const a=await s.call('prepare',c,'test-only-operator');assert.equal(a.status,200,JSON.stringify(a));
  const b=await s.call('commit',{...s.trust,command_id:'captured-commit-'+n,digest:a.body.digest,expires_at:c.valid_to},'test-only-operator');assert.equal(b.status,200,JSON.stringify(b));
  assert.equal((await s.call('export',{},'test-only-operator')).status,200);
  const bucket=await s.mf.getR2Bucket('CANONICAL','core');
  for(const key of [b.body.receipt.key,`checkpoints/${s.trust.authority_instance_id}/${s.trust.recovery_generation}/receipts/${n}.json`])rawHost.intercept({path:'/canonical-transit-facts/'+key,method:'GET'}).reply(200,await (await bucket.get(key)).text()).persist();
  return b.body.receipt;
 };
 try{
  const first=await publish(original,1);
  runtime=new Miniflare({cf:false,modules:true,scriptPath:fileURLToPath(new URL('./transit-transfer-clock-runtime.js',import.meta.url)),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',fetchMock:mock,bindings:{ENVIRONMENT_ID:p.environment_id,...gate,TRUST_JSON:JSON.stringify({[p.dataset_id]:s.trust}),CONTROL_READ_TOKEN:'test-only-read',S3_READONLY_CONFIG:JSON.stringify({endpoint:'https://'+TRANSIT_FACT_ACCOUNT+'.r2.cloudflarestorage.com',bucket:'canonical-transit-facts',access_key:'fixture-read-only',secret:'fixture-read-only'})},serviceBindings:{CORE_READ:request=>s.core.fetch(request)}});
  let legacyReads=0;
  const fetcher=(url,options)=>{if(url===TRANSIT_LEGACY_URL){legacyReads++;return new Response(current,{headers:{'content-type':'text/plain; charset=utf-8'}});}return runtime.dispatchFetch(url,options);};
  const old=await readTransitConsumer({mode:'LEGACY'},{fetcher,clock:()=>NOW});assert.equal(old.raw,current);
  const config={mode:'CANONICAL',origin:TRANSIT_CANONICAL_ORIGIN,trust:s.trust};
  const one=await readTransitConsumer(config,{fetcher,clock:()=>NOW});assert.equal(one.raw,original);assert.equal(one.revision,1);assert.equal(legacyReads,1);
  const second=await publish(current,2);assert.equal(second.owner,first.owner);assert.equal(second.epoch,first.epoch);assert.equal(second.semantic_admission.profile_hash,first.semantic_admission.profile_hash);assert.notEqual(second.semantic_admission.input_hash,first.semantic_admission.input_hash);
  const two=await readTransitConsumer(config,{fetcher,clock:()=>NOW});assert.equal(two.raw,current);assert.equal(two.revision,2);assert.equal(two.source_version_time,'2026-10-03T20:14:31.527Z');assert.equal(legacyReads,1);
  // The raw source time, missing ticket times, per-provider errors, fares and units survive byte-for-byte.
  assert.deepEqual(JSON.parse(two.raw),JSON.parse(current));
  for(const fault of ['EXPIRED','MIXED_REVISION','WRONG_TRUST','HTTP_FAILURE']){
   const bad=structuredClone(config);if(fault==='WRONG_TRUST')bad.trust.semantic_profile_hash='f'.repeat(64);
   const broken=async(url,options)=>{const r=await fetcher(url,options);if(fault==='HTTP_FAILURE')return Response.json({error:'unavailable'},{status:503});if(fault==='MIXED_REVISION'&&url.endsWith('/legacy-reference')){const headers=new Headers(r.headers);headers.set('x-openpq-receipt-digest','f'.repeat(64));return new Response(await r.text(),{headers});}return r;};
   await assert.rejects(readTransitConsumer(bad,{fetcher:broken,clock:()=>fault==='EXPIRED'?NOW+300000:NOW}));assert.equal(legacyReads,1,'canonical failure must not secretly read the old source');
  }
  const rollback=await readTransitConsumer({mode:'LEGACY'},{fetcher,clock:()=>NOW});assert.equal(rollback.raw,current);assert.equal(legacyReads,2);
  const state=(await s.call('read',undefined,'test-only-read')).body.state;assert.equal(state.revision,2);assert.equal(state.epoch,first.epoch);
  const forbidden=s.make({expected_revision:2,expected_control_revision:0});assert.notEqual((await s.call('prepare',forbidden,'test-only-live')).status,200);
 }finally{if(runtime)await runtime.dispose();await s.mf.dispose();await mock.close();}
});
