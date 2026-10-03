import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,lstat,mkdir,mkdtemp,readFile,readdir,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {hash,stable} from '../src/platform/contracts.js';
import {
  BUNDLE_AUDIT_PATH,BUNDLE_BASELINE_PATH,BUNDLE_INVENTORY_PATH,BUNDLE_MANIFEST_PATH,BUNDLE_MARKER_PATH,
  buildCanoEvidenceBundle,canonicalEvidenceJson,computeReviewedPipelineBaseline,verifyCanoEvidenceBundle
} from '../src/evidence/manual-cano-evidence-bundle.js';

const execFileAsync=promisify(execFile);
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixtureRoot=path.join(repoRoot,'fixtures/manual-cano-import');
const trustedPin=path.join(repoRoot,'fixtures/manual-cano-evidence/TRUSTED_BASELINE_PIN.json');

async function tempRoot(prefix='openpq-f14-'){return mkdtemp(path.join(tmpdir(),prefix));}
async function build(name='manifest.happy.json'){
  const root=await tempRoot(),bundle=path.join(root,'bundle');
  const result=await buildCanoEvidenceBundle({input_root:fixtureRoot,manifest_file:name,output_dir:bundle,source_root:repoRoot});
  return {root,bundle,result};
}
async function runCli(script,args){
  try{const out=await execFileAsync(process.execPath,[script,...args],{cwd:repoRoot,encoding:'utf8'});return {code:0,stdout:out.stdout,stderr:out.stderr};}
  catch(error){return {code:error.code,stdout:error.stdout||'',stderr:error.stderr||''};}
}
async function sha256(bytes){const d=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function rewriteInventory(bundle,changedPath=null){
  const p=path.join(bundle,BUNDLE_INVENTORY_PATH),inv=JSON.parse(await readFile(p,'utf8'));
  if(changedPath){
    const entry=inv.files.find(x=>x.path===changedPath);assert.ok(entry,'inventory entry '+changedPath);
    const bytes=await readFile(path.join(bundle,...changedPath.split('/')));entry.size=bytes.length;entry.sha256=await sha256(bytes);
  }
  inv.total_bytes=inv.files.reduce((n,x)=>n+x.size,0);
  const material={contract_version:inv.contract_version,fixture_only:inv.fixture_only,files:inv.files,total_bytes:inv.total_bytes};
  inv.inventory_payload_sha256=await hash(material);
  await writeFile(p,stable(inv)+'\n');
}
async function writeJson(filename,value){await mkdir(path.dirname(filename),{recursive:true});await writeFile(filename,JSON.stringify(value,null,2)+'\n');}
async function copiedFixture(){const root=await tempRoot('openpq-f14-input-');await cp(fixtureRoot,root,{recursive:true});return root;}
async function expectBuildError(args,code){await assert.rejects(()=>buildCanoEvidenceBundle(args),e=>e?.code===code);}

// Portable round-trip and closed semantics.
test('builder creates portable minimal bundle and relocated verifier replays exact audit',async()=>{
  const input=await copiedFixture();await writeFile(path.join(input,'secret-do-not-copy.txt'),'SECRET');
  const root=await tempRoot(),bundle=path.join(root,'bundle');
  const built=await buildCanoEvidenceBundle({input_root:input,manifest_file:'manifest.correction.json',output_dir:bundle,source_root:repoRoot});
  assert.equal(built.marker.bundle_status,'EVIDENCE_ONLY');
  assert.equal(built.report.aggregate_result.status,'VALID');
  assert.equal(built.report.action_eligible,false);assert.equal(built.report.publication_admitted,false);
  assert.deepEqual(await readFile(path.join(bundle,BUNDLE_MANIFEST_PATH)),await readFile(path.join(input,'manifest.correction.json')));
  await assert.rejects(()=>lstat(path.join(bundle,'snapshot/secret-do-not-copy.txt')),/ENOENT/);
  const files=(await readdir(path.join(bundle,'snapshot/raw'))).sort();assert.deepEqual(files,['base.raw.json','correction.raw.json']);
  const relocated=path.join(root,'relocated');await cp(bundle,relocated,{recursive:true});
  const verified=await verifyCanoEvidenceBundle({bundle_dir:relocated,trusted_pin_file:trustedPin});
  assert.equal(verified.verification_status,'VERIFIED_FIXTURE_ONLY');
  assert.equal(verified.baseline_match,true);assert.equal(verified.audit_match,true);assert.equal(verified.inventory_verified,true);
  assert.equal(verified.action_eligible,false);assert.equal(verified.publication_admitted,false);
});

test('bundle baseline pin is stable and covers reviewed F13 execution chain only',async()=>{
  const baseline=await computeReviewedPipelineBaseline({source_root:repoRoot});
  const pin=JSON.parse(await readFile(trustedPin,'utf8'));
  assert.equal(baseline.baseline_source_sha256,pin.baseline_source_sha256);
  assert.equal(baseline.files.some(x=>x.path.includes('manual-cano-evidence-bundle.js')),false);
  assert.ok(baseline.files.some(x=>x.path.endsWith('manual-cano-import-pipeline.js')));
});

test('trusted baseline pin must be outside the evidence bundle',async()=>{
  const {bundle}=await build();const insidePin=path.join(bundle,'PIN.json');await cp(trustedPin,insidePin);await rewriteInventory(bundle);
  // Add the file to inventory to prove the rejection is about trust location, not merely an extra file.
  const invPath=path.join(bundle,BUNDLE_INVENTORY_PATH),inv=JSON.parse(await readFile(invPath,'utf8')),bytes=await readFile(insidePin);
  inv.files.push({path:'PIN.json',size:bytes.length,sha256:await sha256(bytes)});inv.files.sort((a,b)=>a.path.localeCompare(b.path));inv.total_bytes=inv.files.reduce((n,x)=>n+x.size,0);
  inv.inventory_payload_sha256=await hash({contract_version:inv.contract_version,fixture_only:inv.fixture_only,files:inv.files,total_bytes:inv.total_bytes});await writeFile(invPath,stable(inv)+'\n');
  await assert.rejects(()=>verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:insidePin}),e=>e?.code==='CANO_EVIDENCE_TRUSTED_PIN_INSIDE_BUNDLE');
});

