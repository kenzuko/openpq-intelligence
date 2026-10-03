import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './support.js';
import {ingestDataset,ownedReference} from '../src/ingress/domain-feed.js';
import {CONTINUOUS_PROFILE_VERSION,continuousArtifactRefs,buildContinuousCandidate} from '../src/platform/domain-continuous-admission.js';
import {ISOLATED_ACCOUNT_ID} from '../src/platform/domain-bridge-admission.js';
import {DOMAIN_RUNTIME_URLS} from '../src/ingress/domain-source-common.js';
const token='native-ingestion-only-token-'.padEnd(40,'x');
async function setupIngestion(){
 const p={contract_version:CONTINUOUS_PROFILE_VERSION,environment_id:'isolated-test',dataset_id:'weather.compact.bridge.phu-quoc',domain:'weather_compact',fixture_only:false,producer:{source_kind:'OWNER_PUBLIC_RUNTIME',url:DOMAIN_RUNTIME_URLS.weather_compact},operator_principal_ids:['operator'],reference_policy:{lease_ms:300000,max_snapshot_age_ms:600000,future_skew_ms:0},artifact_refs:{}};
 p.artifact_refs=await continuousArtifactRefs(p);
 const s=await setup({semanticProfile:p,dataset_id:p.dataset_id,environment_id:'isolated-test',account_id:ISOLATED_ACCOUNT_ID,domainOperator:true});
 Object.assign(s.principals.find(x=>x.id==='operator'),{token,permissions:['read','promote','export','domain-source-admit']});
 await s.mf.setOptions(s.options());
 const core=await s.mf.getWorker('test-client');
 const entry={authority:s.trust,profile:p,actor_id:'operator',token};
 const raw=JSON.parse(await readFile(new URL('./data/domains/weather_compact.json',import.meta.url),'utf8'));
 const fetcher=async()=>new Response(JSON.stringify({...raw,generated_at:new Date(Date.now()-1000).toISOString()}));
 return {s,core,entry,fetcher,raw};
}
test('native scheduled admission continues on one authority and denies bootstrap/control/cross-dataset privileges',async()=>{
 const {s,core,entry,fetcher}=await setupIngestion();
 try{
  const a=await ingestDataset(entry,core,fetcher),b=await ingestDataset(entry,core,fetcher);
  assert.equal(a.revision,1);assert.equal(b.revision,2);assert.equal(b.operational_action_allowed,false);
  assert.equal((await s.call('bootstrap',s.trust,token)).status,403);
  assert.equal((await s.call('control',{freeze:true},token)).status,403);
  const other=await core.fetch('https://core/datasets/airport.bridge.pqc/read',{headers:{authorization:'Bearer '+token}});assert.notEqual(other.status,200);
  const state=(await s.call('read',undefined,token)).body.state;assert.equal(state.active.digest,b.receipt_digest);assert.equal(state.revision,2);
  const bucket=await s.mf.getR2Bucket('CANONICAL','core');const generation=JSON.parse(await (await bucket.get(state.active.key)).text());assert.equal(generation.decision.effect,'ABSTAIN');
 }finally{await s.mf.dispose();}
});
test('lost commit response retries identical command once without duplicate revision',async()=>{
 const {s,core,entry,fetcher}=await setupIngestion();let lost=false;const commands=[];
 const transport={async fetch(url,options){const r=await core.fetch(url,options);if(url.endsWith('/commit')){commands.push(options.body);if(!lost){lost=true;await r.arrayBuffer();throw new TypeError('response lost');}}return r;}};
 try{const a=await ingestDataset(entry,transport,fetcher);assert.equal(a.revision,1);assert.equal(commands.length,2);assert.equal(commands[0],commands[1]);assert.equal((await s.call('read',undefined,token)).body.state.revision,1);}finally{await s.mf.dispose();}
});
test('expired source fails closed without advancing revision; production tick makes no calls',async()=>{
 const {s,core,entry,raw}=await setupIngestion();
 try{
  await assert.rejects(ingestDataset(entry,core,async()=>new Response(JSON.stringify({...raw,generated_at:new Date(Date.now()-700000).toISOString()}))),/SNAPSHOT_AGE_DENIED/);
  assert.equal((await s.call('read',undefined,token)).body.state.revision,0);
  await assert.rejects(ingestDataset({...entry,authority:{...entry.authority,environment_id:'production'}},core,()=>{throw new Error('must not fetch');}),/SCOPE_DENIED/);
 }finally{await s.mf.dispose();}
});
test('repository source fetches exactly the captured commit path and preserves blob identity',async()=>{
 const requests=[],sha='a'.repeat(40),pkt=s=>(s.length+4).toString(16).padStart(4,'0')+s,advert=pkt('# service=git-upload-pack\n')+'0000'+pkt('a'.repeat(40)+' refs/heads/main\n')+'0000',raw='{"version":"fixture"}\n';
 const result=await ownedReference({source_kind:'OWNER_REPOSITORY_SNAPSHOT',repository:'kenzuko/transit-jotrip',path:'data/network.json'},async(url,options)=>{requests.push(url);assert.equal(options.redirect,'manual');return url.includes('info/refs')?new Response(advert,{headers:{'content-type':'application/x-git-upload-pack-advertisement'}}):new Response(raw);});
 assert.equal(requests.length,2);assert.equal(requests[1],'https://raw.githubusercontent.com/kenzuko/transit-jotrip/'+sha+'/data/network.json');assert.equal(result.raw_utf8,raw);assert.match(result.pin.git_blob_sha,/^[a-f0-9]{40}$/);
});

