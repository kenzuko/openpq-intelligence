import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {hash,requireThat} from '../../src/platform/contracts.js';
import {BUCKET,WORKERS} from './preflight.js';

export async function prepareCloud(evidence,runId){
  requireThat(evidence.status==='PREFLIGHT_PASS'&&/^[a-z0-9-]{1,64}$/.test(runId),'PREFLIGHT_REQUIRED');
  const account=evidence.account_id,dataset='fixture.cano.operation.'+runId;
  await mkdir('.cloud-proof',{recursive:true});
  const common={account_id:account,compatibility_date:'2026-07-30',workers_dev:true,routes:[],vars:{ENVIRONMENT_ID:'isolated-test'}};
  const core={...common,name:WORKERS[0],main:'../scripts/cloud/provision-worker.js',vars:{...common.vars,PROVISION_DATASET_ID:dataset,PROVISION_OBJECT_NAME:'isolated-test/'+dataset},durable_objects:{bindings:[{name:'DATASETS',class_name:'DatasetCoordinator'}]},migrations:[{tag:'isolated-v1',new_sqlite_classes:['DatasetCoordinator']}],r2_buckets:[{binding:'CANONICAL',bucket_name:BUCKET}]};
  const runtime={...common,name:WORKERS[1],main:'../src/workers/runtime.js',services:[{binding:'CORE_READ',service:WORKERS[0]}]};
  const operator={...common,name:WORKERS[2],main:'../src/workers/operator.js',services:[{binding:'CORE_COMMAND',service:WORKERS[0]}]};
  const token=randomBytes(32).toString('hex');
  if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+token);
  await writeFile('.cloud-proof/provisioning-secrets.json',JSON.stringify({PROVISIONING_TOKEN:token}),{mode:0o600});
  for(const [name,config] of [['core',core],['runtime',runtime],['operator',operator]])await writeFile(`.cloud-proof/${name}.json`,JSON.stringify(config,null,2)+'\n');
  return {account_id:account,dataset_id:dataset,object_name:core.vars.PROVISION_OBJECT_NAME,provisioning_token:token};
}

export async function makeAuthority(plan,namespaceId,nativeId,readConfig){
  requireThat(/^[a-f0-9]{32}$/.test(namespaceId)&&/^[a-f0-9]{64}$/.test(nativeId),'NATIVE_LOCATOR_REQUIRED');
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const pub=await crypto.subtle.exportKey('jwk',pair.publicKey),priv=await crypto.subtle.exportKey('jwk',pair.privateKey);
  const artifacts={};
  for(const kind of ['rule','config','policy','schema'])artifacts[kind]=await hash({kind,version:'cloud-fixture-1',fixture_only:true,production_approved:false});
  const trust={account_id:plan.account_id,environment_id:'isolated-test',dataset_id:plan.dataset_id,object_name:plan.object_name,namespace_id:namespaceId,native_id:nativeId,authority_instance_id:'proof-'+plan.dataset_id,authority_locator_version:'1',recovery_generation:'fixture-generation-'+plan.dataset_id,artifacts,receipt_keys:{'proof-key':pub},approved_positive_decision_types:['cano.operation.fixture']};
  trust.locator_artifact_hash=await hash(trust);
  const tokens=Object.fromEntries(['live','read','operator','shadow','backfill','next','wrong'].map(n=>[n,randomBytes(32).toString('hex')]));
  for(const token of [...Object.values(tokens),priv.d,readConfig.secret])if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+token);
  const principal=(name,permissions,extra={})=>({...trust,id:'proof-'+name,token:tokens[name],mode:'LIVE',owner:'proof-owner',epoch:1,permissions,...extra});
  const principals=[principal('live',['promote']),principal('read',['read']),principal('operator',['read','control','bootstrap','promote','correct','export']),principal('shadow',['promote'],{mode:'SHADOW'}),principal('backfill',['promote'],{mode:'BACKFILL'}),principal('next',['promote'],{owner:'next-proof-owner',epoch:2}),principal('wrong',['promote'],{authority_instance_id:'wrong-authority'})];
  const map=JSON.stringify({[trust.dataset_id]:trust});
  return {trust,tokens,coreSecrets:{TRUST_JSON:map,PRINCIPALS_JSON:JSON.stringify(principals),RECEIPT_SIGNING_JSON:JSON.stringify({key_id:'proof-key',private_jwk:priv})},runtimeSecrets:{TRUST_JSON:map,CONTROL_READ_TOKEN:tokens.read,S3_READONLY_CONFIG:JSON.stringify(readConfig)}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const e=JSON.parse(await readFile('.cloud-proof/preflight.json','utf8'));
    const runId=process.env.GITHUB_RUN_ID?process.env.GITHUB_RUN_ID+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1'):randomBytes(8).toString('hex');
    const plan=await prepareCloud(e,runId);
    await writeFile('.cloud-proof/plan.private.json',JSON.stringify(plan),{mode:0o600});
    console.log('Prepared isolated config and temporary native-ID probe. No deployment performed.');
  }catch{console.error('CLOUD_PREPARATION_FAILED');process.exitCode=1;}
}
