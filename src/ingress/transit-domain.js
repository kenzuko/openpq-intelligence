import {requireThat} from '../platform/contracts.js';
import {clone} from '../preparation/common.js';
import {decodeOwnedSource,finishDomain,record,time,localDay,dateOnly,utcTime,list} from './domain-source-common.js';

export async function normalizeTransitDomain(input,evaluation_time){
 const source=await decodeOwnedSource('transit',input),d=source.data;requireThat(d.schema_version==='1.1'&&utcTime(d.generated_at),'TRANSIT_SOURCE_SCHEMA_DENIED');
 const day=localDay(d.generated_at),records=[],issues=[];
 if(day!==localDay(evaluation_time))issues.push({code:'TRANSIT_SERVICE_DAY_NOT_CURRENT',service_date:day});
 const seen=new Set();
 for(const row of list(d.departures,'TRANSIT_DEPARTURES',1000)){
  requireThat(row.type==='sea'&&['FERRY','FAST FERRY'].includes(row.mode),'TRANSIT_VEHICLE_GROUP_DENIED');
  requireThat(row.date_specific===true&&row.service_date_basis==='date_specific'&&['operational_public','date_specific_official'].includes(row.data_kind),'TRANSIT_DATE_SPECIFIC_REQUIRED');
  requireThat(utcTime(row.departure_time)&&localDay(row.departure_time)===day,'TRANSIT_DEPARTURE_DAY_MISMATCH');
  requireThat(row.arrival_time===null||row.arrival_time===undefined||utcTime(row.arrival_time),'TRANSIT_ARRIVAL_TIME_INVALID');
  requireThat(['operator','origin','destination','vessel_or_service'].every(k=>typeof row[k]==='string'&&row[k]),'TRANSIT_SERVICE_IDENTITY_REQUIRED');
  requireThat(!Object.hasOwn(row,'seat_count')&&!Object.hasOwn(row,'seats_remaining'),'TRANSIT_PRIVATE_SEATS_FORBIDDEN');
  const id=[day,row.mode,row.operator,row.origin,row.destination,row.departure_time,row.vessel_or_service].join('|');requireThat(!seen.has(id),'TRANSIT_DUPLICATE_DEPARTURE');seen.add(id);
  records.push(record(id,{service_date:day,mode:row.mode,operator:row.operator,origin:row.origin,destination:row.destination},'DATE_SPECIFIC_DEPARTURE_REPORTED',{departure_at:time(row.departure_time),arrival_at:time(row.arrival_time),fare_checked_at:time(row.fare?.checked_at),board_generated_at:time(d.generated_at),status_observed_at:time(row.status_observed_at??null)},clone(row),'TRANSIT_OPERATOR:'+id));
 }
 for(const row of list(d.services,'TRANSIT_BUS_SERVICES',100)){
  requireThat(row.type==='bus'&&row.data_kind==='schedule_frequency'&&typeof row.route_id==='string'&&dateOnly(row.verified_at),'TRANSIT_BUS_SCHEDULE_REQUIRED');
  records.push(record('bus:'+row.operator+':'+row.route_id,{mode:'BUS',operator:row.operator,route_id:row.route_id},'PUBLISHED_SCHEDULE_FREQUENCY',{verified_at:time(row.verified_at),source_freshness:'DATE_ONLY_NOT_LIVE'},clone(row),'BUS_SCHEDULE:'+row.operator+':'+row.route_id+':'+row.verified_at));
 }
 for(const [id,s] of Object.entries(d.sources?.registry||{}).sort())if(s.status!=='ok')issues.push({code:'TRANSIT_PROVIDER_'+String(s.status).toUpperCase(),provider_id:id,records:s.records??null});
 const unresolvedStatusTimes=records.filter(r=>r.data_class==='DATE_SPECIFIC_DEPARTURE_REPORTED'&&!r.timestamps.status_observed_at.utc).length;
 if(unresolvedStatusTimes)issues.push({code:'TRANSIT_STATUS_TIME_NOT_EXPLICIT',records:unresolvedStatusTimes});
 return finishDomain('transit',[source],{records,issues,metadata:{service_date:day,generated_at:time(d.generated_at),reported_health:clone(d.health),reported_registry:clone(d.sources?.registry||{}),ticket_stock_not_inferred:true,vehicle_groups_separate:true,source_health_inferred_from_path:false},legacy_payload:d});
}
