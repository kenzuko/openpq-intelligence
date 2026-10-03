import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {ContractError,requireThat} from '../../src/platform/contracts.js';
import {ISOLATED_ACCOUNT_ID} from '../../src/platform/domain-bridge-admission.js';
import {isContinuousProfile} from '../../src/platform/domain-continuous-admission.js';
import {PRINCIPAL_SECRET_NAMES} from '../../src/platform/auth.js';
import {principalSecrets} from './prepare.js';
import {S3ReadonlyReader} from '../../src/platform/s3-reader.js';
import {verifyAttestation} from '../../src/platform/receipts.js';
import {waitForCapabilityStatus} from './capability-readiness.js';
const root='.cloud-proof/',mode=process.argv[2],name='openpq-intelligence-ingestion-isolated-test';
const data=JSON.parse(await readFile(root+'domain.private.json','utf8')),{authorities,profiles,origins,tokens}=data;
requireThat(Object.values(authorities).every(x=>x.account_id===ISOLATED_ACCOUNT_ID&&x.environment_id==='isolated-test'),'INGEST_ACCOUNT_PIN_REQUIRED');
const command=args=>{const r=spawnSync('node_modules/.bin/wrangler',args,{encoding:'utf8',stdio:'pipe',env:{...process.env,CLOUDFLARE_API_TOKEN:process.env.CF_TEST_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:ISOLATED_ACCOUNT_ID,WRANGLER_SEND_METRICS:'false'}});requireThat(r.status===0,'INGEST_DEPLOY_COMMAND_FAILED',503);};
const save=report=>writeFile(root+'ingestion-evidence.public.json',JSON.stringify(report,null,2)+'\n');
const original=JSON.parse(await readFile(root+'core-secrets.json','utf8'));
const readers=PRINCIPAL_SECRET_NAMES.flatMap(k=>JSON.parse(original[k]||'[]')).filter(x=>x.id.startsWith('bridge-read-'));
const config={name,account_id:ISOLATED_ACCOUNT_ID,main:'../src/workers/ingestion.js',compatibility_date:'2026-07-30',workers_dev:true,routes:[],vars:{ENVIRONMENT_ID:'isolated-test',ACCOUNT_ID:ISOLATED_ACCOUNT_ID},services:[{binding:'CORE_COMMAND',service:'openpq-intelligence-core-isolated-test'}],triggers:{crons:['*/4 * * * *']}};
try{
 if(mode==='activate'){
  const baseline=JSON.parse(await readFile(root+'domain-evidence.json','utf8'));requireThat(baseline.status==='REAL_CLOUD_CONTINUOUS_REFERENCE_SUBSET_PASS'&&baseline.cleanup==='SUCCESS','INGEST_BASELINE_NOT_VERIFIED');
  const entries=[],actors=[];let i=0;
  for(const [dataset,profile] of Object.entries(profiles)){
   if(!isContinuousProfile(profile))continue;
   const authority=authorities[dataset],actor_id=profile.operator_principal_ids[0],token=randomBytes(32).toString('hex');console.log('::add-mask::'+token);
   actors.push({...authority,id:actor_id,token,mode:'LIVE',owner:'bridge-owner',epoch:1,permissions:['read','promote','export','domain-source-admit']});
   entries.push(['INGEST_DATASET_'+(++i),JSON.stringify({authority,profile,actor_id,token})]);
  }
  requireThat(i===10&&entries.every(([,v])=>Buffer.byteLength(v)<=5000),'INGEST_CONFIG_SIZE_DENIED');
  await writeFile(root+'ingestion.json',JSON.stringify(config));
  await writeFile(root+'ingestion-secrets.private.json',JSON.stringify(Object.fromEntries(entries)),{mode:0o600});
  await writeFile(root+'ingestion-actors.private.json',JSON.stringify(principalSecrets([...readers,...actors])),{mode:0o600});
  // Grant narrow actors first; the old broad tokens remain invalid.
  command(['secret','bulk',root+'ingestion-actors.private.json','--config',root+'core.json']);command(['deploy','--config',root+'core.json']);
  command(['deploy','--config',root+'ingestion.json']);command(['secret','bulk',root+'ingestion-secrets.private.json','--config',root+'ingestion.json']);command(['deploy','--config',root+'ingestion.json']);
  const report={status:'SCHEDULED_REFERENCE_INGESTION_OBSERVING',activated_at:new Date().toISOString(),code_sha:process.env.GITHUB_SHA,run_id:process.env.GITHUB_RUN_ID,cron:'*/4 * * * *',dataset_count:10,actor_permissions:['read','promote','export','domain-source-admit'],production_enabled:false,operational_action_allowed:false,whole_brain_production_ready:false,observations:[]};await save(report);
 }else if(mode==='observe'){
  const report=JSON.parse(await readFile(root+'ingestion-evidence.public.json','utf8')),entries=Object.values(JSON.parse(await readFile(root+'ingestion-secrets.private.json','utf8'))).map(x=>JSON.parse(x));
  const reader=new S3ReadonlyReader(JSON.parse(JSON.parse(await readFile(root+'runtime-secrets.json','utf8')).S3_READONLY_CONFIG));
  const first=entries[0];
  const call=async(entry,path,body)=>{const r=await fetch(origins.core+'/datasets/'+entry.authority.dataset_id+'/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+entry.token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(15000)});return {status:r.status,body:await r.json()};};
  await waitForCapabilityStatus(()=>call(first,'read'),200,{failureCode:'INGEST_NARROW_ACTOR_NOT_ACTIVE'});
  for(const path of ['bootstrap','control'])requireThat((await call(first,path,{})).status===403,'INGEST_PRIVILEGE_DENIAL_NOT_OBSERVED');
  const cross=await call({...first,authority:entries[1].authority},'read');requireThat(cross.status===403,'INGEST_CROSS_DATASET_DENIAL_NOT_OBSERVED');
  const old=await fetch(origins.core+'/datasets/'+first.authority.dataset_id+'/read',{headers:{authorization:'Bearer '+tokens[first.authority.dataset_id].operator}});requireThat(old.status===401,'INGEST_OLD_OPERATOR_STILL_VALID');
  const schedule=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ISOLATED_ACCOUNT_ID+'/workers/scripts/'+name+'/schedules',{headers:{authorization:'Bearer '+process.env.CF_TEST_API_TOKEN},redirect:'error'});const schedules=await schedule.json();requireThat(schedule.ok&&schedules.success&&schedules.result.schedules?.some(x=>x.cron===config.triggers.crons[0]),'INGEST_CRON_NOT_CONFIGURED');
  report.capability_denials={bootstrap:403,control:403,cross_dataset:403,old_operator:401};report.cloudflare_cron_confirmed=true;await save(report);
  const deadline=Date.now()+660000;
  while(Date.now()<deadline){
   const observations=[];
   for(const entry of entries){
    const r=await fetch(origins.runtime+'/datasets/'+entry.authority.dataset_id,{redirect:'error',signal:AbortSignal.timeout(15000)}),v=await r.json();
    observations.push({dataset_id:entry.authority.dataset_id,status:r.status,revision:v.receipt?.revision??null,receipt_digest:v.receipt?.digest??null,profile_hash:v.receipt?.semantic_admission?.profile_hash??null,source_time:v.receipt?.semantic_admission?.source_version_time??null,valid_until:v.receipt?.semantic_admission?.valid_until??null,authority:v.serving?.authority??null,eligibility:v.serving?.decision_eligibility??null});
   }
   report.observations.push({at:new Date().toISOString(),datasets:observations});await save(report);
   if(Date.now()-Date.parse(report.activated_at)>300000&&observations.every(x=>x.status===200&&x.revision>=4&&x.authority==='VERIFIED'&&x.eligibility==='ABSTAIN'&&x.profile_hash===authorities[x.dataset_id].semantic_profile_hash&&Date.parse(x.valid_until)>Date.parse(report.activated_at)+600000)){
    const signed=[];
    for(const item of observations){const trust=authorities[item.dataset_id],envelope=JSON.parse(await reader.get(`checkpoints/${trust.authority_instance_id}/${trust.recovery_generation}/latest.json`));const receipt=await verifyAttestation(envelope,trust),generation=JSON.parse(await reader.get(receipt.key));requireThat(receipt.revision>=4&&generation.semantic_profile_hash===trust.semantic_profile_hash&&Date.parse(generation.evaluation_time)>Date.parse(report.activated_at)+300000,'INGEST_SIGNED_REFRESH_AFTER_INITIAL_EXPIRY_NOT_PROVEN');signed.push({dataset_id:item.dataset_id,revision:receipt.revision,receipt_digest:receipt.digest,evaluation_time:generation.evaluation_time,valid_to:generation.valid_to,source_time:generation.inputs[0].source_time,source_digest:generation.semantic_admission.input_hash,signature_verified:true});}
    report.signed_readback=signed;report.status='REAL_SCHEDULED_REFERENCE_INGESTION_SUBSET_PASS';report.completed_at=new Date().toISOString();await save(report);console.log(report.status);break;
   }
   await new Promise(resolve=>setTimeout(resolve,15000));
  }
  requireThat(report.status==='REAL_SCHEDULED_REFERENCE_INGESTION_SUBSET_PASS','INGEST_SCHEDULED_PUBLICATION_NOT_PROVEN',503);
 }else if(mode==='cleanup'){
  let report;try{report=JSON.parse(await readFile(root+'ingestion-evidence.public.json','utf8'));}catch{}
  if(report?.status==='REAL_SCHEDULED_REFERENCE_INGESTION_SUBSET_PASS'){report.cleanup='TEMPORARY_OPERATORS_REVOKED_NARROW_INGESTION_RETAINED';await save(report);}
  else{
   // Failed activation must not leave an unattended writer behind.
   await writeFile(root+'ingestion-close.private.json',JSON.stringify(principalSecrets(readers)),{mode:0o600});command(['secret','bulk',root+'ingestion-close.private.json','--config',root+'core.json']);command(['deploy','--config',root+'core.json']);
   if(await readFile(root+'ingestion.json','utf8').catch(()=>null)){config.triggers.crons=[];await writeFile(root+'ingestion.json',JSON.stringify(config));command(['deploy','--config',root+'ingestion.json']);}
   await save({...report,status:'SCHEDULED_REFERENCE_INGESTION_FAILED_CLOSED',cleanup:'INGESTION_ACTORS_REVOKED_CRON_DISABLED',production_enabled:false,whole_brain_production_ready:false});
  }
 }else throw new ContractError('INGEST_ACTIVATION_MODE_INVALID');
}catch(e){console.error(e instanceof ContractError?e.code:'INGEST_ACTIVATION_FAILED');process.exitCode=1;}
