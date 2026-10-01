import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {hash,requireThat} from '../../src/platform/contracts.js';
import {S3ReadonlyReader} from '../../src/platform/s3-reader.js';
import {boundedText} from '../../src/platform/bounded-text.js';
import {verifyAttestation} from '../../src/platform/receipts.js';
import {cloudPreflight,BUCKET} from './preflight.js';

export async function credentialFingerprint(config){return hash(config.access_key+'\0'+config.secret);}
export function isolatedPair(probe,witness,account){
  for(const config of [probe,witness])requireThat(config.bucket===BUCKET&&config.endpoint===`https://${account}.r2.cloudflarestorage.com`,'REVOCATION_SCOPE_FORBIDDEN');
  requireThat(/^[a-f0-9]{32}$/.test(account)&&probe.access_key&&probe.secret&&witness.access_key&&witness.secret,'REVOCATION_CREDENTIAL_REQUIRED');
  requireThat(probe.access_key!==witness.access_key,'RUNTIME_CREDENTIAL_REVOCATION_FORBIDDEN');
}
export async function signedObservation(config,key,fetcher=fetch){
  let status=null,code=null;
  const reader=new S3ReadonlyReader(config,async(url,options)=>{
    const response=await fetcher(url,{...options,signal:AbortSignal.timeout(15000)});status=response.status;
    if(status===403){
      try{const xml=await boundedText(response.clone(),8192);const match=xml.match(/<Code>([A-Za-z0-9]+)<\/Code>/);if(['AccessDenied','InvalidAccessKeyId'].includes(match?.[1]))code=match[1];}catch{}
    }
    return response;
  });
  try{const raw=await reader.get(key);return {status,raw,code};}
  catch{return {status,code};}
}
export async function observeR2Denial({probe,witness,key,digest,read=signedObservation,observe=()=>{},clock=Date.now,pause=ms=>new Promise(r=>setTimeout(r,ms)),timeout=120000}){
  const start=clock();let attempts=0;
  while(clock()-start<=timeout){
    const result=await read(probe,key);attempts++;
    observe({attempts,last_status:result.status,last_error_code:result.code,elapsed_ms:clock()-start});
    if(result.status===403&&['AccessDenied','InvalidAccessKeyId'].includes(result.code)){
      const control=await read(witness,key);
      requireThat(control.status===200&&typeof control.raw==='string'&&await hash(control.raw)===digest,'RUNTIME_WITNESS_UNAVAILABLE');
      return {status:'R2_DENIAL_OBSERVED',http_status:403,error_code:result.code,attempts,first_deny_after_probe_start_ms:clock()-start,witness_status:200};
    }
    requireThat(result.status===200&&typeof result.raw==='string'&&await hash(result.raw)===digest,'R2_DENIAL_NOT_ESTABLISHED');
    if(clock()-start>=timeout)break;
    await pause(Math.min(2000,timeout-(clock()-start)));
  }
  requireThat(false,'R2_REVOCATION_DENIAL_TIMEOUT');
}

