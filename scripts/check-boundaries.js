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
