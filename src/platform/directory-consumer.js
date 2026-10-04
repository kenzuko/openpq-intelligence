import {hash,requireThat,sameLocator} from './contracts.js';
import {boundedText} from './bounded-text.js';
import {verifyAttestation} from './receipts.js';
import {directoryPublicationReference} from './directory-serving.js';
import {DIRECTORY_FACT_PROFILE_VERSION} from './domain-continuous-contract.js';
import {DIRECTORY_FACT_ENVIRONMENT,DIRECTORY_FACT_ACCOUNT,DIRECTORY_FACT_DATASET,DIRECTORY_SOURCE_URLS} from './directory-execution-contract.js';
export const DIRECTORY_CANONICAL_ORIGIN='https://openpq-intelligence-directory-runtime.kenzuko.workers.dev';
export async function readDirectoryConsumer(config,{fetcher=(url,o)=>fetch(url,o),clock=()=>Date.now()}={}){
 requireThat(config&&['LEGACY','CANONICAL'].includes(config.mode),'DIRECTORY_READER_MODE_REQUIRED',503);
 const get=async url=>{const r=await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});requireThat(r.ok,'DIRECTORY_READER_HTTP_'+r.status,503);requireThat(r.headers.get('content-type')?.split(';')[0]==='application/json','DIRECTORY_READER_CONTENT_TYPE_DENIED',503);return {response:r,raw:await boundedText(r,1500000)};};
 if(config.mode==='LEGACY'){
  const entries=await Promise.all(Object.entries(DIRECTORY_SOURCE_URLS).map(async([name,url])=>{const {response,raw}=await get(url);JSON.parse(raw);const publication_id=response.headers.get('x-openpq-publication-id');requireThat(/^[a-f0-9]{40}$/.test(publication_id??''),'DIRECTORY_LEGACY_PUBLICATION_REQUIRED',503);return {name,url,raw,publication_id,digest:await hash(raw)};}));
  requireThat(new Set(entries.map(x=>x.publication_id)).size===1,'DIRECTORY_LEGACY_MIXED_PUBLICATION',503);
  const pins=entries.map(x=>({source_kind:'OWNER_PUBLIC_RUNTIME',source_pointer:{url:x.url},payload_sha256:x.digest,git_blob_sha:null}));
  return {reader:'LEGACY',raws:Object.fromEntries(entries.map(x=>[x.name,x.raw])),publication_id:entries[0].publication_id,source_set_hash:await hash(pins),canonical_transfer_proven:false};
 }
 const t=config.trust;requireThat(config.origin===DIRECTORY_CANONICAL_ORIGIN&&t?.environment_id===DIRECTORY_FACT_ENVIRONMENT&&t.account_id===DIRECTORY_FACT_ACCOUNT&&t.dataset_id===DIRECTORY_FACT_DATASET&&/^[a-f0-9]{64}$/.test(t.semantic_profile_hash??''),'DIRECTORY_CONSUMER_TRUST_REQUIRED',503);
 const {response,raw}=await get(config.origin+'/datasets/'+t.dataset_id+'/signed-publication'),bundle=JSON.parse(raw);
 requireThat(bundle.contract==='openpq-directory-signed-publication-v1'&&bundle.serving?.authority==='VERIFIED'&&bundle.serving.fallback===false,'DIRECTORY_CONSUMER_AUTHORITY_DENIED',503);
 const g=bundle.generation,receipt=await verifyAttestation(bundle.envelope,t),p=g?.semantic_admission;
 requireThat(sameLocator(g,t)&&await hash(g)===receipt.digest&&p?.contract_version===DIRECTORY_FACT_PROFILE_VERSION&&p.profile_hash===t.semantic_profile_hash&&p.action_allowed===false&&p.producer_independence===false&&p.source_policies_activated===false&&g.decision?.effect==='ABSTAIN','DIRECTORY_CONSUMER_SIGNED_SNAPSHOT_DENIED',503);
 const publication=await directoryPublicationReference(g,bundle.envelope,t),now=clock();
 requireThat(Number.isFinite(now)&&Date.parse(p.source_version_time)<=now&&now<Date.parse(g.valid_to)&&response.headers.get('x-openpq-display-expires-at')===g.valid_to,'DIRECTORY_CONSUMER_EXPIRED',503);
 requireThat(response.headers.get('x-openpq-receipt-digest')===receipt.digest&&response.headers.get('x-openpq-source-set-hash')===publication.source_set_hash&&response.headers.get('x-openpq-publication-id')===publication.publication_id&&response.headers.get('cache-control')==='no-store','DIRECTORY_CONSUMER_PUBLICATION_CHANGED_OR_TAMPERED',503);
 return {...publication,reader:'CANONICAL',receipt_digest:receipt.digest,revision:receipt.revision,source_version_time:p.source_version_time,display_expires_at:g.valid_to,canonical_transfer_proven:false};
}
