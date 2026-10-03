import {hash,requireThat} from '../platform/contracts.js';
import {clone} from '../preparation/common.js';
import {decodeOwnedSource,finishDomain,record,time,utcTime,list} from './domain-source-common.js';

const schemas={weather_forecast:'weather-scene-forecast-v1',weather_marine:'weather-spatial-v1',weather_compact:'weather-nowcast-compact-v1',weather_meta:'weather-runtime-meta-v1',weather_manifest:'weather-runtime-manifest-v1'};
const files={weather_forecast:'forecast',weather_marine:'marine',weather_cloud:'cloud',weather_compact:'compact',weather_meta:'meta',weather_manifest:'manifest'};
export async function normalizeWeatherProduct(domain,input,evaluation_time){
 requireThat(Object.hasOwn(files,domain),'WEATHER_PRODUCT_UNSUPPORTED');const source=await decodeOwnedSource(domain,input),d=source.data;
 requireThat(source.pin.source_pointer.path==='data/weather-runtime/'+files[domain]+'.json','WEATHER_PRODUCT_PATH_DENIED');
 requireThat(utcTime(d.generated_at),'WEATHER_PRODUCT_GENERATED_TIME_REQUIRED');if(domain!=='weather_cloud')requireThat(d.schema_version===schemas[domain],'WEATHER_PRODUCT_SCHEMA_DENIED');
 const records=[],issues=[];
 if(domain==='weather_forecast'){
  requireThat(d.source==='ECMWF_OPEN_DATA_DIRECT'&&utcTime(d.run_time)&&d.spatial?.display_interpolation==='RENDER_ONLY','WEATHER_FORECAST_ORIGIN_DENIED');
  const seen=new Set();for(const f of list(d.spatial.frames,'WEATHER_SPATIAL_FRAMES',200)){
   const run=f.lead_hours<=72?(d.spatial.short_run_time??d.run_time):(d.medium_run_time??d.run_time);requireThat(Number.isInteger(f.lead_hours)&&f.lead_hours>=0&&utcTime(f.valid_time)&&utcTime(run)&&Date.parse(f.valid_time)===Date.parse(run)+f.lead_hours*3600000,'WEATHER_FORECAST_CYCLE_MISMATCH');
   requireThat(!seen.has(f.valid_time),'WEATHER_FORECAST_DUPLICATE_FRAME');seen.add(f.valid_time);const ids=new Set();
   for(const c of list(f.cells,'WEATHER_FORECAST_CELLS',10000)){requireThat(typeof c.cell_id==='string'&&!ids.has(c.cell_id)&&utcTime(c.valid_time)===utcTime(f.valid_time)&&c.lead_hours===f.lead_hours&&Number.isFinite(c.lat)&&Number.isFinite(c.lon),'WEATHER_FORECAST_CELL_SCOPE_DENIED');ids.add(c.cell_id);}
   records.push(record('frame:'+f.valid_time,{provider:'ECMWF',lead_hours:f.lead_hours},'MODEL_FORECAST',{model_run:time(run),valid_time:time(f.valid_time),source_freshness:'MODEL_CYCLE_NOT_OBSERVATION'}, {cell_count:f.cells.length,cells_digest:await hash(f.cells),variables:[...new Set(f.cells.flatMap(c=>Object.keys(c)))].sort(),sample_cell:clone(f.cells[0]??null),render_interpolation_only:true},'ECMWF:'+run+':'+f.valid_time));
  }
 }else if(domain==='weather_marine'){
  requireThat(d.source==='COPERNICUS_MARINE','WEATHER_MARINE_ORIGIN_DENIED');
  for(const k of ['current','wave']){const p=d[k];requireThat(p&&utcTime(p.sampled_time)&&p.display_interpolation==='RENDER_ONLY','WEATHER_MARINE_TIME_OR_RENDER_DENIED');list(p.cells,'WEATHER_MARINE_CELLS',10000);requireThat(p.cell_count===p.cells.length,'WEATHER_MARINE_COUNT_MISMATCH');records.push(record(k,{provider:'COPERNICUS_MARINE',dataset:k==='current'?d.current_dataset:d.wave_dataset},'MODEL_MARINE_FIELD',{valid_time:time(p.sampled_time),source_freshness:'MODEL_FIELD_NOT_IN_SITU_OBSERVATION'},{cell_count:p.cells.length,cells_digest:await hash(p.cells),sample_cell:clone(p.cells[0]??null),native_resolution_deg:clone(p.native_resolution_deg),render_interpolation_only:true},'COPERNICUS:'+k+':'+p.sampled_time));}
 }else if(domain==='weather_cloud'){
  requireThat(d.source_type==='OBSERVED_SATELLITE'&&d.source==='JMA_HIMAWARI9_VIA_NOAA_OPEN_DATA'&&utcTime(d.sampled_time),'WEATHER_CLOUD_ORIGIN_DENIED');
  const seen=new Set();for(const f of list(d.spatial?.frames,'WEATHER_CLOUD_FRAMES',64)){requireThat(utcTime(f.sampled_time)&&!seen.has(f.sampled_time),'WEATHER_CLOUD_FRAME_TIME_DENIED');seen.add(f.sampled_time);list(f.cells,'WEATHER_CLOUD_CELLS',10000);requireThat(f.cells.every(c=>Number.isFinite(c.lat)&&Number.isFinite(c.lon)),'WEATHER_CLOUD_CELL_SCOPE_DENIED');records.push(record('cloud:'+f.sampled_time,{provider:d.source},'REMOTE_SENSING_PROXY',{sampled_time:time(f.sampled_time),source_freshness:'SATELLITE_PROXY_NOT_DIRECT_RAIN_LIGHTNING'},{cell_count:f.cells.length,cells_digest:await hash(f.cells),sample_cell:clone(f.cells[0]??null),display_grid_deg:d.spatial.display_grid_deg,sampling_method:d.spatial.sampling_method},'HIMAWARI:'+f.sampled_time));}
 }else{
  if(domain==='weather_manifest')requireThat(d.policy?.frontend_source==='SAME_ORIGIN_CANONICAL_ONLY'&&d.policy.browser_fallback==='DISABLED'&&d.policy.legacy_fallback==='DISABLED','WEATHER_MANIFEST_FALLBACK_DENIED');
  records.push(record(files[domain],{product:files[domain]},domain==='weather_compact'?'DERIVED_SATELLITE_PRESENTATION':'SOURCE_REGISTRY_OR_MANIFEST_REFERENCE',{generated_at:time(d.generated_at),sampled_time:time(d.sampled_time),source_freshness:'DERIVED_VERSION_NOT_INDEPENDENT_PROVIDER'},clone(d),'JOTRIP_WEATHER_RUNTIME:'+files[domain]));
 }
 return finishDomain(domain,[source],{records,issues,metadata:{generated_at:time(d.generated_at),source_schema:d.schema_version??null,canonical_path:'/data/weather-runtime/'+files[domain]+'.json',source:d.source??null,mirror_is_independent_evidence:false,provider_cycle_or_sample_preserved:true,cell_values_recovered_from_pinned_source:true},legacy_payload:d});
}
