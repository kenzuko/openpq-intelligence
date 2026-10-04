import {readDirectoryConsumer,DIRECTORY_CANONICAL_ORIGIN} from '../platform/directory-consumer.js';
import {DIRECTORY_FACT_DATASET} from '../platform/directory-execution-contract.js';
import {trustMap} from '../platform/trusted-config.js';
import {ContractError,requireThat,hash} from '../platform/contracts.js';
const paths={'/location-index.json':'index','/home-support.json':'support','/destination-venues.json':'venues'};
export default {async fetch(request,env){try{
 requireThat(['GET','HEAD'].includes(request.method),'READ_ONLY_PUBLIC_DIRECTORY_READER',405);
 const mode=env.DIRECTORY_READER_MODE,path=new URL(request.url).pathname;requireThat(['LEGACY','CANONICAL'].includes(mode),'DIRECTORY_READER_MODE_REQUIRED',503);
 if(path==='/health')return Response.json({service:'directory-publication-reader',reader:mode,files:Object.keys(paths),operational_action_allowed:false,whole_core_production_ready:false},{headers:{'cache-control':'no-store'}});
 requireThat(path==='/publication.json'||Object.hasOwn(paths,path),'NOT_FOUND',404);
 const result=await readDirectoryConsumer({mode,origin:DIRECTORY_CANONICAL_ORIGIN,...(mode==='CANONICAL'?{trust:trustMap(env)[DIRECTORY_FACT_DATASET]}:{})});
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','x-openpq-reader':result.reader,'x-openpq-source-set-hash':result.source_set_hash,'x-openpq-publication-id':result.publication_id,...(result.receipt_digest?{'x-openpq-receipt-digest':result.receipt_digest,'x-openpq-display-expires-at':result.display_expires_at}:{})};
 const raw=path==='/publication.json'?JSON.stringify({files:Object.fromEntries(Object.entries(result.raws).map(([name,text])=>[name,JSON.parse(text)])),publication:{publication_id:result.publication_id,source_set_hash:result.source_set_hash,reader:result.reader,receipt_digest:result.receipt_digest??null,display_expires_at:result.display_expires_at??null},operational_action_allowed:false}):result.raws[paths[path]];
 headers['x-openpq-source-digest']=await hash(raw);return new Response(request.method==='HEAD'?null:raw,{headers});
}catch(e){return Response.json({error:e instanceof ContractError?e.code:'DIRECTORY_READER_UNAVAILABLE'},{status:e instanceof ContractError?e.status:503,headers:{'cache-control':'no-store','access-control-allow-origin':'*',...(e.status===405?{allow:'GET, HEAD'}:{})}});}}};
