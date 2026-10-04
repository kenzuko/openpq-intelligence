import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './support.js';
import {hash} from '../src/platform/contracts.js';
import {continuousArtifactRefs,validateContinuousProfile,buildContinuousCandidate} from '../src/platform/domain-continuous-admission.js';
import {WEATHER_FACT_PROFILE_VERSION,continuousEnvironment} from '../src/platform/domain-continuous-contract.js';
import {WEATHER_FACT_ENVIRONMENT,WEATHER_FACT_ACCOUNT,WEATHER_FACT_GATE,WEATHER_SOURCE_URLS} from '../src/platform/weather-execution-contract.js';
import {executionEnvironment,executionDataset} from '../src/platform/transit-execution-scope.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {domainLegacyView} from '../src/platform/domain-serving.js';
const AT='2026-10-03T01:12:00.000Z';
const gate={ACCOUNT_ID:WEATHER_FACT_ACCOUNT,CANONICAL_WEATHER_GATE:WEATHER_FACT_GATE};
async function profile(domain){
 const p={contract_version:WEATHER_FACT_PROFILE_VERSION,environment_id:WEATHER_FACT_ENVIRONMENT,dataset_id:DOMAIN_DATASETS[domain],domain,fixture_only:false,producer:{source_kind:'OWNER_PUBLIC_RUNTIME',url:WEATHER_SOURCE_URLS[domain]},operator_principal_ids:['operator'],reference_policy:{lease_ms:300000,max_snapshot_age_ms:31*86400000,future_skew_ms:0},artifact_refs:{}};
 p.artifact_refs=await continuousArtifactRefs(p);return p;
}
async function trust(p){return {authority_instance_id:'captured-weather-replay',recovery_generation:'captured-replay-v1',authority_locator_version:'1',locator_artifact_hash:'a'.repeat(64),namespace_id:'fixture-only-namespace',object_name:'fixture-only/'+p.dataset_id,native_id:'0'.repeat(64),environment_id:p.environment_id,account_id:WEATHER_FACT_ACCOUNT,dataset_id:p.dataset_id,semantic_profile_hash:await hash(p),approved_positive_decision_types:[],artifacts:Object.fromEntries(Object.entries(p.artifact_refs).map(([k,v])=>[k,v.hash]))};}
test('Weather scope admits only six fixed producer-view roles, never public consumer or manifest/airport/transit/action grants',async()=>{
 assert.equal(continuousEnvironment(WEATHER_FACT_PROFILE_VERSION),WEATHER_FACT_ENVIRONMENT);
 for(const env of [{ENVIRONMENT_ID:'production'},{ENVIRONMENT_ID:WEATHER_FACT_ENVIRONMENT},{ENVIRONMENT_ID:WEATHER_FACT_ENVIRONMENT,...gate,ACCOUNT_ID:'c61a28455fe22f30619b35dd80c2d495'}])assert.throws(()=>executionEnvironment(env),/PRODUCTION_GATE_CLOSED/);
 for(const domain of Object.keys(WEATHER_SOURCE_URLS)){
  const p=await profile(domain),t=await trust(p);await validateContinuousProfile(p,t);executionDataset({ENVIRONMENT_ID:p.environment_id,...gate},t);
  for(const changed of [{dataset_id:'weather.manifest.bridge.phu-quoc'},{dataset_id:'transit.bridge.phu-quoc'},{account_id:'c61a28455fe22f30619b35dd80c2d495'},{approved_positive_decision_types:['go']},{semantic_profile_hash:null}])assert.throws(()=>executionDataset({ENVIRONMENT_ID:p.environment_id,...gate},{...t,...changed}),/WEATHER_FACT_EXECUTION_SCOPE_DENIED/);
  for(const url of [p.producer.url.replace('openpq-intelligence-weather-source-view.kenzuko.workers.dev','openphuquoc.com'),p.producer.url+'?changed=1','https://untrusted.invalid/current.json']){const bad=structuredClone(p);bad.producer.url=url;await assert.rejects(validateContinuousProfile(bad,t),/WEATHER_FACT_PROFILE_SCOPE_DENIED/);}
 }
});
test('six captured fixture replays preserve source bytes/classes/times and remain ABSTAIN; this is not live source proof',async()=>{
 for(const domain of Object.keys(WEATHER_SOURCE_URLS)){
  const p=await profile(domain),t=await trust(p),raw_utf8=await readFile(new URL('./data/domains/'+domain+'.json',import.meta.url),'utf8');
  const pin={source_kind:'OWNER_PUBLIC_RUNTIME',source_pointer:{url:p.producer.url},payload_sha256:await hash(raw_utf8),git_blob_sha:null};
  const c=await buildContinuousCandidate(p,t,{pin,raw_utf8,operator_principal_id:'operator',evaluation_time:AT,candidate_id:'captured-replay-'+domain});
  assert.equal(c.decision.effect,'ABSTAIN');assert.equal(c.decision.minimum_evidence_met,false);assert.equal(c.semantic_admission.source_policies_activated,false);assert.equal(c.semantic_admission.producer_independence,false);assert.equal(c.payload.domain_snapshot.operational_action_allowed,false);
  assert.equal(c.semantic_admission.input_hash,await hash(raw_utf8));assert.equal(c.environment_id,WEATHER_FACT_ENVIRONMENT);
  await assert.rejects(buildContinuousCandidate(p,t,{pin:{...pin,payload_sha256:'f'.repeat(64)},raw_utf8,operator_principal_id:'operator',evaluation_time:AT,candidate_id:'tampered'}),/CONTINUOUS_RAW_DIGEST_DENIED/);
 }
});
test('native Weather replay authority admits a scoped fact and exports independently signed unchanged source; positive mutation denied',async()=>{
 const p=await profile('weather'),s=await setup({semanticProfile:p,dataset_id:p.dataset_id,environment_id:p.environment_id,account_id:WEATHER_FACT_ACCOUNT,domainOperator:true,domainReplayClock:true,executionBindings:gate});
 try{
  const raw_utf8=await readFile(new URL('./data/domains/weather.json',import.meta.url),'utf8');
  const pin={source_kind:'OWNER_PUBLIC_RUNTIME',source_pointer:{url:p.producer.url},payload_sha256:await hash(raw_utf8),git_blob_sha:null};
  const c=await buildContinuousCandidate(p,s.trust,{pin,raw_utf8,operator_principal_id:'operator',evaluation_time:AT,candidate_id:'native-captured-weather',logical_slot:1});
  const bad=structuredClone(c);bad.decision.effect='POSITIVE';bad.decision.minimum_evidence_met=true;
  assert.notEqual((await s.call('prepare',bad,'test-only-operator')).status,200);
  const prepared=await s.call('prepare',c,'test-only-operator');assert.equal(prepared.status,200,JSON.stringify(prepared));
  const committed=await s.call('commit',{...s.trust,command_id:'native-captured-weather-commit',digest:prepared.body.digest,expires_at:c.valid_to},'test-only-operator');assert.equal(committed.status,200,JSON.stringify(committed));
  assert.equal((await s.call('export',{},'test-only-operator')).status,200);
  const bucket=await s.mf.getR2Bucket('CANONICAL','core'),receipt=committed.body.receipt;
  const generation=JSON.parse(await (await bucket.get(receipt.key)).text());
  const signed=JSON.parse(await (await bucket.get('checkpoints/'+s.trust.authority_instance_id+'/'+s.trust.recovery_generation+'/receipts/1.json')).text());
  assert.deepEqual(await domainLegacyView(generation,signed,s.trust),JSON.parse(raw_utf8));assert.equal(generation.semantic_bundle.pin.payload_sha256,await hash(raw_utf8));
  assert.equal(receipt.epoch,1);assert.equal((await s.call('read',undefined,'test-only-read')).body.state.control_revision,0);
 }finally{await s.mf.dispose();}
});

