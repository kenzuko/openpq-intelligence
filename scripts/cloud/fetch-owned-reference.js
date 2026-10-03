import {hash,requireThat} from '../../src/platform/contracts.js';
import {gitBlobSha} from '../../src/ingress/cano-real-shadow.js';
import {boundedText} from '../../src/platform/bounded-text.js';
export async function fetchOwnedReference(producer){
 const get=async(url,headers={})=>{const r=await fetch(url,{headers:{accept:'application/json',...headers},redirect:'error',signal:AbortSignal.timeout(20000)});requireThat(r.ok,'CONTINUOUS_SOURCE_FETCH_FAILED',503);return r;};
 if(producer.source_kind==='OWNER_PUBLIC_RUNTIME'){
  const raw_utf8=await boundedText(await get(producer.url),1500000);
  return {raw_utf8,pin:{source_kind:producer.source_kind,source_pointer:{url:producer.url},payload_sha256:await hash(raw_utf8),git_blob_sha:null}};
 }
 const api='https://api.github.com/repos/'+producer.repository,headers=process.env.GITHUB_TOKEN?{authorization:'Bearer '+process.env.GITHUB_TOKEN}:{};
 const commit=(await (await get(api+'/commits/main',headers)).json()).sha;requireThat(/^[a-f0-9]{40}$/.test(commit),'CONTINUOUS_COMMIT_PIN_REQUIRED');
 const info=await (await get(api+'/contents/'+producer.path+'?ref='+commit,headers)).json();
 const raw_utf8=await boundedText(await get('https://raw.githubusercontent.com/'+producer.repository+'/'+commit+'/'+producer.path),1500000);
 const git_blob_sha=await gitBlobSha(new TextEncoder().encode(raw_utf8));requireThat(info.sha===git_blob_sha,'CONTINUOUS_REPOSITORY_BLOB_MISMATCH');
 return {raw_utf8,pin:{source_kind:producer.source_kind,source_pointer:{repository:producer.repository,commit_sha:commit,path:producer.path},payload_sha256:await hash(raw_utf8),git_blob_sha}};
}
