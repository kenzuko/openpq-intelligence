import {requireThat} from '../platform/contracts.js';
import {clone} from '../preparation/common.js';
import {decodeOwnedSource,finishDomain,record,time,freshness,utcTime,list} from './domain-source-common.js';

export async function normalizeWeatherDomain(input,evaluation_time){
 const source=await decodeOwnedSource('weather',input),d=source.data;requireThat(d.schema_version==='weather-current-v3','WEATHER_SOURCE_SCHEMA_DENIED');requireThat(utcTime(d.generated_at),'WEATHER_GENERATED_TIME_REQUIRED');
 const gt=d.groundtruth;requireThat(gt&&gt.atmosphere&&gt.rainfall&&gt.source_registry,'WEATHER_GROUNDTRUTH_REQUIRED');
 const registry=list(gt.source_registry.sources,'WEATHER_SOURCE_REGISTRY',64);requireThat(new Set(registry.map(x=>x.id)).size===registry.length,'WEATHER_REGISTRY_DUPLICATE');
 const records=[],issues=[];
 function observation(id,namespace,identifier,row,policyId){
  const p=registry.find(x=>x.id===policyId),budget=p?.freshness?.budget_minutes??null;const stamp=time(row.observed_at);
  const f=freshness(row.observed_at,evaluation_time,budget);
  if(f.state!=='WITHIN_REPORTED_BUDGET')issues.push({code:'WEATHER_OBSERVATION_'+f.state,record_id:id});
  if(!stamp.utc)issues.push({code:'WEATHER_OBSERVATION_TIME_UNRESOLVED',record_id:id});
  records.push(record(id,{namespace,identifier,station_epoch:row.station_epoch??null,location_id:row.location_id??null,lat:row.lat??row.reference_lat??null,lon:row.lon??row.reference_lon??null},'OBSERVATION',{observed_at:stamp,publisher_updated_at:time(row.source_reported_at),collected_at:time(row.fetched_at),source_freshness:f},clone(row),namespace+':'+identifier+':'+(row.station_epoch??'current')+':'+(row.observed_at??'unknown')+':'+(row.raw_payload_hash??'unknown')));
 }
 const v=gt.atmosphere.vvpq;if(v){requireThat(v.station_id==='VVPQ'&&v.data_class==='ACTUAL','WEATHER_METAR_IDENTITY_DENIED');observation('metar:VVPQ','ICAO','VVPQ',v,'vvpq_metar_speci');}
 const syn=gt.atmosphere.synop_48917;if(syn){
  requireThat(syn.source_namespace==='WMO_INDEX'&&syn.identifier==='48917'&&syn.identity_status==='INDEPENDENT_FROM_CURRENT_VVPQ'&&syn.identity_resolution_id==='WMO_INDEX:48917:CURRENT_2026_DUONG_DONG:v1','WEATHER_SYNOP_IDENTITY_UNRESOLVED');
  observation('synop:48917','WMO_INDEX','48917',syn,'wmo_48917_synop');
 }
 for(const [id,row] of Object.entries(gt.rainfall.stations||{}).sort()){requireThat(row.data_class==='ACTUAL','WEATHER_RAIN_CLASS_DENIED');observation('rain:'+id,'VRAIN',row.station_id??id,row,'vrain_phu_quoc');}
 for(const [id,row] of Object.entries(d.local_now?.points||{}).sort()){
  requireThat(utcTime(row.analysis_time),'WEATHER_ANALYSIS_TIME_REQUIRED');
  records.push(record('estimate:'+id,{point_id:id,lat:row.lat,lon:row.lon},'ESTIMATED_NOW',{analysis_time:time(row.analysis_time),source_freshness:'NOT_AN_OBSERVATION'},clone(row),'JOTRIP_LOCAL_NOW:'+id+':'+row.analysis_time));
 }
 const n=d.nowcast;if(n){requireThat(utcTime(n.sampled_time),'WEATHER_SATELLITE_TIME_REQUIRED');records.push(record('satellite:nowcast',{provider:n.source??null},'REMOTE_SENSING_PROXY',{sampled_time:time(n.sampled_time),generated_at:time(n.generated_at)},clone(n),'HIMAWARI:'+n.sampled_time));if(n.lightning_observed?.status!=='CONNECTED')issues.push({code:'WEATHER_LIGHTNING_NOT_DIRECTLY_OBSERVED'});}
 for(const [id,rows] of Object.entries(d.model_72h?.points||{}).sort()){
  const seen=new Set();for(const row of list(rows,'WEATHER_MODEL_POINTS',200)){requireThat(utcTime(row.time)&&row.data_class==='MODEL_ONLY','WEATHER_MODEL_CLASS_OR_TIME_DENIED');requireThat(!seen.has(row.time),'WEATHER_MODEL_DUPLICATE_FRAME');seen.add(row.time);
   records.push(record('forecast:'+id+':'+row.time,{point_id:id,reference_point:row.reference_point??null},'MODEL_FORECAST',{valid_time:time(row.time),model_run:time(row.model_run??null),source_freshness:'VALID_TIME_IS_NOT_MODEL_RUN'},clone(row),'JOTRIP_MODEL_72H:'+id+':'+row.time));
  }
 }
 const unresolvedModelRun=records.filter(r=>r.data_class==='MODEL_FORECAST'&&!r.timestamps.model_run.utc).length;
 if(unresolvedModelRun)issues.push({code:'WEATHER_MODEL_RUN_LINK_UNRESOLVED',records:unresolvedModelRun});
 return finishDomain('weather',[source],{records,issues,metadata:{generated_at:time(d.generated_at),registry_source_count:registry.length,reported_status:gt.status,mirror_is_independent_evidence:false,policy_origin:'SOURCE_REGISTRY_REPORTED_BUDGETS_NOT_PRODUCTION_ACTIVATION',unknowns_preserved:true},legacy_payload:d});
}
