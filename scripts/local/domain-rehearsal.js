// Shared local rehearsal setup. No runtime/deploy module imports this file.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {setup} from '../../tests/support.js';
import {DOMAIN_DATASETS} from '../../src/ingress/domain-source-common.js';
import {DOMAIN_PROFILE_VERSION,domainBridgeArtifactRefs,buildDomainBridgeCandidate} from '../../src/platform/domain-bridge-admission.js';
import {domainLegacyView} from '../../src/platform/domain-serving.js';
export async function openDomainRehearsal(domain,meta){
 let s;try{
  const raw_utf8=await readFile(new URL('../../tests/data/domains/'+domain+'.json',import.meta.url),'utf8');
  const profile={contract_version:DOMAIN_PROFILE_VERSION,environment_id:'local-test',dataset_id:DOMAIN_DATASETS[domain],domain,fixture_only:false,source_pin:meta.pins[domain],operator_principal_ids:['operator'],test_window:{valid_from:meta.evaluation_time,valid_to:'2026-10-03T01:17:00.000Z',basis:'LOCAL_TEST_REHEARSAL_ONLY'},artifact_refs:{}};
  profile.artifact_refs=await domainBridgeArtifactRefs(profile);s=await setup({semanticProfile:profile,dataset_id:profile.dataset_id,domainOperator:true,domainReplayClock:true});
  const c=await buildDomainBridgeCandidate(profile,s.trust,{raw_utf8,operator_principal_id:'operator',evaluation_time:meta.evaluation_time,candidate_id:domain+'-bridge-proof',logical_slot:10});
  const prepare=await s.call('prepare',c,'test-only-operator');assert.equal(prepare.status,200,JSON.stringify(prepare));const committed=await s.call('commit',{...s.trust,command_id:domain+'-bridge-commit',digest:prepare.body.digest,expires_at:'2026-10-03T01:16:59.000Z'},'test-only-operator');assert.equal(committed.status,200,JSON.stringify(committed));
  const r=await (await s.mf.getWorker('runtime')).fetch('https://runtime/datasets/'+s.trust.dataset_id);assert.equal(r.status,200);const served=await r.json();assert.equal(served.serving.decision_eligibility,'ABSTAIN');assert.equal(served.serving.freshness,'SOURCE_SNAPSHOT_REFERENCE');
  assert.equal((await s.call('export',{},'test-only-operator')).status,200);const b=await s.mf.getR2Bucket('CANONICAL','core'),envelope=JSON.parse(await (await b.get(`checkpoints/${s.trust.authority_instance_id}/${s.trust.recovery_generation}/latest.json`)).text()),generation=JSON.parse(await (await b.get(committed.body.receipt.key)).text());assert.deepEqual(await domainLegacyView(generation,envelope,s.trust),JSON.parse(raw_utf8));
  return {s,trust:structuredClone(s.trust),raw_utf8,profile,c,committed,served,generation,envelope};
 }catch(e){if(s)await s.mf.dispose();throw e;}
}

export function domainRehearsalEvidence(opened,meta){
 const {profile,c,committed,served,trust}=opened;
 return {domain:profile.domain,dataset_id:trust.dataset_id,status:'PASS_NATIVE_LOCAL_BRIDGE_SNAPSHOT',records:served.data.records.length,issues:served.data.issues,candidate_bytes:new TextEncoder().encode(JSON.stringify(c)).length,source_pin:profile.source_pin,profile_hash:trust.semantic_profile_hash,generation_digest:committed.body.receipt.digest,legacy_payload_digest:served.data.legacy_payload_digest,source_exact_git_or_http_digest_verified:true,legacy_shape_parity:'EXACT_PARSED_JSON_AFTER_INDEPENDENT_SIGNATURE_VERIFICATION',clock:'CAPTURED_SOURCE_REPLAY',evaluated_at:meta.evaluation_time,authority_revision:1,receipt_signature:'EPHEMERAL_LOCAL_KEY',operator_authentication:'LOCAL_TEST_CAPABILITY_ONLY',source_policies_activated:false,producer_independent:false,operational_action_allowed:false,production_enabled:false};
}
export function domainRehearsalSchemaSamples(opened){
 const {profile,c,served}=opened;
 return [{kind:'profile',value:profile},{kind:'bundle',value:c.semantic_bundle},{kind:'proof',value:c.semantic_admission},{kind:'projection',value:served.data},{kind:'codec',value:c.semantic_bundle.encoded_source}];
}
