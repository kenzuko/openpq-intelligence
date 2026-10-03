import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './support.js';
import {ingestDataset,ownedReference} from '../src/ingress/domain-feed.js';
import {CONTINUOUS_PROFILE_VERSION,continuousArtifactRefs} from '../src/platform/domain-continuous-admission.js';
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
 const requests=[],sha='a'.repeat(40),raw='{"version":"fixture"}\n';
 const result=await ownedReference({source_kind:'OWNER_REPOSITORY_SNAPSHOT',repository:'kenzuko/transit-jotrip',path:'data/network.json'},async(url,options)=>{requests.push(url);assert.equal(options.redirect,'error');return new Response(url.includes('api.github.com')?JSON.stringify({sha}):raw);});
 assert.equal(requests.length,2);assert.equal(requests[1],'https://raw.githubusercontent.com/kenzuko/transit-jotrip/'+sha+'/data/network.json');assert.equal(result.raw_utf8,raw);assert.match(result.pin.git_blob_sha,/^[a-f0-9]{40}$/);
});
