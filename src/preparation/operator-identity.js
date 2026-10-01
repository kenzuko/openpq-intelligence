import {closedEnvironment,freeze,instant,object,requireThat,text} from './common.js';
function decode(value){requireThat(typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value),'JWT_ENCODING_INVALID');const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function json(value){return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(value)));}
// Pure verifier against caller-pinned public keys. Discovery/JWKS refresh and session storage are separate adapters.
export async function verifyOperatorJwt(compact,config,evaluation_time,csrf_hash){
 closedEnvironment(config.environment_id);requireThat(typeof compact==='string'&&compact.length<=8192,'JWT_SIZE_INVALID');const parts=compact.split('.');requireThat(parts.length===3,'JWT_FORMAT_INVALID');
 const header=json(parts[0]),claims=json(parts[1]);object(header,'JWT_HEADER');object(claims,'JWT_CLAIMS');requireThat(header.typ==='openpq-operator-session+jwt'&&header.alg==='ES256'&&!header.crit&&!header.jku&&!header.jwk&&!header.x5u,'JWT_ALGORITHM_OR_REMOTE_KEY_DENIED');text(header.kid,'JWT_KEY_ID');
 const jwk=config.public_keys?.[header.kid];requireThat(jwk&&jwk.kty==='EC'&&jwk.crv==='P-256'&&!jwk.d,'JWT_KEY_UNTRUSTED');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);requireThat(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])),'JWT_SIGNATURE_INVALID');
 requireThat(claims.iss===config.issuer&&claims.aud===config.audience,'JWT_ISSUER_OR_AUDIENCE_DENIED');text(claims.sub,'JWT_SUBJECT');
 const now=instant(evaluation_time,'JWT_TIME');for(const k of ['iat','exp','nbf'])requireThat(Number.isSafeInteger(claims[k])&&claims[k]>=0,'JWT_TIME_CLAIM_REQUIRED');
 requireThat(Number.isSafeInteger(config.session_max_ms)&&config.session_max_ms>0&&claims.nbf*1000<=now&&claims.iat*1000<=now&&now<claims.exp*1000&&claims.exp>claims.iat&&(claims.exp-claims.iat)*1000<=config.session_max_ms,'JWT_EXPIRED_OR_FUTURE');
 const actor=config.actors?.[claims.sub];requireThat(actor&&actor.revoked===false&&typeof actor.role==='string'&&Array.isArray(actor.datasets)&&actor.datasets.length>0,'JWT_ACTOR_NOT_AUTHORIZED');requireThat(/^[a-f0-9]{64}$/.test(csrf_hash),'JWT_CSRF_SESSION_BINDING_REQUIRED');
 return freeze({environment_id:config.environment_id,issuer:claims.iss,audience:claims.aud,signature_verified:true,revoked:false,actor_id:claims.sub,role:actor.role,datasets:[...actor.datasets],issued_at:new Date(claims.iat*1000).toISOString(),expires_at:new Date(claims.exp*1000).toISOString(),csrf_hash});
}
