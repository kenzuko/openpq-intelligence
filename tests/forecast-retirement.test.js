import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './support.js';
import {hash} from '../src/platform/contracts.js';
import {packDomainText} from '../src/platform/domain-codec.js';
import {isExpiredForecastRetirement} from '../src/platform/forecast-retirement.js';
import {mainCommitFromAdvertisement} from '../src/ingress/git-ref.js';
import {continuousArtifactRefs,CONTINUOUS_PROFILE_VERSION,buildContinuousCandidate} from '../src/platform/domain-continuous-admission.js';
import {ISOLATED_ACCOUNT_ID} from '../src/platform/domain-bridge-admission.js';
import {DOMAIN_RUNTIME_URLS} from '../src/ingress/domain-source-common.js';
import {ingestDataset} from '../src/ingress/domain-feed.js';
const wrap=async raw=>({payload:{domain_snapshot:{domain:'weather_forecast'}},semantic_profile_hash:'same',semantic_admission:{source_version_time:'same'},semantic_bundle:{encoded_source:await packDomainText(JSON.stringify(raw))}});
test('forecast retirement preserves every retained value and rejects additions, mutations, reordering and removal of live frames',async()=>{
 const at=Date.now(),old={generated_at:'unchanged',spatial:{frames:[{valid_time:new Date(at-1000).toISOString(),value:1},{valid_time:new Date(at+1000).toISOString(),value:2},{valid_time:new Date(at+2000).toISOString(),value:3}]}};
 const next=structuredClone(old);next.spatial.frames.shift();const a=await wrap(old);
 assert.equal(await isExpiredForecastRetirement(a,await wrap(next),at),true);
 const variants=[structuredClone(next),structuredClone(next),structuredClone(next),structuredClone(next)];
 variants[0].spatial.frames[0].value=9;variants[1].spatial.frames.shift();variants[2].spatial.frames.reverse();variants[3].generated_at='changed';
 for(const v of variants)assert.equal(await isExpiredForecastRetirement(a,await wrap(v),at),false);
 assert.equal(await isExpiredForecastRetirement(a,await wrap(old),at),false);
});
test('Git ref discovery rejects duplicate main refs, truncation, malformed packets and tag lookalikes',()=>{
 const pkt=s=>(s.length+4).toString(16).padStart(4,'0')+s,head=pkt('# service=git-upload-pack\n')+'0000',main=pkt('a'.repeat(40)+' refs/heads/main\n');
 assert.equal(mainCommitFromAdvertisement(head+main+'0000'),'a'.repeat(40));
 for(const v of [head+main+main+'0000',head+main.slice(0,-1),head+pkt('a'.repeat(40)+' refs/tags/main\n')+'0000','ffffshort'])assert.throws(()=>mainCommitFromAdvertisement(v));
});
test('native authority admits only expired forecast retirement at the same cycle and atomically rejects value collisions',async()=>{
 const raw=JSON.parse(await readFile(new URL('./data/domains/weather_forecast.json',import.meta.url),'utf8'));
 const run=Math.floor(Date.now()/3600000)*3600000-12*3600000;
 raw.generated_at=new Date(Date.now()-1000).toISOString();raw.run_time=raw.medium_run_time=raw.spatial.short_run_time=new Date(run).toISOString();
 for(const f of raw.spatial.frames){f.valid_time=new Date(run+f.lead_hours*3600000).toISOString();for(const c of f.cells)c.valid_time=f.valid_time;}
 const p={contract_version:CONTINUOUS_PROFILE_VERSION,environment_id:'isolated-test',dataset_id:'weather.forecast.bridge.phu-quoc',domain:'weather_forecast',fixture_only:false,producer:{source_kind:'OWNER_PUBLIC_RUNTIME',url:DOMAIN_RUNTIME_URLS.weather_forecast},operator_principal_ids:['operator'],reference_policy:{lease_ms:300000,max_snapshot_age_ms:86400000,future_skew_ms:0},artifact_refs:{}};p.artifact_refs=await continuousArtifactRefs(p);
 const s=await setup({semanticProfile:p,dataset_id:p.dataset_id,environment_id:'isolated-test',account_id:ISOLATED_ACCOUNT_ID,domainOperator:true});
 const operatorToken='test-only-operator'.padEnd(40,'x');s.principals.find(x=>x.id==='operator').token=operatorToken;s.principals.find(x=>x.id==='operator').permissions.push('read');await s.mf.setOptions(s.options());
 const commit=async(data,id,revision)=>{const raw_utf8=JSON.stringify(data),pin={source_kind:'OWNER_PUBLIC_RUNTIME',source_pointer:{url:p.producer.url},payload_sha256:await hash(raw_utf8),git_blob_sha:null};const c=await buildContinuousCandidate(p,s.trust,{raw_utf8,pin,operator_principal_id:'operator',evaluation_time:new Date().toISOString(),candidate_id:id,expected_revision:revision,logical_slot:99+revision});const prepared=await s.call('prepare',c,operatorToken);assert.equal(prepared.status,200);return s.call('commit',{...s.trust,command_id:id,digest:prepared.body.digest,expires_at:c.valid_to},operatorToken);};
 try{
  assert.equal((await commit(raw,'first',0)).status,200);
  const pruned=structuredClone(raw);pruned.spatial.frames.shift();const ingested=await ingestDataset({authority:s.trust,profile:p,actor_id:'operator',token:operatorToken},await s.mf.getWorker('test-client'),async()=>new Response(JSON.stringify(pruned)));assert.equal(ingested.revision,2);
  const changed=structuredClone(pruned);changed.spatial.frames[0].cells[0].temperature_c+=1;const denied=await commit(changed,'collision',2);assert.equal(denied.status,409);assert.equal(denied.body.error,'CONTINUOUS_SOURCE_REGRESSION');
  assert.equal((await s.call('read',undefined,'test-only-read')).body.state.revision,2);
  const liveRemoved=structuredClone(pruned);liveRemoved.spatial.frames.pop();assert.equal((await commit(liveRemoved,'live-removed',2)).status,409);
  assert.equal((await commit(pruned,'renew',2)).status,200);
 }finally{await s.mf.dispose();}
});
