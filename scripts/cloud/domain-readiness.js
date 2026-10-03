import {waitForCapabilityStatus} from './capability-readiness.js';
export async function waitForDomainRuntime(read,expected,{observe,...options}={}){
 return waitForCapabilityStatus(async()=>{
  const result=await read(),s=result.body?.serving;
  observe?.({status:result.status,error:result.body?.error??null,authority:s?.authority??null,fallback:s?.fallback??null,eligibility:s?.decision_eligibility??null});
  const pass=result.status===200&&s?.authority===expected.authority&&s?.decision_eligibility==='ABSTAIN'&&(expected.fallback===undefined||s.fallback===expected.fallback);
  return {status:pass?200:503};
 },200,{failureCode:'DOMAIN_RUNTIME_STATE_NOT_OBSERVED',...options});
}
