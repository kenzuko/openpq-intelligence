import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
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
