import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const runtime=await readFile('src/workers/runtime.js','utf8');
assert.doesNotMatch(runtime,/env\.(CANONICAL|PRINCIPALS_JSON|RECEIPT_SIGNING_JSON|CORE_COMMAND)\b/);
assert.doesNotMatch(runtime,/\.(put|delete|list)\s*\(/);
assert.doesNotMatch(runtime,/weather-engine|collector|normaliz|hysteresis/);
const s3=await readFile('src/platform/s3-reader.js','utf8');
assert.match(s3,/GET/);assert.doesNotMatch(s3,/method:\s*['"](?:PUT|DELETE|POST)['"]/);
const semantic=await readFile('src/contracts/semantic.js','utf8');
assert.doesNotMatch(semantic,/Date\.now|\bfetch\s*\(|cloudflare:workers|workers\//);
const walk=async dir=>{const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(e.isDirectory())out.push(...await walk(path));else if(path.endsWith('.js'))out.push(path);}return out;};
for(const path of [...await walk('src'),...await walk('tests'),...await walk('scripts')]){
  const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
}
console.log('PASS: Runtime capability boundaries and JavaScript syntax');

const staging=await readFile('src/workers/staging.js','utf8');
assert.doesNotMatch(staging,/env\.(CORE_COMMAND|DATASETS|CANONICAL|RECEIPT_SIGNING_JSON|TRUST_JSON)\b|\.(delete|list)\s*\(/);
console.log('PASS: staging has no authority bindings, delete or listing API');

for(const path of await walk('src/preparation')) {
 const content=await readFile(path,'utf8');
 assert.doesNotMatch(content,/Date\.now|\bfetch\s*\(|cloudflare:workers|env\.(DATASETS|CANONICAL|CORE_COMMAND|RECEIPT_SIGNING_JSON)|\.(put|send)\s*\(|\b(?:storage|bucket|CANONICAL|R2)\.delete\s*\(/);
}
console.log('PASS: preparation has no network, publication, storage deletion or message capability');

const progress=await readFile('src/workers/progress.js','utf8');
assert.doesNotMatch(progress,/env\.(CANONICAL|DATASETS|CORE_COMMAND|RECEIPT_SIGNING_JSON)|\/(prepare|commit|control|bootstrap)\b|\bdeleteAll\b/);
assert.match(progress,/PROGRESS_CLOUD_ACTIVATION_CLOSED/);
console.log('PASS: progress has export-only routing and explicit fixture-only isolated activation; production closed');
