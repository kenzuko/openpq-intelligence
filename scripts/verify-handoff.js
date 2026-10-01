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
