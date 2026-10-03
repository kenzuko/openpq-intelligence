import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceObservationHistory} from '../scripts/cloud/reference-observation-history.js';
const row=(id,at,steps={health:'PASS',capture:'PASS',native:'PASS'})=>({run_id:String(id),code_sha:'a'.repeat(40),observed_at:at,steps});
test('a seven-day sampled span cannot stand in for continuous uptime, failure injection, critical cycles or policy acceptance',()=>{
 const result=referenceObservationHistory([row(3,'2026-10-10T00:00:00Z'),row(1,'2026-10-03T00:00:00Z'),row(2,'2026-10-06T00:00:00Z',{health:'FAIL',capture:'PASS',native:'FAIL'})],'2026-10-10T01:00:00Z');
 assert.equal(result.proposed_72h_span_elapsed,true);assert.equal(result.proposed_7d_span_elapsed,true);assert.equal(result.failed_health_samples,1);assert.equal(result.largest_gap_between_successful_samples_ms,7*86400000);assert.equal(result.continuous_uptime_proven,false);assert.equal(result.shadow_gate_passed,false);assert.equal(result.resilience_gate_passed,false);
});
test('duplicates, future observations and fabricated step statuses are denied; unavailable probes remain unknown',()=>{
 const r=row(1,'2026-10-03T00:00:00Z');assert.throws(()=>referenceObservationHistory([r,r],'2026-10-04T00:00:00Z'),/DUPLICATE/);assert.throws(()=>referenceObservationHistory([r],'2026-10-02T00:00:00Z'),/RECORD_INVALID/);assert.throws(()=>referenceObservationHistory([{...r,steps:{health:'PASS_BY_ASSUMPTION'}}],'2026-10-04T00:00:00Z'),/RECORD_INVALID/);
 const result=referenceObservationHistory([row(2,'2026-10-03T01:00:00Z',{health:'UNKNOWN',capture:'PASS',native:'UNKNOWN'})],'2026-10-04T00:00:00Z');assert.equal(result.successful_health_samples,0);assert.equal(result.unknown_health_samples,1);assert.equal(result.status,'NO_SUCCESSFUL_REFERENCE_HEALTH_OBSERVATIONS');assert.equal(result.proposed_72h_span_elapsed,false);
});
