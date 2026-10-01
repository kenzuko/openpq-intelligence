import {hash,instant,object,requireThat,stable} from '../platform/contracts.js';
export const MANUAL_REPO='kenzuko/Jotrip-Lab';
export const STAGING_PREFIX='staging/manual-cano/';
export const STAGING_POLICY=Object.freeze({contract_version:'openpq-manual-cano-stage-v1',environment:'isolated-test',source_repository:MANUAL_REPO,source_path_prefix:'data/marine_ops/manual-confirmations/',source_schema:'marine-ops-manual-1.0',source_category:'cano',source_identity:'JOTRIP_FIELD_CONFIRMATION',source_area:'Phú Quốc / An Thới',recorded_author:'kenzuko',identity_assurance:'SOURCE_RECORDED_ONLY',operational_timezone:'Asia/Ho_Chi_Minh',validity:'from-explicit-confirmation-to-next-local-midnight',storage:'selected-owned-manual-fields-only',permission_basis:'Owner instructed staging of existing project data in this session',admission:'SHADOW_ONLY_NO_PUBLICATION'});
function day(value){
  requireThat(typeof value==='string'&&/^\d\d\/\d\d\/\d{4}$/.test(value),'MANUAL_DAY_INVALID');
  const [d,m,y]=value.split('/').map(Number);const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  instant(iso+'T00:00:00Z','MANUAL_DAY');return iso;
}
function recorded(value){
  requireThat(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+07:00$/.test(value),'MANUAL_SOURCE_TIME_REQUIRED');
  const local=value.slice(0,-6);const utc=instant(local+'Z','MANUAL_SOURCE_LOCAL')-7*3600000;return {utc,iso:new Date(utc).toISOString(),day:local.slice(0,10)};
}
export async function normalizeManualCano(raw,provenance){
  requireThat(typeof raw==='string'&&new TextEncoder().encode(raw).length<=8192,'MANUAL_PAYLOAD_TOO_LARGE',413);object(provenance,'PROVENANCE');
  requireThat(provenance.repository===MANUAL_REPO&&/^[a-f0-9]{40}$/.test(provenance.commit_sha),'MANUAL_ORIGIN_FORBIDDEN');
  requireThat(/^[a-f0-9]{64}$/.test(provenance.payload_sha256)&&await hash(raw)===provenance.payload_sha256,'MANUAL_PAYLOAD_HASH_MISMATCH');
  const data=JSON.parse(raw);object(data,'MANUAL');requireThat(data.schema_version===STAGING_POLICY.source_schema&&data.category==='cano','MANUAL_SOURCE_SCHEMA_DENIED');
  const sourceDay=day(data.date),time=recorded(data.recorded_at_vn);
  requireThat(time.day===sourceDay,'MANUAL_TIME_DAY_MISMATCH');
  requireThat(provenance.path===STAGING_POLICY.source_path_prefix+sourceDay+'-cano-an-thoi.json','MANUAL_PATH_SCOPE_MISMATCH');
  object(data.evidence,'MANUAL_EVIDENCE');
  requireThat(data.evidence.category==='cano'&&data.evidence.source===STAGING_POLICY.source_identity&&data.evidence.source_tier==='FIELD'&&data.evidence.evidence_class==='DIRECT','MANUAL_EVIDENCE_CLASS_DENIED');
  requireThat(data.evidence.area===STAGING_POLICY.source_area&&[`Ngày ${data.date} - cano du lịch An Thới, Phú Quốc`,`Ngày ${data.date} - cano du lịch khu vực An Thới, Phú Quốc`].includes(data.valid_scope),'MANUAL_LOCATION_SCOPE_UNRESOLVED');
  requireThat(['RUNNING','SUSPENDED','RESTRICTED','FIELD_REQUIRED','UNKNOWN'].includes(data.state),'MANUAL_STATE_UNSUPPORTED');
  const midnight=instant(sourceDay+'T00:00:00Z','MANUAL_DAY')-7*3600000;
  const reasons=[];
  if(data.confirmed_by!==STAGING_POLICY.recorded_author)reasons.push('MANUAL_AUTHOR_NOT_EXPLICIT');
  if(['FIELD_REQUIRED','UNKNOWN'].includes(data.state))reasons.push('MANUAL_CONFIRMATION_MISSING');
  const record={contract_version:STAGING_POLICY.contract_version,mode:'SHADOW',dataset_id:'cano.operation.an-thoi',source:{repository:provenance.repository,commit_sha:provenance.commit_sha,path:provenance.path,payload_sha256:provenance.payload_sha256,source_id:STAGING_POLICY.source_identity,source_type:'MANUAL',identity_assurance:'SOURCE_RECORDED_ONLY'},policy_hash:await hash(STAGING_POLICY),scope:{category:'cano',service_area:'An Thới, Phú Quốc',operational_day:sourceDay,timezone:STAGING_POLICY.operational_timezone,mapping_id:'manual-cano-an-thoi-v1'},source_time:time.iso,valid_from:time.iso,valid_to:new Date(midnight+86400000).toISOString(),reported_state:data.state,source_author:data.confirmed_by===STAGING_POLICY.recorded_author?data.confirmed_by:null,normalization_status:reasons.length?'QUARANTINED':'NORMALIZED_SHADOW',reason_codes:reasons,publication_admitted:false};
  return {...record,record_digest:await hash(record)};
}
export function stagingView(record,now){
  requireThat(Number.isFinite(now),'STAGING_CLOCK_REQUIRED');
  const from=instant(record.valid_from,'VALID_FROM'),to=instant(record.valid_to,'VALID_TO');
  return {evaluated_at:new Date(now).toISOString(),source_age_ms:now-instant(record.source_time,'SOURCE_TIME'),freshness:now<from?'NOT_YET_EFFECTIVE':now>=to?'EXPIRED':'WITHIN_EXPLICIT_VALIDITY',record_status:record.normalization_status,action_eligible:false,publication_admitted:false,g1:'NOT_PASSED',g2:'NOT_PASSED'};
}
export function stagingKey(record){return STAGING_PREFIX+record.source.commit_sha+'/'+record.record_digest+'.json';}
