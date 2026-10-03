import {requireThat} from '../platform/contracts.js';
import {clone} from '../preparation/common.js';
import {decodeOwnedSource,finishDomain,record,time,utcTime,list} from './domain-source-common.js';

const forbiddenTypes=new Set(['office','company','travel_agency']);
const forbiddenTags=new Set(['OFFICE','COMPANY','TRAVEL_AGENCY','BUS_STOP']);
export async function normalizeNearMeDomain(input,evaluation_time){
 const source=await decodeOwnedSource('nearme',input),d=source.data;requireThat(d.schema_version==='1.0'&&Array.isArray(d.documents)&&utcTime(d.generated_at),'NEARME_SOURCE_SCHEMA_DENIED');
 const records=[],issues=[];const seen=new Set();
 for(const row of list(d.documents,'NEARME_DOCUMENTS',5000)){
  requireThat(typeof row.id==='string'&&row.id&&typeof row.name==='string'&&row.name,'NEARME_IDENTITY_REQUIRED');requireThat(!seen.has(row.id),'NEARME_DUPLICATE_ID');seen.add(row.id);
  if(row.duplicate_of){issues.push({code:'NEARME_EXPLICIT_DUPLICATE_EXCLUDED',record_id:row.id,target:row.duplicate_of});continue;}
  if(forbiddenTypes.has(row.entity_type)||(row.tags||[]).some(x=>forbiddenTags.has(x))||(/[\u0400-\u04FF]/u.test(row.name)&&!/vinpearl|vinmec/i.test(row.name))){issues.push({code:'NEARME_DIRECTORY_FILTER_EXCLUDED',record_id:row.id});continue;}
  requireThat(['place','activity','hotel','utility'].includes(row.entity_type),'NEARME_ENTITY_TYPE_DENIED');
  const p=row.map,valid=Boolean(p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=9.5&&p.lat<=10.7&&p.lon>=103.5&&p.lon<=104.5&&['site_centroid','area_anchor','entrance','verified_entrance'].includes(p.precision));
  if(p&&!valid)issues.push({code:'NEARME_GPS_UNRESOLVED',record_id:row.id});
  if(valid&&p.precision==='area_anchor')issues.push({code:'NEARME_AREA_ANCHOR_NOT_ENTRANCE',record_id:row.id});
  const values={id:row.id,name:row.name,entity_type:row.entity_type,address:row.address??null,phone:row.phone??null,route:row.route??null,zone_id:row.zone_id??null,tags:clone(row.tags||[]),utility_type:row.utility_type??null,opening_hours:clone(row.opening_hours??null),opening_hours_note:row.opening_hours_note??null,reported_operational_status:row.operational_status??null,publication_status:row.publication_status??null,map:valid?clone(p):null,inherited_from:row.inherited_from??null,source_license:row.source_license??null,live_open_confirmed:false,precise_entrance_confirmed:Boolean(valid&&p.precision==='verified_entrance')};
  records.push(record(row.id,{entity_type:row.entity_type,zone_id:row.zone_id??null},'DIRECTORY_REFERENCE',{editorial_updated_at:time(row.updated_at),gps_verified_at:time(p?.verified_at),opening_schedule_verified_at:time(row.opening_hours?.verified_at),source_freshness:'DIRECTORY_REFERENCE_NOT_LIVE'},values,'OPENPQ_DIRECTORY:'+row.id));
 }
 return finishDomain('nearme',[source],{records,issues,metadata:{generated_at:time(d.generated_at),input_document_count:d.documents.length,index_is_derived:true,live_opening_not_inferred:true,osm_attribution:'© OpenStreetMap contributors; ODbL-1.0 where source_license indicates ODbL',bus_stop_import:false,source_health_inferred_from_path:false},legacy_payload:d});
}
