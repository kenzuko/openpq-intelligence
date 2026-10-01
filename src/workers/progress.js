import {DurableObject} from 'cloudflare:workers';
import {ContractError,hash,instant,requireThat,stable,text} from '../platform/contracts.js';
import {policySet} from '../preparation/policies.js';
import {queuePolicy} from '../preparation/queue-policy.js';
// Local workerd proof only. No namespace/binding is provisioned by existing cloud workflows.
export class ProgressScheduler extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS progress_jobs(id TEXT PRIMARY KEY,digest TEXT NOT NULL,body TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL,due INTEGER NOT NULL,deadline INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS progress_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);');}
 async config(){
  requireThat(this.env.ENVIRONMENT_ID==='local-test','PROGRESS_CLOUD_ACTIVATION_CLOSED',503);
  const c=JSON.parse(this.env.PROGRESS_CONFIG_JSON||'{}');requireThat(c.enabled===true&&c.environment_id==='local-test','PROGRESS_CONFIG_BLOCKED',503);text(c.dataset_id,'DATASET');
  const policies=await policySet(c.policies,'local-test',new Date().toISOString());requireThat(await hash(c)===this.env.PROGRESS_CONFIG_HASH,'PROGRESS_CONFIG_PIN_MISMATCH');
  const policy=queuePolicy(policies,c.dataset_id);requireThat(this.env.EXPORT_ONLY_TOKEN&&this.env.SCHEDULER_TOKEN_HASH,'PROGRESS_CAPABILITY_MISSING',503);
  this.ctx.storage.transactionSync(()=>{const row=this.ctx.storage.sql.exec('SELECT value FROM progress_meta WHERE key=?','config_hash').toArray()[0];if(row)requireThat(row.value===this.env.PROGRESS_CONFIG_HASH,'PROGRESS_POLICY_MIGRATION_REQUIRED',409);else this.ctx.storage.sql.exec('INSERT INTO progress_meta VALUES(?,?)','config_hash',this.env.PROGRESS_CONFIG_HASH);});return {c,policy};
 }
 async fetch(request){try{
  const {c,policy}=await this.config();requireThat(request.headers.get('authorization')?.startsWith('Bearer '),'PROGRESS_AUTH_DENIED',401);requireThat(await hash(request.headers.get('authorization')?.replace(/^Bearer /,'')||'')===this.env.SCHEDULER_TOKEN_HASH,'PROGRESS_AUTH_DENIED',401);
  const path=new URL(request.url).pathname;
  if(path==='/status'&&request.method==='GET')return Response.json({jobs:this.rows(),alarm_at:await this.ctx.storage.getAlarm(),production_enabled:false,cloud_activation:false});
  if(path==='/tick'&&request.method==='POST')return Response.json(await this.tick());
  requireThat(path==='/enqueue'&&request.method==='POST','NOT_FOUND',404);
  const reader=request.body?.getReader();requireThat(reader,'PROGRESS_BODY_REQUIRED');let size=0,chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;requireThat(size<=4096,'PROGRESS_BODY_TOO_LARGE',413);chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}const job=JSON.parse(new TextDecoder().decode(bytes));
  requireThat(Object.keys(job).every(k=>['id','kind','dataset_id','expires_at'].includes(k)),'PROGRESS_JOB_FIELD_DENIED');text(job.id,'JOB_ID');requireThat(job.kind==='EXPORT_CHECKPOINT'&&job.dataset_id===c.dataset_id,'PROGRESS_TASK_DENIED');const now=Date.now(),deadline=instant(job.expires_at,'JOB_EXPIRES');requireThat(deadline>now,'PROGRESS_JOB_EXPIRED');const body=stable(job),digest=await hash(body);
  const result=this.ctx.storage.transactionSync(()=>{const old=this.ctx.storage.sql.exec('SELECT digest,state FROM progress_jobs WHERE id=?',job.id).toArray()[0];if(old){requireThat(old.digest===digest,'PROGRESS_IDEMPOTENCY_CONFLICT',409);return {created:false,state:old.state};}const count=this.ctx.storage.sql.exec("SELECT count(*) AS n FROM progress_jobs WHERE state IN ('PENDING','RUNNING')").toArray()[0].n;requireThat(count<policy.queue_limit,'PROGRESS_BACKPRESSURE',429);this.ctx.storage.sql.exec('INSERT INTO progress_jobs VALUES(?,?,?,?,?,?,?)',job.id,digest,body,'PENDING',0,now,deadline);return {created:true,state:'PENDING'};});
  await this.schedule(policy,now);return Response.json(result);
 }catch(e){return Response.json({error:e instanceof ContractError?e.code:'PROGRESS_UNAVAILABLE'},{status:e instanceof ContractError?e.status:503});}}
 rows(){return this.ctx.storage.sql.exec('SELECT id,state,attempts,due,deadline FROM progress_jobs ORDER BY id LIMIT 100').toArray();}
 async schedule(policy,now){const due=this.ctx.storage.sql.exec("SELECT min(due) AS due FROM progress_jobs WHERE state IN ('PENDING','RUNNING')").toArray()[0].due;if(due!==null)await this.ctx.storage.setAlarm(Math.max(now+policy.request_window_ms,due));}
 async tick(){if(this.tickPromise)return this.tickPromise;this.tickPromise=this.runTick();try{return await this.tickPromise;}finally{this.tickPromise=null;}}
 async runTick(){const {c,policy}=await this.config();const now=Date.now();let budget=this.ctx.storage.sql.exec('SELECT value FROM progress_meta WHERE key=?','window').toArray()[0];budget=budget?JSON.parse(budget.value):{start:now,used:0};if(now-budget.start>=policy.request_window_ms)budget={start:now,used:0};this.ctx.storage.sql.exec("UPDATE progress_jobs SET state='EXPIRED' WHERE state IN ('PENDING','RUNNING') AND deadline<=?",now);
  this.ctx.storage.sql.exec("UPDATE progress_jobs SET state=CASE WHEN attempts>=? THEN 'EXHAUSTED' ELSE 'PENDING' END WHERE state='RUNNING' AND due<=?",policy.retries+1,now);
  const available=Math.max(0,policy.requests-budget.used),rows=this.ctx.storage.sql.exec("SELECT * FROM progress_jobs WHERE state='PENDING' AND due<=? ORDER BY due,id LIMIT ?",now,available).toArray(),results=[];
  // At least once export; Core's existing immutable/idempotent outbox owns publication state.
  for(const row of rows){budget.used++;this.ctx.storage.sql.exec('INSERT INTO progress_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','window',stable(budget));this.ctx.storage.sql.exec("UPDATE progress_jobs SET state='RUNNING',attempts=attempts+1,due=? WHERE id=?",now+policy.lease_ms,row.id);
   let success=false,retryable=true;const controller=new AbortController();let timer;
   try{const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('TIMEOUT'));},policy.timeout_ms);});const r=await Promise.race([this.env.CORE_EXPORT.fetch('https://core/datasets/'+encodeURIComponent(c.dataset_id)+'/export',{method:'POST',headers:{authorization:'Bearer '+this.env.EXPORT_ONLY_TOKEN,'content-type':'application/json'},body:'{}',signal:controller.signal}),timeout]);success=r.status===200;retryable=!([401,403,404,409,422].includes(r.status));await r.body?.cancel();}
   catch{}finally{clearTimeout(timer);controller.abort();}
   const attempts=row.attempts+1,state=success?'DONE':!retryable?'QUARANTINED':attempts>=policy.retries+1?'EXHAUSTED':'PENDING',due=now+Math.min(policy.retry_max_ms,policy.retry_base_ms*2**Math.min(attempts-1,30));this.ctx.storage.sql.exec('UPDATE progress_jobs SET state=?,due=? WHERE id=?',state,due,row.id);results.push({id:row.id,state});
  }
  await this.schedule(policy,Date.now());return {results,publication_changed_by_scheduler:false,production_enabled:false};
 }
 async alarm(){try{await this.tick();}catch{ // Stop on policy/config failure; resumption requires a valid explicit enqueue.
  this.ctx.storage.sql.exec('INSERT INTO progress_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','last_error','POLICY_OR_CONFIG_BLOCKED');
 }}
}
export default {async fetch(request,env){if(env.ENVIRONMENT_ID!=='local-test')return Response.json({error:'PROGRESS_CLOUD_ACTIVATION_CLOSED'},{status:503});return env.PROGRESS.get(env.PROGRESS.idFromName('local-test/progress')).fetch(request);}};
