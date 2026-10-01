import {closedEnvironment,clone,integer,requireThat} from './common.js';
export function queuePolicy(policies,scope){
 const p=policies.require('P10',['requests','concurrency','retries','timeout_ms','queue_limit','lease_ms','retry_base_ms','retry_max_ms','request_window_ms'],scope);
 for(const k of ['requests','concurrency','timeout_ms','queue_limit','lease_ms','retry_base_ms','retry_max_ms','request_window_ms'])integer(p[k],k,1);integer(p.retries,'retries');
 requireThat(p.lease_ms>p.timeout_ms&&p.retry_max_ms>=p.retry_base_ms,'QUEUE_POLICY_RELATION_INVALID');return {...clone(p),environment_id:policies.environment_id};
}
