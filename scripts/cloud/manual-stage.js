import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {hash,instant,requireThat,ContractError} from '../../src/platform/contracts.js';
import {boundedText} from '../../src/platform/bounded-text.js';
import {normalizeManualCano,MANUAL_REPO} from '../../src/ingress/manual-cano.js';
import {stagingConfig,assertStagingConfig,STAGING_WORKER} from '../../src/ingress/staging-config.js';
const dir='.manual-stage';
export function safeStagingObservation(result){
  const allowed=['STAGING_AUTH_DENIED','STAGING_PRODUCTION_FORBIDDEN','STAGING_REQUEST_INVALID_OR_TOO_LARGE','STAGING_NOT_FOUND','STAGING_SOURCE_COMMIT_MISMATCH','STAGING_INVALID','METHOD_DENIED','NOT_FOUND'];
  return {http_status:Number.isInteger(result.status)&&result.status>=100&&result.status<=599?result.status:null,error_code:allowed.includes(result.body?.error)?result.body.error:null};
}
export function sourcePath(day){instant(day+'T00:00:00Z','SOURCE_DAY');requireThat(/^\d{4}-\d\d-\d\d$/.test(day),'SOURCE_DAY_INVALID');return 'data/marine_ops/manual-confirmations/'+day+'-cano-an-thoi.json';}
async function prepare(){
  const preflight=JSON.parse(await readFile('.cloud-proof/preflight.json','utf8'));
  const pinned=JSON.parse(await readFile('docs/evidence/cloud-36848850809/locator.public.json','utf8'));
  requireThat(preflight.status==='PREFLIGHT_PASS'&&preflight.account_id===pinned.account_id,'STAGING_PREFLIGHT_REQUIRED');
  const sourceSha=process.env.SOURCE_COMMIT_SHA;requireThat(/^[a-f0-9]{40}$/.test(sourceSha),'SOURCE_COMMIT_SHA_REQUIRED');
  const path=sourcePath(process.env.SERVICE_DAY);
  const sourceUrl='https://raw.githubusercontent.com/'+MANUAL_REPO+'/'+sourceSha+'/'+path;
  const response=await fetch(sourceUrl,{redirect:'manual',signal:AbortSignal.timeout(15000)});requireThat(response.status===200,'PINNED_MANUAL_SOURCE_UNAVAILABLE',503);
  const raw=await boundedText(response,8192),body={raw,provenance:{repository:MANUAL_REPO,commit_sha:sourceSha,path,payload_sha256:await hash(raw)}};
  const record=await normalizeManualCano(raw,body.provenance);
  const history=[];
  for(const day of ['2026-09-30','2026-09-27']){
    if(day===process.env.SERVICE_DAY)continue;
    const historicalPath=sourcePath(day),historicalResponse=await fetch('https://raw.githubusercontent.com/'+MANUAL_REPO+'/'+sourceSha+'/'+historicalPath,{redirect:'manual',signal:AbortSignal.timeout(15000)});
    requireThat(historicalResponse.status===200,'PINNED_MANUAL_HISTORY_UNAVAILABLE',503);const historicalRaw=await boundedText(historicalResponse,8192);
    const historical={raw:historicalRaw,provenance:{repository:MANUAL_REPO,commit_sha:sourceSha,path:historicalPath,payload_sha256:await hash(historicalRaw)}};
    history.push({request:historical,expected:await normalizeManualCano(historicalRaw,historical.provenance)});
  }
  const token=randomBytes(32).toString('hex');if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+token);
  const config=stagingConfig(preflight.account_id,sourceSha,new Date(Date.now()+15*60000).toISOString());
  assertStagingConfig(config,preflight.account_id,preflight.production_account_ids);
  const subdomainResponse=await fetch(`https://api.cloudflare.com/client/v4/accounts/${preflight.account_id}/workers/subdomain`,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{authorization:'Bearer '+process.env.CF_TEST_API_TOKEN}});
  requireThat(subdomainResponse.ok,'STAGING_SUBDOMAIN_UNAVAILABLE',503);const subdomainBody=await subdomainResponse.json();const subdomain=subdomainBody.result?.subdomain;
  requireThat(subdomainBody.success===true&&subdomain==='openpq-intelligence','STAGING_SUBDOMAIN_MISMATCH');
  await mkdir(dir,{recursive:true});
  await writeFile(dir+'/config.json',JSON.stringify(config,null,2)+'\n');
  await writeFile(dir+'/secrets.private.json',JSON.stringify({STAGING_TOKEN_HASH:await hash(token)}),{mode:0o600});
  await writeFile(dir+'/request.private.json',JSON.stringify(body),{mode:0o600});
  await writeFile(dir+'/history.private.json',JSON.stringify(history),{mode:0o600});
  await writeFile(dir+'/plan.private.json',JSON.stringify({token,origin:`https://${STAGING_WORKER}.${subdomain}.workers.dev`,account_id:preflight.account_id,expected:record}),{mode:0o600});
  await writeFile(dir+'/source.public.json',JSON.stringify({repository:MANUAL_REPO,source_commit_sha:sourceSha,path,payload_sha256:body.provenance.payload_sha256,record_digest:record.record_digest,source_time:record.source_time,valid_from:record.valid_from,valid_to:record.valid_to,normalization_status:record.normalization_status,source_retrieved_at:new Date().toISOString(),policy_hash:record.policy_hash,mode:'SHADOW',publication_admitted:false},null,2)+'\n');
  console.log('Pinned owned manual source and prepared append-only staging config. No authority admission.');
}
async function call(plan,path,body,token=plan.token,method=body?'POST':'GET'){
  const response=await fetch(plan.origin+path,{method,redirect:'manual',signal:AbortSignal.timeout(15000),headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  let result=null;try{result=JSON.parse(await boundedText(response,32768));}catch{}
  return {status:response.status,body:result};
}
async function proof(){
  const plan=JSON.parse(await readFile(dir+'/plan.private.json','utf8')),request=JSON.parse(await readFile(dir+'/request.private.json','utf8'));
  const report={status:'RUNNING',code_sha:process.env.GITHUB_SHA,run_id:process.env.GITHUB_RUN_ID,run_attempt:process.env.GITHUB_RUN_ATTEMPT,account_id:plan.account_id,worker:STAGING_WORKER,source_commit_sha:request.provenance.commit_sha,record_digest:plan.expected.record_digest,mode:'SHADOW',publication_admitted:false,g1:'NOT_PASSED',g2:'NOT_PASSED',cases:[]};
  const check=async(name,fn)=>{await fn();report.cases.push({name,status:'PASS'});};
  try{
    const start=Date.now();let ready;
    do{ready=await call(plan,'/read?digest='+'0'.repeat(64));if(ready.status===404&&ready.body?.error==='STAGING_NOT_FOUND')break;if(Date.now()-start>=90000)break;await new Promise(resolve=>setTimeout(resolve,2000));}while(true);
    requireThat(ready.status===404&&ready.body?.error==='STAGING_NOT_FOUND','STAGING_CAPABILITY_NOT_READY',503);
    await check('unauthenticated staging write is denied',async()=>{const denial=await call(plan,'/stage',request,'wrong');report.denial_observation=safeStagingObservation(denial);requireThat(denial.status===401,'STAGING_AUTH_DENIAL_NOT_OBSERVED');});
    let first;
    await check('real pinned owner manual source is staged without publication',async()=>{first=await call(plan,'/stage',request);requireThat(first.status===200&&first.body.record_digest===plan.expected.record_digest&&first.body.record.publication_admitted===false&&first.body.view.action_eligible===false,'STAGING_WRITE_FAILED');report.staged_key=first.body.key;report.source_time=first.body.record.source_time;report.valid_to=first.body.record.valid_to;report.observed_freshness=first.body.view.freshness;report.stored_sha256=first.body.stored_sha256;});
    await check('repeat staging is content-idempotent and does not refresh source age',async()=>{const repeat=await call(plan,'/stage',request);requireThat(repeat.status===200&&repeat.body.created===false&&repeat.body.record_digest===first.body.record_digest&&repeat.body.record.source_time===first.body.record.source_time,'STAGING_RETRY_NOT_IDEMPOTENT');});
    await check('exact staged object reads back with the same integrity hash',async()=>{const read=await call(plan,'/read?digest='+first.body.record_digest);requireThat(read.status===200&&read.body.stored_sha256===first.body.stored_sha256&&read.body.record.record_digest===first.body.record_digest&&read.body.view.action_eligible===false,'STAGING_READBACK_FAILED');});
    await check('staging capability cannot publish, control or delete',async()=>{for(const path of ['/commit','/control','/export'])requireThat((await call(plan,path,{})).status===404,'STAGING_AUTHORITY_PATH_PRESENT');requireThat((await call(plan,'/stage',undefined,plan.token,'DELETE')).status===405,'STAGING_DELETE_ALLOWED');});
    await check('historical owner records without explicit authors remain quarantined on cloud',async()=>{
      report.history=[];for(const historical of JSON.parse(await readFile(dir+'/history.private.json','utf8'))){
        const staged=await call(plan,'/stage',historical.request);requireThat(staged.status===200&&staged.body.record_digest===historical.expected.record_digest&&staged.body.record.source_time===historical.expected.source_time&&staged.body.record.normalization_status==='QUARANTINED'&&staged.body.view.action_eligible===false&&staged.body.record.source_author===null,'STAGING_HISTORY_NOT_QUARANTINED');
        const read=await call(plan,'/read?digest='+staged.body.record_digest);requireThat(read.status===200&&read.body.stored_sha256===staged.body.stored_sha256,'STAGING_HISTORY_READBACK_FAILED');
        report.history.push({source_day:staged.body.record.scope.operational_day,record_digest:staged.body.record_digest,source_time:staged.body.record.source_time,status:staged.body.record.normalization_status,reason_codes:staged.body.record.reason_codes,stored_sha256:staged.body.stored_sha256});
      }
    });
    await check('wrong source pin is rejected before any staging write',async()=>{const changed={...request,provenance:{...request.provenance,commit_sha:'0'.repeat(40)}};requireThat((await call(plan,'/stage',changed)).status===409,'STAGING_SOURCE_PIN_NOT_ENFORCED');});
    report.status='ISOLATED_MANUAL_STAGING_SUBSET_PASS';
  }catch(error){report.status='BLOCKED_OR_FAILED';report.error=error instanceof ContractError?error.code:'STAGING_PROOF_FAILED';throw error;}
  finally{await writeFile(dir+'/staging-evidence.public.json',JSON.stringify(report,null,2)+'\n');}
  console.log('Actual isolated data staging/readback subset passed. No publication or cutover.');
}
async function verifyClosed(){
  const plan=JSON.parse(await readFile(dir+'/plan.private.json','utf8'));const start=Date.now();let response;
  do{response=await call(plan,'/read?digest='+plan.expected.record_digest);if(response.status===401)break;if(Date.now()-start>=90000)break;await new Promise(resolve=>setTimeout(resolve,2000));}while(true);
  const report={status:response.status===401?'STAGING_CAPABILITY_DENIAL_OBSERVED':'BLOCKED_OR_FAILED',http_status:response.status,code_sha:process.env.GITHUB_SHA,run_id:process.env.GITHUB_RUN_ID,run_attempt:process.env.GITHUB_RUN_ATTEMPT,elapsed_ms:Date.now()-start};
  await writeFile(dir+'/closed-evidence.public.json',JSON.stringify(report,null,2)+'\n');requireThat(response.status===401,'STAGING_CAPABILITY_CLOSE_NOT_OBSERVED');
}
if(process.argv[1]?.endsWith('/manual-stage.js')){
  try{if(process.argv[2]==='prepare')await prepare();else if(process.argv[2]==='proof')await proof();else if(process.argv[2]==='verify-closed')await verifyClosed();else requireThat(false,'STAGING_COMMAND_INVALID');}
  catch(error){console.error(error instanceof ContractError?error.code:'STAGING_EXECUTION_FAILED');process.exitCode=1;}
}
