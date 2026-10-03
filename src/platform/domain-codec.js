import {hash,requireThat,stable} from './contracts.js';

export const DOMAIN_CODEC_MAX_BYTES=1500000;
export const DOMAIN_CODEC_MAX_COMPRESSED=120000;
const encoder=new TextEncoder();
async function boundedStream(stream,max){
 const reader=stream.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;requireThat(size<=max,'DOMAIN_CODEC_LIMIT',413);chunks.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.byteLength;}return out;
}
function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);}
export async function packDomainText(text){
 requireThat(typeof text==='string','DOMAIN_CODEC_TEXT_REQUIRED');const bytes=encoder.encode(text);requireThat(bytes.length>0&&bytes.length<=DOMAIN_CODEC_MAX_BYTES,'DOMAIN_CODEC_LIMIT',413);
 const compressed=await boundedStream(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),DOMAIN_CODEC_MAX_COMPRESSED);
 return {encoding:'GZIP_BASE64',base64:base64(compressed),uncompressed_bytes:bytes.length,sha256:await hash(text)};
}
export const packDomainJson=value=>packDomainText(stable(value));
export async function unpackDomainText(value){
 requireThat(value&&typeof value==='object'&&!Array.isArray(value)&&stable(Object.keys(value).sort())===stable(['base64','encoding','sha256','uncompressed_bytes']),'DOMAIN_CODEC_FIELDS_INVALID');
 requireThat(value.encoding==='GZIP_BASE64'&&typeof value.base64==='string'&&value.base64.length>0&&value.base64.length<=DOMAIN_CODEC_MAX_COMPRESSED*4/3&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64),'DOMAIN_CODEC_ENCODING_INVALID');
 requireThat(typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256)&&Number.isSafeInteger(value.uncompressed_bytes)&&value.uncompressed_bytes>0&&value.uncompressed_bytes<=DOMAIN_CODEC_MAX_BYTES,'DOMAIN_CODEC_DECLARATION_INVALID');
 const bytes=Uint8Array.from(atob(value.base64),x=>x.charCodeAt(0));requireThat(base64(bytes)===value.base64,'DOMAIN_CODEC_NONCANONICAL_BASE64');
 const decoded=await boundedStream(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),value.uncompressed_bytes);
 requireThat(decoded.length===value.uncompressed_bytes,'DOMAIN_CODEC_SIZE_MISMATCH');const text=new TextDecoder('utf-8',{fatal:true}).decode(decoded);
 requireThat(await hash(text)===value.sha256,'DOMAIN_CODEC_HASH_MISMATCH');return text;
}
export async function unpackDomainJson(value){return JSON.parse(await unpackDomainText(value));}
