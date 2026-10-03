import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,cp,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {hash,stable} from '../src/platform/contracts.js';
import {buildCanoShadowFromRaw} from '../src/ingress/manual-cano-semantic.js';
import {loadCanoImportFromLocalFiles} from '../src/ingress/manual-cano-local-files.js';
import {CANO_IMPORT_MAX_RAW_BYTES,runCanoImportPipeline,validateCanoImportManifest} from '../src/ingress/manual-cano-import-pipeline.js';

const execFileAsync=promisify(execFile);
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixtureRoot=path.join(repoRoot,'fixtures/manual-cano-import');
const index=JSON.parse(await readFile(path.join(fixtureRoot,'FIXTURE_INDEX.json'),'utf8'));
const baseRaw=await readFile(path.join(fixtureRoot,'raw/base.raw.json'),'utf8');
const correctionRaw=await readFile(path.join(fixtureRoot,'raw/correction.raw.json'),'utf8');

async function manifest(name){return JSON.parse(await readFile(path.join(fixtureRoot,name),'utf8'));}
async function scratch(){const root=await mkdtemp(path.join(tmpdir(),'openpq-f13-'));await cp(fixtureRoot,root,{recursive:true});return root;}
async function writeJson(root,name,value){await writeFile(path.join(root,name),JSON.stringify(value,null,2)+'\n');}
async function runCli(root,manifestName){
  try{
    const out=await execFileAsync(process.execPath,['scripts/import-manual-cano-offline.js',root,manifestName],{cwd:repoRoot,encoding:'utf8'});
    return {code:0,stdout:out.stdout,stderr:out.stderr};
  }catch(error){return {code:error.code,stdout:error.stdout||'',stderr:error.stderr||''};}
}
function targetFor(day='2030-01-15'){return {dataset_id:'cano.operation.an-thoi',scope:{category:'cano',service_area:'An Thới, Phú Quốc',operational_day:day,timezone:'Asia/Ho_Chi_Minh',mapping_id:'manual-cano-an-thoi-v1'}};}
function rawFor({day='16/01/2030',recorded='2030-01-16T06:15:00+07:00',state='RUNNING',confirmed_by='kenzuko'}={}){
  return JSON.stringify({schema_version:'marine-ops-manual-1.0',category:'cano',date:day,state,status_label:'SYNTHETIC',valid_scope:`Ngày ${day} - cano du lịch An Thới, Phú Quốc`,recorded_at_vn:recorded,confirmation_channel:'SYNTHETIC_FIXTURE_ONLY',confirmed_by,evidence:{category:'cano',source:'JOTRIP_FIELD_CONFIRMATION',source_tier:'FIELD',evidence_class:'DIRECT',status:'SYNTHETIC',area:'Phú Quốc / An Thới',confirmed_at_text:'SYNTHETIC',evidence_note:'SYNTHETIC F13 TEST ONLY'},verification_note:'SYNTHETIC FIXTURE ONLY'});
}

// End-to-end behavior on bundled synthetic fixtures.
test('happy raw -> normalizer -> wrapper -> ledger -> audit resolves with closed fences',async()=>{
  const report=await loadCanoImportFromLocalFiles({input_root:fixtureRoot,manifest_file:'manifest.happy.json'});
  assert.equal(report.aggregate_result.status,'VALID');
  assert.equal(report.batch_projection.state,'RESOLVED');
  assert.equal(report.batch_projection.reported_state,'RUNNING');
  assert.equal(report.inputs[0].normalize_status,'NORMALIZED_SHADOW');
  assert.equal(report.inputs[0].wrapper_status,'WRAPPED');
  assert.equal(report.inputs[0].revision_id,index.records.base.revision_id);
  assert.match(report.inputs[0].raw_sha256,/^[a-f0-9]{64}$/);
  assert.equal(report.action_eligible,false);assert.equal(report.publication_admitted,false);
});

