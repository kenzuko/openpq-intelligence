import {DIRECTORY_SOURCE_URLS} from './directory-execution-contract.js';
import {projectDirectoryPublication} from '../ingress/directory-publication.js';
import {candidate,hash,instant,requireThat,stable} from './contracts.js';
import {clone,noSecrets} from '../preparation/common.js';
import {DOMAIN_DATASETS,DOMAIN_ORIGINS,DOMAIN_RUNTIME_URLS,exact,utcTime} from '../ingress/domain-source-common.js';
import {projectOwnedDomain,ISOLATED_ACCOUNT_ID,validateDomainBridgeActor} from './domain-bridge-admission.js';
import {packDomainText,packDomainJson,unpackDomainText,unpackDomainJson} from './domain-codec.js';

import {CONTINUOUS_PROFILE_VERSION,CONTINUOUS_BUNDLE_VERSION,CONTINUOUS_SNAPSHOT_VERSION,TRANSIT_FACT_PROFILE_VERSION,WEATHER_FACT_PROFILE_VERSION,DIRECTORY_FACT_PROFILE_VERSION,canonicalFactContract,continuousContract,continuousBundleVersion,continuousSnapshotVersion,continuousEnvironment} from './domain-continuous-contract.js';
import {TRANSIT_FACT_ACCOUNT} from './transit-execution-scope.js';
import {WEATHER_SOURCE_URLS} from './weather-execution-contract.js';
export {CONTINUOUS_PROFILE_VERSION,CONTINUOUS_BUNDLE_VERSION,CONTINUOUS_SNAPSHOT_VERSION};
export const isContinuousProfile=p=>continuousContract(p?.contract_version);
export function continuousArtifactDocuments(p){
 return clone({rule:{contract:p.contract_version,domain:p.domain,action_allowed:false},config:{producer:p.producer,operators:p.operator_principal_ids},policy:p.reference_policy,schema:{bundle:continuousBundleVersion(p.contract_version),snapshot:continuousSnapshotVersion(p.contract_version)}});
}
export async function continuousArtifactRefs(p){
 return Object.fromEntries(await Promise.all(Object.entries(continuousArtifactDocuments(p)).map(async([k,v])=>[k,{hash:await hash(v)}])));
}
export async function validateContinuousProfile(p,trust){
 exact(p,['contract_version','environment_id','dataset_id','domain','fixture_only','producer','operator_principal_ids','reference_policy','artifact_refs'],'CONTINUOUS_PROFILE');
 const canonical=canonicalFactContract(p.contract_version);
 requireThat(isContinuousProfile(p)&&p.environment_id===continuousEnvironment(p.contract_version)&&trust.environment_id===p.environment_id&&trust.account_id===(canonical?TRANSIT_FACT_ACCOUNT:ISOLATED_ACCOUNT_ID)&&p.fixture_only===false&&p.dataset_id===DOMAIN_DATASETS[p.domain]&&trust.dataset_id===p.dataset_id,'CONTINUOUS_SCOPE_DENIED');
 if(p.contract_version===TRANSIT_FACT_PROFILE_VERSION)requireThat(p.domain==='transit'&&p.dataset_id==='transit.bridge.phu-quoc'&&p.producer.source_kind==='OWNER_REPOSITORY_SNAPSHOT'&&p.producer.repository==='kenzuko/transit-jotrip'&&p.producer.path==='data/network.json'&&Array.isArray(trust.approved_positive_decision_types)&&trust.approved_positive_decision_types.length===0,'TRANSIT_FACT_PROFILE_SCOPE_DENIED');
 if(p.contract_version===WEATHER_FACT_PROFILE_VERSION)requireThat(Object.hasOwn(WEATHER_SOURCE_URLS,p.domain)&&p.producer.source_kind==='OWNER_PUBLIC_RUNTIME'&&p.producer.url===WEATHER_SOURCE_URLS[p.domain]&&Array.isArray(trust.approved_positive_decision_types)&&trust.approved_positive_decision_types.length===0,'WEATHER_FACT_PROFILE_SCOPE_DENIED');
 if(p.contract_version===DIRECTORY_FACT_PROFILE_VERSION)requireThat(p.domain==='nearme'&&p.dataset_id==='directory.bridge.phu-quoc'&&p.producer.source_kind==='OWNER_PUBLIC_RUNTIME'&&p.producer.url===DIRECTORY_SOURCE_URLS.index&&Array.isArray(trust.approved_positive_decision_types)&&trust.approved_positive_decision_types.length===0,'DIRECTORY_FACT_PROFILE_SCOPE_DENIED');
 const origin=DOMAIN_ORIGINS[p.domain];requireThat(origin,'CONTINUOUS_DOMAIN_DENIED');
 if(p.producer.source_kind==='OWNER_REPOSITORY_SNAPSHOT'){
  exact(p.producer,['source_kind','repository','path'],'CONTINUOUS_PRODUCER');
  requireThat(p.producer.repository===origin[0]&&p.producer.path.startsWith(origin[1])&&p.producer.path.split('/').every(x=>x&&x!=='.'&&x!=='..')&&!/[\\\0]/.test(p.producer.path),'CONTINUOUS_PRODUCER_DENIED');
 }else{
  exact(p.producer,['source_kind','url'],'CONTINUOUS_PRODUCER');requireThat(p.producer.source_kind==='OWNER_PUBLIC_RUNTIME'&&Object.hasOwn(DOMAIN_RUNTIME_URLS,p.domain)&&p.producer.url===(p.contract_version===DIRECTORY_FACT_PROFILE_VERSION?DIRECTORY_SOURCE_URLS.index:p.contract_version===WEATHER_FACT_PROFILE_VERSION?WEATHER_SOURCE_URLS[p.domain]:DOMAIN_RUNTIME_URLS[p.domain]),'CONTINUOUS_PRODUCER_DENIED');
 }
 exact(p.reference_policy,['lease_ms','max_snapshot_age_ms','future_skew_ms'],'CONTINUOUS_REFERENCE_POLICY');
 const q=p.reference_policy;requireThat(Number.isSafeInteger(q.lease_ms)&&q.lease_ms>0&&q.lease_ms<=300000&&Number.isSafeInteger(q.max_snapshot_age_ms)&&q.max_snapshot_age_ms>0&&q.max_snapshot_age_ms<=31*86400000&&Number.isSafeInteger(q.future_skew_ms)&&q.future_skew_ms>=0&&q.future_skew_ms<=5000,'CONTINUOUS_REFERENCE_POLICY_DENIED');
 requireThat(Array.isArray(p.operator_principal_ids)&&p.operator_principal_ids.length>0&&p.operator_principal_ids.length<=8&&new Set(p.operator_principal_ids).size===p.operator_principal_ids.length&&p.operator_principal_ids.every(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(x)),'CONTINUOUS_OPERATOR_SET_DENIED');
 requireThat(stable(p.artifact_refs)===stable(await continuousArtifactRefs(p)),'CONTINUOUS_ARTIFACT_DENIED');
 for(const k of ['rule','config','policy','schema'])requireThat(trust.artifacts[k]===p.artifact_refs[k].hash,'SEMANTIC_AUTHORITY_ARTIFACT_MISMATCH',409);
 requireThat(await hash(p)===trust.semantic_profile_hash,'SEMANTIC_PROFILE_PIN_MISMATCH',409);noSecrets(p);return p;
}
async function project(p,bundle,at){
 if(p.contract_version===DIRECTORY_FACT_PROFILE_VERSION)return projectDirectoryPublication(bundle,at);
 exact(bundle,['contract_version','pin','encoded_source'],'CONTINUOUS_BUNDLE');requireThat(bundle.contract_version===continuousBundleVersion(p.contract_version),'CONTINUOUS_BUNDLE_DENIED');
 const pin=bundle.pin;requireThat(pin?.source_kind===p.producer.source_kind,'CONTINUOUS_SOURCE_DENIED');
 const pointer=pin.source_pointer;
 if(p.producer.source_kind==='OWNER_REPOSITORY_SNAPSHOT')requireThat(pointer?.repository===p.producer.repository&&pointer?.path===p.producer.path,'CONTINUOUS_SOURCE_DENIED');
 else requireThat(pointer?.url===p.producer.url,'CONTINUOUS_SOURCE_DENIED');
 const raw=await unpackDomainText(bundle.encoded_source);requireThat(bundle.encoded_source.sha256===pin.payload_sha256,'CONTINUOUS_RAW_DIGEST_DENIED');
 const {legacy_payload,...compact}=await projectOwnedDomain(p.domain,{pin,raw_utf8:raw},at);return compact;
}
function derived(p,trust,compact,at,operator){
 const now=instant(at,'CONTINUOUS_EVALUATION'),source=compact.metadata.generated_at?.utc||compact.metadata.board_checked_at?.utc;
 requireThat(utcTime(source),'CONTINUOUS_VERSION_TIME_REQUIRED');const sourceMs=instant(source,'CONTINUOUS_VERSION');
 requireThat(sourceMs<=now+p.reference_policy.future_skew_ms&&now-sourceMs<=p.reference_policy.max_snapshot_age_ms,'CONTINUOUS_SNAPSHOT_AGE_DENIED',409);
 const to=new Date(Math.min(now+p.reference_policy.lease_ms,sourceMs+p.reference_policy.max_snapshot_age_ms)).toISOString();requireThat(instant(to,'CONTINUOUS_TO')>now,'CONTINUOUS_SNAPSHOT_AGE_DENIED',409);
 const input=compact.sources[0];const proof={contract_version:p.contract_version,profile_hash:trust.semantic_profile_hash,input_hash:input.payload_sha256,preparation_hash:compact.projection_digest,source_version_time:source,valid_until:to,operator_principal_id:operator,source_author_assurance:'OWNED_OUTPUT_CAPTURE_ONLY',source_policies_activated:false,producer_independence:false,action_allowed:false};
 if(p.contract_version===DIRECTORY_FACT_PROFILE_VERSION){proof.source_set_hash=compact.metadata.source_set_digest;proof.publication_id=compact.metadata.publication_id;}
 return {valid_from:at,valid_to:to,proof,inputs:[{source_id:'OWNED_OUTPUT_SNAPSHOT:'+p.domain,source_type:'OFFICIAL_REPORT',source_time:source,valid_to:to,max_age_ms:p.reference_policy.max_snapshot_age_ms}],quality:{completeness:compact.issues.length?'PARTIAL':'COMPLETE',resolution:compact.issues.length?'UNCERTAIN':'RESOLVED'},decision:{type:p.domain+'.owned.snapshot.fact',kind:'FACT',effect:'ABSTAIN',action_until:to,minimum_evidence_met:false,reason_codes:['CONTINUOUS_REFERENCE_NO_OPERATIONAL_ACTION']}};
}
function payload(p,compact,encoded_projection){return {domain_snapshot:{contract_version:continuousSnapshotVersion(p.contract_version),domain:p.domain,dataset_id:p.dataset_id,mode:canonicalFactContract(p.contract_version)?'CANONICAL_BRIDGE_FACT':'BRIDGE_DEPENDENT_SHADOW',fixture_only:false,encoded_projection,projection_digest:compact.projection_digest,legacy_payload_digest:compact.legacy_payload_digest,source_freshness:'PER_FIELD_REQUIRED_NOT_GENERATION_LEASE',operational_action_allowed:false,production_enabled:canonicalFactContract(p.contract_version)}};}
export async function validateContinuousAdmission(p,trust,c,at,actor){
 await validateContinuousProfile(p,trust);if(p.contract_version===DIRECTORY_FACT_PROFILE_VERSION)requireThat(new TextEncoder().encode(JSON.stringify(c)).length<=240000,'DIRECTORY_GENERATION_BUDGET_DENIED',413);validateDomainBridgeActor(p,actor,c.semantic_admission?.operator_principal_id);noSecrets(c);
 requireThat(c.semantic_profile_hash===trust.semantic_profile_hash&&c.operation==='NORMAL'&&c.dataset_id===p.dataset_id&&stable(c.artifacts)===stable(trust.artifacts),'CONTINUOUS_CANDIDATE_SCOPE_DENIED',409);
 const now=instant(at,'CONTINUOUS_NOW'),evaluation=instant(c.evaluation_time,'CONTINUOUS_EVALUATION');requireThat(evaluation<=now&&now<instant(c.valid_to,'CONTINUOUS_TO'),'CONTINUOUS_EVALUATION_EXPIRED',409);
 const compact=await project(p,c.semantic_bundle,c.evaluation_time),f=derived(p,trust,compact,c.evaluation_time,actor.id);
 // Recheck age at authority prepare/commit, not just the producer's evaluation time.
 requireThat(now-instant(f.proof.source_version_time,'CONTINUOUS_VERSION')<=p.reference_policy.max_snapshot_age_ms,'CONTINUOUS_SNAPSHOT_AGE_DENIED',409);
 const encoded=c.payload?.domain_snapshot?.encoded_projection;requireThat(encoded,'CONTINUOUS_PROJECTION_REQUIRED');
 requireThat(stable(await unpackDomainJson(encoded))===stable(compact)&&stable(c.payload)===stable(payload(p,compact,encoded)),'CONTINUOUS_OUTPUT_MISMATCH',409);
 requireThat(c.valid_from===f.valid_from&&c.valid_to===f.valid_to&&stable(c.inputs)===stable(f.inputs)&&stable(c.quality)===stable(f.quality),'CONTINUOUS_VALIDITY_MISMATCH',409);
 requireThat(stable(c.decision)===stable(f.decision)&&stable(c.semantic_admission)===stable(f.proof),'CONTINUOUS_ACTION_OR_PROOF_DENIED',409);return f.proof;
}
export async function buildContinuousCandidate(p,trust,{pin,raw_utf8,companions,publication_id,operator_principal_id,evaluation_time,candidate_id,expected_revision=0,expected_control_revision=0,logical_slot=0}){
 p=clone(p);trust=clone(trust);await validateContinuousProfile(p,trust);requireThat(p.operator_principal_ids.includes(operator_principal_id),'CONTINUOUS_OPERATOR_CLAIM_DENIED');
 const bundle={contract_version:continuousBundleVersion(p.contract_version),pin:clone(pin),encoded_source:await packDomainText(raw_utf8),...(p.contract_version===DIRECTORY_FACT_PROFILE_VERSION?{publication_id,companions:Object.fromEntries(await Promise.all(['support','venues'].map(async name=>{requireThat(companions?.[name],'DIRECTORY_COMPANION_REQUIRED');return [name,{pin:clone(companions[name].pin),encoded_source:await packDomainText(companions[name].raw_utf8)}];})))}:{})},compact=await project(p,bundle,evaluation_time),f=derived(p,trust,compact,evaluation_time,operator_principal_id);
 const c={schema_version:'openpq-candidate-v1',...trust,candidate_id,expected_revision,expected_control_revision,logical_slot,evaluation_time,valid_from:f.valid_from,valid_to:f.valid_to,inputs:f.inputs,quality:f.quality,artifacts:trust.artifacts,payload:payload(p,compact,await packDomainJson(compact)),operation:'NORMAL',decision:f.decision,semantic_bundle:bundle,semantic_admission:f.proof};candidate(c,instant(evaluation_time,'CONTINUOUS_EVALUATION'));if(p.contract_version===DIRECTORY_FACT_PROFILE_VERSION)requireThat(new TextEncoder().encode(JSON.stringify(c)).length<=240000,'DIRECTORY_GENERATION_BUDGET_DENIED',413);return c;
}
