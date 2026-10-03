// Temporary isolated drill adapter. Never deploy this entrypoint on a consumer/feed Worker.
import core,{DatasetCoordinator as NativeDatasetCoordinator} from '../../src/workers/core.js';
import {hash} from '../../src/platform/contracts.js';
import {boundedText} from '../../src/platform/bounded-text.js';
import {DOMAIN_DATASETS} from '../../src/ingress/domain-source-common.js';
// A fresh compiled class revision makes configuration activation observable on existing DOs.
// The marker carries no authority, credentials or persisted control state.
export class DatasetCoordinator extends NativeDatasetCoordinator {
 constructor(ctx,env){super(ctx,env);this.drill_activation=typeof OPENPQ_DRILL_ACTIVATION==='undefined'?'local':OPENPQ_DRILL_ACTIVATION;}
}
export default {async fetch(request,env){
 const path=new URL(request.url).pathname,run=env.RECOVERY_DRILL_RUN_ID;
 if(env.ENVIRONMENT_ID!=='isolated-test'||!/^\d{1,24}$/.test(run||'')||!['source','target'].includes(env.RECOVERY_DRILL_ROLE))return new Response(null,{status:503});
 if(path==='/probe'){
  if(request.method!=='GET')return new Response(null,{status:405});
  if(!env.PROVISIONING_TOKEN||request.headers.get('authorization')!=='Bearer '+env.PROVISIONING_TOKEN)return new Response(null,{status:401});
  const dataset=env.RECOVERY_DRILL_DATASET||'fixture.recovery.'+run;
  if(env.RECOVERY_DRILL_DATASET&&!Object.values(DOMAIN_DATASETS).includes(dataset))return new Response(null,{status:403});
  const object_name=env.RECOVERY_DRILL_DATASET?`isolated-test/${dataset}/${run}/${env.RECOVERY_DRILL_ROLE}`:`isolated-test/${dataset}/${env.RECOVERY_DRILL_ROLE}`;
  return Response.json({dataset_id:dataset,object_name,native_id:env.DATASETS.idFromName(object_name).toString(),canonical_bound:Boolean(env.CANONICAL),storage_gateway_configured:Boolean(env.STORAGE_WRITER_TOKEN),storage_gateway_credential_fingerprint:await hash(env.STORAGE_WRITER_TOKEN||'')});
 }
 if(path==='/storage-write'||path==='/snapshot-archive'||path==='/domain-archive'){
  if(!env.STORAGE_WRITER_TOKEN||request.headers.get('authorization')!=='Bearer '+env.STORAGE_WRITER_TOKEN)return new Response(null,{status:401});
  if(request.method!=='PUT')return new Response(null,{status:405});
  if(!env.CANONICAL)return new Response(null,{status:503});
  const slot=env.RECOVERY_ARCHIVE_SLOT||run;if(!/^[a-zA-Z0-9_-]{1,128}$/.test(slot))return new Response(null,{status:403});
  const key=path==='/storage-write'?`recovery/write-probes/${slot}-${env.RECOVERY_DRILL_ROLE}.json`:`recovery/${path==='/domain-archive'?'domains':'snapshots'}/${slot}.json`;
  if(path!=='/storage-write'&&env.RECOVERY_DRILL_ROLE!=='target')return new Response(null,{status:403});
  const maximum=path==='/storage-write'?4096:path==='/domain-archive'?16*1024*1024:8*1024*1024+262144;
  if(Number(request.headers.get('content-length')||0)>maximum)return new Response(null,{status:413});
  let data;try{data=await boundedText(new Response(request.body,{headers:request.headers}),maximum);}catch{return new Response(null,{status:413});}
  if(path!=='/storage-write'){
   const saved=await env.CANONICAL.put(key,data,{onlyIf:{etagDoesNotMatch:'*'}});
   if(!saved){const prior=await env.CANONICAL.get(key);if(!prior||await prior.text()!==data)return new Response(null,{status:409});}
  }else await env.CANONICAL.put(key,data);
  const saved=await env.CANONICAL.get(key);if(!saved||await saved.text()!==data)return new Response(null,{status:503});
  return Response.json({key,digest:await hash(data),stored:true});
 }
 return core.fetch(request,env);
}};