test('explicit correction chain selects terminal independent of input order',async()=>{
  const normal=await manifest('manifest.correction.json');
  const report=await loadCanoImportFromLocalFiles({input_root:fixtureRoot,manifest_file:'manifest.correction.json'});
  assert.equal(report.batch_projection.state,'RESOLVED');
  assert.equal(report.batch_projection.reported_state,'SUSPENDED');
  assert.equal(report.batch_projection.terminal_revision_id,index.records.correction.revision_id);
  const reversed=structuredClone(normal);reversed.records.reverse();
  const root=await scratch();await writeJson(root,'reversed.json',reversed);
  const reversedReport=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'reversed.json'});
  assert.equal(stable(reversedReport.batch_projection),stable(report.batch_projection));
  assert.notEqual(stable(reversedReport.inputs),stable(report.inputs));
});

test('quarantine, ambiguity, expired and not-yet-effective remain non-actionable',async()=>{
  const quarantine=await loadCanoImportFromLocalFiles({input_root:fixtureRoot,manifest_file:'manifest.quarantine.json'});
  assert.equal(quarantine.aggregate_result.status,'VALID');assert.equal(quarantine.batch_projection.state,'QUARANTINED');
  const ambiguous=await loadCanoImportFromLocalFiles({input_root:fixtureRoot,manifest_file:'manifest.ambiguous.json'});
  assert.equal(ambiguous.aggregate_result.status,'VALID');assert.equal(ambiguous.batch_projection.state,'AMBIGUOUS');
  const root=await scratch(),m=await manifest('manifest.happy.json');
  m.evaluation_time='2030-01-14T22:00:00.000Z';await writeJson(root,'before.json',m);
  const before=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'before.json'});assert.equal(before.batch_projection.state,'UNRESOLVED');assert.ok(before.batch_projection.reason_codes.includes('CANO_PROJECTION_NOT_YET_EFFECTIVE'));
  m.evaluation_time='2030-01-15T17:00:00.000Z';await writeJson(root,'after.json',m);
  const after=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'after.json'});assert.equal(after.batch_projection.state,'EXPIRED');
  for(const r of [quarantine,ambiguous,before,after]){assert.equal(r.action_eligible,false);assert.equal(r.publication_admitted,false);}
});

test('exact duplicate replay is idempotent and recorded by the ledger',async()=>{
  const root=await scratch(),m=await manifest('manifest.happy.json');m.records.push(structuredClone(m.records[0]));await writeJson(root,'duplicate.json',m);
  const report=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'duplicate.json'});
  assert.equal(report.aggregate_result.status,'VALID');assert.equal(report.batch_projection.state,'RESOLVED');
  assert.deepEqual(report.diagnostic_ledger.result.duplicate_revision_ids,[index.records.base.revision_id]);
  assert.equal(report.diagnostic_ledger.result.retained_revision_count,1);
});

// Input integrity and batch fencing.
test('whitespace byte change with old hash is rejected and exact actual digest is audited',async()=>{
  const root=await scratch();await writeFile(path.join(root,'raw/base.raw.json'),baseRaw+'\n');
  const report=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'manifest.happy.json'});
  assert.equal(report.aggregate_result.status,'INVALID');assert.equal(report.batch_projection.state,'UNRESOLVED');
  assert.equal(report.inputs[0].primary_error,'MANUAL_PAYLOAD_HASH_MISMATCH');
  assert.notEqual(report.inputs[0].raw_sha256,report.inputs[0].declared_payload_sha256);
  assert.ok(report.aggregate_result.reason_codes.includes('CANO_IMPORT_PARTIAL_FAILURE'));
});

test('missing file and malformed raw produce structured batch reports instead of crashing',async()=>{
  const missing=await loadCanoImportFromLocalFiles({input_root:fixtureRoot,manifest_file:'manifest.missing-file.json'});
  assert.equal(missing.aggregate_result.status,'INVALID');assert.equal(missing.inputs[0].primary_error,'CANO_IMPORT_RAW_FILE_MISSING');
  const root=await scratch(),m=await manifest('manifest.happy.json'),bad='{not-json';
  m.records[0].provenance.payload_sha256=await hash(bad);await writeFile(path.join(root,'raw/base.raw.json'),bad);await writeJson(root,'bad-json.json',m);
  const malformed=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'bad-json.json'});
  assert.equal(malformed.aggregate_result.status,'INVALID');assert.equal(malformed.inputs[0].primary_error,'CANO_IMPORT_RAW_JSON_INVALID');
});

