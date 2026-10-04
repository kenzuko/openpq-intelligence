import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './support.js';
import {hash} from '../src/platform/contracts.js';
import {continuousArtifactRefs,validateContinuousProfile,buildContinuousCandidate} from '../src/platform/domain-continuous-admission.js';
import {DIRECTORY_FACT_PROFILE_VERSION} from '../src/platform/domain-continuous-contract.js';
import {DIRECTORY_FACT_ENVIRONMENT,DIRECTORY_FACT_ACCOUNT,DIRECTORY_FACT_GATE,DIRECTORY_FACT_DATASET,DIRECTORY_SOURCE_URLS} from '../src/platform/directory-execution-contract.js';
import {executionEnvironment,executionDataset} from '../src/platform/transit-execution-scope.js';
import {ownedDirectoryPublication} from '../src/ingress/directory-feed.js';
import {readDirectoryConsumer,DIRECTORY_CANONICAL_ORIGIN} from '../src/platform/directory-consumer.js';
import {directoryLegacyReference} from '../src/platform/directory-serving.js';
const AT='2026-10-03T01:12:00.000Z',PUBLICATION='a'.repeat(40),gate={ACCOUNT_ID:DIRECTORY_FACT_ACCOUNT,CANONICAL_DIRECTORY_GATE:DIRECTORY_FACT_GATE};
async function profile(){const p={contract_version:DIRECTORY_FACT_PROFILE_VERSION,environment_id:DIRECTORY_FACT_ENVIRONMENT,dataset_id:DIRECTORY_FACT_DATASET,domain:'nearme',fixture_only:false,producer:{source_kind:'OWNER_PUBLIC_RUNTIME',url:DIRECTORY_SOURCE_URLS.index},operator_principal_ids:['operator'],reference_policy:{lease_ms:300000,max_snapshot_age_ms:31*86400000,future_skew_ms:0},artifact_refs:{}};p.artifact_refs=await continuousArtifactRefs(p);return p;}
async function source(){const result={};for(const [name,file] of Object.entries({index:'nearme',support:'nearme_support',venues:'nearme_venues'})){const raw_utf8=await readFile(new URL('./data/domains/'+file+'.json',import.meta.url),'utf8');result[name]={raw_utf8,pin:{source_kind:'OWNER_PUBLIC_RUNTIME',source_pointer:{url:DIRECTORY_SOURCE_URLS[name]},payload_sha256:await hash(raw_utf8),git_blob_sha:null}};}return {...result.index,publication_id:PUBLICATION,companions:{support:result.support,venues:result.venues}};}
test('Directory scope is exact account/dataset/producer; other domains, consumer URLs and positive grants remain denied',async()=>{
 const p=await profile(),t={environment_id:p.environment_id,account_id:DIRECTORY_FACT_ACCOUNT,dataset_id:p.dataset_id,semantic_profile_hash:await hash(p),approved_positive_decision_types:[],artifacts:Object.fromEntries(Object.entries(p.artifact_refs).map(([k,v])=>[k,v.hash]))};
 await validateContinuousProfile(p,t);executionDataset({ENVIRONMENT_ID:p.environment_id,...gate},t);
 for(const e of [{ENVIRONMENT_ID:'production'},{ENVIRONMENT_ID:p.environment_id},{ENVIRONMENT_ID:p.environment_id,...gate,ACCOUNT_ID:'c61a28455fe22f30619b35dd80c2d495'}])assert.throws(()=>executionEnvironment(e),/PRODUCTION_GATE_CLOSED/);
 for(const x of [{dataset_id:'weather.bridge.phu-quoc'},{approved_positive_decision_types:['open']},{account_id:'c61a28455fe22f30619b35dd80c2d495'}])assert.throws(()=>executionDataset({ENVIRONMENT_ID:p.environment_id,...gate},{...t,...x}),/DIRECTORY_FACT_EXECUTION_SCOPE_DENIED/);
 for(const url of ['https://openphuquoc.com/data/views/location-index.json',DIRECTORY_SOURCE_URLS.venues])await assert.rejects(validateContinuousProfile({...p,producer:{...p.producer,url}},t),/DIRECTORY_FACT_PROFILE_SCOPE_DENIED/);
});
test('source capture rejects mixed CMS publication frames and retains all original bytes',async()=>{
 const s=await source(),items={index:s,support:s.companions.support,venues:s.companions.venues};
 const fetcher=mixed=>async url=>{const name=Object.keys(DIRECTORY_SOURCE_URLS).find(x=>DIRECTORY_SOURCE_URLS[x]===url);assert.ok(name);return new Response(items[name].raw_utf8,{headers:{'content-type':'application/json','x-openpq-publication-id':mixed&&name==='venues'?'b'.repeat(40):PUBLICATION}});};
 const got=await ownedDirectoryPublication(fetcher(false));assert.equal(got.raw_utf8,s.raw_utf8);assert.equal(got.companions.support.raw_utf8,s.companions.support.raw_utf8);assert.equal(got.companions.venues.raw_utf8,s.companions.venues.raw_utf8);await assert.rejects(ownedDirectoryPublication(fetcher(true)),/DIRECTORY_MIXED_PUBLICATION_DENIED/);
});
test('native captured Directory publication is one authority with signed three-file readback, no live opening or positive decision',async()=>{
 const p=await profile(),s=await setup({semanticProfile:p,dataset_id:p.dataset_id,environment_id:p.environment_id,account_id:DIRECTORY_FACT_ACCOUNT,domainOperator:true,domainReplayClock:true,executionBindings:gate});
 try{
  const input=await source(),c=await buildContinuousCandidate(p,s.trust,{...input,operator_principal_id:'operator',evaluation_time:AT,candidate_id:'directory-captured-publication',logical_slot:1});
  assert.equal(c.decision.effect,'ABSTAIN');assert.equal(c.semantic_admission.source_policies_activated,false);assert.equal(c.semantic_admission.publication_id,PUBLICATION);
  await assert.rejects(buildContinuousCandidate(p,s.trust,{...input,companions:{support:input.companions.support},operator_principal_id:'operator',evaluation_time:AT,candidate_id:'incomplete'}),/DIRECTORY_COMPANION_REQUIRED/);
  const bad=structuredClone(c);bad.decision.effect='POSITIVE';bad.decision.minimum_evidence_met=true;assert.notEqual((await s.call('prepare',bad,'test-only-operator')).status,200);
  const prepared=await s.call('prepare',c,'test-only-operator');assert.equal(prepared.status,200,JSON.stringify(prepared));
  const commit=await s.call('commit',{...s.trust,command_id:'directory-captured-commit',digest:prepared.body.digest,expires_at:c.valid_to},'test-only-operator');assert.equal(commit.status,200,JSON.stringify(commit));assert.equal((await s.call('export',{},'test-only-operator')).status,200);
  const bucket=await s.mf.getR2Bucket('CANONICAL','core'),receipt=commit.body.receipt,generation=JSON.parse(await (await bucket.get(receipt.key)).text()),envelope=JSON.parse(await (await bucket.get('checkpoints/'+s.trust.authority_instance_id+'/'+s.trust.recovery_generation+'/receipts/1.json')).text());
  for(const [name,item] of Object.entries({index:input,support:input.companions.support,venues:input.companions.venues})){const view=await directoryLegacyReference(generation,envelope,s.trust,name);assert.equal(view.raw,item.raw_utf8);assert.equal(view.source_digest,item.pin.payload_sha256);assert.equal(view.publication_id,PUBLICATION);assert.equal(view.source_set_hash,c.semantic_admission.source_set_hash);}
  const response=()=>Response.json({contract:'openpq-directory-signed-publication-v1',generation,envelope,serving:{authority:'VERIFIED',fallback:false}},{headers:{'cache-control':'no-store','x-openpq-receipt-digest':receipt.digest,'x-openpq-source-set-hash':c.semantic_admission.source_set_hash,'x-openpq-publication-id':PUBLICATION,'x-openpq-display-expires-at':c.valid_to}});
  let calls=0;const config={mode:'CANONICAL',origin:DIRECTORY_CANONICAL_ORIGIN,trust:s.trust};
  const fetcher=async url=>{calls++;assert.equal(url,DIRECTORY_CANONICAL_ORIGIN+'/datasets/'+p.dataset_id+'/signed-publication');return response();};
  const publication=await readDirectoryConsumer(config,{fetcher,clock:()=>Date.parse(AT)});assert.equal(publication.raws.index,input.raw_utf8);assert.equal(publication.raws.support,input.companions.support.raw_utf8);assert.equal(publication.raws.venues,input.companions.venues.raw_utf8);assert.equal(calls,1);
  await assert.rejects(readDirectoryConsumer(config,{fetcher,clock:()=>Date.parse(c.valid_to)}),/DIRECTORY_CONSUMER_EXPIRED/);
  await assert.rejects(readDirectoryConsumer(config,{clock:()=>Date.parse(AT),fetcher:async()=>{const r=response(),headers=new Headers(r.headers);headers.set('x-openpq-source-set-hash','f'.repeat(64));return new Response(await r.text(),{headers});}}),/DIRECTORY_CONSUMER_PUBLICATION_CHANGED_OR_TAMPERED/);
  assert.equal(receipt.epoch,1);assert.equal((await s.call('read',undefined,'test-only-read')).body.state.control_revision,0);
 }finally{await s.mf.dispose();}
});
