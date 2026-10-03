// Temporary, run-scoped archive staging. Replaced by GET-only Runtime before serving proof.
import {hash} from '../../src/platform/contracts.js';
import {boundedText} from '../../src/platform/bounded-text.js';
export default {async fetch(request,env){
 if(env.ENVIRONMENT_ID!=='isolated-test'||!/^\d+$/.test(env.RECOVERED_RUNTIME_RUN_ID||''))return new Response(null,{status:503});
 if(!env.PROVISIONING_TOKEN||request.headers.get('authorization')!=='Bearer '+env.PROVISIONING_TOKEN)return new Response(null,{status:401});
 if(new URL(request.url).pathname!=='/snapshot-archive'||request.method!=='PUT')return new Response(null,{status:405});
 try{
  const body=JSON.parse(await boundedText(new Response(request.body,{headers:request.headers}),8*1024*1024+262144));
  if(Object.keys(body).sort().join(',')!=='key,snapshot'||!new RegExp('^recovery/snapshots/runtime-'+env.RECOVERED_RUNTIME_RUN_ID+'-[a-z_]+\\.json$').test(body.key))return new Response(null,{status:403});
  const digest=JSON.parse(env.RECOVERED_UPLOADS_JSON||'{}')[body.key];if(!digest||await hash(body.snapshot)!==digest)return new Response(null,{status:409});
  const value=JSON.stringify(body.snapshot),saved=await env.CANONICAL.put(body.key,value,{onlyIf:{etagDoesNotMatch:'*'}});
  if(!saved){const existing=await env.CANONICAL.get(body.key);if(!existing||await existing.text()!==value)return new Response(null,{status:409});}
  return Response.json({key:body.key,digest,stored:true});
 }catch{return new Response(null,{status:400});}
}};
