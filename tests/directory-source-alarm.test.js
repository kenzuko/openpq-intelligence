import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
import {DIRECTORY_FACT_ENVIRONMENT,DIRECTORY_FACT_ACCOUNT,DIRECTORY_FACT_GATE} from '../src/platform/directory-execution-contract.js';
test('native Directory alarm needs a private start capability and reschedules after a failed admission',async()=>{
 const mf=new Miniflare({cf:false,modules:true,scriptPath:fileURLToPath(new URL('../src/workers/directory-ingestion.js',import.meta.url)),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',durableObjects:{SOURCE_PUMPS:{className:'DirectorySourcePump',useSQLite:true}},bindings:{ENVIRONMENT_ID:DIRECTORY_FACT_ENVIRONMENT,ACCOUNT_ID:DIRECTORY_FACT_ACCOUNT,CANONICAL_DIRECTORY_GATE:DIRECTORY_FACT_GATE,SOURCE_START_TOKEN:'fixture-start-only'}});
 try{
  const url='https://fixture-source/start';
  assert.equal((await mf.dispatchFetch(url,{method:'POST'})).status,401);
  assert.equal((await mf.dispatchFetch(url,{method:'POST',headers:{authorization:'Bearer wrong'}})).status,401);
  const r=await mf.dispatchFetch(url,{method:'POST',headers:{authorization:'Bearer fixture-start-only'}});assert.equal(r.status,200);assert.equal((await r.json()).alarm_started,true);
  let health;for(let i=0;i<20;i++){health=await (await mf.dispatchFetch('https://fixture-source/health')).json();if(health.datasets[0].observation)break;await new Promise(resolve=>setTimeout(resolve,200));}
  assert.equal(health.datasets[0].observation.error,'INGEST_DATASET_CONFIG_DENIED');assert.equal(health.datasets[0].observation.operational_action_allowed,false);
  assert.ok(health.datasets[0].next_alarm>Date.now());assert.ok(health.datasets[0].next_alarm<=Date.now()+120000);
  assert.equal((await mf.dispatchFetch(url,{method:'PUT'})).status,404);
 }finally{await mf.dispose();}
});
