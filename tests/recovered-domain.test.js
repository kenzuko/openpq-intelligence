import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {archiveDomain} from '../scripts/local/domain-recovery-archive.js';
import {recoveredDomain} from '../scripts/local/recovered-domain.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {hash} from '../src/platform/contracts.js';
import {verifyAuthoritySnapshot} from '../src/platform/authority-snapshot.js';
for(const domain of Object.keys(DOMAIN_DATASETS))test(`${domain}: fresh native frozen restore pins the entire source archive and reads it after persistent restart`,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'openpq-domain-restore-'));let s;try{
  const archive=await archiveDomain(domain);s=await recoveredDomain(archive,dir);
  assert.equal((await s.call('recovery-bootstrap')).status,200);
  assert.equal((await s.call('recovery-read',{},'new-read')).status,403);
  const before=await s.call('read',undefined,'new-read'),read=await s.call('recovery-read');assert.equal(read.status,200,JSON.stringify(read));assert.deepEqual(read.body.legacy_payload,JSON.parse(JSON.stringify(archive.raw)));assert.equal(read.body.live_serving_restored,false);assert.equal(read.body.display_lease_expired,true);
  await s.restart();const after=await s.call('read',undefined,'new-read');assert.deepEqual(after.body.state,before.body.state);assert.notEqual(after.body.instance_observation.incarnation_id,before.body.instance_observation.incarnation_id);assert.deepEqual((await s.call('recovery-read')).body.legacy_payload,JSON.parse(JSON.stringify(archive.raw)));
  assert.equal((await s.call('control',{command_id:'unsafe',action:'FREEZE',frozen:false,reason:'gate test',expected_control_revision:0,expires_at:new Date(Date.now()+60000).toISOString()},'new-operator')).body.error,'RECOVERY_RESUME_GATE_CLOSED');
  const snapshot=await s.call('recovery-export'),checked=await verifyAuthoritySnapshot(snapshot.body,s.trust);assert.equal(checked.tables.commands.length,0);assert.equal(checked.tables.outbox.length,0);assert.equal(checked.tables.prepared.length,0);assert.equal(checked.tables.audit.length,1);
  const bucket=await s.mf.getR2Bucket('CANONICAL','core'),bad=structuredClone(archive.bundle);bad.artifact_documents.policy.source_policies_activated=true;await bucket.put(s.plan.domain_archive.key,JSON.stringify(bad));assert.equal((await s.call('recovery-read')).body.error,'RECOVERY_ARCHIVE_ANCHOR_MISMATCH');
 }finally{if(s)await s.dispose();await rm(dir,{recursive:true,force:true});}
});
test('incomplete semantic archive blocks bootstrap without installing control; trusted repair permits one bootstrap',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'openpq-domain-deny-'));let s;try{
  const archive=await archiveDomain('weather_compact');s=await recoveredDomain(archive,dir);const bucket=await s.mf.getR2Bucket('CANONICAL','core');await bucket.delete(s.plan.domain_archive.key);
  assert.equal((await s.call('recovery-bootstrap')).body.error,'RECOVERY_DOMAIN_ARCHIVE_UNAVAILABLE');assert.equal((await s.call('read',undefined,'new-read')).body.state,null);
  await bucket.put(s.plan.domain_archive.key,JSON.stringify(archive.bundle));s.plan.domain_archive.digest='0'.repeat(64);await s.mf.setOptions(s.options());assert.equal((await s.call('recovery-bootstrap')).body.error,'RECOVERY_DOMAIN_ARCHIVE_PIN_MISMATCH');
  const bad=structuredClone(archive.bundle);bad.artifact_documents.rule.action_allowed=true;s.plan.domain_archive.digest=await hash(bad);await s.mf.setOptions(s.options());await (await s.mf.getR2Bucket('CANONICAL','core')).put(s.plan.domain_archive.key,JSON.stringify(bad));assert.equal((await s.call('recovery-bootstrap')).body.error,'RECOVERY_CLOSURE_ARTIFACT_INVALID');assert.equal((await s.call('read',undefined,'new-read')).body.state,null);
  await (await s.mf.getR2Bucket('CANONICAL','core')).put(s.plan.domain_archive.key,JSON.stringify(archive.bundle));
  s.plan.domain_archive.digest=await hash(archive.bundle);await s.mf.setOptions(s.options());assert.equal((await s.call('recovery-bootstrap')).status,200);assert.equal((await s.call('recovery-bootstrap')).status,409);
 }finally{if(s)await s.dispose();await rm(dir,{recursive:true,force:true});}
});
