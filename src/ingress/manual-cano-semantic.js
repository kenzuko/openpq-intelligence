import {ContractError,hash,stable} from '../platform/contracts.js';
import {normalizeManualCano} from './manual-cano.js';

export const CANO_SHADOW_VERSION='openpq-cano-manual-shadow-v1';
export const CANO_REVISION_ID_VERSION='openpq-cano-revision-id-v1';
export const CANO_DATASET_ID='cano.operation.an-thoi';
export const CANO_POLICY_HASH='94172ce2e50559cad50e314598bbea5bad467cad0fa09973c82b0f58bcb85358';
export const CANO_SERVICE_AREA='An Thới, Phú Quốc';
export const CANO_TIMEZONE='Asia/Ho_Chi_Minh';
export const CANO_MAPPING_ID='manual-cano-an-thoi-v1';
export const CANO_SOURCE_REPOSITORY='kenzuko/Jotrip-Lab';
export const CANO_SOURCE_ID='JOTRIP_FIELD_CONFIRMATION';
export const CANO_SOURCE_TYPE='MANUAL';
export const CANO_IDENTITY_ASSURANCE='SOURCE_RECORDED_ONLY';

const DIGEST=/^[a-f0-9]{64}$/;
const COMMIT=/^[a-f0-9]{40}$/;
const UTC_MILLIS=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const STATES=new Set(['RUNNING','SUSPENDED','RESTRICTED','FIELD_REQUIRED','UNKNOWN']);
const NORMALIZATION_STATUSES=new Set(['NORMALIZED_SHADOW','QUARANTINED']);
const REASONS=new Set(['MANUAL_AUTHOR_NOT_EXPLICIT','MANUAL_CONFIRMATION_MISSING']);

function fail(code){throw new ContractError(code);}
function isObject(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function exactKeys(value,keys){
  if(!isObject(value))return false;
  const actual=Object.keys(value).sort(),expected=[...keys].sort();
  return actual.length===expected.length&&actual.every((x,i)=>x===expected[i]);
}
function clone(value){return JSON.parse(stable(value));}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function immutable(value){return freeze(clone(value));}
function canonicalUtcMillis(value){
  if(typeof value!=='string'||!UTC_MILLIS.test(value))return false;
  const n=Date.parse(value);return Number.isFinite(n)&&new Date(n).toISOString()===value;
}
function validDay(value){
  if(typeof value!=='string'||!DAY.test(value))return false;
  const [y,m,d]=value.split('-').map(Number);
  const n=Date.UTC(y,m-1,d);
  if(!Number.isFinite(n))return false;
  const dt=new Date(n);
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}
function nextLocalMidnightUtc(day){
  if(!validDay(day))return null;
  const [y,m,d]=day.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d+1)-7*3600000).toISOString();
}
function localDayForUtc(value){
  if(!canonicalUtcMillis(value))return null;
  return new Date(Date.parse(value)+7*3600000).toISOString().slice(0,10);
}
function localDayStartUtc(day){
  if(!validDay(day))return null;
  const [y,m,d]=day.split('-').map(Number);
  return Date.UTC(y,m-1,d)-7*3600000;
}
function sourcePath(day){return `data/marine_ops/manual-confirmations/${day}-cano-an-thoi.json`;}
function expectedReasons(record){
  const out=[];
  if(record.source_author===null)out.push('MANUAL_AUTHOR_NOT_EXPLICIT');
  if(record.reported_state==='UNKNOWN'||record.reported_state==='FIELD_REQUIRED')out.push('MANUAL_CONFIRMATION_MISSING');
  return out;
}
function shapeShadow(shadow){
  if(!exactKeys(shadow,['contract_version','fixture_only','source_pointer','normalized_record','normalized_record_digest','revision_id','action_eligible','publication_admitted']))fail('CANO_SCHEMA_INVALID');
  if(typeof shadow.contract_version!=='string'||typeof shadow.fixture_only!=='boolean'||typeof shadow.action_eligible!=='boolean'||typeof shadow.publication_admitted!=='boolean')fail('CANO_SCHEMA_INVALID');
  const p=shadow.source_pointer;
  if(!exactKeys(p,['repository','commit_sha','path'])||typeof p.repository!=='string'||!COMMIT.test(p.commit_sha)||typeof p.path!=='string'||p.path.length===0)fail('CANO_SCHEMA_INVALID');
  if(!DIGEST.test(shadow.normalized_record_digest)||!DIGEST.test(shadow.revision_id))fail('CANO_SCHEMA_INVALID');
  const r=shadow.normalized_record;
  if(!exactKeys(r,['contract_version','mode','dataset_id','source','policy_hash','scope','source_time','valid_from','valid_to','reported_state','source_author','normalization_status','reason_codes','publication_admitted']))fail('CANO_SCHEMA_INVALID');
  if(typeof r.contract_version!=='string'||typeof r.mode!=='string'||typeof r.dataset_id!=='string'||!DIGEST.test(r.policy_hash)||typeof r.publication_admitted!=='boolean')fail('CANO_SCHEMA_INVALID');
  const s=r.source;
  if(!exactKeys(s,['repository','commit_sha','path','payload_sha256','source_id','source_type','identity_assurance'])||typeof s.repository!=='string'||!COMMIT.test(s.commit_sha)||typeof s.path!=='string'||!DIGEST.test(s.payload_sha256)||typeof s.source_id!=='string'||typeof s.source_type!=='string'||typeof s.identity_assurance!=='string')fail('CANO_SCHEMA_INVALID');
  const sc=r.scope;
  if(!exactKeys(sc,['category','service_area','operational_day','timezone','mapping_id'])||Object.values(sc).some(v=>typeof v!=='string'||v.length===0))fail('CANO_SCHEMA_INVALID');
  if(typeof r.source_time!=='string'||typeof r.valid_from!=='string'||typeof r.valid_to!=='string'||typeof r.reported_state!=='string'||!(r.source_author===null||typeof r.source_author==='string')||typeof r.normalization_status!=='string'||!Array.isArray(r.reason_codes)||!r.reason_codes.every(x=>typeof x==='string'))fail('CANO_SCHEMA_INVALID');
}
function assertFence(shadow){
  if(shadow.contract_version!==CANO_SHADOW_VERSION||shadow.fixture_only!==true||shadow.action_eligible!==false||shadow.publication_admitted!==false||shadow.normalized_record?.publication_admitted!==false)fail('CANO_FIXTURE_FENCE_VIOLATION');
}
function assertNormalizedCoherence(record){
  const scope=record.scope,source=record.source;
  const reasons=expectedReasons(record);
  const semanticOk=
    record.contract_version==='openpq-manual-cano-stage-v1'&&record.mode==='SHADOW'&&record.dataset_id===CANO_DATASET_ID&&
    source.repository===CANO_SOURCE_REPOSITORY&&source.source_id===CANO_SOURCE_ID&&source.source_type===CANO_SOURCE_TYPE&&source.identity_assurance===CANO_IDENTITY_ASSURANCE&&
    record.policy_hash===CANO_POLICY_HASH&&scope.category==='cano'&&scope.service_area===CANO_SERVICE_AREA&&scope.timezone===CANO_TIMEZONE&&scope.mapping_id===CANO_MAPPING_ID&&
    validDay(scope.operational_day)&&source.path===sourcePath(scope.operational_day)&&
    canonicalUtcMillis(record.source_time)&&canonicalUtcMillis(record.valid_from)&&canonicalUtcMillis(record.valid_to)&&
    record.source_time.endsWith('.000Z')&&record.source_time===record.valid_from&&localDayForUtc(record.source_time)===scope.operational_day&&record.valid_to===nextLocalMidnightUtc(scope.operational_day)&&
    Date.parse(record.source_time)>=localDayStartUtc(scope.operational_day)&&Date.parse(record.source_time)<Date.parse(record.valid_to)&&
    STATES.has(record.reported_state)&&(record.source_author===null||record.source_author==='kenzuko')&&NORMALIZATION_STATUSES.has(record.normalization_status)&&
    record.reason_codes.length===new Set(record.reason_codes).size&&record.reason_codes.every(x=>REASONS.has(x))&&stable(record.reason_codes)===stable(reasons)&&
    record.normalization_status===(reasons.length?'QUARANTINED':'NORMALIZED_SHADOW');
  if(!semanticOk)fail('NORMALIZED_RECORD_INCONSISTENT');
}
function pointerFromRecord(record){return {repository:record.source.repository,commit_sha:record.source.commit_sha,path:record.source.path};}

