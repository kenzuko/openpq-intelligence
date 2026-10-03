import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,requireThat,stable} from '../../src/platform/contracts.js';
import {verifyAuthoritySnapshot} from '../../src/platform/authority-snapshot.js';
import {recoveredDomainReadback} from '../../src/platform/recovery-bootstrap.js';
import {DOMAIN_DATASETS} from '../../src/ingress/domain-source-common.js';

export async function verifyDomainRecoveryProof(directory,pins){
 const read=async file=>JSON.parse(await readFile(path.join(directory,file),'utf8')),proof=await read('PROOF.json');
 requireThat(proof.run_id===pins.run_id&&proof.code_sha===pins.code_sha,'DOMAIN_CLOUD_PROOF_RUN_PIN_INVALID');
 requireThat(proof.status==='PASS_TEN_FROZEN_CLOUD_DOMAIN_ARCHIVE_RESTORES'&&proof.cleanup.status==='SUCCESS'&&proof.cleanup.workers.length===2&&proof.cleanup.workers.every(x=>x.deleted===true),'DOMAIN_CLOUD_PROOF_INCOMPLETE');
 for(const flag of ['production_enabled','writer_resumed','live_serving_restored','full_system_restore_proven','direct_s3_write_key_revocation_proven','offsite_restore_proven'])requireThat(proof[flag]===false,'DOMAIN_CLOUD_PROOF_OVERCLAIM');
 const domains=Object.keys(DOMAIN_DATASETS);requireThat(proof.domains.length===domains.length&&new Set(proof.domains.map(x=>x.domain)).size===domains.length,'DOMAIN_CLOUD_PROOF_DATASETS_INVALID');
 const before=await read('PREFLIGHT.json'),after=await read('POSTFLIGHT.json');
 for(const key of ['workers','namespaces'])requireThat(stable([...before[key]].sort((a,b)=>stable(a).localeCompare(stable(b))))===stable([...after[key]].sort((a,b)=>stable(a).localeCompare(stable(b)))),'DOMAIN_CLOUD_PROOF_INVENTORY_CHANGED');
 const results=[];
 for(const domain of domains){
  const p=pins.domains?.[domain],row=proof.domains.find(x=>x.domain===domain);requireThat(p&&row?.dataset_id===DOMAIN_DATASETS[domain]&&row.status==='PASS_FROZEN_CLOUD_DOMAIN_ARCHIVE_RESTORE','DOMAIN_CLOUD_PROOF_DOMAIN_PIN_REQUIRED');
  const source=p.source_authority,target=p.target_authority,bundle=await read(domain+'/BUNDLE.json'),plan=await read(domain+'/RECOVERY_PLAN.json'),targetSnapshot=await read(domain+'/TARGET_SNAPSHOT.json'),observed=await read(domain+'/TARGET_READBACK.json');
  requireThat(await hash(bundle)===p.bundle_digest&&await hash(targetSnapshot)===p.target_snapshot_digest,'DOMAIN_CLOUD_PROOF_BYTES_PIN_INVALID');
  requireThat(stable(plan.source_authority)===stable(source)&&plan.target_authority_hash===await hash(target)&&plan.snapshot_digest===await hash(bundle.snapshot)&&plan.domain_archive.digest===p.bundle_digest,'DOMAIN_CLOUD_PROOF_PLAN_PIN_INVALID');
  requireThat(source.dataset_id===target.dataset_id&&source.environment_id==='isolated-test'&&target.environment_id==='isolated-test'&&source.namespace_id!==target.namespace_id&&source.native_id!==target.native_id&&source.recovery_generation!==target.recovery_generation&&source.locator_artifact_hash!==target.locator_artifact_hash&&source.authority_locator_version!==target.authority_locator_version,'DOMAIN_CLOUD_PROOF_TARGET_NOT_DISTINCT');
  requireThat(Object.values(target.receipt_keys).every(k=>!Object.values(source.receipt_keys).some(o=>o.x===k.x&&o.y===k.y)),'DOMAIN_CLOUD_PROOF_SIGNER_REUSED');
  const checked=await verifyAuthoritySnapshot(targetSnapshot,target),state=checked.manifest.control;
  requireThat(state.epoch===plan.old_epoch_high_watermark+1&&state.control_revision===0&&state.revision===0&&state.active===null&&state.frozen&&checked.tables.prepared.length===0&&checked.tables.commands.length===0&&checked.tables.outbox.length===0&&checked.tables.audit.length===1&&JSON.parse(checked.tables.audit[0].body).action==='RECOVERY_BOOTSTRAP','DOMAIN_CLOUD_PROOF_EXECUTABLE_HISTORY_IMPORTED');
  const closure=await recoveredDomainReadback(bundle,plan,state,proof.finished_at),f=row.fencing;
  requireThat([401,403].includes(f.command_http_status)&&[401,403].includes(f.storage_gateway_http_status)&&f.read_witness_status===200&&f.write_witness_status===200&&f.old_r2_binding_removed===true&&f.scope==='APPLICATION_STORAGE_GATEWAY_AND_BINDING_NOT_S3_ACCESS_KEY'&&Date.parse(f.observed_at)>=Date.parse(f.revoked_at),'DOMAIN_CLOUD_PROOF_FENCING_INVALID');
  requireThat(row.restart_changed_incarnation===true&&stable(row.captured_watermark)===stable(closure.watermark)&&row.timing.lost_committed_revisions_in_this_drill===0&&row.timing.scope==='THIS_FRESH_REFERENCE_DRILL_NOT_DOMAIN_SLA'&&Number.isFinite(row.timing.restore_and_restart_readback_ms)&&row.timing.restore_and_restart_readback_ms>=0&&Number.isFinite(row.timing.capture_export_lag_ms)&&row.timing.capture_export_lag_ms>=0,'DOMAIN_CLOUD_PROOF_RESTORE_OBSERVATION_INVALID');
  requireThat(observed.legacy_payload_digest===closure.legacy_payload_digest&&row.legacy_payload_digest===closure.legacy_payload_digest&&row.source_digest===bundle.generations.find(x=>x.content.semantic_admission.input_hash===row.source_digest)?.content.semantic_admission.input_hash&&observed.archive_readback_only===true&&observed.live_serving_restored===false&&observed.writer_resume_allowed===false&&observed.full_system_restore_proven===false,'DOMAIN_CLOUD_PROOF_READBACK_INVALID');
  results.push({domain,dataset_id:source.dataset_id,status:'INDEPENDENT_SIGNED_FROZEN_DOMAIN_ARCHIVE_PASS',legacy_payload_digest:closure.legacy_payload_digest,watermark:closure.watermark});
 }
 return {status:'PASS_TEN_INDEPENDENT_SIGNED_FROZEN_DOMAIN_ARCHIVE_RESTORES',run_id:proof.run_id,code_sha:proof.code_sha,results,live_serving_restored:false,writer_resumed:false,direct_s3_write_key_revocation_proven:false,full_system_restore_proven:false,production_enabled:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [directory,pinFile]=process.argv.slice(2);if(!directory||!pinFile)throw Error('usage: DIRECTORY INDEPENDENT_PINS');
 const result=await verifyDomainRecoveryProof(directory,JSON.parse(await readFile(pinFile,'utf8')));await writeFile(path.join(directory,'INDEPENDENT_READBACK.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