test('native Weather source pump keeps one authority, uses only the producer view and exposes no public refresh/control capability',async()=>{
 const p=await profile('weather'),s=await setup({semanticProfile:p,dataset_id:p.dataset_id,environment_id:p.environment_id,account_id:WEATHER_FACT_ACCOUNT,domainOperator:true,domainReplayClock:true,executionBindings:gate});
 const token='weather-source-fixture-token-only-'.padEnd(40,'x');
 Object.assign(s.principals.find(x=>x.id==='operator'),{token,permissions:['read','promote','export','domain-source-admit']});
 const raw=await readFile(new URL('./data/domains/weather.json',import.meta.url),'utf8');
 const entry={authority:s.trust,profile:p,actor_id:'operator',token};
 try{
  const options=s.options();options.workers.push({name:'weather-pump',modules:true,scriptPath:new URL('./weather-clock-ingestion.js',import.meta.url).pathname,modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',durableObjects:{SOURCE_PUMPS:{className:'WeatherSourcePump',useSQLite:true}},bindings:{ENVIRONMENT_ID:WEATHER_FACT_ENVIRONMENT,...gate,INGEST_DATASET_1:JSON.stringify(entry)},serviceBindings:{CORE_COMMAND:'core'},outboundService:async request=>{assert.equal(request.url,p.producer.url);return new Response(raw);}});
  await s.mf.setOptions(options);const ns=await s.mf.getDurableObjectNamespace('SOURCE_PUMPS','weather-pump'),pump=ns.get(ns.idFromName(WEATHER_FACT_ENVIRONMENT+'/'+p.dataset_id));
  for(const revision of [1,2]){const r=await pump.fetch('https://pump/refresh',{method:'POST'});assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).revision,revision);}
  assert.equal((await pump.fetch('https://pump/refresh')).status,405);
  const foreign=ns.get(ns.idFromName(WEATHER_FACT_ENVIRONMENT+'/airport.bridge.pqc'));assert.equal((await foreign.fetch('https://pump/refresh',{method:'POST'})).status,403);
  assert.equal((await (await s.mf.getWorker('weather-pump')).fetch('https://public/refresh',{method:'POST'})).status,404);
  assert.equal((await s.call('bootstrap',s.trust,token)).status,403);assert.equal((await s.call('control',{freeze:true},token)).status,403);
  const state=(await s.call('read',undefined,'test-only-read')).body.state;assert.equal(state.revision,2);assert.equal(state.epoch,1);assert.equal(state.control_revision,0);
 }finally{await s.mf.dispose();}
});