test('wrong external baseline pin is reported separately and never verified',async()=>{
  const {root,bundle}=await build();const wrong=path.join(root,'wrong-pin.json');
  await writeJson(wrong,{contract_version:'openpq-cano-offline-baseline-pin-v1',baseline_source_sha256:'0'.repeat(64)});
  const result=await verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:wrong});
  assert.equal(result.verification_status,'BASELINE_MISMATCH');assert.equal(result.baseline_match,false);assert.equal(result.audit_match,false);
});

// Integrity bypass attempts: update inventory after tamper so semantic verifier still has to work.
test('raw tamper with refreshed inventory is rejected by audit replay',async()=>{
  const {bundle}=await build();const raw=path.join(bundle,'snapshot/raw/base.raw.json');
  const bytes=Buffer.from(await readFile(raw));bytes[bytes.length-2]=bytes[bytes.length-2]===32?33:32;await writeFile(raw,bytes);await rewriteInventory(bundle,'snapshot/raw/base.raw.json');
  await assert.rejects(()=>verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin}),e=>e?.code==='CANO_EVIDENCE_AUDIT_REPLAY_MISMATCH');
});

test('manifest clock tamper with refreshed inventory is rejected before replay',async()=>{
  const {bundle}=await build();const p=path.join(bundle,BUNDLE_MANIFEST_PATH),m=JSON.parse(await readFile(p,'utf8'));m.evaluation_time='2030-01-15T13:00:00.000Z';await writeFile(p,JSON.stringify(m,null,2)+'\n');await rewriteInventory(bundle,BUNDLE_MANIFEST_PATH);
  await assert.rejects(()=>verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin}),e=>e?.code==='CANO_EVIDENCE_EVALUATION_TIME_MISMATCH');
});

test('audit tamper with refreshed inventory is rejected by full canonical replay equality',async()=>{
  const {bundle}=await build();const p=path.join(bundle,BUNDLE_AUDIT_PATH),a=JSON.parse(await readFile(p,'utf8'));a.errors.push({input_index:null,stage:'LEDGER',code:'SYNTHETIC_TAMPER'});await writeFile(p,stable(a)+'\n');await rewriteInventory(bundle,BUNDLE_AUDIT_PATH);
  await assert.rejects(()=>verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin}),e=>e?.code==='CANO_EVIDENCE_AUDIT_REPLAY_MISMATCH');
});

