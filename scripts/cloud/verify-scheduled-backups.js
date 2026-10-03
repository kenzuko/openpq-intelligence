// Offline independent verification of the downloaded real-Cron archive.
// No credentials, network or authority mutation.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {requireThat} from '../../src/platform/contracts.js';
import {unpackDomainJson} from '../../src/platform/domain-codec.js';
import {DOMAIN_DATASETS} from '../../src/ingress/domain-source-common.js';
import {loadPortableBackup} from '../preparation/portable-backup.js';
const root=process.argv[2],evidence='evidence/core2-source-feed-20261003/';
requireThat(root,'SCHEDULED_ARCHIVE_DIRECTORY_REQUIRED');
const report=JSON.parse(await readFile(join(root,'feed-evidence.public.json'),'utf8'));
requireThat(report.status==='REAL_SCHEDULED_REFERENCE_FEED_SUBSET_PASS'&&report.whole_brain_production_ready===false&&report.signed_readback.length===10,'SCHEDULED_ARCHIVE_PASS_REQUIRED');
const authorities=JSON.parse(await readFile(evidence+'domain-locators.public.json','utf8')),profiles=JSON.parse(await readFile(evidence+'domain-profiles.public.json','utf8'));
const samples=[],verified=[];
for(const [domain,dataset] of Object.entries(DOMAIN_DATASETS)){
 const {bundle,verification}=await loadPortableBackup(join(root,'scheduled-backups',domain),authorities[dataset]);
 requireThat(verification.publication_receipt_authenticity_verified,'SCHEDULED_ARCHIVE_SIGNATURE_REQUIRED');
 const gen=bundle.entries.find(x=>x.kind==='GENERATION').content,proof=report.signed_readback.find(x=>x.dataset_id===dataset);
 requireThat(proof?.signature_verified&&proof.portable_backup_verified&&bundle.watermark.revision===proof.revision&&gen.semantic_admission.input_hash===proof.source_digest&&gen.decision.effect==='ABSTAIN'&&gen.semantic_admission.source_policies_activated===false,'SCHEDULED_ARCHIVE_REPORT_MISMATCH');
 samples.push({kind:'profile',value:profiles[dataset]},{kind:'bundle',value:gen.semantic_bundle},{kind:'proof',value:gen.semantic_admission},{kind:'projection',value:await unpackDomainJson(gen.payload.domain_snapshot.encoded_projection)},{kind:'codec',value:gen.semantic_bundle.encoded_source});
 verified.push({dataset_id:dataset,revision:proof.revision,signature_verified:true,portable_backup_verified:true});
}
await writeFile(join(root,'SIGNED_SCHEMA_SAMPLES.json'),JSON.stringify(samples)+'\n');
const result={status:'INDEPENDENT_DOWNLOADED_CRON_BACKUPS_PASS',run_id:report.run_id,code_sha:report.code_sha,verified_count:verified.length,full_system_restore_proven:false,whole_brain_production_ready:false,verified};
await writeFile(join(root,'INDEPENDENT_READBACK.json'),JSON.stringify(result,null,2)+'\n');console.log(result.status);
