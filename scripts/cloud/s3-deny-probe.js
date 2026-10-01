import {requireThat} from '../../src/platform/contracts.js';
import {BUCKET} from './preflight.js';
const encoder=new TextEncoder();
const hex=b=>Buffer.from(b).toString('hex');
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
const hmac=async(key,text)=>{const k=await crypto.subtle.importKey('raw',typeof key==='string'?encoder.encode(key):key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return crypto.subtle.sign('HMAC',k,encoder.encode(text));};

// Fault/permission proof only. Runtime never imports a signing path for writes.
export async function denyProbe(config,accountId,method,key,fetcher=fetch){
  requireThat(/^[a-f0-9]{32}$/.test(accountId)&&config.bucket===BUCKET&&config.endpoint===`https://${accountId}.r2.cloudflarestorage.com`,'DENY_PROBE_SCOPE_FORBIDDEN');
  requireThat(['PUT','DELETE'].includes(method)&&key.startsWith('proof-deny/')&&!key.includes('..')&&!key.includes('\\'),'DENY_PROBE_KEY_FORBIDDEN');
  const body=method==='PUT'?'synthetic permission probe':'';
  const date=new Date().toISOString().replace(/[-:]|\.\d{3}/g,''),short=date.slice(0,8),payload=await sha(body),host=new URL(config.endpoint).host;
  const path='/'+[config.bucket,...key.split('/')].map(s=>encodeURIComponent(s).replace(/[!'()*]/g,v=>'%'+v.charCodeAt(0).toString(16).toUpperCase())).join('/');
  const scope=`${short}/auto/s3/aws4_request`,signed='host;x-amz-content-sha256;x-amz-date';
  const canonical=`${method}\n${path}\n\nhost:${host}\nx-amz-content-sha256:${payload}\nx-amz-date:${date}\n\n${signed}\n${payload}`;
  const signing=await hmac(await hmac(await hmac(await hmac('AWS4'+config.secret,short),'auto'),'s3'),'aws4_request');
  const signature=hex(await hmac(signing,`AWS4-HMAC-SHA256\n${date}\n${scope}\n${await sha(canonical)}`));
  const response=await fetcher(config.endpoint+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{'x-amz-date':date,'x-amz-content-sha256':payload,authorization:`AWS4-HMAC-SHA256 Credential=${config.access_key}/${scope}, SignedHeaders=${signed}, Signature=${signature}`},...(method==='PUT'?{body}:{})});
  await response.body?.cancel();
  requireThat(response.status===403,'READ_CREDENTIAL_WRITE_NOT_DENIED',403);
  return {method,status:response.status,key};
}