test('true action/publication claims are rejected even if inventory is recomputed',async()=>{
  for(const [file,field,expected] of [[BUNDLE_MARKER_PATH,'action_eligible','CANO_EVIDENCE_MARKER_ACTION_OPEN'],[BUNDLE_AUDIT_PATH,'publication_admitted','CANO_EVIDENCE_AUDIT_PUBLICATION_OPEN']]){
    const {bundle}=await build();const p=path.join(bundle,file),v=JSON.parse(await readFile(p,'utf8'));v[field]=true;await writeFile(p,stable(v)+'\n');await rewriteInventory(bundle,file);
    await assert.rejects(()=>verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin}),e=>e?.code===expected);
  }
});

test('inventory tamper, missing file and extra file are independently rejected',async()=>{
  {
    const {bundle}=await build();const p=path.join(bundle,BUNDLE_INVENTORY_PATH),inv=JSON.parse(await readFile(p,'utf8'));inv.files[0].sha256='0'.repeat(64);await writeFile(p,stable(inv)+'\n');
    await assert.rejects(()=>verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin}),e=>['CANO_EVIDENCE_SHA256_MISMATCH','CANO_EVIDENCE_INVENTORY_DIGEST_MISMATCH'].includes(e?.code));
  }
  {
    const {bundle}=await build();await (await import('node:fs/promises')).unlink(path.join(bundle,'snapshot/raw/base.raw.json'));
    await assert.rejects(()=>verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin}),e=>e?.code==='CANO_EVIDENCE_FILE_SET_MISMATCH');
  }
  {
    const {bundle}=await build();await writeFile(path.join(bundle,'EXTRA.txt'),'x');
    await assert.rejects(()=>verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin}),e=>e?.code==='CANO_EVIDENCE_FILE_SET_MISMATCH');
  }
});

test('bundle baseline inventory tamper cannot be rescued by inventory rewrite',async()=>{
  const {bundle}=await build();const p=path.join(bundle,BUNDLE_BASELINE_PATH),b=JSON.parse(await readFile(p,'utf8'));b.files[0].size+=1;await writeFile(p,stable(b)+'\n');await rewriteInventory(bundle,BUNDLE_BASELINE_PATH);
  await assert.rejects(()=>verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin}),e=>e?.code==='CANO_EVIDENCE_BASELINE_INVENTORY_DIGEST_MISMATCH');
});

// Invalid/uncertain states stay diagnostic or evidence-only, never READY.
test('partial invalid batch is preserved as diagnostic evidence and verifier exits diagnostic status',async()=>{
  const input=await copiedFixture(),m=JSON.parse(await readFile(path.join(input,'manifest.happy.json'),'utf8'));
  m.records.push({...structuredClone(m.records[0]),raw_file:'raw/missing.raw.json'});await writeJson(path.join(input,'partial.json'),m);
  const root=await tempRoot(),bundle=path.join(root,'bundle');const built=await buildCanoEvidenceBundle({input_root:input,manifest_file:'partial.json',output_dir:bundle,source_root:repoRoot});
  assert.equal(built.marker.bundle_status,'INVALID');assert.equal(built.report.aggregate_result.status,'INVALID');assert.equal(built.report.batch_projection.state,'UNRESOLVED');
  const verified=await verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin});assert.equal(verified.verification_status,'DIAGNOSTIC_INVALID_BATCH');assert.equal(verified.bundle_status,'INVALID');
});

test('quarantined, ambiguous and expired projections remain closed but portable',async()=>{
  for(const [name,state] of [['manifest.quarantine.json','QUARANTINED'],['manifest.ambiguous.json','AMBIGUOUS']]){
    const {bundle,result}=await build(name);assert.equal(result.report.batch_projection.state,state);assert.equal(result.marker.bundle_status,'EVIDENCE_ONLY');
    const verified=await verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin});assert.equal(verified.verification_status,'VERIFIED_FIXTURE_ONLY');
  }
  const input=await copiedFixture(),m=JSON.parse(await readFile(path.join(input,'manifest.happy.json'),'utf8'));m.evaluation_time='2030-01-16T00:00:00.000Z';await writeJson(path.join(input,'expired.json'),m);
  const root=await tempRoot(),bundle=path.join(root,'bundle');const built=await buildCanoEvidenceBundle({input_root:input,manifest_file:'expired.json',output_dir:bundle,source_root:repoRoot});
  assert.equal(built.report.batch_projection.state,'EXPIRED');const verified=await verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin});assert.equal(verified.verification_status,'VERIFIED_FIXTURE_ONLY');
});

