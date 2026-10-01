import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,createFetchMock} from 'miniflare';
import {fileURLToPath} from 'node:url';
test('GET-only S3 adapter runs in workerd using the native outbound fetch',async()=>{
  const mock=createFetchMock();mock.disableNetConnect();
  mock.get('https://test-account.r2.cloudflarestorage.com').intercept({path:'/isolated-test/canonical/object.json',method:'GET'}).reply(200,'synthetic canonical object');
  const mf=new Miniflare({modules:true,scriptPath:fileURLToPath(new URL('./fixtures/s3-worker.js',import.meta.url)),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-07-30',fetchMock:mock});
  try{const response=await mf.dispatchFetch('https://test/');assert.equal(response.status,200,await response.clone().text());assert.equal(await response.text(),'synthetic canonical object');mock.assertNoPendingInterceptors();}
  finally{await mf.dispose();await mock.close();}
});
