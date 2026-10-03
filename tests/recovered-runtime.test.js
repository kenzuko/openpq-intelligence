import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Miniflare,createFetchMock} from 'miniflare';
import {hash} from '../src/platform/contracts.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {packConfig,TRUST_BINDINGS,RECOVERED_REFERENCE_BINDINGS} from '../src/platform/trusted-config.js';
import {recoveredReferenceView} from '../src/platform/recovered-reference.js';
const source=fileURLToPath(new URL('../evidence/core2-domain-frozen-cloud-20261003/success-37134123700/cloud-recovery.zip',import.meta.url));
async function fixtures(){
 const dir=await mkdtemp(path.join(tmpdir(),'openpq-recovered-runtime-'));
 const extraction=spawnSync('python',['-c','import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',source,dir]);assert.equal(extraction.status,0);
 const rows=[];
 for(const [domain,dataset_id] of Object.entries(DOMAIN_DATASETS)){
  const read=async name=>JSON.parse(await readFile(`${dir}/${domain}/${name}.json`,'utf8'));
  const trust=await read('TARGET_TRUST'),snapshot=await read('TARGET_SNAPSHOT'),bundle=await read('BUNDLE'),config={plan:await read('RECOVERY_PLAN'),target_snapshot_key:`recovery/snapshots/verified-target-${domain}.json`,target_snapshot_digest:await hash(snapshot)};
  rows.push({domain,dataset_id,trust,snapshot,bundle,config});
 }
 return {dir,rows};
}
test('native Runtime serves all ten cloud-signed frozen archives using GET-only storage with no reachable Core',async()=>{
 const {dir,rows}=await fixtures(),mock=createFetchMock();mock.disableNetConnect();let coreCalls=0,mf;
 try{
  const host=mock.get('https://test-account.r2.cloudflarestorage.com');
  for(const row of rows)for(const [key,value] of [[row.config.target_snapshot_key,row.snapshot],[row.config.plan.domain_archive.key,row.bundle]])host.intercept({path:'/isolated-test/'+key,method:'GET'}).reply(200,JSON.stringify(value)).persist();
  const trust=Object.fromEntries(rows.map(r=>[r.dataset_id,r.trust])),config=Object.fromEntries(rows.map(r=>[r.dataset_id,r.config]));
  mf=new Miniflare({cf:false,modules:true,scriptPath:fileURLToPath(new URL('../src/workers/runtime.js',import.meta.url)),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',fetchMock:mock,bindings:{ENVIRONMENT_ID:'isolated-test',...packConfig(trust,TRUST_BINDINGS),...packConfig(config,RECOVERED_REFERENCE_BINDINGS),S3_READONLY_CONFIG:JSON.stringify({endpoint:'https://test-account.r2.cloudflarestorage.com',bucket:'isolated-test',access_key:'fixture',secret:'fixture-read-only'})},serviceBindings:{CORE_READ:async()=>{coreCalls++;return new Response(null,{status:503});}}});
  for(const row of rows){
   const response=await mf.dispatchFetch(`https://runtime/datasets/${row.dataset_id}/recovered-reference`);assert.equal(response.status,200,await response.clone().text());
   const value=await response.json();assert.equal(value.serving.authority,'VERIFIED_FROZEN_ARCHIVE');assert.equal(value.serving.decision_eligibility,'ABSTAIN');assert.equal(value.serving.display_lease_expired,true);assert.equal(value.live_serving_restored,false);assert.equal(value.writer_resume_allowed,false);
   assert.equal(await hash(value.source_payload),await hash((await recoveredReferenceView(row.snapshot,row.bundle,row.config,row.trust,new Date().toISOString())).source_payload));
   assert.equal(value.serving.source_version_time,row.bundle.publication.receipt.semantic_admission.source_version_time);assert.equal(response.headers.get('cache-control'),'no-store');
  }
  assert.equal(coreCalls,0);
  assert.equal((await mf.dispatchFetch(`https://runtime/datasets/${rows[0].dataset_id}/recovered-reference`,{method:'POST'})).status,405);
  assert.equal((await mf.dispatchFetch('https://runtime/datasets/unregistered/recovered-reference')).status,422);
 }finally{if(mf)await mf.dispose();await mock.close();await rm(dir,{recursive:true,force:true});}
});
test('recovered Runtime denies missing pins, source/target substitution, changed signed control and archive tampering',async()=>{
 const {dir,rows}=await fixtures();try{
  const r=rows[0],at=new Date().toISOString();
  await assert.rejects(recoveredReferenceView(r.snapshot,r.bundle,null,r.trust,at),/RECOVERED_REFERENCE_CONFIG_REQUIRED/);
  const bad=structuredClone(r.config);bad.target_snapshot_digest='0'.repeat(64);await assert.rejects(recoveredReferenceView(r.snapshot,r.bundle,bad,r.trust,at),/RECOVERED_REFERENCE_SNAPSHOT_PIN_INVALID/);
  const changed=structuredClone(r.snapshot);changed.envelope.receipt.control.frozen=false;const repinned={...r.config,target_snapshot_digest:await hash(changed)};await assert.rejects(recoveredReferenceView(changed,r.bundle,repinned,r.trust,at),/CHECKPOINT_SIGNATURE_INVALID/);
  await assert.rejects(recoveredReferenceView(rows[1].snapshot,r.bundle,r.config,r.trust,at),/RECOVERED_REFERENCE_SNAPSHOT_PIN_INVALID/);
  const trust=structuredClone(r.trust);trust.approved_positive_decision_types=['unsafe'];await assert.rejects(recoveredReferenceView(r.snapshot,r.bundle,r.config,trust,at),/RECOVERED_REFERENCE_TARGET_TRUST_INVALID/);
  const bundle=structuredClone(r.bundle);bundle.artifact_documents.policy.source_policies_activated=true;await assert.rejects(recoveredReferenceView(r.snapshot,bundle,r.config,r.trust,at),/RECOVERY_ARCHIVE_ANCHOR_MISMATCH/);
  const sameKey=structuredClone(r.config);sameKey.target_snapshot_key=sameKey.plan.snapshot_key;await assert.rejects(recoveredReferenceView(r.snapshot,r.bundle,sameKey,r.trust,at),/RECOVERED_REFERENCE_TARGET_KEY_INVALID/);
  await assert.rejects(recoveredReferenceView(r.snapshot,r.bundle,r.config,r.trust,'2026-01-01T00:00:00Z'),/RECOVERED_REFERENCE_SNAPSHOT_IN_FUTURE/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