test('65-record rejection remains INVALID diagnostic with bounded audit hints',async()=>{
  const input=await copiedFixture(),m=JSON.parse(await readFile(path.join(input,'manifest.happy.json'),'utf8'));m.records=Array.from({length:65},()=>structuredClone(m.records[0]));m.records[0].supersedes='not-a-hash';m.records[0].provenance.payload_sha256='not-a-hash';await writeJson(path.join(input,'reject65.json'),m);
  const root=await tempRoot(),bundle=path.join(root,'bundle');const built=await buildCanoEvidenceBundle({input_root:input,manifest_file:'reject65.json',output_dir:bundle,source_root:repoRoot});
  assert.equal(built.report.input_count,65);assert.equal(built.report.inputs.length,64);assert.equal(built.report.inputs[0].supersedes,null);assert.equal(built.report.inputs[0].declared_payload_sha256,null);assert.equal(built.marker.bundle_status,'INVALID');
  const verified=await verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin});assert.equal(verified.verification_status,'DIAGNOSTIC_INVALID_BATCH');
});

// File containment and bounded packaging.
test('path traversal manifest is diagnostic without reading outside snapshot',async()=>{
  const input=await copiedFixture(),m=JSON.parse(await readFile(path.join(input,'manifest.happy.json'),'utf8'));m.records[0].raw_file='../outside.json';await writeJson(path.join(input,'traversal.json'),m);await writeFile(path.join(path.dirname(input),'outside.json'),'SHOULD_NOT_READ');
  const root=await tempRoot(),bundle=path.join(root,'bundle');const built=await buildCanoEvidenceBundle({input_root:input,manifest_file:'traversal.json',output_dir:bundle,source_root:repoRoot});
  assert.equal(built.report.aggregate_result.status,'INVALID');assert.equal(built.marker.bundle_status,'INVALID');
  const verified=await verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin});assert.equal(verified.verification_status,'DIAGNOSTIC_INVALID_BATCH');
});

test('symlink escape, non-regular raw and oversized raw are unbundleable and leave no output',async()=>{
  {
    const input=await copiedFixture(),outside=path.join(await tempRoot(),'outside.json');await writeFile(outside,'{}');await (await import('node:fs/promises')).unlink(path.join(input,'raw/base.raw.json'));await symlink(outside,path.join(input,'raw/base.raw.json'));
    const root=await tempRoot(),out=path.join(root,'bundle');await expectBuildError({input_root:input,manifest_file:'manifest.happy.json',output_dir:out,source_root:repoRoot},'CANO_EVIDENCE_SYMLINK_ESCAPE');await assert.rejects(()=>lstat(out),/ENOENT/);
  }
  {
    const input=await copiedFixture();await (await import('node:fs/promises')).unlink(path.join(input,'raw/base.raw.json'));await mkdir(path.join(input,'raw/base.raw.json'));
    const root=await tempRoot(),out=path.join(root,'bundle');await expectBuildError({input_root:input,manifest_file:'manifest.happy.json',output_dir:out,source_root:repoRoot},'CANO_EVIDENCE_RAW_NOT_REGULAR_UNBUNDLEABLE');await assert.rejects(()=>lstat(out),/ENOENT/);
  }
  {
    const input=await copiedFixture();await writeFile(path.join(input,'raw/base.raw.json'),Buffer.alloc(8193,65));
    const root=await tempRoot(),out=path.join(root,'bundle');await expectBuildError({input_root:input,manifest_file:'manifest.happy.json',output_dir:out,source_root:repoRoot},'CANO_EVIDENCE_RAW_TOO_LARGE_UNBUNDLEABLE');await assert.rejects(()=>lstat(out),/ENOENT/);
  }
});

test('oversized manifest is rejected before bundle creation',async()=>{
  const input=await copiedFixture();await writeFile(path.join(input,'huge.json'),Buffer.alloc(131073,32));const root=await tempRoot(),out=path.join(root,'bundle');
  await expectBuildError({input_root:input,manifest_file:'huge.json',output_dir:out,source_root:repoRoot},'CANO_IMPORT_MANIFEST_PAYLOAD_TOO_LARGE');await assert.rejects(()=>lstat(out),/ENOENT/);
});

