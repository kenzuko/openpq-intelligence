import {hash,instant,object,requireThat,stable,text} from '../platform/contracts.js';
export {hash,instant,object,requireThat,stable,text};
export const PREPARATION_VERSION='openpq-preparation-v1';
export function closedEnvironment(value){requireThat(['local-test','isolated-test'].includes(value),'PREPARATION_ENVIRONMENT_CLOSED');return value;}
export function integer(value,label,min=0){requireThat(Number.isSafeInteger(value)&&value>=min,label+'_REQUIRED');return value;}
export function exactKeys(value,keys,label){object(value,label);requireThat(Object.keys(value).every(k=>keys.includes(k)),label+'_UNKNOWN_FIELD');}
export function digest(value,label='DIGEST'){requireThat(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),label+'_INVALID');return value;}
export function clone(value){return JSON.parse(stable(value));}
export function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
// Exportable configuration and reports must never contain transport credentials.
export function noSecrets(value){
 if(Array.isArray(value))value.forEach(noSecrets);
 else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
  requireThat(!/^(?:token|secret|password|authorization|cookie|access_key|secret_access_key|private_jwk|private_key|credentials)$/i.test(key),'PREPARATION_SECRET_FORBIDDEN');noSecrets(item);
 }
}
export function report(status,rest={}){return {contract_version:PREPARATION_VERSION,...rest,status,publication_admitted:false,production_enabled:false};}
