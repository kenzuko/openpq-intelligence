// A native local test harness using captured real source bytes and ephemeral test capabilities.
// It does not read cloud credentials, contact a repository or change a deployed environment.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup,iso} from '../tests/support.js';
import {hash} from '../src/platform/contracts.js';
import {verifyAttestation} from '../src/platform/receipts.js';
import {REAL_PROFILE_VERSION,REAL_BUNDLE_VERSION,realCanoArtifactRefs,buildRealCanoCandidate} from '../src/platform/real-cano-admission.js';

const at=iso(Date.now());let s;
try{
 const source=JSON.parse(await readFile(new URL('../tests/data/real-cano/SOURCE.json',import.meta.url),'utf8'));assert.equal(source.fixture_only,false);
 const raw_utf8=await readFile(new URL('../tests/data/real-cano/2026-10-03-cano-an-thoi.json',import.meta.url),'utf8');
 const {raw_file,...pin}=source.record;
 const profile={contract_version:REAL_PROFILE_VERSION,environment_id:'local-test',dataset_id:'cano.operation.an-thoi',source_kind:'OWNER_REPOSITORY_SNAPSHOT',fixture_only:false,source_records:[pin],operator_principal_ids:['operator'],artifact_refs:{}};
 profile.artifact_refs=await realCanoArtifactRefs(profile);
 s=await setup({semanticProfile:profile,dataset_id:profile.dataset_id,manualOperator:true});
 const bundle={contract_version:REAL_BUNDLE_VERSION,raw_utf8,...pin},c=await buildRealCanoCandidate(profile,s.trust,{bundle,operator_principal_id:'operator',evaluation_time:at,candidate_id:'actual-clock-real-cano-local',logical_slot:10});
 const prepare=await s.call('prepare',c,'test-only-operator');assert.equal(prepare.status,200,JSON.stringify(prepare));
 const result=await s.commit(prepare.body,'real-source-current-clock','test-only-operator');assert.equal(result.status,200,JSON.stringify(result));
 const runtime=await s.runtime.fetch('https://runtime/datasets/'+profile.dataset_id);assert.equal(runtime.status,200);const served=await runtime.json();assert.equal(served.serving.authority,'VERIFIED');assert.equal(served.serving.decision_eligibility,'ABSTAIN');assert.equal(served.data.real_manual_cano.operational_action_allowed,false);
 assert.equal((await s.call('export',{},'test-only-operator')).status,200);
 const bucket=await s.mf.getR2Bucket('CANONICAL','core');const envelope=JSON.parse(await (await bucket.get(`checkpoints/${s.trust.authority_instance_id}/${s.trust.recovery_generation}/latest.json`)).text());assert.deepEqual(await verifyAttestation(envelope,s.trust),result.body.receipt);
 const reader=s.principals.find(p=>p.id==='read');reader.permissions=[];await s.mf.setOptions(s.options());
 const fallback=await (await s.mf.getWorker('runtime')).fetch('https://runtime/datasets/'+profile.dataset_id);assert.equal(fallback.status,200);const fallbackBody=await fallback.json();assert.equal(fallbackBody.serving.fallback,true);assert.equal(fallbackBody.serving.authority,'UNVERIFIED');assert.equal(fallbackBody.serving.decision_eligibility,'ABSTAIN');
 reader.permissions=['read'];const operator=s.principals.find(p=>p.id==='operator');operator.permissions=operator.permissions.filter(p=>p!=='manual-source-admit');await s.mf.setOptions(s.options());
 const revoked=await s.commit(prepare.body,'real-source-current-clock','test-only-operator');assert.equal(revoked.body.error,'REAL_CANO_OPERATOR_DENIED');assert.equal((await s.call('read',undefined,'test-only-read')).body.state.revision,1);
 const frozen=await s.call('control',{command_id:'real-source-local-freeze',expected_control_revision:0,expires_at:iso(Date.now()+60000),action:'FREEZE',frozen:true,reason:'Local rehearsal safety stop'},'test-only-operator');assert.equal(frozen.status,200);assert.equal(frozen.body.state.frozen,true);
 console.log(JSON.stringify({status:'PASS_LOCAL_REAL_SOURCE_FACT_ACTUAL_CLOCK',evaluated_at:at,clock:'ACTUAL_WALL_CLOCK',source_kind:source.source_kind,fixture_only:false,source_pin:pin,source_time:c.inputs[0].source_time,valid_until:c.valid_to,profile_hash:s.trust.semantic_profile_hash,artifacts:s.trust.artifacts,operator_authentication:'LOCAL_EPHEMERAL_TEST_CAPABILITY_ONLY',operator_principal_id:'operator',source_author_assurance:'SOURCE_RECORDED_ONLY',native_sqlite_r2_receipt_runtime:'PASS',receipt_signature:'PASS_EPHEMERAL_LOCAL_KEY',source_hash:'PASS',runtime_live_authority:'VERIFIED',runtime_fallback_authority:'UNVERIFIED',decision_effect:'ABSTAIN',operator_revocation:'DENIED_AFTER_REVOKE',freeze:'PASS_LOCAL_CONTROL',authority_revision:1,control_revision:1,operational_action_allowed:false,production_enabled:false,g1_operational:'NOT_PASSED',g2_release:'NOT_PASSED',remote_writes:0},null,2));
}catch(error){console.log(JSON.stringify({status:'BLOCKED_LOCAL_REAL_SOURCE_REHEARSAL',evaluated_at:at,error:error.code||error.message,production_enabled:false,operational_action_allowed:false}));process.exitCode=1;}finally{if(s)await s.mf.dispose();}
