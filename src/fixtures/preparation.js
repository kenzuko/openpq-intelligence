import {makeArtifact,preparationRegistry} from '../preparation/registry.js';
import {blockedPolicies,policySet} from '../preparation/policies.js';
import {semanticFixture} from './semantic.js';
export const AT='2026-10-01T12:00:00Z',SCOPE='synthetic.preparation';
const reference=a=>({artifact_id:a.artifact_id,version:a.version,hash:a.hash});
export async function preparationFixture(overrides={}){
 const policies=blockedPolicies('local-test',SCOPE);const values={
  P05:{max_source_age_ms:86400000,clock_skew_ms:0},P08:{source_time_basis:'SOURCE_OBSERVATION',timezone:'Asia/Ho_Chi_Minh'},P09:{derived_use:true,raw_storage:false},
  P10:{requests:4,concurrency:2,retries:2,payload_bytes:1024,timeout_ms:50,queue_limit:4,lease_ms:100,retry_base_ms:10,retry_max_ms:40,request_window_ms:100},
  P11:{retention_ms:100,gc_grace_ms:10},P14:{max_progress_lag_ms:1000,max_backlog:2,max_checkpoint_lag_ms:1000},P15:{max_override_ms:60000,reducing_protection_review:true},
  P17:{fields:[{path:'value',critical:true,mode:'EXACT'},{path:'number',critical:false,mode:'ABSOLUTE',tolerance:0.1}],max_time_skew_ms:1000}
 };
 const f=semanticFixture(),artifacts=[];const mapping=await makeArtifact('MAPPING','mapping.fixture',{scopes:[f.target_scope]});artifacts.push(mapping);values.P16={mapping_hash:mapping.hash};
 for(const p of policies)if(values[p.policy_id])Object.assign(p,{status:'APPROVED_RECORDED',owner:'synthetic-owner',rationale:'Local test values only. Not business policy.',effective_from:'2026-10-01T00:00:00Z',effective_to:'2026-10-02T00:00:00Z',values:values[p.policy_id]});
 for(const [id,patch] of Object.entries(overrides))Object.assign(policies.find(p=>p.policy_id===id),patch);
 const ps=await policySet(policies,'local-test',AT);const policy=await makeArtifact('POLICY','policy.fixture',{policy_set_hash:ps.hash});artifacts.push(policy);
 const schema=await makeArtifact('SCHEMA','schema.fixture',{predicates:{'synthetic.operational.confirmed':{type:'boolean',unit:'boolean'}}});artifacts.push(schema);
 const adapter=await makeArtifact('ADAPTER','adapter.fixture',{source_id:'synthetic-manual',source_namespace:'fixture',schema_ref:reference(schema),dependencies:[{...reference(schema),kind:'SCHEMA'}]});artifacts.push(adapter);
 const source=await makeArtifact('SOURCE','source.fixture',{source_id:'synthetic-manual',source_namespace:'fixture',provider:'synthetic',domain:'synthetic',source_type:'MANUAL',timezone:'Asia/Ho_Chi_Minh',upstream_origin:'synthetic-origin',unit_semantics:'boolean',payload_mode:'DELTA',full_snapshot_completeness:false,mapping_ref:reference(mapping),policy_refs:{license:reference(policy),retention:reference(policy),freshness:reference(policy)},credential_reference:null,budget:{requests:4,concurrency:2,retries:2,payload_bytes:1024,timeout_ms:50}});artifacts.push(source);
 artifacts.push(await makeArtifact('CONFIG','config.fixture',{dataset_id:SCOPE,source_id:'synthetic-manual',required_predicates:['synthetic.operational.confirmed']}));
 artifacts.push(await makeArtifact('RESOLVER','resolver.fixture',{implementation:'report-only-no-operational-resolution'}));artifacts.push(await makeArtifact('RULE','rule.fixture',{implementation:'abstain-only-no-domain-thresholds'}));
 const refs=Object.fromEntries(artifacts.map(a=>[a.kind.toLowerCase(),reference(a)]));f.evidences[0].source_registry_ref=reference(source);f.evidences[0].adapter_ref=reference(adapter);
 return {environment_id:'local-test',registry:await preparationRegistry(artifacts,'local-test'),policies:ps,policy_inputs:policies,artifacts,artifact_refs:refs,target_scope:f.target_scope,evidences:f.evidences,assertions:f.assertions,evaluation_time:AT};
}
export const syntheticLocator=()=>({account_id:'synthetic-account',environment_id:'local-test',dataset_id:SCOPE,authority_instance_id:'synthetic-authority',authority_locator_version:'1',locator_artifact_hash:'a'.repeat(64),namespace_id:'synthetic-namespace',native_id:'a'.repeat(64),object_name:'synthetic/preparation',recovery_generation:'generation-1',artifacts:{rule:'a'.repeat(64),config:'a'.repeat(64),policy:'a'.repeat(64),schema:'a'.repeat(64)},receipt_keys:{old:{kty:'EC',crv:'P-256',x:'synthetic-old',y:'synthetic-old'}}});
