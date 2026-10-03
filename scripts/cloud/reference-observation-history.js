import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {requireThat,stable} from '../../src/platform/contracts.js';
const REPO='kenzuko/openpq-intelligence',WORKFLOW='current-consumer-audit.yml';
const STEPS={health:'Observe isolated reference ingestion health',capture:'Capture actual consumer outputs with bounded GET requests',native:'Native admission and three-source Near Me consumer rehearsal'};

export function referenceObservationHistory(records,evaluationTime){
 const now=Date.parse(evaluationTime);requireThat(Number.isFinite(now)&&Array.isArray(records)&&records.length<=512,'OBSERVATION_HISTORY_INPUT_INVALID');
 const ids=new Set();for(const r of records){requireThat(/^\d+$/.test(String(r.run_id))&&!ids.has(String(r.run_id)),'OBSERVATION_HISTORY_DUPLICATE_RUN');ids.add(String(r.run_id));requireThat(/^[a-f0-9]{40}$/.test(r.code_sha)&&Number.isFinite(Date.parse(r.observed_at))&&Date.parse(r.observed_at)<=now&&r.steps&&stable(Object.keys(r.steps).sort())===stable(['capture','health','native'])&&Object.values(r.steps).every(x=>['PASS','FAIL','UNKNOWN'].includes(x)),'OBSERVATION_HISTORY_RECORD_INVALID');}
 const sorted=[...records].sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at)),healthy=sorted.filter(x=>x.steps.health==='PASS'),spans=healthy.length?Date.parse(healthy.at(-1).observed_at)-Date.parse(healthy[0].observed_at):0,gaps=healthy.slice(1).map((x,i)=>Date.parse(x.observed_at)-Date.parse(healthy[i].observed_at));
 return {contract_version:'openpq-reference-observation-history-v1',evaluated_at:evaluationTime,status:healthy.length?'SAMPLED_REFERENCE_HISTORY_AVAILABLE':'NO_SUCCESSFUL_REFERENCE_HEALTH_OBSERVATIONS',workflow:WORKFLOW,total_runs:sorted.length,successful_health_samples:healthy.length,failed_health_samples:sorted.filter(x=>x.steps.health==='FAIL').length,unknown_health_samples:sorted.filter(x=>x.steps.health==='UNKNOWN').length,failed_native_samples:sorted.filter(x=>x.steps.native==='FAIL').length,first_successful_sample:healthy[0]?.observed_at??null,last_successful_sample:healthy.at(-1)?.observed_at??null,sampled_span_ms:spans,largest_gap_between_successful_samples_ms:gaps.length?Math.max(...gaps):null,proposed_72h_span_elapsed:spans>=72*3600000,proposed_7d_span_elapsed:spans>=7*86400000,records:sorted,continuous_uptime_proven:false,unattended_failure_injection_proven:false,critical_cycle_coverage_proven:false,policy_acceptance_proven:false,shadow_gate_passed:false,resilience_gate_passed:false,full_system_restore_proven:false,production_enabled:false};
}

export async function captureReferenceObservationHistory(destination,fetcher=fetch){
 requireThat(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===REPO&&process.env.GITHUB_TOKEN,'OBSERVATION_HISTORY_GITHUB_CONTEXT_REQUIRED');
 const now=Date.now(),since=now-7*86400000,api=async suffix=>{const r=await fetcher('https://api.github.com/repos/'+REPO+suffix,{headers:{authorization:'Bearer '+process.env.GITHUB_TOKEN,accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});requireThat(r.ok,'OBSERVATION_HISTORY_API_HTTP_'+r.status);return r.json();};
 const runs=[];for(let page=1;page<=5;page++){const list=(await api(`/actions/workflows/${WORKFLOW}/runs?branch=main&per_page=100&page=${page}`)).workflow_runs;requireThat(Array.isArray(list),'OBSERVATION_HISTORY_API_FORMAT_INVALID');runs.push(...list.filter(x=>x.status==='completed'&&Date.parse(x.created_at)>=since));if(list.length<100||list.some(x=>Date.parse(x.created_at)<since))break;}
 const records=[];
 for(let offset=0;offset<runs.length;offset+=8){const batch=await Promise.all(runs.slice(offset,offset+8).map(async run=>{
  const jobs=(await api(`/actions/runs/${run.id}/jobs?per_page=100`)).jobs;requireThat(Array.isArray(jobs)&&jobs.length===1,'OBSERVATION_HISTORY_JOB_AMBIGUOUS');const steps={};
  for(const [kind,name] of Object.entries(STEPS)){const matching=jobs[0].steps.filter(x=>x.name===name);requireThat(matching.length<=1,'OBSERVATION_HISTORY_STEP_AMBIGUOUS');const step=matching[0];steps[kind]=step?.conclusion==='success'?'PASS':step?.conclusion==='failure'?'FAIL':'UNKNOWN';}
  const health=jobs[0].steps.find(x=>x.name===STEPS.health);return {run_id:String(run.id),code_sha:run.head_sha,observed_at:health?.completed_at||run.updated_at,event:run.event,workflow_conclusion:run.conclusion,steps};
 }));records.push(...batch);}
 const report=referenceObservationHistory(records,new Date(now).toISOString());await mkdir(destination,{recursive:true});await writeFile(destination+'/REFERENCE_OBSERVATION_HISTORY.json',JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const report=await captureReferenceObservationHistory(process.argv[2]||'.consumer-audit');console.log(JSON.stringify({status:report.status,samples:report.successful_health_samples,sampled_span_hours:report.sampled_span_ms/3600000,shadow_gate_passed:false,resilience_gate_passed:false}));}
