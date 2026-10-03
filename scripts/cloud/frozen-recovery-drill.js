import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {hash,requireThat,stable} from '../../src/platform/contracts.js';
import {verifyAuthoritySnapshot} from '../../src/platform/authority-snapshot.js';
import {RECOVERY_BOOTSTRAP_VERSION} from '../../src/platform/recovery-bootstrap.js';
import {cloudPreflight,BUCKET,WORKERS} from './preflight.js';
import {principalSecrets} from './prepare.js';
import {S3ReadonlyReader} from '../../src/platform/s3-reader.js';

const ACCOUNT='c61a28455fe22f30619b35dd80c2d495';
export const DRILL_WORKERS=['openpq-intelligence-recovery-source-test','openpq-intelligence-recovery-target-test'];
const root='.recovery-cloud',iso=()=>new Date().toISOString();
const report={status:'RUNNING',code_sha:process.env.GITHUB_SHA,run_id:process.env.GITHUB_RUN_ID,started_at:iso(),g1:'NOT_PASSED',production_enabled:false,writer_resumed:false,r2_s3_write_credential_revocation_proven:false,external_artifact_restore_proven:false,offsite_restore_proven:false,cases:[],cleanup:{status:'NOT_STARTED'}};
const save=()=>writeFile(root+'/PROOF.json',JSON.stringify(report,null,2)+'\n');
const check=async(name,fn)=>{const at=Date.now();try{const observation=await fn();report.cases.push({name,status:'PASS',elapsed_ms:Date.now()-at,...(observation?{observation}:{})});}catch(e){report.cases.push({name,status:'FAIL',error:e.code||'DRILL_ASSERTION_FAILED'});throw e;}finally{await save();}};
const token=()=>{const v=randomBytes(32).toString('hex');if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+v);return v;};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const api=async(path,method='GET')=>{requireThat(path.startsWith('/accounts/'+ACCOUNT+'/'),'DRILL_API_SCOPE_FORBIDDEN');const r=await fetch('https://api.cloudflare.com/client/v4'+path,{method,headers:{authorization:'Bearer '+process.env.CF_TEST_API_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});if(method==='DELETE'&&r.status===404)return null;requireThat(r.ok,'DRILL_API_HTTP_'+r.status);const b=await r.json();requireThat(b.success===true,'DRILL_API_FAILED');return b.result;};
const base='/accounts/'+ACCOUNT;
const wrangler=args=>{const r=spawnSync('node_modules/.bin/wrangler',args,{encoding:'utf8',env:{...process.env,CLOUDFLARE_API_TOKEN:process.env.CF_TEST_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false'}});if(r.status!==0){console.error((r.stderr||r.stdout).slice(-2000));throw Error('DRILL_WRANGLER_FAILED');}};
const deploy=async(config,secrets)=>{requireThat(DRILL_WORKERS.includes(config.name)&&config.account_id===ACCOUNT&&config.routes.length===0,'DRILL_DEPLOY_SCOPE_FORBIDDEN');const p=root+'/'+config.name;await writeFile(p+'.json',JSON.stringify(config));await writeFile(p+'.secrets.json',JSON.stringify(secrets),{mode:0o600});wrangler(['deploy','--config',p+'.json']);wrangler(['secret','bulk',p+'.secrets.json','--config',p+'.json']);};
const request=async(origin,path,credential,body,method)=>{const r=await fetch(origin+path,{method:method||(body===undefined?'GET':'POST'),headers:{authorization:'Bearer '+credential,'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000),...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});let value=null;try{value=await r.json();}catch{}return {status:r.status,body:value};};
const wait=async(fn,accept)=>{let result;for(let i=0;i<30;i++){result=await fn();if(accept(result))return result;if(i<29)await pause(2000);}requireThat(false,'DRILL_PROPAGATION_TIMEOUT');};
const publicFile=(name,value)=>writeFile(root+'/'+name+'.json',JSON.stringify(value,null,2)+'\n');
let preflight,source,target,sourceConfig,targetConfig,created=[];
await mkdir(root,{recursive:true});
try{
 requireThat(process.env.GITHUB_ACTIONS==='true'&&process.env.CF_TEST_ACCOUNT_ID===ACCOUNT&&/^\d{1,24}$/.test(report.run_id||''),'DRILL_GITHUB_ISOLATED_RUN_REQUIRED');
 preflight=await cloudPreflight({accountId:ACCOUNT,productionAccountIds:JSON.parse(process.env.CF_PRODUCTION_ACCOUNT_IDS||'null'),apiToken:process.env.CF_TEST_API_TOKEN,readAccessKey:process.env.R2_TEST_READ_ACCESS_KEY_ID});await publicFile('PREFLIGHT',preflight);
 const dataset='fixture.recovery.'+report.run_id,subdomain=(await api(base+'/workers/subdomain')).subdomain;requireThat(/^[a-z0-9-]+$/.test(subdomain),'DRILL_SUBDOMAIN_INVALID');
 const configs=DRILL_WORKERS.map((name,i)=>({name,account_id:ACCOUNT,main:'../scripts/cloud/recovery-drill-worker.js',compatibility_date:'2026-07-30',workers_dev:true,routes:[],vars:{ENVIRONMENT_ID:'isolated-test',RECOVERY_DRILL_RUN_ID:report.run_id,RECOVERY_DRILL_ROLE:i?'target':'source'},durable_objects:{bindings:[{name:'DATASETS',class_name:'DatasetCoordinator'}]},migrations:[{tag:'recovery-drill-v1',new_sqlite_classes:['DatasetCoordinator']}],r2_buckets:[{binding:'CANONICAL',bucket_name:BUCKET}]}));
 [sourceConfig,targetConfig]=configs;
 const provision=configs.map(()=>token());
 for(let i=0;i<2;i++){created.push(configs[i].name);await deploy(configs[i],{PROVISIONING_TOKEN:provision[i],STORAGE_WRITER_TOKEN:'',...principalSecrets([])});}
 const namespaces=await api(base+'/workers/durable_objects/namespaces');
 const authority=async(i)=>{
  const config=configs[i],origin=`https://${config.name}.${subdomain}.workers.dev`,probe=await wait(()=>request(origin,'/probe',provision[i]),r=>r.status===200&&r.body?.dataset_id===dataset);
  const ns=namespaces.filter(n=>n.script===config.name&&n.class==='DatasetCoordinator');requireThat(ns.length===1,'DRILL_NAMESPACE_AMBIGUOUS');
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),pub=await crypto.subtle.exportKey('jwk',pair.publicKey),priv=await crypto.subtle.exportKey('jwk',pair.privateKey);if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+priv.d);
  const h=await hash({fixture:'cloud-recovery',production_approved:false}),trust={account_id:ACCOUNT,environment_id:'isolated-test',dataset_id:dataset,object_name:probe.body.object_name,namespace_id:ns[0].id,native_id:probe.body.native_id,authority_instance_id:'recovery-'+report.run_id+'-'+(i?'target':'source'),authority_locator_version:i?'2':'1',recovery_generation:'recovery-'+report.run_id+'-'+(i?'new':'old'),artifacts:{rule:h,config:h,policy:h,schema:h},receipt_keys:{[i?'new-key':'old-key']:pub},approved_positive_decision_types:[]};trust.locator_artifact_hash=await hash(trust);
  const tokens={live:token(),read:token(),operator:token(),recovery:token(),storage:token()},epoch=i?8:1,owner=i?'new-drill-owner':'old-drill-owner';
  const principal=(id,permissions)=>({...trust,id,token:tokens[id],permissions,owner,epoch,mode:'LIVE'});
  const principals=[principal('read',['read']),principal('operator',['bootstrap','control','promote','correct','export']),principal('recovery',['recovery-export','recovery-bootstrap']),principal('live',['promote'])];
  return {origin,trust,tokens,owner,epoch,principals,secrets:{TRUST_JSON:JSON.stringify({[dataset]:trust}),RECEIPT_SIGNING_JSON:JSON.stringify({key_id:i?'new-key':'old-key',private_jwk:priv}),...principalSecrets(principals),PROVISIONING_TOKEN:provision[i],STORAGE_WRITER_TOKEN:tokens.storage,RECOVERY_PLANS_JSON:'{}'}};
 };
 source=await authority(0);target=await authority(1);await publicFile('SOURCE_TRUST',source.trust);await publicFile('TARGET_TRUST',target.trust);
 await deploy(sourceConfig,source.secrets);await deploy(targetConfig,target.secrets);
 const call=(s,path,body,id='operator')=>request(s.origin,'/datasets/'+dataset+'/'+path,s.tokens[id],body);
 await wait(()=>call(source,'read',undefined,'read'),r=>r.status===200);
 await wait(()=>call(target,'read',undefined,'read'),r=>r.status===200);
 await check('actual cloud source commit and signed native capture',async()=>{
  requireThat((await call(source,'bootstrap',{...source.trust,owner:source.owner,epoch:1})).status===200,'DRILL_SOURCE_BOOTSTRAP_FAILED');
  const now=Date.now(),c={schema_version:'openpq-candidate-v1',...source.trust,candidate_id:crypto.randomUUID(),expected_revision:0,expected_control_revision:0,logical_slot:10,evaluation_time:new Date(now).toISOString(),valid_from:new Date(now-1000).toISOString(),valid_to:new Date(now+3600000).toISOString(),inputs:[{source_id:'synthetic-cloud-recovery',source_type:'MANUAL',source_time:new Date(now).toISOString(),valid_to:new Date(now+3600000).toISOString(),max_age_ms:3600000}],quality:{completeness:'COMPLETE',resolution:'RESOLVED'},payload:{fixture_only:true,not_real_cano_status:true},operation:'NORMAL',decision:{type:'recovery.fixture',kind:'FACT',effect:'ABSTAIN',action_until:new Date(now+3600000).toISOString(),minimum_evidence_met:false,reason_codes:['CLOUD_RECOVERY_DRILL']}};
  const p=await call(source,'prepare',c,'live');requireThat(p.status===200,'DRILL_SOURCE_PREPARE_FAILED');source.commitBody={...source.trust,command_id:'old-drill-commit',digest:p.body.digest,expires_at:new Date(Date.now()+60000).toISOString()};requireThat((await call(source,'commit',source.commitBody,'live')).status===200,'DRILL_SOURCE_COMMIT_FAILED');
  requireThat((await call(source,'export',{})).status===200,'DRILL_SOURCE_EXPORT_FAILED');
  const snapshot=await call(source,'recovery-export',{},'recovery');requireThat(snapshot.status===200,'DRILL_SOURCE_SNAPSHOT_FAILED');source.snapshot=snapshot.body;await verifyAuthoritySnapshot(source.snapshot,source.trust);await publicFile('SOURCE_SNAPSHOT',source.snapshot);
  return {revision:1,namespace_id:source.trust.namespace_id,native_id:source.trust.native_id};
 });
 await check('disposable storage gateway write works before revocation',async()=>{const result=await request(source.origin,'/storage-write',source.tokens.storage,{fixture_only:true,phase:'baseline'},'PUT');requireThat(result.status===200,'DRILL_STORAGE_BASELINE_FAILED');return result.body;});
 await check('signed snapshot independently reopens through bucket-scoped S3 read',async()=>{
  const stored=await request(target.origin,'/snapshot-archive',target.tokens.storage,JSON.stringify(source.snapshot),'PUT');requireThat(stored.status===200,'DRILL_ARCHIVE_STORE_FAILED');
  const reader=new S3ReadonlyReader({endpoint:`https://${ACCOUNT}.r2.cloudflarestorage.com`,bucket:BUCKET,access_key:process.env.R2_TEST_READ_ACCESS_KEY_ID,secret:process.env.R2_TEST_READ_SECRET_ACCESS_KEY});const raw=await reader.get(stored.body.key);requireThat(raw&&await hash(raw)===stored.body.digest,'DRILL_S3_READBACK_FAILED');await verifyAuthoritySnapshot(JSON.parse(raw),source.trust);return {key:stored.body.key,digest:stored.body.digest,s3_readback_verified:true};
 });
 await check('original source command and gateway write credentials denied with witnesses',async()=>{
  const revokedAt=iso();source.secrets={...source.secrets,...principalSecrets(source.principals.filter(p=>p.id==='read')),STORAGE_WRITER_TOKEN:'',RECEIPT_SIGNING_JSON:'{}'};sourceConfig={...sourceConfig,r2_buckets:[]};await deploy(sourceConfig,source.secrets);
  const command=await wait(()=>call(source,'commit',source.commitBody,'live'),r=>r.status===401||r.status===403),storage=await wait(()=>request(source.origin,'/storage-write',source.tokens.storage,{fixture_only:true,phase:'deny'},'PUT'),r=>r.status===401||r.status===403);
  const read=await call(source,'read',undefined,'read'),write=await request(target.origin,'/storage-write',target.tokens.storage,{fixture_only:true,phase:'positive-witness'},'PUT');requireThat(read.status===200&&write.status===200,'DRILL_FENCING_WITNESS_FAILED');
  const settings=await api(base+'/workers/scripts/'+DRILL_WORKERS[0]+'/settings');requireThat(!settings.bindings.some(b=>b.type==='r2_bucket'),'DRILL_OLD_STORAGE_BINDING_RETAINED');
  return {revoked_at:revokedAt,observed_at:iso(),command_http_status:command.status,command_positive_witness_status:read.status,storage_gateway_http_status:storage.status,storage_gateway_write_witness_status:write.status,old_r2_binding_removed:true,command_credential_fingerprint:await hash(source.tokens.live),storage_gateway_credential_fingerprint:await hash(source.tokens.storage),scope:'APPLICATION_STORAGE_GATEWAY_AND_BINDING_NOT_S3_ACCESS_KEY'};
 });
 await check('new native namespace frozen recovery and redeploy persistence',async()=>{
  const plan={contract_version:RECOVERY_BOOTSTRAP_VERSION,source_authority:source.trust,target_authority_hash:await hash(target.trust),snapshot_digest:await hash(source.snapshot),snapshot_key:'recovery/snapshots/'+report.run_id+'.json',owner:target.owner,old_epoch_high_watermark:7};target.secrets.RECOVERY_PLANS_JSON=JSON.stringify({[dataset]:plan});await publicFile('RECOVERY_PLAN',plan);await deploy(targetConfig,target.secrets);
  const start=Date.now(),restored=await wait(()=>call(target,'recovery-bootstrap',{},'recovery'),r=>r.status===200);requireThat(restored.body.state.frozen&&restored.body.state.epoch===8&&restored.body.state.active===null&&restored.body.state.revision===0,'DRILL_RESTORE_STATE_INVALID');
  const before=await call(target,'read',undefined,'read'),bootMs=Date.now()-start;await deploy({...targetConfig,vars:{...targetConfig.vars,RESTART_MARKER:token()}},target.secrets);
  const after=await wait(()=>call(target,'read',undefined,'read'),r=>r.status===200&&r.body.instance_observation.incarnation_id!==before.body.instance_observation.incarnation_id);requireThat(stable(after.body.state)===stable(before.body.state),'DRILL_RESTART_STATE_CHANGED');
  const blocked=await call(target,'control',{command_id:'unsafe-unfreeze',action:'FREEZE',frozen:false,reason:'cloud gate must remain closed',expected_control_revision:0,expires_at:new Date(Date.now()+60000).toISOString()});requireThat(blocked.body?.error==='RECOVERY_RESUME_GATE_CLOSED','DRILL_RESUME_GATE_BYPASSED');
  const snapshot=await call(target,'recovery-export',{},'recovery');requireThat(snapshot.status===200,'DRILL_TARGET_EXPORT_FAILED');const verified=await verifyAuthoritySnapshot(snapshot.body,target.trust);requireThat(verified.tables.commands.length===0&&verified.tables.outbox.length===0&&verified.tables.audit.length===1,'DRILL_OLD_HISTORY_IMPORTED');await publicFile('TARGET_SNAPSHOT',snapshot.body);await publicFile('TARGET_VERIFICATION',verified.verification);
  return {bootstrap_ms:bootMs,timing_scope:'THIS_SYNTHETIC_CLOUD_DRILL_ONLY_NOT_DOMAIN_SLA',native_incarnation_changed:true,epoch:8,frozen:true,old_history_replayed:false};
 });
 report.status='PASS_CLOUD_FROZEN_NATIVE_RECOVERY_SUBSET';
}catch(e){report.status='BLOCKED_OR_FAILED';report.error=e.code||'DRILL_FAILED';console.error(report.error);process.exitCode=1;}
finally{
 try{
  report.cleanup={status:'RUNNING',workers:[]};await save();
  for(const name of created.reverse()){requireThat(DRILL_WORKERS.includes(name)&&!WORKERS.includes(name),'DRILL_CLEANUP_SCOPE_FORBIDDEN');await api(base+'/workers/scripts/'+name+'?force=true','DELETE');report.cleanup.workers.push({name,deleted:true});await save();}
  if(preflight){const after=await cloudPreflight({accountId:ACCOUNT,productionAccountIds:JSON.parse(process.env.CF_PRODUCTION_ACCOUNT_IDS),apiToken:process.env.CF_TEST_API_TOKEN,readAccessKey:process.env.R2_TEST_READ_ACCESS_KEY_ID});await publicFile('POSTFLIGHT',after);requireThat(stable([...after.workers].sort((a,b)=>a.id.localeCompare(b.id)))===stable([...preflight.workers].sort((a,b)=>a.id.localeCompare(b.id))),'DRILL_WORKER_INVENTORY_CHANGED');requireThat(stable([...after.namespaces].sort((a,b)=>a.id.localeCompare(b.id)))===stable([...preflight.namespaces].sort((a,b)=>a.id.localeCompare(b.id))),'DRILL_NAMESPACE_INVENTORY_CHANGED');}
  report.cleanup.status='SUCCESS';
 }catch(e){report.cleanup.status='FAILED';report.cleanup.error=e.code||'DRILL_CLEANUP_FAILED';process.exitCode=1;}
 report.finished_at=iso();await save();console.log(JSON.stringify({status:report.status,cases:report.cases.length,cleanup:report.cleanup.status,g1:report.g1,writer_resumed:false}));
}
