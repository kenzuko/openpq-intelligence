import {ContractError,hash,stable} from '../platform/contracts.js';
import {buildCanoShadowFromRaw} from './manual-cano-semantic.js';
import {reduceCanoLedger,wrapCanoRevision,CANO_PREFLIGHT_REJECTION_VERSION} from './manual-cano-lineage.js';

export const CANO_IMPORT_MANIFEST_VERSION='openpq-cano-offline-import-manifest-v1';
export const CANO_IMPORT_AUDIT_VERSION='openpq-cano-offline-audit-v1';
export const CANO_IMPORT_MODE='FIXTURE_ONLY';
export const CANO_IMPORT_MAX_RECORDS=64;
export const CANO_IMPORT_MAX_RAW_BYTES=8192;
export const CANO_IMPORT_MAX_MANIFEST_BYTES=131072;

const DIGEST=/^[a-f0-9]{64}$/;
const COMMIT=/^[a-f0-9]{40}$/;
const STAGE_ORDER=new Map([['MANIFEST',0],['PREFLIGHT',1],['LOAD',2],['NORMALIZE',3],['WRAP',4],['LEDGER',5]]);

function isObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function exactKeys(value,keys){
  if(!isObject(value))return false;
  const actual=Object.keys(value).sort(),expected=[...keys].sort();
  return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]);
}
function clone(value){return JSON.parse(stable(value));}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function immutable(value){return freeze(clone(value));}
function fail(code){throw new ContractError(code);}
function codeOf(error,fallback){return typeof error?.code==='string'?error.code:fallback;}
function pathSyntaxValid(value){
  if(typeof value!=='string'||value.length<1||value.length>512||value.includes('\0')||value.includes('\\')||value.startsWith('/')||/^[A-Za-z]:\//.test(value))return false;
  const parts=value.split('/');
  return parts.every(part=>part.length>0&&part!=='.'&&part!=='..');
}
function provenanceValid(value){
  return exactKeys(value,['repository','commit_sha','path','payload_sha256'])&&
    typeof value.repository==='string'&&value.repository.length>0&&value.repository.length<=128&&
    COMMIT.test(value.commit_sha)&&typeof value.path==='string'&&value.path.length>0&&value.path.length<=512&&DIGEST.test(value.payload_sha256);
}
function recordShapeValid(value){
  return exactKeys(value,['raw_file','provenance','supersedes'])&&pathSyntaxValid(value.raw_file)&&provenanceValid(value.provenance)&&
    (value.supersedes===null||DIGEST.test(value.supersedes));
}
function manifestShapeCode(manifest){
  if(!exactKeys(manifest,['contract_version','fixture_only','target','evaluation_time','records']))return 'CANO_IMPORT_MANIFEST_SCHEMA_INVALID';
  if(manifest.contract_version!==CANO_IMPORT_MANIFEST_VERSION)return 'CANO_IMPORT_MANIFEST_VERSION_UNSUPPORTED';
  if(manifest.fixture_only!==true)return 'CANO_IMPORT_FIXTURE_FENCE_VIOLATION';
  if(!Array.isArray(manifest.records))return 'CANO_IMPORT_MANIFEST_SCHEMA_INVALID';
  if(manifest.records.length<1)return 'CANO_IMPORT_RECORDS_REQUIRED';
  if(manifest.records.length>CANO_IMPORT_MAX_RECORDS)return 'CANO_IMPORT_BATCH_LIMIT_EXCEEDED';
  for(const record of manifest.records){
    if(!recordShapeValid(record)){
      if(isObject(record)&&typeof record.raw_file==='string'&&!pathSyntaxValid(record.raw_file))return 'CANO_IMPORT_RAW_PATH_INVALID';
      if(isObject(record)&&Object.hasOwn(record,'supersedes')&&!(record.supersedes===null||DIGEST.test(record.supersedes)))return 'CANO_IMPORT_SUPERSEDES_INVALID';
      return 'CANO_IMPORT_MANIFEST_SCHEMA_INVALID';
    }
  }
  return null;
}
function pointerHint(record){
  const p=record?.provenance;
  return provenanceValid(p)?{repository:p.repository,commit_sha:p.commit_sha,path:p.path}:null;
}
function emptyProjection(reasonCodes=[]){return {state:'UNRESOLVED',terminal_revision_id:null,reported_state:null,source_time:null,valid_to:null,reason_codes:[...reasonCodes],action_eligible:false,publication_admitted:false};}
function inputDiagnostic(index,record){
  return {index,raw_file:typeof record?.raw_file==='string'?record.raw_file:null,source_pointer:pointerHint(record),raw_sha256:null,declared_payload_sha256:typeof record?.provenance?.payload_sha256==='string'&&DIGEST.test(record.provenance.payload_sha256)?record.provenance.payload_sha256:null,normalize_status:'NOT_RUN',wrapper_status:'NOT_RUN',revision_id:null,wrapper_id:null,supersedes:typeof record?.supersedes==='string'&&DIGEST.test(record.supersedes)?record.supersedes:null,primary_error:null};
}
function sortErrors(errors){
  return [...errors].sort((a,b)=>{
    const ai=a.input_index===null?-1:a.input_index,bi=b.input_index===null?-1:b.input_index;
    return ai-bi||(STAGE_ORDER.get(a.stage)??99)-(STAGE_ORDER.get(b.stage)??99)||a.code.localeCompare(b.code);
  });
}
function unique(values){return [...new Set(values)];}
function canonicalDigestMaybe(value){return isObject(value)?hash(value):Promise.resolve(null);}
async function digestBytes(bytes){
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  const digest=await crypto.subtle.digest('SHA-256',view);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function decodeUtf8(bytes){
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('CANO_IMPORT_RAW_UTF8_INVALID');}
}
function loadedAt(loaded,index){return Array.isArray(loaded)?loaded.find(item=>item?.index===index):null;}
function addError(errors,input_index,stage,code){errors.push({input_index,stage,code});}
function applyPrimaryErrors(inputs,errors){
  for(const error of sortErrors(errors)){
    if(Number.isInteger(error.input_index)&&inputs[error.input_index]&&!inputs[error.input_index].primary_error)inputs[error.input_index].primary_error=error.code;
  }
}
function remapLedgerErrors(ledger,indexMap){
  if(!ledger||!Array.isArray(ledger.validation_errors))return ledger;
  const copy=clone(ledger);
  copy.validation_errors=copy.validation_errors.map(error=>({...error,input_index:indexMap[error.input_index]??error.input_index})).sort((a,b)=>a.input_index-b.input_index);
  return copy;
}
function reportBase({manifest,manifest_digest,manifest_payload_sha256,input_count,inputs,errors,diagnostic_ledger,batch_projection,aggregate_result}){
  return immutable({
    contract_version:CANO_IMPORT_AUDIT_VERSION,
    fixture_only:true,
    mode:CANO_IMPORT_MODE,
    manifest_contract_version:typeof manifest?.contract_version==='string'?manifest.contract_version:null,
    manifest_digest,
    manifest_payload_sha256:DIGEST.test(manifest_payload_sha256||'')?manifest_payload_sha256:null,
    limits:{max_records:CANO_IMPORT_MAX_RECORDS,max_raw_bytes:CANO_IMPORT_MAX_RAW_BYTES,max_manifest_bytes:CANO_IMPORT_MAX_MANIFEST_BYTES},
    target:isObject(manifest?.target)?clone(manifest.target):null,
    evaluation_time:typeof manifest?.evaluation_time==='string'?manifest.evaluation_time:null,
    input_count,
    inputs,
    diagnostic_ledger,
    batch_projection,
    aggregate_result,
    errors:sortErrors(errors),
    action_eligible:false,
    publication_admitted:false
  });
}

export function validateCanoImportManifest(manifest){
  const code=manifestShapeCode(manifest);
  if(code)fail(code);
  return immutable(manifest);
}

export async function preflightCanoImportManifest(manifest){
  const verified=validateCanoImportManifest(manifest);
  const preflight=await reduceCanoLedger({wrappers:[],target:verified.target,evaluation_time:verified.evaluation_time});
  if(preflight?.contract_version===CANO_PREFLIGHT_REJECTION_VERSION)return {ok:false,manifest:verified,rejection:preflight};
  return {ok:true,manifest:verified};
}

export async function runCanoImportPipeline({manifest,manifest_payload_sha256=null,loaded_records=[]}={}){
  const manifest_digest=await canonicalDigestMaybe(manifest);
  let verified;
  try{verified=validateCanoImportManifest(manifest);}catch(error){
    const code=codeOf(error,'CANO_IMPORT_MANIFEST_SCHEMA_INVALID');
    const count=Array.isArray(manifest?.records)?manifest.records.length:0;
    const inputs=Array.isArray(manifest?.records)?manifest.records.slice(0,CANO_IMPORT_MAX_RECORDS).map((record,index)=>inputDiagnostic(index,record)):[];
    const errors=[{input_index:null,stage:'MANIFEST',code}];
    return reportBase({manifest,manifest_digest,manifest_payload_sha256,input_count:count,inputs,errors,diagnostic_ledger:null,batch_projection:emptyProjection([code]),aggregate_result:{status:'INVALID',projection_status:'UNRESOLVED',reason_codes:[code]}});
  }

  const inputs=verified.records.map((record,index)=>inputDiagnostic(index,record));
  const preflight=await reduceCanoLedger({wrappers:[],target:verified.target,evaluation_time:verified.evaluation_time});
  if(preflight?.contract_version===CANO_PREFLIGHT_REJECTION_VERSION){
    const code=preflight.reason_codes[0]||'CANO_IMPORT_PREFLIGHT_INVALID';
    const errors=[{input_index:null,stage:'PREFLIGHT',code}];
    return reportBase({manifest:verified,manifest_digest,manifest_payload_sha256,input_count:inputs.length,inputs,errors,diagnostic_ledger:null,batch_projection:emptyProjection([code]),aggregate_result:{status:'INVALID',projection_status:'UNRESOLVED',reason_codes:[code]}});
  }

  const wrappers=[];const wrapperInputIndexes=[];const errors=[];
  for(let index=0;index<verified.records.length;index++){
    const record=verified.records[index],diag=inputs[index],loaded=loadedAt(loaded_records,index);
    if(!loaded||loaded.raw_file!==record.raw_file){addError(errors,index,'LOAD','CANO_IMPORT_RAW_NOT_LOADED');continue;}
    if(typeof loaded.load_error==='string'&&loaded.load_error){addError(errors,index,'LOAD',loaded.load_error);continue;}
    if(!(loaded.bytes instanceof Uint8Array)){addError(errors,index,'LOAD','CANO_IMPORT_RAW_NOT_LOADED');continue;}
    diag.raw_sha256=await digestBytes(loaded.bytes);
    if(loaded.bytes.byteLength>CANO_IMPORT_MAX_RAW_BYTES){addError(errors,index,'LOAD','CANO_IMPORT_RAW_PAYLOAD_TOO_LARGE');continue;}
    let raw;
    try{raw=decodeUtf8(loaded.bytes);}catch(error){addError(errors,index,'LOAD',codeOf(error,'CANO_IMPORT_RAW_UTF8_INVALID'));continue;}
    let shadow;
    try{
      shadow=await buildCanoShadowFromRaw(raw,record.provenance);
      diag.normalize_status=shadow.normalized_record.normalization_status;
      diag.revision_id=shadow.revision_id;
      diag.source_pointer=clone(shadow.source_pointer);
    }catch(error){
      const fallback=error instanceof SyntaxError?'CANO_IMPORT_RAW_JSON_INVALID':'CANO_IMPORT_NORMALIZE_FAILED';
      addError(errors,index,'NORMALIZE',codeOf(error,fallback));continue;
    }
    try{
      const wrapper=await wrapCanoRevision(shadow,{supersedes:record.supersedes});
      diag.wrapper_status='WRAPPED';diag.wrapper_id=wrapper.wrapper_id;
      wrappers.push(wrapper);wrapperInputIndexes.push(index);
    }catch(error){addError(errors,index,'WRAP',codeOf(error,'CANO_IMPORT_WRAP_FAILED'));}
  }

  let diagnosticLedger=null;
  if(wrappers.length){
    const rawLedger=await reduceCanoLedger({wrappers,target:verified.target,evaluation_time:verified.evaluation_time});
    diagnosticLedger=remapLedgerErrors(rawLedger,wrapperInputIndexes);
    for(const item of diagnosticLedger.validation_errors||[]){for(const code of item.reason_codes||[])addError(errors,item.input_index,'LEDGER',code);}
  }else{
    const rawLedger=await reduceCanoLedger({wrappers:[],target:verified.target,evaluation_time:verified.evaluation_time});
    diagnosticLedger=rawLedger;
  }

  applyPrimaryErrors(inputs,errors);
  const orderedErrors=sortErrors(errors);
  const preprocessingFailure=orderedErrors.some(error=>['LOAD','NORMALIZE','WRAP'].includes(error.stage));
  let batchProjection,aggregateResult;
  if(preprocessingFailure){
    const codes=unique([...orderedErrors.map(error=>error.code),'CANO_IMPORT_PARTIAL_FAILURE']);
    batchProjection=emptyProjection(['CANO_IMPORT_PARTIAL_FAILURE']);
    aggregateResult={status:'INVALID',projection_status:'UNRESOLVED',reason_codes:codes};
  }else if(diagnosticLedger?.ledger_status==='INVALID'){
    const codes=unique([...(diagnosticLedger.reason_codes||[]),...orderedErrors.map(error=>error.code)]);
    batchProjection=clone(diagnosticLedger.projection||emptyProjection());
    aggregateResult={status:'INVALID',projection_status:batchProjection.state||'UNRESOLVED',reason_codes:codes};
  }else{
    batchProjection=clone(diagnosticLedger?.projection||emptyProjection(['CANO_PROJECTION_NO_TERMINAL']));
    aggregateResult={status:'VALID',projection_status:batchProjection.state,reason_codes:unique(diagnosticLedger?.reason_codes||batchProjection.reason_codes||[])};
  }

  const diagnostic_ledger={diagnostic_only:preprocessingFailure,input_index_map:[...wrapperInputIndexes],result:diagnosticLedger};
  return reportBase({manifest:verified,manifest_digest,manifest_payload_sha256,input_count:inputs.length,inputs,errors:orderedErrors,diagnostic_ledger,batch_projection:batchProjection,aggregate_result:aggregateResult});
}
