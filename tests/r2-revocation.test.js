import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedPair,credentialFingerprint,signedObservation,observeR2Denial} from '../scripts/cloud/r2-revocation.js';
import {BUCKET} from '../scripts/cloud/preflight.js';
import {hash} from '../src/platform/contracts.js';
const account='a'.repeat(32),probe={endpoint:`https://${account}.r2.cloudflarestorage.com`,bucket:BUCKET,access_key:'probe',secret:'synthetic-probe-secret'},witness={...probe,access_key:'witness',secret:'synthetic-witness-secret'};
test('revocation requires isolated disposable credentials and unchanged credential fingerprint',async()=>{
  isolatedPair(probe,witness,account);
  assert.throws(()=>isolatedPair(probe,probe,account),/RUNTIME_CREDENTIAL_REVOCATION_FORBIDDEN/);
  assert.throws(()=>isolatedPair({...probe,bucket:'production'},witness,account),/REVOCATION_SCOPE_FORBIDDEN/);
  assert.notEqual(await credentialFingerprint(probe),await credentialFingerprint({...probe,secret:'changed'}));
});
test('signed observations record actual HTTP results and reject signature error as revocation evidence',async()=>{
  const ok=await signedObservation(probe,'fixture',async(url,options)=>{assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');return new Response('fixture');});
  assert.equal(ok.status,200);assert.equal(ok.raw,'fixture');
  const denied=await signedObservation(probe,'fixture',async()=>new Response('<Error><Code>AccessDenied</Code></Error>',{status:403}));
  assert.equal(denied.status,403);assert.equal(denied.code,'AccessDenied');
  const wrong=await signedObservation(probe,'fixture',async()=>new Response('<Code>SignatureDoesNotMatch</Code>',{status:403}));assert.equal(wrong.code,null);
});
test('R2 denial requires independent successful GET of the exact unchanged object',async()=>{
  const digest=await hash('fixture');let polls=0;
  const read=async config=>config===witness?{status:200,raw:'fixture'}:++polls===1?{status:200,raw:'fixture'}:{status:403,code:'AccessDenied'};
  const result=await observeR2Denial({probe,witness,key:'fixture',digest,read,pause:async()=>{}});
  assert.equal(result.status,'R2_DENIAL_OBSERVED');assert.equal(result.attempts,2);
  await assert.rejects(observeR2Denial({probe,witness,key:'fixture',digest,read:async config=>config===witness?{status:404}:{status:403,code:'AccessDenied'}}),/RUNTIME_WITNESS_UNAVAILABLE/);
});
test('404, network errors, signature mismatch and still-readable keys cannot pass revocation',async()=>{
  const digest=await hash('fixture');
  for(const result of [{status:404},{status:null},{status:403,code:null}])await assert.rejects(observeR2Denial({probe,witness,key:'fixture',digest,read:async()=>result}),/R2_DENIAL_NOT_ESTABLISHED/);
  await assert.rejects(observeR2Denial({probe,witness,key:'fixture',digest,read:async()=>({status:200,raw:'fixture'}),timeout:0}),/R2_REVOCATION_DENIAL_TIMEOUT/);
});
