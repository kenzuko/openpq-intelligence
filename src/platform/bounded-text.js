import {requireThat} from './contracts.js';
export async function boundedText(response,limit=262144) {
  const declared=Number(response.headers.get('content-length') || 0);requireThat(declared<=limit,'CANONICAL_TOO_LARGE',503);
  if(!response.body)return '';
  const reader=response.body.getReader(),chunks=[];let total=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();requireThat(false,'CANONICAL_TOO_LARGE',503);}chunks.push(value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
