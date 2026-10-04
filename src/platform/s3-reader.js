import { requireThat } from './contracts.js';
import { boundedText } from './bounded-text.js';
// GET-only adapter. Production still requires a bucket-scoped Object Read only key.
const enc=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function digest(s){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));}
async function hmac(key,s){const k=await crypto.subtle.importKey('raw',typeof key==='string'?enc.encode(key):key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return crypto.subtle.sign('HMAC',k,enc.encode(s));}
export class S3ReadonlyReader {
  constructor(config,fetcher=(url,options)=>fetch(url,options),clock=()=>Date.now()){this.config=config;this.fetcher=fetcher;this.clock=clock;}
  async get(key,{max_bytes=262144}={}) {
    requireThat(typeof key==='string' && !key.split('/').some(p=>p==='..'||p==='.') && !key.includes('\\'),'S3_KEY_INVALID');
    requireThat(Number.isSafeInteger(max_bytes)&&max_bytes>0&&max_bytes<=16*1024*1024&&(max_bytes<=262144||/^recovery\/(snapshots|domains)\/[a-zA-Z0-9_-]{1,128}\.json$/.test(key)),'S3_ARCHIVE_LIMIT_INVALID');
    const c=this.config, root=new URL(c.endpoint);
    requireThat(root.protocol==='https:' && !root.username && !root.password && root.pathname==='/' && !root.search,'S3_ENDPOINT_INVALID');
    requireThat(/^[a-z0-9.-]+$/.test(c.bucket),'S3_BUCKET_INVALID');
    const path='/'+[c.bucket,...key.split('/')].map(s=>encodeURIComponent(s).replace(/[!'()*]/g,v=>'%'+v.charCodeAt(0).toString(16).toUpperCase())).join('/');
    const date=new Date(this.clock()).toISOString().replace(/[-:]|\.\d{3}/g,''), short=date.slice(0,8), payload=await digest('');
    if(c.session_token!==undefined)requireThat(typeof c.session_token==='string'&&c.session_token.length>0&&c.session_token.length<=4000&&!/[\r\n]/.test(c.session_token)&&Number.isFinite(Date.parse(c.expires_at))&&this.clock()<Date.parse(c.expires_at),'S3_SESSION_EXPIRED_OR_INVALID',503);
    const session=c.session_token?{'x-amz-security-token':c.session_token}:{};
    const canonicalHeaders=`host:${root.host}\nx-amz-content-sha256:${payload}\nx-amz-date:${date}\n`+(c.session_token?`x-amz-security-token:${c.session_token}\n`:'');
    const signed='host;x-amz-content-sha256;x-amz-date'+(c.session_token?';x-amz-security-token':''), scope=`${short}/auto/s3/aws4_request`;
    const canonical=`GET\n${path}\n\n${canonicalHeaders}\n${signed}\n${payload}`;
    const signing=await hmac(await hmac(await hmac(await hmac('AWS4'+c.secret,short),'auto'),'s3'),'aws4_request');
    const signature=hex(await hmac(signing,`AWS4-HMAC-SHA256\n${date}\n${scope}\n${await digest(canonical)}`));
    const response=await this.fetcher(root.origin+path,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'x-amz-date':date,'x-amz-content-sha256':payload,...session,authorization:`AWS4-HMAC-SHA256 Credential=${c.access_key}/${scope}, SignedHeaders=${signed}, Signature=${signature}`}});
    if(response.status===404) return null;
    requireThat(response.ok,'S3_READ_UNAVAILABLE',503);
    return boundedText(response,max_bytes);
  }
}
