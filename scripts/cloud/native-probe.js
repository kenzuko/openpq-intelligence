import {ContractError,requireThat} from '../../src/platform/contracts.js';

// A fresh deployment and secret update can briefly serve an older version.
// No authority is initialized until the exact new fixture identity is observed.
export async function waitForNativeProbe(origin,plan,{fetcher=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=24,interval=2500}={}){
  let code='NATIVE_PROBE_UNAVAILABLE';
  for(let attempt=0;attempt<attempts;attempt++){
    let response;
    try{
      response=await fetcher(origin+'/probe',{headers:{authorization:'Bearer '+plan.provisioning_token},redirect:'error',signal:AbortSignal.timeout(15000)});
    }catch{code='NATIVE_PROBE_NETWORK_UNAVAILABLE';}
    if(response){
      if(response.ok){
        let probe;
        try{probe=await response.json();}catch{throw new ContractError('NATIVE_PROBE_INVALID_JSON');}
        requireThat(probe&&typeof probe==='object','NATIVE_PROBE_INVALID_RESPONSE');
        if(probe.dataset_id===plan.dataset_id&&probe.object_name===plan.object_name){
          requireThat(typeof probe.native_id==='string'&&/^[a-f0-9]{64}$/.test(probe.native_id),'NATIVE_PROBE_INVALID_NATIVE_ID');
          return probe;
        }
        code='NATIVE_PROBE_SCOPE_MISMATCH';
      }else{
        code='NATIVE_PROBE_HTTP_'+response.status;
        requireThat([401,403,404,429,500,502,503,504].includes(response.status),code);
      }
    }
    if(attempt+1<attempts)await pause(interval);
  }
  throw new ContractError(code);
}
