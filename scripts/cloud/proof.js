import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {ContractError,hash,requireThat} from '../../src/platform/contracts.js';
import {S3ReadonlyReader} from '../../src/platform/s3-reader.js';
import {denyProbe} from './s3-deny-probe.js';
import {loseCommittedResponse,observeRestart} from './response-loss.js';
import {waitForCapabilityStatus} from './capability-readiness.js';
import {PRINCIPAL_SECRET_NAMES} from '../../src/platform/auth.js';

const report={status:'RUNNING',g1:'NOT_PASSED',cases:[],remaining:['cloud crash/timeout injection','revoked R2 credential propagation evidence','retention/GC pins','disaster restore/RPO/RTO','quota/cost profiling and unattended resilience']};
const iso=ms=>new Date(ms).toISOString();
let proof,coreSecrets,runtimeSecrets,lossCommand,lossReceipt;
const save=()=>writeFile('.cloud-proof/cloud-evidence.json',JSON.stringify(report,null,2)+'\n');
const check=async(name,fn)=>{const start=Date.now();try{await fn();report.cases.push({name,status:'PASS',elapsed_ms:Date.now()-start,observed_at_utc:iso(Date.now())});}catch(e){report.cases.push({name,status:'FAIL',error:e instanceof ContractError?e.code:'PROOF_ASSERTION_FAILED',elapsed_ms:Date.now()-start});throw e;}finally{await save();}};
const core=async(path,body,token)=>{report.runner_counts??={core_requests:0,runtime_requests:0,core_redeploys:0};report.runner_counts.core_requests++;const r=await fetch(proof.origins.core+'/datasets/'+proof.trust.dataset_id+'/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};
const state=async()=>{const r=await core('read',undefined,proof.tokens.operator);requireThat(r.status===200,'CORE_STATE_UNAVAILABLE');return r.body.state;};
const candidate=async()=>{const s=await state(),now=Date.now();return {schema_version:'openpq-candidate-v1',...proof.trust,candidate_id:randomUUID(),expected_revision:s.revision,expected_control_revision:s.control_revision,logical_slot:s.revision+10,evaluation_time:iso(now),valid_from:iso(now-1000),valid_to:iso(now+3600000),inputs:[{source_id:'synthetic-cloud-fixture',source_type:'MANUAL',source_time:iso(now-1000),valid_to:iso(now+3600000),max_age_ms:3600000}],quality:{completeness:'COMPLETE',resolution:'RESOLVED'},artifacts:proof.trust.artifacts,payload:{fixture_only:true,not_a_real_operational_status:true},operation:'NORMAL',decision:{type:'cano.operation.fixture',kind:'FACT',effect:'POSITIVE',action_until:iso(now+3600000),minimum_evidence_met:true,reason_codes:['SYNTHETIC_CLOUD_PROOF']}};};
const prepare=async(c,token=proof.tokens.live)=>{const p=await core('prepare',c,token);requireThat(p.status===200,'PREPARE_FAILED');return p.body;};
const commit=(p,token=proof.tokens.live,id=randomUUID())=>core('commit',{...proof.trust,command_id:id,digest:p.digest,expires_at:iso(Date.now()+60000)},token);
const control=async(body)=>core('control',{command_id:randomUUID(),expected_control_revision:(await state()).control_revision,expires_at:iso(Date.now()+60000),reason:'synthetic cloud protocol proof',...body},proof.tokens.operator);
const runtime=async()=>{report.runner_counts.runtime_requests++;const r=await fetch(proof.origins.runtime+'/datasets/'+proof.trust.dataset_id,{redirect:'error',signal:AbortSignal.timeout(15000)});return {status:r.status,body:await r.json()};};
const putSecrets=file=>{
  const result=spawnSync('node_modules/.bin/wrangler',['secret','bulk',file,'--config','.cloud-proof/core.json'],{stdio:'pipe',encoding:'utf8',env:{...process.env,CLOUDFLARE_API_TOKEN:process.env.CF_TEST_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:proof.trust.account_id,WRANGLER_SEND_METRICS:'false'}});
  requireThat(result.status===0,'TEST_CORE_SECRET_UPDATE_FAILED',503);
  redeployCore();
};
const redeployCore=()=>{
  const deployed=spawnSync('node_modules/.bin/wrangler',['deploy','--config','.cloud-proof/core.json'],{stdio:'pipe',encoding:'utf8',env:{...process.env,CLOUDFLARE_API_TOKEN:process.env.CF_TEST_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:proof.trust.account_id,WRANGLER_SEND_METRICS:'false'}});
  requireThat(deployed.status===0,'TEST_CORE_SECRET_DEPLOY_FAILED',503);
  report.runner_counts.core_redeploys++;
};
const waitForReadStatus=async(status,phase)=>{
  const observation={phase,expected_status:status};
  report.capability_observations??=[];report.capability_observations.push(observation);
  try{await waitForCapabilityStatus(()=>core('read',undefined,proof.tokens.read),status,{observe:value=>Object.assign(observation,value)});}
  finally{await save();}
};

const waitForRestart=async(previous,phase)=>{
  const observation={phase,previous_incarnation_id:previous};
  report.restart_observations??=[];report.restart_observations.push(observation);
  try{return await observeRestart(()=>core('read',undefined,proof.tokens.read),previous,{observe:value=>Object.assign(observation,value)});}
  finally{await save();}
};

try{
  proof=JSON.parse(await readFile('.cloud-proof/proof.private.json','utf8'));coreSecrets=JSON.parse(await readFile('.cloud-proof/core-secrets.json','utf8'));runtimeSecrets=JSON.parse(await readFile('.cloud-proof/runtime-secrets.json','utf8'));
  report.account_id=proof.trust.account_id;report.dataset_id=proof.trust.dataset_id;report.locator=proof.trust;report.code_sha=process.env.GITHUB_SHA||'LOCAL';
  report.observation={runner_region:'GitHub-hosted runner, region unspecified',run_id:process.env.GITHUB_RUN_ID||'LOCAL',run_attempt:process.env.GITHUB_RUN_ATTEMPT||'LOCAL',node:process.version,wrangler:'4.145.0',started_at_utc:iso(Date.now())};
  report.config_hashes=Object.fromEntries(await Promise.all(['core','runtime','operator'].map(async kind=>[kind,await hash(await readFile(`.cloud-proof/${kind}.json`,'utf8'))])));
  await check('temporary native-ID probe is absent from final Core',async()=>{
    report.provision_route_observation={expected_status:404};
    try{await waitForCapabilityStatus(()=>fetch(proof.origins.core+'/probe',{redirect:'error',signal:AbortSignal.timeout(15000)}),404,{failureCode:'PROVISION_ROUTE_REMOVAL_NOT_OBSERVED',observe:value=>Object.assign(report.provision_route_observation,value)});}
    finally{await save();}
  });
  await check('bootstrap is single-use and native locator-pinned',async()=>{const body={...proof.trust,owner:'proof-owner',epoch:1};requireThat((await core('bootstrap',body,proof.tokens.operator)).status===200,'BOOTSTRAP_FAILED');requireThat((await core('bootstrap',body,proof.tokens.operator)).status===409,'BOOTSTRAP_NOT_SINGLE_USE');});
  await check('read/shadow/backfill/alternate authority cannot prepare',async()=>{const c=await candidate();for(const actor of ['read','shadow','backfill','wrong'])requireThat((await core('prepare',c,proof.tokens[actor])).status===403,'UNAUTHORIZED_PROMOTION_ALLOWED');});
  await check('two same-revision publications race, exactly one advances',async()=>{const c=await candidate(),a=await prepare(c),b=await prepare({...c,candidate_id:randomUUID()});const result=await Promise.all([commit(a),commit(b)]);requireThat(result.filter(r=>r.status===200).length===1&&result.filter(r=>r.status===409).length===1,'PUBLICATION_RACE_FAILED');requireThat((await state()).revision===1,'RACE_REVISION_INVALID');});
  await check('idempotent command retry does not create another revision',async()=>{const s=await state(),r=await commit({digest:s.active.digest},proof.tokens.live,s.active.command_id);requireThat(r.status===200&&r.body.receipt.revision===1&&(await state()).revision===1,'COMMIT_NOT_IDEMPOTENT');});
  await check('Runtime verifies committed blob via real read-only S3 adapter',async()=>{const r=await runtime();requireThat(r.status===200,typeof r.body.error==='string'&&/^[A-Z0-9_]{1,80}$/.test(r.body.error)?'RUNTIME_'+r.body.error:'RUNTIME_HTTP_'+r.status);requireThat(r.body.serving.authority==='VERIFIED'&&r.body.serving.decision_eligibility==='ELIGIBLE','RUNTIME_NOT_VERIFIED');const config=JSON.parse(runtimeSecrets.S3_READONLY_CONFIG),raw=await new S3ReadonlyReader(config).get(r.body.receipt.key);requireThat(raw&&await hash(raw)===r.body.receipt.digest,'S3_GET_HASH_MISMATCH');});
  await check('control update invalidates prepared candidate and previous validation',async()=>{const p=await prepare(await candidate());requireThat((await control({action:'FREEZE',frozen:true})).status===200,'FREEZE_FAILED');requireThat((await commit(p)).body.error==='RECOMPUTE_REQUIRED','STALE_CONTROL_COMMIT_ALLOWED');requireThat((await runtime()).body.serving.decision_eligibility==='UNVERIFIED','OLD_VALIDATION_STILL_ACTIONABLE');requireThat((await control({action:'FREEZE',frozen:false})).status===200,'UNFREEZE_FAILED');requireThat((await commit(await prepare(await candidate()))).status===200,'RECOMPUTED_PUBLICATION_FAILED');});
  await check('owner epoch fences old writer after transfer',async()=>{const p=await prepare(await candidate());requireThat((await control({action:'TRANSFER',owner:'next-proof-owner'})).status===200,'TRANSFER_FAILED');requireThat((await commit(p)).body.error==='OWNER_EPOCH_DENIED','OLD_OWNER_COMMIT_ALLOWED');requireThat((await commit(await prepare(await candidate(),proof.tokens.next),proof.tokens.next)).status===200,'NEW_OWNER_COMMIT_FAILED');});
  await check('committed outbox exports signed checkpoint and retry is empty',async()=>{const r=await core('export',{},proof.tokens.operator);requireThat(r.status===200&&r.body.exported.length===3,'EXPORT_FAILED');requireThat((await core('export',{},proof.tokens.operator)).body.exported.length===0,'EXPORT_RETRY_INVALID');});
  await check('actual Runtime R2 key denies PUT and DELETE',async()=>{const config=JSON.parse(runtimeSecrets.S3_READONLY_CONFIG),key='proof-deny/'+proof.trust.dataset_id+'.json';await denyProbe(config,proof.trust.account_id,'PUT',key);await denyProbe(config,proof.trust.account_id,'DELETE',key);});
  await check('Runtime HTTP is GET-only and read capability cannot issue controls',async()=>{const r=await fetch(proof.origins.runtime+'/datasets/'+proof.trust.dataset_id,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000)});requireThat(r.status===405,'RUNTIME_WRITE_ALLOWED');requireThat((await core('control',{},proof.tokens.read)).status===403,'READ_CONTROL_ALLOWED');});
  await check('Core read outage gives cold signed checkpoint with no GO eligibility',async()=>{
    const outage=Object.fromEntries(PRINCIPAL_SECRET_NAMES.map(name=>[name,JSON.stringify(JSON.parse(coreSecrets[name]||'[]').filter(p=>p.token!==proof.tokens.read))]));
    await writeFile('.cloud-proof/outage-secrets.json',JSON.stringify(outage),{mode:0o600});
    try{putSecrets('.cloud-proof/outage-secrets.json');await waitForReadStatus(401,'REVOKE');const r=await runtime();requireThat(r.status===200&&r.body.receipt.revision===3&&r.body.serving.fallback===true&&r.body.serving.decision_eligibility==='UNVERIFIED','OUTAGE_FALLBACK_UNSAFE');}
    finally{putSecrets('.cloud-proof/core-secrets.json');await waitForReadStatus(200,'RESTORE');}
  });
  await check('client loses commit response over runner socket; identical retry advances only once',async()=>{
    const before=await state(),p=await prepare(await candidate(),proof.tokens.next);
    lossCommand={...proof.trust,command_id:randomUUID(),digest:p.digest,expires_at:iso(Date.now()+60000)};
    report.response_loss=await loseCommittedResponse(()=>fetch(proof.origins.core+'/datasets/'+proof.trust.dataset_id+'/commit',{method:'POST',headers:{authorization:'Bearer '+proof.tokens.next,'content-type':'application/json'},body:JSON.stringify(lossCommand),redirect:'error',signal:AbortSignal.timeout(15000)}));
    const committed=await state();requireThat(committed.revision===before.revision+1&&committed.active.command_id===lossCommand.command_id,'LOST_RESPONSE_COMMIT_STATE_INVALID');
    const retry=await core('commit',lossCommand,proof.tokens.next);
    requireThat(retry.status===200&&await hash(retry.body.receipt)===await hash(committed.active)&&(await state()).revision===committed.revision,'LOST_RESPONSE_RETRY_DUPLICATED');
    lossReceipt=retry.body.receipt;
  });
  await check('signer outage preserves authority and pending outbox; restoration exports exactly once',async()=>{
    const before=await state();
    await writeFile('.cloud-proof/signer-outage-secrets.json',JSON.stringify({RECEIPT_SIGNING_JSON:'{}'}),{mode:0o600});
    try{
      const old=await core('read',undefined,proof.tokens.read);
      putSecrets('.cloud-proof/signer-outage-secrets.json');
      await waitForRestart(old.body.instance_observation.incarnation_id,'SIGNER_OUTAGE');
      const failed=await core('export',{},proof.tokens.operator);
      requireThat(failed.status===503&&failed.body.error==='SIGNER_UNAVAILABLE','SIGNER_OUTAGE_NOT_OBSERVED');
      requireThat(await hash(await state())===await hash(before),'EXPORT_FAILURE_MUTATED_AUTHORITY');
    }finally{putSecrets('.cloud-proof/core-secrets.json');await waitForReadStatus(200,'SIGNER_RESTORE');}
    let exported;
    report.signer_export_restore_observation={expected_status:200};
    try{await waitForCapabilityStatus(async()=>{exported=await core('export',{},proof.tokens.operator);return exported;},200,{failureCode:'SIGNER_EXPORT_RESTORE_NOT_OBSERVED',observe:value=>Object.assign(report.signer_export_restore_observation,value)});}
    finally{await save();}
    requireThat(exported.status===200&&exported.body.exported.length===1&&exported.body.exported[0]===lossReceipt.revision,'OUTBOX_RECOVERY_FAILED');
    requireThat((await core('export',{},proof.tokens.operator)).body.exported.length===0,'OUTBOX_RECOVERY_DUPLICATED');
  });
  await check('observed Coordinator restart preserves active state and command receipt',async()=>{
    const before=await core('read',undefined,proof.tokens.read),old=before.body.instance_observation.incarnation_id;
    requireThat(typeof old==='string','INCARNATION_OBSERVATION_REQUIRED');
    redeployCore();
    const restarted=await waitForRestart(old,'FINAL_REDEPLOY');
    requireThat(await hash(await state())===await hash(before.body.state),'RESTART_LOST_AUTHORITY_STATE');
    const retry=await core('commit',lossCommand,proof.tokens.next);
    requireThat(retry.status===200&&await hash(retry.body.receipt)===await hash(lossReceipt),'RESTART_LOST_COMMAND_DEDUP');
    const r=await runtime();requireThat(r.status===200&&r.body.receipt.revision===lossReceipt.revision&&r.body.serving.authority==='VERIFIED','RESTART_RUNTIME_INVALID');
    report.restart_observation={before_incarnation_id:old,...restarted};
  });
  report.measurement_limits='Runner counts and case durations only; not billed DO/R2 operations, memory, multi-region latency or cost evidence.';
  report.status='CLOUD_PROTOCOL_SUBSET_PASS';await save();console.log('Cloud protocol subset passed; G1 remains incomplete. Read cloud-evidence.json.');
}catch(e){report.status='BLOCKED_OR_FAILED';report.error=e instanceof ContractError?e.code:'CLOUD_PROOF_FAILED';await save();console.error(report.error);process.exitCode=1;}
