import {mkdir,readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {recoveredDomain} from './local/recovered-domain.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {verifyAuthoritySnapshot} from '../src/platform/authority-snapshot.js';
import {verifyDomainRecoveryClosure} from '../src/platform/domain-recovery-closure.js';
import {recoveredDomainReadback} from '../src/platform/recovery-bootstrap.js';
const source='evidence/core2-domain-recovery-closure-20261003',out=path.resolve(process.argv[2]||'.recovered-domains');await mkdir(out,{recursive:true});const results=[];
for(const domain of Object.keys(DOMAIN_DATASETS)){
 const bundle=JSON.parse(await readFile(`${source}/${domain}/BUNDLE.json`,'utf8')),trust=JSON.parse(await readFile(`${source}/${domain}/TRUST.json`,'utf8')),baseline=await verifyDomainRecoveryClosure(bundle,trust,new Date().toISOString());
 const directory=await mkdtemp(path.join(tmpdir(),'openpq-domain-rehearsal-'));let s;try{
  const started=Date.now();s=await recoveredDomain({bundle,trust},directory);const restored=await s.call('recovery-bootstrap');assert.equal(restored.status,200,JSON.stringify(restored));
  const before=await s.call('read',undefined,'new-read'),first=await s.call('recovery-read');assert.equal(first.status,200);assert.equal(first.body.legacy_payload_digest,baseline.legacy_payload_digest);
  await s.restart();const after=await s.call('read',undefined,'new-read'),second=await s.call('recovery-read');assert.equal(second.status,200);assert.equal(second.body.legacy_payload_digest,baseline.legacy_payload_digest);assert.deepEqual(after.body.state,before.body.state);assert.notEqual(after.body.instance_observation.incarnation_id,before.body.instance_observation.incarnation_id);
  const snapshot=(await s.call('recovery-export')).body,targetTrust=structuredClone(s.trust),plan=structuredClone(s.plan);await s.dispose();s=null;
  const checked=await verifyAuthoritySnapshot(snapshot,targetTrust);assert.equal(checked.tables.commands.length,0);assert.equal(checked.tables.outbox.length,0);assert.equal(checked.tables.audit.length,1);const independent=await recoveredDomainReadback(bundle,plan,checked.manifest.control,new Date().toISOString());assert.equal(independent.legacy_payload_digest,baseline.legacy_payload_digest);
  const dir=path.join(out,domain);await mkdir(dir,{recursive:true});for(const [name,value] of [['TARGET_TRUST',targetTrust],['TARGET_SNAPSHOT',snapshot],['RECOVERY_PLAN',plan]])await writeFile(path.join(dir,name+'.json'),JSON.stringify(value,null,2)+'\n');
  results.push({domain,dataset_id:trust.dataset_id,status:'PASS_FROZEN_NATIVE_DOMAIN_ARCHIVE_RESTORE',source_scope:'COMMITTED_CAPTURED_ARCHIVE_NOT_CURRENT_LIVE_SOURCE',signed_target_reopened_after_disposal:true,incarnation_changed:true,legacy_payload_digest:independent.legacy_payload_digest,source_watermark:independent.watermark,epoch:checked.manifest.control.epoch,prepared:checked.tables.prepared.length,commands:checked.tables.commands.length,outbox:checked.tables.outbox.length,audit:checked.tables.audit.length,elapsed_ms:Date.now()-started,timing_scope:'LOCAL_REHEARSAL_NOT_DOMAIN_SLA',live_serving_restored:false,writer_resume_allowed:false});
 }finally{if(s)await s.dispose();await rm(directory,{recursive:true,force:true});}
}
const report={status:'PASS_TEN_FROZEN_NATIVE_DOMAIN_ARCHIVE_RESTORES',results,full_system_restore_proven:false,production_enabled:false};await writeFile(path.join(out,'SUMMARY.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,datasets:results.length}));
