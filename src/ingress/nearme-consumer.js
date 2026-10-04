import {DIRECTORY_SOURCE_URLS} from '../platform/directory-execution-contract.js';
import {requireThat,hash} from '../platform/contracts.js';
import {decodeOwnedSource,DOMAIN_RUNTIME_URLS,NEARME_COMPANION_RUNTIME_URLS} from './domain-source-common.js';
import {venueKernel} from './nearme-venue-kernel.js';

// Offline consumer rehearsal of the existing page's three pinned inputs.
// Companion editorial dates remain day precision; this does not admit them as live authority.
export async function rehearseNearMeConsumer({index,support,venues}){
 const inputs=await Promise.all([index,support,venues].map(x=>decodeOwnedSource('nearme',x)));
 const paths=['data/views/location-index.json','data/home-support.json','data/entities/destination-venues.json'];
 const urls=index.pin?.source_pointer?.url===DIRECTORY_SOURCE_URLS.index?Object.values(DIRECTORY_SOURCE_URLS):[DOMAIN_RUNTIME_URLS.nearme,...NEARME_COMPANION_RUNTIME_URLS];
 inputs.forEach((s,i)=>requireThat(s.pin.source_kind==='OWNER_REPOSITORY_SNAPSHOT'?s.pin.source_pointer.path===paths[i]:s.pin.source_pointer.url===urls[i],'NEARME_CONSUMER_PATH_DENIED'));
 const [locationIndex,homeSupport,venueDirectory]=inputs.map(s=>s.data);
 requireThat(Array.isArray(locationIndex.documents)&&Array.isArray(homeSupport.near_me?.items)&&Array.isArray(homeSupport.near_me?.categories)&&Array.isArray(venueDirectory.entities),'NEARME_COMPANION_SCHEMA_DENIED');
 const utilityMeta=new Map(homeSupport.near_me.items.map(x=>[x.utility_id,x]));
 const indexRows=locationIndex.documents.filter(doc=>!doc.duplicate_of).map(doc=>{
  const meta=doc.entity_type==='utility'?(utilityMeta.get(doc.id)||{}):{};
  return {...doc,...meta,id:doc.id,name:doc.name,address:doc.address||'',tags:doc.tags||[],route:doc.route||meta.route||null,lat:Number.isFinite(doc.map?.lat)?doc.map.lat:null,lon:Number.isFinite(doc.map?.lon)?doc.map.lon:null,map_precision:doc.map?.precision||null,group:doc.group||null,utility_type:doc.utility_type||null};
 });
 const venueRows=venueDirectory.entities.map(venueKernel.normalizeVenue).filter(Boolean);
 const rows=venueKernel.mergeWithCanonical(indexRows,venueRows);
 requireThat(new Set(rows.map(x=>x.id)).size===rows.length,'NEARME_CONSUMER_DUPLICATE_ID');
 return {contract_version:'openpq-nearme-consumer-rehearsal-v1',sources:inputs.map(s=>s.pin),input_index_count:locationIndex.documents.length,input_venue_count:venueDirectory.entities.length,index_count:indexRows.length,normalized_venue_count:venueRows.length,merged_count:rows.length,rows_digest:await hash(rows),rows,categories:homeSupport.near_me.categories,manual_areas:homeSupport.near_me.manual_areas,companion_authority_admitted:false,live_open_confirmed:false,production_enabled:false,operational_action_allowed:false};
}
