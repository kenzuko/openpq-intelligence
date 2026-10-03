import {constants} from 'node:fs';
import {lstat,mkdir,open,realpath,opendir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const EXECUTING_SOURCE_ROOT=fileURLToPath(new URL('../../',import.meta.url));
import {ContractError,hash,stable} from '../platform/contracts.js';
import {
  CANO_IMPORT_AUDIT_VERSION,
  CANO_IMPORT_MANIFEST_VERSION,
  CANO_IMPORT_MAX_MANIFEST_BYTES,
  CANO_IMPORT_MAX_RAW_BYTES
} from '../ingress/manual-cano-import-pipeline.js';
import {canonicalAuditJson,loadCanoImportFromLocalFiles} from '../ingress/manual-cano-local-files.js';

export const CANO_EVIDENCE_BUNDLE_VERSION='openpq-cano-offline-evidence-bundle-v1';
export const CANO_EVIDENCE_INVENTORY_VERSION='openpq-cano-offline-evidence-inventory-v1';
export const CANO_EVIDENCE_BASELINE_VERSION='openpq-cano-offline-baseline-source-v1';
export const CANO_EVIDENCE_PIN_VERSION='openpq-cano-offline-baseline-pin-v1';
export const CANO_EVIDENCE_VERIFY_VERSION='openpq-cano-offline-evidence-verification-v1';
export const CANO_EVIDENCE_MODE='FIXTURE_ONLY';
export const CANO_EVIDENCE_MAX_FILES=128;
export const CANO_EVIDENCE_MAX_FILE_BYTES=524288;
export const CANO_EVIDENCE_MAX_TOTAL_BYTES=4*1024*1024;
export const BUNDLE_MANIFEST_PATH='snapshot/manifest.json';
export const BUNDLE_AUDIT_PATH='audit/audit.json';
export const BUNDLE_BASELINE_PATH='BASELINE_SOURCE.json';
export const BUNDLE_MARKER_PATH='BUNDLE.json';
export const BUNDLE_INVENTORY_PATH='INVENTORY.json';

// This inventory pins only the reviewed F13 semantic execution chain. F14 packager/verifier
// code is independently reviewed and is never loaded from an evidence bundle.
export const REVIEWED_PIPELINE_SOURCE_PATHS=Object.freeze([
  'src/platform/contracts.js',
  'src/ingress/manual-cano.js',
  'src/ingress/manual-cano-semantic.js',
  'src/ingress/manual-cano-lineage.js',
  'src/ingress/manual-cano-import-pipeline.js',
  'src/ingress/manual-cano-local-files.js',
  'schemas/openpq-cano-manual-shadow-v1.schema.json',
  'schemas/openpq-cano-revision-wrapper-v1.schema.json',
  'schemas/openpq-cano-ledger-result-v1.schema.json',
  'schemas/openpq-cano-preflight-rejection-v1.schema.json',
  'schemas/openpq-cano-offline-import-manifest-v1.schema.json',
  'schemas/openpq-cano-offline-audit-v1.schema.json',
  'schemas/openpq-cano-offline-cli-error-v1.schema.json'
]);

const DIGEST=/^[a-f0-9]{64}$/;
function fail(code){throw new ContractError(code);}
function codeOf(error,fallback){return typeof error?.code==='string'?error.code:fallback;}
function inside(root,candidate){return candidate===root||candidate.startsWith(root+path.sep);}
function safeRelative(value){
  if(typeof value!=='string'||value.length<1||value.length>512||value.includes('\0')||value.includes('\\')||path.isAbsolute(value)||/^[A-Za-z]:\//.test(value))return false;
  return value.split('/').every(part=>part.length>0&&part!=='.'&&part!=='..');
}
function clone(value){return JSON.parse(stable(value));}
async function sha256Bytes(bytes){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function boundedRegularFile(filename,maxBytes,{missingCode='CANO_EVIDENCE_FILE_MISSING',tooLargeCode='CANO_EVIDENCE_FILE_TOO_LARGE',notRegularCode='CANO_EVIDENCE_NOT_REGULAR_FILE'}={}){
  let before;
  try{before=await lstat(filename);}catch(error){if(error?.code==='ENOENT')fail(missingCode);throw error;}
  if(!before.isFile())fail(notRegularCode);
  if(before.size>maxBytes)fail(tooLargeCode);
  const handle=await open(filename,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
  try{
    const stat=await handle.stat();
    if(!stat.isFile())fail(notRegularCode);
    if(stat.dev!==before.dev||stat.ino!==before.ino)fail('CANO_EVIDENCE_FILE_CHANGED');
    if(stat.size>maxBytes)fail(tooLargeCode);
    const buffer=Buffer.alloc(maxBytes+1);let length=0;
    while(length<buffer.length){
      const {bytesRead}=await handle.read(buffer,length,buffer.length-length,null);
      if(bytesRead===0)break;
      length+=bytesRead;
    }
    if(length>maxBytes)fail(tooLargeCode);
    return buffer.subarray(0,length);
  }finally{await handle.close();}
}
async function containedFile(rootReal,relative,{missingCode='CANO_EVIDENCE_FILE_MISSING'}={}){
  if(!safeRelative(relative))fail('CANO_EVIDENCE_PATH_INVALID');
  const syntactic=path.resolve(rootReal,...relative.split('/'));
  if(!inside(rootReal,syntactic))fail('CANO_EVIDENCE_PATH_ESCAPE');
  let resolved;
  try{resolved=await realpath(syntactic);}catch(error){if(error?.code==='ENOENT')fail(missingCode);throw error;}
  if(!inside(rootReal,resolved))fail('CANO_EVIDENCE_SYMLINK_ESCAPE');
  return resolved;
}
async function writeNewFile(rootReal,relative,bytes){
  if(!safeRelative(relative))fail('CANO_EVIDENCE_OUTPUT_PATH_INVALID');
  const filename=path.resolve(rootReal,...relative.split('/'));
  if(!inside(rootReal,filename))fail('CANO_EVIDENCE_OUTPUT_PATH_ESCAPE');
  await mkdir(path.dirname(filename),{recursive:true});
  await writeFile(filename,bytes,{flag:'wx'});
}
function parseJson(bytes,code){
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail(code+'_UTF8_INVALID');}
  try{return JSON.parse(text);}catch{fail(code+'_JSON_INVALID');}
}
async function pathExists(filename){try{await lstat(filename);return true;}catch(error){if(error?.code==='ENOENT')return false;throw error;}}

export async function computeReviewedPipelineBaseline({source_root}){
  const rootReal=await realpath(source_root);
  const files=[];
  for(const relative of REVIEWED_PIPELINE_SOURCE_PATHS){
    const resolved=await containedFile(rootReal,relative,{missingCode:'CANO_EVIDENCE_BASELINE_FILE_MISSING'});
    const bytes=await boundedRegularFile(resolved,CANO_EVIDENCE_MAX_FILE_BYTES,{tooLargeCode:'CANO_EVIDENCE_BASELINE_FILE_TOO_LARGE',notRegularCode:'CANO_EVIDENCE_BASELINE_NOT_REGULAR_FILE'});
    files.push({path:relative,size:bytes.byteLength,sha256:await sha256Bytes(bytes)});
  }
  const material={contract_version:CANO_EVIDENCE_BASELINE_VERSION,files};
  return {...material,baseline_source_sha256:await hash(material)};
}

export async function baselinePinFromInventory(inventory){
  if(inventory?.contract_version!==CANO_EVIDENCE_BASELINE_VERSION||!DIGEST.test(inventory?.baseline_source_sha256||''))fail('CANO_EVIDENCE_BASELINE_INVENTORY_INVALID');
  return {contract_version:CANO_EVIDENCE_PIN_VERSION,baseline_source_sha256:inventory.baseline_source_sha256};
}

async function referencedRawFilesFromManifest(manifest){
  if(!Array.isArray(manifest?.records))return [];
  const set=new Set();
  for(const record of manifest.records){
    if(typeof record?.raw_file==='string'&&safeRelative(record.raw_file))set.add(record.raw_file);
  }
  return [...set].sort();
}

async function copyPortableRawFiles({inputRootReal,manifest,bundleRootReal}){
  const copied=[];
  for(const relative of await referencedRawFilesFromManifest(manifest)){
    let resolved;
    try{resolved=await containedFile(inputRootReal,relative,{missingCode:'CANO_EVIDENCE_RAW_MISSING'});}catch(error){
      if(codeOf(error,'')==='CANO_EVIDENCE_RAW_MISSING')continue;
      throw error;
    }
    let bytes;
    try{
      bytes=await boundedRegularFile(resolved,CANO_IMPORT_MAX_RAW_BYTES,{tooLargeCode:'CANO_EVIDENCE_RAW_TOO_LARGE_UNBUNDLEABLE',notRegularCode:'CANO_EVIDENCE_RAW_NOT_REGULAR_UNBUNDLEABLE'});
    }catch(error){throw error;}
    await writeNewFile(bundleRootReal,'snapshot/'+relative,bytes);
    copied.push('snapshot/'+relative);
  }
  return copied;
}

async function inventoryEntry(rootReal,relative){
  const resolved=await containedFile(rootReal,relative);
  const bytes=await boundedRegularFile(resolved,CANO_EVIDENCE_MAX_FILE_BYTES);
  return {path:relative,size:bytes.byteLength,sha256:await sha256Bytes(bytes)};
}
async function listTree(rootReal,relative='',budget={entries:0,files:0},depth=0){
  if(depth>32)fail('CANO_EVIDENCE_TREE_DEPTH_EXCEEDED');
  const base=relative?path.join(rootReal,...relative.split('/')):rootReal;
  const directory=await opendir(base);const out=[];
  for await(const entry of directory){
    if(++budget.entries>256)fail('CANO_EVIDENCE_TREE_ENTRY_LIMIT_EXCEEDED');
    const rel=relative?relative+'/'+entry.name:entry.name;
    if(entry.isSymbolicLink())fail('CANO_EVIDENCE_BUNDLE_SYMLINK_FORBIDDEN');
    if(entry.isDirectory())out.push(...await listTree(rootReal,rel,budget,depth+1));
    else if(entry.isFile()){
      if(++budget.files>CANO_EVIDENCE_MAX_FILES+1)fail('CANO_EVIDENCE_FILE_COUNT_EXCEEDED');
      out.push(rel);
    }else fail('CANO_EVIDENCE_BUNDLE_NON_REGULAR_FORBIDDEN');
  }
  return out.sort();
}

async function makeInventory(rootReal){
  const paths=(await listTree(rootReal)).filter(p=>p!==BUNDLE_INVENTORY_PATH).sort();
  if(paths.length>CANO_EVIDENCE_MAX_FILES)fail('CANO_EVIDENCE_FILE_COUNT_EXCEEDED');
  const files=[];let total=0;
  for(const relative of paths){
    const entry=await inventoryEntry(rootReal,relative);files.push(entry);total+=entry.size;
  }
  if(total>CANO_EVIDENCE_MAX_TOTAL_BYTES)fail('CANO_EVIDENCE_TOTAL_BYTES_EXCEEDED');
  const material={contract_version:CANO_EVIDENCE_INVENTORY_VERSION,fixture_only:true,files,total_bytes:total};
  return {...material,inventory_payload_sha256:await hash(material)};
}

export async function buildCanoEvidenceBundle({input_root,manifest_file,output_dir,source_root}){
  if(typeof output_dir!=='string'||output_dir.length===0)fail('CANO_EVIDENCE_OUTPUT_REQUIRED');
  if(await pathExists(output_dir))fail('CANO_EVIDENCE_OUTPUT_EXISTS');
  const inputRootReal=await realpath(input_root);
  const manifestResolved=await containedFile(inputRootReal,manifest_file,{missingCode:'CANO_IMPORT_MANIFEST_FILE_MISSING'});
  const manifestBytes=await boundedRegularFile(manifestResolved,CANO_IMPORT_MAX_MANIFEST_BYTES,{tooLargeCode:'CANO_IMPORT_MANIFEST_PAYLOAD_TOO_LARGE',notRegularCode:'CANO_IMPORT_MANIFEST_NOT_REGULAR_FILE'});
  const manifest=parseJson(manifestBytes,'CANO_IMPORT_MANIFEST');
  const report=await loadCanoImportFromLocalFiles({input_root:inputRootReal,manifest_file});
  if(await realpath(source_root)!==await realpath(EXECUTING_SOURCE_ROOT))fail('CANO_EVIDENCE_BUILD_SOURCE_ROOT_MISMATCH');
  const baseline=await computeReviewedPipelineBaseline({source_root:EXECUTING_SOURCE_ROOT});

  await mkdir(output_dir,{recursive:false});
  const bundleRootReal=await realpath(output_dir);
  try{
    await writeNewFile(bundleRootReal,BUNDLE_MANIFEST_PATH,manifestBytes);
    await copyPortableRawFiles({inputRootReal,manifest,bundleRootReal});
    const auditBytes=Buffer.from(canonicalAuditJson(report),'utf8');
    if(auditBytes.byteLength>CANO_EVIDENCE_MAX_FILE_BYTES)fail('CANO_EVIDENCE_AUDIT_TOO_LARGE');
    await writeNewFile(bundleRootReal,BUNDLE_AUDIT_PATH,auditBytes);
    await writeNewFile(bundleRootReal,BUNDLE_BASELINE_PATH,Buffer.from(stable(baseline)+'\n','utf8'));
    const marker={
      contract_version:CANO_EVIDENCE_BUNDLE_VERSION,
      fixture_only:true,
      mode:CANO_EVIDENCE_MODE,
      bundle_status:report.aggregate_result?.status==='INVALID'?'INVALID':'EVIDENCE_ONLY',
      snapshot_manifest_path:BUNDLE_MANIFEST_PATH,
      audit_path:BUNDLE_AUDIT_PATH,
      baseline_source_path:BUNDLE_BASELINE_PATH,
      manifest_contract_version:report.manifest_contract_version,
      audit_contract_version:report.contract_version,
      target:clone(report.target),
      evaluation_time:report.evaluation_time,
      aggregate_status:report.aggregate_result?.status??null,
      projection_status:report.aggregate_result?.projection_status??null,
      action_eligible:false,
      publication_admitted:false,
      source_authenticated:false
    };
    await writeNewFile(bundleRootReal,BUNDLE_MARKER_PATH,Buffer.from(stable(marker)+'\n','utf8'));
    const inventory=await makeInventory(bundleRootReal);
    await writeNewFile(bundleRootReal,BUNDLE_INVENTORY_PATH,Buffer.from(stable(inventory)+'\n','utf8'));
    return {marker,inventory,baseline,report,baseline_pin:await baselinePinFromInventory(baseline)};
  }catch(error){
    // Offline builder owns this newly-created path; remove partial evidence rather than leave a reusable half-bundle.
    await rm(output_dir,{recursive:true,force:true});
    throw error;
  }
}

async function readBundleJson(bundleRootReal,relative,maxBytes=CANO_EVIDENCE_MAX_FILE_BYTES){
  const resolved=await containedFile(bundleRootReal,relative);
  const bytes=await boundedRegularFile(resolved,maxBytes);
  return {bytes,value:parseJson(bytes,'CANO_EVIDENCE_BUNDLE')};
}
function inventoryMap(inventory){
  if(inventory?.contract_version!==CANO_EVIDENCE_INVENTORY_VERSION||inventory.fixture_only!==true||!Array.isArray(inventory.files)||!Number.isSafeInteger(inventory.total_bytes)||!DIGEST.test(inventory.inventory_payload_sha256||''))fail('CANO_EVIDENCE_INVENTORY_INVALID');
  const map=new Map();
  for(const entry of inventory.files){
    if(!entry||!safeRelative(entry.path)||!Number.isSafeInteger(entry.size)||entry.size<0||!DIGEST.test(entry.sha256||'')||map.has(entry.path))fail('CANO_EVIDENCE_INVENTORY_INVALID');
    map.set(entry.path,entry);
  }
  if(map.size>CANO_EVIDENCE_MAX_FILES)fail('CANO_EVIDENCE_FILE_COUNT_EXCEEDED');
  return map;
}
async function verifyInventory(bundleRootReal,inventory){
  const map=inventoryMap(inventory);
  const expected=[...map.keys(),BUNDLE_INVENTORY_PATH].sort();
  const actual=(await listTree(bundleRootReal)).sort();
  if(stable(actual)!==stable(expected))fail('CANO_EVIDENCE_FILE_SET_MISMATCH');
  let total=0;
  for(const [relative,entry] of [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
    const resolved=await containedFile(bundleRootReal,relative);
    const bytes=await boundedRegularFile(resolved,CANO_EVIDENCE_MAX_FILE_BYTES);
    total+=bytes.byteLength;
    if(bytes.byteLength!==entry.size)fail('CANO_EVIDENCE_SIZE_MISMATCH');
    if(await sha256Bytes(bytes)!==entry.sha256)fail('CANO_EVIDENCE_SHA256_MISMATCH');
  }
  if(total!==inventory.total_bytes)fail('CANO_EVIDENCE_TOTAL_BYTES_MISMATCH');
  if(total>CANO_EVIDENCE_MAX_TOTAL_BYTES)fail('CANO_EVIDENCE_TOTAL_BYTES_EXCEEDED');
  const material={contract_version:inventory.contract_version,fixture_only:inventory.fixture_only,files:inventory.files,total_bytes:inventory.total_bytes};
  if(await hash(material)!==inventory.inventory_payload_sha256)fail('CANO_EVIDENCE_INVENTORY_DIGEST_MISMATCH');
}
function assertClosed(value,code){if(value!==false)fail(code);}
function exactJsonEquality(a,b,code){if(stable(a)!==stable(b))fail(code);}

export async function loadTrustedBaselinePin({trusted_pin_file,forbidden_root=null}){
  const pinReal=await realpath(trusted_pin_file);
  if(forbidden_root&&inside(forbidden_root,pinReal))fail('CANO_EVIDENCE_TRUSTED_PIN_INSIDE_BUNDLE');
  const bytes=await boundedRegularFile(pinReal,CANO_EVIDENCE_MAX_FILE_BYTES,{missingCode:'CANO_EVIDENCE_TRUSTED_PIN_MISSING',tooLargeCode:'CANO_EVIDENCE_TRUSTED_PIN_TOO_LARGE',notRegularCode:'CANO_EVIDENCE_TRUSTED_PIN_NOT_REGULAR'});
  const pin=parseJson(bytes,'CANO_EVIDENCE_TRUSTED_PIN');
  if(pin?.contract_version!==CANO_EVIDENCE_PIN_VERSION||!DIGEST.test(pin?.baseline_source_sha256||'')||Object.keys(pin).length!==2)fail('CANO_EVIDENCE_TRUSTED_PIN_INVALID');
  return pin;
}

export async function verifyCanoEvidenceBundle({bundle_dir,trusted_pin_file}){
  const bundleRootReal=await realpath(bundle_dir);
  const {value:inventory}=await readBundleJson(bundleRootReal,BUNDLE_INVENTORY_PATH);
  await verifyInventory(bundleRootReal,inventory);
  const {value:marker}=await readBundleJson(bundleRootReal,BUNDLE_MARKER_PATH);
  const {value:baseline}=await readBundleJson(bundleRootReal,BUNDLE_BASELINE_PATH);
  const {bytes:auditBytes,value:audit}=await readBundleJson(bundleRootReal,BUNDLE_AUDIT_PATH);
  const {value:manifest}=await readBundleJson(bundleRootReal,BUNDLE_MANIFEST_PATH,CANO_IMPORT_MAX_MANIFEST_BYTES);
  const trusted=await loadTrustedBaselinePin({trusted_pin_file,forbidden_root:bundleRootReal});

  if(marker?.contract_version!==CANO_EVIDENCE_BUNDLE_VERSION||marker.fixture_only!==true||marker.mode!==CANO_EVIDENCE_MODE)fail('CANO_EVIDENCE_MARKER_INVALID');
  if(marker.snapshot_manifest_path!==BUNDLE_MANIFEST_PATH||marker.audit_path!==BUNDLE_AUDIT_PATH||marker.baseline_source_path!==BUNDLE_BASELINE_PATH)fail('CANO_EVIDENCE_MARKER_PATH_INVALID');
  assertClosed(marker.action_eligible,'CANO_EVIDENCE_MARKER_ACTION_OPEN');assertClosed(marker.publication_admitted,'CANO_EVIDENCE_MARKER_PUBLICATION_OPEN');
  if(marker.source_authenticated!==false)fail('CANO_EVIDENCE_SOURCE_AUTHENTICATION_CLAIM_INVALID');
  assertClosed(audit.action_eligible,'CANO_EVIDENCE_AUDIT_ACTION_OPEN');assertClosed(audit.publication_admitted,'CANO_EVIDENCE_AUDIT_PUBLICATION_OPEN');
  if(audit.fixture_only!==true||audit.mode!==CANO_EVIDENCE_MODE||audit.contract_version!==CANO_IMPORT_AUDIT_VERSION)fail('CANO_EVIDENCE_AUDIT_CONTRACT_INVALID');
  if(manifest?.contract_version!==CANO_IMPORT_MANIFEST_VERSION||manifest.fixture_only!==true)fail('CANO_EVIDENCE_MANIFEST_CONTRACT_INVALID');
  exactJsonEquality(marker.target,audit.target,'CANO_EVIDENCE_MARKER_TARGET_MISMATCH');
  exactJsonEquality(manifest.target,audit.target,'CANO_EVIDENCE_MANIFEST_TARGET_MISMATCH');
  if(marker.evaluation_time!==audit.evaluation_time||manifest.evaluation_time!==audit.evaluation_time)fail('CANO_EVIDENCE_EVALUATION_TIME_MISMATCH');
  if(marker.audit_contract_version!==audit.contract_version||marker.manifest_contract_version!==audit.manifest_contract_version)fail('CANO_EVIDENCE_CONTRACT_VERSION_MISMATCH');
  if(marker.aggregate_status!==audit.aggregate_result?.status||marker.projection_status!==audit.aggregate_result?.projection_status)fail('CANO_EVIDENCE_STATUS_MISMATCH');
  if(marker.bundle_status!==(audit.aggregate_result?.status==='INVALID'?'INVALID':'EVIDENCE_ONLY'))fail('CANO_EVIDENCE_BUNDLE_STATUS_INVALID');

  if(baseline?.contract_version!==CANO_EVIDENCE_BASELINE_VERSION||!Array.isArray(baseline.files)||!DIGEST.test(baseline?.baseline_source_sha256||''))fail('CANO_EVIDENCE_BASELINE_INVENTORY_INVALID');
  const baselineMaterial={contract_version:baseline.contract_version,files:baseline.files};
  if(await hash(baselineMaterial)!==baseline.baseline_source_sha256)fail('CANO_EVIDENCE_BASELINE_INVENTORY_DIGEST_MISMATCH');
  if(trusted.baseline_source_sha256!==baseline.baseline_source_sha256){
    return {
      contract_version:CANO_EVIDENCE_VERIFY_VERSION,fixture_only:true,verification_status:'BASELINE_MISMATCH',bundle_status:marker.bundle_status,
      baseline_match:false,audit_match:false,inventory_verified:true,action_eligible:false,publication_admitted:false,
      expected_baseline_source_sha256:trusted.baseline_source_sha256,bundle_baseline_source_sha256:baseline.baseline_source_sha256,
      reason_codes:['CANO_EVIDENCE_BASELINE_MISMATCH']
    };
  }

  // Pin the installed execution chain, never a caller-supplied source root or bundle code.
  const executingBaseline=await computeReviewedPipelineBaseline({source_root:EXECUTING_SOURCE_ROOT});
  if(executingBaseline.baseline_source_sha256!==trusted.baseline_source_sha256){
    return {
      contract_version:CANO_EVIDENCE_VERIFY_VERSION,fixture_only:true,verification_status:'BASELINE_MISMATCH',bundle_status:marker.bundle_status,
      baseline_match:false,audit_match:false,inventory_verified:true,action_eligible:false,publication_admitted:false,
      expected_baseline_source_sha256:trusted.baseline_source_sha256,bundle_baseline_source_sha256:baseline.baseline_source_sha256,
      reason_codes:['CANO_EVIDENCE_EXECUTION_BASELINE_MISMATCH']
    };
  }
  const replay=await loadCanoImportFromLocalFiles({input_root:path.join(bundleRootReal,'snapshot'),manifest_file:'manifest.json'});
  const replayBytes=Buffer.from(canonicalAuditJson(replay),'utf8');
  if(!auditBytes.equals(replayBytes))fail('CANO_EVIDENCE_AUDIT_REPLAY_MISMATCH');
  const invalid=audit.aggregate_result?.status==='INVALID';
  return {
    contract_version:CANO_EVIDENCE_VERIFY_VERSION,fixture_only:true,
    verification_status:invalid?'DIAGNOSTIC_INVALID_BATCH':'VERIFIED_FIXTURE_ONLY',bundle_status:marker.bundle_status,
    baseline_match:true,audit_match:true,inventory_verified:true,action_eligible:false,publication_admitted:false,
    expected_baseline_source_sha256:trusted.baseline_source_sha256,bundle_baseline_source_sha256:baseline.baseline_source_sha256,
    reason_codes:invalid?['CANO_EVIDENCE_BATCH_INVALID_DIAGNOSTIC']:[]
  };
}

export function canonicalEvidenceJson(value){return stable(value)+'\n';}
export function evidenceExitCode(result){
  if(result?.verification_status==='VERIFIED_FIXTURE_ONLY')return 0;
  if(result?.verification_status==='DIAGNOSTIC_INVALID_BATCH')return 1;
  return 2;
}
