import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {gzipSync} from 'node:zlib';
import {openDomainRehearsal} from './local/domain-rehearsal.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
const out=path.resolve(process.argv[2]||'../runtime-local-metrics');await mkdir(out,{recursive:false});
const meta=JSON.parse(await readFile(new URL('../tests/data/domains/SOURCE_PINS.json',import.meta.url),'utf8')),results=[];
for(const domain of Object.keys(DOMAIN_DATASETS)){
 let s;try{
  const started=performance.now(),opened=await openDomainRehearsal(domain,meta);s=opened.s;
  const setup_to_first_verified_serve_ms=performance.now()-started,latencies=[],response_bytes=[];let firstRaw;
  for(let i=0;i<5;i++){
   const runtime=await s.mf.getWorker('runtime'),start=performance.now(),response=await runtime.fetch('https://runtime/datasets/'+s.trust.dataset_id),raw=await response.text();latencies.push(performance.now()-start);assert.equal(response.status,200,raw);
   const served=JSON.parse(raw);assert.equal(served.serving.authority,'VERIFIED');assert.equal(served.serving.decision_eligibility,'ABSTAIN');assert.deepEqual(served.data,opened.served.data);response_bytes.push(new TextEncoder().encode(raw).length);if(i===0)firstRaw=raw;
  }
  const sorted=[...latencies].sort((a,b)=>a-b);results.push({domain,records:opened.served.data.records.length,setup_to_first_verified_serve_ms,warm_samples:5,warm_read_ms:{min:sorted[0],median:sorted[2],max:sorted[4],samples:latencies},max_response_bytes:Math.max(...response_bytes),gzip_reference_bytes:gzipSync(firstRaw).length,gzip_serving_activated:false,projection_parity:'PASS'});
 }finally{if(s)await s.mf.dispose();}
}
const report={status:'PASS_LOCAL_MEASUREMENT_WITH_PARITY',scope:'LOCAL_MINIFLARE_WITHOUT_WAN_OR_PROVIDER_LATENCY',clock:'CAPTURED_SOURCE_REPLAY',results,production_SLA_verified:false,performance_threshold_activated:false,production_enabled:false,remote_writes:0};await writeFile(path.join(out,'RUNTIME_METRICS.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
