import {readWeatherConsumer,WEATHER_CANONICAL_ORIGIN} from '../platform/weather-consumer.js';
import {trustMap} from '../platform/trusted-config.js';
import {WEATHER_DATASET_BY_DOMAIN} from '../platform/weather-execution-contract.js';
import {ContractError,requireThat} from '../platform/contracts.js';
const roles={current:'weather',forecast:'weather_forecast',marine:'weather_marine',cloud:'weather_cloud',compact:'weather_compact',meta:'weather_meta'};
export default {async fetch(request,env){
 try{
  requireThat(['GET','HEAD'].includes(request.method),'READ_ONLY_PUBLIC_WEATHER_READER',405);
  const path=new URL(request.url).pathname,mode=env.WEATHER_READER_MODE;requireThat(['LEGACY','CANONICAL'].includes(mode),'WEATHER_READER_MODE_REQUIRED',503);
  if(path==='/health')return Response.json({service:'weather-fact-reader',reader:mode,roles:Object.keys(roles),operational_action_allowed:false,whole_core_production_ready:false},{headers:{'cache-control':'no-store'}});
  const match=path.match(/^\/weather\/data\/weather-runtime\/(current|forecast|marine|cloud|compact|meta)\.json$/);requireThat(match,'NOT_FOUND',404);
  const domain=roles[match[1]],result=await readWeatherConsumer({mode,domain,origin:WEATHER_CANONICAL_ORIGIN,...(mode==='CANONICAL'?{trust:trustMap(env)[WEATHER_DATASET_BY_DOMAIN[domain]]}:{})});
  return new Response(request.method==='HEAD'?null:result.raw,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','x-openpq-reader':result.reader,'x-openpq-source-digest':result.source_digest,...(result.receipt_digest?{'x-openpq-receipt-digest':result.receipt_digest,'x-openpq-display-expires-at':result.display_expires_at}:{})}});
 }catch(e){return Response.json({error:e instanceof ContractError?e.code:'WEATHER_READER_UNAVAILABLE'},{status:e instanceof ContractError?e.status:503,headers:{'cache-control':'no-store','access-control-allow-origin':'*',...(e.status===405?{allow:'GET, HEAD'}:{})}});}
}};
