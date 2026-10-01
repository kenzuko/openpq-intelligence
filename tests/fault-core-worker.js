import core from '../src/workers/core.js';
import {DatasetCoordinator as BaseCoordinator} from '../src/workers/coordinator.js';

// Fault injection is confined to a test entrypoint. Shipped Workers import none of it.
export class DatasetCoordinator extends BaseCoordinator {
  constructor(ctx,env) {
    super(ctx,env);
    const bucket=env.CANONICAL;
    this.env={...env,CANONICAL:new Proxy(bucket,{get(target,name){
      if(!['get','put'].includes(name))return target[name];
      return async(...args)=>{
        const response=await env.FAULT_GATE.fetch('https://fault/gate',{method:'POST',body:JSON.stringify({operation:name,key:args[0]})});
        if(!response.ok)throw new Error('Injected R2 fault');
        const fault=await response.json(),result=await target[name](...args);
        if(fault.action==='CORRUPT' && result)return {text:async()=>'{"corrupt":true}'};
        return result;
      };
    }})};
  }
}
export default {
  async fetch(request,env){
    const result=await core.fetch(request,env);
    if(request.headers.get('x-test-drop-response')==='yes' && new URL(request.url).pathname.endsWith('/commit') && result.ok)return Response.json({error:'TEST_RESPONSE_LOST'},{status:504});
    return result;
  }
};
