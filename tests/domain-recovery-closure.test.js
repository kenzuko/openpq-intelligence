import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {archiveDomain} from '../scripts/local/domain-recovery-archive.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {verifyDomainRecoveryClosure} from '../src/platform/domain-recovery-closure.js';

const meta=JSON.parse(await readFile(new URL('./data/domains/SOURCE_PINS.json',import.meta.url),'utf8'));
for(const domain of Object.keys(DOMAIN_DATASETS))test(`${domain}: signed native archive closes artifacts and R2 generation dependencies after source disposal`,async()=>{
 const {bundle,trust,raw}=await archiveDomain(domain),checked=await verifyDomainRecoveryClosure(JSON.parse(JSON.stringify(bundle)),trust,'2026-10-04T01:12:00.000Z');
 assert.deepEqual(checked.legacy_payload,raw);assert.equal(checked.prepared_generation_objects_verified,1);assert.equal(checked.artifact_documents_verified,true);assert.equal(checked.display_lease_expired,true);assert.equal(checked.live_serving_restored,false);assert.equal(checked.writer_resume_allowed,false);assert.ok(checked.field_serving.fields.every(x=>x.operational_action_allowed===false));
});
test('archive closure rejects missing, duplicate, altered dependencies, wrong trust and substituted publication',async()=>{
 const {bundle,trust}=await archiveDomain('weather');
 const mutations=[b=>b.generations.pop(),b=>b.generations.push(b.generations[0]),b=>b.generations[0].key+='x',b=>b.generations[0].content.payload.extra=true,b=>b.artifact_documents.policy.source_policies_activated=true,b=>delete b.artifact_documents.config,b=>b.profile.source_pin.payload_sha256='0'.repeat(64),b=>b.publication.signature='bad',b=>b.publication.receipt.revision++,b=>b.extra=true];
 for(const change of mutations){const b=structuredClone(bundle);change(b);await assert.rejects(verifyDomainRecoveryClosure(b,trust,meta.evaluation_time));}
 const wrong=structuredClone(trust);wrong.receipt_keys={};await assert.rejects(verifyDomainRecoveryClosure(bundle,wrong,meta.evaluation_time));
 await assert.rejects(verifyDomainRecoveryClosure(bundle,trust,'invalid'));
});
