import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {preparationFixture,syntheticLocator,AT,SCOPE} from '../../src/fixtures/preparation.js';
import {hash,report,stable} from '../../src/preparation/common.js';
import {prepareShadow} from '../../src/preparation/pipeline.js';
import {adapterPlan,exerciseAdapter} from '../../src/preparation/adapter.js';
import {DurableQueue,queuePolicy,drainTick} from './durable-queue.js';
import {monitor,compareShadow,cutoverReadiness} from '../../src/preparation/operations.js';
import {buildBackup,verifyBackup,restorePlan,retentionPlan} from '../../src/preparation/recovery.js';
import {authorizeOperator} from '../../src/preparation/operator-security.js';
import {blockedPolicies,policySet,policyReadiness} from '../../src/preparation/policies.js';
export async function rehearse(){
 const f=await preparationFixture(),prepared=await prepareShadow(f),plan=adapterPlan({adapter_id:'synthetic',environment_id:'local-test',source_id:'synthetic-manual',origin:'https://synthetic.invalid',path:'/fixture.json',credential_reference:null,response_type:'json'},f.policies,'local-test',SCOPE);
 const adapter=await exerciseAdapter(plan,async()=>Response.json({fixture:true}));
 const d=await mkdtemp(join(tmpdir(),'openpq-rehearsal-'));let q,clock=Date.parse(AT),calls=0,queue;
 try{
  const file=join(d,'queue.sqlite'),policy=queuePolicy(f.policies,SCOPE);q=await DurableQueue.open(file,policy);
  const job={id:'synthetic-shadow-one',kind:'PREPARE_SHADOW',expires_at:'2026-10-01T13:00:00Z',payload:{input_hash:prepared.input_hash}};await q.enqueue(job,clock);const dedup=await q.enqueue(job,clock);
  const handler=async()=>{calls++;if(calls===1)throw new Error('synthetic failure');await prepareShadow(f);};
  const first=await drainTick(q,{PREPARE_SHADOW:handler},()=>clock);q.close();q=await DurableQueue.open(file,policy);clock+=100;const second=await drainTick(q,{PREPARE_SHADOW:handler},()=>clock);queue={dedup,first,second,after_restart:q.snapshot(clock),handler_calls:calls};
 }finally{q?.close();await rm(d,{recursive:true,force:true});}
 const observed={runtime_status:200,sources:[{source_id:'synthetic',source_time:AT,valid_to:'2026-10-01T13:00:00Z'}],last_progress_at:AT,pending_count:0,checkpoint_at:AT};
 const monitoring=monitor(observed,f.policies,SCOPE,AT),stale_monitoring=monitor({...observed,last_progress_at:null},f.policies,SCOPE,AT);
 const item={scope:f.target_scope,evaluation_time:AT,payload:{value:false,number:0}},parity=compareShadow(item,item,f.policies,SCOPE);
 const authority=syntheticLocator(),control={...authority,revision:0,control_revision:0,epoch:1,active:null,overrides:[]};
 const backup=await buildBackup({environment_id:'local-test',authority,created_at:AT,watermark:{revision:0,control_revision:0},required_keys:['control','registry'],records:[{key:'control',kind:'CONTROL',content:control},{key:'registry',kind:'REGISTRY',content:{artifacts:f.registry.snapshot}},...['AUDIT','GENERATION','RECEIPT','SCHEDULER','DEPLOY'].map(kind=>({key:kind.toLowerCase(),kind,content:kind==='SCHEDULER'?queue.after_restart:{fixture:true}}))]});
 const backup_integrity=await verifyBackup(backup),next={...authority,recovery_generation:'generation-2',receipt_keys:{next:{kty:'EC',crv:'P-256',x:'synthetic-new',y:'synthetic-new'}}};
 const recovery=await restorePlan(backup,next,{old_epoch_high_watermark:1,evaluation_time:AT});
 const retention=retentionPlan([{key:'active',created_at:'2026-10-01T00:00:00Z',pins:['active-receipt']},{key:'orphan',created_at:'2026-10-01T00:00:00Z',pins:[]}],f.policies,SCOPE,AT);
 const config={environment_id:'local-test',origin:'https://operator.invalid',issuer:'synthetic-issuer',audience:'synthetic-console',session_max_ms:60000,roles:{operator:['FREEZE']}};
 const session={environment_id:'local-test',issuer:config.issuer,audience:config.audience,signature_verified:true,revoked:false,actor_id:'synthetic-actor',role:'operator',datasets:[SCOPE],issued_at:AT,expires_at:'2026-10-01T12:01:00Z',csrf_hash:'a'.repeat(64)};
 const operator_guard=await authorizeOperator({method:'POST',origin:config.origin,csrf_hash:session.csrf_hash,action:'FREEZE',reason:'Local protection fixture',command_id:'fixture-freeze',dataset_id:SCOPE},session,config,f.policies,AT);
 const required=['primitive','domain_policy','source_license','golden_corpus','shadow_cycles','recovery_drill','operator_security','budget_measurement','consumer_compatibility','rollback_rehearsal'];
 const unresolved=await policySet(blockedPolicies('local-test',SCOPE),'local-test',AT);
 const result=report('LOCAL_TECHNICAL_REHEARSAL_PASS',{environment_id:'local-test',evaluation_time:AT,input_kind:'SYNTHETIC_ONLY',prepared,adapter,queue,monitoring,stale_monitoring,parity,backup_integrity,recovery,retention,operator_guard,unresolved_policies:policyReadiness(unresolved),cutover:cutoverReadiness({},required),cloud_scheduler_connected:false,live_candidate_admission_integrated:false,sso_provider_connected:false,offsite_backup_proven:false,g1:'NOT_PASSED',g2:'NOT_PASSED'});
 return {report:{...result,report_hash:await hash(result)},backup,registry:f.registry.snapshot,policies:f.policy_inputs};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const out=resolve(process.argv[2]||'.preparation');await mkdir(out,{recursive:true});const data=await rehearse();for(const [name,value] of Object.entries(data))await writeFile(join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');console.log('PASS: local technical rehearsal; cloud/live gates remain closed');
}
