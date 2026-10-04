import {mkdir,writeFile} from 'node:fs/promises';
import {hash} from '../src/platform/contracts.js';
import {continuousArtifactRefs,buildContinuousCandidate} from '../src/platform/domain-continuous-admission.js';
import {WEATHER_FACT_PROFILE_VERSION} from '../src/platform/domain-continuous-contract.js';
import {WEATHER_FACT_ENVIRONMENT,WEATHER_FACT_ACCOUNT,WEATHER_SOURCE_URLS} from '../src/platform/weather-execution-contract.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {ownedReference} from '../src/ingress/domain-feed.js';
const root='weather-source-live-preflight';await mkdir(root,{recursive:true});
const proof={status:'RUNNING',code_sha:process.env.GITHUB_SHA,roles:[],authority_bootstrapped:false,canonical_consumer_switched:false,whole_core_production_ready:false};
try{
 for(const [domain,url] of Object.entries(WEATHER_SOURCE_URLS)){
  const p={contract_version:WEATHER_FACT_PROFILE_VERSION,environment_id:WEATHER_FACT_ENVIRONMENT,dataset_id:DOMAIN_DATASETS[domain],domain,fixture_only:false,producer:{source_kind:'OWNER_PUBLIC_RUNTIME',url},operator_principal_ids:['weather-source'],reference_policy:{lease_ms:300000,max_snapshot_age_ms:31*86400000,future_skew_ms:0},artifact_refs:{}};
  p.artifact_refs=await continuousArtifactRefs(p);
  const t={environment_id:p.environment_id,account_id:WEATHER_FACT_ACCOUNT,dataset_id:p.dataset_id,authority_instance_id:'UNBOOTSTRAPPED_PREFLIGHT_ONLY',recovery_generation:'UNBOOTSTRAPPED_PREFLIGHT_ONLY',authority_locator_version:'1',locator_artifact_hash:'a'.repeat(64),namespace_id:'UNBOOTSTRAPPED_PREFLIGHT_ONLY',object_name:'UNBOOTSTRAPPED_PREFLIGHT_ONLY/'+p.dataset_id,native_id:'0'.repeat(64),semantic_profile_hash:await hash(p),approved_positive_decision_types:[],artifacts:Object.fromEntries(Object.entries(p.artifact_refs).map(([k,v])=>[k,v.hash]))};
  const source=await ownedReference(p.producer),at=new Date().toISOString();
  const c=await buildContinuousCandidate(p,t,{...source,operator_principal_id:'weather-source',evaluation_time:at,candidate_id:'preflight-'+domain});
  await writeFile(root+'/SOURCE_'+domain+'.json',source.raw_utf8);
  proof.roles.push({domain,dataset_id:p.dataset_id,url,bytes:Buffer.byteLength(source.raw_utf8),source_digest:source.pin.payload_sha256,source_version_time:c.semantic_admission.source_version_time,observed_at:at,source_version_age_ms:Date.parse(at)-Date.parse(c.semantic_admission.source_version_time),candidate_encoded_bytes:Buffer.byteLength(JSON.stringify(c)),source_policies_activated:false,operational_action_allowed:false});
 }
 proof.status='SIX_LIVE_SOURCE_CONTRACTS_ACCEPTED_UNBOOTSTRAPPED';
}catch(e){proof.status='WEATHER_SOURCE_PREFLIGHT_FAILED';proof.error=e.code??'SOURCE_PREFLIGHT_UNAVAILABLE';process.exitCode=1;}
await writeFile(root+'/PROOF.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:proof.status,roles:proof.roles.length,error:proof.error??null}));
