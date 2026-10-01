import {createServer} from 'node:http';
import {ContractError,requireThat} from '../../src/platform/contracts.js';

// A loopback client receives a socket failure after the upstream commit response.
// This is real response loss in the runner, not a crash inside Cloudflare.
export async function loseCommittedResponse(upstream){
  let completed=false,fault;
  const server=createServer(async(request,response)=>{
    try{
      requireThat(request.method==='POST'&&request.url==='/commit','FAULT_PROXY_REQUEST_INVALID');
      const result=await upstream();
      requireThat(result.status===200,'FAULT_UPSTREAM_COMMIT_FAILED');
      completed=true;
      if(result.body)await result.body.cancel();
    }catch(error){fault=error;}
    finally{response.destroy();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try{
    let lost=false;
    try{await fetch('http://127.0.0.1:'+server.address().port+'/commit',{method:'POST',signal:AbortSignal.timeout(20000)});}catch{lost=true;}
    if(fault)throw fault;
    requireThat(completed&&lost,'COMMITTED_RESPONSE_LOSS_NOT_OBSERVED');
    return {upstream_status:200,client_response_lost:true,fault_boundary:'runner loopback socket after upstream commit response'};
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}

export async function observeRestart(read,previous,{pause=ms=>new Promise(r=>setTimeout(r,ms)),attempts=60,timeout=120000,clock=Date.now,observe=()=>{}}={}){
  requireThat(typeof previous==='string'&&previous.length>0,'INCARNATION_OBSERVATION_REQUIRED');
  const start=clock();
  for(let attempt=1;attempt<=attempts;attempt++){
    let result;
    try{result=await read();}catch{}
    const current=result?.status===200?result.body?.instance_observation?.incarnation_id:null;
    observe({attempts:attempt,last_status:Number.isInteger(result?.status)?result.status:null,incarnation_id:typeof current==='string'?current:null,elapsed_ms:clock()-start});
    if(typeof current==='string'&&current!==previous)return {incarnation_id:current,attempts:attempt,elapsed_ms:clock()-start};
    if(clock()-start>=timeout)break;
    if(attempt<attempts)await pause(Math.min(2000,Math.max(0,timeout-(clock()-start))));
  }
  throw new ContractError('COORDINATOR_RESTART_NOT_OBSERVED',503);
}
