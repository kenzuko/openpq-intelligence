import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,createFetchMock} from 'miniflare';
import {fileURLToPath} from 'node:url';
import {setup} from './support.js';
import {hash} from '../src/platform/contracts.js';
import {continuousArtifactRefs,validateContinuousProfile,buildContinuousCandidate} from '../src/platform/domain-continuous-admission.js';
import {AIRPORT_FACT_PROFILE_VERSION} from '../src/platform/domain-continuous-contract.js';
import {AIRPORT_FACT_ENVIRONMENT,AIRPORT_FACT_ACCOUNT,AIRPORT_FACT_GATE,AIRPORT_FACT_DATASET,AIRPORT_SOURCE_URL} from '../src/platform/airport-execution-contract.js';
import {readAirportConsumer,AIRPORT_CANONICAL_ORIGIN} from '../src/platform/airport-consumer.js';
import {executionEnvironment,executionDataset} from '../src/platform/transit-execution-scope.js';
const AT='2026-10-04T03:56:07.789Z',gate={ACCOUNT_ID:AIRPORT_FACT_ACCOUNT,CANONICAL_AIRPORT_GATE:AIRPORT_FACT_GATE};
async function profile(){const p={contract_version:AIRPORT_FACT_PROFILE_VERSION,environment_id:AIRPORT_FACT_ENVIRONMENT,dataset_id:AIRPORT_FACT_DATASET,domain:'airport',fixture_only:false,producer:{source_kind:'OWNER_PUBLIC_RUNTIME',url:AIRPORT_SOURCE_URL},operator_principal_ids:['operator'],reference_policy:{lease_ms:45000,max_snapshot_age_ms:60000,future_skew_ms:0},artifact_refs:{}};p.artifact_refs=await continuousArtifactRefs(p);return p;}
async function input(raw_utf8){raw_utf8??=await readFile(new URL('./data/airport-live-captured-20261004.json',import.meta.url),'utf8');return {raw_utf8,pin:{source_kind:'OWNER_PUBLIC_RUNTIME',source_pointer:{url:AIRPORT_SOURCE_URL},payload_sha256:await hash(raw_utf8),git_blob_sha:null}};}
test('Airport scope denies other accounts, sources, datasets, positive grants and a relaxed one-minute freshness budget',async()=>{
 const p=await profile(),trust={environment_id:p.environment_id,account_id:AIRPORT_FACT_ACCOUNT,dataset_id:p.dataset_id,semantic_profile_hash:await hash(p),approved_positive_decision_types:[],artifacts:Object.fromEntries(Object.entries(p.artifact_refs).map(([k,v])=>[k,v.hash]))};await validateContinuousProfile(p,trust);executionDataset({ENVIRONMENT_ID:p.environment_id,...gate},trust);
 assert.throws(()=>executionEnvironment({ENVIRONMENT_ID:p.environment_id,...gate,ACCOUNT_ID:'c61a28455fe22f30619b35dd80c2d495'}),/PRODUCTION_GATE_CLOSED/);
 for(const change of [{dataset_id:'weather.bridge.phu-quoc'},{approved_positive_decision_types:['open']}])assert.throws(()=>executionDataset({ENVIRONMENT_ID:p.environment_id,...gate},{...trust,...change}),/AIRPORT_FACT_EXECUTION_SCOPE_DENIED/);
 for(const change of [{producer:{source_kind:'OWNER_PUBLIC_RUNTIME',url:'https://openphuquoc.com/airport/'}},{reference_policy:{...p.reference_policy,max_snapshot_age_ms:60001}}])await assert.rejects(validateContinuousProfile({...p,...change},trust),/AIRPORT_FACT_PROFILE_SCOPE_DENIED/);
});
test('captured live Airport bytes pass one native authority and S3 Runtime without archive, wrong-day or stale admission',async()=>{
 const p=await profile(),s=await setup({semanticProfile:p,dataset_id:p.dataset_id,environment_id:p.environment_id,account_id:AIRPORT_FACT_ACCOUNT,domainOperator:true,coreScript:'tests/airport-captured-clock-core.js',executionBindings:gate});
 try{
  const source=await input(),build=(inputValue=source,at=AT)=>buildContinuousCandidate(p,s.trust,{...inputValue,operator_principal_id:'operator',evaluation_time:at,candidate_id:'captured-airport-live',logical_slot:1});
  const c=await build();assert.equal(c.decision.effect,'ABSTAIN');assert.equal(c.semantic_admission.source_policies_activated,false);
  const board=JSON.parse(source.raw_utf8);assert.equal(c.valid_to,new Date(Math.min(Date.parse(AT)+45000,Date.parse(board.latest.collected_at_vn)+60000)).toISOString());
  await assert.rejects(build(source,new Date(Date.parse(board.latest.collected_at_vn)+60000).toISOString()),/CONTINUOUS_SNAPSHOT_AGE_DENIED/);
  await assert.rejects(build(source,new Date(Date.parse(board.latest.collected_at_vn)-1).toISOString()),/CONTINUOUS_SNAPSHOT_AGE_DENIED/);
  const wrongDay=structuredClone(board);wrongDay.latest.source_date='2026-10-03';await assert.rejects(build(await input(JSON.stringify(wrongDay))),/AIRPORT_LIVE_TODAY_REQUIRED/);
  const fallback=structuredClone(board);fallback.health.live_proxy=false;fallback.health.source_mode='GITHUB_SNAPSHOT_FALLBACK';await assert.rejects(build(await input(JSON.stringify(fallback))));
  const positive=structuredClone(c);positive.decision.effect='POSITIVE';positive.decision.minimum_evidence_met=true;assert.notEqual((await s.call('prepare',positive,'test-only-operator')).status,200);
  const prepared=await s.call('prepare',c,'test-only-operator');assert.equal(prepared.status,200,JSON.stringify(prepared));const committed=await s.call('commit',{...s.trust,command_id:'captured-airport-commit',digest:prepared.body.digest,expires_at:c.valid_to},'test-only-operator');assert.equal(committed.status,200,JSON.stringify(committed));assert.equal((await s.call('export',{},'test-only-operator')).status,200);
  const receipt=committed.body.receipt,bucket=await s.mf.getR2Bucket('CANONICAL','core'),mock=createFetchMock();mock.disableNetConnect();const host=mock.get('https://'+AIRPORT_FACT_ACCOUNT+'.r2.cloudflarestorage.com');
  for(const key of [receipt.key,'checkpoints/'+s.trust.authority_instance_id+'/'+s.trust.recovery_generation+'/receipts/1.json'])host.intercept({path:'/fixture-airport-facts/'+key,method:'GET'}).reply(200,await (await bucket.get(key)).text()).persist();
  const runtime=new Miniflare({cf:false,modules:true,scriptPath:fileURLToPath(new URL('./airport-captured-clock-runtime.js',import.meta.url)),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',fetchMock:mock,bindings:{ENVIRONMENT_ID:p.environment_id,...gate,TRUST_JSON:JSON.stringify({[p.dataset_id]:s.trust}),CONTROL_READ_TOKEN:'test-only-read',S3_READONLY_CONFIG:JSON.stringify({endpoint:'https://'+AIRPORT_FACT_ACCOUNT+'.r2.cloudflarestorage.com',bucket:'fixture-airport-facts',access_key:'fixture-read-only',secret:'fixture-read-only'})},serviceBindings:{CORE_READ:request=>s.core.fetch(request)}});
  try{
   const config={mode:'CANONICAL',domain:'airport',origin:AIRPORT_CANONICAL_ORIGIN,trust:s.trust},fetcher=(url,o)=>runtime.dispatchFetch(url,o);
   const read=await readAirportConsumer(config,{fetcher,clock:()=>Date.parse(AT)});assert.equal(read.raw,source.raw_utf8);assert.equal(read.source_digest,source.pin.payload_sha256);assert.equal(read.revision,1);
   await assert.rejects(readAirportConsumer(config,{fetcher,clock:()=>Date.parse(board.latest.collected_at_vn)+60000}),/AIRPORT_LIVE_FRESHNESS_DENIED|AIRPORT_CONSUMER_EXPIRED/);
  }finally{await runtime.dispose();await mock.close();}
 }finally{await s.mf.dispose();}
});
