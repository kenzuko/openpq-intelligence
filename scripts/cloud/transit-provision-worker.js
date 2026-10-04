import {DatasetCoordinator} from '../../src/workers/coordinator.js';
import {executionEnvironment,TRANSIT_FACT_ENVIRONMENT} from '../../src/platform/transit-execution-scope.js';
export {DatasetCoordinator};
export default {async fetch(request,env){
 try{executionEnvironment(env);if(env.ENVIRONMENT_ID!==TRANSIT_FACT_ENVIRONMENT||request.method!=='GET'||new URL(request.url).pathname!=='/probe')return new Response(null,{status:404});
 if(!env.PROVISIONING_TOKEN||request.headers.get('authorization')!=='Bearer '+env.PROVISIONING_TOKEN)return new Response(null,{status:403});
 const object=env.PROVISION_OBJECT_NAME;if(!object?.startsWith(TRANSIT_FACT_ENVIRONMENT+'/transit.bridge.phu-quoc/'))return new Response(null,{status:503});
 return Response.json({dataset_id:'transit.bridge.phu-quoc',object_name:object,native_id:env.DATASETS.idFromName(object).toString()},{headers:{'cache-control':'no-store'}});
 }catch{return new Response(null,{status:503});}
}};
