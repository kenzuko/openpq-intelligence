import {ISOLATED_ACCOUNT_ID} from './domain-bridge-admission.js';
import {candidate,hash,instant,requireThat,stable} from './contracts.js';
import {clone,noSecrets} from '../preparation/common.js';
import {normalizeManualCano,STAGING_POLICY} from '../ingress/manual-cano.js';
import {gitBlobSha} from '../ingress/cano-real-shadow.js';

export const REAL_PROFILE_VERSION='openpq-real-cano-admission-local-v1';
export const ISOLATED_REAL_PROFILE_VERSION='openpq-real-cano-admission-isolated-v1';
export const isRealProfile=p=>[REAL_PROFILE_VERSION,ISOLATED_REAL_PROFILE_VERSION].includes(p.contract_version);
const isolated=p=>p.contract_version===ISOLATED_REAL_PROFILE_VERSION;
const bundleVersion=p=>isolated(p)?'openpq-real-cano-bundle-isolated-v1':REAL_BUNDLE_VERSION;
export const REAL_BUNDLE_VERSION='openpq-real-cano-bundle-local-v1';
export const REAL_RULE=Object.freeze({contract_version:REAL_PROFILE_VERSION,dataset_id:'cano.operation.an-thoi',source_kind:'OWNER_REPOSITORY_SNAPSHOT',fixture_only:false,scope_mapping:'manual-cano-an-thoi-v1',source_author_assurance:'SOURCE_RECORDED_ONLY',operator_capability:'manual-source-admit',amendment_admission:false,decision_effect:'ABSTAIN',production_enabled:false});
export const REAL_SCHEMA=Object.freeze({contract_version:REAL_BUNDLE_VERSION,fields:['contract_version','raw_utf8','source_pointer','payload_sha256','git_blob_sha'],raw_max_utf8_bytes:8192});
const exact=(v,keys,label)=>requireThat(v&&typeof v==='object'&&!Array.isArray(v)&&stable(Object.keys(v).sort())===stable([...keys].sort()),label+'_FIELDS_INVALID');
const digest=(v,n)=>requireThat(typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v),'REAL_CANO_DIGEST_INVALID');
function sourcePin(v){
 exact(v,['source_pointer','payload_sha256','git_blob_sha'],'REAL_SOURCE_PIN');
 const p=v.source_pointer;exact(p,['repository','commit_sha','path'],'REAL_SOURCE_POINTER');
 digest(p.commit_sha,40);digest(v.payload_sha256,64);digest(v.git_blob_sha,40);
 requireThat(p.repository===STAGING_POLICY.source_repository&&typeof p.path==='string'&&/^data\/marine_ops\/manual-confirmations\/\d{4}-\d\d-\d\d-cano-an-thoi\.json$/.test(p.path),'REAL_CANO_PIN_SCOPE_DENIED');
}
// These are contract/configuration hashes, not claims of independently signed source authorship.
export async function realCanoArtifactRefs(profile){
 profile=clone(profile);
 const artifacts={rule:await hash({...REAL_RULE,contract_version:profile.contract_version}),config:await hash({source_records:profile.source_records,operator_principal_ids:profile.operator_principal_ids}),policy:await hash(STAGING_POLICY),schema:await hash({...REAL_SCHEMA,contract_version:bundleVersion(profile)})};
 return Object.fromEntries(Object.entries(artifacts).map(([key,value])=>[key,{hash:value}]));
}
export async function validateRealCanoProfile(profile,trust){
 profile=clone(profile);trust=clone(trust);
 exact(profile,['contract_version','environment_id','dataset_id','source_kind','fixture_only','source_records','operator_principal_ids','artifact_refs'],'REAL_PROFILE');
 requireThat(isRealProfile(profile)&&profile.environment_id===(isolated(profile)?'isolated-test':'local-test')&&trust.environment_id===profile.environment_id&&(!isolated(profile)||trust.account_id===ISOLATED_ACCOUNT_ID)&&profile.dataset_id===REAL_RULE.dataset_id&&trust.dataset_id===profile.dataset_id&&profile.source_kind==='OWNER_REPOSITORY_SNAPSHOT'&&profile.fixture_only===false,'REAL_CANO_PROFILE_SCOPE_DENIED');
 requireThat(Array.isArray(profile.source_records)&&profile.source_records.length>0&&profile.source_records.length<=16,'REAL_CANO_PIN_SET_INVALID');
 const days=new Set();for(const row of profile.source_records){sourcePin(row);const day=row.source_pointer.path.slice(37,47);requireThat(!days.has(day),'REAL_CANO_DAY_AMENDMENT_REVIEW_REQUIRED');days.add(day);}
 requireThat(Array.isArray(profile.operator_principal_ids)&&profile.operator_principal_ids.length>0&&profile.operator_principal_ids.length<=8&&profile.operator_principal_ids.every(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(x))&&new Set(profile.operator_principal_ids).size===profile.operator_principal_ids.length,'REAL_CANO_OPERATOR_SET_INVALID');
 requireThat(stable(profile.artifact_refs)===stable(await realCanoArtifactRefs(profile)),'REAL_CANO_CONTRACT_ARTIFACT_MISMATCH',409);
 for(const k of ['rule','config','policy','schema'])requireThat(trust.artifacts[k]===profile.artifact_refs[k].hash,'SEMANTIC_AUTHORITY_ARTIFACT_MISMATCH',409);
 requireThat(await hash(profile)===trust.semantic_profile_hash,'SEMANTIC_PROFILE_PIN_MISMATCH',409);
 noSecrets(profile);return profile;
}
// actor must come from the Coordinator's authenticated server capability, never from the request body.
export function validateRealCanoActor(profile,actor,boundPrincipalId){
 requireThat(actor&&actor.mode==='LIVE'&&actor.environment_id===profile.environment_id&&actor.dataset_id===profile.dataset_id&&Array.isArray(actor.permissions)&&actor.permissions.includes('manual-source-admit')&&profile.operator_principal_ids.includes(actor.id),'REAL_CANO_OPERATOR_DENIED',403);
 requireThat(boundPrincipalId===actor.id,'REAL_CANO_OPERATOR_BINDING_MISMATCH',403);
}
async function projection(profile,trust,bundle,evaluation_time,principal_id){
 exact(bundle,REAL_SCHEMA.fields,'REAL_BUNDLE');requireThat(bundle.contract_version===bundleVersion(profile),'REAL_CANO_BUNDLE_VERSION_DENIED');
 requireThat(typeof bundle.raw_utf8==='string'&&new TextEncoder().encode(bundle.raw_utf8).length<=8192,'REAL_CANO_RAW_LIMIT',413);
 const pin={source_pointer:bundle.source_pointer,payload_sha256:bundle.payload_sha256,git_blob_sha:bundle.git_blob_sha};sourcePin(pin);
 requireThat(profile.source_records.some(p=>stable(p)===stable(pin)),'REAL_CANO_SOURCE_NOT_PINNED',409);
 requireThat(await hash(bundle.raw_utf8)===pin.payload_sha256&&await gitBlobSha(new TextEncoder().encode(bundle.raw_utf8))===pin.git_blob_sha,'REAL_CANO_RAW_PIN_MISMATCH',409);
 const record=await normalizeManualCano(bundle.raw_utf8,{...pin.source_pointer,payload_sha256:pin.payload_sha256});
 requireThat(record.normalization_status==='NORMALIZED_SHADOW','REAL_CANO_SOURCE_METADATA_BLOCKED',409);
 const at=instant(evaluation_time,'REAL_ADMISSION_TIME'),from=instant(record.valid_from,'REAL_FROM'),to=instant(record.valid_to,'REAL_TO');
 requireThat(from<=at&&at<to,'REAL_CANO_SOURCE_OUTSIDE_VALIDITY',409);
 // max_age_ms is exactly the explicit source-day validity duration, not a synthetic P05 threshold.
 const inputs=[{source_id:record.source.source_id,source_type:'MANUAL',source_time:record.source_time,valid_to:record.valid_to,max_age_ms:to-from}];
 const quality={completeness:'COMPLETE',resolution:'RESOLVED'};
 const payload={real_manual_cano:{contract_version:isolated(profile)?'openpq-real-cano-fact-isolated-v1':'openpq-real-cano-fact-local-v1',mode:isolated(profile)?'ISOLATED_REAL_SOURCE_REFERENCE':'LOCAL_REAL_SOURCE_FACT',fixture_only:false,source_kind:profile.source_kind,record,operational_action_allowed:false,production_enabled:false}};
 const proof={contract_version:profile.contract_version,profile_hash:trust.semantic_profile_hash,input_hash:pin.payload_sha256,preparation_hash:record.record_digest,valid_until:record.valid_to,operator_principal_id:principal_id,source_author_assurance:'SOURCE_RECORDED_ONLY',action_allowed:false};
 const decision={type:'cano.manual.recorded.fact',kind:'FACT',effect:'ABSTAIN',action_until:record.valid_to,minimum_evidence_met:false,reason_codes:[isolated(profile)?'ISOLATED_RECORDED_SOURCE_FACT_NO_ACTION':'LOCAL_RECORDED_SOURCE_FACT_NO_ACTION']};
 return {record,inputs,quality,payload,proof,decision};
}
export async function validateRealCanoAdmission(profile,trust,c,evaluation_time,actor){
 // Capture mutable caller values before hashing. Worker requests are independently decoded JSON.
 profile=clone(profile);trust=clone(trust);c=clone(c);actor=clone(actor||{});
 await validateRealCanoProfile(profile,trust);validateRealCanoActor(profile,actor,c.semantic_admission?.operator_principal_id);
 requireThat(c.semantic_profile_hash===trust.semantic_profile_hash,'SEMANTIC_CANDIDATE_PROFILE_MISMATCH',409);noSecrets(c);
 requireThat(c.operation==='NORMAL'&&c.dataset_id===profile.dataset_id,'REAL_CANO_OPERATION_DENIED',409);
 requireThat(stable(c.artifacts)===stable(trust.artifacts),'SEMANTIC_CANDIDATE_ARTIFACT_MISMATCH',409);
 const p=await projection(profile,trust,c.semantic_bundle,evaluation_time,actor.id);
 requireThat(stable(c.payload)===stable(p.payload)&&stable(c.quality)===stable(p.quality),'REAL_CANO_OUTPUT_MISMATCH',409);
 requireThat(stable(c.inputs)===stable(p.inputs),'REAL_CANO_INPUT_MISMATCH',409);
 requireThat(c.valid_from===p.record.valid_from&&c.valid_to===p.record.valid_to&&instant(c.evaluation_time,'REAL_CANDIDATE_EVALUATION')>=instant(p.record.valid_from,'REAL_FROM')&&instant(c.evaluation_time,'REAL_CANDIDATE_EVALUATION')<=instant(evaluation_time,'REAL_NOW'),'REAL_CANO_VALIDITY_MISMATCH',409);
 requireThat(stable(c.decision)===stable(p.decision),'REAL_CANO_ACTION_FORBIDDEN',409);
 requireThat(stable(c.semantic_admission)===stable(p.proof),'REAL_CANO_PROOF_MISMATCH',409);
 return p.proof;
}
// Local producer helper carries an untrusted principal claim; Coordinator independently authenticates it.
export async function buildRealCanoCandidate(profile,trust,{bundle,operator_principal_id,evaluation_time,candidate_id,expected_revision=0,expected_control_revision=0,logical_slot=0}){
 profile=clone(profile);trust=clone(trust);bundle=clone(bundle);
 await validateRealCanoProfile(profile,trust);
 requireThat(profile.operator_principal_ids.includes(operator_principal_id),'REAL_CANO_OPERATOR_CLAIM_DENIED');
 const p=await projection(profile,trust,bundle,evaluation_time,operator_principal_id);
 const c={schema_version:'openpq-candidate-v1',...trust,candidate_id,expected_revision,expected_control_revision,logical_slot,evaluation_time,valid_from:p.record.valid_from,valid_to:p.record.valid_to,inputs:p.inputs,quality:p.quality,artifacts:trust.artifacts,payload:p.payload,operation:'NORMAL',decision:p.decision,semantic_bundle:bundle,semantic_admission:p.proof};
 candidate(c,instant(evaluation_time,'REAL_EVALUATION'));return c;
}