test('partial failure never promotes healthy subset diagnostic projection to batch projection',async()=>{
  const root=await scratch(),m=await manifest('manifest.happy.json');
  const second=structuredClone(m.records[0]);second.raw_file='raw/missing.raw.json';m.records.push(second);await writeJson(root,'partial.json',m);
  const report=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'partial.json'});
  assert.equal(report.aggregate_result.status,'INVALID');assert.equal(report.batch_projection.state,'UNRESOLVED');
  assert.equal(report.diagnostic_ledger.diagnostic_only,true);
  assert.equal(report.diagnostic_ledger.result.projection.state,'RESOLVED');
  assert.equal(report.inputs[1].primary_error,'CANO_IMPORT_RAW_FILE_MISSING');
});

test('mixed target day is invalid even when raw normalization itself succeeds',async()=>{
  const root=await scratch(),m=await manifest('manifest.happy.json');
  const raw=rawFor();const sha=await hash(raw);const provenance={repository:'kenzuko/Jotrip-Lab',commit_sha:'4444444444444444444444444444444444444444',path:'data/marine_ops/manual-confirmations/2030-01-16-cano-an-thoi.json',payload_sha256:sha};
  await writeFile(path.join(root,'raw/day16.raw.json'),raw);m.records.push({raw_file:'raw/day16.raw.json',provenance,supersedes:null});await writeJson(root,'mixed-day.json',m);
  const report=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'mixed-day.json'});
  assert.equal(report.aggregate_result.status,'INVALID');assert.equal(report.batch_projection.state,'UNRESOLVED');
  assert.equal(report.inputs[1].normalize_status,'NORMALIZED_SHADOW');assert.equal(report.inputs[1].primary_error,'TARGET_BINDING_MISMATCH');
});

test('invalid calendar target preflights before raw processing',async()=>{
  const root=await scratch(),m=await manifest('manifest.happy.json');m.target=targetFor('2030-02-30');await writeJson(root,'invalid-day.json',m);
  const report=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'invalid-day.json'});
  assert.equal(report.aggregate_result.status,'INVALID');assert.deepEqual(report.aggregate_result.reason_codes,['TARGET_INVALID']);
  assert.equal(report.inputs[0].normalize_status,'NOT_RUN');assert.equal(report.inputs[0].raw_sha256,null);
});

test('malformed supersedes is a manifest error; missing target and cycle are ledger errors',async()=>{
  const root=await scratch(),bad=await manifest('manifest.happy.json');bad.records[0].supersedes='bad';await writeJson(root,'malformed-edge.json',bad);
  const malformed=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'malformed-edge.json'});
  assert.equal(malformed.aggregate_result.status,'INVALID');assert.equal(malformed.errors[0].code,'CANO_IMPORT_SUPERSEDES_INVALID');
  const missing=await manifest('manifest.correction.json');missing.records[1].supersedes='f'.repeat(64);await writeJson(root,'missing-edge.json',missing);
  const missingReport=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'missing-edge.json'});
  assert.equal(missingReport.aggregate_result.status,'INVALID');assert.equal(missingReport.inputs[1].primary_error,'CANO_SUPERSEDES_TARGET_MISSING');
  const cycle=await manifest('manifest.correction.json');cycle.records[0].supersedes=index.records.correction.revision_id;cycle.records[1].supersedes=index.records.base.revision_id;await writeJson(root,'cycle.json',cycle);
  const cycleReport=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'cycle.json'});
  assert.equal(cycleReport.aggregate_result.status,'INVALID');assert.ok(cycleReport.errors.some(e=>e.code==='CANO_SUPERSEDES_CYCLE'));
});

