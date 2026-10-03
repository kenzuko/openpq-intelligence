import {candidate,hash,instant,requireThat,stable} from './contracts.js';
import {clone,noSecrets} from '../preparation/common.js';
import {normalizeWeatherDomain} from '../ingress/weather-domain.js';
import {normalizeAirportDomain} from '../ingress/airport-domain.js';
import {normalizeTransitDomain} from '../ingress/transit-domain.js';
import {normalizeNearMeDomain} from '../ingress/nearme-domain.js';
import {normalizeWeatherProduct} from '../ingress/weather-products.js';
import {DOMAIN_DATASETS,exact,utcTime} from '../ingress/domain-source-common.js';
import {packDomainText,packDomainJson,unpackDomainText,unpackDomainJson} from './domain-codec.js';

export const DOMAIN_PROFILE_VERSION='openpq-owned-domain-bridge-local-v1';
export const ISOLATED_DOMAIN_PROFILE_VERSION='openpq-owned-domain-bridge-isolated-v1';
export const ISOLATED_ACCOUNT_ID='c61a28455fe22f30619b35dd80c2d495';
export const isDomainProfile=p=>[DOMAIN_PROFILE_VERSION,ISOLATED_DOMAIN_PROFILE_VERSION].includes(p.contract_version);
const isolated=p=>p.contract_version===ISOLATED_DOMAIN_PROFILE_VERSION;
const bundleVersion=p=>isolated(p)?'openpq-owned-domain-bundle-isolated-v1':DOMAIN_BUNDLE_VERSION;
export const DOMAIN_BUNDLE_VERSION='openpq-owned-domain-bundle-local-v1';
const adapters={weather:normalizeWeatherDomain,airport:normalizeAirportDomain,transit:normalizeTransitDomain,nearme:normalizeNearMeDomain,...Object.fromEntries(['weather_forecast','weather_marine','weather_cloud','weather_compact','weather_meta','weather_manifest'].map(key=>[key,(input,at)=>normalizeWeatherProduct(key,input,at)]))};
export async function projectOwnedDomain(domain,input,at){requireThat(Object.hasOwn(adapters,domain),'DOMAIN_UNSUPPORTED');return adapters[domain](input,at);}
const RULE={contract_version:DOMAIN_PROFILE_VERSION,source_admission:'PINNED_OWNED_OUTPUT_SNAPSHOT',source_author_assurance:'OWNED_OUTPUT_CAPTURE_ONLY',action_allowed:false,mode:'BRIDGE_DEPENDENT_SHADOW',producer_independence:false,production_enabled:false};
const SCHEMA={profile:DOMAIN_PROFILE_VERSION,bundle:DOMAIN_BUNDLE_VERSION,encoding:'GZIP_BASE64',raw_max_bytes:1500000,compressed_max_bytes:120000};
export async function domainBridgeArtifactRefs(profile){
 profile=clone(profile);const a={rule:await hash({...RULE,contract_version:profile.contract_version,domain:profile.domain,dataset_id:profile.dataset_id}),config:await hash({source_pin:profile.source_pin,operator_principal_ids:profile.operator_principal_ids}),policy:await hash({scope:isolated(profile)?'ISOLATED_CAPTURE_REFERENCE_LEASE_ONLY':'LOCAL_TEST_REHEARSAL_LEASE_ONLY',test_window:profile.test_window,source_policies_activated:false}),schema:await hash({...SCHEMA,profile:profile.contract_version,bundle:bundleVersion(profile)})};
 return Object.fromEntries(Object.entries(a).map(([k,v])=>[k,{hash:v}]));
}
export async function validateDomainBridgeProfile(profile,trust){
 profile=clone(profile);trust=clone(trust);exact(profile,['contract_version','environment_id','dataset_id','domain','fixture_only','source_pin','operator_principal_ids','test_window','artifact_refs'],'DOMAIN_PROFILE');
 requireThat(isDomainProfile(profile)&&profile.environment_id===(isolated(profile)?'isolated-test':'local-test')&&trust.environment_id===profile.environment_id&&(!isolated(profile)||trust.account_id===ISOLATED_ACCOUNT_ID)&&profile.fixture_only===false&&Object.hasOwn(adapters,profile.domain)&&profile.dataset_id===DOMAIN_DATASETS[profile.domain]&&profile.dataset_id===trust.dataset_id,'DOMAIN_PROFILE_SCOPE_DENIED');
 exact(profile.test_window,['valid_from','valid_to','basis'],'DOMAIN_TEST_WINDOW');const from=instant(profile.test_window.valid_from,'DOMAIN_LEASE_FROM'),to=instant(profile.test_window.valid_to,'DOMAIN_LEASE_TO');requireThat(profile.test_window.basis===(isolated(profile)?'ISOLATED_CAPTURE_REFERENCE_ONLY':'LOCAL_TEST_REHEARSAL_ONLY')&&to>from&&to-from<=300000,'DOMAIN_TEST_LEASE_INVALID');
 requireThat(Array.isArray(profile.operator_principal_ids)&&profile.operator_principal_ids.length>0&&profile.operator_principal_ids.length<=8&&new Set(profile.operator_principal_ids).size===profile.operator_principal_ids.length&&profile.operator_principal_ids.every(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(x)),'DOMAIN_OPERATOR_SET_INVALID');
 requireThat(stable(profile.artifact_refs)===stable(await domainBridgeArtifactRefs(profile)),'DOMAIN_PROFILE_ARTIFACT_MISMATCH');
 for(const k of ['rule','config','policy','schema'])requireThat(trust.artifacts[k]===profile.artifact_refs[k].hash,'SEMANTIC_AUTHORITY_ARTIFACT_MISMATCH',409);
 requireThat(await hash(profile)===trust.semantic_profile_hash,'SEMANTIC_PROFILE_PIN_MISMATCH',409);noSecrets(profile);return profile;
}
export function validateDomainBridgeActor(profile,actor,boundId){
 requireThat(actor&&actor.environment_id===profile.environment_id&&actor.dataset_id===profile.dataset_id&&actor.mode==='LIVE'&&Array.isArray(actor.permissions)&&actor.permissions.includes('domain-source-admit')&&profile.operator_principal_ids.includes(actor.id),'DOMAIN_OPERATOR_DENIED',403);
 requireThat(boundId===actor.id,'DOMAIN_OPERATOR_BINDING_MISMATCH',403);
}
export async function domainProjection(profile,bundle,evaluation_time){
 exact(bundle,['contract_version','pin','encoded_source'],'DOMAIN_BUNDLE');requireThat(bundle.contract_version===bundleVersion(profile)&&stable(bundle.pin)===stable(profile.source_pin),'DOMAIN_SOURCE_PIN_MISMATCH');
 const raw_utf8=await unpackDomainText(bundle.encoded_source);requireThat(bundle.encoded_source.sha256===bundle.pin.payload_sha256,'DOMAIN_RAW_DIGEST_MISMATCH');
 const projection=await adapters[profile.domain]({pin:bundle.pin,raw_utf8},evaluation_time);const {legacy_payload,...compact}=projection;
 return {compact,legacy_payload};
}
function facts(profile,trust,projection,operator_principal_id){
 // Wire source_time identifies the versioned producer snapshot, not an observation/model/row time.
 const source_time=projection.metadata.generated_at?.utc||projection.metadata.board_checked_at?.utc;requireThat(utcTime(source_time),'DOMAIN_SNAPSHOT_VERSION_TIME_REQUIRED');
 const valid_to=profile.test_window.valid_to,age=instant(valid_to,'DOMAIN_LEASE_TO')-instant(source_time,'DOMAIN_SNAPSHOT_TIME');requireThat(age>0&&Number.isSafeInteger(age),'DOMAIN_SNAPSHOT_AFTER_TEST_LEASE');
 const inputs=[{source_id:'OWNED_OUTPUT_SNAPSHOT:'+profile.domain,source_type:'OFFICIAL_REPORT',source_time,valid_to,max_age_ms:age}];
 const proof={contract_version:profile.contract_version,profile_hash:trust.semantic_profile_hash,input_hash:profile.source_pin.payload_sha256,preparation_hash:projection.projection_digest,valid_until:valid_to,operator_principal_id,source_author_assurance:'OWNED_OUTPUT_CAPTURE_ONLY',source_policies_activated:false,producer_independence:false,action_allowed:false};
 const decision={type:profile.domain+'.owned.snapshot.fact',kind:'FACT',effect:'ABSTAIN',action_until:valid_to,minimum_evidence_met:false,reason_codes:[isolated(profile)?'ISOLATED_BRIDGE_SNAPSHOT_NO_OPERATIONAL_ACTION':'LOCAL_BRIDGE_SNAPSHOT_NO_OPERATIONAL_ACTION']};
 return {inputs,proof,decision,quality:{completeness:projection.issues.length?'PARTIAL':'COMPLETE',resolution:projection.issues.length?'UNCERTAIN':'RESOLVED'}};
}
function envelope(profile,projection,encoded_projection){return {domain_snapshot:{contract_version:isolated(profile)?'openpq-domain-snapshot-isolated-v1':'openpq-domain-snapshot-local-v1',domain:profile.domain,dataset_id:profile.dataset_id,mode:'BRIDGE_DEPENDENT_SHADOW',fixture_only:false,encoded_projection,projection_digest:projection.projection_digest,legacy_payload_digest:projection.legacy_payload_digest,source_freshness:'PER_FIELD_REQUIRED_NOT_GENERATION_LEASE',operational_action_allowed:false,production_enabled:false}};}
export async function validateDomainBridgeAdmission(profile,trust,c,at,actor){
 profile=clone(profile);trust=clone(trust);c=clone(c);actor=clone(actor||{});await validateDomainBridgeProfile(profile,trust);validateDomainBridgeActor(profile,actor,c.semantic_admission?.operator_principal_id);
 const now=instant(at,'DOMAIN_NOW'),from=instant(profile.test_window.valid_from,'DOMAIN_LEASE_FROM'),to=instant(profile.test_window.valid_to,'DOMAIN_LEASE_TO');requireThat(now>=from&&now<to,'DOMAIN_TEST_LEASE_EXPIRED',409);
 requireThat(c.semantic_profile_hash===trust.semantic_profile_hash&&c.operation==='NORMAL'&&c.dataset_id===profile.dataset_id,'DOMAIN_CANDIDATE_SCOPE_DENIED',409);requireThat(stable(c.artifacts)===stable(trust.artifacts),'SEMANTIC_CANDIDATE_ARTIFACT_MISMATCH',409);noSecrets(c);
 const evaluation=instant(c.evaluation_time,'DOMAIN_EVALUATION');requireThat(evaluation>=from&&evaluation<=now,'DOMAIN_EVALUATION_OUTSIDE_LEASE');
 const {compact}=await domainProjection(profile,c.semantic_bundle,c.evaluation_time),f=facts(profile,trust,compact,actor.id);
 const p=c.payload?.domain_snapshot;requireThat(p?.encoded_projection,'DOMAIN_PROJECTION_REQUIRED');const decoded=await unpackDomainJson(p.encoded_projection);
 requireThat(stable(decoded)===stable(compact)&&stable(c.payload)===stable(envelope(profile,compact,p.encoded_projection)),'DOMAIN_OUTPUT_MISMATCH',409);
 requireThat(stable(c.inputs)===stable(f.inputs)&&stable(c.quality)===stable(f.quality)&&c.valid_from===profile.test_window.valid_from&&c.valid_to===profile.test_window.valid_to,'DOMAIN_VALIDITY_OR_INPUT_MISMATCH',409);
 requireThat(stable(c.decision)===stable(f.decision),'DOMAIN_ACTION_FORBIDDEN',409);requireThat(stable(c.semantic_admission)===stable(f.proof),'DOMAIN_PROOF_MISMATCH',409);return f.proof;
}
export async function buildDomainBridgeCandidate(profile,trust,{raw_utf8,operator_principal_id,evaluation_time,candidate_id,expected_revision=0,expected_control_revision=0,logical_slot=0}){
 profile=clone(profile);trust=clone(trust);await validateDomainBridgeProfile(profile,trust);requireThat(profile.operator_principal_ids.includes(operator_principal_id),'DOMAIN_OPERATOR_CLAIM_DENIED');
 const bundle={contract_version:bundleVersion(profile),pin:profile.source_pin,encoded_source:await packDomainText(raw_utf8)}, {compact}=await domainProjection(profile,bundle,evaluation_time),f=facts(profile,trust,compact,operator_principal_id);
 const c={schema_version:'openpq-candidate-v1',...trust,candidate_id,expected_revision,expected_control_revision,logical_slot,evaluation_time,valid_from:profile.test_window.valid_from,valid_to:profile.test_window.valid_to,inputs:f.inputs,quality:f.quality,artifacts:trust.artifacts,payload:envelope(profile,compact,await packDomainJson(compact)),operation:'NORMAL',decision:f.decision,semantic_bundle:bundle,semantic_admission:f.proof};
 candidate(c,instant(evaluation_time,'DOMAIN_EVALUATION'));return c;
}