export async function computeCanoRevisionIdentity(normalizedRecord,sourcePointer){
  const normalized_record_digest=await hash(normalizedRecord);
  const material={identity_version:CANO_REVISION_ID_VERSION,dataset_id:normalizedRecord.dataset_id,scope:normalizedRecord.scope,source_pointer:sourcePointer,normalized_record_digest};
  return {normalized_record_digest,revision_id:await hash(material),material:immutable(material)};
}

export async function validateCanoShadow(shadow){
  shapeShadow(shadow);
  assertFence(shadow);
  assertNormalizedCoherence(shadow.normalized_record);
  const pointer=pointerFromRecord(shadow.normalized_record);
  if(stable(pointer)!==stable(shadow.source_pointer))fail('CANO_SOURCE_POINTER_MISMATCH');
  const normalizedDigest=await hash(shadow.normalized_record);
  if(normalizedDigest!==shadow.normalized_record_digest)fail('CANO_NORMALIZED_DIGEST_MISMATCH');
  const identity=await computeCanoRevisionIdentity(shadow.normalized_record,shadow.source_pointer);
  if(identity.revision_id!==shadow.revision_id)fail('CANO_REVISION_ID_MISMATCH');
  return immutable(shadow);
}

export async function buildCanoShadowFromRaw(raw,provenance){
  const normalized=await normalizeManualCano(raw,provenance);
  const {record_digest,...normalized_record}=normalized;
  const recomputed=await hash(normalized_record);
  if(recomputed!==record_digest)fail('CANO_NORMALIZED_DIGEST_MISMATCH');
  assertNormalizedCoherence(normalized_record);
  const source_pointer=pointerFromRecord(normalized_record);
  const {revision_id}=await computeCanoRevisionIdentity(normalized_record,source_pointer);
  const shadow={contract_version:CANO_SHADOW_VERSION,fixture_only:true,source_pointer,normalized_record,normalized_record_digest:recomputed,revision_id,action_eligible:false,publication_admitted:false};
  return validateCanoShadow(shadow);
}
