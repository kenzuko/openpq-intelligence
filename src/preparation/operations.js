import {clone,instant,integer,object,report,requireThat,stable,text} from './common.js';
export function monitor(observation,policies,scope,evaluation_time){
 const now=instant(evaluation_time,'MONITOR_TIME');object(observation,'OBSERVATION');requireThat(Array.isArray(observation.sources)&&observation.sources.length>0,'MONITOR_SOURCES_REQUIRED');
 const checks=[],check=(id,ok,detail)=>checks.push({id,status:ok?'PASS':'FAIL',detail});
 let freshness,ops;try{freshness=policies.require('P05',['max_source_age_ms','clock_skew_ms'],scope,evaluation_time);ops=policies.require('P14',['max_progress_lag_ms','max_backlog','max_checkpoint_lag_ms'],scope,evaluation_time);for(const k of Object.keys(ops))if(k.startsWith('max_'))integer(ops[k],k);}
 catch{ return report('MONITOR_POLICY_BLOCKED',{evaluation_time,healthy:false,checks:[],reason_codes:['MONITOR_POLICY_MISSING']}); }
 check('runtime',observation.runtime_status===200,'HTTP success alone does not prove data progress');
 const ids=new Set();for(const s of observation.sources){text(s.source_id,'SOURCE_ID');requireThat(!ids.has(s.source_id),'MONITOR_SOURCE_DUPLICATE');ids.add(s.source_id);const age=s.source_time===null?null:now-instant(s.source_time,'SOURCE_TIME');const valid=s.valid_to===null?false:now<instant(s.valid_to,'SOURCE_VALID_TO');check('source:'+s.source_id,age!==null&&age>=-freshness.clock_skew_ms&&age<=freshness.max_source_age_ms&&valid,{source_age_ms:age,validity_open:valid});}
 const progress=observation.last_progress_at===null?null:now-instant(observation.last_progress_at,'PROGRESS_TIME');check('progress',progress!==null&&progress>=0&&progress<=ops.max_progress_lag_ms,{lag_ms:progress});
 integer(observation.pending_count,'PENDING_COUNT');check('backlog',observation.pending_count<=ops.max_backlog,{pending_count:observation.pending_count});
 const lag=observation.checkpoint_at===null?null:now-instant(observation.checkpoint_at,'CHECKPOINT_TIME');check('checkpoint',lag!==null&&lag>=0&&lag<=ops.max_checkpoint_lag_ms,{lag_ms:lag});
 return report(checks.every(c=>c.status==='PASS')?'LOCAL_MONITOR_PASS':'LOCAL_MONITOR_DEGRADED',{evaluation_time,healthy:checks.every(c=>c.status==='PASS'),checks,notifications_sent:false});
}
function pathValue(value,path){let x=value;for(const part of path.split('.')){if(!x||typeof x!=='object'||!Object.hasOwn(x,part))return {present:false};x=x[part];}return {present:true,value:x};}
export function compareShadow(legacy,next,policies,scope){
 object(legacy,'LEGACY');object(next,'NEXT');requireThat(stable(legacy.scope)===stable(next.scope),'PARITY_SCOPE_MISMATCH');
 const values=policies.require('P17',['fields','max_time_skew_ms'],scope);integer(values.max_time_skew_ms,'PARITY_TIME_SKEW');requireThat(Array.isArray(values.fields)&&values.fields.length>0,'PARITY_FIELDS_REQUIRED');
 const differences=[],seen=new Set();for(const f of values.fields){text(f.path,'FIELD_PATH');requireThat(!seen.has(f.path),'PARITY_FIELD_DUPLICATE');seen.add(f.path);requireThat(typeof f.critical==='boolean','PARITY_CRITICAL_REQUIRED');requireThat(['EXACT','ABSOLUTE'].includes(f.mode),'PARITY_MODE_INVALID');
  const a=pathValue(legacy.payload,f.path),b=pathValue(next.payload,f.path);let equal=a.present&&b.present;
  if(equal&&f.mode==='EXACT')equal=stable(a.value)===stable(b.value);
  if(f.mode==='ABSOLUTE'){requireThat(typeof f.tolerance==='number'&&Number.isFinite(f.tolerance)&&f.tolerance>=0,'PARITY_TOLERANCE_INVALID');equal=equal&&typeof a.value==='number'&&Number.isFinite(a.value)&&typeof b.value==='number'&&Number.isFinite(b.value)&&Math.abs(a.value-b.value)<=f.tolerance;}
  if(!equal)differences.push({path:f.path,critical:f.critical,reason:!a.present||!b.present?'FIELD_MISSING':'VALUE_DIFFERS'});
 }
 const skew=Math.abs(instant(legacy.evaluation_time,'LEGACY_TIME')-instant(next.evaluation_time,'NEXT_TIME'));if(skew>values.max_time_skew_ms)differences.push({path:'evaluation_time',critical:true,reason:'TIME_SKEW'});
 return report(differences.length?'SHADOW_DIFFERENCES':'SHADOW_PARITY_PASS',{differences,critical_difference_count:differences.filter(d=>d.critical).length,cutover_allowed:false});
}
export function cutoverReadiness(evidence,required){
 requireThat(Array.isArray(required)&&required.length>0&&new Set(required).size===required.length,'CUTOVER_GATES_REQUIRED');object(evidence,'CUTOVER_EVIDENCE');
 const allowed=['primitive','domain_policy','source_license','golden_corpus','shadow_cycles','recovery_drill','operator_security','budget_measurement','consumer_compatibility','rollback_rehearsal'];requireThat(required.length===allowed.length&&allowed.every(x=>required.includes(x)),'CUTOVER_CANNOT_OMIT_GATE');
 const gates=required.map(id=>({id,status:evidence[id]?.status==='OBSERVED_PASS'&&/^[a-f0-9]{64}$/.test(evidence[id]?.report_hash)&&typeof evidence[id]?.owner==='string'&&evidence[id].owner.length>0?'RECORDED_PASS':'BLOCKED'}));
 return report('CUTOVER_PLAN_ONLY',{gates,missing:gates.filter(g=>g.status==='BLOCKED').map(g=>g.id),evidence_assurance:'RECORDED_REFERENCES_NOT_AUTHENTICATED',cutover_allowed:false,rollback_strategy:'explicit forward correction/retraction and consumer routing; never overwrite history'});
}
