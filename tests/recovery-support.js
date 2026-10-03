import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
import {hash} from '../src/platform/contracts.js';
import {RECOVERY_BOOTSTRAP_VERSION} from '../src/platform/recovery-bootstrap.js';
import {setup} from './support.js';

const root=fileURLToPath(new URL('../',import.meta.url));
export async function recoveryFixture({persistPath}={}){
 const source=await setup();let mf;
 try{
  source.principals.find(x=>x.id==='operator').permissions.push('recovery-export');await source.mf.setOptions(source.options());
  const candidate=source.make(),prepared=await source.call('prepare',candidate);const committed=await source.commit(prepared.body,'old-commit');if(committed.status!==200)throw Error(JSON.stringify(committed));
  const publication=await source.call('export',{},'test-only-operator');if(publication.status!==200)throw Error(JSON.stringify(publication));
  const oldEnvelope=JSON.parse(await (await (await source.mf.getR2Bucket('CANONICAL','core')).get(`checkpoints/${source.trust.authority_instance_id}/${source.trust.recovery_generation}/latest.json`)).text());
  const exported=await source.call('recovery-export',{},'test-only-operator');if(exported.status!==200)throw Error(JSON.stringify(exported));const snapshot=exported.body;
  // Revoke the original command token on its original native route, not just the replacement route.
  source.principals.splice(source.principals.findIndex(x=>x.id==='live'),1);await source.mf.setOptions(source.options());
  const denial=await source.commit(prepared.body,'old-commit'),witness=await source.call('read',undefined,'test-only-read');
  if(denial.status!==401||witness.status!==200)throw Error('Local source command fencing failed');
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const privateKey=await crypto.subtle.exportKey('jwk',pair.privateKey),publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
  const trust={...source.trust,native_id:'0'.repeat(64),object_name:'local-test/recovery-'+crypto.randomUUID(),namespace_id:'local-recovery-sqlite-namespace',authority_instance_id:'local-recovered-authority',authority_locator_version:'2',recovery_generation:'local-recovery-generation-2',locator_artifact_hash:'b'.repeat(64),receipt_keys:{'recovered-key':publicKey},approved_positive_decision_types:[]};
  const signer={key_id:'recovered-key',private_jwk:privateKey};let principals=[],plan;
  const options=()=>({cf:false,host:'127.0.0.1',...(persistPath?{durableObjectsPersist:persistPath+'/native',r2Persist:persistPath+'/r2'}:{}),workers:[
   {name:'core',modules:true,scriptPath:root+'src/workers/core.js',modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',durableObjects:{DATASETS:{className:'DatasetCoordinator',useSQLite:true}},r2Buckets:{CANONICAL:'recovery-canonical'},bindings:{ENVIRONMENT_ID:'local-test',TRUST_JSON:JSON.stringify({[trust.dataset_id]:trust}),PRINCIPALS_JSON:JSON.stringify(principals),RECEIPT_SIGNING_JSON:JSON.stringify(signer),RECOVERY_PLANS_JSON:JSON.stringify(plan?{[trust.dataset_id]:plan}:{})}},
   {name:'reader',modules:true,scriptPath:root+'tests/reader-worker.js',compatibilityDate:'2026-07-30',r2Buckets:{CANONICAL:'recovery-canonical'}},
   {name:'runtime',modules:true,scriptPath:root+'src/workers/runtime.js',modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',serviceBindings:{CORE_READ:'core',TEST_READER:'reader'},bindings:{ENVIRONMENT_ID:'local-test',TRUST_JSON:JSON.stringify({[trust.dataset_id]:trust}),CONTROL_READ_TOKEN:'new-read',READER_TOKEN:'test-only-reader'}},
   {name:'client',modules:true,script:`export default {async fetch(request,env){const body=request.body?await request.arrayBuffer():undefined;return env.CORE.fetch(new Request(request.url,{method:request.method,headers:request.headers,...(body===undefined?{}:{body})}));}};`,compatibilityDate:'2026-07-30',serviceBindings:{CORE:'core'}}
  ]});
  mf=new Miniflare(options());trust.native_id=(await mf.getDurableObjectNamespace('DATASETS','core')).idFromName(trust.object_name).toString();
  plan={contract_version:RECOVERY_BOOTSTRAP_VERSION,source_authority:structuredClone(source.trust),target_authority_hash:await hash(trust),snapshot_digest:await hash(snapshot),snapshot_key:'recovery/snapshots/isolated-local-proof.json',owner:'recovery-pilot',old_epoch_high_watermark:7};
  principals.push(...[['new-recovery',['recovery-bootstrap','recovery-export']],['new-read',['read']],['new-operator',['control','bootstrap','promote','correct','export']]].map(([token,permissions])=>({...trust,token,id:token,permissions,owner:plan.owner,epoch:8,mode:'LIVE'})));
  await mf.setOptions(options());await (await mf.getR2Bucket('CANONICAL','core')).put(plan.snapshot_key,JSON.stringify(snapshot));
  const call=async(path,body,token='new-recovery')=>{const r=await (await mf.getWorker('client')).fetch(`https://core/datasets/${trust.dataset_id}/${path}`,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};
  const runtime=async()=>{const r=await (await mf.getWorker('runtime')).fetch('https://runtime/datasets/'+trust.dataset_id);return {status:r.status,body:await r.json()};};
  const make=overrides=>({...source.make(),...trust,decision:{type:'recovery.reference',kind:'FACT',effect:'ABSTAIN',minimum_evidence_met:false,action_until:new Date(Date.now()+3600000).toISOString(),reason_codes:['RECOVERY_FROZEN']},...overrides});
  return {source,snapshot,oldEnvelope,trust,signer,plan,principals,options,call,runtime,make,get mf(){return mf;},restart:async()=>{if(!persistPath)throw Error('Persistence required');await mf.dispose();mf=new Miniflare(options());await mf.ready;},local_fencing:{role:'OLD_COMMAND',http_status:denial.status,positive_witness_status:witness.status,scope:'LOCAL_NATIVE_ONLY',cloud_fencing_proven:false,storage_write_fencing_proven:false},dispose:async()=>{await mf.dispose();await source.mf.dispose();}};
 }catch(e){if(mf)await mf.dispose();await source.mf.dispose();throw e;}
}
