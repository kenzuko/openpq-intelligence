import {DurableObject} from 'cloudflare:workers';
import {ingestDataset} from '../ingress/domain-feed.js';
import {ContractError,requireThat} from '../platform/contracts.js';
import {executionEnvironment,executionDataset,TRANSIT_FACT_ENVIRONMENT} from '../platform/transit-execution-scope.js';
import {TRANSIT_FACT_PROFILE_VERSION} from '../platform/domain-continuous-contract.js';
const DATASET='transit.bridge.phu-quoc',OBJECT=TRANSIT_FACT_ENVIRONMENT+'/'+DATASET;
function entry(env){
 executionEnvironment(env);requireThat(env.ENVIRONMENT_ID===TRANSIT_FACT_ENVIRONMENT,'TRANSIT_SOURCE_ENVIRONMENT_DENIED',503);
 const e=JSON.parse(env.TRANSIT_INGEST_CONFIG_JSON||'null');
 requireThat(e?.authority&&e.profile?.contract_version===TRANSIT_FACT_PROFILE_VERSION,'TRANSIT_SOURCE_CONFIG_REQUIRED',503);executionDataset(env,e.authority);
 return e;
}
export class TransitSourcePump extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.pending=false;}
 async fetch(request){
  try{
   const e=entry(this.env);requireThat(this.env.SOURCE_PUMPS.idFromName(OBJECT).toString()===this.ctx.id.toString(),'TRANSIT_SOURCE_OBJECT_DENIED',403);
   const path=new URL(request.url).pathname;
   if(request.method==='GET'&&path==='/status')return Response.json({observation:await this.ctx.storage.get('last_observation')??null});
   requireThat(request.method==='POST'&&path==='/refresh','READ_ONLY_PUBLIC_SOURCE_INTERFACE',405);requireThat(!this.pending,'INGEST_ALREADY_RUNNING',409);this.pending=true;
   try{const result=await ingestDataset(e,this.env.CORE_COMMAND);await this.ctx.storage.put('last_observation',{at:new Date().toISOString(),...result});return Response.json(result);}
   finally{this.pending=false;}
  }catch(e){const result={dataset_id:DATASET,status:'ABSTAIN',error:e instanceof ContractError?e.code:'TRANSIT_SOURCE_UNAVAILABLE',operational_action_allowed:false};await this.ctx.storage.put('last_observation',{at:new Date().toISOString(),...result});return Response.json(result,{status:e instanceof ContractError?e.status:503});}
 }
}
export default {
 async fetch(request,env){try{entry(env);requireThat(request.method==='GET'&&new URL(request.url).pathname==='/health','NOT_FOUND',404);return env.SOURCE_PUMPS.get(env.SOURCE_PUMPS.idFromName(OBJECT)).fetch('https://pump/status');}catch(e){return Response.json({error:e instanceof ContractError?e.code:'TRANSIT_SOURCE_UNAVAILABLE'},{status:e instanceof ContractError?e.status:503});}},
 async scheduled(_event,env){entry(env);const r=await env.SOURCE_PUMPS.get(env.SOURCE_PUMPS.idFromName(OBJECT)).fetch('https://pump/refresh',{method:'POST'});console.log(JSON.stringify({kind:'CANONICAL_TRANSIT_BRIDGE',...await r.json()}));}
};
