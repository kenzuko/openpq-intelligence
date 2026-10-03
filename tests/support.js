import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { hash } from '../src/platform/contracts.js';

const root=fileURLToPath(new URL('../',import.meta.url));
export const iso=ms=>new Date(ms).toISOString();
export const H='a'.repeat(64);
export async function setup({faults=false,semanticProfile=null,progressConfig=null,dataset_id='cano.operation',manualOperator=false,realSourceReplayClock=false,domainOperator=false,domainReplayClock=false}={}) {
  let armed=null,entered=null,release=null;
  const gateHost=async request=>{
    const path=new URL(request.url).pathname;
    if(path==='/arm'){if(release)return Response.json({error:'already waiting'},{status:409});armed=await request.json();entered=null;return Response.json({armed:true});}
    if(path==='/status')return Response.json({entered});
    if(path==='/release'){if(release){release();release=null;}return Response.json({released:true});}
    if(path==='/gate'){
      const call=await request.json();if(!armed||armed.operation!==call.operation)return Response.json({action:'PASS'});
      const selected=armed;armed=null;entered=call;
      if(selected.action==='WAIT')await new Promise(resolve=>release=resolve);
      if(selected.action==='FAIL')return Response.json({action:'FAIL'},{status:503});
      return Response.json({action:selected.action});
    }
    return new Response(null,{status:404});
  };
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey), privateKey=await crypto.subtle.exportKey('jwk',pair.privateKey);
  const trust={environment_id:'local-test',dataset_id,authority_instance_id:'local-cano-authority',authority_locator_version:'1',locator_artifact_hash:H,namespace_id:'local-sqlite-namespace',object_name:'local-test/'+dataset_id,native_id:'0'.repeat(64),recovery_generation:'local-generation-1',artifacts:{rule:H,config:H,policy:H,schema:H},receipt_keys:{'local-key':publicKey}};
  trust.account_id='synthetic-local-account';
  let semanticBindings={},progressBindings={};if(progressConfig){progressBindings={ENVIRONMENT_ID:'local-test',PROGRESS_CONFIG_JSON:JSON.stringify(progressConfig),PROGRESS_CONFIG_HASH:await hash(progressConfig),SCHEDULER_TOKEN_HASH:await hash('test-only-scheduler'),EXPORT_ONLY_TOKEN:'test-only-export'};}if(semanticProfile){const {packAdmissionProfile}=await import('../src/platform/semantic-admission.js');semanticBindings=await packAdmissionProfile(semanticProfile);trust.semantic_profile_hash=await hash(semanticProfile);trust.artifacts=Object.fromEntries(['rule','config','policy','schema'].map(k=>[k,semanticProfile.artifact_refs[k].hash]));}
  trust.approved_positive_decision_types=['cano.operation.fixture'];
  const actor=(id,token,permissions,extra={})=>({...trust,id,token,permissions,mode:'LIVE',owner:'pilot',epoch:1,...extra});
  let principals;
  const options=()=>({cf:false,host:'127.0.0.1',workers:[
    {name:'core',modules:true,scriptPath:root+(domainReplayClock?'tests/domain-clock-core.js':realSourceReplayClock?'tests/real-cano-clock-core.js':'src/workers/core.js'),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',durableObjects:{DATASETS:{className:'DatasetCoordinator',useSQLite:true}},r2Buckets:{CANONICAL:'isolated-canonical'},bindings:{...semanticBindings,ENVIRONMENT_ID:'local-test',TRUST_JSON:JSON.stringify({[dataset_id]:trust}),PRINCIPALS_JSON:JSON.stringify(principals || []),RECEIPT_SIGNING_JSON:JSON.stringify({key_id:'local-key',private_jwk:privateKey})}},
    {name:'reader',modules:true,scriptPath:root+'tests/reader-worker.js',compatibilityDate:'2026-07-30',r2Buckets:{CANONICAL:'isolated-canonical'}},
    {name:'runtime',modules:true,scriptPath:root+(domainReplayClock?'tests/domain-clock-runtime.js':'src/workers/runtime.js'),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',serviceBindings:{CORE_READ:'core',TEST_READER:'reader'},bindings:{...semanticBindings,ENVIRONMENT_ID:'local-test',TRUST_JSON:JSON.stringify({[dataset_id]:trust}),CONTROL_READ_TOKEN:'test-only-read',READER_TOKEN:'test-only-reader'}}
  ]});
  const baseOptions=options;
  const effectiveOptions=()=>{
    const o=baseOptions();
    if(progressConfig)o.workers.push({name:'progress',modules:true,scriptPath:root+'src/workers/progress.js',modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',durableObjects:{PROGRESS:{className:'ProgressScheduler',useSQLite:true}},bindings:progressBindings,serviceBindings:{CORE_EXPORT:'core'}});
    if(faults){o.workers[0].scriptPath=root+'tests/fault-core-worker.js';o.workers[0].serviceBindings={FAULT_GATE:'fault'};o.workers.push({name:'fault',modules:true,scriptPath:root+'tests/fault-gate-worker.js',compatibilityDate:'2026-07-30',serviceBindings:{GATE_HOST:gateHost}});}
    return o;
  };
  const mf=new Miniflare(effectiveOptions());
  const ns=await mf.getDurableObjectNamespace('DATASETS','core');trust.native_id=ns.idFromName(trust.object_name).toString();
  principals=[actor('live','test-only-live',['promote']),actor('read','test-only-read',['read']),actor('operator','test-only-operator',['control','bootstrap','correct','promote','export',...(manualOperator?['manual-source-admit']:[]),...(domainOperator?['domain-source-admit']:[])]),actor('shadow','test-only-shadow',['promote'],{mode:'SHADOW'}),actor('backfill','test-only-backfill',['promote'],{mode:'BACKFILL'}),actor('next','test-only-next',['promote'],{owner:'new-pilot',epoch:2}),actor('wrong','test-only-wrong',['promote'],{authority_instance_id:'alternate'})];
  if(progressConfig)principals.push(actor('exporter','test-only-export',['export']));
  await mf.setOptions(effectiveOptions());
  const core=await mf.getWorker('core'), runtime=await mf.getWorker('runtime');
  const call=async(path,body,token='test-only-live')=>{
    const current=await mf.getWorker('core');
    const r=await current.fetch(`https://core/datasets/${dataset_id}/${path}`,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:r.status,body:await r.json()};
  };
  const bootstrap=await call('bootstrap',{...trust,owner:'pilot',epoch:1},'test-only-operator');
  if(bootstrap.status!==200)throw new Error('Bootstrap failed '+JSON.stringify(bootstrap));
  const make=(overrides={})=>{const now=Date.now();return {schema_version:'openpq-candidate-v1',...trust,candidate_id:crypto.randomUUID(),expected_revision:0,expected_control_revision:0,logical_slot:10,evaluation_time:iso(now),valid_from:iso(now-1000),valid_to:iso(now+3600000),inputs:[{source_id:'synthetic-manual-fixture',source_type:'MANUAL',source_time:iso(now-1000),valid_to:iso(now+3600000),max_age_ms:3600000}],quality:{completeness:'COMPLETE',resolution:'RESOLVED'},artifacts:trust.artifacts,payload:{confirmation:'CONFIRMED',fixture_only:true},operation:'NORMAL',decision:{type:'cano.operation.fixture',kind:'FACT',effect:'POSITIVE',action_until:iso(now+3600000),minimum_evidence_met:true,reason_codes:['FIXTURE_CONFIRMATION']},...overrides};};
  const commit=async(p,id=crypto.randomUUID(),token='test-only-live')=>call('commit',{...trust,command_id:id,digest:p.digest,expires_at:iso(Date.now()+60000)},token);
  return {mf,trust,call,make,commit,core,runtime,privateKey,options:effectiveOptions,principals,ns,hash};
}
