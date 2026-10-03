import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {rehearseNearMeConsumer} from '../src/ingress/nearme-consumer.js';
const meta=JSON.parse(await readFile(new URL('./data/domains/SOURCE_PINS.json',import.meta.url),'utf8'));
async function input(key){return {pin:meta.pins[key],raw_utf8:await readFile(new URL('./data/domains/'+key+'.json',import.meta.url),'utf8')};}
async function inputs(){return {index:await input('nearme'),support:await input('nearme_support'),venues:await input('nearme_venues')};}
test('actual Near Me three-input consumer retains existing enrichment and attraction deduplication rules',async()=>{
 const i=await inputs(),result=await rehearseNearMeConsumer(i);
 const code=await readFile(new URL('./data/nearme-original/nearme.js',import.meta.url),'utf8');
 const kernel=await readFile(new URL('./data/nearme-original/venue-normalizer.js',import.meta.url),'utf8');
 const sandbox={support:JSON.parse(i.support.raw_utf8),window:{},index:JSON.parse(i.index.raw_utf8),venues:JSON.parse(i.venues.raw_utf8)};vm.createContext(sandbox);vm.runInContext(kernel,sandbox);sandbox.window.OpenPQVenue=sandbox.OpenPQVenue;
 const from=code.indexOf('  function buildVenueRows('),to=code.indexOf('  function areaLabel(',from);assert.ok(from>0&&to>from);
 vm.runInContext(code.slice(from,to)+'\nexpected=window.OpenPQVenue.mergeWithCanonical(buildRows(index),buildVenueRows(venues));',sandbox);
 assert.deepEqual(result.rows,JSON.parse(JSON.stringify(sandbox.expected)));assert.equal(result.input_index_count,350);assert.equal(result.index_count,348);assert.equal(result.input_venue_count,10);assert.equal(result.normalized_venue_count,10);assert.ok(result.merged_count>=348&&result.merged_count<=358);assert.equal(result.companion_authority_admitted,false);assert.equal(result.production_enabled,false);
});
test('Near Me companion bytes and paths are independently pinned, cannot silently be replaced',async()=>{
 const i=await inputs();i.support={...i.support,raw_utf8:i.support.raw_utf8+' '};await assert.rejects(rehearseNearMeConsumer(i),/GIT_BLOB_MISMATCH/);
 const j=await inputs();[j.support,j.venues]=[j.venues,j.support];await assert.rejects(rehearseNearMeConsumer(j),/CONSUMER_PATH_DENIED/);
});