test('existing output directory is never overwritten',async()=>{
  const root=await tempRoot(),out=path.join(root,'bundle');await mkdir(out);await writeFile(path.join(out,'sentinel'),'KEEP');
  await expectBuildError({input_root:fixtureRoot,manifest_file:'manifest.happy.json',output_dir:out,source_root:repoRoot},'CANO_EVIDENCE_OUTPUT_EXISTS');assert.equal(await readFile(path.join(out,'sentinel'),'utf8'),'KEEP');
});

test('builder/verifier CLIs use structured stdout and 0/1/2 exit contract',async()=>{
  const root=await tempRoot(),good=path.join(root,'good'),bad=path.join(root,'bad');
  const b0=await runCli('scripts/build-manual-cano-evidence-bundle.js',[fixtureRoot,'manifest.happy.json',good]);assert.equal(b0.code,0);assert.equal(JSON.parse(b0.stdout).status,'BUNDLE_CREATED');
  const v0=await runCli('scripts/verify-manual-cano-evidence-bundle.js',[good,trustedPin]);assert.equal(v0.code,0);assert.equal(JSON.parse(v0.stdout).verification_status,'VERIFIED_FIXTURE_ONLY');
  const b1=await runCli('scripts/build-manual-cano-evidence-bundle.js',[fixtureRoot,'manifest.missing-file.json',bad]);assert.equal(b1.code,1);assert.equal(JSON.parse(b1.stdout).status,'DIAGNOSTIC_INVALID_BATCH');
  const v1=await runCli('scripts/verify-manual-cano-evidence-bundle.js',[bad,trustedPin]);assert.equal(v1.code,1);assert.equal(JSON.parse(v1.stdout).verification_status,'DIAGNOSTIC_INVALID_BATCH');
  const v2=await runCli('scripts/verify-manual-cano-evidence-bundle.js',[path.join(root,'missing'),trustedPin]);assert.equal(v2.code,2);assert.equal(JSON.parse(v2.stdout).verification_status,'CORRUPT_OR_ERROR');
});

test('F14 evidence code has no network/env/credential capability',async()=>{
  const files=['src/evidence/manual-cano-evidence-bundle.js','scripts/build-manual-cano-evidence-bundle.js','scripts/verify-manual-cano-evidence-bundle.js'];
  const text=(await Promise.all(files.map(f=>readFile(path.join(repoRoot,f),'utf8')))).join('\n');
  for(const forbidden of [/\bfetch\s*\(/,/https?:\/\//,/process\.env/,/wrangler/i,/cloudflare/i,/credential/i,/secret/i])assert.equal(forbidden.test(text),false,String(forbidden));
});


test('verifier rejects installed execution drift even if audit remains equivalent',async()=>{
  const {root,bundle}=await build();const drifted=path.join(root,'drifted-source');
  await cp(repoRoot,drifted,{recursive:true});
  const file=path.join(drifted,'src/ingress/manual-cano.js');
  await writeFile(file,(await readFile(file,'utf8'))+'\n// Drift changes source pin without changing output.\n');
  let result;
  try{await execFileAsync(process.execPath,[path.join(drifted,'scripts/verify-manual-cano-evidence-bundle.js'),bundle,trustedPin],{encoding:'utf8'});assert.fail('drifted verifier must not pass');}
  catch(error){assert.equal(error.code,2);result=JSON.parse(error.stdout);}
  assert.equal(result.verification_status,'BASELINE_MISMATCH');
  assert.deepEqual(result.reason_codes,['CANO_EVIDENCE_EXECUTION_BASELINE_MISMATCH']);
  assert.equal(result.baseline_match,false);assert.equal(result.audit_match,false);
});

test('builder cannot label active pipeline using another source directory',async()=>{
  const root=await tempRoot(),other=path.join(root,'other');await cp(repoRoot,other,{recursive:true});
  await expectBuildError({input_root:fixtureRoot,manifest_file:'manifest.happy.json',output_dir:path.join(root,'bundle'),source_root:other},'CANO_EVIDENCE_BUILD_SOURCE_ROOT_MISMATCH');
  await assert.rejects(()=>lstat(path.join(root,'bundle')),/ENOENT/);
});

test('verifier bounds traversal of deeply nested bundle directories',async()=>{
  const {bundle}=await build();await mkdir(path.join(bundle,...Array.from({length:34},()=> 'deep')),{recursive:true});
  await assert.rejects(()=>verifyCanoEvidenceBundle({bundle_dir:bundle,trusted_pin_file:trustedPin}),{code:'CANO_EVIDENCE_TREE_DEPTH_EXCEEDED'});
});
