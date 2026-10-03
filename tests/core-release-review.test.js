import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {hash} from '../src/platform/contracts.js';import {reviewCoreRelease} from '../src/preparation/core-release-review.js';
const base=JSON.parse(await readFile(new URL('./data/core-release-review.json',import.meta.url),'utf8'));
async function changed(fn){const x=structuredClone(base);fn(x);const {content_hash,...content}=x;x.content_hash=await hash(content);return x;}
test('actual ten-source recovery review records missing owner bindings and never grants deployment permission',async()=>{
 const r=await reviewCoreRelease(base);assert.equal(r.local_snapshot_coverage,10);assert.equal(r.unresolved.length,20);assert.equal(r.execution_allowed,false);assert.equal(r.production_enabled,false);
 const recorded=await changed(x=>x.owner_bindings.forEach(b=>['target_environment','authority_locator_ref','operator_identity_ref','approved_policy_set_ref','previous_deployment_ref'].forEach(k=>b[k]='recorded-test-reference')));const q=await reviewCoreRelease(recorded);assert.equal(q.unresolved.length,0);assert.equal(q.recorded_bindings_are_authenticated,false);assert.equal(q.execution_allowed,false);
});
test('release review rejects actual evidence tampering, code drift, missing dataset and incomplete outage/readback proofs',async()=>{
 const tampered=structuredClone(base);tampered.core_base_sha='f'.repeat(40);await assert.rejects(reviewCoreRelease(tampered),/TAMPERED/);
 for(const fn of [x=>x.current_core_main_sha='f'.repeat(40),x=>x.native_snapshot_proofs.pop(),x=>x.native_snapshot_proofs[0].native_expiry_denied_during_control_outage=false,x=>x.independent_readback_count=9,x=>x.owner_bindings[0].domain='Cano',x=>x.operational_action_allowed=true])await assert.rejects(reviewCoreRelease(await changed(fn)));
});