test('input error ordering is stable by original input index across load/normalize stages',async()=>{
  const root=await scratch(),m=await manifest('manifest.happy.json');
  await writeFile(path.join(root,'raw/base.raw.json'),baseRaw+' ');
  const second=structuredClone(m.records[0]);second.raw_file='raw/missing.raw.json';m.records.push(second);await writeJson(root,'ordered-errors.json',m);
  const report=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'ordered-errors.json'});
  assert.deepEqual(report.errors.map(e=>e.input_index),[0,1]);
  assert.deepEqual(report.errors.map(e=>e.code),['MANUAL_PAYLOAD_HASH_MISMATCH','CANO_IMPORT_RAW_FILE_MISSING']);
});

// Local-file containment.
test('manifest rejects traversal and absolute raw paths before reading files',async()=>{
  const root=await scratch();
  for(const [name,raw_file] of [['traversal','../escape.json'],['absolute',path.resolve(root,'raw/base.raw.json')],['drive-absolute','C:/outside.json']]){
    const m=await manifest('manifest.happy.json');m.records[0].raw_file=raw_file;await writeJson(root,`${name}.json`,m);
    const report=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:`${name}.json`});
    assert.equal(report.aggregate_result.status,'INVALID');assert.equal(report.errors[0].code,'CANO_IMPORT_RAW_PATH_INVALID');
  }
});

test('symlink escaping input root is rejected as a structured input error',async()=>{
  const root=await scratch(),outside=await mkdtemp(path.join(tmpdir(),'openpq-f13-outside-'));
  await writeFile(path.join(outside,'outside.raw.json'),baseRaw);
  await symlink(path.join(outside,'outside.raw.json'),path.join(root,'raw/escape-link.raw.json'));
  const m=await manifest('manifest.happy.json');m.records[0].raw_file='raw/escape-link.raw.json';await writeJson(root,'symlink.json',m);
  const report=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'symlink.json'});
  assert.equal(report.aggregate_result.status,'INVALID');assert.equal(report.inputs[0].primary_error,'CANO_IMPORT_RAW_SYMLINK_ESCAPE');
});

test('offline harness limits reject oversized batch/manifest payload declarations without inventing operational quota',async()=>{
  const one=await manifest('manifest.happy.json'),many=structuredClone(one);many.records=Array.from({length:65},()=>structuredClone(one.records[0]));
  assert.throws(()=>validateCanoImportManifest(many),{code:'CANO_IMPORT_BATCH_LIMIT_EXCEEDED'});
  const root=await scratch();const huge=' '.repeat(CANO_IMPORT_MAX_RAW_BYTES+1);const m=await manifest('manifest.happy.json');m.records[0].provenance.payload_sha256=await hash(huge);await writeFile(path.join(root,'raw/base.raw.json'),huge);await writeJson(root,'huge.json',m);
  const report=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'huge.json'});
  assert.equal(report.inputs[0].primary_error,'CANO_IMPORT_RAW_PAYLOAD_TOO_LARGE');assert.equal(report.aggregate_result.status,'INVALID');
});

// Determinism, nonmutation, CLI surface and capability boundary.
test('same files and explicit clock produce byte-equivalent canonical CLI output',async()=>{
  const a=await runCli(fixtureRoot,'manifest.correction.json'),b=await runCli(fixtureRoot,'manifest.correction.json');
  assert.equal(a.code,0);assert.equal(b.code,0);assert.equal(a.stdout,b.stdout);assert.equal(a.stderr,'');assert.doesNotThrow(()=>JSON.parse(a.stdout));
});

test('pipeline does not mutate caller manifest or raw bytes',async()=>{
  const m=await manifest('manifest.happy.json'),bytes=new Uint8Array(await readFile(path.join(fixtureRoot,'raw/base.raw.json'))),beforeManifest=stable(m),beforeBytes=Buffer.from(bytes).toString('hex');
  const report=await runCanoImportPipeline({manifest:m,loaded_records:[{index:0,raw_file:m.records[0].raw_file,bytes}]});
  assert.equal(report.aggregate_result.status,'VALID');assert.equal(stable(m),beforeManifest);assert.equal(Buffer.from(bytes).toString('hex'),beforeBytes);
});

