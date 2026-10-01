import {exactKeys,hash,instant,requireThat,text} from './common.js';
export const PROGRESS_WORKER='openpq-intelligence-progress-isolated-test';
export const PROGRESS_CORE='openpq-intelligence-core-isolated-test';
export function validateProgressScope(c,environment,account,evaluation_time){
 exactKeys(c,['environment_id','enabled','dataset_id','policies','fixture_only','cloud_activation','account_id','valid_until'],'PROGRESS_CONFIG');
 if(environment!=='local-test')requireThat(c.environment_id===environment&&c.fixture_only===true&&c.cloud_activation==='ISOLATED_EXPORT_PROOF_ONLY','PROGRESS_CLOUD_ACTIVATION_CLOSED',503);
 requireThat(c.enabled===true&&c.environment_id===environment,'PROGRESS_CONFIG_BLOCKED',503);text(c.dataset_id,'DATASET');
 if(environment==='local-test')return;
 requireThat(environment==='isolated-test'&&c.fixture_only===true&&c.cloud_activation==='ISOLATED_EXPORT_PROOF_ONLY'&&c.dataset_id.startsWith('fixture.')&&/^[a-f0-9]{32}$/.test(account||'')&&c.account_id===account,'PROGRESS_CLOUD_ACTIVATION_CLOSED',503);
 requireThat(instant(evaluation_time,'PROGRESS_TIME')<instant(c.valid_until,'PROGRESS_VALID_UNTIL'),'PROGRESS_FIXTURE_EXPIRED',503);
}
export async function progressFixtureConfig(account,dataset,now){
 requireThat(/^[a-f0-9]{32}$/.test(account)&&dataset.startsWith('fixture.'),'PROGRESS_FIXTURE_SCOPE_INVALID');const ms=instant(now,'PROGRESS_TIME');
 const c={environment_id:'isolated-test',enabled:true,dataset_id:dataset,fixture_only:true,cloud_activation:'ISOLATED_EXPORT_PROOF_ONLY',account_id:account,valid_until:new Date(ms+900000).toISOString(),policies:[{policy_id:'P10',version:'synthetic-cloud-export-v1',environment_id:'isolated-test',scope:dataset,owner:'synthetic-fixture',rationale:'Bounded technical export proof only; not production policy.',status:'APPROVED_RECORDED',effective_from:new Date(ms-60000).toISOString(),effective_to:new Date(ms+900000).toISOString(),values:{requests:2,concurrency:1,retries:2,payload_bytes:4096,timeout_ms:5000,queue_limit:4,lease_ms:10000,retry_base_ms:250,retry_max_ms:1000,request_window_ms:1000}}]};
 return {config:c,config_hash:await hash(c),worker:{name:PROGRESS_WORKER,main:'../src/workers/progress.js',account_id:account,compatibility_date:'2026-07-30',workers_dev:true,routes:[],vars:{ENVIRONMENT_ID:'isolated-test',TEST_ACCOUNT_ID:account},durable_objects:{bindings:[{name:'PROGRESS',class_name:'ProgressScheduler'}]},migrations:[{tag:'isolated-progress-v1',new_sqlite_classes:['ProgressScheduler']}],services:[{binding:'CORE_EXPORT',service:PROGRESS_CORE}]}};
}
