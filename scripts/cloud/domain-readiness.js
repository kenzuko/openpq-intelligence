import {waitForCapabilityStatus} from './capability-readiness.js';
export async function waitForDomainRuntime(read,expected,{observe,...options}={}){
 let last;
 await waitForCapabilityStatus(async()=>{
  const result=last=await read(),s=result.body?.serving;
  observe?.({status:result.status,error:result.body?.error??null,authority:s?.authority??null,fallback:s?.fallback??null,eligibility:s?.decision_eligibility??null});
  const pass=result.status===200&&s?.authority===expected.authority&&s?.decision_eligibility==='ABSTAIN'&&(expected.fallback===undefined||s.fallback===expected.fallback)&&(!expected.receipt_digest||result.body?.receipt?.digest===expected.receipt_digest);
  return {status:pass?200:503};
 },200,{failureCode:'DOMAIN_RUNTIME_STATE_NOT_OBSERVED',...options});
 return last;
}
