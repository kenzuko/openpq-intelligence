import {trustMap} from '../platform/trusted-config.js';
import {CONTINUOUS_PROFILE_VERSION} from '../platform/domain-continuous-contract.js';
import {domainSnapshotServing,domainLegacyView} from '../platform/domain-serving.js';
import {unpackDomainText} from '../platform/domain-codec.js';
import { ContractError, hash, locator, requireThat, sameLocator } from '../platform/contracts.js';
import { servingView } from '../platform/serving.js';
import { verifyAttestation } from '../platform/receipts.js';
import { S3ReadonlyReader } from '../platform/s3-reader.js';
import { boundedText } from '../platform/bounded-text.js';

export default {
  async fetch(request,env) {
    try {
      requireThat(['local-test','isolated-test'].includes(env.ENVIRONMENT_ID),'PRODUCTION_GATE_CLOSED',503);
      requireThat(request.method==='GET','READ_ONLY',405);
      const u=new URL(request.url), parts=u.pathname.split('/').filter(Boolean);
      if(parts[0]==='health')return Response.json({service:'runtime',status:'UP',production_enabled:false},{headers:{'cache-control':'no-store'}});
      const legacyReference=parts.length===3&&parts[2]==='legacy-reference';
      requireThat((parts.length===2||legacyReference) && parts[0]==='datasets','NOT_FOUND',404);
      const trust=locator(trustMap(env)[parts[1]]);
      requireThat(trust.environment_id===env.ENVIRONMENT_ID,'RUNTIME_ENVIRONMENT_MISMATCH',409);
      const read=async key=>{
        if(env.ENVIRONMENT_ID==='local-test' && env.TEST_READER) {
          const r=await env.TEST_READER.fetch('https://reader/'+key,{headers:{authorization:'Bearer '+env.READER_TOKEN}});
          if(r.status===404)return null;requireThat(r.ok,'BLOB_UNAVAILABLE',503);return boundedText(r);
        }
        const config=JSON.parse(env.S3_READONLY_CONFIG || '{}');
        requireThat(config.access_key && config.secret && config.bucket && config.endpoint,'READONLY_CREDENTIAL_REQUIRED',503);
        return new S3ReadonlyReader(config).get(key);
      };
      let receipt=null, validation=null, fallback=false;
      const controlObservation={read_status:null,read_error:null,validation_status:null};
      try {
        const r=await env.CORE_READ.fetch(`https://core/datasets/${trust.dataset_id}/read`,{headers:{authorization:'Bearer '+(env.CONTROL_READ_TOKENS_JSON?JSON.parse(env.CONTROL_READ_TOKENS_JSON)[trust.dataset_id]:env.CONTROL_READ_TOKEN)}});
        controlObservation.read_status=r.status;
        if(!r.ok){try{const failure=await r.json();if(typeof failure.error==='string'&&/^[A-Z0-9_]{1,100}$/.test(failure.error))controlObservation.read_error=failure.error;}catch{}}
        requireThat(r.ok,'CONTROL_READ_UNAVAILABLE',503);receipt=(await r.json()).state?.active;
        requireThat(receipt && sameLocator(receipt,trust),'RECEIPT_UNAVAILABLE',503);
        const v=await env.CORE_READ.fetch(`https://core/datasets/${trust.dataset_id}/validate`,{method:'POST',headers:{authorization:'Bearer '+(env.CONTROL_READ_TOKENS_JSON?JSON.parse(env.CONTROL_READ_TOKENS_JSON)[trust.dataset_id]:env.CONTROL_READ_TOKEN),'content-type':'application/json'},body:JSON.stringify({revision:receipt.revision,digest:receipt.digest})});
        controlObservation.validation_status=v.status;
        if(v.ok)validation=(await v.json()).validation;
      } catch {fallback=true;}
      if(!receipt) {
        const checkpoint=await read(`checkpoints/${trust.authority_instance_id}/${trust.recovery_generation}/latest.json`);
        requireThat(checkpoint,'NO_TRUSTED_CHECKPOINT',503);receipt=await verifyAttestation(JSON.parse(checkpoint),trust);
      }
      requireThat(sameLocator(receipt,trust),'RECEIPT_LOCATOR_DENIED',409);
      const raw=await read(receipt.key);requireThat(raw,'GENERATION_UNAVAILABLE',503);
      requireThat(await hash(raw)===receipt.digest,'GENERATION_HASH_INVALID',503);
      const generation=JSON.parse(raw), now=Date.now();
      const view=servingView(generation,receipt,trust,validation,now);
      // The display interval is bounded by the activated generation, even during outage.
      requireThat(now<Date.parse(generation.valid_to),'DISPLAY_EXPIRED',503);
      const domain=['openpq-owned-domain-bridge-local-v1','openpq-owned-domain-bridge-isolated-v1',CONTINUOUS_PROFILE_VERSION].includes(generation.semantic_admission?.contract_version)?await domainSnapshotServing(generation,now):null;
      if(legacyReference){
        requireThat(domain&&generation.decision?.effect==='ABSTAIN','LEGACY_REFERENCE_SCOPE_DENIED',409);
        const signed=await read(`checkpoints/${trust.authority_instance_id}/${trust.recovery_generation}/receipts/${receipt.revision}.json`);
        requireThat(signed,'LEGACY_REFERENCE_SIGNED_RECEIPT_REQUIRED',503);
        await domainLegacyView(generation,JSON.parse(signed),trust);
        return new Response(await unpackDomainText(generation.semantic_bundle.encoded_source),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-openpq-source-snapshot':'reference-only','x-openpq-decision-eligibility':'ABSTAIN','x-openpq-source-digest':generation.semantic_admission.input_hash,'x-openpq-receipt-digest':receipt.digest,'x-openpq-display-expires-at':generation.valid_to}});
      }
      return Response.json({contract:'openpq-runtime-v1',receipt,data:domain?domain.projection:generation.payload,decision:generation.decision || null,serving:{...view,...(domain?{freshness:'SOURCE_SNAPSHOT_REFERENCE',domain_fields:domain.serving}:{}),fallback,control_observation:controlObservation}},{headers:{'cache-control':'no-store'}});
    } catch(e) {return Response.json({error:e instanceof ContractError?e.code:'RUNTIME_UNAVAILABLE'},{status:e instanceof ContractError?e.status:503,headers:{'cache-control':'no-store'}});}
  }
};
