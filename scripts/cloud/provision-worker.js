import {DatasetCoordinator} from '../../src/workers/coordinator.js';
export {DatasetCoordinator};
export default {
  async fetch(request,env){
    if(env.ENVIRONMENT_ID!=='isolated-test'||request.method!=='GET'||new URL(request.url).pathname!=='/probe')return new Response(null,{status:404});
    const token=request.headers.get('authorization');
    if(!env.PROVISIONING_TOKEN||token!=='Bearer '+env.PROVISIONING_TOKEN)return new Response(null,{status:403});
    if(!env.PROVISION_DATASET_ID?.startsWith('fixture.cano.operation.')||env.PROVISION_OBJECT_NAME!=='isolated-test/'+env.PROVISION_DATASET_ID)return new Response(null,{status:503});
    // Resolve the native ID only. Never call get()/fetch() on the DO or create authority state.
    const native_id=env.DATASETS.idFromName(env.PROVISION_OBJECT_NAME).toString();
    return Response.json({dataset_id:env.PROVISION_DATASET_ID,object_name:env.PROVISION_OBJECT_NAME,native_id},{headers:{'cache-control':'no-store'}});
  }
};
