import {hash,instant,object,requireThat,stable,text} from '../platform/contracts.js';

export const SEMANTIC_VERSION='openpq-semantic-fixture-v1';
const types=['OBSERVATION','FORECAST','MANUAL','OFFICIAL_REPORT'];
const enums=(value,allowed,label)=>requireThat(allowed.includes(value),label+'_INVALID');
export function digest(value,label='DIGEST'){requireThat(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),label+'_INVALID');return value;}
export function ref(value,label='REF'){
  object(value,label);text(value.artifact_id,label+'_ID');text(value.version,label+'_VERSION');digest(value.hash,label+'_HASH');return value;
}
export function scope(value){
  object(value,'SCOPE');
  for(const key of ['domain','subject_id','entity_version','location_id','location_version'])text(value[key],'SCOPE_'+key);
  return value;
}
export function interval(value,label='VALIDITY'){
  object(value,label);requireThat(instant(value.valid_from,label+'_FROM')<instant(value.valid_to,label+'_TO'),label+'_EMPTY');return value;
}
export function quality(value){
  object(value,'QUALITY');
  enums(value.completeness,['COMPLETE','PARTIAL','INSUFFICIENT'],'COMPLETENESS');
  enums(value.resolution,['RESOLVED','CONFLICTING','UNCERTAIN','INSUFFICIENT_EVIDENCE'],'RESOLUTION');
  enums(value.pipeline_at_generation,['HEALTHY','DEGRADED'],'PIPELINE');return value;
}
export function sourceRegistry(value){
  object(value,'SOURCE');
  for(const key of ['source_id','source_namespace','provider','domain','timezone','upstream_origin','unit_semantics'])text(value[key],'SOURCE_'+key);
  enums(value.source_type,types,'SOURCE_TYPE');enums(value.payload_mode,['FULL_SNAPSHOT','DELTA','EVENT_STREAM'],'PAYLOAD_MODE');
  requireThat(typeof value.full_snapshot_completeness==='boolean','SNAPSHOT_COMPLETENESS_REQUIRED');
  requireThat(value.payload_mode==='FULL_SNAPSHOT'||!value.full_snapshot_completeness,'DELTA_COMPLETENESS_FORBIDDEN');
  ref(value.mapping_ref,'MAPPING');
  object(value.policy_refs,'POLICY_REFS');for(const key of ['license','retention','freshness'])ref(value.policy_refs[key],'POLICY_'+key);
  // Reference only. Transport credentials and URLs belong to a separately gated adapter.
  requireThat(value.credential_reference===null||typeof value.credential_reference==='string','CREDENTIAL_REFERENCE_INVALID');
  for(const key of ['token','secret','password','authorization','cookie','access_key','url'])requireThat(!Object.hasOwn(value,key),'SOURCE_SECRET_OR_TRANSPORT_FORBIDDEN');
  object(value.budget,'BUDGET');for(const key of ['requests','concurrency','retries','payload_bytes','timeout_ms'])requireThat(Number.isSafeInteger(value.budget[key])&&value.budget[key]>=0,'BUDGET_'+key+'_REQUIRED');
  return value;
}
export function evidence(value){
  object(value,'EVIDENCE');requireThat(value.contract_version===SEMANTIC_VERSION,'SEMANTIC_VERSION_UNSUPPORTED');
  for(const key of ['evidence_id','source_id','source_namespace','source_entity_id','retention_class','access_scope'])text(value[key],key);
  enums(value.source_type,types,'SOURCE_TYPE');digest(value.request_fingerprint,'REQUEST_FINGERPRINT');digest(value.payload_hash,'PAYLOAD_HASH');
  const hasPayload=typeof value.payload_ref==='string'&&value.payload_ref.length>0;
  requireThat(hasPayload!==Boolean(value.raw_storage_denied),'RAW_STORAGE_DISPOSITION_REQUIRED');
  if(!hasPayload)text(value.raw_storage_denied,'RAW_STORAGE_DENIED');
  instant(value.collected_at,'COLLECTED_AT');instant(value.received_at,'RECEIVED_AT');
  enums(value.source_time_basis,['SOURCE_OBSERVATION','SOURCE_ISSUED','EXPLICIT_RECONFIRMATION','UNKNOWN'],'SOURCE_TIME_BASIS');
  if(value.source_time_basis==='UNKNOWN'){requireThat(value.source_time===null,'UNKNOWN_TIME_MUST_BE_NULL');text(value.source_time_missing_reason,'TIME_MISSING_REASON');}
  else instant(value.source_time,'SOURCE_TIME');
  for(const key of ['source_registry_ref','adapter_ref'])ref(value[key],key);
  if(value.source_validity)interval(value.source_validity,'SOURCE_VALIDITY');
  requireThat(Array.isArray(value.provenance_refs)&&value.provenance_refs.every(x=>typeof x==='string'&&x.length>0),'PROVENANCE_REQUIRED');
  return value;
}
export function assertion(value){
  object(value,'ASSERTION');requireThat(value.contract_version===SEMANTIC_VERSION,'SEMANTIC_VERSION_UNSUPPORTED');
  for(const key of ['assertion_id','evidence_ref','predicate','unit'])text(value[key],key);
  enums(value.source_type,types,'SOURCE_TYPE');scope(value.scope);interval(value);
  const hasValue=Object.hasOwn(value,'value');const missing=Object.hasOwn(value,'missing_reason');
  requireThat(hasValue!==missing,'VALUE_OR_MISSING_REQUIRED');
  if(hasValue)requireThat(value.value!==null&&value.value!==undefined,'NULL_IS_NOT_A_VALUE');else text(value.missing_reason,'MISSING_REASON');
  instant(value.issued_at,'ISSUED_AT');
  if(value.source_time!==null)instant(value.source_time,'SOURCE_TIME');
  enums(value.mapping_state,['RESOLVED','AMBIGUOUS','UNRESOLVED'],'MAPPING_STATE');
  if(value.source_type==='MANUAL')text(value.author_ref,'MANUAL_AUTHOR');
  if(value.source_type==='FORECAST'){instant(value.model_cycle,'MODEL_CYCLE');interval(value.measurement_interval,'MEASUREMENT_INTERVAL');requireThat(Number.isSafeInteger(value.forecast_horizon_ms)&&value.forecast_horizon_ms>=0,'FORECAST_HORIZON_REQUIRED');}
  for(const key of ['supersedes','retracts'])if(value[key]!==undefined)text(value[key],key);
  quality(value.quality);return value;
}
export function canonical(value){
  object(value,'CANONICAL');requireThat(value.contract_version===SEMANTIC_VERSION,'SEMANTIC_VERSION_UNSUPPORTED');
  for(const key of ['dataset_id','generation_id','retention_class','access_scope'])text(value[key],key);
  interval(value);instant(value.evaluation_time,'EVALUATION_TIME');scope(value.scope);quality(value.quality);
  requireThat(!Object.hasOwn(value,'publication_revision')&&!Object.hasOwn(value,'committed_at'),'PREPARED_IS_NOT_COMMITTED');
  requireThat(Array.isArray(value.evidence_refs)&&value.evidence_refs.length>0&&new Set(value.evidence_refs).size===value.evidence_refs.length&&value.evidence_refs.every(x=>typeof x==='string'),'EVIDENCE_REFS_REQUIRED');
  requireThat(Array.isArray(value.assertion_refs)&&value.assertion_refs.length>0&&new Set(value.assertion_refs).size===value.assertion_refs.length&&value.assertion_refs.every(x=>typeof x==='string'),'ASSERTION_REFS_REQUIRED');
  object(value.artifact_refs,'ARTIFACT_REFS');for(const key of ['source','mapping','adapter','resolver','rule','config','policy','schema'])ref(value.artifact_refs[key],key);
  enums(value.replay_capability,['FULL_INPUTS_AVAILABLE','DERIVED_ONLY','PARTIAL_INPUTS','NOT_REPRODUCIBLE'],'REPLAY_CAPABILITY');
  requireThat(Array.isArray(value.dependencies),'DEPENDENCIES_REQUIRED');object(value.payload,'PAYLOAD');return value;
}
export async function artifact(value){
  object(value,'ARTIFACT');ref(value,'ARTIFACT');
  requireThat(value.contract_version===SEMANTIC_VERSION,'SEMANTIC_VERSION_UNSUPPORTED');
  enums(value.kind,['SOURCE','MAPPING','ADAPTER','RESOLVER','RULE','CONFIG','POLICY','SCHEMA'],'ARTIFACT_KIND');
  requireThat(value.environment_id==='fixture-only','SEMANTIC_LIVE_ACTIVATION_FORBIDDEN');
  object(value.payload,'ARTIFACT_PAYLOAD');
  const {hash:expected,...content}=value;requireThat(await hash(content)===expected,'ARTIFACT_CONTENT_MISMATCH');
  if(value.kind==='SOURCE')sourceRegistry(value.payload);
  return value;
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export async function registry(values){
  requireThat(Array.isArray(values)&&values.length>0,'REGISTRY_REQUIRED');const entries=new Map();
  for(const input of values){const value=await artifact(JSON.parse(stable(input)));const key=value.artifact_id+'\0'+value.version;requireThat(!entries.has(key),'REGISTRY_VERSION_CONFLICT');entries.set(key,freeze(value));}
  return Object.freeze({lookup(reference,kind){ref(reference);const value=entries.get(reference.artifact_id+'\0'+reference.version);requireThat(value&&value.hash===reference.hash,'REGISTRY_REF_UNAVAILABLE');requireThat(value.kind===kind,'REGISTRY_KIND_MISMATCH');return value;}});
}
// A narrow synthetic kernel exercises contracts, not real Cano/Marine rules.
export async function fixtureReplay({evidences,assertions,target_scope,policy,evaluation_time,record_kind='REPLAY',prior_history_hash}){
  const now=instant(evaluation_time,'EVALUATION_TIME');scope(target_scope);object(policy,'FIXTURE_POLICY');
  requireThat(policy.environment_id==='fixture-only'&&policy.policy_id==='synthetic.operation.fixture','FIXTURE_POLICY_REQUIRED');
  requireThat(Number.isSafeInteger(policy.max_age_ms)&&policy.max_age_ms>0&&Number.isSafeInteger(policy.clock_skew_ms)&&policy.clock_skew_ms>=0,'FIXTURE_TIME_POLICY_REQUIRED');
  enums(record_kind,['EMITTED','REPLAY'],'RECORD_KIND');digest(prior_history_hash,'PRIOR_HISTORY_HASH');
  requireThat(Array.isArray(evidences)&&Array.isArray(assertions),'REPLAY_INPUTS_REQUIRED');
  const byId=new Map();
  for(const e of evidences){evidence(e);requireThat(!byId.has(e.evidence_id),'DUPLICATE_EVIDENCE_ID');byId.set(e.evidence_id,e);}
  const assertionIds=new Set();let unknownTime=false;const eligible=[];
  for(const a of assertions){
    assertion(a);requireThat(!assertionIds.has(a.assertion_id),'DUPLICATE_ASSERTION_ID');assertionIds.add(a.assertion_id);
    const e=byId.get(a.evidence_ref);requireThat(e&&e.source_type===a.source_type&&e.source_time===a.source_time,'ASSERTION_EVIDENCE_MISMATCH');
    if(stable(a.scope)!==stable(target_scope)||a.mapping_state!=='RESOLVED')continue;
    if(e.source_time===null){unknownTime=true;continue;}
    const source=instant(e.source_time,'SOURCE_TIME');
    if(source>now+policy.clock_skew_ms||now-source>policy.max_age_ms||now<instant(a.valid_from,'VALID_FROM')||now>=instant(a.valid_to,'VALID_TO'))continue;
    if(e.source_validity&&(now<instant(e.source_validity.valid_from,'SOURCE_VALID_FROM')||now>=instant(e.source_validity.valid_to,'SOURCE_VALID_TO')))continue;
    if(a.quality.completeness!=='COMPLETE'||a.quality.resolution!=='RESOLVED'||Object.hasOwn(a,'missing_reason'))continue;
    eligible.push(a);
  }
  const closures=eligible.filter(a=>a.source_type==='OFFICIAL_REPORT'&&a.predicate==='synthetic.operational.closed'&&a.value===true);
  const confirmations=eligible.filter(a=>a.source_type==='MANUAL'&&a.predicate==='synthetic.operational.confirmed'&&a.value===true);
  const chosen=closures.length?closures:confirmations;
  const effect=closures.length?'RESTRICTIVE':confirmations.length?'POSITIVE':'ABSTAIN';
  const reason=closures.length?'SCOPED_OFFICIAL_CLOSURE':confirmations.length?'SCOPED_MANUAL_CONFIRMATION':unknownTime?'UNKNOWN_SOURCE_TIME':'MINIMUM_EVIDENCE_MISSING';
  const input_hash=await hash({evidences:[...evidences].sort((a,b)=>a.evidence_id<b.evidence_id?-1:a.evidence_id>b.evidence_id?1:0),assertions:[...assertions].sort((a,b)=>a.assertion_id<b.assertion_id?-1:a.assertion_id>b.assertion_id?1:0),policy,target_scope,prior_history_hash});
  const output={decision_type:'synthetic.operation.fixture',kind:'FACT',record_kind,scope:target_scope,evaluation_time,input_hash,prior_history_hash,effect,reason_codes:[reason],assertion_refs:chosen.map(a=>a.assertion_id).sort(),action_until:new Date(chosen.length?Math.min(...chosen.flatMap(a=>[instant(a.valid_to,'VALID_TO'),instant(a.source_time,'SOURCE_TIME')+policy.max_age_ms,...(byId.get(a.evidence_ref).source_validity?[instant(byId.get(a.evidence_ref).source_validity.valid_to,'SOURCE_VALID_TO')]:[])])):now).toISOString()};
  return {...output,decision_id:await hash(output)};
}
