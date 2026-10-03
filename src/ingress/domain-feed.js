import {hash,requireThat,ContractError} from '../platform/contracts.js';
import {boundedText} from '../platform/bounded-text.js';
import {gitBlobSha} from './cano-real-shadow.js';
import {buildContinuousCandidate,validateContinuousProfile} from '../platform/domain-continuous-admission.js';
import {ISOLATED_ACCOUNT_ID} from '../platform/domain-bridge-admission.js';

// Each secret holds one immutable authority/profile and one dataset-scoped actor.
// There is no bootstrap, control, signing, bucket or production capability here.
export async function ownedReference(producer,fetcher=fetch){
 const get=async url=>{const r=await fetcher(url,{headers:{accept:'application/json','user-agent':'OpenPQ-isolated-reference-ingestion'},redirect:'manual',signal:AbortSignal.timeout(15000)});const kind=new URL(url).hostname==='api.github.com'?'GITHUB_API':new URL(url).hostname==='raw.githubusercontent.com'?'GITHUB_RAW':'OWNED_RUNTIME';requireThat(r.ok,'INGEST_SOURCE_HTTP_'+r.status+'_'+kind,503);return r;};
 if(producer.source_kind==='OWNER_PUBLIC_RUNTIME'){
  const raw_utf8=await boundedText(await get(producer.url),1500000);
  return {raw_utf8,pin:{source_kind:producer.source_kind,source_pointer:{url:producer.url},payload_sha256:await hash(raw_utf8),git_blob_sha:null}};
 }
 // One GitHub API request per repository per tick. Read the exact immutable
 // commit path over TLS, then compute the Git blob identity from those bytes.
 const commit=(await (await get('https://api.github.com/repos/'+producer.repository+'/commits/main')).json()).sha;
 requireThat(/^[a-f0-9]{40}$/.test(commit),'INGEST_COMMIT_PIN_REQUIRED');
 const raw_utf8=await boundedText(await get('https://raw.githubusercontent.com/'+producer.repository+'/'+commit+'/'+producer.path),1500000);
 return {raw_utf8,pin:{source_kind:producer.source_kind,source_pointer:{repository:producer.repository,commit_sha:commit,path:producer.path},payload_sha256:await hash(raw_utf8),git_blob_sha:await gitBlobSha(new TextEncoder().encode(raw_utf8))}};
}
export async function ingestDataset(entry,core,fetcher=fetch){
 const {authority,profile,actor_id,token}=entry;
 await validateContinuousProfile(profile,authority);
 requireThat(profile.operator_principal_ids.includes(actor_id)&&typeof token==='string'&&token.length>=32,'INGEST_ACTOR_DENIED',403);
 const call=async(path,body)=>{
  const r=await core.fetch('https://core.internal/datasets/'+authority.dataset_id+'/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=await r.json();requireThat(r.ok,typeof value.error==='string'&&/^[A-Z0-9_]{1,100}$/.test(value.error)?value.error:'INGEST_CORE_DENIED',r.status);return value;
 };
 const {state}=await call('read');requireThat(state&&state.dataset_id===authority.dataset_id&&!state.frozen,'INGEST_STATE_DENIED',409);
 // Finish any committed export even if the source fetch fails on this tick.
 if(state.revision>0)await call('export',{});
 const source=await ownedReference(profile.producer,fetcher),attempt=crypto.randomUUID();
 const c=await buildContinuousCandidate(profile,authority,{...source,operator_principal_id:actor_id,evaluation_time:new Date().toISOString(),candidate_id:'scheduled-'+attempt,expected_revision:state.revision,expected_control_revision:state.control_revision,logical_slot:(state.active?.logical_slot??-1)+1});
 const prepared=await call('prepare',c);
 const command={...authority,command_id:'ingest-'+attempt,digest:prepared.digest,expires_at:new Date(Math.min(Date.now()+60000,Date.parse(c.valid_to))).toISOString()};
 let committed;
 // Retry only the identical command after a lost response. Never create a
 // second candidate from uncertain state or retry a semantic denial.
 for(let n=0;n<3;n++){
  try{committed=await call('commit',command);break;}catch(e){if(e instanceof ContractError||n===2)throw e;}
 }
 requireThat(committed.receipt.digest===prepared.digest,'INGEST_RECEIPT_MISMATCH',503);
 await call('export',{});
 return {dataset_id:authority.dataset_id,status:'PUBLISHED_REFERENCE',revision:committed.receipt.revision,receipt_digest:prepared.digest,source_digest:source.pin.payload_sha256,display_expires_at:c.valid_to,operational_action_allowed:false};
}