export async function executeRevocation(phase){
  requireThat(['baseline','deny'].includes(phase),'REVOCATION_PHASE_INVALID');
  const trust=JSON.parse(await readFile('docs/evidence/cloud-36848850809/locator.public.json','utf8'));
  const account=process.env.CF_TEST_ACCOUNT_ID;
  requireThat(account===trust.account_id&&trust.environment_id==='isolated-test','REVOCATION_ACCOUNT_MISMATCH');
  const common={endpoint:`https://${account}.r2.cloudflarestorage.com`,bucket:BUCKET};
  const probe={...common,access_key:process.env.R2_REVOKE_PROBE_ACCESS_KEY_ID,secret:process.env.R2_REVOKE_PROBE_SECRET_ACCESS_KEY};
  const witness={...common,access_key:process.env.R2_TEST_READ_ACCESS_KEY_ID,secret:process.env.R2_TEST_READ_SECRET_ACCESS_KEY};
  isolatedPair(probe,witness,account);
  const fingerprint=await credentialFingerprint(probe);
  const preflightOptions={accountId:account,productionAccountIds:JSON.parse(process.env.CF_PRODUCTION_ACCOUNT_IDS||'null'),apiToken:process.env.CF_TEST_API_TOKEN};
  const preflight=await cloudPreflight({...preflightOptions,readAccessKey:witness.access_key});
  if(phase==='baseline')await cloudPreflight({...preflightOptions,readAccessKey:probe.access_key});
  requireThat(preflight.status==='PREFLIGHT_PASS','REVOCATION_PREFLIGHT_REQUIRED');
  await mkdir('.r2-revocation',{recursive:true});
  const provenance={account_id:account,bucket:BUCKET,credential_fingerprint:fingerprint,code_sha:process.env.GITHUB_SHA,run_id:process.env.GITHUB_RUN_ID,observed_at_utc:new Date().toISOString(),g1:'NOT_PASSED',runner_region:'GitHub runner, unspecified; not global propagation proof'};
  if(phase==='baseline'){
    const checkpoint=await new S3ReadonlyReader(witness).get(`checkpoints/${trust.authority_instance_id}/${trust.recovery_generation}/latest.json`);
    requireThat(checkpoint,'REVOCATION_CHECKPOINT_MISSING');
    const receipt=await verifyAttestation(JSON.parse(checkpoint),trust);
    const result=await signedObservation(probe,receipt.key),control=await signedObservation(witness,receipt.key);
    requireThat(result.status===200&&control.status===200&&typeof result.raw==='string'&&await hash(result.raw)===receipt.digest&&await hash(control.raw)===receipt.digest,'REVOCATION_BASELINE_GET_FAILED');
    const baseline={...provenance,status:'BASELINE_PASS',key:receipt.key,digest:receipt.digest,http_status:200,witness_status:200,trust_hash:await hash(trust)};
    await writeFile('.r2-revocation/r2-baseline.json',JSON.stringify(baseline,null,2)+'\n');
    console.log('BASELINE_PASS. Disposable credential can read the pinned object; do not revoke Runtime credentials.');
  }else{
    const baseline=JSON.parse(await readFile('.r2-revocation/download/r2-baseline.json','utf8'));
    requireThat(baseline.status==='BASELINE_PASS'&&baseline.run_id===process.env.BASELINE_RUN_ID&&baseline.account_id===account&&baseline.bucket===BUCKET&&baseline.credential_fingerprint===fingerprint&&baseline.trust_hash===await hash(trust),'REVOCATION_BASELINE_MISMATCH');
    requireThat(baseline.key.startsWith(`generations/${trust.authority_instance_id}/${trust.recovery_generation}/`)&&/^[a-f0-9]{64}$/.test(baseline.digest),'REVOCATION_OBJECT_SCOPE_INVALID');
    // Verify removal/disablement with the read-only account API as well as S3 denial.
    const metadata=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/tokens/${probe.access_key}`,{headers:{authorization:'Bearer '+process.env.CF_TEST_API_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});
    const removed=metadata.status===404||(metadata.ok&&['disabled','expired','revoked'].includes((await metadata.json()).result?.status));
    requireThat(removed,'DISPOSABLE_TOKEN_REVOCATION_NOT_CONFIRMED');
    const report={...provenance,status:'RUNNING',baseline_run_id:baseline.run_id,key:baseline.key,digest:baseline.digest,control_plane_revocation_confirmed:true};
    try{Object.assign(report,await observeR2Denial({probe,witness,key:baseline.key,digest:baseline.digest,observe:value=>report.observation=value}));}
    catch(error){report.status='BLOCKED_OR_FAILED';report.error=/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'REVOCATION_PROBE_FAILED';throw error;}
    finally{await writeFile('.r2-revocation/r2-denial.json',JSON.stringify(report,null,2)+'\n');}
    console.log('R2_DENIAL_OBSERVED with independent positive Runtime witness. Full G1 remains incomplete.');
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{await executeRevocation(process.env.REVOCATION_PHASE);}
  catch(error){console.error(/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'REVOCATION_PROBE_FAILED');process.exitCode=1;}
}
