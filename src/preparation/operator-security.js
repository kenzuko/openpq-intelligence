import {closedEnvironment,exactKeys,hash,instant,object,report,requireThat,text} from './common.js';
export async function authorizeOperator(command,session,config,policies,evaluation_time){
 closedEnvironment(config.environment_id);exactKeys(config,['environment_id','origin','issuer','audience','session_max_ms','roles'],'OPERATOR_SECURITY_CONFIG');
 const origin=new URL(config.origin);requireThat(origin.protocol==='https:'&&origin.origin===config.origin,'OPERATOR_ORIGIN_INVALID');text(config.issuer,'SSO_ISSUER');text(config.audience,'SSO_AUDIENCE');
 requireThat(Number.isSafeInteger(config.session_max_ms)&&config.session_max_ms>0,'OPERATOR_SESSION_POLICY_REQUIRED');object(config.roles,'OPERATOR_ROLES');object(session,'OPERATOR_SESSION');object(command,'OPERATOR_COMMAND');
 const now=instant(evaluation_time,'OPERATOR_TIME');requireThat(session.environment_id===config.environment_id&&session.issuer===config.issuer&&session.audience===config.audience,'OPERATOR_SESSION_SCOPE_DENIED');
 requireThat(session.signature_verified===true&&session.revoked===false,'OPERATOR_AUTHENTICATED_SESSION_REQUIRED');text(session.actor_id,'ACTOR');
 const issued=instant(session.issued_at,'SESSION_ISSUED'),expires=instant(session.expires_at,'SESSION_EXPIRES');requireThat(issued<=now&&now<expires&&expires-issued<=config.session_max_ms,'OPERATOR_SESSION_EXPIRED');
 requireThat(command.method==='POST'&&command.origin===config.origin&&command.csrf_hash===session.csrf_hash&&/^[a-f0-9]{64}$/.test(session.csrf_hash),'OPERATOR_CSRF_DENIED');
 requireThat(config.roles[session.role]?.includes(command.action),'OPERATOR_ROLE_DENIED');text(command.reason,'COMMAND_REASON');text(command.command_id,'COMMAND_ID');text(command.dataset_id,'COMMAND_DATASET');
 requireThat(Array.isArray(session.datasets)&&session.datasets.includes(command.dataset_id),'OPERATOR_DATASET_DENIED');
 if(['UNFREEZE','REDUCE_PROTECTION','OVERRIDE_POSITIVE'].includes(command.action)){
  const p=policies.require('P15',['max_override_ms','reducing_protection_review'],command.dataset_id,evaluation_time);requireThat(p.reducing_protection_review===true,'PROTECTION_REDUCTION_DISABLED');
  requireThat(command.review?.approved===true&&command.review.actor_id!==session.actor_id&&command.review.command_hash===await hash(command.reviewed_body)&&await hash(command.reviewed_body)===await hash({action:command.action,dataset_id:command.dataset_id,command_id:command.command_id,reason:command.reason,expires_at:command.expires_at}),'SECOND_REVIEW_REQUIRED');
  const end=instant(command.expires_at,'OVERRIDE_EXPIRES');requireThat(end>now&&end-now<=p.max_override_ms,'OVERRIDE_DURATION_DENIED');
 }
 // Session and review inputs are caller attestations in this offline guard, not an SSO verifier.
 return report('LOCAL_OPERATOR_GUARD_PASS',{actor_id:session.actor_id,command_id:command.command_id,action:command.action,dataset_id:command.dataset_id,authentication_assurance:'INJECTED_VERIFIED_SESSION_REQUIRED',command_forwarded:false,audit: {actor_id:session.actor_id,action:command.action,reason:command.reason,evaluated_at:evaluation_time}});
}
