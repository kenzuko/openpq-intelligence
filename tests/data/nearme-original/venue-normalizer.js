/* Shared browser/Node venue normalization for Near Me. No network or UI dependencies. */
(function(root,factory){
  const api=factory();
  root.OpenPQVenue=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const ZONES=Object.freeze({
    duong_dong:"zone_central_west",
    central_west:"zone_central_west",
    long_beach:"zone_central_west",
    north:"zone_north",
    south:"zone_south",
    sunset_town:"place_sunset_town"
  });
  function normalizeZone(value){
    const id=String(value||"").trim().toLowerCase();
    return ZONES[id]||id||null;
  }
  function numberInRange(value,min,max){
    if(value===null||value===undefined||String(value).trim()==="")return null;
    const number=Number(value);
    return Number.isFinite(number)&&number>=min&&number<=max?number:null;
  }
  function phuQuocCoordinates(item){
    const lat=numberInRange(item?.latitude??item?.map?.lat,9.5,10.7);
    const lon=numberInRange(item?.longitude??item?.map?.lon,103.5,104.5);
    if(lat===null||lon===null)return {lat:null,lon:null};
    return {lat,lon};
  }
  function normalizeVenue(item){
    if(!item||item.status!=="ACTIVE"||!item.id||!item.name)return null;
    const coords=phuQuocCoordinates(item);
    const category=String(item.category||"").trim();
    const precision=item.map?.precision||item.geo_precision||"unverified";
    return {
      id:item.id,
      entity_type:"venue",
      name:item.name,
      aliases:Array.isArray(item.aliases)?item.aliases:[],
      address:item.address||"",
      phone:item.phone||null,
      zone_id:normalizeZone(item.zone_id||item.zone_code),
      place_id:item.place_id||null,
      canonical_entity_id:item.canonical_entity_id||null,
      tags:[...new Set([category,...(Array.isArray(item.tags)?item.tags:[])].filter(Boolean))],
      utility_type:category,
      group:category,
      route:item.route||null,
      map:coords.lat===null?null:{...coords,precision},
      lat:coords.lat,
      lon:coords.lon,
      map_precision:coords.lat===null?null:precision,
      opening_hours_note:item.opening_hours?.note||"",
      verified_at:item.verified_at||null,
      source_ref:item.source_ref||null,
      status:item.status
    };
  }
  function foldName(text){
    return String(text||"").normalize("NFD").replace(/\p{M}/gu,"").replace(/[đĐ]/g,"d").toLowerCase().trim();
  }
  function mergeWithCanonical(indexRows,venueRows){
    const places=(indexRows||[]).filter(x=>x.entity_type==="place");
    const placeById=new Set(places.map(x=>x.id));
    const actualVenues=(venueRows||[]).filter(venue=>{
      if(venue.utility_type!=="ATTRACTION")return true;
      if(venue.canonical_entity_id&&placeById.has(venue.canonical_entity_id))return false;
      return !places.some(place=>{
        if(foldName(place.name)!==foldName(venue.name))return false;
        if(!Number.isFinite(place.lat)||!Number.isFinite(place.lon)||!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon))return false;
        return Math.abs(place.lat-venue.lat)<0.002&&Math.abs(place.lon-venue.lon)<0.002;
      });
    });
    return [...indexRows,...actualVenues];
  }
  return {normalizeZone,numberInRange,phuQuocCoordinates,normalizeVenue,mergeWithCanonical};
});
