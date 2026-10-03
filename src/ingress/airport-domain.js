import {requireThat} from '../platform/contracts.js';
import {clone} from '../preparation/common.js';
import {decodeOwnedSource,finishDomain,record,time,dateOnly,utcTime,list} from './domain-source-common.js';

export async function normalizeAirportDomain(input,evaluation_time){
 const source=await decodeOwnedSource('airport',input),envelope=source.data;
 const http=source.pin.source_kind==='OWNER_PUBLIC_RUNTIME',d=http?envelope.latest:envelope;
 const live=http&&envelope.health?.live_proxy===true&&envelope.health?.source_mode==='OFFICIAL_JSON_API_LIVE_PROXY';
 if(http)requireThat(live||envelope.health?.live_proxy===false&&envelope.health?.source_mode==='GITHUB_SNAPSHOT_FALLBACK','AIRPORT_TRANSPORT_UNRESOLVED');
 requireThat(d&&d.schema_version===(live?'4.1-live':'3.0'),'AIRPORT_SOURCE_SCHEMA_DENIED');
 requireThat(dateOnly(d.source_date)&&utcTime(d.collected_at_vn),'AIRPORT_SOURCE_DATE_REQUIRED');requireThat(d.source?.api==='https://sunairport.com/phuquoc/cms/api/flights','AIRPORT_PROVIDER_DENIED');
 requireThat(d.report_state==='REPORT_READY'&&d.quality?.usable===true,'AIRPORT_BOARD_QA_NOT_READY');
 const rows=list(d.records,'AIRPORT_RECORDS',1000),records=[],issues=[];
 const counts={arrival:0,departure:0};
 for(const row of rows){
  requireThat(['arrival','departure'].includes(row.direction)&&typeof row.operating_flight_number==='string'&&row.operating_flight_number.length>0&&Number.isSafeInteger(row.source_id),'AIRPORT_FLIGHT_IDENTITY_REQUIRED');
  counts[row.direction]++;
  requireThat(typeof row.scheduled_time==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.scheduled_time),'AIRPORT_FLIGHT_SCHEDULE_REQUIRED');
  const id=d.source_date+':'+row.direction+':'+row.source_id;
  records.push(record(id,{airport:'PQC',service_date:d.source_date,direction:row.direction,operating_flight_number:row.operating_flight_number},'OPERATIONAL_BOARD_REPORTED',{board_checked_at:time(d.collected_at_vn),scheduled_local:row.scheduled_time,source_row_updated_raw:row.source_synced_at??null,source_row_updated_time_basis:'UNRESOLVED_DO_NOT_USE_AS_BOARD_FETCH_TIME'},clone(row),'SUN_AIRPORT:'+id));
 }
 requireThat(d.counts?.arrivals===counts.arrival&&d.counts?.departures===counts.departure&&d.counts?.total===rows.length,'AIRPORT_COUNT_MISMATCH');
 if(!live)issues.push({code:'AIRPORT_ARCHIVE_FALLBACK_NOT_LIVE'});
 if(Date.parse(d.collected_at_vn)>Date.parse(evaluation_time))issues.push({code:'AIRPORT_BOARD_CHECK_TIME_IN_FUTURE'});
 return finishDomain('airport',[source],{records,issues,metadata:{transport:live?'LIVE_PROXY_CAPTURE':'ARCHIVE_FALLBACK_CAPTURE',source_date:d.source_date,board_checked_at:time(d.collected_at_vn),board_version:d.board_version??null,counts:clone(d.counts),operating_aliases_are_not_extra_flights:true,live_update_lag_target_ms:60000,live_update_lag_verified:false,source_health_inferred_from_path:false},legacy_payload:envelope});
}
