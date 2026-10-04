import {hash,requireThat} from '../platform/contracts.js';
import {boundedText} from '../platform/bounded-text.js';
import {DIRECTORY_SOURCE_URLS} from '../platform/directory-execution-contract.js';
export async function ownedDirectoryPublication(fetcher=fetch){
 const entries=await Promise.all(Object.entries(DIRECTORY_SOURCE_URLS).map(async([name,url])=>{
  const r=await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{accept:'application/json'}});requireThat(r.ok,'DIRECTORY_SOURCE_HTTP_'+r.status,503);requireThat(r.headers.get('content-type')?.split(';')[0]==='application/json','DIRECTORY_SOURCE_CONTENT_TYPE_DENIED',503);
  const publication_id=r.headers.get('x-openpq-publication-id');requireThat(/^[a-f0-9]{40}$/.test(publication_id??''),'DIRECTORY_SOURCE_PUBLICATION_ID_REQUIRED',503);
  const raw_utf8=await boundedText(r,1500000);
  return [name,{raw_utf8,pin:{source_kind:'OWNER_PUBLIC_RUNTIME',source_pointer:{url},payload_sha256:await hash(raw_utf8),git_blob_sha:null},publication_id}];
 }));
 const values=Object.fromEntries(entries),ids=new Set(entries.map(([,v])=>v.publication_id));requireThat(ids.size===1,'DIRECTORY_MIXED_PUBLICATION_DENIED',409);
 return {pin:values.index.pin,raw_utf8:values.index.raw_utf8,publication_id:values.index.publication_id,companions:Object.fromEntries(['support','venues'].map(name=>[name,{pin:values[name].pin,raw_utf8:values[name].raw_utf8}]))};
}
