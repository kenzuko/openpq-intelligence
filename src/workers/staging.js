import {ContractError,hash,instant,requireThat,stable} from '../platform/contracts.js';
import {boundedText} from '../platform/bounded-text.js';
import {normalizeManualCano,stagingKey,stagingView,STAGING_PREFIX} from '../ingress/manual-cano.js';
const reply=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
export default {async fetch(request,env){
  try{
    requireThat(env.ENVIRONMENT_ID==='local-test'||env.ENVIRONMENT_ID==='isolated-test','STAGING_PRODUCTION_FORBIDDEN',503);
    requireThat(env.STAGING_BUCKET==='openpq-intelligence-canonical-isolated-test','STAGING_BUCKET_FORBIDDEN',503);
    const url=new URL(request.url);
    requireThat(['/stage','/read'].includes(url.pathname),'NOT_FOUND',404);
    const authorization=request.headers.get('authorization');
    requireThat(typeof env.STAGING_TOKEN_EXPIRES_AT==='string'&&Date.now()<instant(env.STAGING_TOKEN_EXPIRES_AT,'STAGING_TOKEN_EXPIRES')&&typeof env.STAGING_TOKEN_HASH==='string'&&/^[a-f0-9]{64}$/.test(env.STAGING_TOKEN_HASH)&&authorization?.startsWith('Bearer ')&&await hash(authorization.slice(7))===env.STAGING_TOKEN_HASH,'STAGING_AUTH_DENIED',401);
    requireThat(/^[a-f0-9]{40}$/.test(env.SOURCE_COMMIT_SHA),'STAGING_SOURCE_PIN_REQUIRED',503);
    if(url.pathname==='/stage'){
      requireThat(request.method==='POST','METHOD_DENIED',405);
      let text;try{text=await boundedText(request,16384);}catch{throw new ContractError('STAGING_REQUEST_INVALID_OR_TOO_LARGE',413);}
      const body=JSON.parse(text),record=await normalizeManualCano(body.raw,body.provenance);
      requireThat(record.source.commit_sha===env.SOURCE_COMMIT_SHA,'STAGING_SOURCE_COMMIT_MISMATCH',409);
      const key=stagingKey(record),bytes=stable(record);
      requireThat(key.startsWith(STAGING_PREFIX),'STAGING_KEY_FORBIDDEN',403);
      const created=Boolean(await env.STAGING.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'}}));
      const stored=await env.STAGING.get(key);requireThat(stored&&await stored.text()===bytes,'STAGING_IMMUTABLE_CONFLICT',409);
      return reply({key,record_digest:record.record_digest,stored_sha256:await hash(bytes),created,record,view:stagingView(record,Date.now())});
    }
    requireThat(request.method==='GET','METHOD_DENIED',405);
    const digest=url.searchParams.get('digest');requireThat(typeof digest==='string'&&/^[a-f0-9]{64}$/.test(digest),'STAGING_DIGEST_INVALID');
    const key=STAGING_PREFIX+env.SOURCE_COMMIT_SHA+'/'+digest+'.json';
    const object=await env.STAGING.get(key);requireThat(object,'STAGING_NOT_FOUND',404);
    const bytes=await boundedText(new Response(object.body,{headers:{'content-length':String(object.size)}}),16384),record=JSON.parse(bytes);
    const {record_digest,...content}=record;requireThat(record_digest===digest&&await hash(content)===digest,'STAGING_OBJECT_CORRUPT',503);
    return reply({key,record,stored_sha256:await hash(bytes),view:stagingView(record,Date.now())});
  }catch(error){return reply({error:error instanceof ContractError?error.code:'STAGING_INVALID'},error instanceof ContractError?error.status:422);}
}};
