import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {hash,requireThat,stable} from '../src/platform/contracts.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {verifyAuthoritySnapshot} from '../src/platform/authority-snapshot.js';
import {recoveredDomainReadback} from '../src/platform/recovery-bootstrap.js';
const root=process.argv[2]||'evidence/core2-domain-frozen-native-20261003';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const manifest=await read(path.join(root,'ARTIFACTS.json'));
requireThat(manifest.source_archive_root==='evidence/core2-domain-recovery-closure-20261003','NATIVE_RESTORE_SOURCE_ROOT_INVALID');
for(const row of manifest.files){
 requireThat(/^[a-zA-Z0-9_/-]+\.json$/.test(row.file)&&!row.file.includes('..'),'NATIVE_RESTORE_PATH_INVALID');
 const raw=await readFile(path.join(root,row.file));
 requireThat(raw.length===row.bytes&&createHash('sha256').update(raw).digest('hex')===row.sha256,'NATIVE_RESTORE_BYTES_INVALID');
}
const summary=await read(path.join(root,'SUMMARY.json'));
requireThat(summary.status==='PASS_TEN_FROZEN_NATIVE_DOMAIN_ARCHIVE_RESTORES'&&summary.results.length===10&&summary.production_enabled===false&&summary.full_system_restore_proven===false,'NATIVE_RESTORE_SUMMARY_INVALID');
for(const [domain,dataset] of Object.entries(DOMAIN_DATASETS)){
 const dir=path.join(root,domain),source=path.join(manifest.source_archive_root,domain);
 const trust=await read(path.join(dir,'TARGET_TRUST.json')),plan=await read(path.join(dir,'RECOVERY_PLAN.json')),snapshot=await read(path.join(dir,'TARGET_SNAPSHOT.json')),bundle=await read(path.join(source,'BUNDLE.json')),sourceTrust=await read(path.join(source,'TRUST.json'));
 requireThat(stable(plan.source_authority)===stable(sourceTrust)&&plan.target_authority_hash===await hash(trust),'NATIVE_RESTORE_TRUST_INVALID');
 const checked=await verifyAuthoritySnapshot(snapshot,trust),control=checked.manifest.control;
 requireThat(trust.dataset_id===dataset&&control.frozen&&control.epoch===8&&control.active===null&&control.revision===0&&control.control_revision===0&&checked.tables.prepared.length===0&&checked.tables.commands.length===0&&checked.tables.outbox.length===0&&checked.tables.audit.length===1,'NATIVE_RESTORE_CONTROL_INVALID');
 const result=await recoveredDomainReadback(bundle,plan,control,new Date().toISOString()),row=summary.results.find(x=>x.domain===domain);
 requireThat(row?.legacy_payload_digest===result.legacy_payload_digest&&row.signed_target_reopened_after_disposal===true&&row.incarnation_changed===true&&row.live_serving_restored===false&&row.writer_resume_allowed===false,'NATIVE_RESTORE_READBACK_INVALID');
}
console.log(JSON.stringify({status:'PASS_TEN_COMMITTED_SIGNED_NATIVE_DOMAIN_RESTORES',datasets:10,production_enabled:false,live_serving_restored:false}));
