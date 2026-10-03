import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hash} from '../src/platform/contracts.js';
import {gitBlobSha} from '../src/ingress/cano-real-shadow.js';
import {normalizeWeatherDomain} from '../src/ingress/weather-domain.js';
import {normalizeAirportDomain} from '../src/ingress/airport-domain.js';
import {normalizeTransitDomain} from '../src/ingress/transit-domain.js';
import {normalizeNearMeDomain} from '../src/ingress/nearme-domain.js';
import {utcTime} from '../src/ingress/domain-source-common.js';
import {packDomainText,unpackDomainText} from '../src/platform/domain-codec.js';
import {packDomainJson} from '../src/platform/domain-codec.js';
import {domainSnapshotServing} from '../src/platform/domain-serving.js';

const meta=JSON.parse(await readFile(new URL('./data/domains/SOURCE_PINS.json',import.meta.url),'utf8')),AT=meta.evaluation_time;
const adapters={weather:normalizeWeatherDomain,airport:normalizeAirportDomain,airport_archive:normalizeAirportDomain,transit:normalizeTransitDomain,nearme:normalizeNearMeDomain};
const copy=x=>JSON.parse(JSON.stringify(x));
async function fixture(key){return {pin:copy(meta.pins[key]),raw_utf8:await readFile(new URL('./data/domains/'+key+'.json',import.meta.url),'utf8')};}
async function mutated(key,change){const input=await fixture(key),d=JSON.parse(input.raw_utf8);change(d);input.raw_utf8=JSON.stringify(d);input.pin.payload_sha256=await hash(input.raw_utf8);if(input.pin.git_blob_sha)input.pin.git_blob_sha=await gitBlobSha(new TextEncoder().encode(input.raw_utf8));return input;}
for(const [domain,count] of [['weather',206],['airport',127],['transit',44],['nearme',348]])test(domain+' actual owned snapshot preserves legacy shape and produces deterministic bridge projection',async()=>{
 assert.equal(meta.fixture_only,false);const f=await fixture(domain),a=await adapters[domain](f,AT),b=await adapters[domain](f,AT);
 assert.deepEqual(a,b);assert.equal(a.records.length,count);assert.deepEqual(a.legacy_payload,JSON.parse(f.raw_utf8));assert.equal(a.legacy_payload_digest,await hash(JSON.parse(f.raw_utf8)));assert.equal(a.operational_action_allowed,false);assert.equal(a.production_enabled,false);assert.equal(a.mode,'BRIDGE_DEPENDENT_SHADOW');assert.equal(a.independent_source_count,null);
});
test('Weather keeps ICAO/WMO identity, stale unchanged VRain, estimate, model and satellite proxy separate',async()=>{
 const r=await normalizeWeatherDomain(await fixture('weather'),AT),v=r.records.find(x=>x.id==='metar:VVPQ'),s=r.records.find(x=>x.id==='synop:48917');assert.equal(v.scope.namespace,'ICAO');assert.equal(s.scope.namespace,'WMO_INDEX');assert.notEqual(v.lineage_key,s.lineage_key);assert.equal(v.timestamps.observed_at.utc,'2026-10-03T00:30:00.000Z');assert.equal(v.timestamps.source_freshness.budget_minutes,90);
 const rain=r.records.find(x=>x.id==='rain:an_thoi');assert.equal(rain.timestamps.source_freshness.state,'OUTSIDE_REPORTED_BUDGET');assert.notEqual(rain.timestamps.observed_at.utc,rain.timestamps.collected_at.utc);
 assert.equal(r.records.find(x=>x.id==='satellite:nowcast').data_class,'REMOTE_SENSING_PROXY');assert.equal(r.records.find(x=>x.id==='estimate:an_thoi').data_class,'ESTIMATED_NOW');assert.ok(r.records.filter(x=>x.data_class==='MODEL_FORECAST').every(x=>x.timestamps.model_run.utc===null));assert.ok(r.issues.some(x=>x.code==='WEATHER_MODEL_RUN_LINK_UNRESOLVED'));
});
test('Weather does not let new generated_at reset observation age or turn model into actual',async()=>{
 const f=await mutated('weather',x=>x.generated_at='2026-10-03T01:12:00Z');const r=await normalizeWeatherDomain(f,AT);assert.equal(r.records.find(x=>x.id==='rain:an_thoi').timestamps.source_freshness.state,'OUTSIDE_REPORTED_BUDGET');
 await assert.rejects(normalizeWeatherDomain(await mutated('weather',x=>x.model_72h.points.an_thoi[0].data_class='ACTUAL'),AT),/MODEL_CLASS/);
 await assert.rejects(normalizeWeatherDomain(await mutated('weather',x=>x.groundtruth.atmosphere.synop_48917.source_namespace='ICAO'),AT),/SYNOP_IDENTITY/);
 await assert.rejects(normalizeWeatherDomain(await mutated('weather',x=>delete x.nowcast.sampled_time),AT),/SATELLITE_TIME/);
});
test('Airport uses actual live path, operating-flight identity and collection time without inventing row timestamp timezone',async()=>{
 const r=await normalizeAirportDomain(await fixture('airport'),AT);assert.equal(r.metadata.transport,'LIVE_PROXY_CAPTURE');assert.deepEqual(r.metadata.counts,{arrivals:62,departures:65,total:127});assert.equal(r.metadata.board_checked_at.utc,'2026-10-03T01:11:08.000Z');assert.equal(r.metadata.live_update_lag_verified,false);
 assert.equal(new Set(r.records.map(x=>x.id)).size,127);assert.ok(r.records.every(x=>x.timestamps.source_row_updated_time_basis==='UNRESOLVED_DO_NOT_USE_AS_BOARD_FETCH_TIME'));
});
test('Airport archive is a usable separate fallback snapshot rather than failed live system',async()=>{
 const r=await normalizeAirportDomain(await fixture('airport_archive'),AT);assert.equal(r.records.length,127);assert.equal(r.metadata.transport,'ARCHIVE_FALLBACK_CAPTURE');assert.ok(r.issues.some(x=>x.code==='AIRPORT_ARCHIVE_FALLBACK_NOT_LIVE'));assert.equal(r.source_health_inferred_from_path,false);
});
test('Airport mismatched counts, duplicate source identity, wrong provider and malformed day are denied',async()=>{
 for(const change of [x=>x.latest.counts.total++,x=>x.latest.records.push(x.latest.records[0]),x=>x.latest.source.api='https://example.invalid',x=>x.latest.source_date='2026-02-30',x=>x.latest.records[0].scheduled_time='24:00'])await assert.rejects(normalizeAirportDomain(await mutated('airport',change),AT));
});
test('freshly fetched Airport board for another service day stays a day reference',async()=>{
 const projection=await normalizeAirportDomain(await mutated('airport',x=>x.latest.source_date='2026-10-04'),AT),{legacy_payload,...compact}=projection;
 const generation={payload:{domain_snapshot:{contract_version:'openpq-domain-snapshot-local-v1',encoded_projection:await packDomainJson(compact),projection_digest:compact.projection_digest}},semantic_admission:{preparation_hash:compact.projection_digest}};
 const served=await domainSnapshotServing(generation,Date.parse(AT));assert.ok(served.serving.fields.every(x=>x.freshness==='OTHER_DAY_REFERENCE'));
});
test('Transit preserves ferry/fast-ferry fares and published bus frequency with no inferred seats or live status',async()=>{
 const r=await normalizeTransitDomain(await fixture('transit'),AT);assert.equal(r.records.filter(x=>x.data_class==='PUBLISHED_SCHEDULE_FREQUENCY').length,3);assert.equal(r.records.filter(x=>x.scope.mode==='FERRY').length,24);assert.equal(r.records.filter(x=>x.scope.mode==='FAST FERRY').length,17);
 assert.ok(r.records.filter(x=>x.scope.mode==='BUS').every(x=>x.timestamps.verified_at.precision==='DAY'&&x.timestamps.verified_at.utc===null));assert.ok(r.issues.some(x=>x.code==='TRANSIT_PROVIDER_ERROR'&&x.provider_id==='binh_an'));assert.ok(r.issues.some(x=>x.code==='TRANSIT_STATUS_TIME_NOT_EXPLICIT'));assert.equal(r.metadata.ticket_stock_not_inferred,true);
});
test('Transit rejects month schedules, Cano substitution, yesterday masked as today, duplicate departures and private seat counts',async()=>{
 for(const change of [x=>x.departures[0].date_specific=false,x=>x.departures[0].mode='CANO',x=>x.departures[0].departure_time='2026-10-02T03:30:00+07:00',x=>x.departures.push(x.departures[0]),x=>x.departures[0].seat_count=12])await assert.rejects(normalizeTransitDomain(await mutated('transit',change),AT));
 const r=await normalizeTransitDomain(await fixture('transit'),'2026-10-04T01:12:00Z');assert.ok(r.issues.some(x=>x.code==='TRANSIT_SERVICE_DAY_NOT_CURRENT'));assert.equal(r.records[0].scope.service_date,'2026-10-03');
});
test('Near Me keeps directory/GPS precision and licenses without making site centroids verified entrances or live opening claims',async()=>{
 const r=await normalizeNearMeDomain(await fixture('nearme'),AT);assert.equal(r.metadata.input_document_count,350);assert.ok(r.records.every(x=>x.data_class==='DIRECTORY_REFERENCE'&&x.values.live_open_confirmed===false));assert.ok(r.records.filter(x=>x.values.map?.precision==='site_centroid').every(x=>x.values.precise_entrance_confirmed===false));assert.ok(r.records.some(x=>x.values.source_license==='ODbL-1.0'));assert.equal(r.metadata.bus_stop_import,false);
});
test('Near Me invalid GPS becomes unresolved, excluded categories/names stay excluded, no coordinate fallback is synthesized',async()=>{
 const f=await mutated('nearme',d=>{d.documents[0].map={lat:0,lon:0,precision:'verified_entrance'};d.documents[1].tags=['BUS_STOP'];d.documents[2].name='Русский офис';});const r=await normalizeNearMeDomain(f,AT);
 assert.equal(r.records.find(x=>x.id===JSON.parse(f.raw_utf8).documents[0].id).values.map,null);assert.ok(r.issues.some(x=>x.code==='NEARME_GPS_UNRESOLVED'));assert.equal(r.records.some(x=>x.id===JSON.parse(f.raw_utf8).documents[1].id),false);
 await assert.rejects(normalizeNearMeDomain(await mutated('nearme',d=>d.documents.push(d.documents[0])),AT),/DUPLICATE_ID/);
});
test('all domain sources enforce typed exact hashes, scope/pointer and no source secrets before decoding',async()=>{
 for(const domain of ['weather','airport','transit','nearme']){
  const f=await fixture(domain);for(const change of [x=>x.pin.payload_sha256=[x.pin.payload_sha256],x=>x.raw_utf8+=' ',x=>x.pin.source_kind='SYNTHETIC_ONLY']){const bad=copy(f);change(bad);await assert.rejects(adapters[domain](bad,AT));}
  await assert.rejects(adapters[domain](await mutated(domain,x=>x.token='test-only-negative'),AT),/SECRET_FORBIDDEN/);
 }
});
test('time handling accepts captured microseconds/offsets, preserves date-only precision and denies calendar rollovers',()=>{
 assert.equal(utcTime('2026-10-03T00:41:23.890692+00:00'),'2026-10-03T00:41:23.890Z');for(const value of ['2026-02-30T00:00:00Z','2026-10-03T24:00:00Z','2026-10-03','2026-10-03T00:00:00+99:00'])assert.equal(utcTime(value),null);
});
test('compressed source codec preserves exact bytes and denies tampered digest/size, extra fields and expanding payload declarations',async()=>{
 const f=await fixture('nearme'),packed=await packDomainText(f.raw_utf8);assert.equal(await unpackDomainText(packed),f.raw_utf8);
 for(const change of [x=>x.sha256='f'.repeat(64),x=>x.uncompressed_bytes=2,x=>x.uncompressed_bytes=1500001,x=>x.encoding='PLAIN',x=>x.extra=true,x=>x.base64+='=']){const bad=copy(packed);change(bad);await assert.rejects(unpackDomainText(bad));}
});
