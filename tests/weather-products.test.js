import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {hash} from '../src/platform/contracts.js';import {gitBlobSha} from '../src/ingress/cano-real-shadow.js';import {normalizeWeatherProduct} from '../src/ingress/weather-products.js';
const meta=JSON.parse(await readFile(new URL('./data/domains/SOURCE_PINS.json',import.meta.url),'utf8'));
async function source(key){return {pin:structuredClone(meta.pins[key]),raw_utf8:await readFile(new URL('./data/domains/'+key+'.json',import.meta.url),'utf8')};}
async function mutate(key,change){const s=await source(key),d=JSON.parse(s.raw_utf8);change(d);s.raw_utf8=JSON.stringify(d);s.pin.payload_sha256=await hash(s.raw_utf8);s.pin.git_blob_sha=await gitBlobSha(new TextEncoder().encode(s.raw_utf8));return s;}
for(const [key,n] of [['weather_forecast',26],['weather_marine',2],['weather_cloud',6],['weather_compact',1],['weather_meta',1],['weather_manifest',1]])test(key+' exact canonical runtime file roundtrips without new interpolation or independent-source count',async()=>{
 const s=await source(key),r=await normalizeWeatherProduct(key,s,meta.evaluation_time);assert.equal(r.records.length,n);assert.deepEqual(r.legacy_payload,JSON.parse(s.raw_utf8));assert.equal(r.operational_action_allowed,false);assert.equal(r.metadata.mirror_is_independent_evidence,false);assert.equal(r.independent_source_count,null);
});
test('ECMWF frame cycles/cells and marine sample/dataset classes are retained, mixed cycles rejected',async()=>{
 const f=await normalizeWeatherProduct('weather_forecast',await source('weather_forecast'),meta.evaluation_time);assert.equal(f.records[0].timestamps.model_run.utc,'2026-10-02T12:00:00.000Z');assert.equal(f.records[0].timestamps.valid_time.utc,'2026-10-02T21:00:00.000Z');assert.equal(f.records[0].data_class,'MODEL_FORECAST');assert.equal(f.records[0].values.cells_digest,await hash(f.legacy_payload.spatial.frames[0].cells));
 await assert.rejects(normalizeWeatherProduct('weather_forecast',await mutate('weather_forecast',d=>d.spatial.frames[0].lead_hours++),meta.evaluation_time),/CYCLE_MISMATCH/);
 await assert.rejects(normalizeWeatherProduct('weather_forecast',await mutate('weather_forecast',d=>d.spatial.frames[0].cells[0].valid_time='2026-10-02T22:00:00Z'),meta.evaluation_time),/CELL_SCOPE/);
 const m=await normalizeWeatherProduct('weather_marine',await source('weather_marine'),meta.evaluation_time);assert.ok(m.records.every(x=>x.data_class==='MODEL_MARINE_FIELD'));assert.notEqual(m.records[0].timestamps.valid_time.utc,m.records[1].timestamps.valid_time.utc);assert.equal(m.records[0].values.render_interpolation_only,true);
});
test('satellite proxies and canonical manifest fallback policy cannot be relabelled as in-situ or silent legacy fallback',async()=>{
 const c=await normalizeWeatherProduct('weather_cloud',await source('weather_cloud'),meta.evaluation_time);assert.ok(c.records.every(x=>x.data_class==='REMOTE_SENSING_PROXY'));assert.equal(c.records[0].values.cells_digest,await hash(c.legacy_payload.spatial.frames[0].cells));
 await assert.rejects(normalizeWeatherProduct('weather_cloud',await mutate('weather_cloud',d=>d.source_type='ACTUAL_IN_SITU'),meta.evaluation_time),/CLOUD_ORIGIN/);
 await assert.rejects(normalizeWeatherProduct('weather_manifest',await mutate('weather_manifest',d=>d.policy.legacy_fallback='ENABLED'),meta.evaluation_time),/FALLBACK_DENIED/);
});
