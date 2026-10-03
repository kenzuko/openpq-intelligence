import {DatasetCoordinator} from '../../src/workers/coordinator.js';
import {DOMAIN_DATASETS} from '../../src/ingress/domain-source-common.js';
export {DatasetCoordinator};
export default {async fetch(request,env){
 if(env.ENVIRONMENT_ID!=='isolated-test'||request.method!=='GET'||new URL(request.url).pathname!=='/probe')return new Response(null,{status:404});
 if(!env.PROVISIONING_TOKEN||request.headers.get('authorization')!=='Bearer '+env.PROVISIONING_TOKEN)return new Response(null,{status:403});
 const dataset=new URL(request.url).searchParams.get('dataset_id');
 const objects=JSON.parse(env.PROVISION_OBJECTS_JSON||'{}');
 if(![...Object.values(DOMAIN_DATASETS),'cano.operation.an-thoi'].includes(dataset)||!objects[dataset]?.startsWith('isolated-test/'+dataset+'/bridge-'))return new Response(null,{status:503});
 return Response.json({dataset_id:dataset,object_name:objects[dataset],native_id:env.DATASETS.idFromName(objects[dataset]).toString()},{headers:{'cache-control':'no-store'}});
}};
