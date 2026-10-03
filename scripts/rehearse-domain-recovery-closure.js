import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {archiveDomain} from './local/domain-recovery-archive.js';
import {DOMAIN_DATASETS} from '../src/ingress/domain-source-common.js';
const out=path.resolve(process.argv[2]||'.domain-recovery-closure');await mkdir(out,{recursive:true});const results=[];
for(const domain of Object.keys(DOMAIN_DATASETS)){
 const {bundle,trust}=await archiveDomain(domain),folder=path.join(out,domain);await mkdir(folder,{recursive:true});
 const b=path.join(folder,'BUNDLE.json'),t=path.join(folder,'TRUST.json'),r=path.join(folder,'VERIFICATION.json');
 await writeFile(b,JSON.stringify(bundle)+'\n');await writeFile(t,JSON.stringify(trust)+'\n');
 // Source Miniflare is already disposed. The child receives files, not source bindings or keys.
 const child=spawnSync(process.execPath,['scripts/verify-domain-recovery-closure.js',b,t,'2026-10-04T01:12:00.000Z',r],{encoding:'utf8'});assert.equal(child.status,0,child.stderr);
 results.push(JSON.parse(await readFile(r,'utf8')));
}
const summary={status:'PASS_TEN_SIGNED_DOMAIN_ARCHIVE_CLOSURES',source_scope:'OWNED_CAPTURED_SNAPSHOTS_NOT_CURRENT_LIVE_SOURCE',source_process_disposed_before_independent_readback:true,independent_child_process:true,results,live_serving_restored:false,full_system_restore_proven:false,production_enabled:false};
await writeFile(path.join(out,'SUMMARY.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({status:summary.status,datasets:results.length,live_serving_restored:false}));
