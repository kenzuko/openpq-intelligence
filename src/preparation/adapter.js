import {closedEnvironment,exactKeys,integer,object,report,requireThat,text} from './common.js';
export function adapterPlan(config,policies,environment,scope){
 closedEnvironment(environment);exactKeys(config,['adapter_id','environment_id','source_id','origin','path','credential_reference','response_type'],'ADAPTER_CONFIG');
 requireThat(config.environment_id===environment,'ADAPTER_ENVIRONMENT_MISMATCH');text(config.adapter_id,'ADAPTER_ID');text(config.source_id,'SOURCE_ID');
 const origin=new URL(config.origin);requireThat(origin.protocol==='https:'&&!origin.username&&!origin.password&&origin.pathname==='/'&&!origin.search&&!origin.hash,'ADAPTER_ORIGIN_INVALID');
 requireThat(typeof config.path==='string'&&config.path.startsWith('/')&&!config.path.startsWith('//')&&!config.path.includes('?')&&!config.path.includes('#'),'ADAPTER_PATH_INVALID');
 const url=new URL(config.path,origin);requireThat(url.origin===origin.origin&&!url.username&&!url.password,'ADAPTER_ORIGIN_ESCAPE');
 requireThat(config.response_type==='json','ADAPTER_RESPONSE_TYPE_UNSUPPORTED');requireThat(config.credential_reference===null||typeof config.credential_reference==='string','ADAPTER_CREDENTIAL_REFERENCE_INVALID');
 const license=policies.require('P09',['derived_use','raw_storage'],scope);requireThat(license.derived_use===true,'ADAPTER_SOURCE_LICENSE_BLOCKED');requireThat(typeof license.raw_storage==='boolean','ADAPTER_RAW_POLICY_REQUIRED');
 const budget=policies.require('P10',['requests','concurrency','retries','payload_bytes','timeout_ms'],scope);
 for(const k of ['requests','concurrency','payload_bytes','timeout_ms'])integer(budget[k],k,1);integer(budget.retries,'retries');
 return Object.freeze({adapter_id:config.adapter_id,source_id:config.source_id,url:url.href,credential_reference:config.credential_reference,budget:Object.freeze({...budget}),raw_storage_allowed:license.raw_storage,network_activation:false});
}
async function bounded(response,limit){
 const length=response.headers.get('content-length');if(length!==null)requireThat(/^\d+$/.test(length)&&Number(length)<=limit,'ADAPTER_PAYLOAD_TOO_LARGE');
 requireThat(response.body,'ADAPTER_BODY_MISSING');const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;requireThat(size<=limit,'ADAPTER_PAYLOAD_TOO_LARGE');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
// No default fetch and no credentials: only an injected, caller-owned rehearsal transport.
export async function exerciseAdapter(plan,transport){
 requireThat(plan.network_activation===false&&typeof transport==='function','ADAPTER_REHEARSAL_TRANSPORT_REQUIRED');
 const controller=new AbortController();let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('ADAPTER_TIMEOUT'));},plan.budget.timeout_ms);});
 try{
  const value=await Promise.race([(async()=>{const response=await transport(plan.url,{method:'GET',redirect:'manual',signal:controller.signal});requireThat(response.status===200,'ADAPTER_HTTP_NOT_SUCCESS');requireThat(!response.redirected,'ADAPTER_REDIRECT_DENIED');requireThat(response.headers.get('content-type')?.split(';')[0].trim()==='application/json','ADAPTER_CONTENT_TYPE_INVALID');const raw=await bounded(response,plan.budget.payload_bytes);return JSON.parse(raw);})(),timeout]);
  object(value,'ADAPTER_JSON');return report('ADAPTER_REHEARSAL_PASS',{adapter_id:plan.adapter_id,source_id:plan.source_id,value,raw_storage_allowed:plan.raw_storage_allowed});
 }finally{clearTimeout(timer);controller.abort();}
}
