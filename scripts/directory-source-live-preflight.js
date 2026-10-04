import {mkdir,writeFile} from 'node:fs/promises';
import {hash,requireThat} from '../src/platform/contracts.js';
import {DIRECTORY_FACT_PROFILE_VERSION} from '../src/platform/domain-continuous-contract.js';
import {DIRECTORY_FACT_ENVIRONMENT,DIRECTORY_FACT_ACCOUNT,DIRECTORY_FACT_DATASET,DIRECTORY_SOURCE_URLS} from '../src/platform/directory-execution-contract.js';
import {continuousArtifactRefs,buildContinuousCandidate} from '../src/platform/domain-continuous-admission.js';
import {ownedDirectoryPublication} from '../src/ingress/directory-feed.js';
await mkdir('directory-live-preflight',{recursive:true});const proof={status:'RUNNING',authority_bootstrapped:false,canonical_consumer_switched:false,operational_action_allowed:false};
try{
 const p={contract_version:DIRECTORY_FACT_PROFILE_VERSION,environment_id:DIRECTORY_FACT_ENVIRONMENT,dataset_id:DIRECTORY_FACT_DATASET,domain:'nearme',fixture_only:false,producer:{source_kind:'OWNER_PUBLIC_RUNTIME',url:DIRECTORY_SOURCE_URLS.index},operator_principal_ids:['directory-source'],reference_policy:{lease_ms:300000,max_snapshot_age_ms:31*86400000,future_skew_ms:0},artifact_refs:{}};p.artifact_refs=await continuousArtifactRefs(p);
 const t={account_id:DIRECTORY_FACT_ACCOUNT,environment_id:p.environment_id,dataset_id:p.dataset_id,authority_instance_id:'UNBOOTSTRAPPED_PREFLIGHT_ONLY',recovery_generation:'UNBOOTSTRAPPED_PREFLIGHT_ONLY',authority_locator_version:'1',locator_artifact_hash:'a'.repeat(64),namespace_id:'UNBOOTSTRAPPED_PREFLIGHT_ONLY',object_name:'UNBOOTSTRAPPED_PREFLIGHT_ONLY',native_id:'0'.repeat(64),semantic_profile_hash:await hash(p),approved_positive_decision_types:[],artifacts:Object.fromEntries(Object.entries(p.artifact_refs).map(([k,v])=>[k,v.hash]))};
 const source=await ownedDirectoryPublication(),at=new Date().toISOString(),c=await buildContinuousCandidate(p,t,{...source,operator_principal_id:'directory-source',evaluation_time:at,candidate_id:'directory-live-preflight'});
 proof.status='LIVE_THREE_FILE_DIRECTORY_CONTRACT_ACCEPTED_UNBOOTSTRAPPED';proof.publication_id=source.publication_id;proof.source_set_hash=c.semantic_admission.source_set_hash;proof.source_version_time=c.semantic_admission.source_version_time;proof.observed_at=at;proof.candidate_encoded_bytes=Buffer.byteLength(JSON.stringify(c));requireThat(proof.candidate_encoded_bytes<1500000,'DIRECTORY_RUNTIME_BUDGET_DENIED');
 for(const [name,item] of Object.entries({index:source,...source.companions}))await writeFile('directory-live-preflight/SOURCE_'+name+'.json',item.raw_utf8);
}catch(e){proof.status='DIRECTORY_LIVE_PREFLIGHT_FAILED';proof.error=e.code??'PREFLIGHT_UNAVAILABLE';process.exitCode=1;}
await writeFile('directory-live-preflight/PROOF.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
