// Native local proof for ten owned producer snapshots. Test clocks and ephemeral capabilities only.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {openDomainRehearsal,domainRehearsalEvidence,domainRehearsalSchemaSamples} from './local/domain-rehearsal.js';
import assert from 'node:assert/strict';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';

const out=path.resolve(process.argv[2]||'../domain-native-proof');await mkdir(out,{recursive:false});
const meta=JSON.parse(await readFile(new URL('../tests/data/domains/SOURCE_PINS.json',import.meta.url),'utf8'));
assert.equal(meta.fixture_only,false);const proofs=[],samples=[];
for(const domain of Object.keys(DOMAIN_DATASETS)){
 let s;try{
  const opened=await openDomainRehearsal(domain,meta);s=opened.s;
  const {raw_utf8,profile,c,committed,served,generation,envelope}=opened;
  await writeFile(path.join(out,domain+'.projection.json'),JSON.stringify(served.data,null,2)+'\n');
  await writeFile(path.join(out,domain+'.serving.json'),JSON.stringify(served.serving,null,2)+'\n');
  proofs.push({...domainRehearsalEvidence(opened,meta)});
  samples.push(...domainRehearsalSchemaSamples(opened));
 }finally{if(s)await s.mf.dispose();}
}
const summary={status:'PASS_TEN_NATIVE_LOCAL_BRIDGE_SNAPSHOTS',domains:['Weather','Airport','Transit','Near Me'],snapshot_count:proofs.length,proofs,source_health_claim:'CAPTURED_SNAPSHOT_SCOPE_ONLY',clock:'CAPTURED_REPLAY_NOT_CURRENT_WALL_CLOCK',production_enabled:false,producer_independent:false,source_policies_activated:false,operational_action_allowed:false,remote_writes:0};
await writeFile(path.join(out,'NATIVE_BRIDGE_PROOF.json'),JSON.stringify(summary,null,2)+'\n');await writeFile(path.join(out,'SCHEMA_SAMPLES.json'),JSON.stringify(samples,null,2)+'\n');console.log(JSON.stringify({status:summary.status,snapshots:proofs.length,candidate_bytes:proofs.map(p=>({domain:p.domain,bytes:p.candidate_bytes})),production_enabled:false},null,2));
