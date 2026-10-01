import {ContractError} from '../../src/platform/contracts.js';

// Secret write success is not proof that an existing DO has denied a capability.
export async function waitForCapabilityStatus(read,expected,{observe=()=>{},pause=ms=>new Promise(r=>setTimeout(r,ms)),clock=Date.now,timeout=90000,attempts=60,interval=1500,failureCode}={}){
  const start=clock();
  for(let attempt=1;attempt<=attempts;attempt++){
    let status=null;
    try{status=(await read()).status;}catch{}
    observe({attempts:attempt,last_status:Number.isInteger(status)?status:null,elapsed_ms:clock()-start});
    if(status===expected)return;
    if(attempt===attempts||clock()-start>=timeout)break;
    await pause(Math.min(interval,Math.max(0,timeout-(clock()-start))));
  }
  throw new ContractError(failureCode||(expected===401?'READ_CAPABILITY_REVOKE_NOT_OBSERVED':'READ_CAPABILITY_RESTORE_NOT_OBSERVED'),503);
}
