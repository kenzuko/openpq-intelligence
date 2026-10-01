import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {fixtureReplay} from '../src/contracts/semantic.js';
import {hash,requireThat,stable} from '../src/platform/contracts.js';
export async function replayCorpus(path='fixtures/semantic/corpus.json'){
  const corpus=JSON.parse(await readFile(path,'utf8'));requireThat(corpus.fixture_only===true&&Array.isArray(corpus.cases)&&corpus.cases.length>0,'FIXTURE_CORPUS_REQUIRED');
  const ids=new Set(),cases=[];
  for(const item of corpus.cases){
    requireThat(typeof item.case_id==='string'&&!ids.has(item.case_id),'CORPUS_CASE_ID_CONFLICT');ids.add(item.case_id);
    const before=stable(item.input),result=await fixtureReplay(item.input);
    assert.equal(stable(item.input),before,'Kernel mutated input');
    for(const [key,value] of Object.entries(item.expected))assert.deepEqual(result[key],value,item.case_id+': '+key);
    assert.deepEqual(await fixtureReplay(item.input),result,item.case_id+': nondeterministic replay');
    cases.push({case_id:item.case_id,status:'PASS',decision_id:result.decision_id,input_hash:result.input_hash,effect:result.effect,action_until:result.action_until});
  }
  return {status:'SYNTHETIC_SEMANTIC_SUBSET_PASS',corpus_version:corpus.corpus_version,corpus_hash:await hash(corpus),g1:'NOT_PASSED',g2:'NOT_PASSED',cases};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);assert.ok(args.length===0||(args.length===2&&args[0]==='--output'),'Usage: node scripts/replay-semantic.js [--output report.json]');
  const report=await replayCorpus();if(args.length)await writeFile(args[1],JSON.stringify(report,null,2)+'\n');
  console.log(report.status+': '+report.cases.length+' cases. Synthetic only; G1/G2 not passed.');
}
