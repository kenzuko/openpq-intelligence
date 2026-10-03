import {hash,instant,locator,requireThat,stable,text} from './contracts.js';
import {verifyAuthoritySnapshot} from './authority-snapshot.js';

export const RECOVERY_BOOTSTRAP_VERSION='openpq-frozen-recovery-bootstrap-v1';
// Plans are pinned deployment configuration, never accepted from request/backup claims.
export async function frozenRecoveryState(snapshot,plan,target,signer,evaluation_time){
 requireThat(plan?.contract_version===RECOVERY_BOOTSTRAP_VERSION,'RECOVERY_PLAN_REQUIRED',503);
 locator(target);locator(plan.source_authority);
 requireThat(['local-test','isolated-test'].includes(target.environment_id),'PRODUCTION_GATE_CLOSED',503);
 requireThat(plan.target_authority_hash===await hash(target),'RECOVERY_TARGET_PIN_MISMATCH',409);
 requireThat(plan.snapshot_digest===await hash(snapshot),'RECOVERY_SNAPSHOT_PIN_MISMATCH',409);
 const checked=await verifyAuthoritySnapshot(snapshot,plan.source_authority),source=plan.source_authority;
 requireThat(source.environment_id===target.environment_id&&source.dataset_id===target.dataset_id,'RECOVERY_SCOPE_MISMATCH',409);
 requireThat(target.recovery_generation!==source.recovery_generation,'RECOVERY_NEW_GENERATION_REQUIRED',409);
 requireThat(target.native_id!==source.native_id&&target.object_name!==source.object_name&&target.authority_instance_id!==source.authority_instance_id,'RECOVERY_FRESH_NATIVE_REQUIRED',409);
 requireThat(target.authority_locator_version!==source.authority_locator_version&&target.locator_artifact_hash!==source.locator_artifact_hash,'RECOVERY_LOCATOR_MIGRATION_REQUIRED',409);
 const oldKeys=Object.values(source.receipt_keys||{}),newKeys=Object.values(target.receipt_keys||{});
 requireThat(newKeys.length>0&&newKeys.every(k=>k.kty==='EC'&&k.crv==='P-256'&&k.x&&k.y&&!k.d&&!oldKeys.some(o=>o.x===k.x&&o.y===k.y)),'RECOVERY_FRESH_SIGNER_REQUIRED',409);
 const publicKey=target.receipt_keys[signer?.key_id];requireThat(publicKey&&publicKey.x===signer.private_jwk?.x&&publicKey.y===signer.private_jwk?.y,'RECOVERY_SIGNER_CONFIGURATION_INVALID',503);
 requireThat(Array.isArray(target.approved_positive_decision_types)&&target.approved_positive_decision_types.length===0,'RECOVERY_POSITIVE_POLICIES_DENIED',409);
 requireThat(Number.isSafeInteger(plan.old_epoch_high_watermark)&&plan.old_epoch_high_watermark>=checked.manifest.control.epoch&&plan.old_epoch_high_watermark<Number.MAX_SAFE_INTEGER-1,'RECOVERY_EPOCH_HIGH_WATERMARK_REQUIRED',409);
 const now=instant(evaluation_time,'RECOVERY_TIME');requireThat(now>=instant(checked.manifest.captured_at,'SNAPSHOT_TIME'),'RECOVERY_SNAPSHOT_IN_FUTURE',409);
 text(plan.owner,'RECOVERY_OWNER');text(plan.snapshot_key,'RECOVERY_SNAPSHOT_KEY');
 requireThat(/^recovery\/snapshots\/[a-zA-Z0-9_-]{1,128}\.json$/.test(plan.snapshot_key),'RECOVERY_ARCHIVE_KEY_INVALID');
 return {...target,owner:plan.owner,epoch:plan.old_epoch_high_watermark+1,revision:0,control_revision:0,active:null,frozen:true,next_transition_at:null,recovery:{contract_version:RECOVERY_BOOTSTRAP_VERSION,source_locator_artifact_hash:source.locator_artifact_hash,snapshot_digest:plan.snapshot_digest,snapshot_key:plan.snapshot_key,source_watermark:checked.manifest.watermark,restored_at:evaluation_time,history_discontinuity:false,historical_commands_imported:false,historical_outbox_imported:false,active_receipt_imported:false,overrides_imported:false,writer_resume_allowed:false,cloud_fencing_proven:false,full_system_restore_proven:false}};
}
