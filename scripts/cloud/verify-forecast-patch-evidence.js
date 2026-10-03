import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {hash,requireThat,stable} from '../../src/platform/contracts.js';
import {verifyAttestation} from '../../src/platform/receipts.js';
import {DOMAIN_DATASETS} from '../../src/ingress/domain-source-common.js';
const root=process.argv[2]||'evidence/core2-forecast-regression-20261003/patch-success-37134617745';
const read=async name=>JSON.parse(await readFile(root+'/'+name+'.json','utf8'));
const manifest=await read('ARTIFACTS'),proof=await read('PROOF');
requireThat(manifest.run_id==='37134617745'&&manifest.code_sha==='6c2aeec3ce0b6a3af9fbf50ecf618b4c5f489553'&&proof.run_id===manifest.run_id&&proof.code_sha===manifest.code_sha,'FORECAST_PATCH_EVIDENCE_RUN_INVALID');
for(const row of manifest.files){
 requireThat(/^[a-zA-Z0-9_-]+\.json$/.test(row.file),'FORECAST_PATCH_EVIDENCE_PATH_INVALID');
 const raw=await readFile(root+'/'+row.file);requireThat(raw.length===row.bytes&&createHash('sha256').update(raw).digest('hex')===row.sha256,'FORECAST_PATCH_EVIDENCE_BYTES_INVALID');
}
requireThat(proof.status==='PASS_ISOLATED_CORE_FORECAST_ORDERING_PATCH'&&proof.worker==='openpq-intelligence-core-isolated-test'&&proof.rollback.status==='NOT_REQUIRED'&&proof.previous_core_version!==proof.new_core_version,'FORECAST_PATCH_EVIDENCE_INCOMPLETE');
for(const flag of ['production_enabled','public_cutover_executed','signer_rotated','locator_rotated','actor_bindings_changed','schedule_changed'])requireThat(proof[flag]===false,'FORECAST_PATCH_EVIDENCE_OVERCLAIM');
const trust=JSON.parse(await readFile('evidence/core2-source-feed-20261003/domain-locators.public.json','utf8'))[DOMAIN_DATASETS.weather_forecast];
const before=await verifyAttestation(await read('FORECAST_CHECKPOINT_BEFORE'),trust),after=await verifyAttestation(await read('FORECAST_CHECKPOINT_AFTER'),trust),generation=await read('FORECAST_GENERATION_AFTER');
requireThat(before.revision===proof.previous_forecast_revision&&after.revision===proof.new_forecast_revision&&after.revision>before.revision&&before.epoch===after.epoch&&before.owner===after.owner&&proof.same_epoch&&proof.same_owner,'FORECAST_PATCH_EVIDENCE_CONTROL_CHANGED');
requireThat(await hash(generation)===after.digest&&generation.semantic_profile_hash===trust.semantic_profile_hash&&after.semantic_admission.profile_hash===trust.semantic_profile_hash&&generation.semantic_admission.source_policies_activated===false&&generation.semantic_admission.action_allowed===false&&generation.decision.effect==='ABSTAIN','FORECAST_PATCH_EVIDENCE_GENERATION_INVALID');
const ordered=x=>[...x].sort((a,b)=>stable(a).localeCompare(stable(b)));
requireThat(stable(ordered(await read('BINDINGS_BEFORE')))===stable(ordered(await read('BINDINGS_AFTER'))),'FORECAST_PATCH_EVIDENCE_BINDINGS_CHANGED');
const pre=await read('PREFLIGHT'),post=await read('POSTFLIGHT');
for(const key of ['workers','namespaces'])requireThat(stable(ordered(pre[key]))===stable(ordered(post[key])),'FORECAST_PATCH_EVIDENCE_INVENTORY_CHANGED');
requireThat(stable(await read('PROTECTED_VERSIONS_BEFORE'))===stable(await read('PROTECTED_VERSIONS_AFTER')),'FORECAST_PATCH_EVIDENCE_OTHER_WORKER_CHANGED');
const health=proof.observations.at(-1),domains=Object.values(DOMAIN_DATASETS);
requireThat(health.datasets.length===10&&new Set(health.datasets.map(x=>x.dataset_id)).size===10&&domains.every(id=>health.datasets.some(x=>x.dataset_id===id&&x.healthy===true)),'FORECAST_PATCH_EVIDENCE_HEALTH_INCOMPLETE');
console.log(JSON.stringify({status:'PASS_INDEPENDENT_SIGNED_FORECAST_PATCH_EVIDENCE',run_id:proof.run_id,previous_revision:before.revision,new_revision:after.revision,healthy_datasets:10,production_enabled:false,public_cutover_executed:false}));
