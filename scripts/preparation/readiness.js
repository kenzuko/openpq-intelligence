import {readFile,writeFile} from 'node:fs/promises';
import {blockedPolicies,policyReadiness,policySet} from '../../src/preparation/policies.js';
import {report,requireThat} from '../../src/preparation/common.js';
const path=process.argv[2];requireThat(path,'CONFIG_PATH_REQUIRED');const c=JSON.parse(await readFile(path,'utf8'));
const set=await policySet(c.policies,c.environment_id,c.evaluation_time);const readiness=policyReadiness(set);
const result=report('PREPARATION_CONFIG_REVIEW',{environment_id:c.environment_id,dataset_id:c.dataset_id,policy_hash:set.hash,...readiness,missing_bindings:['authenticated source identity','live wire admission validator','cloud durable scheduler binding','authenticated SSO/session verifier','offsite backup target','approved consumer routing'],g1:'NOT_PASSED',g2:'NOT_PASSED',live_enabled:false});
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(result,null,2)+'\n');else console.log(JSON.stringify(result,null,2));
