import {writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {ContractError,requireThat} from '../../src/platform/contracts.js';

export const BUCKET='openpq-intelligence-canonical-isolated-test';
export const WORKERS=['openpq-intelligence-core-isolated-test','openpq-intelligence-runtime-isolated-test','openpq-intelligence-operator-isolated-test'];
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);

function policies(token,resource,permissions,credential){
  requireThat(token?.status==='active','TOKEN_NOT_ACTIVE',403);
  requireThat(Array.isArray(token.policies)&&token.policies.length>0,'TOKEN_SCOPE_UNKNOWN',403);
  let allowed=false;
  for(const p of token.policies){
    if(p.effect==='deny')continue;
    requireThat(p.effect==='allow' && p.resources && Object.keys(p.resources).length>0,'TOKEN_SCOPE_UNKNOWN',403);
    requireThat(Object.entries(p.resources).every(([key,value])=>key===resource&&value==='*'),'TOKEN_SCOPE_TOO_BROAD',403);
    requireThat(Array.isArray(p.permission_groups)&&p.permission_groups.length>0,'TOKEN_PERMISSION_UNKNOWN',403);
    for(const g of p.permission_groups){
      if(!permissions.includes(g.name)){
        const error=new ContractError('TOKEN_PERMISSION_TOO_BROAD',403);
        error.safeDiagnostic={credential,permission:typeof g.name==='string'&&/^[A-Za-z0-9 :&()/-]{1,100}$/.test(g.name)?g.name:'UNRECOGNIZED'};
        throw error;
      }
    }
    allowed=true;
  }
  requireThat(allowed,'TOKEN_NO_ALLOWED_SCOPE',403);
  return token.policies.map(p=>({effect:p.effect,resources:p.resources,permissions:p.permission_groups.map(g=>({id:g.id,name:g.name}))}));
}

export async function cloudPreflight({accountId,productionAccountIds,apiToken,readAccessKey},fetcher=fetch){
  requireThat(id(accountId),'TEST_ACCOUNT_ID_REQUIRED');
  requireThat(Array.isArray(productionAccountIds)&&productionAccountIds.length>0&&productionAccountIds.every(id),'PRODUCTION_ACCOUNT_INVENTORY_REQUIRED');
  requireThat(!productionAccountIds.includes(accountId),'PRODUCTION_ACCOUNT_FORBIDDEN',403);
  requireThat(typeof apiToken==='string'&&apiToken.length>10&&id(readAccessKey),'DEDICATED_TEST_CREDENTIALS_REQUIRED');
  const paths=[];
  const get=async path=>{
    requireThat(path.startsWith(`/accounts/${accountId}/`),'API_SCOPE_FORBIDDEN',403);paths.push(path);
    const r=await fetcher('https://api.cloudflare.com/client/v4'+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{authorization:'Bearer '+apiToken}});
    requireThat(r.ok,'PREFLIGHT_API_DENIED_OR_UNAVAILABLE',503);const body=await r.json();requireThat(body.success===true,'PREFLIGHT_API_FAILED',503);
    return body;
  };
  const verified=(await get(`/accounts/${accountId}/tokens/verify`)).result;
  requireThat(verified?.status==='active'&&id(verified.id),'TEST_TOKEN_NOT_VERIFIED',403);
  const deployToken=(await get(`/accounts/${accountId}/tokens/${verified.id}`)).result;
  const deployPolicies=policies(deployToken,`com.cloudflare.api.account.${accountId}`,['Workers Admin','Workers Scripts Edit','Workers Scripts Write','Workers Scripts Read','Account API Tokens Read','Workers R2 Storage Read','Account Settings Read'],'deploy');
  const readToken=(await get(`/accounts/${accountId}/tokens/${readAccessKey}`)).result;
  const readPolicies=policies(readToken,`com.cloudflare.edge.r2.bucket.${accountId}_default_${BUCKET}`,['Workers R2 Storage Bucket Item Read'],'runtime_r2_read');
  const scripts=await get(`/accounts/${accountId}/workers/scripts`);
  requireThat(Array.isArray(scripts.result),'WORKER_INVENTORY_UNKNOWN');
  requireThat(!scripts.result_info?.total_count||scripts.result_info.total_count<=scripts.result.length,'WORKER_INVENTORY_INCOMPLETE');
  requireThat(scripts.result.every(w=>WORKERS.includes(w.id)),'TEST_ACCOUNT_HAS_OTHER_WORKERS',403);
  const bucketResponse=await get(`/accounts/${accountId}/r2/buckets`);
  const buckets=bucketResponse.result?.buckets;
  requireThat(Array.isArray(buckets)&&!bucketResponse.result?.cursor,'BUCKET_INVENTORY_INCOMPLETE');
  requireThat(buckets.length===1&&buckets[0].name===BUCKET,'TEST_ACCOUNT_BUCKETS_NOT_ISOLATED',403);
  requireThat(!buckets[0].jurisdiction||buckets[0].jurisdiction==='default','TEST_BUCKET_JURISDICTION_UNSUPPORTED');
  const ns=await get(`/accounts/${accountId}/workers/durable_objects/namespaces`);
  requireThat(Array.isArray(ns.result)&&(!ns.result_info?.total_count||ns.result_info.total_count<=ns.result.length),'NAMESPACE_INVENTORY_UNKNOWN');
  requireThat(ns.result.every(n=>n.script===WORKERS[0]&&n.class==='DatasetCoordinator'),'TEST_ACCOUNT_HAS_OTHER_NAMESPACES',403);
  return {status:'PREFLIGHT_PASS',cloud_gate:'NOT_PASSED',recorded_at_utc:new Date().toISOString(),account_id:accountId,production_account_ids:productionAccountIds,bucket:BUCKET,workers:scripts.result.map(w=>({id:w.id})),namespaces:ns.result.map(n=>({id:n.id,script:n.script,class:n.class})),deploy_token_id:verified.id,deploy_policies:deployPolicies,read_token_id:readAccessKey,read_policies:readPolicies,api_reads:paths};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const evidence=await cloudPreflight({accountId:process.env.CF_TEST_ACCOUNT_ID,productionAccountIds:JSON.parse(process.env.CF_PRODUCTION_ACCOUNT_IDS||'null'),apiToken:process.env.CF_TEST_API_TOKEN,readAccessKey:process.env.R2_TEST_READ_ACCESS_KEY_ID});
    await mkdir('.cloud-proof',{recursive:true});await writeFile('.cloud-proof/preflight.json',JSON.stringify(evidence,null,2)+'\n');
    console.log('PASS: read-only account/token/resource preflight. G1 cloud proof still pending.');
  }catch(e){console.error(e instanceof ContractError?e.code:'PREFLIGHT_FAILED');if(e instanceof ContractError&&e.safeDiagnostic)console.error(JSON.stringify(e.safeDiagnostic));process.exitCode=1;}
}
