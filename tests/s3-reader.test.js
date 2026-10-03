import test from 'node:test';
import assert from 'node:assert/strict';
import {S3ReadonlyReader} from '../src/platform/s3-reader.js';
const config={endpoint:'https://test-account.r2.cloudflarestorage.com',bucket:'isolated-test',access_key:'fixture',secret:'synthetic-fixture-secret'};
test('S3 adapter only signs GET, preserves key separators and rejects redirects/path traversal',async()=>{
  let seen;const reader=new S3ReadonlyReader(config,async(url,options)=>{seen={url,options};return new Response('fixture');},()=>Date.parse('2026-10-01T00:00:00Z'));
  assert.equal(await reader.get('a//b +.json'),'fixture');assert.equal(seen.url,'https://test-account.r2.cloudflarestorage.com/isolated-test/a//b%20%2B.json');assert.equal(seen.options.method,'GET');assert.equal(seen.options.redirect,'manual');assert.match(seen.options.headers.authorization,/20261001\/auto\/s3\/aws4_request/);assert.equal(seen.options.headers['x-amz-date'],'20261001T000000Z');
  await assert.rejects(reader.get('../escape'));await assert.rejects(reader.get('a\\b'));
  await assert.rejects(new S3ReadonlyReader({...config,endpoint:'http://unsafe'},async()=>{throw new Error('must not fetch');}).get('a'));
});
test('denied and unavailable S3 reads do not become fabricated data',async()=>{
  assert.equal(await new S3ReadonlyReader(config,async()=>new Response('',{status:404})).get('missing'),null);
  for(const status of [301,302,307,308,403,500])await assert.rejects(new S3ReadonlyReader(config,async()=>new Response('',{status})).get('a'),/S3_READ_UNAVAILABLE/);
});
test('streamed oversized canonical object is cancelled without unbounded buffering',async()=>{
  let cancelled=false;const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(131073));},cancel(){cancelled=true;}});
  await assert.rejects(new S3ReadonlyReader(config,async()=>new Response(stream)).get('a'),/CANONICAL_TOO_LARGE/);assert.equal(cancelled,true);
});
test('larger signed recovery archives use explicit bounded reads while Runtime canonical limits remain unchanged',async()=>{
 const payload='x'.repeat(300000),reader=new S3ReadonlyReader(config,async()=>new Response(payload));
 await assert.rejects(reader.get('recovery/domains/example.json'),/CANONICAL_TOO_LARGE/);
 assert.equal((await reader.get('recovery/domains/example.json',{max_bytes:400000})).length,300000);
 for(const [key,max_bytes] of [['generations/example.json',400000],['recovery/domains/example.json',16*1024*1024+1],['recovery/domains/example.json',NaN],['recovery/domains/example.json',-1]])await assert.rejects(reader.get(key,{max_bytes}),/S3_ARCHIVE_LIMIT_INVALID/);
 await assert.rejects(reader.get('recovery/domains/example.json',{max_bytes:299999}),/CANONICAL_TOO_LARGE/);
});
