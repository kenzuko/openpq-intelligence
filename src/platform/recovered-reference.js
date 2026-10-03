import {hash,instant,requireThat,stable} from './contracts.js';
import {verifyAuthoritySnapshot} from './authority-snapshot.js';
import {recoveredDomainReadback} from './recovery-bootstrap.js';
export const RECOVERED_REFERENCE_VERSION='openpq-recovered-domain-reference-v1';
// Public, pinned read configuration. No key material, control/write capability or new lease.
export async function recoveredReferenceConfig(config,trust){
 requireThat(config&&stable(Object.keys(config).sort())===stable(['plan','target_snapshot_digest','target_snapshot_key']),'RECOVERED_REFERENCE_CONFIG_REQUIRED',503);
 requireThat(/^recovery\/snapshots\/[a-zA-Z0-9_-]{1,128}\.json$/.test(config.target_snapshot_key)&&config.target_snapshot_key!==config.plan?.snapshot_key&&/^[a-f0-9]{64}$/.test(config.target_snapshot_digest),'RECOVERED_REFERENCE_TARGET_KEY_INVALID');
 requireThat(config.plan?.target_authority_hash===await hash(trust)&&config.plan.source_authority?.dataset_id===trust.dataset_id&&config.plan.source_authority.environment_id===trust.environment_id&&config.plan.source_authority.semantic_profile_hash===trust.semantic_profile_hash&&stable(config.plan.source_authority.artifacts)===stable(trust.artifacts)&&stable(trust.approved_positive_decision_types)==='[]','RECOVERED_REFERENCE_TARGET_TRUST_INVALID',409);
 requireThat(/^recovery\/domains\/[a-zA-Z0-9_-]{1,128}\.json$/.test(config.plan.domain_archive?.key),'RECOVERED_REFERENCE_ARCHIVE_KEY_INVALID');
 return config;
}
export async function recoveredReferenceView(snapshot,bundle,config,trust,evaluationTime){
 await recoveredReferenceConfig(config,trust);
 requireThat(await hash(snapshot)===config.target_snapshot_digest,'RECOVERED_REFERENCE_SNAPSHOT_PIN_INVALID',409);
 const checked=await verifyAuthoritySnapshot(snapshot,trust),state=checked.manifest.control;
 requireThat(instant(evaluationTime,'RECOVERED_REFERENCE_TIME')>=instant(checked.manifest.captured_at,'SNAPSHOT_TIME'),'RECOVERED_REFERENCE_SNAPSHOT_IN_FUTURE',409);
 requireThat(state.epoch===config.plan.old_epoch_high_watermark+1&&state.control_revision===0&&state.frozen&&state.active===null&&state.revision===0&&checked.tables.prepared.length===0&&checked.tables.commands.length===0&&checked.tables.outbox.length===0&&checked.tables.audit.length===1&&JSON.parse(checked.tables.audit[0].body).action==='RECOVERY_BOOTSTRAP','RECOVERED_REFERENCE_CONTROL_INVALID',409);
 const archive=await recoveredDomainReadback(bundle,config.plan,state,evaluationTime);
 const publication=bundle.publication.receipt,generation=bundle.generations.find(x=>x.key===publication.key).content;
 return {contract:RECOVERED_REFERENCE_VERSION,dataset_id:trust.dataset_id,data:archive.projection,source_payload:archive.legacy_payload,
  recovery:{target_authority_instance_id:trust.authority_instance_id,target_recovery_generation:trust.recovery_generation,target_snapshot_digest:config.target_snapshot_digest,source_archive_digest:config.plan.domain_archive.digest,source_watermark:archive.watermark,frozen_epoch:state.epoch},
  serving:{authority:'VERIFIED_FROZEN_ARCHIVE',decision_eligibility:'ABSTAIN',archive_readback_only:true,display_lease_expired:archive.display_lease_expired,original_display_expires_at:generation.valid_to,source_version_time:publication.semantic_admission.source_version_time,evaluated_at:evaluationTime,domain_fields:archive.field_serving,operational_action_allowed:false},
  writer_resume_allowed:false,live_serving_restored:false,full_system_restore_proven:false,production_enabled:false};
}
