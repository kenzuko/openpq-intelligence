import {hash,requireThat,stable} from '../platform/contracts.js';
import {noSecrets} from './common.js';
import {DOMAIN_DATASETS} from '../ingress/domain-source-common.js';

// Review recorded release inputs only. This is neither authentication nor a deployment gate.
export async function reviewCoreRelease(input){
 noSecrets(input);requireThat(input?.contract_version==='openpq-core-release-review-v1','CORE_RELEASE_REVIEW_CONTRACT');
 const {content_hash,...content}=input;requireThat(await hash(content)===content_hash,'CORE_RELEASE_REVIEW_TAMPERED');
 requireThat(input.remote_writes===0&&input.operational_action_allowed===false,'CORE_RELEASE_REVIEW_SCOPE');
 requireThat(typeof input.source_changes_sha256==='string'&&/^[a-f0-9]{64}$/.test(input.source_changes_sha256),'CORE_RELEASE_CHANGESET_REQUIRED');
 requireThat(input.core_base_sha===input.current_core_main_sha&&/^[a-f0-9]{40}$/.test(input.core_base_sha),'CORE_RELEASE_BASE_DRIFT');
 const expected=Object.keys(DOMAIN_DATASETS).sort();requireThat(Array.isArray(input.native_snapshot_proofs)&&stable(input.native_snapshot_proofs.map(p=>p.domain).sort())===stable(expected),'CORE_RELEASE_NATIVE_COVERAGE');
 for(const proof of input.native_snapshot_proofs)requireThat(proof.portable_readback_after_native_disposal===true&&proof.native_outage_signed_fallback_abstain===true&&proof.native_corrupt_generation_denied_then_original_restored===true&&proof.native_expiry_denied_during_control_outage===true&&proof.wrong_trust_and_corrupt_marker_denied===true&&proof.production_enabled===false&&proof.operational_action_allowed===false,'CORE_RELEASE_NATIVE_EVIDENCE_INCOMPLETE');
 requireThat(input.independent_readback_count===expected.length,'CORE_RELEASE_INDEPENDENT_READBACK_INCOMPLETE');
 requireThat(Array.isArray(input.owner_bindings)&&input.owner_bindings.length===4,'CORE_RELEASE_OWNER_BINDINGS_REQUIRED');
 const domains=['Weather','Airport','Transit','Near Me'];requireThat(stable(input.owner_bindings.map(x=>x.domain).sort())===stable(domains.sort()),'CORE_RELEASE_OWNER_SCOPE');
 const unresolved=[];
 for(const b of input.owner_bindings)for(const key of ['target_environment','authority_locator_ref','operator_identity_ref','approved_policy_set_ref','previous_deployment_ref'])if(typeof b[key]!=='string'||!b[key].trim())unresolved.push({domain:b.domain,field:key,status:'OWNER_BINDING_NOT_RECORDED'});
 return {contract_version:'openpq-core-release-review-result-v1',status:'LOCAL_REVIEW_COMPLETE_LIVE_RELEASE_NOT_CLEARED',local_snapshot_coverage:expected.length,local_recovery_and_outage:'PASS',unresolved,remaining_evidence:['CONTINUOUS_SHADOW_AND_CRITICAL_CYCLES','CURRENT_DEPLOYED_IDENTITY_AND_SIGNING_TRUST','OLD_WRITER_AUTH_DENY_FENCE','LIVE_CONSUMER_CANARY_AND_DEPLOYMENT_ROLLBACK'],input_hash:content_hash,recorded_bindings_are_authenticated:false,execution_allowed:false,production_enabled:false,operational_action_allowed:false};
}
