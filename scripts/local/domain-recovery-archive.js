import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openDomainRehearsal} from './domain-rehearsal.js';
import {domainBridgeArtifactDocuments} from '../../src/platform/domain-bridge-admission.js';
import {DOMAIN_RECOVERY_CLOSURE_VERSION} from '../../src/platform/domain-recovery-closure.js';
import {verifyAuthoritySnapshot} from '../../src/platform/authority-snapshot.js';
const meta=JSON.parse(await readFile(new URL('../../tests/data/domains/SOURCE_PINS.json',import.meta.url),'utf8'));
export async function archiveDomain(domain){
 const o=await openDomainRehearsal(domain,meta);try{
  o.s.principals.find(x=>x.id==='operator').permissions.push('recovery-export');await o.s.mf.setOptions(o.s.options());
  const exported=await o.s.call('recovery-export',{},'test-only-operator');assert.equal(exported.status,200);
  const checked=await verifyAuthoritySnapshot(exported.body,o.trust),bucket=await o.s.mf.getR2Bucket('CANONICAL','core'),generations=[];
  for(const row of checked.tables.prepared){const p=JSON.parse(row.body);generations.push({key:p.key,content:JSON.parse(await (await bucket.get(p.key)).text())});}
  return {trust:o.trust,raw:JSON.parse(o.raw_utf8),bundle:{contract_version:DOMAIN_RECOVERY_CLOSURE_VERSION,snapshot:exported.body,profile:o.profile,artifact_documents:domainBridgeArtifactDocuments(o.profile),generations,publication:o.envelope}};
 }finally{await o.s.mf.dispose();}
}
