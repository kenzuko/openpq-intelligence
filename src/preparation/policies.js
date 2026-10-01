import {closedEnvironment,exactKeys,freeze,hash,instant,integer,noSecrets,object,requireThat,text} from './common.js';
export const POLICY_IDS=Object.freeze(Array.from({length:18},(_,i)=>'P'+String(i+1).padStart(2,'0')));
const positive=['max_source_age_ms','display_ms','action_ms','requests','concurrency','payload_bytes','timeout_ms','queue_limit','lease_ms','retry_base_ms','retry_max_ms','rpo_ms','rto_ms','backup_interval_ms','max_export_lag_ms','detection_ms','max_override_ms'];
const nonnegative=['clock_skew_ms','retries'];
// Recorded approval is configuration provenance, never operator authentication or gate admission.
export function validatePolicy(policy,environment,at){
 closedEnvironment(environment);exactKeys(policy,['policy_id','version','environment_id','scope','owner','rationale','status','effective_from','effective_to','values'],'POLICY');
 requireThat(POLICY_IDS.includes(policy.policy_id),'POLICY_ID_UNKNOWN');text(policy.version,'POLICY_VERSION');text(policy.scope,'POLICY_SCOPE');
 requireThat(policy.environment_id===environment,'POLICY_ENVIRONMENT_MISMATCH');requireThat(['BLOCKED','PROPOSED','APPROVED_RECORDED'].includes(policy.status),'POLICY_STATUS_INVALID');
 object(policy.values,'POLICY_VALUES');noSecrets(policy);
 for(const [key,v] of Object.entries(policy.values)){if(positive.includes(key))integer(v,key,1);else if(nonnegative.includes(key))integer(v,key);}
 if(policy.status==='APPROVED_RECORDED'){
  text(policy.owner,'POLICY_OWNER');text(policy.rationale,'POLICY_RATIONALE');
  const from=instant(policy.effective_from,'POLICY_FROM'),to=instant(policy.effective_to,'POLICY_TO');requireThat(from<to,'POLICY_INTERVAL_EMPTY');
  if(at!==undefined){const now=instant(at,'POLICY_EVALUATION');requireThat(from<=now&&now<to,'POLICY_NOT_EFFECTIVE');}
 }
 return policy;
}
export async function policySet(inputs,environment,at){
 instant(at,'POLICY_SET_EVALUATION');requireThat(Array.isArray(inputs)&&inputs.length>0&&inputs.length<=18,'POLICIES_REQUIRED');const map=new Map();
 for(const p of inputs){validatePolicy(p,environment,at);requireThat(!map.has(p.policy_id),'POLICY_DUPLICATE');map.set(p.policy_id,freeze(structuredClone(p)));}
 const snapshot=Object.fromEntries([...map].sort(([a],[b])=>a.localeCompare(b)));
 return freeze({environment_id:environment,hash:await hash(snapshot),snapshot,require(id,fields,scope,evaluation_time=at){
  const p=map.get(id);requireThat(p?.status==='APPROVED_RECORDED','POLICY_'+id+'_BLOCKED');requireThat(p.scope===scope,'POLICY_SCOPE_MISMATCH');validatePolicy(p,environment,evaluation_time);
  for(const field of fields)requireThat(Object.hasOwn(p.values,field),'POLICY_'+id+'_'+field+'_MISSING');return p.values;
 }});
}
export function blockedPolicies(environment,scope){closedEnvironment(environment);text(scope,'POLICY_SCOPE');return POLICY_IDS.map(policy_id=>({policy_id,version:'unresolved',environment_id:environment,scope,owner:null,rationale:null,status:'BLOCKED',effective_from:null,effective_to:null,values:{}}));}
export function policyReadiness(policies){return {blocked:POLICY_IDS.filter(id=>!policies.snapshot[id]||policies.snapshot[id].status!=='APPROVED_RECORDED'),approval_assurance:'RECORDED_CONFIGURATION_ONLY',publication_admitted:false};}
