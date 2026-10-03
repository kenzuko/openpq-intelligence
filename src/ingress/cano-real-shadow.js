import {ContractError,hash,stable} from '../platform/contracts.js';
import {normalizeManualCano,stagingView} from './manual-cano.js';

export const REAL_CANO_INTAKE_VERSION='openpq-cano-real-shadow-intake-v1';
export const REAL_CANO_AUDIT_VERSION='openpq-cano-real-shadow-audit-v1';
const SHA256=/^[a-f0-9]{64}$/,SHA1=/^[a-f0-9]{40}$/;
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const fail=code=>{throw new ContractError(code);};
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&stable(Object.keys(value).sort())===stable([...keys].sort());
const digest=async(algorithm,bytes)=>[...new Uint8Array(await crypto.subtle.digest(algorithm,bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function sha256Bytes(bytes){return digest('SHA-256',bytes);}
export async function gitBlobSha(bytes){
 const prefix=new TextEncoder().encode('blob '+bytes.byteLength+'\0');const content=new Uint8Array(prefix.length+bytes.byteLength);content.set(prefix);content.set(bytes,prefix.length);return digest('SHA-1',content);
}
export function safeIntakePath(value){return typeof value==='string'&&value.length>0&&value.length<=512&&!value.includes('\\')&&!value.includes('\0')&&!value.startsWith('/')&&!/^[A-Za-z]:/.test(value)&&value.split('/').every(p=>p&&p!=='.'&&p!=='..');}
export function validateRealCanoManifest(manifest){
 if(!exact(manifest,['contract_version','mode','fixture_only','source_kind','dataset_id','snapshot_commit_sha','evaluation_time','records']))fail('REAL_CANO_MANIFEST_INVALID');
 if(manifest.contract_version!==REAL_CANO_INTAKE_VERSION||manifest.mode!=='SHADOW_ONLY'||manifest.dataset_id!=='cano.operation.an-thoi'||(typeof manifest.snapshot_commit_sha!=='string'||!SHA1.test(manifest.snapshot_commit_sha)))fail('REAL_CANO_MANIFEST_INVALID');
 if(!((manifest.source_kind==='OWNER_REPOSITORY_SNAPSHOT'&&manifest.fixture_only===false)||(manifest.source_kind==='SYNTHETIC_TEST'&&manifest.fixture_only===true)))fail('REAL_CANO_SOURCE_KIND_FENCE');
 if(typeof manifest.evaluation_time!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(manifest.evaluation_time)||!Number.isFinite(Date.parse(manifest.evaluation_time))||new Date(manifest.evaluation_time).toISOString()!==manifest.evaluation_time)fail('REAL_CANO_EVALUATION_TIME_INVALID');
 if(!Array.isArray(manifest.records)||manifest.records.length<1||manifest.records.length>64)fail('REAL_CANO_RECORD_LIMIT');
 for(const r of manifest.records){
  if(!exact(r,['source_pointer','raw_file','payload_sha256','git_blob_sha'])||!safeIntakePath(r.raw_file)||typeof r.payload_sha256!=='string'||!SHA256.test(r.payload_sha256)||typeof r.git_blob_sha!=='string'||!SHA1.test(r.git_blob_sha)||!exact(r.source_pointer,['repository','commit_sha','path'])||r.source_pointer.repository!=='kenzuko/Jotrip-Lab'||(typeof r.source_pointer.commit_sha!=='string'||!SHA1.test(r.source_pointer.commit_sha))||!safeIntakePath(r.source_pointer.path)||!r.source_pointer.path.startsWith('data/marine_ops/manual-confirmations/'))fail('REAL_CANO_RECORD_INVALID');
 }
 return manifest;
}

// Diagnostic intake only. It neither authenticates an operator nor emits a Coordinator candidate.
// It deliberately does not run the fixture-only correction ledger on real bytes.
export async function auditRealCanoShadow({manifest,loaded_records,manifest_payload_sha256,expected_manifest_sha256}){
 manifest=JSON.parse(stable(manifest));
 validateRealCanoManifest(manifest);
 if(typeof expected_manifest_sha256!=='string'||!SHA256.test(expected_manifest_sha256)||manifest_payload_sha256!==expected_manifest_sha256)fail('REAL_CANO_MANIFEST_PIN_MISMATCH');
 if(!Array.isArray(loaded_records)||loaded_records.length!==manifest.records.length)fail('REAL_CANO_LOAD_SET_INCOMPLETE');
 const seenIndexes=new Set();for(const row of loaded_records){if(!Number.isInteger(row?.index)||row.index<0||row.index>=manifest.records.length||seenIndexes.has(row.index))fail('REAL_CANO_LOAD_SET_INVALID');seenIndexes.add(row.index);}
 loaded_records=loaded_records.map(row=>({index:row.index,load_error:row.load_error??(row.bytes instanceof Uint8Array&&row.bytes.byteLength>8192?'REAL_CANO_RAW_LIMIT':null),bytes:row.bytes instanceof Uint8Array&&row.bytes.byteLength<=8192?new Uint8Array(row.bytes):null}));
 const inputs=[],pointerContent=new Map(),uniqueOccurrences=new Map();
 for(const item of manifest.records){const key=stable(item.source_pointer);if(!pointerContent.has(key))pointerContent.set(key,new Set());pointerContent.get(key).add(item.payload_sha256);}
 for(let index=0;index<manifest.records.length;index++){
  const item=manifest.records[index],loaded=loaded_records.find(r=>r.index===index);
  const input={index,source_pointer:structuredClone(item.source_pointer),declared_payload_sha256:item.payload_sha256,declared_git_blob_sha:item.git_blob_sha,record_id:null,actual_payload_sha256:null,status:'REJECTED',reason_codes:[],normalized_record:null,view:null};
  try{
   if(loaded.load_error)fail(loaded.load_error);
   if(!(loaded.bytes instanceof Uint8Array))fail('REAL_CANO_RAW_BYTES_REQUIRED');
   if(loaded.bytes.byteLength>8192)fail('REAL_CANO_RAW_LIMIT');
   input.actual_payload_sha256=await sha256Bytes(loaded.bytes);
   if(input.actual_payload_sha256!==item.payload_sha256)fail('REAL_CANO_PAYLOAD_HASH_MISMATCH');
   if(await gitBlobSha(loaded.bytes)!==item.git_blob_sha)fail('REAL_CANO_GIT_BLOB_MISMATCH');
   let raw;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(loaded.bytes);}catch{fail('REAL_CANO_RAW_UTF8_INVALID');}
   if(pointerContent.get(stable(item.source_pointer)).size>1)fail('REAL_CANO_SOURCE_POINTER_CONFLICT');
   input.record_id=await hash({contract_version:'openpq-cano-real-source-occurrence-v1',source_pointer:item.source_pointer,payload_sha256:item.payload_sha256,git_blob_sha:item.git_blob_sha});
   const normalized=await normalizeManualCano(raw,{...item.source_pointer,payload_sha256:item.payload_sha256});
   input.normalized_record=normalized;input.view=stagingView(normalized,Date.parse(manifest.evaluation_time));
   input.reason_codes=[...normalized.reason_codes];
   input.status=normalized.normalization_status==='NORMALIZED_SHADOW'?'CONTRACT_READY_SHADOW_ONLY':'QUARANTINED_SOURCE_METADATA';
   if(input.view.freshness==='NOT_YET_EFFECTIVE'){input.status='QUARANTINED_SOURCE_TIME';input.reason_codes.push('REAL_CANO_SOURCE_TIME_IN_FUTURE');}
   uniqueOccurrences.set(input.record_id,input);
  }catch(error){input.reason_codes.push(typeof error?.code==='string'?error.code:'REAL_CANO_NORMALIZATION_FAILED');}
  inputs.push(input);
 }
 const blocked=inputs.some(x=>x.status!=='CONTRACT_READY_SHADOW_ONLY');
 const dayMap=new Map();
 for(const input of uniqueOccurrences.values()){
  const day=input.normalized_record.scope.operational_day;
  if(!dayMap.has(day))dayMap.set(day,[]);dayMap.get(day).push(input);
 }
 const days=[...dayMap].sort(([a],[b])=>a.localeCompare(b)).map(([operational_day,records])=>{
  const variants=[...new Set(records.map(r=>r.actual_payload_sha256))].sort();
  const reasons=[];
  if(variants.length>1)reasons.push('REAL_CANO_CORRECTION_REVIEW_REQUIRED');
  if(records.some(r=>r.status!=='CONTRACT_READY_SHADOW_ONLY'))reasons.push('REAL_CANO_SOURCE_METADATA_REVIEW_REQUIRED');
  if(blocked)reasons.push('REAL_CANO_BATCH_PARTIAL_FAILURE_FENCE');
  const temporalStates=[...new Set(records.map(r=>r.view.freshness))];
  const temporal=temporalStates.length===1?temporalStates[0]:null;
  return {operational_day,record_ids:records.map(r=>r.record_id).sort(),raw_variant_sha256s:variants,diagnostic_status:reasons.length?'REVIEW_REQUIRED':temporal,reason_codes:reasons,selected_record_id:null,action_eligible:false,publication_admitted:false};
 });
 return freeze({contract_version:REAL_CANO_AUDIT_VERSION,mode:'SHADOW_ONLY',fixture_only:manifest.fixture_only,source_kind:manifest.source_kind,dataset_id:manifest.dataset_id,snapshot_commit_sha:manifest.snapshot_commit_sha,evaluation_time:manifest.evaluation_time,manifest_payload_sha256,status:blocked||days.some(day=>day.raw_variant_sha256s.length>1)?'BLOCKED_SHADOW_BATCH':'CONTRACT_READY_SHADOW_BATCH',input_count:inputs.length,unique_normalized_occurrences:uniqueOccurrences.size,contract_ready_count:inputs.filter(r=>r.status==='CONTRACT_READY_SHADOW_ONLY').length,quarantined_count:inputs.filter(r=>r.status.startsWith('QUARANTINED')).length,rejected_count:inputs.filter(r=>r.status==='REJECTED').length,duplicate_occurrence_count:inputs.filter(r=>r.record_id&&uniqueOccurrences.has(r.record_id)).length-uniqueOccurrences.size,inputs,days,batch_projection:'NOT_ADMITTED',source_identity_assurance:'SOURCE_RECORDED_ONLY',operator_authenticated:false,real_data_admission:false,production_ready:false,action_eligible:false,publication_admitted:false});
}
