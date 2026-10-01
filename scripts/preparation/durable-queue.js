import {DatabaseSync} from 'node:sqlite';
import {closedEnvironment,clone,hash,instant,integer,noSecrets,report,requireThat,stable,text} from '../../src/preparation/common.js';
export {queuePolicy} from '../../src/preparation/queue-policy.js';
// Local durable execution proof; this database is not a Cloudflare authority store.
export class DurableQueue {
 static async open(path,policy){const q=new DurableQueue(path,policy);const fingerprint=await hash(policy);const prior=q.db.prepare('SELECT value FROM meta WHERE key=?').get('policy_hash');if(prior){if(prior.value!==fingerprint){q.close();throw new Error('QUEUE_POLICY_MIGRATION_REQUIRED');}}else q.db.prepare('INSERT INTO meta VALUES(?,?)').run('policy_hash',fingerprint);return q;}
 constructor(path,policy){closedEnvironment(policy.environment_id);for(const k of ['requests','concurrency','timeout_ms','queue_limit','lease_ms','retry_base_ms','retry_max_ms','request_window_ms'])integer(policy[k],k,1);integer(policy.retries,'retries');requireThat(policy.lease_ms>policy.timeout_ms&&policy.retry_max_ms>=policy.retry_base_ms,'QUEUE_POLICY_RELATION_INVALID');this.policy=clone(policy);this.db=new DatabaseSync(path);this.db.exec('PRAGMA busy_timeout=1000; CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,digest TEXT NOT NULL,body TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL,due INTEGER NOT NULL,deadline INTEGER NOT NULL,lease_until INTEGER,lease_token TEXT,last_error TEXT);');}
 close(){this.db.close();}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 async enqueue(job,now){text(job.id,'JOB_ID');text(job.kind,'JOB_KIND');noSecrets(job);const deadline=instant(job.expires_at,'JOB_EXPIRES');requireThat(Number.isSafeInteger(now)&&deadline>now,'JOB_EXPIRED');const body=stable(job);requireThat(new TextEncoder().encode(body).length<=16384,'JOB_TOO_LARGE');const digest=await hash(body);
  return this.transaction(()=>{const prior=this.db.prepare('SELECT digest,state FROM jobs WHERE id=?').get(job.id);if(prior){requireThat(prior.digest===digest,'JOB_IDEMPOTENCY_CONFLICT');return {created:false,state:prior.state};}const n=this.db.prepare("SELECT count(*) AS n FROM jobs WHERE state IN ('PENDING','RUNNING')").get().n;requireThat(n<this.policy.queue_limit,'QUEUE_BACKPRESSURE');this.db.prepare('INSERT INTO jobs(id,digest,body,state,attempts,due,deadline) VALUES(?,?,?,?,?,?,?)').run(job.id,digest,body,'PENDING',0,now,deadline);return {created:true,state:'PENDING'};});
 }
 claim(now){requireThat(Number.isSafeInteger(now),'QUEUE_CLOCK_REQUIRED');return this.transaction(()=>{
  this.db.prepare("UPDATE jobs SET state='EXPIRED',lease_token=NULL,lease_until=NULL WHERE state IN ('PENDING','RUNNING') AND deadline<=?").run(now);
  this.db.prepare("UPDATE jobs SET state=CASE WHEN attempts>=? THEN 'EXHAUSTED' ELSE 'PENDING' END,lease_token=NULL,lease_until=NULL,last_error='LEASE_LOST',due=? WHERE state='RUNNING' AND lease_until<=?").run(this.policy.retries+1,now,now);
  const budgetRow=this.db.prepare('SELECT value FROM meta WHERE key=?').get('budget_window');let budget=budgetRow?JSON.parse(budgetRow.value):{start:now,used:0,last:now};requireThat(now>=budget.last,'QUEUE_CLOCK_REGRESSED');if(now-budget.start>=this.policy.request_window_ms)budget={start:now,used:0,last:now};budget.last=now;this.db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('budget_window',stable(budget));if(budget.used>=this.policy.requests)return null;
  const running=this.db.prepare("SELECT count(*) AS n FROM jobs WHERE state='RUNNING'").get().n;if(running>=this.policy.concurrency)return null;
  const row=this.db.prepare("SELECT * FROM jobs WHERE state='PENDING' AND due<=? ORDER BY due,id LIMIT 1").get(now);if(!row)return null;
  budget.used++;budget.last=now;this.db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('budget_window',stable(budget));
  const token=crypto.randomUUID(),lease=Math.min(now+this.policy.lease_ms,row.deadline);this.db.prepare("UPDATE jobs SET state='RUNNING',attempts=attempts+1,lease_until=?,lease_token=? WHERE id=?").run(lease,token,row.id);
  return {job:JSON.parse(row.body),token,attempt:row.attempts+1,lease_until:lease};
 });}
 settle(id,token,now,{success,retryable=false,error_code=null}){requireThat(typeof success==='boolean'&&typeof retryable==='boolean','QUEUE_RESULT_INVALID');requireThat(error_code===null||/^[A-Z][A-Z0-9_]{0,63}$/.test(error_code),'QUEUE_ERROR_CODE_INVALID');return this.transaction(()=>{
  const row=this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id);requireThat(row?.state==='RUNNING'&&row.lease_token===token&&row.lease_until>now,'QUEUE_LEASE_FENCED');
  const state=success?'DONE':!retryable?'QUARANTINED':row.attempts>=this.policy.retries+1?'EXHAUSTED':'PENDING';
  const backoff=Math.min(this.policy.retry_max_ms,this.policy.retry_base_ms*2**Math.min(row.attempts-1,30));
  this.db.prepare('UPDATE jobs SET state=?,due=?,lease_until=NULL,lease_token=NULL,last_error=? WHERE id=?').run(state,now+backoff,error_code,id);return state;
 });}
 snapshot(now){const jobs=this.db.prepare('SELECT id,kind,state,attempts,due,deadline,lease_until,last_error FROM (SELECT id,json_extract(body,\'$.kind\') AS kind,state,attempts,due,deadline,lease_until,last_error FROM jobs) ORDER BY id').all();return report('LOCAL_QUEUE_OBSERVATION',{observed_at:new Date(now).toISOString(),policy:this.policy,jobs});}
}
export async function drainTick(queue,handlers,clock){
 requireThat(typeof clock==='function','QUEUE_CLOCK_REQUIRED');let claimed=0;const results=[];
 // Process at most requests jobs per tick, in batches bounded by configured concurrency.
 while(claimed<queue.policy.requests){const batch=[];for(let i=0;i<queue.policy.concurrency&&claimed<queue.policy.requests;i++){const lease=queue.claim(clock());if(!lease)break;claimed++;batch.push(lease);}if(!batch.length)break;
  await Promise.all(batch.map(async lease=>{const handler=handlers[lease.job.kind],controller=new AbortController();let timer;
   try{requireThat(typeof handler==='function','QUEUE_HANDLER_UNAVAILABLE');const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('QUEUE_HANDLER_TIMEOUT'));},queue.policy.timeout_ms);});await Promise.race([handler(clone(lease.job),{signal:controller.signal,idempotency_key:lease.job.id,attempt:lease.attempt}),timeout]);results.push({id:lease.job.id,state:queue.settle(lease.job.id,lease.token,clock(),{success:true})});}
   catch(e){const code=e.message==='QUEUE_HANDLER_TIMEOUT'?'HANDLER_TIMEOUT':e.code==='QUEUE_HANDLER_UNAVAILABLE'?'HANDLER_UNAVAILABLE':'HANDLER_FAILED';try{results.push({id:lease.job.id,state:queue.settle(lease.job.id,lease.token,clock(),{success:false,retryable:code!=='HANDLER_UNAVAILABLE',error_code:code})});}catch{results.push({id:lease.job.id,state:'LEASE_FENCED'});}}
   finally{clearTimeout(timer);controller.abort();}
  }));
 }
 return report('LOCAL_TICK_COMPLETE',{claimed,results});
}
