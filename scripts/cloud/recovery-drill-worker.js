// Temporary isolated drill adapter. Never deploy this entrypoint on a consumer/feed Worker.
import core,{DatasetCoordinator} from '../../src/workers/core.js';
import {hash} from '../../src/platform/contracts.js';
import {boundedText} from '../../src/platform/bounded-text.js';
export {DatasetCoordinator};
export default {async fetch(request,env){
 const path=new URL(request.url).pathname,run=env.RECOVERY_DRILL_RUN_ID;
 if(env.ENVIRONMENT_ID!=='isolated-test'||!/^\d{1,24}$/.test(run||'')||!['source','target'].includes(env.RECOVERY_DRILL_ROLE))return new Response(null,{status:503});
 if(path==='/probe'){
  if(request.method!=='GET')return new Response(null,{status:405});
  if(!env.PROVISIONING_TOKEN||request.headers.get('authorization')!=='Bearer '+env.PROVISIONING_TOKEN)return new Response(null,{status:401});
  const dataset='fixture.recovery.'+run,object_name=`isolated-test/${dataset}/${env.RECOVERY_DRILL_ROLE}`;
  return Response.json({dataset_id:dataset,object_name,native_id:env.DATASETS.idFromName(object_name).toString()});
 }
 if(path==='/storage-write'||path==='/snapshot-archive'){
  if(!env.STORAGE_WRITER_TOKEN||request.headers.get('authorization')!=='Bearer '+env.STORAGE_WRITER_TOKEN)return new Response(null,{status:401});
  if(request.method!=='PUT')return new Response(null,{status:405});
  if(!env.CANONICAL)return new Response(null,{status:503});
  const key=path==='/storage-write'?`recovery/write-probes/${run}-${env.RECOVERY_DRILL_ROLE}.json`:`recovery/snapshots/${run}.json`;
  if(path==='/snapshot-archive'&&env.RECOVERY_DRILL_ROLE!=='target')return new Response(null,{status:403});
  const maximum=path==='/storage-write'?4096:8*1024*1024+262144;
  if(Number(request.headers.get('content-length')||0)>maximum)return new Response(null,{status:413});
  let data;try{data=await boundedText(new Response(request.body,{headers:request.headers}),maximum);}catch{return new Response(null,{status:413});}
  if(path==='/snapshot-archive'){
   const saved=await env.CANONICAL.put(key,data,{onlyIf:{etagDoesNotMatch:'*'}});
   if(!saved){const prior=await env.CANONICAL.get(key);if(!prior||await prior.text()!==data)return new Response(null,{status:409});}
  }else await env.CANONICAL.put(key,data);
  const saved=await env.CANONICAL.get(key);if(!saved||await saved.text()!==data)return new Response(null,{status:503});
  return Response.json({key,digest:await hash(data),stored:true});
 }
 return core.fetch(request,env);
}};
