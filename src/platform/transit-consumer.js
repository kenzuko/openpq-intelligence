import {hash,requireThat,sameLocator} from './contracts.js';
import {boundedText} from './bounded-text.js';
import {TRANSIT_FACT_ACCOUNT,TRANSIT_FACT_ENVIRONMENT} from './transit-execution-scope.js';
import {TRANSIT_FACT_PROFILE_VERSION} from './domain-continuous-contract.js';
export const TRANSIT_CANONICAL_ORIGIN='https://openpq-intelligence-transit-runtime.kenzuko.workers.dev';
export const TRANSIT_LEGACY_URL='https://raw.githubusercontent.com/kenzuko/transit-jotrip/main/data/network.json';
// Transport an already admitted owner report. No collector, reclassification or silent fallback.
export async function readTransitConsumer(config,{fetcher=(url,options)=>fetch(url,options),clock=()=>Date.now()}={}){
 requireThat(config&&['LEGACY','CANONICAL'].includes(config.mode),'TRANSIT_READER_MODE_REQUIRED',503);
 const get=async url=>{
  // workerd supports manual/follow; reject 3xx ourselves instead of using unsupported "error".
  const r=await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(8000),headers:{accept:'application/json'}});
  requireThat(r.ok,'TRANSIT_READER_HTTP_'+r.status,503);
  const type=r.headers.get('content-type')?.split(';')[0];
  requireThat(type==='application/json'||url===TRANSIT_LEGACY_URL&&type==='text/plain','TRANSIT_READER_CONTENT_TYPE_DENIED',503);
  return {response:r,raw:await boundedText(r,262144)};
 };
 if(config.mode==='LEGACY'){
  const {raw}=await get(TRANSIT_LEGACY_URL);const data=JSON.parse(raw);
  requireThat(data.schema_version==='1.1'&&Array.isArray(data.departures)&&Array.isArray(data.services),'TRANSIT_LEGACY_SHAPE_DENIED',503);
  return {raw,reader:'LEGACY',source_digest:await hash(raw),canonical_transfer_proven:false};
 }
 const t=config.trust;
 requireThat(config.origin===TRANSIT_CANONICAL_ORIGIN&&t?.environment_id===TRANSIT_FACT_ENVIRONMENT&&t.account_id===TRANSIT_FACT_ACCOUNT&&t.dataset_id==='transit.bridge.phu-quoc'&&/^[a-f0-9]{64}$/.test(t.semantic_profile_hash??''),'TRANSIT_CONSUMER_TRUST_REQUIRED',503);
 const path=config.origin+'/datasets/'+t.dataset_id;
 const view=JSON.parse((await get(path)).raw),r=view.receipt,p=r?.semantic_admission;
 requireThat(sameLocator(r,t)&&p?.contract_version===TRANSIT_FACT_PROFILE_VERSION&&p.profile_hash===t.semantic_profile_hash&&p.action_allowed===false&&p.producer_independence===false&&p.source_policies_activated===false&&view.decision?.effect==='ABSTAIN'&&view.serving?.authority==='VERIFIED'&&view.serving.fallback===false,'TRANSIT_CONSUMER_AUTHORITY_DENIED',503);
 requireThat(view.data?.domain==='transit'&&view.data.dataset_id===t.dataset_id&&view.data.sources?.length===1&&view.data.sources[0].source_kind==='OWNER_REPOSITORY_SNAPSHOT'&&view.data.sources[0].source_pointer?.repository==='kenzuko/transit-jotrip'&&view.data.sources[0].source_pointer.path==='data/network.json','TRANSIT_CONSUMER_DEPENDENCY_DENIED',503);
 const {raw,response}=await get(path+'/legacy-reference'),data=JSON.parse(raw);
 requireThat(response.headers.get('x-openpq-receipt-digest')===r.digest&&response.headers.get('x-openpq-source-digest')===p.input_hash&&await hash(raw)===p.input_hash&&await hash(data)===view.data.legacy_payload_digest,'TRANSIT_CONSUMER_SNAPSHOT_CHANGED_OR_TAMPERED',503);
 const expiry=Date.parse(p.valid_until),source=Date.parse(p.source_version_time),now=clock();
 requireThat(Number.isFinite(now)&&Number.isFinite(source)&&source<=now&&Number.isFinite(expiry)&&now<expiry&&response.headers.get('x-openpq-display-expires-at')===p.valid_until,'TRANSIT_CONSUMER_EXPIRED',503);
 requireThat(response.headers.get('x-openpq-decision-eligibility')==='ABSTAIN'&&response.headers.get('x-openpq-source-snapshot')==='reference-only'&&response.headers.get('cache-control')==='no-store','TRANSIT_CONSUMER_REFERENCE_CONTRACT_DENIED',503);
 return {raw,reader:'CANONICAL',source_digest:p.input_hash,receipt_digest:r.digest,revision:r.revision,source_version_time:p.source_version_time,display_expires_at:p.valid_until,canonical_transfer_proven:false};
}
