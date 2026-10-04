import {readTransitConsumer,TRANSIT_CANONICAL_ORIGIN} from '../platform/transit-consumer.js';
import {ContractError,requireThat} from '../platform/contracts.js';
const PUBLIC_READ_HEADERS={'cache-control':'no-store','access-control-allow-origin':'*'};
// A reader-only gateway. The mode changes explicitly; a failed canonical read never polls legacy.
export default {async fetch(request,env){
 try{
  requireThat(['GET','HEAD'].includes(request.method),'READ_ONLY',405);
  const path=new URL(request.url).pathname;
  if(path==='/health')return Response.json({service:'transit-consumer',reader:env.TRANSIT_READER_MODE??null,whole_core_production_ready:false},{headers:PUBLIC_READ_HEADERS});
  requireThat(path==='/network.json','NOT_FOUND',404);
  const result=await readTransitConsumer({mode:env.TRANSIT_READER_MODE,origin:TRANSIT_CANONICAL_ORIGIN,trust:JSON.parse(env.TRANSIT_READER_TRUST_JSON||'null')});
  return new Response(request.method==='HEAD'?null:result.raw,{headers:{'content-type':'application/json; charset=utf-8',...PUBLIC_READ_HEADERS,'x-openpq-reader':result.reader,'x-openpq-source-digest':result.source_digest,...(result.receipt_digest?{'x-openpq-receipt-digest':result.receipt_digest,'x-openpq-source-version-time':result.source_version_time,'x-openpq-display-expires-at':result.display_expires_at}:{})}});
 }catch(e){const failure_kind=e instanceof ContractError?'CONTRACT_DENIED':typeof e?.message==='string'&&e.message.includes('Illegal invocation')?'ILLEGAL_INVOCATION':['TypeError','SyntaxError','AbortError','TimeoutError'].includes(e?.name)?e.name:'UNKNOWN';return Response.json({error:e instanceof ContractError?e.code:'TRANSIT_READER_UNAVAILABLE',failure_kind},{status:e instanceof ContractError?e.status:503,headers:PUBLIC_READ_HEADERS});}
}};
