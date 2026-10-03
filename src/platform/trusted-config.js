import {requireThat,stable} from './contracts.js';
export const TRUST_BINDINGS=Array.from({length:6},(_,i)=>i?'TRUST_JSON_'+(i+1):'TRUST_JSON');
export const PROFILE_REGISTRY_BINDINGS=Array.from({length:9},(_,i)=>'SEMANTIC_REGISTRY_'+(i+1));
export const RECOVERED_REFERENCE_BINDINGS=Array.from({length:6},(_,i)=>'RECOVERED_REFERENCE_'+(i+1));
export function packConfig(value,names){
 const text=stable(value),chunks=names.map(()=>[]);let slot=0,bytes=0;
 requireThat(new TextEncoder().encode(text).length<=names.length*5000,'TRUSTED_CONFIG_TOO_LARGE');
 for(const c of text){const width=new TextEncoder().encode(c).length;if(bytes+width>5000){slot++;bytes=0;}requireThat(slot<names.length,'TRUSTED_CONFIG_TOO_LARGE');chunks[slot].push(c);bytes+=width;}
 return Object.fromEntries(names.map((name,i)=>[name,chunks[i].join('')]));
}
export function readConfig(env,names){
 const chunks=names.map(name=>env[name]??'');
 requireThat(chunks.every(s=>typeof s==='string'&&new TextEncoder().encode(s).length<=5000),'TRUSTED_CONFIG_BINDING_INVALID',503);
 const value=JSON.parse(chunks.join('')||'{}');
 requireThat(value&&typeof value==='object'&&!Array.isArray(value),'TRUSTED_CONFIG_MAP_INVALID',503);return value;
}
export const trustMap=env=>readConfig(env,TRUST_BINDINGS);
