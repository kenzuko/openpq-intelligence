import {hash,requireThat,sameLocator} from './contracts.js';
import {boundedText} from './bounded-text.js';
import {WEATHER_FACT_PROFILE_VERSION} from './domain-continuous-contract.js';
import {WEATHER_FACT_ENVIRONMENT,WEATHER_FACT_ACCOUNT,WEATHER_SOURCE_URLS,WEATHER_DATASET_BY_DOMAIN} from './weather-execution-contract.js';
export const WEATHER_CANONICAL_ORIGIN='https://openpq-intelligence-weather-runtime.kenzuko.workers.dev';
// Read admitted bytes only. No collector, field classification, decision or silent legacy fallback.
export async function readWeatherConsumer(config,{fetcher=(url,options)=>fetch(url,options),clock=()=>Date.now()}={}){
 requireThat(config&&['LEGACY','CANONICAL'].includes(config.mode)&&Object.hasOwn(WEATHER_SOURCE_URLS,config.domain),'WEATHER_READER_SCOPE_REQUIRED',503);
 const get=async url=>{const r=await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});requireThat(r.ok,'WEATHER_READER_HTTP_'+r.status,503);requireThat(r.headers.get('content-type')?.split(';')[0]==='application/json','WEATHER_READER_CONTENT_TYPE_DENIED',503);return {response:r,raw:await boundedText(r,1500000)};};
 if(config.mode==='LEGACY'){const {raw}=await get(WEATHER_SOURCE_URLS[config.domain]);const data=JSON.parse(raw);requireThat(data&&typeof data==='object'&&!Array.isArray(data),'WEATHER_LEGACY_SHAPE_DENIED',503);return {raw,reader:'LEGACY',source_digest:await hash(raw),canonical_transfer_proven:false};}
 const t=config.trust,dataset=WEATHER_DATASET_BY_DOMAIN[config.domain];
 requireThat(config.origin===WEATHER_CANONICAL_ORIGIN&&t?.environment_id===WEATHER_FACT_ENVIRONMENT&&t.account_id===WEATHER_FACT_ACCOUNT&&t.dataset_id===dataset&&/^[a-f0-9]{64}$/.test(t.semantic_profile_hash??''),'WEATHER_CONSUMER_TRUST_REQUIRED',503);
 const path=config.origin+'/datasets/'+dataset,view=JSON.parse((await get(path)).raw),r=view.receipt,p=r?.semantic_admission;
 requireThat(sameLocator(r,t)&&p?.contract_version===WEATHER_FACT_PROFILE_VERSION&&p.profile_hash===t.semantic_profile_hash&&p.action_allowed===false&&p.producer_independence===false&&p.source_policies_activated===false&&view.decision?.effect==='ABSTAIN'&&view.serving?.authority==='VERIFIED'&&view.serving.fallback===false,'WEATHER_CONSUMER_AUTHORITY_DENIED',503);
 requireThat(view.data?.domain===config.domain&&view.data.dataset_id===dataset&&view.data.sources?.length===1&&view.data.sources[0].source_kind==='OWNER_PUBLIC_RUNTIME'&&view.data.sources[0].source_pointer?.url===WEATHER_SOURCE_URLS[config.domain],'WEATHER_CONSUMER_DEPENDENCY_DENIED',503);
 const {raw,response}=await get(path+'/legacy-reference'),data=JSON.parse(raw);
 requireThat(response.headers.get('x-openpq-receipt-digest')===r.digest&&response.headers.get('x-openpq-source-digest')===p.input_hash&&await hash(raw)===p.input_hash&&await hash(data)===view.data.legacy_payload_digest,'WEATHER_CONSUMER_SNAPSHOT_CHANGED_OR_TAMPERED',503);
 const now=clock(),expiry=Date.parse(p.valid_until),source=Date.parse(p.source_version_time);
 requireThat(Number.isFinite(now)&&Number.isFinite(source)&&source<=now&&Number.isFinite(expiry)&&now<expiry&&response.headers.get('x-openpq-display-expires-at')===p.valid_until,'WEATHER_CONSUMER_EXPIRED',503);
 requireThat(response.headers.get('x-openpq-decision-eligibility')==='ABSTAIN'&&response.headers.get('x-openpq-source-snapshot')==='reference-only'&&response.headers.get('cache-control')==='no-store','WEATHER_CONSUMER_REFERENCE_CONTRACT_DENIED',503);
 return {raw,reader:'CANONICAL',source_digest:p.input_hash,receipt_digest:r.digest,revision:r.revision,source_version_time:p.source_version_time,display_expires_at:p.valid_until,canonical_transfer_proven:false};
}
