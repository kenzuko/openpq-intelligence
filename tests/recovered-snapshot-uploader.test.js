import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
import {hash} from '../src/platform/contracts.js';
test('temporary recovered-snapshot uploader accepts only pinned immutable bytes in its exact run scope',async()=>{
 const key='recovery/snapshots/runtime-12345-weather.json',snapshot={fixture_only:true},digest=await hash(snapshot);
 const mf=new Miniflare({cf:false,modules:true,scriptPath:fileURLToPath(new URL('../scripts/cloud/recovered-snapshot-uploader.js',import.meta.url)),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',r2Buckets:{CANONICAL:'fixture-recovered-upload'},bindings:{ENVIRONMENT_ID:'isolated-test',RECOVERED_RUNTIME_RUN_ID:'12345',PROVISIONING_TOKEN:'fixture-only-token',RECOVERED_UPLOADS_JSON:JSON.stringify({[key]:digest})}});
 const call=(body,token='fixture-only-token')=>mf.dispatchFetch('https://uploader/snapshot-archive',{method:'PUT',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await call({key,snapshot},'wrong')).status,401);
  assert.equal((await call({key:key.replace('12345','67890'),snapshot})).status,403);
  assert.equal((await call({key:'generations/escape.json',snapshot})).status,403);
  assert.equal((await call({key,snapshot:{changed:true}})).status,409);
  assert.equal((await call({key,snapshot})).status,200);assert.equal((await call({key,snapshot})).status,200);
  assert.deepEqual(JSON.parse(await (await (await mf.getR2Bucket('CANONICAL')).get(key)).text()),snapshot);
 }finally{await mf.dispose();}
});
