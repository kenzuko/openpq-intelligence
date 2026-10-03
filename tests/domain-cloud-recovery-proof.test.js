import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {verifyDomainRecoveryProof} from '../scripts/cloud/verify-domain-recovery-proof.js';
test('actual partial cloud restore and stale capability counterexample cannot pass ten-domain acceptance',async()=>{
 const dir=fileURLToPath(new URL('../evidence/core2-domain-frozen-cloud-20261003/counterexamples/37130161869/',import.meta.url)),proof=JSON.parse(await readFile(dir+'PROOF.json','utf8'));
 assert.equal(proof.domains[0].status,'PASS_FROZEN_CLOUD_DOMAIN_ARCHIVE_RESTORE');assert.equal(proof.domains[1].phase,'REVOKE_SOURCE_COMMAND_AND_STORAGE');assert.equal(proof.cleanup.status,'SUCCESS');
 await assert.rejects(verifyDomainRecoveryProof(dir,{run_id:proof.run_id,code_sha:proof.code_sha}),/DOMAIN_CLOUD_PROOF_INCOMPLETE/);
 await assert.rejects(verifyDomainRecoveryProof(dir,{run_id:'wrong',code_sha:proof.code_sha}),/DOMAIN_CLOUD_PROOF_RUN_PIN_INVALID/);
});
