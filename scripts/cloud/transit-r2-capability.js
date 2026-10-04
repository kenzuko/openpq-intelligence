import {createHash,createHmac} from 'node:crypto';
import {S3ReadonlyReader} from '../../src/platform/s3-reader.js';
import {requireThat} from '../../src/platform/contracts.js';
export const ACCOUNT='1a64a0a081ea758f72be8254030bdf11',BUCKET='openpq-intelligence-canonical';
const sha=x=>createHash('sha256').update(x).digest('hex'),h=(k,x)=>createHmac('sha256',k).update(x).digest();
export function mask(v){if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+v);}
export async function api(path,{method='GET',body,token=process.env.CLOUDFLARE_API_TOKEN?.trim()}={}){
 requireThat(path==='/user/tokens/verify'||path.startsWith('/accounts/'+ACCOUNT+'/'),'TRANSIT_API_ACCOUNT_DENIED');
 requireThat(method==='GET'||method==='POST'&&path==='/accounts/'+ACCOUNT+'/r2/temp-access-credentials'&&body.bucket===BUCKET&&body.permission==='object-read-only'&&body.ttlSeconds===172800,'TRANSIT_API_WRITE_DENIED');
 const r=await fetch('https://api.cloudflare.com/client/v4'+path,{method,redirect:'manual',signal:AbortSignal.timeout(15000),headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const d=await r.json();requireThat(r.ok&&d.success===true,'TRANSIT_API_HTTP_'+r.status,503);return d.result;
}
export async function parentCredential(){
 let v;try{v=await api('/user/tokens/verify');}catch{v=await api('/accounts/'+ACCOUNT+'/tokens/verify');}
 requireThat(v.status==='active'&&/^[a-f0-9]{32}$/.test(v.id),'TRANSIT_PARENT_TOKEN_REQUIRED');
 const c={access_key:v.id,secret:sha(process.env.CLOUDFLARE_API_TOKEN.trim())};mask(c.access_key);mask(c.secret);return c;
}
export async function probeObject(c,method,key,body=''){
 requireThat(['GET','PUT','DELETE'].includes(method)&&/^transfer-probes\/[a-z0-9-]+\.json$/.test(key),'TRANSIT_PROBE_OBJECT_DENIED');
 const host=ACCOUNT+'.r2.cloudflarestorage.com',path='/'+BUCKET+'/'+key,date=new Date().toISOString().replace(/[-:]|\.\d{3}/g,''),short=date.slice(0,8),payload=sha(body),scope=short+'/auto/s3/aws4_request';
 const headers={'x-amz-content-sha256':payload,'x-amz-date':date,...(c.session_token?{'x-amz-security-token':c.session_token}:{})},names=['host',...Object.keys(headers)].sort(),signed=names.join(';'),canonicalHeaders=names.map(n=>n+':'+(n==='host'?host:headers[n])+'\n').join('');
 const canonical=method+'\n'+path+'\n\n'+canonicalHeaders+'\n'+signed+'\n'+payload,signing=h(h(h(h('AWS4'+c.secret,short),'auto'),'s3'),'aws4_request'),signature=createHmac('sha256',signing).update('AWS4-HMAC-SHA256\n'+date+'\n'+scope+'\n'+sha(canonical)).digest('hex');
 const r=await fetch('https://'+host+path,{method,redirect:'manual',signal:AbortSignal.timeout(15000),headers:{...headers,authorization:'AWS4-HMAC-SHA256 Credential='+c.access_key+'/'+scope+', SignedHeaders='+signed+', Signature='+signature},...(method==='PUT'?{body}:{})});return {status:r.status,text:await r.text()};
}
export async function mintVerifiedReadCapability(proof){
 const parent=await parentCredential(),start=Date.now(),t=await api('/accounts/'+ACCOUNT+'/r2/temp-access-credentials',{method:'POST',body:{bucket:BUCKET,parentAccessKeyId:parent.access_key,permission:'object-read-only',ttlSeconds:172800}});
 requireThat(t.accessKeyId&&t.secretAccessKey&&t.sessionToken,'TRANSIT_TEMP_CREDENTIAL_INCOMPLETE');
 const c={endpoint:'https://'+ACCOUNT+'.r2.cloudflarestorage.com',bucket:BUCKET,access_key:t.accessKeyId,secret:t.secretAccessKey,session_token:t.sessionToken,expires_at:new Date(start+172800000).toISOString()};for(const v of [c.access_key,c.secret,c.session_token])mask(v);
 const key='transfer-probes/reader-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT+'.json',raw=JSON.stringify({kind:'readonly-transit-canary',run:process.env.GITHUB_RUN_ID});let made=false;
 try{
  const p=await probeObject(parent,'PUT',key,raw);requireThat(p.status===200,'TRANSIT_CANARY_PUT_FAILED');made=true;
  const value=await new S3ReadonlyReader(c).get(key);requireThat(value===raw,'TRANSIT_READ_POSITIVE_WITNESS_FAILED');
  const denied=[];for(const method of ['PUT','DELETE']){const r=await probeObject(c,method,key,method==='PUT'?'denied':'');denied.push({method,status:r.status});requireThat(r.status===403,'TRANSIT_READ_WRITE_CAPABILITY_LEAK');}
  proof.read_capability={bucket:BUCKET,permission:'object-read-only',lifetime_seconds:172800,expires_at:c.expires_at,get_status:200,get_digest:sha(value),denied};
 }finally{if(made){const r=await probeObject(parent,'DELETE',key);proof.read_canary_cleanup=r.status;requireThat(r.status===204,'TRANSIT_CANARY_CLEANUP_FAILED');}}
 return c;
}
