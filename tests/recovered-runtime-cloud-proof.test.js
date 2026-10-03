import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyRecoveredRuntimeProof} from '../scripts/cloud/verify-recovered-runtime-proof.js';
const root=fileURLToPath(new URL('../',import.meta.url));
async function fixture(){
 const dir=await mkdtemp(path.join(tmpdir(),'openpq-runtime-cloud-proof-'));
 for(const [zip,out] of [['evidence/core2-recovered-runtime-cloud-20261003/cloud-runtime.zip','runtime'],['evidence/core2-domain-frozen-cloud-20261003/success-37134123700/cloud-recovery.zip','source']])assert.equal(spawnSync('python',['-c','import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',root+zip,dir+'/'+out]).status,0);
 return {dir,runtime:dir+'/runtime',source:dir+'/source',pins:JSON.parse(await readFile(root+'evidence/core2-recovered-runtime-cloud-20261003/PINS.json','utf8'))};
}
test('actual deployed archive Runtime independently matches ten source/target signatures without Core or write bindings',async()=>{
 const f=await fixture();try{const result=await verifyRecoveredRuntimeProof(f.runtime,f.source,f.pins);assert.equal(result.results.length,10);assert.equal(result.live_serving_restored,false);assert.equal(result.results.every(x=>x.display_lease_expired),true);}finally{await rm(f.dir,{recursive:true,force:true});}
});
test('cloud Runtime proof rejects leaked bindings, read-key write access, omitted cleanup and rewritten source time',async()=>{
 const f=await fixture();try{
  const original=JSON.parse(await readFile(f.runtime+'/PROOF.json','utf8'));
  for(const mutate of [p=>p.cleanup.status='FAILED',p=>p.no_core_binding=false,p=>p.read_key_denials[0].status=200,p=>p.live_serving_restored=true,p=>p.direct_s3_writer_key_revocation_proven=true,p=>p.domains.pop()]){const p=structuredClone(original);mutate(p);await writeFile(f.runtime+'/PROOF.json',JSON.stringify(p));await assert.rejects(verifyRecoveredRuntimeProof(f.runtime,f.source,f.pins));}
  await writeFile(f.runtime+'/PROOF.json',JSON.stringify(original));
  const bindings=await readFile(f.runtime+'/RUNTIME_BINDINGS.json','utf8');await writeFile(f.runtime+'/RUNTIME_BINDINGS.json',JSON.stringify([{type:'service',name:'CORE_READ'}]));await assert.rejects(verifyRecoveredRuntimeProof(f.runtime,f.source,f.pins),/RECOVERED_RUNTIME_PROOF_BINDING_INVALID/);await writeFile(f.runtime+'/RUNTIME_BINDINGS.json',bindings);
  const response=JSON.parse(await readFile(f.runtime+'/weather-RESPONSE.json','utf8'));response.body.serving.source_version_time=response.body.serving.evaluated_at;await writeFile(f.runtime+'/weather-RESPONSE.json',JSON.stringify(response));await assert.rejects(verifyRecoveredRuntimeProof(f.runtime,f.source,f.pins),/RECOVERED_RUNTIME_PROOF_RESPONSE_INVALID/);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
