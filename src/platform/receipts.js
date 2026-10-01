import { stable, sameLocator, requireThat } from './contracts.js';

const bytes=value=>new TextEncoder().encode(stable(value));
const encode=array=>btoa(String.fromCharCode(...new Uint8Array(array)));
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
export async function attest(receipt,keyId,privateJwk) {
  const key=await crypto.subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,bytes(receipt));
  return {receipt,key_id:keyId,signature:encode(signature)};
}
export async function verifyAttestation(envelope,trust) {
  requireThat(envelope && sameLocator(envelope.receipt,trust),'CHECKPOINT_LOCATOR_DENIED',409);
  const registered=trust.receipt_keys?.[envelope.key_id];
  requireThat(registered && !registered.d,'CHECKPOINT_KEY_DENIED',409);
  const key=await crypto.subtle.importKey('jwk',registered,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  requireThat(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(envelope.signature),bytes(envelope.receipt)),'CHECKPOINT_SIGNATURE_INVALID',409);
  return envelope.receipt;
}
export async function exportCheckpoint(bucket,envelope) {
  const r=envelope.receipt, prefix=`checkpoints/${r.authority_instance_id}/${r.recovery_generation}`;
  const immutable=`${prefix}/receipts/${r.revision}.json`, data=stable(envelope);
  // Export is a projection of an already committed receipt, never a source of authority.
  const put=await bucket.put(immutable,data,{onlyIf:{etagDoesNotMatch:'*'}});
  if(!put) {const existing=await bucket.get(immutable);requireThat(existing && stable(JSON.parse(await existing.text()).receipt)===stable(r),'RECEIPT_EXPORT_CONFLICT',409);}
  const latest=`${prefix}/latest.json`;
  for(let attempt=0;attempt<5;attempt++) {
    const old=await bucket.get(latest);
    if(old) {
      const body=JSON.parse(await old.text());
      requireThat(sameLocator(body.receipt,r),'PROJECTION_LOCATOR_CONFLICT',409);
      if(body.receipt.revision>=r.revision) return {exported:true,revision:body.receipt.revision};
    }
    const result=await bucket.put(latest,data,{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:'*'}});
    if(result) return {exported:true,revision:r.revision};
  }
  return {exported:false,reason:'CAS_RETRY_BUDGET'};
}
