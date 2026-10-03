import {readFile} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,stable,requireThat} from '../../src/platform/contracts.js';
import {DOMAIN_DATASETS} from '../../src/ingress/domain-source-common.js';
import {recoveredReferenceView} from '../../src/platform/recovered-reference.js';
export async function verifyRecoveredRuntimeProof(root,source,pins){
 const read=async(dir,name)=>JSON.parse(await readFile(dir+'/'+name+'.json','utf8'));
 const proof=await read(root,'PROOF'),config=await read(root,'CONFIG'),trust=await read(root,'TRUST');
 requireThat(proof.run_id===pins.run_id&&proof.code_sha===pins.code_sha,'RECOVERED_RUNTIME_PROOF_RUN_INVALID');
 requireThat(proof.source_cloud_run_id==='37134123700'&&proof.source_cloud_code_sha==='02152368e011dd7aef67c840983040391fccec9f','RECOVERED_RUNTIME_PROOF_SOURCE_INVALID');
 requireThat(proof.status==='PASS_TEN_FROZEN_ARCHIVE_RUNTIME_READS_WITHOUT_CORE'&&proof.cleanup.status==='SUCCESS'&&proof.cleanup.temporary_worker_deleted===true&&proof.no_core_binding===true&&proof.no_native_or_r2_write_binding===true,'RECOVERED_RUNTIME_PROOF_INCOMPLETE');
 for(const key of ['production_enabled','public_cutover_executed','writer_resumed','live_serving_restored','full_system_restore_proven','direct_s3_writer_key_revocation_proven'])requireThat(proof[key]===false,'RECOVERED_RUNTIME_PROOF_OVERCLAIM');
 requireThat(proof.removed_upload_route_status===405&&proof.ordinary_live_route_status===503&&proof.read_key_denial_scope==='READ_KEY_CANNOT_WRITE_NOT_WRITER_KEY_REVOCATION'&&proof.read_key_denials?.length===2&&['PUT','DELETE'].every(method=>proof.read_key_denials.some(x=>x.method===method&&x.status===403&&x.key===`proof-deny/recovered-runtime-${proof.run_id}.json`)),'RECOVERED_RUNTIME_PROOF_READONLY_INVALID');
 requireThat((await read(root,'RUNTIME_BINDINGS')).every(x=>['plain_text','secret_text'].includes(x.type)),'RECOVERED_RUNTIME_PROOF_BINDING_INVALID');
 const pre=await read(root,'PREFLIGHT'),post=await read(root,'POSTFLIGHT'),sort=x=>[...x].sort((a,b)=>stable(a).localeCompare(stable(b)));
 for(const k of ['workers','namespaces'])requireThat(stable(sort(pre[k]))===stable(sort(post[k])),'RECOVERED_RUNTIME_PROOF_INVENTORY_CHANGED');
 requireThat(proof.domains.length===10&&new Set(proof.domains.map(x=>x.domain)).size===10&&Object.keys(trust).length===10&&Object.keys(config).length===10,'RECOVERED_RUNTIME_PROOF_DOMAINS_INCOMPLETE');
 const results=[];
 for(const [domain,dataset] of Object.entries(DOMAIN_DATASETS)){
  const originalTrust=await read(source,domain+'/TARGET_TRUST'),snapshot=await read(source,domain+'/TARGET_SNAPSHOT'),bundle=await read(source,domain+'/BUNDLE'),plan=await read(source,domain+'/RECOVERY_PLAN'),response=await read(root,domain+'-RESPONSE'),row=proof.domains.find(x=>x.domain===domain);
  requireThat(stable(trust[dataset])===stable(originalTrust)&&stable(config[dataset].plan)===stable(plan)&&config[dataset].target_snapshot_key===`recovery/snapshots/runtime-${proof.run_id}-${domain}.json`,'RECOVERED_RUNTIME_PROOF_TRUST_SUBSTITUTED');
  const expected=await recoveredReferenceView(snapshot,bundle,config[dataset],originalTrust,response.body.serving.evaluated_at);
  requireThat(Date.parse(response.body.serving.evaluated_at)<=Date.parse(proof.finished_at),'RECOVERED_RUNTIME_PROOF_TIME_INVALID');
  requireThat(response.status===200&&stable(response.body)===stable(expected)&&response.headers.cache_control==='no-store'&&response.headers.source_snapshot==='recovered-archive-only'&&response.headers.decision_eligibility==='ABSTAIN'&&row?.dataset_id===dataset&&row.status==='PASS_FROZEN_ARCHIVE_RUNTIME_WITHOUT_CORE'&&row.response_digest===await hash(expected)&&row.legacy_payload_digest===await hash(expected.source_payload)&&row.source_version_time===expected.serving.source_version_time&&row.display_lease_expired===expected.serving.display_lease_expired,'RECOVERED_RUNTIME_PROOF_RESPONSE_INVALID');
  requireThat(Number.isFinite(row.readback_ms)&&row.readback_ms>=0&&row.timing_scope==='THIS_ARCHIVE_READ_NOT_DOMAIN_RTO','RECOVERED_RUNTIME_PROOF_TIMING_INVALID');
  results.push({domain,dataset_id:dataset,legacy_payload_digest:row.legacy_payload_digest,display_lease_expired:row.display_lease_expired,status:'INDEPENDENT_SIGNED_RECOVERED_RUNTIME_ARCHIVE_PASS'});
 }
 return {status:'PASS_TEN_INDEPENDENT_RECOVERED_RUNTIME_ARCHIVES',results,production_enabled:false,live_serving_restored:false,writer_resumed:false,full_system_restore_proven:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [root,source,pinFile]=process.argv.slice(2);requireThat(root&&source&&pinFile,'RECOVERED_RUNTIME_VERIFIER_ARGS_REQUIRED');
 const result=await verifyRecoveredRuntimeProof(root,source,JSON.parse(await readFile(pinFile,'utf8')));
 await writeFile(root+'/INDEPENDENT_READBACK.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,datasets:result.results.length,production_enabled:false,live_serving_restored:false}));
}