test('native non-authoritative pump dispatches only its configured dataset and exposes no public command route',async()=>{
 const {s,entry,fetcher}=await setupIngestion();
 try{
  const options=s.options();options.workers.push({name:'source-pump',modules:true,scriptPath:new URL('../src/workers/ingestion.js',import.meta.url).pathname,modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',durableObjects:{SOURCE_PUMPS:{className:'DatasetSourcePump',useSQLite:true}},bindings:{ENVIRONMENT_ID:'isolated-test',ACCOUNT_ID:ISOLATED_ACCOUNT_ID,INGEST_DATASET_5:JSON.stringify(entry)},serviceBindings:{CORE_COMMAND:'core'},outboundService:fetcher});
  await s.mf.setOptions(options);
  const ns=await s.mf.getDurableObjectNamespace('SOURCE_PUMPS','source-pump'),pump=ns.get(ns.idFromName('isolated-test/'+entry.authority.dataset_id));
  const a=await pump.fetch('https://pump/refresh',{method:'POST'});assert.equal(a.status,200,await a.clone().text());assert.equal((await a.json()).revision,1);
  const b=await pump.fetch('https://pump/refresh',{method:'POST'});assert.equal(b.status,200,await b.clone().text());assert.equal((await b.json()).revision,2);
  assert.equal((await pump.fetch('https://pump/refresh')).status,405);
  const wrong=ns.get(ns.idFromName('isolated-test/airport.bridge.pqc'));assert.equal((await wrong.fetch('https://pump/refresh',{method:'POST'})).status,503);
  assert.equal((await (await s.mf.getWorker('source-pump')).fetch('https://public/refresh',{method:'POST'})).status,404);
  assert.equal((await s.call('read',undefined,token)).body.state.revision,2);
 }finally{await s.mf.dispose();}
});

test('resuming after high logical slots follows committed slot rather than publication revision',async()=>{
 const {s,core,entry,fetcher}=await setupIngestion();
 try{
  const input=await ownedReference(entry.profile.producer,fetcher);const c=await buildContinuousCandidate(entry.profile,entry.authority,{...input,operator_principal_id:entry.actor_id,evaluation_time:new Date().toISOString(),candidate_id:'seed-high-slot',logical_slot:99});
  const call=async(path,body)=>{const r=await core.fetch('https://core/datasets/'+entry.authority.dataset_id+'/'+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json();};
  const prepared=await call('prepare',c);await call('commit',{...entry.authority,command_id:'high-slot-seed',digest:prepared.digest,expires_at:new Date(Date.now()+60000).toISOString()});
  const resumed=await ingestDataset(entry,core,fetcher);assert.equal(resumed.revision,2);const state=(await s.call('read',undefined,token)).body.state;assert.equal(state.active.logical_slot,100);
 }finally{await s.mf.dispose();}
});
