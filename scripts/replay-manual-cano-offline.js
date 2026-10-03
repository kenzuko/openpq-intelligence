import {readFile} from 'node:fs/promises';
import {stable} from '../src/platform/contracts.js';
import {buildCanoShadowFromRaw,validateCanoShadow} from '../src/ingress/manual-cano-semantic.js';
import {reduceCanoLedger,validateCanoRevisionWrapper} from '../src/ingress/manual-cano-lineage.js';

const corpusUrl=new URL('../fixtures/manual-cano-offline/corpus.json',import.meta.url);
const corpus=JSON.parse(await readFile(corpusUrl,'utf8'));

async function dispatch(vector){
  const input=structuredClone(vector.input||{});
  if(vector.entry_point.startsWith('buildCanoShadowFromRaw'))return buildCanoShadowFromRaw(input.raw_utf8,input.provenance);
  if(vector.entry_point==='validateCanoShadow')return validateCanoShadow(input.shadow);
  if(vector.entry_point==='validateCanoRevisionWrapper')return validateCanoRevisionWrapper(input.wrapper);
  if(vector.entry_point==='reduceCanoLedger')return reduceCanoLedger({...input,evaluation_time:input.evaluation_time||vector.evaluation_time||corpus.fixed_default_evaluation_time});
  throw new Error('UNKNOWN_VECTOR_ENTRY_POINT');
}
function includesCodes(actual,expected){return (expected||[]).every(code=>(actual||[]).includes(code));}
function checkReturn(vector,out){
  const e=vector.expected||{};
  if(out.action_eligible!==false||out.publication_admitted!==false)return false;
  if(out.projection&&(out.projection.action_eligible!==false||out.projection.publication_admitted!==false))return false;
  if(out.shadow_record&&(out.shadow_record.action_eligible!==false||out.shadow_record.publication_admitted!==false))return false;
  if(e.ledger_status&&(out.ledger_status??out.status)!==e.ledger_status)return false;
  if(e.projection_status&&(out.projection?.state??out.projection_status)!==e.projection_status)return false;
  if(e.projection_state&&out.projection?.state!==e.projection_state)return false;
  if(e.retained_revision_count!==undefined&&out.retained_revision_count!==e.retained_revision_count)return false;
  if(e.terminal_revision_id!==undefined&&out.projection?.terminal_revision_id!==e.terminal_revision_id)return false;
  if(e.reported_state!==undefined&&out.projection?.reported_state!==e.reported_state)return false;
  if(e.revision_id&&out.revision_id!==e.revision_id)return false;
  if(e.normalized_record_digest&&out.normalized_record_digest!==e.normalized_record_digest)return false;
  if(e.shadow&&stable(out)!==stable(e.shadow))return false;
  return includesCodes(out.reason_codes||out.projection?.reason_codes,e.reason_codes);
}
async function run(vector){
  try{
    const out=await dispatch(vector);
    const expectedThrow=['INVALID','VALIDATION_ERROR','SCHEMA_REJECT'].includes(vector.expected?.status)&&vector.entry_point!=='reduceCanoLedger';
    const pass=!expectedThrow&&checkReturn(vector,out);
    return {id:vector.id,pass,mode:'return',ledger_status:out.ledger_status??out.status??null,projection_status:out.projection?.state??out.projection_status??null,reason_codes:out.reason_codes??out.projection?.reason_codes??[],action_eligible:out.action_eligible??false,publication_admitted:out.publication_admitted??false};
  }catch(error){
    const pass=(vector.expected?.reason_codes||[]).includes(error.code);
    return {id:vector.id,pass,mode:'throw',error_code:error.code||'UNSTRUCTURED_ERROR',action_eligible:false,publication_admitted:false};
  }
}

const vectors=[...corpus.r2_vectors,...corpus.supplemental_graph_vectors];
const results=[];
for(const vector of vectors)results.push(await run(vector));
const passCount=results.filter(x=>x.pass).length;
const report={contract_version:'openpq-cano-offline-replay-report-v1',fixture_only:true,evaluation_time:corpus.fixed_default_evaluation_time,corpus_vector_count:vectors.length,pass_count:passCount,fail_count:vectors.length-passCount,results,action_eligible:false,publication_admitted:false};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(report.fail_count)process.exitCode=1;
