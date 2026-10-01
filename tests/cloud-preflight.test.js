import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudPreflight,BUCKET,WORKERS} from '../scripts/cloud/preflight.js';
const account='a'.repeat(32),prod='b'.repeat(32),deploy='c'.repeat(32),read='d'.repeat(32);
const params={accountId:account,productionAccountIds:[prod],apiToken:'synthetic-preflight-token',readAccessKey:read};
const fixture=()=>({
  '/tokens/verify':{id:deploy,status:'active'},
  ['/tokens/'+deploy]:{id:deploy,status:'active',policies:[{effect:'allow',resources:{['com.cloudflare.api.account.'+account]:'*'},permission_groups:[{id:'fixture-worker',name:'Workers Admin'},{id:'fixture-inspect',name:'Account API Tokens Read'}]}]},
  ['/tokens/'+read]:{id:read,status:'active',policies:[{effect:'allow',resources:{[`com.cloudflare.edge.r2.bucket.${account}_default_${BUCKET}`]:'*'},permission_groups:[{id:'fixture-read',name:'Workers R2 Storage Bucket Item Read'}]}]},
  '/workers/scripts':[],
  '/r2/buckets':{buckets:[{name:BUCKET}]},
  '/workers/durable_objects/namespaces':[]
});
const fake=(data,calls=[])=>async(url,opts)=>{calls.push({url,method:opts.method});const key=new URL(url).pathname.slice(('/client/v4/accounts/'+account).length);return Response.json({success:true,result:data[key]});};
test('cloud preflight checks actual token policies/resources with GET only',async()=>{
  const calls=[],e=await cloudPreflight(params,fake(fixture(),calls));assert.equal(e.status,'PREFLIGHT_PASS');assert.equal(e.cloud_gate,'NOT_PASSED');assert.ok(calls.every(c=>c.method==='GET'&&c.url.includes('/accounts/'+account+'/')));assert.ok(!JSON.stringify(e).includes(params.apiToken));
});
test('missing production inventory and production test-account ID block before API access',async()=>{
  const forbidden=async()=>{throw new Error('must not fetch');};
  await assert.rejects(cloudPreflight({...params,productionAccountIds:[]},forbidden),/PRODUCTION_ACCOUNT_INVENTORY_REQUIRED/);
  await assert.rejects(cloudPreflight({...params,accountId:prod},forbidden),/PRODUCTION_ACCOUNT_FORBIDDEN/);
});
test('global account permission or unexpected token capability blocks before inventory',async()=>{
  for(const mutate of [d=>d['/tokens/'+deploy].policies[0].resources={'com.cloudflare.api.account.*':'*'},d=>d['/tokens/'+deploy].policies[0].permission_groups.push({name:'Account API Tokens Write'})]){
    const d=fixture();mutate(d);const calls=[];await assert.rejects(cloudPreflight(params,fake(d,calls)),/TOKEN_SCOPE_TOO_BROAD|TOKEN_PERMISSION_TOO_BROAD/);assert.ok(!calls.some(c=>c.url.includes('/workers/scripts')));
  }
});
test('runtime R2 credential with write/admin/wrong bucket scope is rejected',async()=>{
  for(const mutate of [d=>d['/tokens/'+read].policies[0].permission_groups[0].name='Workers R2 Storage Bucket Item Write',d=>d['/tokens/'+read].policies[0].resources={['com.cloudflare.api.account.'+account]:'*'},d=>d['/tokens/'+read].policies[0].resources={[`com.cloudflare.edge.r2.bucket.${account}_default_production`]:'*'}]){
    const d=fixture();mutate(d);await assert.rejects(cloudPreflight(params,fake(d)),/TOKEN_SCOPE_TOO_BROAD|TOKEN_PERMISSION_TOO_BROAD/);
  }
});
test('account with unexpected Worker or bucket is rejected',async()=>{
  let d=fixture();d['/workers/scripts']=[{id:'production-weather'}];await assert.rejects(cloudPreflight(params,fake(d)),/TEST_ACCOUNT_HAS_OTHER_WORKERS/);
  d=fixture();d['/r2/buckets'].buckets.push({name:'production'});await assert.rejects(cloudPreflight(params,fake(d)),/TEST_ACCOUNT_BUCKETS_NOT_ISOLATED/);
});
test('unknown/truncated inventory is blocked; allowed prior test namespace is recorded',async()=>{
  let d=fixture();d['/r2/buckets'].cursor='more';await assert.rejects(cloudPreflight(params,fake(d)),/BUCKET_INVENTORY_INCOMPLETE/);
  d=fixture();d['/workers/durable_objects/namespaces']=[{id:'fixture-namespace',script:WORKERS[0],class:'DatasetCoordinator'}];const e=await cloudPreflight(params,fake(d));assert.equal(e.namespaces.length,1);
});
