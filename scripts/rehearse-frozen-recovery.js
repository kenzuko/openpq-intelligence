import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {recoveryFixture} from '../tests/recovery-support.js';
import {verifyAuthoritySnapshot} from '../src/platform/authority-snapshot.js';
const out=process.argv[2]||'.frozen-recovery';await mkdir(out,{recursive:true});
const dir=await mkdtemp(join(tmpdir(),'openpq-recovery-proof-'));let s;
try{
 s=await recoveryFixture({persistPath:dir});const started=performance.now();
 const result=await s.call('recovery-bootstrap',{});assert.equal(result.status,200);const bootstrap_ms=performance.now()-started;
 const before=await s.call('read',undefined,'new-read'),oldToken=await s.call('recovery-bootstrap',{},'test-only-live');assert.equal(oldToken.status,401);
 const restartStarted=performance.now();await s.restart();const after=await s.call('read',undefined,'new-read'),restart_readback_ms=performance.now()-restartStarted;
 assert.deepEqual(after.body.state,before.body.state);assert.notEqual(after.body.instance_observation.incarnation_id,before.body.instance_observation.incarnation_id);
 const exported=await s.call('recovery-export',{});assert.equal(exported.status,200);const verified=await verifyAuthoritySnapshot(exported.body,s.trust);
 assert.equal(verified.tables.commands.length,0);assert.equal(verified.tables.outbox.length,0);assert.equal(verified.tables.audit.length,1);assert.equal((await s.runtime()).status,503);
 const report={status:'PASS_LOCAL_FROZEN_NATIVE_RECOVERY',source_watermark:result.body.state.recovery.source_watermark,new_epoch:result.body.state.epoch,old_epoch_high_watermark:s.plan.old_epoch_high_watermark,frozen:true,active_receipt_imported:false,historical_commands_imported:false,historical_outbox_imported:false,writer_resumed:false,local_old_command_denial:s.local_fencing,new_route_old_token_status:oldToken.status,native_restart_state_equal:true,native_incarnation_changed:true,bootstrap_ms,restart_readback_ms,measurements_scope:'LOCAL_FIXTURE_ONLY_NOT_RPO_RTO_SLA',cloud_fencing_proven:false,storage_write_fencing_proven:false,external_artifact_restore_proven:false,offsite_restore_proven:false,full_g1_passed:false,production_enabled:false};
 for(const [name,value] of Object.entries({'SOURCE_SNAPSHOT.json':s.snapshot,'SOURCE_TRUST.json':s.plan.source_authority,'RECOVERY_PLAN.json':s.plan,'TARGET_TRUST.json':s.trust,'TARGET_SNAPSHOT.json':exported.body,'TARGET_VERIFICATION.json':verified.verification,'PROOF.json':report}))await writeFile(join(out,name),JSON.stringify(value,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{if(s)await s.dispose();await rm(dir,{recursive:true,force:true});}
