import {hash,requireThat,stable} from './contracts.js';
import {verifyAuthoritySnapshot,SNAPSHOT_MAX_BYTES} from './authority-snapshot.js';
import {domainBridgeArtifactDocuments,validateDomainBridgeProfile} from './domain-bridge-admission.js';
import {continuousArtifactDocuments,isContinuousProfile,validateContinuousProfile} from './domain-continuous-admission.js';
import {domainLegacyView,domainSnapshotServing} from './domain-serving.js';
import {noSecrets} from '../preparation/common.js';

export const DOMAIN_RECOVERY_CLOSURE_VERSION='openpq-domain-recovery-closure-v1';
const exact=(x,keys)=>requireThat(x&&stable(Object.keys(x).sort())===stable([...keys].sort()),'RECOVERY_CLOSURE_FIELDS_INVALID');
// Archive verification only. This module has no storage, network, authority mutation or clock capability.
export async function verifyDomainRecoveryClosure(bundle,independentTrust,evaluationTime){
 requireThat(new TextEncoder().encode(stable(bundle)).length<=2*SNAPSHOT_MAX_BYTES,'RECOVERY_CLOSURE_TOO_LARGE',413);
 exact(bundle,['contract_version','snapshot','profile','artifact_documents','generations','publication']);
 requireThat(bundle.contract_version===DOMAIN_RECOVERY_CLOSURE_VERSION,'RECOVERY_CLOSURE_CONTRACT_INVALID');
 noSecrets(bundle);requireThat(Number.isFinite(Date.parse(evaluationTime)),'RECOVERY_CLOSURE_TIME_INVALID');
 const {manifest,tables}=await verifyAuthoritySnapshot(bundle.snapshot,independentTrust);
 const continuous=isContinuousProfile(bundle.profile);
 await (continuous?validateContinuousProfile:validateDomainBridgeProfile)(bundle.profile,independentTrust);
 const expected=(continuous?continuousArtifactDocuments:domainBridgeArtifactDocuments)(bundle.profile);
 exact(bundle.artifact_documents,Object.keys(expected));
 for(const [kind,value] of Object.entries(expected))requireThat(stable(bundle.artifact_documents[kind])===stable(value)&&await hash(value)===independentTrust.artifacts[kind]&&manifest.control.artifacts[kind]===independentTrust.artifacts[kind],'RECOVERY_CLOSURE_ARTIFACT_INVALID');
 requireThat(Array.isArray(bundle.generations)&&bundle.generations.length===tables.prepared.length,'RECOVERY_CLOSURE_GENERATIONS_INCOMPLETE');
 for(let i=0;i<tables.prepared.length;i++){
  const prepared=JSON.parse(tables.prepared[i].body),entry=bundle.generations[i];exact(entry,['key','content']);
  const {key,digest,prepared_until,...generation}=prepared;
  requireThat(entry.key===key&&stable(entry.content)===stable(generation)&&await hash(entry.content)===digest,'RECOVERY_CLOSURE_GENERATION_INVALID');
 }
 requireThat(manifest.control.active,'RECOVERY_CLOSURE_PUBLICATION_REQUIRED');
 const receipt=manifest.control.active,generation=bundle.generations.find(x=>x.key===receipt.key)?.content;
 requireThat(bundle.publication&&stable(bundle.publication.receipt)===stable(receipt),'RECOVERY_CLOSURE_PUBLICATION_INVALID');
 const legacy=await domainLegacyView(generation,bundle.publication,independentTrust);
 const view=await domainSnapshotServing(generation,Date.parse(evaluationTime));
 return {status:'SIGNED_DOMAIN_ARCHIVE_CLOSURE_PASS',dataset_id:independentTrust.dataset_id,domain:bundle.profile.domain,snapshot_digest:await hash(bundle.snapshot),watermark:manifest.watermark,artifact_documents_verified:true,prepared_generation_objects_verified:bundle.generations.length,source_payload_verified:true,legacy_payload_digest:await hash(legacy),legacy_payload:legacy,projection:view.projection,field_serving:view.serving,evaluated_at:evaluationTime,display_lease_expired:Date.parse(generation.valid_to)<=Date.parse(evaluationTime),archive_readback_only:true,writer_resume_allowed:false,live_serving_restored:false,deploy_code_included:false,scheduler_state_included:false,storage_credentials_included:false,full_system_restore_proven:false,production_enabled:false};
}
