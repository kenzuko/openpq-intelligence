import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {ContractError,hash,sameLocator,requireThat} from '../../src/platform/contracts.js';
import {ISOLATED_ACCOUNT_ID} from '../../src/platform/domain-bridge-admission.js';
import {validateContinuousProfile} from '../../src/platform/domain-continuous-admission.js';
import {DOMAIN_DATASETS} from '../../src/ingress/domain-source-common.js';
import {principalSecrets} from './prepare.js';
import {waitForCapabilityStatus} from './capability-readiness.js';
import {captureIngestionHealth} from './ingestion-health.js';
import {S3ReadonlyReader} from '../../src/platform/s3-reader.js';
import {verifyAttestation} from '../../src/platform/receipts.js';
import {buildBackup} from '../../src/preparation/recovery.js';
import {savePortableBackup,loadPortableBackup} from '../preparation/portable-backup.js';
const root='.cloud-proof/',mode=process.argv[2],evidenceRoot='evidence/core2-source-feed-20261003/';
const authorities=JSON.parse(await readFile(evidenceRoot+'domain-locators.public.json','utf8')),profiles=JSON.parse(await readFile(evidenceRoot+'domain-profiles.public.json','utf8'));
const baseline=JSON.parse(await readFile(evidenceRoot+'domain-evidence.json','utf8'));
requireThat(baseline.status==='REAL_CLOUD_CONTINUOUS_REFERENCE_SUBSET_PASS'&&baseline.cleanup==='SUCCESS'&&baseline.cases.length===25&&baseline.cases.every(x=>x.status==='PASS'),'FEED_BASELINE_NOT_VERIFIED');
requireThat(Object.values(authorities).every(x=>x.account_id===ISOLATED_ACCOUNT_ID&&x.environment_id==='isolated-test')&&process.env.CF_TEST_ACCOUNT_ID===ISOLATED_ACCOUNT_ID,'FEED_ACCOUNT_PIN_REQUIRED');
const names={core:'openpq-intelligence-core-isolated-test',runtime:'openpq-intelligence-runtime-isolated-test',ingestion:'openpq-intelligence-ingestion-isolated-test'};
const origin=kind=>'https://'+names[kind]+'.openpq-intelligence.workers.dev';
const command=(args,code)=>{const r=spawnSync('node_modules/.bin/wrangler',args,{stdio:'inherit',env:{...process.env,CLOUDFLARE_API_TOKEN:process.env.CF_TEST_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:ISOLATED_ACCOUNT_ID,WRANGLER_SEND_METRICS:'false'}});requireThat(r.status===0,code,503);};
const save=r=>writeFile(root+'feed-evidence.public.json',JSON.stringify(r,null,2)+'\n');
const api=async path=>{const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ISOLATED_ACCOUNT_ID+path,{headers:{authorization:'Bearer '+process.env.CF_TEST_API_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});const b=await r.json();requireThat(r.ok&&b.success,'FEED_INVENTORY_DENIED',503);return b.result;};
const core=async(dataset,path,token,body)=>{const r=await fetch(origin('core')+'/datasets/'+dataset+'/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};
try{
 await mkdir(root,{recursive:true});
 if(mode==='resume'){
  const namespaces=await api('/workers/durable_objects/namespaces');
  requireThat(Object.values(authorities).every(x=>namespaces.some(n=>n.id===x.namespace_id&&n.script===names.core&&n.class==='DatasetCoordinator')),'FEED_NATIVE_NAMESPACE_CHANGED');
  const common={account_id:ISOLATED_ACCOUNT_ID,compatibility_date:'2026-07-30',workers_dev:true,routes:[],vars:{ENVIRONMENT_ID:'isolated-test'}};
  const coreConfig={...common,name:names.core,main:'../src/workers/core.js',durable_objects:{bindings:[{name:'DATASETS',class_name:'DatasetCoordinator'}]},migrations:[{tag:'isolated-v1',new_sqlite_classes:['DatasetCoordinator']}],r2_buckets:[{binding:'CANONICAL',bucket_name:'openpq-intelligence-canonical-isolated-test'}]};
  const runtimeConfig={...common,name:names.runtime,main:'../src/workers/runtime.js',services:[{binding:'CORE_READ',service:names.core}]};
  await writeFile(root+'feed-core.json',JSON.stringify(coreConfig));await writeFile(root+'feed-runtime.json',JSON.stringify(runtimeConfig));
  const readTokens={},readers=[],actors=[],entries={};let index=0;
  const token=()=>{const value=randomBytes(32).toString('hex');console.log('::add-mask::'+value);return value;};
  for(const [dataset,authority] of Object.entries(authorities)){readTokens[dataset]=token();readers.push({...authority,id:'bridge-read-'+(profiles[dataset].domain??'cano'),token:readTokens[dataset],mode:'LIVE',owner:'bridge-owner',epoch:1,permissions:['read']});}
  for(const dataset of Object.values(DOMAIN_DATASETS)){
   const authority=authorities[dataset],profile=profiles[dataset];await validateContinuousProfile(profile,authority);
   const actor_id=profile.operator_principal_ids[0],value=token();actors.push({...authority,id:actor_id,token:value,mode:'LIVE',owner:'bridge-owner',epoch:1,permissions:['read','promote','export','domain-source-admit']});
   entries['INGEST_DATASET_'+(++index)]=JSON.stringify({authority,profile,actor_id,token:value});
  }
  requireThat(index===10&&Object.values(entries).every(x=>Buffer.byteLength(x)<=5000),'FEED_SECRET_CONFIG_DENIED');
  const privateData={readTokens,readers,entries};await writeFile(root+'feed.private.json',JSON.stringify(privateData),{mode:0o600});
  await writeFile(root+'feed-core-actors.private.json',JSON.stringify(principalSecrets([...readers,...actors])),{mode:0o600});
  await writeFile(root+'feed-runtime-read.private.json',JSON.stringify({CONTROL_READ_TOKEN:'',CONTROL_READ_TOKENS_JSON:JSON.stringify(readTokens)}),{mode:0o600});
  await writeFile(root+'feed-source-secrets.private.json',JSON.stringify(entries),{mode:0o600});
  // Only actor bindings rotate. Trust, native objects, signer, registry,
  // control state and all committed generations stay on the proven lineage.
  command(['secret','bulk',root+'feed-core-actors.private.json','--config',root+'feed-core.json'],'FEED_CORE_ACTOR_INSTALL_FAILED');
  command(['deploy','--config',root+'feed-core.json'],'FEED_CORE_BINDING_REFRESH_FAILED');
  const controls=[];
  for(const [dataset,authority] of Object.entries(authorities)){
   await waitForCapabilityStatus(()=>core(dataset,'read',readTokens[dataset]),200,{failureCode:'FEED_READ_ACTOR_NOT_ACTIVE'});
   const state=(await core(dataset,'read',readTokens[dataset])).body.state;
   requireThat(sameLocator(state,authority)&&state.semantic_profile_hash===authority.semantic_profile_hash&&state.owner==='bridge-owner'&&state.epoch===1&&state.revision>=1,'FEED_AUTHORITY_STATE_CHANGED');
   controls.push({dataset_id:dataset,revision:state.revision,profile_hash:state.semantic_profile_hash,native_id:state.native_id,valid_to:state.active?.valid_to??null});
  }
  command(['secret','bulk',root+'feed-runtime-read.private.json','--config',root+'feed-runtime.json'],'FEED_RUNTIME_READ_REFRESH_FAILED');
  command(['deploy','--config',root+'feed-runtime.json'],'FEED_RUNTIME_BINDING_REFRESH_FAILED');
  command(['secret','bulk',root+'feed-source-secrets.private.json','--config',root+'ingestion-patch.json'],'FEED_SOURCE_ACTOR_INSTALL_FAILED');
  command(['deploy','--config',root+'ingestion-patch.json'],'FEED_SOURCE_DEPLOY_FAILED');
  const report={status:'SCHEDULED_FEED_OBSERVING',activated_at:new Date().toISOString(),code_sha:process.env.GITHUB_SHA,run_id:process.env.GITHUB_RUN_ID,authority_rotation:false,signer_rotation:false,dataset_count:10,cron:'*/4 * * * *',reference_lease_ms:300000,production_enabled:false,whole_brain_production_ready:false,controls_before:controls,observations:[]};await save(report);
 }else if(mode==='observe'){
  const privateData=JSON.parse(await readFile(root+'feed.private.json','utf8')),report=JSON.parse(await readFile(root+'feed-evidence.public.json','utf8'));
  const entries=Object.values(privateData.entries).map(x=>JSON.parse(x)),first=entries[0];
  for(const path of ['bootstrap','control'])requireThat((await core(first.authority.dataset_id,path,first.token,{})).status===403,'FEED_BROAD_CAPABILITY_ACCEPTED');
  requireThat((await core(entries[1].authority.dataset_id,'read',first.token)).status===403,'FEED_CROSS_DATASET_ACCEPTED');
  const schedules=(await api('/workers/scripts/'+names.ingestion+'/schedules')).schedules;requireThat(schedules.some(x=>x.cron==='*/4 * * * *'),'FEED_CRON_NOT_CONFIGURED');
  report.capability_denials={bootstrap:403,control:403,cross_dataset:403};report.cloudflare_cron_confirmed=true;await save(report);
  const reader=new S3ReadonlyReader({endpoint:'https://'+ISOLATED_ACCOUNT_ID+'.r2.cloudflarestorage.com',bucket:'openpq-intelligence-canonical-isolated-test',access_key:process.env.R2_TEST_READ_ACCESS_KEY_ID,secret:process.env.R2_TEST_READ_SECRET_ACCESS_KEY});
  const deadline=Date.now()+1440000;
  while(Date.now()<deadline){
   const health=await captureIngestionHealth();
   const r=await fetch(origin('ingestion')+'/health',{redirect:'error',signal:AbortSignal.timeout(15000)}),pump=r.ok?await r.json():{datasets:[]};
   report.observations.push({at:new Date().toISOString(),runtime:health,pump});await save(report);
   console.log(JSON.stringify({verified:health.datasets.filter(x=>x.healthy).length,revisions:health.datasets.map(x=>x.revision),source_results:pump.datasets.map(x=>[x.dataset_id,x.observation?.status??null,x.observation?.error??null])}));
   const newPublications=health.datasets.every(x=>x.healthy&&x.revision>report.controls_before.find(b=>b.dataset_id===x.dataset_id).revision&&x.profile_hash===authorities[x.dataset_id].semantic_profile_hash);
   const genuineCron=pump.code_sha===process.env.GITHUB_SHA&&pump.datasets.length===10&&pump.datasets.every(x=>x.observation?.status==='PUBLISHED_REFERENCE'&&Date.parse(x.observation.at)>Date.parse(report.activated_at));
   if(newPublications&&genuineCron){
    const proofs=[];
    for(const item of health.datasets){
     const trust=authorities[item.dataset_id],state=(await core(item.dataset_id,'read',privateData.readTokens[item.dataset_id])).body.state;
     requireThat(sameLocator(state,trust)&&state.semantic_profile_hash===trust.semantic_profile_hash,'FEED_CONTROL_LINEAGE_CHANGED');
     const envelope=JSON.parse(await reader.get(`checkpoints/${trust.authority_instance_id}/${trust.recovery_generation}/receipts/${state.active.revision}.json`));const receipt=await verifyAttestation(envelope,trust),raw=await reader.get(receipt.key),generation=JSON.parse(raw);
     requireThat(receipt.digest===state.active.digest&&await hash(raw)===receipt.digest&&generation.semantic_profile_hash===trust.semantic_profile_hash&&generation.decision.effect==='ABSTAIN'&&generation.semantic_admission.source_policies_activated===false&&Date.parse(generation.evaluation_time)>Date.parse(report.activated_at),'FEED_SIGNED_SCHEDULED_REFERENCE_NOT_PROVEN');
     const backup=await buildBackup({environment_id:'isolated-test',authority:trust,created_at:new Date().toISOString(),watermark:{revision:state.revision,control_revision:state.control_revision},required_keys:['control','receipt',receipt.key],records:[{key:'control',kind:'CONTROL',content:state},{key:'receipt',kind:'RECEIPT',content:envelope},{key:receipt.key,kind:'GENERATION',content:generation},...['AUDIT','REGISTRY','SCHEDULER','DEPLOY'].map(kind=>({key:kind.toLowerCase(),kind,content:{publication_subset_only:true,full_authoritative_export:false,code_sha:process.env.GITHUB_SHA}}))]});
     const dest=root+'scheduled-backups/'+profiles[item.dataset_id].domain;await savePortableBackup(backup,trust,dest);const verified=(await loadPortableBackup(dest,trust)).verification;requireThat(verified.publication_receipt_authenticity_verified,'FEED_PORTABLE_SIGNATURE_FAILED');
     proofs.push({dataset_id:item.dataset_id,revision:receipt.revision,receipt_digest:receipt.digest,profile_hash:trust.semantic_profile_hash,native_id:trust.native_id,evaluation_time:generation.evaluation_time,valid_to:generation.valid_to,source_time:generation.inputs[0].source_time,source_digest:generation.semantic_admission.input_hash,signature_verified:true,portable_backup_verified:true});
    }
    report.signed_readback=proofs;report.status='REAL_SCHEDULED_REFERENCE_FEED_SUBSET_PASS';report.completed_at=new Date().toISOString();report.continuous_uptime_proven=false;report.actual_observed_cron_cycles=1;await save(report);console.log(report.status);break;
   }
   await new Promise(resolve=>setTimeout(resolve,15000));
  }
  requireThat(report.status==='REAL_SCHEDULED_REFERENCE_FEED_SUBSET_PASS','FEED_UNATTENDED_PUBLICATION_NOT_PROVEN',503);
 }else if(mode==='cleanup'){
  let report;try{report=JSON.parse(await readFile(root+'feed-evidence.public.json','utf8'));}catch{}
  if(report?.status==='REAL_SCHEDULED_REFERENCE_FEED_SUBSET_PASS'){report.cleanup='TEMPORARY_OPERATORS_CLOSED_NARROW_FEED_RETAINED';await save(report);}
  else if(await readFile(root+'feed.private.json','utf8').catch(()=>null)){
   const data=JSON.parse(await readFile(root+'feed.private.json','utf8'));await writeFile(root+'feed-close.private.json',JSON.stringify(principalSecrets(data.readers)),{mode:0o600});command(['secret','bulk',root+'feed-close.private.json','--config',root+'feed-core.json'],'FEED_FAILURE_ACTOR_CLOSE_FAILED');command(['deploy','--config',root+'feed-core.json'],'FEED_FAILURE_BINDING_REFRESH_FAILED');
   const c=JSON.parse(await readFile(root+'ingestion-patch.json','utf8'));c.triggers.crons=[];await writeFile(root+'ingestion-patch.json',JSON.stringify(c));command(['deploy','--config',root+'ingestion-patch.json'],'FEED_FAILURE_CRON_CLOSE_FAILED');await save({...report,status:'SCHEDULED_FEED_FAILED_CLOSED',cleanup:'SOURCE_ACTORS_REVOKED_CRON_DISABLED',production_enabled:false,whole_brain_production_ready:false});
  }
 }else throw new ContractError('FEED_MODE_INVALID');
}catch(e){console.error(e instanceof ContractError?e.code:'FEED_RESUME_FAILED');process.exitCode=1;}
