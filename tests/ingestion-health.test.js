import test from 'node:test';
import assert from 'node:assert/strict';
import {captureIngestionHealth} from '../scripts/cloud/ingestion-health.js';
test('feed monitor distinguishes reference validity from source/production readiness and fails closed',async()=>{
 const now=Date.now();
 const response=(url,extra={})=>new Response(JSON.stringify({receipt:{dataset_id:url.split('/').at(-1),environment_id:'isolated-test',revision:4,semantic_admission:{source_policies_activated:false,producer_independence:false,valid_until:new Date(now+60000).toISOString()}},serving:{authority:'VERIFIED',decision_eligibility:'ABSTAIN'},decision:{effect:'ABSTAIN'},...extra}));
 const good=await captureIngestionHealth(async(url,options)=>{assert.equal(options.redirect,'error');return response(url);},now);assert.equal(good.datasets.length,10);assert.ok(good.datasets.every(x=>x.healthy));assert.equal(good.whole_brain_production_ready,false);assert.equal(good.continuous_uptime_proven,false);
 const bad=await captureIngestionHealth(async url=>response(url,{serving:{authority:'UNVERIFIED',decision_eligibility:'ABSTAIN'}}),now);assert.ok(bad.datasets.every(x=>!x.healthy));
 const expired=await captureIngestionHealth(async()=>new Response('{"error":"DISPLAY_EXPIRED"}',{status:503}),now);assert.ok(expired.datasets.every(x=>!x.healthy&&x.error==='DISPLAY_EXPIRED'));
});
