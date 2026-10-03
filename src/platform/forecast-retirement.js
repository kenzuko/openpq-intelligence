import {stable} from './contracts.js';
import {unpackDomainText} from './domain-codec.js';

// A public forecast view retires expired frames without changing its model
// cycle. This permits only that exact subset operation, never a new value,
// frame, source timestamp, or removal of a still-valid frame.
export async function isExpiredForecastRetirement(previous,current,at){
 if(previous?.payload?.domain_snapshot?.domain!=='weather_forecast'||current?.payload?.domain_snapshot?.domain!=='weather_forecast')return false;
 if(previous.semantic_profile_hash!==current.semantic_profile_hash||previous.semantic_admission?.source_version_time!==current.semantic_admission?.source_version_time)return false;
 if(previous.semantic_admission?.input_hash&&previous.semantic_admission.input_hash===current.semantic_admission?.input_hash)return false;
 const a=JSON.parse(await unpackDomainText(previous.semantic_bundle.encoded_source)),b=JSON.parse(await unpackDomainText(current.semantic_bundle.encoded_source));
 const old=a.spatial?.frames,next=b.spatial?.frames;if(!Array.isArray(old)||!Array.isArray(next)||!next.length||next.length>=old.length)return false;
 const times=new Set(next.map(f=>f.valid_time));
 const removed=old.filter(f=>!times.has(f.valid_time));
 if(!removed.length||removed.some(f=>!Number.isFinite(Date.parse(f.valid_time))||Date.parse(f.valid_time)>at))return false;
 const retained=old.filter(f=>times.has(f.valid_time));
 if(stable(retained)!==stable(next))return false;
 const withoutFrames=x=>({...x,spatial:{...x.spatial,frames:[]}});
 return stable(withoutFrames(a))===stable(withoutFrames(b));
}
