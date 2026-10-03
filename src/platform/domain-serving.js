import {hash,requireThat,sameLocator} from './contracts.js';
import {verifyAttestation} from './receipts.js';
import {unpackDomainJson,unpackDomainText} from './domain-codec.js';

// Read-only serving checks. No source collection, normalization, classification kernel or source credential.
export async function domainSnapshotServing(generation,now){
 const snapshot=generation.payload?.domain_snapshot;requireThat(snapshot?.contract_version==='openpq-domain-snapshot-local-v1','DOMAIN_SERVING_CONTRACT_DENIED');
 const projection=await unpackDomainJson(snapshot.encoded_projection),{projection_digest,...body}=projection;
 requireThat(await hash(body)===projection_digest&&projection_digest===snapshot.projection_digest&&generation.semantic_admission?.preparation_hash===projection_digest,'DOMAIN_SERVING_DIGEST_DENIED');
 const fields=projection.records.map(r=>{
  const t=r.timestamps;let freshness='REFERENCE_ONLY',source_time=null;
  if(r.data_class==='OBSERVATION'){
   source_time=t.observed_at.utc;const budget=t.source_freshness.budget_minutes;
   freshness=!source_time?'UNKNOWN_SOURCE_TIME':now<Date.parse(source_time)?'FUTURE_SOURCE_TIME':Number.isFinite(budget)&&budget>0?(now<Date.parse(source_time)+budget*60000?'WITHIN_REPORTED_BUDGET':'OUTSIDE_REPORTED_BUDGET'):'NO_ACTIVATED_SOURCE_BUDGET';
  }
  if(r.data_class==='OPERATIONAL_BOARD_REPORTED'){
   source_time=t.board_checked_at.utc;freshness=projection.metadata.transport==='LIVE_PROXY_CAPTURE'?(now>=Date.parse(source_time)&&now-Date.parse(source_time)<60000?'WITHIN_USER_LAG_TARGET':'OUTSIDE_USER_LAG_TARGET'):'ARCHIVE_FALLBACK_NOT_LIVE';
   if(new Date(now+7*3600000).toISOString().slice(0,10)!==r.scope.service_date)freshness='OTHER_DAY_REFERENCE';
  }
  if(r.data_class==='DATE_SPECIFIC_DEPARTURE_REPORTED'){
   const day=new Date(now+7*3600000).toISOString().slice(0,10);freshness=day===r.scope.service_date?'DAY_SCHEDULE_REFERENCE_STATUS_TIME_UNKNOWN':'OTHER_DAY_REFERENCE';
  }
  return {record_id:r.id,data_class:r.data_class,freshness,source_time,operational_action_allowed:false};
 });
 return {projection,serving:{contract_version:'openpq-domain-field-serving-v1',source_snapshot_is_reference:true,source_policies_activated:false,producer_independent:false,fields,operational_action_allowed:false}};
}
// A future consumer bridge can recover exactly the verified legacy JSON shape without re-running truth rules.
export async function domainLegacyView(generation,envelope,trust){
 requireThat(trust&&envelope,'DOMAIN_INDEPENDENT_RECEIPT_TRUST_REQUIRED');
 const receipt=await verifyAttestation(envelope,trust);
 requireThat(sameLocator(generation,trust)&&await hash(generation)===receipt.digest&&generation.semantic_profile_hash===trust.semantic_profile_hash&&receipt.semantic_admission?.profile_hash===trust.semantic_profile_hash,'DOMAIN_LEGACY_AUTHORITY_DENIED');
 requireThat(generation.semantic_bundle?.contract_version==='openpq-owned-domain-bundle-local-v1','DOMAIN_LEGACY_BUNDLE_DENIED');
 const raw=await unpackDomainText(generation.semantic_bundle.encoded_source);requireThat(await hash(raw)===generation.semantic_bundle.pin.payload_sha256&&await hash(raw)===generation.semantic_admission?.input_hash,'DOMAIN_LEGACY_SOURCE_DIGEST_DENIED');
 const legacy=JSON.parse(raw);const projection=await unpackDomainJson(generation.payload.domain_snapshot.encoded_projection);requireThat(await hash(legacy)===projection.legacy_payload_digest,'DOMAIN_LEGACY_VIEW_MISMATCH');return legacy;
}
