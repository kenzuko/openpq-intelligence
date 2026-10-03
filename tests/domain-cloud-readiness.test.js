import test from 'node:test';import assert from 'node:assert/strict';
import {waitForDomainRuntime} from '../scripts/cloud/domain-readiness.js';
import {captureReferenceLease} from '../scripts/cloud/domain-lease.js';
const view=(authority,fallback,eligibility='ABSTAIN')=>({status:200,body:{serving:{authority,fallback,decision_eligibility:eligibility}}});
test('cloud reference lease uses a single captured clock and never exceeds the five minute admission bound',()=>{
 for(const now of [0,Date.parse('2026-10-03T05:43:43.999Z'),Date.parse('2026-12-31T23:59:59.999Z')]){const lease=captureReferenceLease(now);assert.equal(Date.parse(lease.valid_to)-Date.parse(lease.valid_from),300000);assert.equal(lease.basis,'ISOLATED_CAPTURE_REFERENCE_ONLY');}
});
test('runtime propagation waits for signed fallback rather than accepting healthy old service-binding state',async()=>{
 const sequence=[view('VERIFIED',false),view('UNVERIFIED',false),view('UNVERIFIED',true)],seen=[];
 await waitForDomainRuntime(async()=>sequence.shift(),{authority:'UNVERIFIED',fallback:true},{observe:x=>seen.push(x),attempts:3,pause:async()=>{}});
 assert.equal(seen.length,3);assert.equal(seen[2].fallback,true);
});
test('missing response, action eligibility and unobserved fallback never satisfy cloud recovery proof',async()=>{
 for(const result of [{status:503,body:{error:'NO_TRUSTED_CHECKPOINT'}},view('UNVERIFIED',false),view('UNVERIFIED',true,'ELIGIBLE')])await assert.rejects(waitForDomainRuntime(async()=>result,{authority:'UNVERIFIED',fallback:true},{attempts:2,pause:async()=>{}}),/STATE_NOT_OBSERVED/);
});
test('healthy old publication cannot satisfy readiness for the newly deployed receipt',async()=>{
 const old={...view('VERIFIED',false),body:{...view('VERIFIED',false).body,receipt:{digest:'old'}}};
 await assert.rejects(waitForDomainRuntime(async()=>old,{authority:'VERIFIED',receipt_digest:'new'},{attempts:2,pause:async()=>{}}),/STATE_NOT_OBSERVED/);
 const current={...old,body:{...old.body,receipt:{digest:'new'}}};
 await waitForDomainRuntime(async()=>current,{authority:'VERIFIED',receipt_digest:'new'},{attempts:1});
});
