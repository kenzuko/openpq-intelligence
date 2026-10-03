import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {boundedText} from '../src/platform/bounded-text.js';
import {hash} from '../src/platform/contracts.js';
const out=path.resolve(process.argv[2]||'../airport-window');await mkdir(out,{recursive:false});
const url='https://jotrip-airport-live.kenzuko.workers.dev',samples=[];
for(let i=0;i<3;i++){
 const start=Date.now();let sample={sample:i+1,url,client:'NODE_NATIVE_FETCH_NO_CUSTOM_USER_AGENT',request_started_at:new Date(start).toISOString(),read_only:true};
 try{const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});const raw=await boundedText(r);const received=Date.now();sample={...sample,http_status:r.status,response_received_at:new Date(received).toISOString(),elapsed_ms:received-start,bytes:new TextEncoder().encode(raw).length,payload_sha256:await hash(raw)};
  if(r.ok){const d=JSON.parse(raw),source=Date.parse(d.latest.collected_at_vn);sample={...sample,collected_at_vn:d.latest.collected_at_vn,counts:d.latest.counts,board_version:d.latest.board_version??null,board_age_at_response_ms:Number.isFinite(source)?received-source:null,within_user_60s_snapshot_age:Number.isFinite(source)&&received>=source&&received-source<60000};await writeFile(path.join(out,'sample-'+(i+1)+'.json'),raw);}else sample.error_prefix=raw.slice(0,100);
 }catch(e){sample.error_class=e.name;}
 samples.push(sample);await writeFile(path.join(out,'OBSERVATIONS.json'),JSON.stringify({samples,requested_interval_ms:20000,request_budget:3,timeout_ms:20000,public_get_only:true,continuous_shadow_accepted:false,live_row_update_lag_verified:false,production_enabled:false},null,2)+'\n');
 if(i<2)await new Promise(resolve=>setTimeout(resolve,Math.max(0,20000-(Date.now()-start))));
}
console.log(JSON.stringify({successful:samples.filter(x=>x.http_status===200).length,sample_count:samples.length,scope:'BOUNDED_BOARD_AGE_ONLY',live_row_update_lag_verified:false},null,2));