test('CLI exit status and stdout contract distinguish valid batch, invalid batch, and fatal manifest I/O',async()=>{
  const good=await runCli(fixtureRoot,'manifest.happy.json');assert.equal(good.code,0);assert.equal(JSON.parse(good.stdout).aggregate_result.status,'VALID');
  const invalid=await runCli(fixtureRoot,'manifest.missing-file.json');assert.equal(invalid.code,1);assert.equal(JSON.parse(invalid.stdout).aggregate_result.status,'INVALID');
  const fatal=await runCli(fixtureRoot,'does-not-exist.json');assert.equal(fatal.code,2);const body=JSON.parse(fatal.stdout);assert.equal(body.contract_version,'openpq-cano-offline-cli-error-v1');assert.equal(body.status,'INVALID');assert.match(fatal.stderr,/CANO_IMPORT_MANIFEST_FILE_MISSING/);
});

test('F13 import code has no network or credential/env capability',async()=>{
  const files=['src/ingress/manual-cano-import-pipeline.js','src/ingress/manual-cano-local-files.js','scripts/import-manual-cano-offline.js'];
  for(const file of files){
    const src=await readFile(path.join(repoRoot,file),'utf8');
    assert.doesNotMatch(src,/node:(?:http|https|net|tls|dns)|\bfetch\s*\(|process\.env|CLOUDFLARE|API_TOKEN|SECRET|credential/i,file);
  }
});


test('local reader rejects oversized raw and non-regular inputs before unbounded read',async()=>{
  const root=await scratch();
  await writeFile(path.join(root,'raw/base.raw.json'),Buffer.alloc(CANO_IMPORT_MAX_RAW_BYTES+1,32));
  const oversized=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'manifest.happy.json'});
  assert.equal(oversized.inputs[0].primary_error,'CANO_IMPORT_RAW_PAYLOAD_TOO_LARGE');
  assert.equal(oversized.inputs[0].raw_sha256,null); // Not fully read, no invented full-file hash.
  const m=await manifest('manifest.happy.json');m.records[0].raw_file='raw';await writeJson(root,'directory.json',m);
  const directory=await loadCanoImportFromLocalFiles({input_root:root,manifest_file:'directory.json'});
  assert.equal(directory.inputs[0].primary_error,'CANO_IMPORT_RAW_NOT_REGULAR_FILE');
  await writeFile(path.join(root,'large-manifest.json'),Buffer.alloc(131073,32));
  await assert.rejects(loadCanoImportFromLocalFiles({input_root:root,manifest_file:'large-manifest.json'}),{code:'CANO_IMPORT_MANIFEST_PAYLOAD_TOO_LARGE'});
});

test('rejection diagnostics keep invalid hints null and bound oversized batch evidence',async()=>{
  const bad=await manifest('manifest.happy.json');
  bad.records[0].provenance.payload_sha256='not-a-hash';bad.records[0].supersedes={invalid:true};
  const report=await runCanoImportPipeline({manifest:bad});
  assert.equal(report.aggregate_result.status,'INVALID');
  assert.equal(report.inputs[0].declared_payload_sha256,null);assert.equal(report.inputs[0].supersedes,null);
  const many=await manifest('manifest.happy.json');many.records=Array.from({length:65},()=>structuredClone(many.records[0]));
  const oversized=await runCanoImportPipeline({manifest:many});
  assert.equal(oversized.input_count,65);assert.equal(oversized.inputs.length,64);
  assert.deepEqual(oversized.aggregate_result.reason_codes,['CANO_IMPORT_BATCH_LIMIT_EXCEEDED']);
  assert.equal(oversized.batch_projection.state,'UNRESOLVED');
});
