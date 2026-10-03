import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyDomainRecoveryProof} from '../scripts/cloud/verify-domain-recovery-proof.js';
const success=fileURLToPath(new URL('../evidence/core2-domain-frozen-cloud-20261003/success-37134123700/',import.meta.url));
async function archive(){
 const dir=await mkdtemp(path.join(tmpdir(),'openpq-cloud-proof-'));
 const result=spawnSync('python',['-c','import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',success+'cloud-recovery.zip',dir]);
 assert.equal(result.status,0);return {dir,pins:JSON.parse(await readFile(success+'TRUST_PINS.json','utf8'))};
}
test('actual ten-domain cloud restore archive independently verifies all source and target signatures',async()=>{
 const {dir,pins}=await archive();try{const result=await verifyDomainRecoveryProof(dir,pins);assert.equal(result.results.length,10);assert.equal(result.production_enabled,false);assert.equal(result.live_serving_restored,false);}finally{await rm(dir,{recursive:true,force:true});}
});
test('successful cloud archive cannot conceal stale capability, incomplete cleanup, restart failure or overclaim',async()=>{
 const {dir,pins}=await archive();try{
  const original=JSON.parse(await readFile(dir+'/PROOF.json','utf8'));
  for(const mutate of [p=>p.domains[0].fencing.command_http_status=200,p=>p.domains[0].fencing.storage_gateway_http_status=200,p=>p.domains[0].fencing.read_witness_status=503,p=>p.domains[0].restart_changed_incarnation=false,p=>p.cleanup.status='FAILED',p=>p.writer_resumed=true,p=>p.direct_s3_write_key_revocation_proven=true,p=>p.domains.pop()]){
   const proof=structuredClone(original);mutate(proof);await writeFile(dir+'/PROOF.json',JSON.stringify(proof));await assert.rejects(verifyDomainRecoveryProof(dir,pins));
  }
  await writeFile(dir+'/PROOF.json',JSON.stringify(original));const wrong=structuredClone(pins);wrong.domains.weather.bundle_digest='0'.repeat(64);await assert.rejects(verifyDomainRecoveryProof(dir,wrong),/DOMAIN_CLOUD_PROOF_BYTES_PIN_INVALID/);
  const substituted=structuredClone(pins);substituted.domains.weather.target_authority.receipt_keys={};await assert.rejects(verifyDomainRecoveryProof(dir,substituted),/DOMAIN_CLOUD_PROOF_TRUST_FILE_MISMATCH/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('actual partial cloud restore and stale capability counterexample cannot pass ten-domain acceptance',async()=>{
 const dir=fileURLToPath(new URL('../evidence/core2-domain-frozen-cloud-20261003/counterexamples/37130161869/',import.meta.url)),proof=JSON.parse(await readFile(dir+'PROOF.json','utf8'));
 assert.equal(proof.domains[0].status,'PASS_FROZEN_CLOUD_DOMAIN_ARCHIVE_RESTORE');assert.equal(proof.domains[1].phase,'REVOKE_SOURCE_COMMAND_AND_STORAGE');assert.equal(proof.cleanup.status,'SUCCESS');
 await assert.rejects(verifyDomainRecoveryProof(dir,{run_id:proof.run_id,code_sha:proof.code_sha}),/DOMAIN_CLOUD_PROOF_INCOMPLETE/);
 await assert.rejects(verifyDomainRecoveryProof(dir,{run_id:'wrong',code_sha:proof.code_sha}),/DOMAIN_CLOUD_PROOF_RUN_PIN_INVALID/);
});
