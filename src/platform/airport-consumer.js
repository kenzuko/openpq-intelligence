import {hash,requireThat,sameLocator} from './contracts.js';
import {boundedText} from './bounded-text.js';
import {AIRPORT_FACT_PROFILE_VERSION} from './domain-continuous-contract.js';
import {AIRPORT_FACT_ENVIRONMENT,AIRPORT_FACT_ACCOUNT,AIRPORT_SOURCE_URL,AIRPORT_FACT_DATASET} from './airport-execution-contract.js';
const AIRPORT_SOURCE_URLS={airport:AIRPORT_SOURCE_URL},AIRPORT_DATASET_BY_DOMAIN={airport:AIRPORT_FACT_DATASET};
export const AIRPORT_CANONICAL_ORIGIN='https://openpq-intelligence-airport-runtime.kenzuko.workers.dev';
// Read admitted bytes only. No collector, field classification, decision or silent legacy fallback.
export async function readAirportConsumer(config,{fetcher=(url,options)=>fetch(url,options),clock=()=>Date.now()}={}){
 requireThat(config&&['LEGACY','CANONICAL'].includes(config.mode)&&Object.hasOwn(AIRPORT_SOURCE_URLS,config.domain),'AIRPORT_READER_SCOPE_REQUIRED',503);
 const get=async url=>{const r=await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});requireThat(r.ok,'AIRPORT_READER_HTTP_'+r.status,503);requireThat(r.headers.get('content-type')?.split(';')[0]==='application/json','AIRPORT_READER_CONTENT_TYPE_DENIED',503);return {response:r,raw:await boundedText(r,1500000)};};
 if(config.mode==='LEGACY'){const {raw}=await get(AIRPORT_SOURCE_URLS[config.domain]);const data=JSON.parse(raw);requireThat(data&&typeof data==='object'&&!Array.isArray(data),'AIRPORT_LEGACY_SHAPE_DENIED',503);return {raw,reader:'LEGACY',source_digest:await hash(raw),canonical_transfer_proven:false};}
 const t=config.trust,dataset=AIRPORT_DATASET_BY_DOMAIN[config.domain];
 requireThat(config.origin===AIRPORT_CANONICAL_ORIGIN&&t?.environment_id===AIRPORT_FACT_ENVIRONMENT&&t.account_id===AIRPORT_FACT_ACCOUNT&&t.dataset_id===dataset&&/^[a-f0-9]{64}$/.test(t.semantic_profile_hash??''),'AIRPORT_CONSUMER_TRUST_REQUIRED',503);
 const path=config.origin+'/datasets/'+dataset,view=JSON.parse((await get(path)).raw),r=view.receipt,p=r?.semantic_admission;
 requireThat(sameLocator(r,t)&&p?.contract_version===AIRPORT_FACT_PROFILE_VERSION&&p.profile_hash===t.semantic_profile_hash&&p.action_allowed===false&&p.producer_independence===false&&p.source_policies_activated===false&&view.decision?.effect==='ABSTAIN'&&view.serving?.authority==='VERIFIED'&&view.serving.fallback===false,'AIRPORT_CONSUMER_AUTHORITY_DENIED',503);
 requireThat(view.data?.domain===config.domain&&view.data.dataset_id===dataset&&view.data.sources?.length===1&&view.data.sources[0].source_kind==='OWNER_PUBLIC_RUNTIME'&&view.data.sources[0].source_pointer?.url===AIRPORT_SOURCE_URLS[config.domain],'AIRPORT_CONSUMER_DEPENDENCY_DENIED',503);
 const {raw,response}=await get(path+'/legacy-reference'),data=JSON.parse(raw);
 requireThat(response.headers.get('x-openpq-receipt-digest')===r.digest&&response.headers.get('x-openpq-source-digest')===p.input_hash&&await hash(raw)===p.input_hash&&await hash(data)===view.data.legacy_payload_digest,'AIRPORT_CONSUMER_SNAPSHOT_CHANGED_OR_TAMPERED',503);
 const now=clock(),expiry=Date.parse(p.valid_until),source=Date.parse(p.source_version_time);
 requireThat(data.health?.live_proxy===true&&data.health?.source_mode==='OFFICIAL_JSON_API_LIVE_PROXY'&&Date.parse(data.latest?.collected_at_vn)===source&&now-source<60000,'AIRPORT_LIVE_FRESHNESS_DENIED',503);
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(x=>[x.type,x.value]));requireThat(data.latest.source_date===parts.year+'-'+parts.month+'-'+parts.day,'AIRPORT_CURRENT_DAY_REQUIRED',503);
 requireThat(Number.isFinite(now)&&Number.isFinite(source)&&source<=now&&Number.isFinite(expiry)&&now<expiry&&response.headers.get('x-openpq-display-expires-at')===p.valid_until,'AIRPORT_CONSUMER_EXPIRED',503);
 requireThat(response.headers.get('x-openpq-decision-eligibility')==='ABSTAIN'&&response.headers.get('x-openpq-source-snapshot')==='reference-only'&&response.headers.get('cache-control')==='no-store','AIRPORT_CONSUMER_REFERENCE_CONTRACT_DENIED',503);
 return {raw,reader:'CANONICAL',source_digest:p.input_hash,receipt_digest:r.digest,revision:r.revision,source_version_time:p.source_version_time,display_expires_at:p.valid_until,canonical_transfer_proven:false};
}
