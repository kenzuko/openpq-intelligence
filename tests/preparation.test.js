import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preparationFixture,syntheticLocator,AT,SCOPE} from '../src/fixtures/preparation.js';
import {hash,stable} from '../src/platform/contracts.js';
import {blockedPolicies,policySet} from '../src/preparation/policies.js';
import {makeArtifact,preparationRegistry} from '../src/preparation/registry.js';
import {prepareShadow} from '../src/preparation/pipeline.js';
import {adapterPlan,exerciseAdapter} from '../src/preparation/adapter.js';
import {DurableQueue,queuePolicy,drainTick} from '../scripts/preparation/durable-queue.js';
import {monitor,compareShadow,cutoverReadiness} from '../src/preparation/operations.js';
import {buildBackup,verifyBackup,restorePlan,retentionPlan} from '../src/preparation/recovery.js';
import {authorizeOperator} from '../src/preparation/operator-security.js';
const copy=x=>JSON.parse(JSON.stringify(x));
test('unresolved policies block locally, production cannot be configured, and policy scope/version are explicit',async()=>{
 const p=await policySet(blockedPolicies('local-test',SCOPE),'local-test',AT);assert.throws(()=>p.require('P10',['requests'],SCOPE),/P10_BLOCKED/);
 await assert.rejects(policySet(blockedPolicies('local-test',SCOPE),'production',AT),/ENVIRONMENT_CLOSED/);
 const f=await preparationFixture();assert.throws(()=>f.policies.require('P10',['requests'],'other'),/SCOPE_MISMATCH/);
 const a=copy(f.policy_inputs);a[4].values.max_source_age_ms=-1;await assert.rejects(policySet(a,'local-test',AT),/REQUIRED/);
 a[4].values.max_source_age_ms=1;a[4].effective_to=AT;await assert.rejects(policySet(a,'local-test',AT),/NOT_EFFECTIVE/);
});
test('preparation registry validates content, all dependencies and immutable lookup before a compute',async()=>{
 const f=await preparationFixture(),bad=copy(f.artifacts);bad[0].payload.scopes=[];await assert.rejects(preparationRegistry(bad,'local-test'),/CONTENT_MISMATCH/);
 await assert.rejects(preparationRegistry([...f.artifacts,f.artifacts[0]],'local-test'),/VERSION_CONFLICT/);
 await assert.rejects(preparationRegistry(f.artifacts.filter(a=>a.kind!=='MAPPING'),'local-test'),/REF_UNAVAILABLE/);
 const secret=await makeArtifact('CONFIG','secret',{nested:{token:'never-export'}});await assert.rejects(preparationRegistry([secret],'local-test'),/SECRET_FORBIDDEN/);
 assert.ok(Object.isFrozen(f.registry.lookup(f.artifact_refs.source,'SOURCE').payload));
});
test('complete preparation has exact artifact graph and deterministic output but never emits a live candidate',async()=>{
 const f=await preparationFixture(),a=await prepareShadow(f);assert.equal(a.quality.completeness,'COMPLETE');assert.equal(a.quality.resolution,'RESOLVED');assert.equal(a.publication_admitted,false);assert.equal(a.wire_candidate_available,false);assert.equal(a.decision_effect,'ABSTAIN');assert.deepEqual(a,await prepareShadow(f));
 assert.ok(Object.isFrozen(a.values));const refs={...f.artifact_refs,adapter:f.artifact_refs.source};await assert.rejects(prepareShadow({...f,artifact_refs:refs}),/KIND_MISMATCH/);
});
test('wrong unit/type, duplicate IDs, wrong evidence/source/artifact mapping fail before output',async()=>{
 for(const [change,error] of [[f=>f.assertions[0].unit='m/s',/UNIT_MISMATCH/],[f=>f.assertions[0].value=1,/VALUE_TYPE_MISMATCH/],[f=>f.evidences[0].source_namespace='other',/SOURCE_MISMATCH/],[f=>f.evidences.push(f.evidences[0]),/DUPLICATE/],[f=>f.assertions[0].evidence_ref='missing',/EVIDENCE_MISMATCH/]]){const f=await preparationFixture();change(f);await assert.rejects(prepareShadow(f),error);}
});
test('fresh collection cannot renew stale source, exact validity boundary expires, missing value quarantines',async()=>{
 const f=await preparationFixture();const stale=await preparationFixture({P05:{values:{max_source_age_ms:100,clock_skew_ms:0}}});stale.evidences[0].collected_at=AT;stale.evidences[0].received_at=AT;assert.equal((await prepareShadow(stale)).eligible_assertion_refs.length,0);
 assert.equal((await prepareShadow({...f,evaluation_time:'2026-10-01T17:00:00Z'})).eligible_assertion_refs.length,0);
 delete f.assertions[0].value;f.assertions[0].missing_reason='NOT_REPORTED';const out=await prepareShadow(f);assert.equal(out.quality.completeness,'INSUFFICIENT');assert.ok(out.quarantine.some(q=>q.reason_codes.includes('VALUE_MISSING')));
});
test('unknown/future time, wrong scope and conflict are visible; permutation cannot resolve a disagreement',async()=>{
 const f=await preparationFixture();f.evidences[0].source_time='2026-10-01T13:00:00Z';f.assertions[0].source_time=f.evidences[0].source_time;assert.equal((await prepareShadow(f)).eligible_assertion_refs.length,0);
 const c=await preparationFixture();c.assertions.push({...c.assertions[0],assertion_id:'a2',value:false});const one=await prepareShadow(c);assert.equal(one.quality.resolution,'CONFLICTING');c.assertions.reverse();assert.deepEqual(await prepareShadow(c),one);
});
const config=()=>({adapter_id:'synthetic',environment_id:'local-test',source_id:'synthetic-manual',origin:'https://synthetic.invalid',path:'/fixture.json',credential_reference:null,response_type:'json'});
test('adapter preflight blocks absent license/budget, embedded credentials and origin escapes',async()=>{
 const f=await preparationFixture();adapterPlan(config(),f.policies,'local-test',SCOPE);
 assert.throws(()=>adapterPlan({...config(),origin:'https://user:password@synthetic.invalid'},f.policies,'local-test',SCOPE),/ORIGIN_INVALID/);
 assert.throws(()=>adapterPlan({...config(),path:'//other.invalid'},f.policies,'local-test',SCOPE),/PATH_INVALID/);
 const b=await preparationFixture({P09:{status:'BLOCKED'}});assert.throws(()=>adapterPlan(config(),b.policies,'local-test',SCOPE),/P09_BLOCKED/);
});
test('adapter reads bounded streams, denies redirects/non-JSON and aborts timeout without automatic retry',async()=>{
 const f=await preparationFixture(),plan=adapterPlan(config(),f.policies,'local-test',SCOPE);let calls=0;
 const out=await exerciseAdapter(plan,async(_,o)=>{calls++;assert.equal(o.redirect,'manual');return Response.json({ok:true});});assert.equal(out.value.ok,true);assert.equal(calls,1);
 await assert.rejects(exerciseAdapter(plan,async()=>new Response('x'.repeat(1025),{headers:{'content-type':'application/json'}})),/PAYLOAD_TOO_LARGE/);
 await assert.rejects(exerciseAdapter(plan,async()=>new Response(null,{status:302,headers:{location:'https://other.invalid'}})),/HTTP_NOT_SUCCESS/);
 await assert.rejects(exerciseAdapter(plan,async()=>new Response('{}')),/CONTENT_TYPE_INVALID/);
 let aborted=false;await assert.rejects(exerciseAdapter(plan,async(_,o)=>new Promise(resolve=>o.signal.addEventListener('abort',()=>{aborted=true;resolve(Response.json({}));}))),/ADAPTER_TIMEOUT/);assert.equal(aborted,true);
});
async function queueTest(fn){const d=await mkdtemp(join(tmpdir(),'openpq-queue-'));const f=await preparationFixture(),policy=queuePolicy(f.policies,SCOPE);let q=await DurableQueue.open(join(d,'queue.sqlite'),policy);try{await fn(q,()=>DurableQueue.open(join(d,'queue.sqlite'),policy),d,policy);}finally{try{q.close();}catch{}await rm(d,{recursive:true,force:true});}}
const job=(id,expires=10000)=>({id,kind:'synthetic',expires_at:new Date(expires).toISOString(),payload:{fixture:true}});
test('durable queue deduplicates content, applies backpressure and survives reopening database',()=>queueTest(async(q,reopen)=>{
 assert.equal((await q.enqueue(job('a'),0)).created,true);assert.equal((await q.enqueue(job('a'),1)).created,false);
 await assert.rejects(q.enqueue({...job('a'),payload:{fixture:false}},1),/IDEMPOTENCY_CONFLICT/);
 for(const id of ['b','c','d'])await q.enqueue(job(id),1);await assert.rejects(q.enqueue(job('e'),1),/BACKPRESSURE/);
 q.close();const r=await reopen();try{assert.equal(r.snapshot(2).jobs.length,4);}finally{r.close();}
}));
test('queue lease fencing, concurrency limit, durable request window and bounded retries hold across workers',()=>queueTest(async(q,reopen)=>{
 for(const id of ['a','b','c','d'])await q.enqueue(job(id),0);
 const first=q.claim(0),second=q.claim(0);assert.equal(q.claim(0),null);const r=await reopen();try{assert.equal(r.claim(0),null);
 assert.equal(q.settle('a',first.token,1,{success:false,retryable:true,error_code:'TEMPORARY'}),'PENDING');assert.equal(q.settle('b',second.token,1,{success:true}),'DONE');
 const third=r.claim(1);r.settle(third.job.id,third.token,2,{success:true});const fourth=q.claim(11);q.settle(fourth.job.id,fourth.token,12,{success:false,retryable:true,error_code:'TEMPORARY'});assert.equal(q.claim(99),null);
 const renewed=q.claim(101);assert.ok(renewed);assert.throws(()=>q.settle(renewed.job.id,'old-token',102,{success:true}),/LEASE_FENCED/);
 }finally{r.close();}
}));
test('lost lease can be retried after restart but old handler cannot settle; expired jobs never run',()=>queueTest(async(q,reopen)=>{
 await q.enqueue(job('a'),0);await q.enqueue(job('expired',50),0);const lease=q.claim(0);q.close();const r=await reopen();try{const newLease=r.claim(101);assert.equal(newLease.job.id,'a');assert.equal(newLease.attempt,2);assert.throws(()=>r.settle('a',lease.token,102,{success:true}),/LEASE_FENCED/);r.settle('a',newLease.token,102,{success:true});assert.equal(r.snapshot(103).jobs.find(j=>j.id==='expired').state,'EXPIRED');}finally{r.close();}
}));
test('drain tick uses allowlisted handlers, masks handler exceptions and keeps retries durable',()=>queueTest(async(q)=>{
 await q.enqueue(job('a'),0);let now=1;const out=await drainTick(q,{synthetic:async()=>{throw new Error('private-sensitive-message');}},()=>now++);assert.equal(out.results[0].state,'PENDING');assert.doesNotMatch(JSON.stringify(q.snapshot(now)),/private-sensitive/);
 now=1000;await drainTick(q,{},()=>now++);assert.equal(q.snapshot(now).jobs[0].state,'QUARANTINED');
}));
test('HTTP 200 alone does not pass monitoring when sources/progress/checkpoint are stale or unknown',async()=>{
 const f=await preparationFixture(),observation={runtime_status:200,sources:[{source_id:'one',source_time:null,valid_to:null}],last_progress_at:null,pending_count:0,checkpoint_at:null};assert.equal(monitor(observation,f.policies,SCOPE,AT).healthy,false);
 const pass={runtime_status:200,sources:[{source_id:'one',source_time:AT,valid_to:'2026-10-01T13:00:00Z'}],last_progress_at:AT,pending_count:0,checkpoint_at:AT};assert.equal(monitor(pass,f.policies,SCOPE,AT).healthy,true);
 const blocked=await policySet(blockedPolicies('local-test',SCOPE),'local-test',AT);assert.equal(monitor(pass,blocked,SCOPE,AT).status,'MONITOR_POLICY_BLOCKED');
});
test('parity compares explicit fields including zero, missing/type changes and time skew without enabling cutover',async()=>{
 const f=await preparationFixture(),a={scope:f.target_scope,evaluation_time:AT,payload:{value:false,number:0}},b=copy(a);b.payload.number=0.05;assert.equal(compareShadow(a,b,f.policies,SCOPE).status,'SHADOW_PARITY_PASS');delete b.payload.value;assert.equal(compareShadow(a,b,f.policies,SCOPE).critical_difference_count,1);b.payload.value=0;assert.equal(compareShadow(a,b,f.policies,SCOPE).critical_difference_count,1);assert.equal(compareShadow(a,a,f.policies,SCOPE).cutover_allowed,false);
 assert.throws(()=>cutoverReadiness({},['primitive']),/CANNOT_OMIT_GATE/);
});
async function backupFixture(){const authority=syntheticLocator(),generation={fixture:true},gDigest=await hash(generation),active={...authority,revision:1,key:'generations/one',digest:gDigest};const control={...authority,revision:1,control_revision:0,epoch:4,active,overrides:[{id:'expired',expires_at:'2026-10-01T11:00:00Z'}]};return buildBackup({environment_id:'local-test',authority,created_at:AT,watermark:{revision:1,control_revision:0},required_keys:['control','generations/one'],records:[{key:'control',kind:'CONTROL',content:control},{key:'generations/one',kind:'GENERATION',content:generation},...['AUDIT','RECEIPT','REGISTRY','SCHEDULER','DEPLOY'].map(kind=>({key:kind.toLowerCase(),kind,content:{fixture:true}}))]});}
test('portable backup verifies manifest, individual bytes and active blob reference; corrupt/incomplete backup fails',async()=>{
 const b=await backupFixture();assert.equal((await verifyBackup(b)).status,'LOCAL_BACKUP_INTEGRITY_PASS');const corrupt=copy(b);corrupt.entries[0].content.changed=true;await assert.rejects(verifyBackup(corrupt),/MANIFEST_MISMATCH/);
 await assert.rejects(buildBackup({environment_id:'local-test',authority:syntheticLocator(),created_at:AT,watermark:{revision:0,control_revision:0},required_keys:['absent'],records:[{key:'../escape',kind:'CONTROL',content:{}}]}),/PATH_INVALID/);
});
test('restore never resumes writer, requires new generation/locator/key and actual command AND write denial',async()=>{
 const b=await backupFixture(),next={...syntheticLocator(),recovery_generation:'generation-2',native_id:'b'.repeat(64),authority_locator_version:'2',locator_artifact_hash:'b'.repeat(64),receipt_keys:{next:{kty:'EC',crv:'P-256',x:'synthetic-new',y:'synthetic-new'}}};
 await assert.rejects(restorePlan(b,syntheticLocator(),{evaluation_time:AT}),/NEW_GENERATION_REQUIRED/);
 const plan=await restorePlan(b,next,{old_epoch_high_watermark:4,evaluation_time:AT});assert.equal(plan.new_epoch,5);assert.equal(plan.blocked.length,2);assert.equal(plan.resume_writer,false);assert.deepEqual(plan.expired_overrides_not_revived,['expired']);
 const deny={role:'OLD_COMMAND',authority_hash:b.authority.locator_artifact_hash,status:'AUTH_DENIED',http_status:503,positive_witness_status:200,credential_fingerprint:'c'.repeat(64),observed_at:AT,revoked_at:AT};const bad=await restorePlan(b,next,{evaluation_time:AT,deny_observations:[deny]});assert.equal(bad.blocked.length,2);
});
test('retention is pin-aware and always dry run, missing policy never deletes',async()=>{
 const f=await preparationFixture(),records=[{key:'old',created_at:'2026-10-01T00:00:00Z',pins:[]},{key:'active',created_at:'2026-10-01T00:00:00Z',pins:['active-receipt']}];const p=retentionPlan(records,f.policies,SCOPE,AT);assert.deepEqual(p.candidates,['old']);assert.equal(p.delete_enabled,false);
});
test('operator guard rejects unauthenticated/expired/wrong origin/CSRF/role/scope and records no secrets',async()=>{
 const f=await preparationFixture(),config={environment_id:'local-test',origin:'https://operator.invalid',issuer:'synthetic-issuer',audience:'synthetic-console',session_max_ms:60000,roles:{operator:['FREEZE']}},session={environment_id:'local-test',issuer:config.issuer,audience:config.audience,signature_verified:true,revoked:false,actor_id:'synthetic-actor',role:'operator',datasets:[SCOPE],issued_at:AT,expires_at:'2026-10-01T12:01:00Z',csrf_hash:'a'.repeat(64)},command={method:'POST',origin:config.origin,csrf_hash:session.csrf_hash,action:'FREEZE',reason:'Fixture protection',command_id:'one',dataset_id:SCOPE};
 assert.equal((await authorizeOperator(command,session,config,f.policies,AT)).command_forwarded,false);
 await assert.rejects(authorizeOperator(command,{...session,signature_verified:false},config,f.policies,AT),/AUTHENTICATED_SESSION_REQUIRED/);
 await assert.rejects(authorizeOperator({...command,origin:'https://evil.invalid'},session,config,f.policies,AT),/CSRF_DENIED/);
 await assert.rejects(authorizeOperator({...command,action:'UNFREEZE'},session,config,f.policies,AT),/ROLE_DENIED/);
});
test('policy approval cannot outlive its effective interval and an altered policy set cannot use old artifact pins',async()=>{
 const f=await preparationFixture();await assert.rejects(prepareShadow({...f,evaluation_time:'2026-10-02T00:00:00Z'}),/POLICY_NOT_EFFECTIVE/);
 const other=await preparationFixture({P05:{values:{max_source_age_ms:200,clock_skew_ms:0}}});await assert.rejects(prepareShadow({...f,policies:other.policies}),/POLICY_SET_MISMATCH/);
});
test('retry exhaustion terminates a job and clock regression cannot reopen the durable request budget',()=>queueTest(async(q)=>{
 await q.enqueue(job('a'),0);for(const [now,expected] of [[0,'PENDING'],[100,'PENDING'],[200,'EXHAUSTED']]){const l=q.claim(now);assert.equal(q.settle('a',l.token,now+1,{success:false,retryable:true,error_code:'TEMPORARY'}),expected);}
 assert.equal(q.claim(300),null);assert.throws(()=>q.claim(100),/CLOCK_REGRESSED/);assert.equal(q.snapshot(301).jobs[0].attempts,3);
}));
test('backup with recomputed outer hash still rejects changed entry digest and dangling active blob',async()=>{
 const b=copy(await backupFixture());b.entries[0].sha256='f'.repeat(64);let {bundle_hash,...m}=b;b.bundle_hash=await hash(m);await assert.rejects(verifyBackup(b),/ENTRY_HASH_OR_ORDER_MISMATCH/);
 const broken=copy(await backupFixture());const c=broken.entries.find(e=>e.kind==='CONTROL');c.content.active.key='generations/absent';c.sha256=await hash(c.content);c.bytes=new TextEncoder().encode(stable(c.content)).length;({bundle_hash,...m}=broken);broken.bundle_hash=await hash(m);await assert.rejects(verifyBackup(broken),/ACTIVE_BLOB_MISSING_OR_CORRUPT/);
});
test('unknown/manual future source evidence quarantines without repairing timestamps or source authors',async()=>{
 const f=await preparationFixture();f.evidences[0].source_time=null;f.evidences[0].source_time_basis='UNKNOWN';f.evidences[0].source_time_missing_reason='SOURCE_NOT_REPORTED';f.assertions[0].source_time=null;const before=JSON.stringify(f.evidences);const out=await prepareShadow(f);assert.equal(out.eligible_assertion_refs.length,0);assert.equal(JSON.stringify(f.evidences),before);
});
test('complete local rehearsal actually retries across restart and stays deterministic with every live gate closed',async()=>{
 const {rehearse}=await import('../scripts/preparation/rehearse.js');const a=await rehearse(),b=await rehearse();assert.deepEqual(a,b);assert.equal(a.report.queue.handler_calls,2);assert.equal(a.report.queue.after_restart.jobs[0].state,'DONE');assert.equal(a.report.stale_monitoring.healthy,false);assert.equal(a.report.recovery.resume_writer,false);assert.equal(a.report.cutover.cutover_allowed,false);assert.equal(a.report.unresolved_policies.blocked.length,18);assert.equal(a.report.publication_admitted,false);
});
test('operator JWT cryptographic verifier rejects tamper, alg confusion, untrusted issuer and actor escalation',async()=>{
 const {verifyOperatorJwt}=await import('../src/preparation/operator-identity.js');const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),pub=await crypto.subtle.exportKey('jwk',pair.publicKey),iat=Date.parse(AT)/1000;
 const config={environment_id:'local-test',issuer:'synthetic-issuer',audience:'synthetic-console',session_max_ms:60000,public_keys:{one:pub},actors:{'synthetic-user':{revoked:false,role:'reader',datasets:[SCOPE]}}};
 const encode=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
 const sign=async(claims,header={typ:'openpq-operator-session+jwt',alg:'ES256',kid:'one'})=>{const body=encode(header)+'.'+encode(claims);return body+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(body))).toString('base64url');};
 const claims={iss:config.issuer,aud:config.audience,sub:'synthetic-user',iat,nbf:iat,exp:iat+60,role:'superuser'},jwt=await sign(claims);const session=await verifyOperatorJwt(jwt,config,AT,'a'.repeat(64));assert.equal(session.role,'reader');assert.ok(Object.isFrozen(session.datasets));
 await assert.rejects(verifyOperatorJwt(await sign({...claims,iss:'evil'}),config,AT,'a'.repeat(64)),/ISSUER_OR_AUDIENCE_DENIED/);
 await assert.rejects(verifyOperatorJwt(await sign(claims,{alg:'none',kid:'one'}),config,AT,'a'.repeat(64)),/ALGORITHM_OR_REMOTE_KEY_DENIED/);
 const parts=jwt.split('.');parts[1]=encode({...claims,sub:'other'});await assert.rejects(verifyOperatorJwt(parts.join('.'),config,AT,'a'.repeat(64)),/SIGNATURE_INVALID/);
 await assert.rejects(verifyOperatorJwt(jwt,config,'2026-10-01T12:01:00Z','a'.repeat(64)),/EXPIRED_OR_FUTURE/);
});
