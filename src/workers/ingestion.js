import {DurableObject} from 'cloudflare:workers';
import {DOMAIN_DATASETS} from '../ingress/domain-source-common.js';
import {ingestDataset} from '../ingress/domain-feed.js';
import {ContractError,requireThat} from '../platform/contracts.js';
import {ISOLATED_ACCOUNT_ID} from '../platform/domain-bridge-admission.js';

export class DatasetSourcePump extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.pending=false;}
 async fetch(request){
  let dataset_id;
  try{
   requireThat(this.env.ENVIRONMENT_ID==='isolated-test'&&this.env.ACCOUNT_ID===ISOLATED_ACCOUNT_ID,'INGEST_ISOLATION_DENIED',403);
   requireThat(request.method==='POST'&&new URL(request.url).pathname==='/refresh','INGEST_METHOD_DENIED',405);
   // The namespace is owned exclusively by the source Worker. Select the
   // actor by this object's native identity, never caller supplied profile/URL.
   const names=Object.values(DOMAIN_DATASETS);const index=names.findIndex(id=>this.env.SOURCE_PUMPS.idFromName('isolated-test/'+id).toString()===this.ctx.id.toString());
   requireThat(index>=0,'INGEST_OBJECT_DENIED',403);dataset_id=names[index];
   const entry=JSON.parse(this.env['INGEST_DATASET_'+(index+1)]||'null');requireThat(entry?.authority?.dataset_id===dataset_id,'INGEST_DATASET_CONFIG_DENIED',503);
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
 requireThat(env.ENVIRONMENT_ID==='isolated-test'&&env.ACCOUNT_ID===ISOLATED_ACCOUNT_ID,'INGEST_ISOLATION_DENIED',403);
 const results=[];
 // Cron does only small dispatches. Parsing/projection/compression runs in
 // independent non-authoritative SQLite objects with no signing/R2 binding.
 for(const dataset_id of Object.values(DOMAIN_DATASETS)){
  try{const id=env.SOURCE_PUMPS.idFromName('isolated-test/'+dataset_id),r=await env.SOURCE_PUMPS.get(id).fetch('https://pump/refresh',{method:'POST'});results.push(await r.json());}
  catch{results.push({dataset_id,status:'ABSTAIN',error:'INGEST_DISPATCH_FAILED',operational_action_allowed:false});}
 }
 return results;
}
export default {
 fetch(){return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});},
 async scheduled(_event,env){const results=await ingestionTick(env);console.log(JSON.stringify({kind:'ISOLATED_REFERENCE_INGESTION',results}));}
};
