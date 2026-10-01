import test from 'node:test';
import assert from 'node:assert/strict';
import {replayCorpus} from '../scripts/replay-semantic.js';
test('hand-specified golden expectations replay deterministically without mutating evidence',async()=>{
  const a=await replayCorpus();assert.equal(a.status,'SYNTHETIC_SEMANTIC_SUBSET_PASS');assert.ok(a.cases.length>=8);for(const id of ['S01-manual-in-scope','S02-expiry-at-day-boundary','S03-unknown-time','S04-future-source','S05-ambiguous-map','S06-scope-mismatch','S07-official-closure','S08-stale-source'])assert.ok(a.cases.some(item=>item.case_id===id));assert.equal(a.g2,'NOT_PASSED');assert.deepEqual(await replayCorpus(),a);
});
