import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {ACCOUNT,BUCKET,api,mask,mintVerifiedReadCapability} from './transit-r2-capability.js';
import {hash,requireThat,sameLocator,stable} from '../../src/platform/contracts.js';
import {packConfig,TRUST_BINDINGS,PROFILE_REGISTRY_BINDINGS} from '../../src/platform/trusted-config.js';
import {principalSecrets} from './prepare.js';
import {continuousArtifactRefs,validateContinuousProfile} from '../../src/platform/domain-continuous-admission.js';
import {TRANSIT_FACT_PROFILE_VERSION} from '../../src/platform/domain-continuous-contract.js';
import {TRANSIT_FACT_ENVIRONMENT,TRANSIT_FACT_GATE} from '../../src/platform/transit-execution-scope.js';
import {ingestDataset} from '../../src/ingress/domain-feed.js';
import {readTransitConsumer,TRANSIT_CANONICAL_ORIGIN} from '../../src/platform/transit-consumer.js';
const ROOT='.transit-transfer',EVIDENCE='transit-live-proof',DATASET='transit.bridge.phu-quoc';
const names={core:'openpq-intelligence-transit-core',runtime:'openpq-intelligence-transit-runtime',source:'openpq-intelligence-transit-source',consumer:'openpq-intelligence-transit-reader'};
const origin=n=>'https://'+names[n]+'.kenzuko.workers.dev',proof={status:'RUNNING',account_id:ACCOUNT,dataset_id:DATASET,code_sha:process.env.CORE_CODE_SHA,release_sha:process.env.GITHUB_SHA,started_at:new Date().toISOString(),public_app_switched:false,whole_core_production_ready:false,producer_independent:false};
await mkdir(EVIDENCE,{recursive:true});const save=()=>writeFile(EVIDENCE+'/PROOF.json',JSON.stringify(proof,null,2)+'\n');
const pub=(name,value)=>writeFile(EVIDENCE+'/'+name+'.json',JSON.stringify(value,null,2)+'\n');
let trust,entry,readConfig,sourceConfig,readerTouched=false,bootstrapped=false,sourceCronEnabled=false;
async function config(n){return JSON.parse(await readFile(ROOT+'/'+n+'.json','utf8'));}
async function deploy(n,c,secrets){
 requireThat(c.name===names[n]&&c.account_id===ACCOUNT&&Array.isArray(c.routes)&&c.routes.length===0,'TRANSIT_DEPLOY_TARGET_DENIED');
 if(n==='consumer')requireThat(!c.r2_buckets&&!c.durable_objects&&!c.services&&['LEGACY','CANONICAL'].includes(c.vars.TRANSIT_READER_MODE),'TRANSIT_READER_BINDING_DENIED');
 if(n==='runtime')requireThat(!c.r2_buckets&&!c.durable_objects&&c.services?.length===1&&c.services[0].binding==='CORE_READ'&&c.services[0].service===names.core,'TRANSIT_RUNTIME_BINDING_DENIED');
 if(n==='source')requireThat(!c.r2_buckets&&c.services?.length===1&&c.services[0].service===names.core,'TRANSIT_SOURCE_BINDING_DENIED');
 if(secrets)requireThat(Object.values(secrets).every(v=>typeof v==='string'&&Buffer.byteLength(v)<=5000),'TRANSIT_SECRET_SIZE_DENIED');
 await writeFile(ROOT+'/'+n+'.json',JSON.stringify(c));if(secrets)await writeFile(ROOT+'/'+n+'.private.json',JSON.stringify(secrets),{mode:0o600});
 const r=spawnSync('node_modules/.bin/wrangler',['deploy','--config',ROOT+'/'+n+'.json',...(secrets?['--secrets-file',ROOT+'/'+n+'.private.json']:[])],{encoding:'utf8',timeout:90000,env:{...process.env,CLOUDFLARE_API_TOKEN:process.env.CLOUDFLARE_API_TOKEN.trim(),CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false'}});
 if(r.status!==0){let detail=(r.stderr+'\n'+r.stdout).replace(/\x1b\[[0-9;]*m/g,'');for(const value of [...Object.values(secrets??{}),process.env.CLOUDFLARE_API_TOKEN.trim()])if(value)detail=detail.split(value).join('[REDACTED]');proof.deploy_failure={worker:n,detail:detail.slice(-3000)};}requireThat(r.status===0,'TRANSIT_'+n.toUpperCase()+'_DEPLOY_FAILED',503);proof.deployed??=[];proof.deployed.push(n);await save();
}
async function get(url,options={}){return fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000),...options});}
async function wait(check,label,{attempts=18,interval=2000}={}){let last;for(let n=0;n<attempts;n++){try{const value=await check();if(value)return value;}catch(e){last=e.code??'READ_UNAVAILABLE';}if(n+1<attempts)await new Promise(r=>setTimeout(r,interval));}throw Object.assign(Error(label),{code:label,last});}
async function protectedVersions(){return Object.fromEntries(await Promise.all(['openphuquoc-v3','jotrip-airport-live','jotrip-weather-fresh','jotrip-weather-live'].map(async name=>[name,(await api('/accounts/'+ACCOUNT+'/workers/scripts/'+name+'/deployments')).deployments[0].versions])));}
async function call(path,body,token){const r=await get(origin('core')+'/datasets/'+DATASET+'/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const d=await r.json();requireThat(r.ok,d.error??'TRANSIT_COMMAND_DENIED',r.status);return d;}
async function reader(mode){
 const c=await config('consumer');c.vars.TRANSIT_READER_MODE=mode;readerTouched=true;await deploy('consumer',c,{TRANSIT_READER_TRUST_JSON:JSON.stringify(trust)});
 return wait(async()=>{const r=await get(origin('consumer')+'/network.json'),raw=await r.text();if(r.status!==200||r.headers.get('x-openpq-reader')!==mode)return null;requireThat(r.headers.get('x-openpq-source-digest')===await hash(raw)&&r.headers.get('cache-control')==='no-store'&&r.headers.get('access-control-allow-origin')==='*','TRANSIT_LIVE_READER_HEADERS_DENIED');return {mode,checked_at:new Date().toISOString(),source_digest:await hash(raw),receipt_digest:r.headers.get('x-openpq-receipt-digest'),display_expires_at:r.headers.get('x-openpq-display-expires-at'),bytes:Buffer.byteLength(raw)};},'TRANSIT_'+mode+'_READBACK_FAILED');
}
try{
 requireThat(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()===ACCOUNT,'TRANSIT_ACCOUNT_PIN_REQUIRED');
 const ci=await get('https://api.github.com/repos/kenzuko/openpq-intelligence/actions/runs?head_sha='+process.env.CORE_CODE_SHA+'&per_page=20');requireThat(ci.ok,'TRANSIT_PINNED_CI_UNAVAILABLE');const runs=(await ci.json()).workflow_runs;requireThat(runs.some(x=>x.head_sha===process.env.CORE_CODE_SHA&&x.name==='Isolated foundation verification'&&x.status==='completed'&&x.conclusion==='success'),'TRANSIT_PINNED_CI_REQUIRED');
 const existing=await api('/accounts/'+ACCOUNT+'/workers/scripts');requireThat(['core','runtime','source'].every(n=>!existing.some(x=>x.id===names[n])),'TRANSIT_AUTHORITY_ALREADY_EXISTS_RESUME_CHECKPOINT_REQUIRED');
 requireThat(existing.some(x=>x.id===names.consumer),'TRANSIT_ACCEPTED_LEGACY_READER_REQUIRED');const old=await get(origin('consumer')+'/health');requireThat(old.ok&&(await old.json()).reader==='LEGACY','TRANSIT_LEGACY_START_REQUIRED');
 const bucket=await api('/accounts/'+ACCOUNT+'/r2/buckets/'+BUCKET);requireThat(bucket.name===BUCKET&&(bucket.jurisdiction??'default')==='default','TRANSIT_BUCKET_PIN_REQUIRED');proof.protected_before=await protectedVersions();
 readConfig=await mintVerifiedReadCapability(proof);await save();
 const coreConfig=await config('core'),provisionToken=randomBytes(32).toString('hex'),object=TRANSIT_FACT_ENVIRONMENT+'/'+DATASET+'/authority-'+process.env.GITHUB_RUN_ID;mask(provisionToken);
 coreConfig.main='../scripts/cloud/transit-provision-worker.js';coreConfig.vars={...coreConfig.vars,PROVISION_OBJECT_NAME:object};await deploy('core',coreConfig,{PROVISIONING_TOKEN:provisionToken});
 const native=await wait(async()=>{const r=await get(origin('core')+'/probe',{headers:{authorization:'Bearer '+provisionToken}});if(!r.ok)return null;const d=await r.json();return d.object_name===object&&/^[a-f0-9]{64}$/.test(d.native_id)?d:null;},'TRANSIT_NATIVE_PROBE_FAILED');
 const ns=(await api('/accounts/'+ACCOUNT+'/workers/durable_objects/namespaces')).filter(x=>x.script===names.core&&x.class==='DatasetCoordinator');requireThat(ns.length===1,'TRANSIT_NAMESPACE_REQUIRED');
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),pubKey=await crypto.subtle.exportKey('jwk',pair.publicKey),privateKey=await crypto.subtle.exportKey('jwk',pair.privateKey);mask(privateKey.d);
 const profile={contract_version:TRANSIT_FACT_PROFILE_VERSION,environment_id:TRANSIT_FACT_ENVIRONMENT,dataset_id:DATASET,domain:'transit',fixture_only:false,producer:{source_kind:'OWNER_REPOSITORY_SNAPSHOT',repository:'kenzuko/transit-jotrip',path:'data/network.json'},operator_principal_ids:['transit-source'],reference_policy:{lease_ms:300000,max_snapshot_age_ms:86400000,future_skew_ms:0},artifact_refs:{}};profile.artifact_refs=await continuousArtifactRefs(profile);
 trust={account_id:ACCOUNT,environment_id:TRANSIT_FACT_ENVIRONMENT,dataset_id:DATASET,object_name:object,namespace_id:ns[0].id,native_id:native.native_id,authority_instance_id:'transit-'+process.env.GITHUB_RUN_ID,authority_locator_version:'1',recovery_generation:'transit-generation-'+process.env.GITHUB_RUN_ID,artifacts:Object.fromEntries(Object.entries(profile.artifact_refs).map(([k,v])=>[k,v.hash])),receipt_keys:{'transit-key':pubKey},approved_positive_decision_types:[],semantic_profile_hash:await hash(profile)};trust.locator_artifact_hash=await hash(trust);await validateContinuousProfile(profile,trust);
 await pub('TRUST_PUBLIC',trust);await pub('PROFILE_PUBLIC',profile);proof.stage='LOCATOR_PINNED';await save();
 const owner='owner-report-transit',tokens=Object.fromEntries(['bootstrap','source','read'].map(x=>[x,randomBytes(32).toString('hex')]));Object.values(tokens).forEach(mask);
 const actor=(name,permissions)=>({...trust,id:'transit-'+name,token:tokens[name],mode:'LIVE',owner,epoch:1,permissions});
 const principals=[actor('bootstrap',['control','bootstrap','read']),actor('source',['read','promote','export','domain-source-admit']),actor('read',['read'])];
 coreConfig.main='../src/workers/core.js';coreConfig.vars={ENVIRONMENT_ID:TRANSIT_FACT_ENVIRONMENT,ACCOUNT_ID:ACCOUNT,CANONICAL_TRANSIT_GATE:TRANSIT_FACT_GATE};
 await deploy('core',coreConfig,{PROVISIONING_TOKEN:'',...packConfig({[DATASET]:trust},TRUST_BINDINGS),...packConfig({[DATASET]:profile},PROFILE_REGISTRY_BINDINGS),...principalSecrets(principals),RECEIPT_SIGNING_JSON:JSON.stringify({key_id:'transit-key',private_jwk:privateKey})});
 await wait(async()=>{try{return (await call('read',undefined,tokens.read)).state===null;}catch{return false;}},'TRANSIT_CORE_CONFIG_READBACK_REQUIRED');
 await call('bootstrap',{...trust,owner,epoch:1},tokens.bootstrap);bootstrapped=true;proof.stage='NORMAL_AUTHORITY_BOOTSTRAPPED';await save();
 await deploy('runtime',await config('runtime'),{...packConfig({[DATASET]:trust},TRUST_BINDINGS),CONTROL_READ_TOKEN:tokens.read,S3_READONLY_CONFIG:JSON.stringify(readConfig)});
 entry={authority:trust,profile,actor_id:'transit-source',token:tokens.source};sourceConfig=await config('source');await deploy('source',sourceConfig,{TRANSIT_INGEST_CONFIG_JSON:JSON.stringify(entry)});
 const coreClient={fetch:(url,o)=>get(origin('core')+new URL(url).pathname,o)};
 proof.first_admission=await ingestDataset(entry,coreClient);proof.stage='CURRENT_SOURCE_COMMITTED';await save();
 const canonical=await wait(()=>readTransitConsumer({mode:'CANONICAL',origin:TRANSIT_CANONICAL_ORIGIN,trust}),'TRANSIT_RUNTIME_ACCEPTANCE_FAILED');requireThat(canonical.source_digest===proof.first_admission.source_digest,'TRANSIT_RUNTIME_SOURCE_PARITY_FAILED');proof.runtime_acceptance={source_digest:canonical.source_digest,revision:canonical.revision,source_version_time:canonical.source_version_time};
 const view=await (await get(origin('runtime')+'/datasets/'+DATASET)).json(),pointer=view.data?.sources?.[0]?.source_pointer;requireThat(pointer?.repository==='kenzuko/transit-jotrip'&&/^[a-f0-9]{40}$/.test(pointer.commit_sha)&&pointer.path==='data/network.json','TRANSIT_IMMUTABLE_SOURCE_PIN_REQUIRED');
 const source=await get('https://raw.githubusercontent.com/'+pointer.repository+'/'+pointer.commit_sha+'/'+pointer.path);requireThat(source.ok&&await source.text()===canonical.raw,'TRANSIT_EXACT_IMMUTABLE_PARITY_FAILED');await writeFile(EVIDENCE+'/CANONICAL_SOURCE.json',canonical.raw);await pub('FIRST_RUNTIME',view);
 // Enable the source cadence only after source admission and independent Runtime acceptance.
 sourceConfig.triggers={crons:['*/2 * * * *']};await deploy('source',sourceConfig,{TRANSIT_INGEST_CONFIG_JSON:JSON.stringify(entry)});sourceCronEnabled=true;proof.source_cron_enabled=true;await save();
 proof.consumer_switch=await reader('CANONICAL');const before=(await call('read',undefined,tokens.read)).state;
 proof.consumer_rollback=await reader('LEGACY');const after=(await call('read',undefined,tokens.read)).state;requireThat(after.epoch===before.epoch&&after.control_revision===before.control_revision&&after.revision>=before.revision,'TRANSIT_READER_ROLLBACK_MUTATED_AUTHORITY');proof.authority_rollback={epoch_before:before.epoch,epoch_after:after.epoch,revision_before:before.revision,revision_after:after.revision,control_revision_unchanged:true};
 proof.consumer_reactivated=await reader('CANONICAL');proof.denied_methods=[];for(const method of ['POST','PUT','DELETE']){const r=await get(origin('consumer')+'/network.json',{method});proof.denied_methods.push({method,status:r.status});requireThat(r.status===405,'TRANSIT_PUBLIC_WRITER_DENIAL_FAILED');}
 const unauth=await get(origin('core')+'/datasets/'+DATASET+'/read');requireThat(unauth.status===401,'TRANSIT_UNAUTH_READ_NOT_DENIED');proof.unauthenticated_core_read=unauth.status;
 const cron=await wait(async()=>{const r=await get(origin('source')+'/health');if(!r.ok)return null;const d=await r.json();return d.observation?.status==='PUBLISHED_REFERENCE'&&d.observation.revision>proof.first_admission.revision?d.observation:null;},'TRANSIT_ACTUAL_CRON_REFRESH_NOT_OBSERVED',{attempts:40,interval:4000});proof.actual_source_cron_refresh=cron;
 const current=await readTransitConsumer({mode:'CANONICAL',origin:TRANSIT_CANONICAL_ORIGIN,trust});requireThat(current.revision>=cron.revision,'TRANSIT_CRON_RUNTIME_REVISION_NOT_CURRENT');proof.current_runtime={revision:current.revision,source_digest:current.source_digest,source_version_time:current.source_version_time,display_expires_at:current.display_expires_at};proof.source_version_advanced=current.source_digest!==proof.first_admission.source_digest;
 proof.protected_after=await protectedVersions();requireThat(stable(proof.protected_before)===stable(proof.protected_after),'TRANSIT_PROTECTED_WORKER_VERSION_CHANGED');proof.status='CANONICAL_TRANSIT_FACT_GATEWAY_ACTIVE_PUBLIC_APP_PENDING';proof.stage='SCOPED_GATEWAY_ACCEPTED';
}catch(e){proof.status='TRANSIT_ACTIVATION_NOT_ACCEPTED';proof.error=e.code??(/^[A-Z0-9_]+$/.test(e.message)?e.message:'TRANSIT_ACTIVATION_FAILED');proof.bootstrapped=bootstrapped;if(sourceCronEnabled){try{sourceConfig.triggers={crons:[]};await deploy('source',sourceConfig,{TRANSIT_INGEST_CONFIG_JSON:JSON.stringify(entry)});proof.source_cron_enabled=false;proof.failure_source_paused=true;}catch{proof.failure_source_paused=false;}}if(readerTouched&&trust){try{proof.failure_reader_rollback=await reader('LEGACY');}catch{proof.failure_reader_rollback='UNVERIFIED';}}}
proof.finished_at=new Date().toISOString();await save();console.log(JSON.stringify({status:proof.status,error:proof.error??null,source_cron_enabled:proof.source_cron_enabled??false,public_app_switched:false}));if(proof.status!=='CANONICAL_TRANSIT_FACT_GATEWAY_ACTIVE_PUBLIC_APP_PENDING')process.exitCode=1;
