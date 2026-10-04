import {DurableObject} from 'cloudflare:workers';
import {DIRECTORY_FACT_DATASET,DIRECTORY_FACT_ENVIRONMENT} from '../platform/directory-execution-contract.js';
const DIRECTORY_FACT_DATASETS=[DIRECTORY_FACT_DATASET];
import {executionEnvironment,executionDataset} from '../platform/transit-execution-scope.js';
import {DIRECTORY_FACT_PROFILE_VERSION} from '../platform/domain-continuous-contract.js';
import {ingestDataset} from '../ingress/domain-feed.js';
import {ContractError,requireThat} from '../platform/contracts.js';


export class DirectorySourcePump extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.pending=false;}
 async fetch(request){
  let dataset_id;
  try{
   executionEnvironment(this.env);requireThat(this.env.ENVIRONMENT_ID===DIRECTORY_FACT_ENVIRONMENT,'DIRECTORY_SOURCE_ENVIRONMENT_DENIED',403);
   if(request.method==='GET'&&new URL(request.url).pathname==='/status')return Response.json({observation:await this.ctx.storage.get('last_observation')??null});
   requireThat(request.method==='POST'&&new URL(request.url).pathname==='/refresh','INGEST_METHOD_DENIED',405);
   // The namespace is owned exclusively by the source Worker. Select the
   // actor by this object's native identity, never caller supplied profile/URL.
   const names=DIRECTORY_FACT_DATASETS;const index=names.findIndex(id=>this.env.SOURCE_PUMPS.idFromName(DIRECTORY_FACT_ENVIRONMENT+'/'+id).toString()===this.ctx.id.toString());
   requireThat(index>=0,'INGEST_OBJECT_DENIED',403);dataset_id=names[index];
   const entry=JSON.parse(this.env['INGEST_DATASET_'+(index+1)]||'null');requireThat(entry?.authority?.dataset_id===dataset_id&&entry.profile?.contract_version===DIRECTORY_FACT_PROFILE_VERSION,'INGEST_DATASET_CONFIG_DENIED',503);executionDataset(this.env,entry.authority);
   requireThat(!this.pending,'INGEST_ALREADY_RUNNING',409);this.pending=true;
   try{
    const result=await ingestDataset(entry,this.env.CORE_COMMAND);
    await this.ctx.storage.put('last_observation',{at:new Date().toISOString(),...result});
    return Response.json(result);
   }finally{this.pending=false;}
  }catch(e){
   const result={dataset_id:dataset_id??null,status:'ABSTAIN',error:e instanceof ContractError?e.code:'INGEST_TRANSPORT_OR_PAYLOAD_FAILED',operational_action_allowed:false};
   await this.ctx.storage.put('last_observation',{at:new Date().toISOString(),...result});
   return Response.json(result,{status:e instanceof ContractError?e.status:503});
  }
 }
}
export async function ingestionTick(env){
 executionEnvironment(env);requireThat(env.ENVIRONMENT_ID===DIRECTORY_FACT_ENVIRONMENT,'DIRECTORY_SOURCE_ENVIRONMENT_DENIED',403);
 const results=[];
 // Cron does only small dispatches. Parsing/projection/compression runs in
 // independent non-authoritative SQLite objects with no signing/R2 binding.
 for(const dataset_id of DIRECTORY_FACT_DATASETS){
  try{const id=env.SOURCE_PUMPS.idFromName(DIRECTORY_FACT_ENVIRONMENT+'/'+dataset_id),r=await env.SOURCE_PUMPS.get(id).fetch('https://pump/refresh',{method:'POST'});results.push(await r.json());}
  catch{results.push({dataset_id,status:'ABSTAIN',error:'INGEST_DISPATCH_FAILED',operational_action_allowed:false});}
 }
 return results;
}
export default {
 async fetch(request,env){
  try{executionEnvironment(env);}catch{return Response.json({error:'DIRECTORY_SOURCE_ENVIRONMENT_DENIED'},{status:503});}
  if(request.method==='GET'&&new URL(request.url).pathname==='/health'&&env.ENVIRONMENT_ID===DIRECTORY_FACT_ENVIRONMENT){
   const datasets=await Promise.all(DIRECTORY_FACT_DATASETS.map(async dataset_id=>{try{const id=env.SOURCE_PUMPS.idFromName(DIRECTORY_FACT_ENVIRONMENT+'/'+dataset_id),r=await env.SOURCE_PUMPS.get(id).fetch('https://pump/status');return {dataset_id,...await r.json()};}catch{return {dataset_id,error:'PUMP_STATUS_UNAVAILABLE'};}}));
   return Response.json({service:'canonical-directory-fact-ingestion',code_sha:env.SOURCE_CODE_SHA??null,implementation_patch_sha:env.SOURCE_PATCH_SHA??null,production_enabled:false,datasets},{headers:{'cache-control':'no-store'}});
  }
  return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});
 },
 async scheduled(_event,env){const results=await ingestionTick(env);console.log(JSON.stringify({kind:'CANONICAL_DIRECTORY_FACT_INGESTION',results}));}
};
