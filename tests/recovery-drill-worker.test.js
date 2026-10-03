import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
import {setup} from './support.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const vars={ENVIRONMENT_ID:'isolated-test',RECOVERY_DRILL_RUN_ID:'123456',RECOVERY_DRILL_ROLE:'target',PROVISIONING_TOKEN:'fixture-provision',STORAGE_WRITER_TOKEN:'fixture-storage-writer'};
const options=bindings=>({cf:false,host:'127.0.0.1',workers:[{name:'drill',modules:true,scriptPath:root+'scripts/cloud/recovery-drill-worker.js',modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',durableObjects:{DATASETS:{className:'DatasetCoordinator',useSQLite:true}},r2Buckets:{CANONICAL:'fixture-drill-canonical'},bindings},{name:'client',modules:true,script:`export default {async fetch(request,env){const body=request.body?await request.arrayBuffer():undefined;return env.DRILL.fetch(new Request(request.url,{method:request.method,headers:request.headers,...(body===undefined?{}:{body})}));}};`,compatibilityDate:'2026-07-30',serviceBindings:{DRILL:'drill'}}]});
const call=async(mf,path,token,body,method='PUT')=>(await mf.getWorker('client')).fetch('https://drill'+path,{method,headers:{authorization:'Bearer '+token},...(body===undefined?{}:{body})});
test('native drill activation is visible only after successful authenticated read and preserves control',async()=>{
 const s=await setup({environment_id:'isolated-test'});
 try{
  const before=await s.call('read',undefined,'test-only-read'),o=s.options();
  o.workers[0].scriptPath=root+'scripts/cloud/recovery-drill-worker.js';
  Object.assign(o.workers[0].bindings,{RECOVERY_DRILL_RUN_ID:'123456',RECOVERY_DRILL_ROLE:'target'});
  await s.mf.setOptions(o);
  const after=await s.call('read',undefined,'test-only-read');
  assert.equal(after.status,200);assert.deepEqual(after.body.state,before.body.state);
  assert.equal(after.body.instance_observation.drill_activation,'local');
  assert.notEqual(after.body.instance_observation.incarnation_id,before.body.instance_observation.incarnation_id);
  const denied=await s.call('read',undefined,'unregistered-token');assert.equal(denied.status,401);assert.equal(denied.body.instance_observation,undefined);
 }finally{await s.mf.dispose();}
});
test('temporary cloud adapter limits writes to its own run keys and pins immutable snapshot bytes',async()=>{
 const mf=new Miniflare(options(vars));try{
  assert.equal((await call(mf,'/snapshot-archive','wrong','{}')).status,401);
  assert.equal((await call(mf,'/storage-write',vars.STORAGE_WRITER_TOKEN,'x'.repeat(4097))).status,413);
  const saved=await call(mf,'/snapshot-archive',vars.STORAGE_WRITER_TOKEN,'{"fixture_only":true}');assert.equal(saved.status,200);assert.equal((await saved.json()).key,'recovery/snapshots/123456.json');
  assert.equal((await call(mf,'/snapshot-archive',vars.STORAGE_WRITER_TOKEN,'{"fixture_only":true}')).status,200);
  assert.equal((await call(mf,'/snapshot-archive',vars.STORAGE_WRITER_TOKEN,'{"changed":true}')).status,409);
  assert.equal((await call(mf,'/storage-write',vars.STORAGE_WRITER_TOKEN,'{}','DELETE')).status,405);
  const probe=await call(mf,'/probe',vars.PROVISIONING_TOKEN,undefined,'GET');assert.equal(probe.status,200);assert.equal((await probe.json()).object_name,'isolated-test/fixture.recovery.123456/target');
 }finally{await mf.dispose();}
});
test('revoked gateway token is auth-denied and source adapter cannot archive a snapshot',async()=>{
 const mf=new Miniflare(options({...vars,RECOVERY_DRILL_ROLE:'source'}));try{
  assert.equal((await call(mf,'/snapshot-archive',vars.STORAGE_WRITER_TOKEN,'{}')).status,403);
  assert.equal((await call(mf,'/storage-write',vars.STORAGE_WRITER_TOKEN,'{}')).status,200);
  await mf.setOptions(options({...vars,STORAGE_WRITER_TOKEN:''}));assert.equal((await call(mf,'/storage-write',vars.STORAGE_WRITER_TOKEN,'{}')).status,401);
  await mf.setOptions(options({...vars,ENVIRONMENT_ID:'production'}));assert.equal((await call(mf,'/probe',vars.PROVISIONING_TOKEN,undefined,'GET')).status,503);
 }finally{await mf.dispose();}
});
test('domain drill adapter pins dataset identity and a distinct immutable archive slot',async()=>{
 const bindings={...vars,RECOVERY_DRILL_DATASET:'weather.compact.bridge.phu-quoc',RECOVERY_ARCHIVE_SLOT:'123456-weather_compact'},mf=new Miniflare(options(bindings));try{
  const probe=await call(mf,'/probe',vars.PROVISIONING_TOKEN,undefined,'GET'),identity=await probe.json();assert.equal(identity.dataset_id,bindings.RECOVERY_DRILL_DATASET);assert.equal(identity.object_name,'isolated-test/weather.compact.bridge.phu-quoc/123456/target');
  const saved=await call(mf,'/domain-archive',vars.STORAGE_WRITER_TOKEN,'{}');assert.equal(saved.status,200);assert.equal((await saved.json()).key,'recovery/domains/123456-weather_compact.json');assert.equal((await call(mf,'/domain-archive',vars.STORAGE_WRITER_TOKEN,'{"changed":true}')).status,409);
  await mf.setOptions(options({...bindings,RECOVERY_DRILL_ROLE:'source'}));assert.equal((await call(mf,'/domain-archive',vars.STORAGE_WRITER_TOKEN,'{}')).status,403);
  await mf.setOptions(options({...bindings,RECOVERY_DRILL_DATASET:'unregistered'}));assert.equal((await call(mf,'/probe',vars.PROVISIONING_TOKEN,undefined,'GET')).status,403);
 }finally{await mf.dispose();}
});
