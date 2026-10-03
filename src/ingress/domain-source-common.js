import {hash,requireThat,stable} from '../platform/contracts.js';
import {clone,noSecrets} from '../preparation/common.js';
import {gitBlobSha} from './cano-real-shadow.js';

export const DOMAIN_SHADOW_VERSION='openpq-owned-domain-shadow-v1';
export const DOMAIN_DATASETS=Object.freeze({weather:'weather.bridge.phu-quoc',weather_forecast:'weather.forecast.bridge.phu-quoc',weather_marine:'weather.marine.bridge.phu-quoc',weather_cloud:'weather.cloud.bridge.phu-quoc',weather_compact:'weather.compact.bridge.phu-quoc',weather_meta:'weather.meta.bridge.phu-quoc',weather_manifest:'weather.manifest.bridge.phu-quoc',airport:'airport.bridge.pqc',transit:'transit.bridge.phu-quoc',nearme:'directory.bridge.phu-quoc'});
const weatherOrigin=Object.freeze(['kenzuko/Jotrip-Weather','data/weather-runtime/']);
export const DOMAIN_ORIGINS=Object.freeze({weather:weatherOrigin,weather_forecast:weatherOrigin,weather_marine:weatherOrigin,weather_cloud:weatherOrigin,weather_compact:weatherOrigin,weather_meta:weatherOrigin,weather_manifest:weatherOrigin,airport:Object.freeze(['kenzuko/Jotrip-Lab','data/sunairport/']),transit:Object.freeze(['kenzuko/transit-jotrip','data/']),nearme:Object.freeze(['kenzuko/jotrip-home','data/'])});
export const AIRPORT_RUNTIME_URL='https://jotrip-airport-live.kenzuko.workers.dev';
export const DOMAIN_RUNTIME_URLS=Object.freeze({airport:AIRPORT_RUNTIME_URL,weather:'https://openphuquoc.com/weather/data/weather-runtime/current.json',weather_forecast:'https://openphuquoc.com/weather/data/weather-runtime/forecast.json',weather_marine:'https://openphuquoc.com/weather/data/weather-runtime/marine.json',weather_cloud:'https://openphuquoc.com/weather/data/weather-runtime/cloud.json',weather_compact:'https://openphuquoc.com/weather/data/weather-runtime/compact.json',weather_meta:'https://openphuquoc.com/weather/data/weather-runtime/meta.json',nearme:'https://openphuquoc.com/data/views/location-index.json'});
export const NEARME_COMPANION_RUNTIME_URLS=Object.freeze(['https://openphuquoc.com/data/home-support.json','https://openphuquoc.com/data/entities/destination-venues.json']);
export const exact=(v,keys,label)=>requireThat(v&&typeof v==='object'&&!Array.isArray(v)&&stable(Object.keys(v).sort())===stable([...keys].sort()),label+'_FIELDS_INVALID');
export function list(v,label,max=10000){requireThat(Array.isArray(v)&&v.length<=max,label+'_ARRAY_REQUIRED');return v;}
export function nonempty(v,label){requireThat(typeof v==='string'&&v.length>0&&v.length<=1024,label+'_TEXT_REQUIRED');return v;}
export function utcTime(value){
 if(typeof value!=='string')return null;
 const m=value.match(/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d:\d\d)$/);
 if(!m||+m[2]>23||+m[3]>59||+m[4]>59)return null;
 const zone=m[6],offset=zone==='Z'?0:(zone[0]==='-'?-1:1)*(+zone.slice(1,3)*60+(+zone.slice(4,6)));
 if(zone!=='Z'&&(+zone.slice(1,3)>23||+zone.slice(4,6)>59))return null;
 const n=Date.parse(value);if(!Number.isFinite(n))return null;
 if(new Date(n+offset*60000).toISOString().slice(0,10)!==m[1])return null;
 return new Date(n).toISOString();
}
export function dateOnly(value){return typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&utcTime(value+'T00:00:00Z')!==null?value:null;}
export function localDay(value){const utc=utcTime(value);return utc?new Date(Date.parse(utc)+7*3600000).toISOString().slice(0,10):null;}
export function time(value){return {raw:value??null,utc:utcTime(value),precision:utcTime(value)?'INSTANT':dateOnly(value)?'DAY':'UNKNOWN'};}
export function freshness(value,at,budget_minutes=null){
 const source=utcTime(value),now=utcTime(at);requireThat(now,'DOMAIN_EVALUATION_TIME_REQUIRED');
 if(!source)return {state:'UNKNOWN_SOURCE_TIME',age_ms:null,budget_minutes};
 const age_ms=Date.parse(now)-Date.parse(source);
 const state=age_ms<0?'FUTURE_SOURCE_TIME':Number.isFinite(budget_minutes)&&budget_minutes>0?(age_ms<budget_minutes*60000?'WITHIN_REPORTED_BUDGET':'OUTSIDE_REPORTED_BUDGET'):'AGE_RECORDED_NO_ACTIVATED_BUDGET';
 return {state,age_ms,budget_minutes};
}
export async function decodeOwnedSource(domain,input){
 input=clone(input);exact(input,['pin','raw_utf8'],'DOMAIN_SOURCE');const {pin,raw_utf8}=input;
 exact(pin,['source_kind','source_pointer','payload_sha256','git_blob_sha'],'DOMAIN_SOURCE_PIN');
 requireThat(typeof pin.payload_sha256==='string'&&/^[a-f0-9]{64}$/.test(pin.payload_sha256),'DOMAIN_PAYLOAD_DIGEST_INVALID');
 requireThat(typeof raw_utf8==='string'&&new TextEncoder().encode(raw_utf8).length<=1500000,'DOMAIN_RAW_LIMIT',413);
 const origin=DOMAIN_ORIGINS[domain];requireThat(origin,'DOMAIN_UNSUPPORTED');
 if(pin.source_kind==='OWNER_REPOSITORY_SNAPSHOT'){
  exact(pin.source_pointer,['repository','commit_sha','path'],'DOMAIN_SOURCE_POINTER');const p=pin.source_pointer;
  requireThat(p.repository===origin[0]&&typeof p.commit_sha==='string'&&/^[a-f0-9]{40}$/.test(p.commit_sha)&&typeof p.path==='string'&&p.path.startsWith(origin[1])&&p.path.split('/').every(x=>x&&x!=='.'&&x!=='..')&&!p.path.includes('\\')&&!p.path.includes('\0'),'DOMAIN_ORIGIN_DENIED');
  requireThat(typeof pin.git_blob_sha==='string'&&/^[a-f0-9]{40}$/.test(pin.git_blob_sha)&&await gitBlobSha(new TextEncoder().encode(raw_utf8))===pin.git_blob_sha,'DOMAIN_GIT_BLOB_MISMATCH');
 }else{
  exact(pin.source_pointer,['url'],'DOMAIN_HTTP_POINTER');requireThat(pin.source_kind==='OWNER_PUBLIC_RUNTIME'&&(Object.hasOwn(DOMAIN_RUNTIME_URLS,domain)&&pin.source_pointer.url===DOMAIN_RUNTIME_URLS[domain]||domain==='nearme'&&NEARME_COMPANION_RUNTIME_URLS.includes(pin.source_pointer.url))&&pin.git_blob_sha===null,'DOMAIN_ORIGIN_DENIED');
 }
 requireThat(await hash(raw_utf8)===pin.payload_sha256,'DOMAIN_PAYLOAD_HASH_MISMATCH');
 const data=JSON.parse(raw_utf8);requireThat(data&&typeof data==='object'&&!Array.isArray(data),'DOMAIN_SOURCE_OBJECT_REQUIRED');noSecrets(data);
 return {pin,data};
}
export function record(id,scope,data_class,timestamps,values,lineage_key){return {id,scope,data_class,timestamps,values,lineage_key,operational_action_allowed:false};}
export async function finishDomain(domain,sources,{records,issues=[],metadata={},legacy_payload}){
 requireThat(new Set(records.map(r=>r.id)).size===records.length,'DOMAIN_DUPLICATE_RECORD_ID');
 const body={contract_version:DOMAIN_SHADOW_VERSION,dataset_id:DOMAIN_DATASETS[domain],domain,mode:'BRIDGE_DEPENDENT_SHADOW',fixture_only:false,sources:sources.map(s=>s.pin),records,issues,metadata,independent_source_count:null,source_health_inferred_from_path:false,legacy_payload_digest:await hash(legacy_payload),operational_action_allowed:false,production_enabled:false};
 return {...body,projection_digest:await hash(body),legacy_payload:structuredClone(legacy_payload)};
}
