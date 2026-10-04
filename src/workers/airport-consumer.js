import {readAirportConsumer,AIRPORT_CANONICAL_ORIGIN} from '../platform/airport-consumer.js';
import {AIRPORT_FACT_DATASET} from '../platform/airport-execution-contract.js';
import {trustMap} from '../platform/trusted-config.js';
import {ContractError,requireThat} from '../platform/contracts.js';
export default {async fetch(request,env){try{
 requireThat(['GET','HEAD'].includes(request.method),'READ_ONLY_PUBLIC_AIRPORT_READER',405);
 const mode=env.AIRPORT_READER_MODE,url=new URL(request.url);requireThat(['LEGACY','CANONICAL'].includes(mode),'AIRPORT_READER_MODE_REQUIRED',503);
 if(url.pathname==='/health')return Response.json({service:'airport-today-fact-reader',reader:mode,operational_action_allowed:false,whole_core_production_ready:false},{headers:{'cache-control':'no-store'}});
 requireThat(['/','/board.json','/version'].includes(url.pathname),'NOT_FOUND',404);
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value])),today=parts.year+'-'+parts.month+'-'+parts.day;
 requireThat(!url.searchParams.has('date')||url.searchParams.get('date')===today,'AIRPORT_CURRENT_DAY_REQUIRED',409);
 const r=await readAirportConsumer({mode,domain:'airport',origin:AIRPORT_CANONICAL_ORIGIN,...(mode==='CANONICAL'?{trust:trustMap(env)[AIRPORT_FACT_DATASET]}:{})});
 const body=JSON.parse(r.raw),raw=url.pathname==='/version'?JSON.stringify({version:body.latest.board_version??body.health.board_version??null}):r.raw;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-expose-headers':'X-OpenPQ-Reader, X-OpenPQ-Source-Digest, X-OpenPQ-Receipt-Digest, X-OpenPQ-Display-Expires-At','x-openpq-reader':r.reader,'x-openpq-source-digest':r.source_digest,...(r.receipt_digest?{'x-openpq-receipt-digest':r.receipt_digest,'x-openpq-display-expires-at':r.display_expires_at}:{})};
 return new Response(request.method==='HEAD'?null:raw,{headers});
}catch(e){return Response.json({error:e instanceof ContractError?e.code:'AIRPORT_READER_UNAVAILABLE'},{status:e instanceof ContractError?e.status:503,headers:{'cache-control':'no-store','access-control-allow-origin':'*',...(e.status===405?{allow:'GET, HEAD'}:{})}});}}};
