import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const paths=process.argv.slice(2);assert.equal(paths.length,3,'Pass explicit Core, Runtime and Operator configs');
const configs=await Promise.all(paths.map(async path=>JSON.parse(await readFile(path,'utf8'))));
for(const c of configs){assert.equal(c.vars?.ENVIRONMENT_ID,'isolated-test');assert.match(c.name,/^openpq-intelligence-.*-isolated-test$/);assert.ok(!c.account_id || /^[a-f0-9]{32}$/.test(c.account_id));assert.equal((c.routes||[]).length,0);assert.equal((c.triggers?.crons||[]).length,0);assert.ok(!c.env,'No environment inheritance allowed');assert.ok(!c.assets,'No legacy website binding allowed');}
assert.equal(configs[0].durable_objects.bindings.length,1);assert.equal(configs[0].durable_objects.bindings[0].name,'DATASETS');assert.ok(!configs[0].durable_objects.bindings[0].script_name,'Namespace cannot alias another Worker');
assert.equal(configs[0].r2_buckets.length,1);assert.match(configs[0].r2_buckets[0].bucket_name,/^openpq-intelligence-[a-z0-9-]+-isolated-test$/);
for(const c of configs.slice(1)){assert.ok(!c.r2_buckets&&!c.durable_objects&&!c.d1_databases&&!c.kv_namespaces);assert.equal(c.services.length,1);assert.equal(c.services[0].service,configs[0].name);}
assert.equal(configs[1].services[0].binding,'CORE_READ');assert.equal(configs[2].services[0].binding,'CORE_COMMAND');
console.log('PASS: isolated config shape. Cloud capability scopes still require external evidence.');
