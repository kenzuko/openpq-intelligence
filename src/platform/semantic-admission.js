import {DIRECTORY_FACT_ENVIRONMENT} from './directory-execution-contract.js';
import {readConfig,PROFILE_REGISTRY_BINDINGS} from './trusted-config.js';
import {executionEnvironment,executionDataset,TRANSIT_FACT_ENVIRONMENT} from './transit-execution-scope.js';
import {TRANSIT_FACT_PROFILE_VERSION,WEATHER_FACT_PROFILE_VERSION,DIRECTORY_FACT_PROFILE_VERSION} from './domain-continuous-contract.js';
import {WEATHER_FACT_ENVIRONMENT} from './weather-execution-contract.js';
import {isContinuousProfile,validateContinuousProfile,validateContinuousAdmission} from './domain-continuous-admission.js';
import {DOMAIN_PROFILE_VERSION,isDomainProfile,validateDomainBridgeProfile,validateDomainBridgeAdmission,validateDomainBridgeActor} from './domain-bridge-admission.js';
import {REAL_PROFILE_VERSION,isRealProfile,validateRealCanoProfile,validateRealCanoAdmission,validateRealCanoActor} from './real-cano-admission.js';
import {candidate,hash,instant,requireThat,stable} from './contracts.js';
import {exactKeys,clone,digest,noSecrets} from '../preparation/common.js';
import {preparationRegistry} from '../preparation/registry.js';
import {policySet} from '../preparation/policies.js';
import {prepareShadow} from '../preparation/pipeline.js';
export const ADMISSION_BINDINGS=['SEMANTIC_PROFILE_1','SEMANTIC_PROFILE_2','SEMANTIC_PROFILE_3'];
export async function packAdmissionProfile(profile){
 const text=stable(profile);requireThat(new TextEncoder().encode(text).length<=15000,'SEMANTIC_PROFILE_TOO_LARGE');
 const chunks=[[],[],[]];let index=0,size=0;const encoder=new TextEncoder();
 for(const c of text){const width=encoder.encode(c).length;if(size+width>5000){index++;size=0;}requireThat(index<3,'SEMANTIC_PROFILE_TOO_LARGE');chunks[index].push(c);size+=width;}
 return Object.fromEntries(ADMISSION_BINDINGS.map((key,i)=>[key,chunks[i].join('')]));
}
async function configured(env,trust,evaluation_time){
 executionEnvironment(env);executionDataset(env,trust);
 requireThat(trust.environment_id===env.ENVIRONMENT_ID,'SEMANTIC_CLOUD_ADMISSION_CLOSED',503);
 digest(trust.semantic_profile_hash,'SEMANTIC_PROFILE_HASH');
 const parts=ADMISSION_BINDINGS.map(key=>env[key]||'');requireThat(parts.every(p=>typeof p==='string'&&new TextEncoder().encode(p).length<=5000),'SEMANTIC_PROFILE_BINDING_OVERSIZE');
 const hasRegistry=PROFILE_REGISTRY_BINDINGS.some(key=>Boolean(env[key]));
 requireThat(!hasRegistry||parts.every(p=>!p),'SEMANTIC_CONFIG_AMBIGUOUS',503);
 const profile=hasRegistry?readConfig(env,PROFILE_REGISTRY_BINDINGS)[trust.dataset_id]:JSON.parse(parts.join(''));
 requireThat(profile&&profile.environment_id===env.ENVIRONMENT_ID,'SEMANTIC_CLOUD_ADMISSION_CLOSED',503);
 if(env.ENVIRONMENT_ID===TRANSIT_FACT_ENVIRONMENT)requireThat(profile.contract_version===TRANSIT_FACT_PROFILE_VERSION,'TRANSIT_FACT_PROFILE_SCOPE_DENIED');
 if(env.ENVIRONMENT_ID===DIRECTORY_FACT_ENVIRONMENT)requireThat(profile.contract_version===DIRECTORY_FACT_PROFILE_VERSION,'DIRECTORY_FACT_PROFILE_SCOPE_DENIED');
 if(env.ENVIRONMENT_ID===WEATHER_FACT_ENVIRONMENT)requireThat(profile.contract_version===WEATHER_FACT_PROFILE_VERSION,'WEATHER_FACT_PROFILE_SCOPE_DENIED');
 if(isDomainProfile(profile)){await validateDomainBridgeProfile(profile,trust);return {profile};}
 if(isContinuousProfile(profile)){await validateContinuousProfile(profile,trust);return {profile};}
 if(isRealProfile(profile)){await validateRealCanoProfile(profile,trust);return {profile};}
 exactKeys(profile,['contract_version','environment_id','dataset_id','source_kind','artifacts','policies','artifact_refs','target_scope'],'SEMANTIC_PROFILE');
 requireThat(profile.contract_version==='openpq-semantic-admission-local-v1'&&profile.source_kind==='SYNTHETIC_ONLY'&&profile.environment_id==='local-test'&&profile.dataset_id===trust.dataset_id,'SEMANTIC_PROFILE_SCOPE_INVALID');
 requireThat(await hash(profile)===trust.semantic_profile_hash,'SEMANTIC_PROFILE_PIN_MISMATCH',409);
 const registry=await preparationRegistry(profile.artifacts,'local-test'),policies=await policySet(profile.policies,'local-test',evaluation_time);
 for(const k of ['rule','config','policy','schema'])requireThat(trust.artifacts[k]===profile.artifact_refs[k].hash,'SEMANTIC_AUTHORITY_ARTIFACT_MISMATCH',409);
 return {profile,registry,policies};
}
function inputProjection(evidences,assertions,max_age_ms){
 return evidences.map(e=>({source_id:e.source_id,source_type:e.source_type,source_time:e.source_time,valid_to:new Date(Math.min(...assertions.filter(a=>a.evidence_ref===e.evidence_id).map(a=>instant(a.valid_to,'ASSERTION_TO')),e.source_validity?instant(e.source_validity.valid_to,'SOURCE_TO'):Infinity)).toISOString(),max_age_ms})).sort((a,b)=>stable(a).localeCompare(stable(b)));
}
export function semanticPayload(prepared){return {semantic_fact:{contract_version:'openpq-semantic-fact-local-v1',input_hash:prepared.input_hash,preparation_hash:prepared.preparation_hash,scope:prepared.scope,values:prepared.values,quality:prepared.quality,mode:'SYNTHETIC_TEST',operational_action_allowed:false}};}
// Trusted configuration is loaded from Worker bindings and pinned by authority control, never from the request.
export async function validateSemanticAdmission(env,trust,c,evaluation_time,actor=null){
 if(!trust.semantic_profile_hash){requireThat(!Object.hasOwn(c,'semantic_bundle')&&!Object.hasOwn(c,'semantic_admission'),'SEMANTIC_PROFILE_NOT_ACTIVATED',409);return null;}
 const at=instant(evaluation_time,'SEMANTIC_VALIDATION_TIME'),{profile,registry,policies}=await configured(env,trust,evaluation_time);
 if(isDomainProfile(profile))return validateDomainBridgeAdmission(profile,trust,c,evaluation_time,actor);
 if(isContinuousProfile(profile))return validateContinuousAdmission(profile,trust,c,evaluation_time,actor);
 if(isRealProfile(profile))return validateRealCanoAdmission(profile,trust,c,evaluation_time,actor);
 requireThat(c.semantic_profile_hash===trust.semantic_profile_hash,'SEMANTIC_CANDIDATE_PROFILE_MISMATCH',409);noSecrets(c);
 const bundle=c.semantic_bundle;exactKeys(bundle,['contract_version','evidences','assertions'],'SEMANTIC_BUNDLE');requireThat(bundle.contract_version==='openpq-semantic-bundle-local-v1','SEMANTIC_BUNDLE_VERSION_INVALID');
 requireThat(stable(c.artifacts)===stable(trust.artifacts),'SEMANTIC_CANDIDATE_ARTIFACT_MISMATCH',409);
 requireThat(c.dataset_id===profile.dataset_id&&c.operation==='NORMAL','SEMANTIC_OPERATION_SCOPE_DENIED');
 requireThat(Array.isArray(bundle.evidences)&&Array.isArray(bundle.assertions)&&bundle.evidences.every(e=>bundle.assertions.some(a=>a.evidence_ref===e.evidence_id)),'SEMANTIC_UNLINKED_EVIDENCE');
 const prepared=await prepareShadow({environment_id:'local-test',registry,policies,artifact_refs:profile.artifact_refs,target_scope:profile.target_scope,evidences:bundle.evidences,assertions:bundle.assertions,evaluation_time:c.evaluation_time});
 requireThat(prepared.quarantine.length===0&&prepared.quality.completeness==='COMPLETE','SEMANTIC_INPUT_NOT_ADMISSIBLE',409);
 requireThat(stable(c.payload)===stable(semanticPayload(prepared))&&stable(c.quality)===stable(prepared.quality),'SEMANTIC_OUTPUT_MISMATCH',409);
 requireThat(c.decision?.type==='synthetic.semantic.fact'&&c.decision.kind==='FACT'&&c.decision.effect==='ABSTAIN'&&c.decision.minimum_evidence_met===false&&stable(c.decision.reason_codes)===stable(['LOCAL_SEMANTIC_FACT_NO_ACTION']),'SEMANTIC_ACTION_FORBIDDEN',409);
 const p=policies.require('P05',['max_source_age_ms','clock_skew_ms'],profile.dataset_id,evaluation_time),inputs=inputProjection(bundle.evidences,bundle.assertions,p.max_source_age_ms);
 requireThat(stable(c.inputs)===stable(inputs),'SEMANTIC_SOURCE_INPUT_MISMATCH',409);
 const lower=Math.max(...bundle.assertions.map(a=>instant(a.valid_from,'ASSERTION_FROM')),...bundle.evidences.filter(e=>e.source_validity).map(e=>instant(e.source_validity.valid_from,'SOURCE_FROM')));
 const upper=Math.min(...inputs.flatMap(i=>[instant(i.valid_to,'INPUT_TO'),instant(i.source_time,'INPUT_TIME')+p.max_source_age_ms]),...profile.policies.filter(p=>p.status==='APPROVED_RECORDED').map(p=>instant(p.effective_to,'POLICY_TO')));
 requireThat(instant(c.valid_from,'CANDIDATE_FROM')>=lower&&instant(c.valid_to,'CANDIDATE_TO')<=upper&&c.decision.action_until===c.valid_to,'SEMANTIC_VALIDITY_EXCEEDS_INPUT',409);
 requireThat(inputs.every(i=>{const time=instant(i.source_time,'SOURCE_TIME');return time<=at+p.clock_skew_ms&&at-time<=p.max_source_age_ms&&at<instant(i.valid_to,'INPUT_TO');}),'SEMANTIC_SOURCE_STALE_AT_ADMISSION',409);
 const proof={contract_version:'openpq-semantic-admission-local-v1',profile_hash:trust.semantic_profile_hash,input_hash:prepared.input_hash,preparation_hash:prepared.preparation_hash,valid_until:new Date(upper).toISOString(),action_allowed:false};
 requireThat(stable(c.semantic_admission)===stable(proof),'SEMANTIC_PROOF_MISMATCH',409);return proof;
}
// Test-only producer helper. Authority admission repeats every check independently.
export async function buildSemanticCandidate(profile,trust,{evidences,assertions,evaluation_time,candidate_id,expected_revision=0,expected_control_revision=0,logical_slot=0}){
 requireThat(profile.environment_id==='local-test'&&trust.environment_id==='local-test','SEMANTIC_PRODUCER_LOCAL_ONLY');const bindings=await packAdmissionProfile(profile),env={ENVIRONMENT_ID:'local-test',...bindings};
 requireThat(profile.source_kind==='SYNTHETIC_ONLY','SEMANTIC_PRODUCER_SOURCE_KIND_DENIED');
 const {registry,policies}=await configured(env,trust,evaluation_time),prepared=await prepareShadow({environment_id:'local-test',registry,policies,artifact_refs:profile.artifact_refs,target_scope:profile.target_scope,evidences,assertions,evaluation_time});
 const p=policies.require('P05',['max_source_age_ms','clock_skew_ms'],profile.dataset_id,evaluation_time),inputs=inputProjection(evidences,assertions,p.max_source_age_ms);
 const from=Math.max(...assertions.map(a=>instant(a.valid_from,'ASSERTION_FROM')),...evidences.filter(e=>e.source_validity).map(e=>instant(e.source_validity.valid_from,'SOURCE_FROM'))),to=Math.min(...inputs.flatMap(i=>[instant(i.valid_to,'INPUT_TO'),instant(i.source_time,'INPUT_TIME')+p.max_source_age_ms]),...profile.policies.filter(p=>p.status==='APPROVED_RECORDED').map(p=>instant(p.effective_to,'POLICY_TO')));
 const proof={contract_version:'openpq-semantic-admission-local-v1',profile_hash:trust.semantic_profile_hash,input_hash:prepared.input_hash,preparation_hash:prepared.preparation_hash,valid_until:new Date(to).toISOString(),action_allowed:false};
 const c={schema_version:'openpq-candidate-v1',...clone(trust),candidate_id,expected_revision,expected_control_revision,logical_slot,evaluation_time,valid_from:new Date(from).toISOString(),valid_to:new Date(to).toISOString(),inputs,quality:prepared.quality,artifacts:trust.artifacts,payload:semanticPayload(prepared),operation:'NORMAL',decision:{type:'synthetic.semantic.fact',kind:'FACT',effect:'ABSTAIN',action_until:new Date(to).toISOString(),minimum_evidence_met:false,reason_codes:['LOCAL_SEMANTIC_FACT_NO_ACTION']},semantic_bundle:{contract_version:'openpq-semantic-bundle-local-v1',evidences:clone(evidences),assertions:clone(assertions)},semantic_admission:proof};
 candidate(c,instant(evaluation_time,'EVALUATION'));await validateSemanticAdmission(env,trust,c,evaluation_time);return c;
}

// Replayed committed commands also enforce the current real-source operator capability.
export async function validateSemanticReplayActor(env,trust,actor,receipt,evaluation_time){
 if(!trust.semantic_profile_hash)return;
 const {profile}=await configured(env,trust,evaluation_time);
 if(isDomainProfile(profile))validateDomainBridgeActor(profile,actor,receipt?.semantic_admission?.operator_principal_id);
 if(isContinuousProfile(profile))validateDomainBridgeActor(profile,actor,receipt?.semantic_admission?.operator_principal_id);
 if(isRealProfile(profile))validateRealCanoActor(profile,actor,receipt?.semantic_admission?.operator_principal_id);
}
