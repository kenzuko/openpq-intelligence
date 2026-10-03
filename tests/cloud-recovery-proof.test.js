import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root='evidence/core2-cloud-recovery-20261003',pins=root+'/TRUST_PINS.json';
const verify=dir=>spawnSync(process.execPath,['scripts/cloud/verify-frozen-recovery-proof.js',dir,pins],{encoding:'utf8'});
test('downloaded actual cloud drill independently verifies signed source/target against pinned trust',()=>{
 const r=verify(root);assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.new_epoch,8);assert.equal(result.temporary_workers_cleaned,true);assert.equal(result.writer_resumed,false);assert.equal(result.full_g1_passed,false);assert.equal(result.r2_s3_write_credential_revocation_proven,false);
});
test('cloud proof cannot promote protocol rejection to auth fencing, conceal cleanup failure or claim full restore',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'openpq-cloud-proof-'));try{
  await cp(root,dir,{recursive:true});const pristine=JSON.parse(await readFile(dir+'/PROOF.json','utf8'));
  for(const [mutate,error] of [
   [p=>p.cleanup.status='FAILED','CLOUD_RECOVERY_PASS_REQUIRED'],
   [p=>p.cases[3].observation.command_http_status=409,'CLOUD_RECOVERY_FENCING_SCOPE_INVALID'],
   [p=>p.cases[3].observation.storage_gateway_write_witness_status=503,'CLOUD_RECOVERY_FENCING_SCOPE_INVALID'],
   [p=>p.r2_s3_write_credential_revocation_proven=true,'CLOUD_RECOVERY_SCOPE_INVALID'],
   [p=>p.external_artifact_restore_proven=true,'CLOUD_RECOVERY_SCOPE_INVALID'],
   [p=>p.code_sha='0'.repeat(40),'CLOUD_RECOVERY_INDEPENDENT_PIN_MISMATCH']
  ]){const report=structuredClone(pristine);mutate(report);await writeFile(dir+'/PROOF.json',JSON.stringify(report));const r=verify(dir);assert.notEqual(r.status,0);assert.match(r.stderr,new RegExp(error));}
 }finally{await rm(dir,{recursive:true,force:true});}
});
