// Native local proof for ten owned producer snapshots. Test clocks and ephemeral capabilities only.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {openDomainRehearsal,domainRehearsalEvidence,domainRehearsalSchemaSamples} from './local/domain-rehearsal.js';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {domainLegacyView} from '../src/platform/domain-serving.js';
import {buildBackup} from '../src/preparation/recovery.js';
import {savePortableBackup,loadPortableBackup} from './preparation/portable-backup.js';

const out=path.resolve(process.argv[2]||'../domain-recovery-proof');await mkdir(out,{recursive:false});
const meta=JSON.parse(await readFile(new URL('../tests/data/domains/SOURCE_PINS.json',import.meta.url),'utf8'));
assert.equal(meta.fixture_only,false);const proofs=[],samples=[];
for(const domain of Object.keys(DOMAIN_DATASETS)){
 let s;try{
  const opened=await openDomainRehearsal(domain,meta);s=opened.s;
  const {raw_utf8,profile,c,committed,served,generation,envelope}=opened;
  s.principals.find(x=>x.id==='read').permissions=[];await s.mf.setOptions(s.options());
  const fallback=await (await (await s.mf.getWorker('runtime')).fetch('https://runtime/datasets/'+s.trust.dataset_id)).json();assert.equal(fallback.serving.fallback,true);assert.equal(fallback.serving.authority,'UNVERIFIED');assert.equal(fallback.serving.decision_eligibility,'ABSTAIN');
  await (await s.mf.getR2Bucket('CANONICAL','core')).put(committed.body.receipt.key,JSON.stringify({...generation,corrupt_test_only:true}));
  const damaged=await (await s.mf.getWorker('runtime')).fetch('https://runtime/datasets/'+s.trust.dataset_id);assert.equal(damaged.status,503);assert.equal((await damaged.json()).error,'GENERATION_HASH_INVALID');
  await (await s.mf.getR2Bucket('CANONICAL','core')).put(committed.body.receipt.key,JSON.stringify(generation));
  const returned=await (await (await s.mf.getWorker('runtime')).fetch('https://runtime/datasets/'+s.trust.dataset_id)).json();assert.equal(returned.serving.decision_eligibility,'ABSTAIN');
  const expiredOptions=s.options();expiredOptions.workers.find(w=>w.name==='runtime').scriptPath=fileURLToPath(new URL('../tests/domain-expired-runtime.js',import.meta.url));await s.mf.setOptions(expiredOptions);
  const expired=await (await s.mf.getWorker('runtime')).fetch('https://runtime/datasets/'+s.trust.dataset_id);assert.equal(expired.status,503);assert.equal((await expired.json()).error,'DISPLAY_EXPIRED');
  s.principals.find(x=>x.id==='read').permissions=['read'];await s.mf.setOptions(s.options());
  const state=(await s.call('read',undefined,'test-only-read')).body.state;
  const records=[{key:'control',kind:'CONTROL',content:{...s.trust,...state}},{key:committed.body.receipt.key,kind:'GENERATION',content:generation},{key:'signed-publication',kind:'RECEIPT',content:envelope},{key:'registry',kind:'REGISTRY',content:{profile}},{key:'audit',kind:'AUDIT',content:{status:'NOT_EXPORTED',authenticity_verified:false}},{key:'scheduler',kind:'SCHEDULER',content:{status:'NOT_CONFIGURED_LOCAL_REHEARSAL'}},{key:'deployment',kind:'DEPLOY',content:{kind:'LOCAL_MINIFLARE',production_deployment:false}}];
  const backup=await buildBackup({environment_id:'local-test',authority:s.trust,created_at:meta.evaluation_time,watermark:{revision:state.revision,control_revision:state.control_revision},records,required_keys:records.map(r=>r.key)});
  const directory=path.join(out,domain+'.portable');await savePortableBackup(backup,s.trust,directory);
  // Dispose the original native process before an independent filesystem readback.
  const trust=structuredClone(s.trust);await s.mf.dispose();s=null;
  const restored=await loadPortableBackup(directory,trust);assert.equal(restored.verification.publication_receipt_authenticity_verified,true);
  const recoveredGeneration=restored.bundle.entries.find(e=>e.kind==='GENERATION').content,recoveredEnvelope=restored.bundle.entries.find(e=>e.kind==='RECEIPT').content;
  assert.deepEqual(await domainLegacyView(recoveredGeneration,recoveredEnvelope,trust),JSON.parse(raw_utf8));
  const wrong=structuredClone(trust);wrong.receipt_keys={};await assert.rejects(loadPortableBackup(directory,wrong));
  const marker=await readFile(path.join(directory,'COMPLETE'),'utf8');await writeFile(path.join(directory,'COMPLETE'),'0'.repeat(64)+'\n');await assert.rejects(loadPortableBackup(directory,trust),/INCOMPLETE_OR_CORRUPT/);await writeFile(path.join(directory,'COMPLETE'),marker);
  await writeFile(path.join(out,domain+'.public-trust.json'),JSON.stringify(trust,null,2)+'\n');
  await writeFile(path.join(out,domain+'.projection.json'),JSON.stringify(served.data,null,2)+'\n');
  await writeFile(path.join(out,domain+'.serving.json'),JSON.stringify(served.serving,null,2)+'\n');
  proofs.push({...domainRehearsalEvidence(opened,meta),status:'PASS_NATIVE_PORTABLE_PUBLICATION_READBACK',portable_readback_after_native_disposal:true,native_outage_signed_fallback_abstain:true,native_corrupt_generation_denied_then_original_restored:true,native_expiry_denied_during_control_outage:true,wrong_trust_and_corrupt_marker_denied:true,offsite_proven:false,control_authenticity_verified:false,audit_authenticity_verified:false,writer_resumed:false});
  samples.push(...domainRehearsalSchemaSamples(opened));
 }finally{if(s)await s.mf.dispose();}
}
const summary={status:'PASS_TEN_NATIVE_PORTABLE_PUBLICATION_READBACKS',domains:['Weather','Airport','Transit','Near Me'],snapshot_count:proofs.length,proofs,source_health_claim:'CAPTURED_SNAPSHOT_SCOPE_ONLY',clock:'CAPTURED_REPLAY_NOT_CURRENT_WALL_CLOCK',production_enabled:false,producer_independent:false,source_policies_activated:false,operational_action_allowed:false,remote_writes:0};
await writeFile(path.join(out,'NATIVE_RECOVERY_PROOF.json'),JSON.stringify(summary,null,2)+'\n');await writeFile(path.join(out,'SCHEMA_SAMPLES.json'),JSON.stringify(samples,null,2)+'\n');console.log(JSON.stringify({status:summary.status,snapshots:proofs.length,candidate_bytes:proofs.map(p=>({domain:p.domain,bytes:p.candidate_bytes})),production_enabled:false},null,2));
