import {trustMap} from '../platform/trusted-config.js';
import { DatasetCoordinator } from './coordinator.js';
import { ContractError, locator, requireThat } from '../platform/contracts.js';
import {executionEnvironment,executionDataset} from '../platform/transit-execution-scope.js';
export { DatasetCoordinator };
export default {
  async fetch(request,env) {
    try {
      executionEnvironment(env);
      const url=new URL(request.url), parts=url.pathname.split('/').filter(Boolean);
      if (parts[0]==='health' && request.method==='GET') return Response.json({service:'core',status:'UP',production_enabled:false},{headers:{'cache-control':'no-store'}});
      requireThat(parts.length===3 && parts[0]==='datasets','NOT_FOUND',404);
      const trust=locator(trustMap(env)[parts[1]]);
      executionDataset(env,trust);
      requireThat(trust.environment_id===env.ENVIRONMENT_ID,'ENVIRONMENT_MISMATCH',409);
      const id=env.DATASETS.idFromName(trust.object_name);
      requireThat(id.toString()===trust.native_id,'DISPATCH_LOCATOR_MISMATCH',409);
      return env.DATASETS.get(id).fetch(new Request(`https://coordinator/${parts[2]}`,request));
    } catch(e) {return Response.json({error:e instanceof ContractError?e.code:'CONFIGURATION_INVALID'},{status:e instanceof ContractError?e.status:503,headers:{'cache-control':'no-store'}});}
  }
};
