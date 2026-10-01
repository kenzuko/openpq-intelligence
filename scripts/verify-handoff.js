import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir='docs/reference/v2.1';const manifest=JSON.parse(await readFile(dir+'/MANIFEST.json','utf8'));
for(const entry of manifest.files){const bytes=await readFile(dir+'/'+entry.path);assert.equal(bytes.length,entry.bytes,entry.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path);}
console.log('PASS: '+manifest.files.length+' immutable handoff files, including original V2 ZIP');
