import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup} from './support.js';
import {hash} from '../src/platform/contracts.js';
import {packConfig,readConfig,trustMap,TRUST_BINDINGS,PROFILE_REGISTRY_BINDINGS} from '../src/platform/trusted-config.js';
import {ISOLATED_ACCOUNT_ID,ISOLATED_DOMAIN_PROFILE_VERSION,domainBridgeArtifactRefs,buildDomainBridgeCandidate,validateDomainBridgeProfile} from '../src/platform/domain-bridge-admission.js';
import {ISOLATED_REAL_PROFILE_VERSION,realCanoArtifactRefs,buildRealCanoCandidate,validateRealCanoProfile} from '../src/platform/real-cano-admission.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
import {validateSemanticAdmission} from '../src/platform/semantic-admission.js';
import {domainLegacyView} from '../src/platform/domain-serving.js';
const meta=JSON.parse(await readFile(new URL('./data/domains/SOURCE_PINS.json',import.meta.url),'utf8'));
test('bounded trusted registries roundtrip Unicode, clear unused slots and reject oversize/malformed/array maps',()=>{
 const value=Object.fromEntries(Array.from({length:11},(_,i)=>['domain'+i,{text:'Phú Quốc '.repeat(100)}]));
 const packed=packConfig(value,TRUST_BINDINGS);assert.deepEqual(trustMap(packed),value);assert.ok(Object.values(packed).every(x=>Buffer.byteLength(x)<=5000));
 const small=packConfig({a:1},TRUST_BINDINGS);assert.equal(small.TRUST_JSON_6,'');assert.deepEqual(readConfig(small,TRUST_BINDINGS),{a:1});
 assert.throws(()=>packConfig({v:'x'.repeat(31000)},TRUST_BINDINGS),/TOO_LARGE/);assert.throws(()=>trustMap({TRUST_JSON:'x'.repeat(5001)}),/BINDING_INVALID/);assert.throws(()=>trustMap({TRUST_JSON:'[]'}),/MAP_INVALID/);assert.throws(()=>trustMap({TRUST_JSON:'{'}));
});
for(const domain of ['weather','airport','transit','nearme'])test(domain+' native isolated admission exports signed exact legacy reference; production and cross-account are denied',async()=>{
 const now=Date.now(),at=new Date(now).toISOString(),to=new Date(now+240000).toISOString();
 const profile={contract_version:ISOLATED_DOMAIN_PROFILE_VERSION,environment_id:'isolated-test',dataset_id:DOMAIN_DATASETS[domain],domain,fixture_only:false,source_pin:meta.pins[domain],operator_principal_ids:['operator'],test_window:{valid_from:at,valid_to:to,basis:'ISOLATED_CAPTURE_REFERENCE_ONLY'},artifact_refs:{}};
 profile.artifact_refs=await domainBridgeArtifactRefs(profile);
 const s=await setup({semanticProfile:profile,dataset_id:profile.dataset_id,environment_id:'isolated-test',account_id:ISOLATED_ACCOUNT_ID,domainOperator:true});
 try{
  const raw_utf8=await readFile(new URL('./data/domains/'+domain+'.json',import.meta.url),'utf8');
  const c=await buildDomainBridgeCandidate(profile,s.trust,{raw_utf8,operator_principal_id:'operator',evaluation_time:at,candidate_id:'isolated-'+domain});
  const prepared=await s.call('prepare',c,'test-only-operator');assert.equal(prepared.status,200,JSON.stringify(prepared));
  const committed=await s.call('commit',{...s.trust,command_id:'isolated-commit',digest:prepared.body.digest,expires_at:to},'test-only-operator');assert.equal(committed.status,200,JSON.stringify(committed));assert.equal(committed.body.receipt.semantic_admission.action_allowed,false);
  assert.equal((await s.call('export',{},'test-only-operator')).status,200);
  const bucket=await s.mf.getR2Bucket('CANONICAL','core'),generation=JSON.parse(await (await bucket.get(committed.body.receipt.key)).text()),envelope=JSON.parse(await (await bucket.get(`checkpoints/${s.trust.authority_instance_id}/${s.trust.recovery_generation}/latest.json`)).text());
  assert.deepEqual(await domainLegacyView(generation,envelope,s.trust),JSON.parse(raw_utf8));
  await assert.rejects(validateDomainBridgeProfile(profile,{...s.trust,account_id:'a'.repeat(32)}),/SCOPE_DENIED/);
  await assert.rejects(validateDomainBridgeProfile({...profile,environment_id:'production'},{...s.trust,environment_id:'production'}),/SCOPE_DENIED/);
  const env={ENVIRONMENT_ID:'isolated-test',...packConfig({[profile.dataset_id]:profile},PROFILE_REGISTRY_BINDINGS)};
  await validateSemanticAdmission(env,s.trust,c,new Date(Date.now()).toISOString(),s.principals.find(x=>x.id==='operator'));
  await assert.rejects(validateSemanticAdmission({...env,SEMANTIC_PROFILE_1:'{}'},s.trust,c,at),/CONFIG_AMBIGUOUS/);
  await assert.rejects(validateSemanticAdmission(env,{...s.trust,dataset_id:'other'},c,at),/CLOUD_ADMISSION_CLOSED/);
 }finally{await s.mf.dispose();}
});
test('isolated actual Cano preserves explicit day validity and authenticated operator capability',async()=>{
 const source=JSON.parse(await readFile(new URL('./data/real-cano/SOURCE.json',import.meta.url),'utf8'));
 const {raw_file,...pin}=source.record;const raw_utf8=await readFile(new URL('./data/real-cano/2026-10-03-cano-an-thoi.json',import.meta.url),'utf8');
 const profile={contract_version:ISOLATED_REAL_PROFILE_VERSION,environment_id:'isolated-test',dataset_id:'cano.operation.an-thoi',source_kind:'OWNER_REPOSITORY_SNAPSHOT',fixture_only:false,source_records:[pin],operator_principal_ids:['operator'],artifact_refs:{}};
 profile.artifact_refs=await realCanoArtifactRefs(profile);
 const s=await setup({semanticProfile:profile,dataset_id:profile.dataset_id,environment_id:'isolated-test',account_id:ISOLATED_ACCOUNT_ID,manualOperator:true,realSourceReplayClock:true});
 try{
  const at='2026-10-03T00:30:00.000Z';const c=await buildRealCanoCandidate(profile,s.trust,{bundle:{contract_version:'openpq-real-cano-bundle-isolated-v1',raw_utf8,...pin},operator_principal_id:'operator',evaluation_time:at,candidate_id:'isolated-cano'});
  assert.equal(c.valid_to,'2026-10-03T17:00:00.000Z');assert.equal(c.decision.effect,'ABSTAIN');
  const p=await s.call('prepare',c,'test-only-operator');assert.equal(p.status,200,JSON.stringify(p));assert.notEqual((await s.call('prepare',c,'test-only-live')).status,200);
  await assert.rejects(validateRealCanoProfile(profile,{...s.trust,account_id:'a'.repeat(32)}),/SCOPE_DENIED/);
  await assert.rejects(buildRealCanoCandidate(profile,s.trust,{bundle:c.semantic_bundle,operator_principal_id:'operator',evaluation_time:'2026-10-03T17:00:00.000Z',candidate_id:'next-day'}),/OUTSIDE_VALIDITY/);
 }finally{await s.mf.dispose();}
});
