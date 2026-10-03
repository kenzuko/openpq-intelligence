import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {DOMAIN_DATASETS} from '../../src/ingress/domain-source-common.js';
import {boundedText} from '../../src/platform/bounded-text.js';
export async function captureIngestionHealth(fetcher=fetch,now=Date.now()){
 const origin='https://openpq-intelligence-runtime-isolated-test.openpq-intelligence.workers.dev';
 const datasets=await Promise.all(Object.values(DOMAIN_DATASETS).map(async dataset_id=>{
  try{
   const r=await fetcher(origin+'/datasets/'+dataset_id,{redirect:'error',signal:AbortSignal.timeout(15000)}),v=JSON.parse(await boundedText(r,1500000));
   const p=v.receipt?.semantic_admission,healthy=r.status===200&&v.receipt?.dataset_id===dataset_id&&v.receipt?.environment_id==='isolated-test'&&v.serving?.authority==='VERIFIED'&&v.serving?.decision_eligibility==='ABSTAIN'&&v.decision?.effect==='ABSTAIN'&&p?.source_policies_activated===false&&p?.producer_independence===false&&Date.parse(p?.valid_until)>now;
   return {dataset_id,status:r.status,healthy,revision:v.receipt?.revision??null,receipt_digest:v.receipt?.digest??null,profile_hash:p?.profile_hash??null,source_time:p?.source_version_time??null,display_expires_at:p?.valid_until??null,authority:v.serving?.authority??null,error:typeof v.error==='string'&&/^[A-Z0-9_]{1,100}$/.test(v.error)?v.error:null};
  }catch{return {dataset_id,healthy:false,error:'RUNTIME_CAPTURE_FAILED'};}
 }));
 return {status:datasets.every(x=>x.healthy)?'REFERENCE_FEED_HEALTHY_AT_OBSERVATION':'REFERENCE_FEED_DEGRADED_AT_OBSERVATION',recorded_at:new Date(now).toISOString(),read_only:true,production_enabled:false,whole_brain_production_ready:false,continuous_uptime_proven:false,datasets};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const destination=process.argv[2]||'.consumer-audit';await mkdir(destination,{recursive:true});const report=await captureIngestionHealth();await writeFile(destination+'/INGESTION_HEALTH.json',JSON.stringify(report,null,2)+'\n');console.log(report.status);if(report.datasets.some(x=>!x.healthy))process.exitCode=1;
}
