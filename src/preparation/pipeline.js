import {evidence,assertion,scope,SEMANTIC_VERSION} from '../contracts/semantic.js';
import {graph} from './registry.js';
import {PREPARATION_VERSION,closedEnvironment,clone,freeze,hash,instant,object,report,requireThat,stable,text} from './common.js';
function unique(values,key,label){requireThat(Array.isArray(values)&&values.length>0&&values.length<=100,label+'_REQUIRED');const m=new Map();for(const v of values){text(v[key],key);requireThat(!m.has(v[key]),'DUPLICATE_'+label);m.set(v[key],v);}return m;}
function valueValid(value,rule){
 object(rule,'PREDICATE_RULE');requireThat(['boolean','number','string'].includes(rule.type),'SCHEMA_TYPE_UNSUPPORTED');
 requireThat(typeof value===rule.type,'ASSERTION_VALUE_TYPE_MISMATCH');if(rule.type==='number')requireThat(Number.isFinite(value),'ASSERTION_VALUE_NONFINITE');
 if(rule.enum!==undefined)requireThat(Array.isArray(rule.enum)&&rule.enum.includes(value),'ASSERTION_VALUE_ENUM_MISMATCH');
}
// Preparation is side-effect free. It cannot produce a live Coordinator command.
export async function prepareShadow({environment_id,registry,policies,artifact_refs,target_scope,evidences,assertions,evaluation_time}){
 closedEnvironment(environment_id);requireThat(registry.environment_id===environment_id&&policies.environment_id===environment_id,'PREPARATION_CONTEXT_MISMATCH');scope(target_scope);
 const now=instant(evaluation_time,'EVALUATION_TIME'),nodes=graph(registry,artifact_refs,target_scope),source=nodes.SOURCE.payload;
 requireThat(nodes.POLICY.payload.policy_set_hash===policies.hash,'GRAPH_POLICY_SET_MISMATCH');
 const freshness=policies.require('P05',['max_source_age_ms','clock_skew_ms'],nodes.CONFIG.payload.dataset_id,evaluation_time);
 const license=policies.require('P09',['derived_use','raw_storage'],nodes.CONFIG.payload.dataset_id,evaluation_time);requireThat(license.derived_use===true&&typeof license.raw_storage==='boolean','SOURCE_LICENSE_POLICY_BLOCKED');
 const timePolicy=policies.require('P08',['source_time_basis','timezone'],nodes.CONFIG.payload.dataset_id,evaluation_time);
 requireThat(timePolicy.timezone===source.timezone,'SOURCE_TIMEZONE_POLICY_MISMATCH');
 const budget=policies.require('P10',['requests','concurrency','retries','payload_bytes','timeout_ms'],nodes.CONFIG.payload.dataset_id,evaluation_time);requireThat(Object.keys(source.budget).every(k=>source.budget[k]===budget[k]),'SOURCE_BUDGET_POLICY_MISMATCH');
 const mappingPolicy=policies.require('P16',['mapping_hash'],nodes.CONFIG.payload.dataset_id,evaluation_time);requireThat(mappingPolicy.mapping_hash===nodes.MAPPING.hash,'MAPPING_POLICY_HASH_MISMATCH');
 const es=unique(evidences,'evidence_id','EVIDENCE'),as=unique(assertions,'assertion_id','ASSERTION');
 const reasons=new Map(),reject=(id,reason)=>{const list=reasons.get(id)||[];if(!list.includes(reason))list.push(reason);reasons.set(id,list);};
 for(const e of es.values()){
  evidence(e);requireThat(!e.payload_ref||license.raw_storage===true,'EVIDENCE_RAW_STORAGE_POLICY_DENIED');requireThat(e.contract_version===SEMANTIC_VERSION,'EVIDENCE_VERSION_UNSUPPORTED');
  requireThat(e.source_id===source.source_id&&e.source_namespace===source.source_namespace&&e.source_type===source.source_type,'EVIDENCE_SOURCE_MISMATCH');
  requireThat(registry.lookup(e.source_registry_ref,'SOURCE')===nodes.SOURCE&&registry.lookup(e.adapter_ref,'ADAPTER')===nodes.ADAPTER,'EVIDENCE_ARTIFACT_MISMATCH');
  requireThat(instant(e.received_at,'RECEIVED_AT')>=instant(e.collected_at,'COLLECTED_AT'),'EVIDENCE_RECEIVE_BEFORE_COLLECTION');
  if(instant(e.received_at,'RECEIVED_AT')>now+freshness.clock_skew_ms)reject(e.evidence_id,'RECEIVED_IN_FUTURE');
  requireThat(e.source_time_basis===timePolicy.source_time_basis||e.source_time_basis==='UNKNOWN','SOURCE_TIME_BASIS_MISMATCH');
  if(e.source_time===null)reject(e.evidence_id,'SOURCE_TIME_UNKNOWN');
  else {const t=instant(e.source_time,'SOURCE_TIME');if(t>now+freshness.clock_skew_ms)reject(e.evidence_id,'SOURCE_TIME_FUTURE');if(now-t>freshness.max_source_age_ms)reject(e.evidence_id,'SOURCE_STALE');}
  if(e.source_validity&&(now<instant(e.source_validity.valid_from,'SOURCE_FROM')||now>=instant(e.source_validity.valid_to,'SOURCE_TO')))reject(e.evidence_id,'SOURCE_OUTSIDE_VALIDITY');
 }
 const eligible=[];
 for(const a of as.values()){
  assertion(a);const e=es.get(a.evidence_ref);requireThat(e&&e.source_type===a.source_type&&e.source_time===a.source_time,'ASSERTION_EVIDENCE_MISMATCH');
  const rule=nodes.SCHEMA.payload.predicates?.[a.predicate];requireThat(rule,'PREDICATE_NOT_IN_SCHEMA');requireThat(a.unit===rule.unit,'ASSERTION_UNIT_MISMATCH');
  if(Object.hasOwn(a,'value'))valueValid(a.value,rule);else reject(a.assertion_id,'VALUE_MISSING');
  if(stable(a.scope)!==stable(target_scope)||a.mapping_state!=='RESOLVED')reject(a.assertion_id,'ASSERTION_SCOPE_OR_MAPPING_UNRESOLVED');
  if(now<instant(a.valid_from,'VALID_FROM')||now>=instant(a.valid_to,'VALID_TO'))reject(a.assertion_id,'ASSERTION_OUTSIDE_VALIDITY');
  if(e.source_validity)requireThat(instant(a.valid_from,'VALID_FROM')>=instant(e.source_validity.valid_from,'SOURCE_FROM')&&instant(a.valid_to,'VALID_TO')<=instant(e.source_validity.valid_to,'SOURCE_TO'),'ASSERTION_EXCEEDS_SOURCE_VALIDITY');
  if(a.source_type==='FORECAST')requireThat(instant(a.model_cycle,'MODEL_CYCLE')<=instant(a.issued_at,'ISSUED_AT')&&a.forecast_horizon_ms===instant(a.measurement_interval.valid_from,'MEASUREMENT_FROM')-instant(a.model_cycle,'MODEL_CYCLE'),'FORECAST_TIME_MAPPING_MISMATCH');
  if(a.quality.completeness!=='COMPLETE'||a.quality.resolution!=='RESOLVED')reject(a.assertion_id,'ASSERTION_QUALITY_INSUFFICIENT');
  for(const reason of reasons.get(e.evidence_id)||[])reject(a.assertion_id,reason);
  if(!reasons.has(a.assertion_id))eligible.push(a);
 }
 // Preserve disagreement instead of choosing a value by arrival order.
 const groups=new Map();for(const a of eligible){const key=a.predicate+'\0'+a.unit;const values=groups.get(key)||new Set();values.add(stable(a.value));groups.set(key,values);}
 const conflicting=[...groups].filter(([,v])=>v.size>1).map(([k])=>k.split('\0')[0]).sort();
 const required=nodes.CONFIG.payload.required_predicates;requireThat(Array.isArray(required)&&required.length>0&&new Set(required).size===required.length&&required.every(p=>nodes.SCHEMA.payload.predicates[p]),'CONFIG_REQUIRED_PREDICATES_INVALID');
 const missing=required.filter(p=>!eligible.some(a=>a.predicate===p));
 const refs=clone(artifact_refs),input={environment_id,target_scope,evaluation_time,registry_hash:registry.hash,policy_hash:policies.hash,artifact_refs:refs,evidences:[...es.values()].sort((a,b)=>a.evidence_id.localeCompare(b.evidence_id)),assertions:[...as.values()].sort((a,b)=>a.assertion_id.localeCompare(b.assertion_id))};
 const view=report('SHADOW_PREPARED',{environment_id,dataset_id:nodes.CONFIG.payload.dataset_id,scope:clone(target_scope),evaluation_time,input_hash:await hash(input),artifact_refs:refs,registry_hash:registry.hash,policy_hash:policies.hash,quality:{completeness:missing.length?'INSUFFICIENT':'COMPLETE',resolution:conflicting.length?'CONFLICTING':missing.length?'INSUFFICIENT_EVIDENCE':'RESOLVED'},eligible_assertion_refs:eligible.map(a=>a.assertion_id).sort(),quarantine:[...reasons].map(([id,reason_codes])=>({id,reason_codes:reason_codes.sort()})).sort((a,b)=>a.id.localeCompare(b.id)),missing_predicates:missing,conflicting_predicates:conflicting,action_eligible:false,decision_effect:'ABSTAIN',wire_candidate_available:false,values:eligible.map(a=>({assertion_id:a.assertion_id,predicate:a.predicate,value:a.value,source_type:a.source_type,source_time:a.source_time,valid_to:a.valid_to})).sort((a,b)=>a.assertion_id.localeCompare(b.assertion_id))});
 return freeze({...view,preparation_hash:await hash(view)});
}
