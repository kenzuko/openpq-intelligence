import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
import {hash} from '../../src/platform/contracts.js';
import {RECOVERY_BOOTSTRAP_VERSION} from '../../src/platform/recovery-bootstrap.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function recoveredDomain(archive,persistPath){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),private_jwk=await crypto.subtle.exportKey('jwk',pair.privateKey),pub=await crypto.subtle.exportKey('jwk',pair.publicKey);
 const trust={...structuredClone(archive.trust),object_name:'local-test/domain-recovery/'+crypto.randomUUID(),native_id:'0'.repeat(64),namespace_id:'local-domain-recovery',authority_instance_id:'recovered-'+archive.bundle.profile.domain,authority_locator_version:'2',recovery_generation:'recovered-domain-v2',locator_artifact_hash:'0'.repeat(64),receipt_keys:{'recovered-key':pub},approved_positive_decision_types:[]};
 let plan,mf;const principals=[];
 const options=()=>({cf:false,host:'127.0.0.1',durableObjectsPersist:persistPath+'/native',r2Persist:persistPath+'/r2',workers:[{name:'core',modules:true,scriptPath:root+'src/workers/core.js',modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',durableObjects:{DATASETS:{className:'DatasetCoordinator',useSQLite:true}},r2Buckets:{CANONICAL:'recovered-domain'},bindings:{ENVIRONMENT_ID:'local-test',TRUST_JSON:JSON.stringify({[trust.dataset_id]:trust}),PRINCIPALS_JSON:JSON.stringify(principals),RECEIPT_SIGNING_JSON:JSON.stringify({key_id:'recovered-key',private_jwk}),RECOVERY_PLANS_JSON:JSON.stringify(plan?{[trust.dataset_id]:plan}:{})}},{name:'client',modules:true,script:`export default {async fetch(r,e){const body=r.body?await r.arrayBuffer():undefined;return e.CORE.fetch(new Request(r.url,{method:r.method,headers:r.headers,...(body===undefined?{}:{body})}));}};`,compatibilityDate:'2026-07-30',serviceBindings:{CORE:'core'}}]});
 try{
  mf=new Miniflare(options());trust.native_id=(await mf.getDurableObjectNamespace('DATASETS','core')).idFromName(trust.object_name).toString();trust.locator_artifact_hash=await hash(trust);
  const slot=archive.bundle.profile.domain;
  plan={contract_version:RECOVERY_BOOTSTRAP_VERSION,source_authority:archive.trust,target_authority_hash:await hash(trust),snapshot_digest:await hash(archive.bundle.snapshot),snapshot_key:`recovery/snapshots/${slot}.json`,owner:'domain-recovery-owner',old_epoch_high_watermark:7,domain_archive:{key:`recovery/domains/${slot}.json`,digest:await hash(archive.bundle)}};
  principals.push(...[['recovery',['recovery-bootstrap','recovery-read','recovery-export']],['read',['read']],['operator',['control','bootstrap']]].map(([id,permissions])=>({...trust,id,token:'new-'+id,permissions,owner:plan.owner,epoch:8,mode:'LIVE'})));
  await mf.setOptions(options());const b=await mf.getR2Bucket('CANONICAL','core');await b.put(plan.snapshot_key,JSON.stringify(archive.bundle.snapshot));await b.put(plan.domain_archive.key,JSON.stringify(archive.bundle));
  return {trust,plan,principals,options,get mf(){return mf;},call:async(path,body,token='new-recovery')=>{if(path!=='read'&&body===undefined)body={};const r=await (await mf.getWorker('client')).fetch(`https://core/datasets/${trust.dataset_id}/${path}`,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};},restart:async()=>{await mf.dispose();mf=new Miniflare(options());await mf.ready;},dispose:()=>mf.dispose()};
 }catch(e){if(mf)await mf.dispose();throw e;}
}
