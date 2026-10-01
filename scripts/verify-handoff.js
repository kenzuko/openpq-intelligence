import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {stable} from '../src/platform/contracts.js';
const dir='docs/reference/v2.1';const manifest=JSON.parse(await readFile(dir+'/MANIFEST.json','utf8'));
for(const entry of manifest.files){const bytes=await readFile(dir+'/'+entry.path);assert.equal(bytes.length,entry.bytes,entry.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path);}
console.log('PASS: '+manifest.files.length+' immutable handoff files, including original V2 ZIP');

for(const runId of [36847033329,36848850809]){
  const evidenceDir='docs/evidence/cloud-'+runId;
  const snapshot=JSON.parse(await readFile(evidenceDir+'/SNAPSHOT.json','utf8'));
  for(const [path,digest] of Object.entries(snapshot.files_sha256)){
    assert.ok(['preflight.json','locator.public.json','cloud-evidence.json'].includes(path));
    assert.equal(createHash('sha256').update(await readFile(evidenceDir+'/'+path)).digest('hex'),digest,path);
  }
  const evidence=JSON.parse(await readFile(evidenceDir+'/cloud-evidence.json','utf8'));
  assert.equal(evidence.code_sha,snapshot.code_sha);assert.equal(evidence.status,'CLOUD_PROTOCOL_SUBSET_PASS');
  assert.equal(evidence.g1,'NOT_PASSED');assert.equal(evidence.cases.length,snapshot.case_count||12);assert.ok(evidence.cases.every(item=>item.status==='PASS'));
  console.log('PASS: pinned cloud evidence snapshot '+runId+', '+evidence.cases.length+' subset cases; full G1 still incomplete');
}

{
  const evidenceDir='docs/evidence/r2-revocation-36856013892';
  const snapshot=JSON.parse(await readFile(evidenceDir+'/SNAPSHOT.json','utf8'));
  assert.equal(snapshot.status,'R2_REVOCATION_SUBSET_PASS');assert.equal(snapshot.g1,'NOT_PASSED');
  for(const entry of snapshot.files){
    assert.ok(['baseline.json','failed-deny.json','deny.json'].includes(entry.file));
    assert.equal(createHash('sha256').update(await readFile(evidenceDir+'/'+entry.file)).digest('hex'),entry.sha256,entry.file);
  }
  const baseline=JSON.parse(await readFile(evidenceDir+'/baseline.json','utf8'));
  const denial=JSON.parse(await readFile(evidenceDir+'/deny.json','utf8'));
  assert.equal(baseline.status,'BASELINE_PASS');assert.equal(denial.status,'R2_DENIAL_OBSERVED');
  assert.equal(denial.baseline_run_id,baseline.run_id);assert.equal(denial.control_plane_revocation_confirmed,true);
  assert.equal(baseline.http_status,200);assert.equal(denial.http_status,401);assert.equal(denial.witness_status,200);
  for(const key of ['account_id','bucket','credential_fingerprint','key','digest','g1'])assert.equal(denial[key],baseline[key],key);
  assert.equal(denial.g1,'NOT_PASSED');
  console.log('PASS: pinned R2 read-credential revocation subset, actual HTTP 401 with independent HTTP 200 witness');
}

{
  const evidenceDir='docs/evidence/semantic-fixture-v1';
  const snapshot=JSON.parse(await readFile(evidenceDir+'/SNAPSHOT.json','utf8'));
  for(const [path,digest] of Object.entries(snapshot.files_sha256)){
    assert.ok(['corpus.json','replay.json'].includes(path));
    assert.equal(createHash('sha256').update(await readFile(evidenceDir+'/'+path)).digest('hex'),digest,path);
  }
  const report=JSON.parse(await readFile(evidenceDir+'/replay.json','utf8'));
  const corpus=JSON.parse(await readFile(evidenceDir+'/corpus.json','utf8'));
  assert.equal(corpus.fixture_only,true);assert.equal(report.status,'SYNTHETIC_SEMANTIC_SUBSET_PASS');
  assert.equal(report.g1,'NOT_PASSED');assert.equal(report.g2,'NOT_PASSED');
  assert.equal(report.cases.length,snapshot.case_count);assert.ok(report.cases.every(item=>item.status==='PASS'));
  console.log('PASS: pinned synthetic semantic corpus/replay snapshot; live gates remain closed');
}

{
  const source=JSON.parse(await readFile('docs/evidence/manual-cano-intake-20261001/SOURCE_SNAPSHOT.json','utf8'));
  assert.equal(source.read_only,true);assert.equal(source.legacy_write_performed,false);
  for(const entry of source.files){
    assert.match(entry.path,/^fixtures\/manual-cano-source\/2026-(?:10-01|09-30|09-27)-cano-an-thoi\.json$/);
    const bytes=await readFile(entry.path);assert.equal(bytes.length,entry.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
    assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),entry.git_blob_sha);
  }
  console.log('PASS: pinned owned manual source bytes match original Git blobs; no legacy writes');
}

{
  const dir='docs/evidence/manual-cano-cloud-36863045164';
  const snapshot=JSON.parse(await readFile(dir+'/SNAPSHOT.json','utf8'));
  for(const attempt of snapshot.attempts){
    assert.ok([1,2].includes(attempt.attempt));
    for(const [path,digest] of Object.entries(attempt.files_sha256)){
      assert.ok(['preflight.json','source.public.json','staging-evidence.public.json','closed-evidence.public.json'].includes(path));
      assert.equal(createHash('sha256').update(await readFile(dir+'/attempt-'+attempt.attempt+'/'+path)).digest('hex'),digest,path);
    }
  }
  const report=JSON.parse(await readFile(dir+'/attempt-2/staging-evidence.public.json','utf8'));
  const closed=JSON.parse(await readFile(dir+'/attempt-2/closed-evidence.public.json','utf8'));
  assert.equal(report.status,'ISOLATED_MANUAL_STAGING_SUBSET_PASS');assert.equal(report.code_sha,snapshot.code_sha);
  assert.equal(report.mode,'SHADOW');assert.equal(report.publication_admitted,false);assert.equal(report.g1,'NOT_PASSED');assert.equal(report.g2,'NOT_PASSED');
  assert.equal(report.cases.length,7);assert.ok(report.cases.every(item=>item.status==='PASS'));
  assert.equal(report.history.length,2);assert.ok(report.history.every(item=>item.status==='QUARANTINED'&&item.reason_codes.includes('MANUAL_AUTHOR_NOT_EXPLICIT')));
  const local=JSON.parse(await readFile('docs/evidence/manual-cano-intake-20261001/local-normalization.json','utf8'));
  for(const item of local.records){
    const cloud=item.record.scope.operational_day==='2026-10-01'?report:report.history.find(entry=>entry.source_day===item.record.scope.operational_day);
    assert.equal(cloud.record_digest,item.record.record_digest);assert.equal(cloud.source_time,item.record.source_time);
    assert.equal(cloud.stored_sha256,createHash('sha256').update(stable(item.record)).digest('hex'));
  }
  assert.equal(closed.status,'STAGING_CAPABILITY_DENIAL_OBSERVED');assert.equal(closed.http_status,401);
  console.log('PASS: actual three-record manual data transport and observed temporary capability closure; admission closed');
}

{
 const dir='docs/evidence/technical-preparation-local-20261001';
 const snapshot=JSON.parse(await readFile(dir+'/SNAPSHOT.json','utf8'));
 assert.equal(snapshot.status,'LOCAL_TECHNICAL_PREPARATION_PASS');assert.equal(snapshot.input_kind,'SYNTHETIC_ONLY');assert.equal(snapshot.publication_admitted,false);
 assert.deepEqual(Object.keys(snapshot.files_sha256).sort(),['backup.json','policies.json','registry.json','report.json']);
 for(const [path,digest] of Object.entries(snapshot.files_sha256))assert.equal(createHash('sha256').update(await readFile(dir+'/'+path)).digest('hex'),digest,path);
 const actual=JSON.parse(await readFile(dir+'/report.json','utf8'));
 const {rehearse}=await import('./preparation/rehearse.js');const fresh=await rehearse();assert.equal(stable(fresh.report),stable(actual));
 assert.equal(actual.publication_admitted,false);assert.equal(actual.queue.handler_calls,2);assert.equal(actual.queue.after_restart.jobs[0].state,'DONE');assert.equal(actual.stale_monitoring.healthy,false);assert.equal(actual.recovery.resume_writer,false);assert.equal(actual.retention.delete_enabled,false);assert.equal(actual.cutover.cutover_allowed,false);assert.equal(actual.unresolved_policies.blocked.length,18);
 console.log('PASS: immutable local technical rehearsal matches actual replay; all live gates remain closed');
}

{
 const dir='docs/evidence/semantic-admission-local-20261001';const snapshot=JSON.parse(await readFile(dir+'/SNAPSHOT.json','utf8'));
 assert.deepEqual(Object.keys(snapshot.files_sha256).sort(),['native-tests.txt','report.json']);for(const [path,digest] of Object.entries(snapshot.files_sha256))assert.equal(createHash('sha256').update(await readFile(dir+'/'+path)).digest('hex'),digest,path);
 const report=JSON.parse(await readFile(dir+'/report.json','utf8'));assert.equal(report.status,'LOCAL_SEMANTIC_AUTHORITY_INTEGRATION_PASS');assert.equal(report.case_count,9);assert.equal(report.cases.length,9);assert.ok(report.cases.every(c=>c.status==='PASS'));assert.equal(report.publication_kind,'ABSTAIN_FACT_ONLY');assert.equal(report.cloud_semantic_admission,false);assert.equal(report.real_domain_admission,false);assert.equal(report.resume_writer,false);
 console.log('PASS: pinned nine-case native semantic authority integration; real/cloud action gates remain closed');
}
