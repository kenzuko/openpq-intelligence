import {directoryLegacyReference,directoryPublicationReference} from '../platform/directory-serving.js';
import {trustMap,readConfig,RECOVERED_REFERENCE_BINDINGS} from '../platform/trusted-config.js';
import {recoveredReferenceConfig,recoveredReferenceView} from '../platform/recovered-reference.js';
import {SNAPSHOT_MAX_BYTES} from '../platform/authority-snapshot.js';
import {CONTINUOUS_PROFILE_VERSION,TRANSIT_FACT_PROFILE_VERSION,WEATHER_FACT_PROFILE_VERSION,DIRECTORY_FACT_PROFILE_VERSION} from '../platform/domain-continuous-contract.js';
import {executionEnvironment,executionDataset} from '../platform/transit-execution-scope.js';
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
      executionEnvironment(env);
      requireThat(request.method==='GET','READ_ONLY',405);
      const u=new URL(request.url), parts=u.pathname.split('/').filter(Boolean);
      if(parts[0]==='health')return Response.json({service:'runtime',status:'UP',production_enabled:false},{headers:{'cache-control':'no-store'}});
      const legacyReference=(parts.length===3||parts.length===4&&['support','venues'].includes(parts[3]))&&parts[2]==='legacy-reference';
      const signedPublication=parts.length===3&&parts[2]==='signed-publication';
      const recoveredReference=parts.length===3&&parts[2]==='recovered-reference';
      requireThat((parts.length===2||legacyReference||recoveredReference||signedPublication) && parts[0]==='datasets','NOT_FOUND',404);
      const trust=locator(trustMap(env)[parts[1]]);
      executionDataset(env,trust);
      requireThat(trust.environment_id===env.ENVIRONMENT_ID,'RUNTIME_ENVIRONMENT_MISMATCH',409);
      const read=async (key,max_bytes=262144)=>{
        if(env.ENVIRONMENT_ID==='local-test' && env.TEST_READER) {
          const r=await env.TEST_READER.fetch('https://reader/'+key,{headers:{authorization:'Bearer '+env.READER_TOKEN}});
          if(r.status===404)return null;requireThat(r.ok,'BLOB_UNAVAILABLE',503);return boundedText(r,max_bytes);
        }
        const config=JSON.parse(env.S3_READONLY_CONFIG || '{}');
        requireThat(config.access_key && config.secret && config.bucket && config.endpoint,'READONLY_CREDENTIAL_REQUIRED',503);
        return new S3ReadonlyReader(config).get(key,{max_bytes});
      };
      if(recoveredReference){
        const config=await recoveredReferenceConfig(readConfig(env,RECOVERED_REFERENCE_BINDINGS)[trust.dataset_id],trust);
        const snapshot=await read(config.target_snapshot_key,SNAPSHOT_MAX_BYTES+262144);
        requireThat(snapshot,'RECOVERED_REFERENCE_SNAPSHOT_UNAVAILABLE',503);
        const bundle=await read(config.plan.domain_archive.key,2*SNAPSHOT_MAX_BYTES);
        requireThat(bundle,'RECOVERED_REFERENCE_ARCHIVE_UNAVAILABLE',503);
        return Response.json(await recoveredReferenceView(JSON.parse(snapshot),JSON.parse(bundle),config,trust,new Date().toISOString()),{headers:{'cache-control':'no-store','x-openpq-source-snapshot':'recovered-archive-only','x-openpq-decision-eligibility':'ABSTAIN'}});
      }
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
      const domain=['openpq-owned-domain-bridge-local-v1','openpq-owned-domain-bridge-isolated-v1',CONTINUOUS_PROFILE_VERSION,TRANSIT_FACT_PROFILE_VERSION,WEATHER_FACT_PROFILE_VERSION,DIRECTORY_FACT_PROFILE_VERSION].includes(generation.semantic_admission?.contract_version)?await domainSnapshotServing(generation,now):null;
      if(signedPublication){
        requireThat(generation.semantic_admission?.contract_version===DIRECTORY_FACT_PROFILE_VERSION&&view.authority==='VERIFIED'&&!fallback,'DIRECTORY_SIGNED_PUBLICATION_SCOPE_DENIED',409);
        const signed=await read('checkpoints/'+trust.authority_instance_id+'/'+trust.recovery_generation+'/receipts/'+receipt.revision+'.json');requireThat(signed,'DIRECTORY_SIGNED_RECEIPT_REQUIRED',503);
        const envelope=JSON.parse(signed),publication=await directoryPublicationReference(generation,envelope,trust);
        return Response.json({contract:'openpq-directory-signed-publication-v1',generation,envelope,serving:{...view,fallback}},{headers:{'cache-control':'no-store','x-openpq-receipt-digest':receipt.digest,'x-openpq-source-set-hash':publication.source_set_hash,'x-openpq-publication-id':publication.publication_id,'x-openpq-display-expires-at':generation.valid_to}});
      }
      if(legacyReference){
        requireThat(domain&&generation.decision?.effect==='ABSTAIN','LEGACY_REFERENCE_SCOPE_DENIED',409);
        const signed=await read(`checkpoints/${trust.authority_instance_id}/${trust.recovery_generation}/receipts/${receipt.revision}.json`);
        requireThat(signed,'LEGACY_REFERENCE_SIGNED_RECEIPT_REQUIRED',503);
        if(generation.semantic_admission?.contract_version===DIRECTORY_FACT_PROFILE_VERSION){
          const result=await directoryLegacyReference(generation,JSON.parse(signed),trust,parts[3]||'index');
          return new Response(result.raw,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-openpq-source-snapshot':'reference-only','x-openpq-decision-eligibility':'ABSTAIN','x-openpq-source-digest':result.source_digest,'x-openpq-source-set-hash':result.source_set_hash,'x-openpq-publication-id':result.publication_id,'x-openpq-receipt-digest':receipt.digest,'x-openpq-display-expires-at':generation.valid_to}});
        }
        requireThat(parts.length===3,'LEGACY_REFERENCE_SCOPE_DENIED',409);
        await domainLegacyView(generation,JSON.parse(signed),trust);
        return new Response(await unpackDomainText(generation.semantic_bundle.encoded_source),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-openpq-source-snapshot':'reference-only','x-openpq-decision-eligibility':'ABSTAIN','x-openpq-source-digest':generation.semantic_admission.input_hash,'x-openpq-receipt-digest':receipt.digest,'x-openpq-display-expires-at':generation.valid_to}});
      }
      return Response.json({contract:'openpq-runtime-v1',receipt,data:domain?domain.projection:generation.payload,decision:generation.decision || null,serving:{...view,...(domain?{freshness:'SOURCE_SNAPSHOT_REFERENCE',domain_fields:domain.serving}:{}),fallback,control_observation:controlObservation}},{headers:{'cache-control':'no-store'}});
    } catch(e) {return Response.json({error:e instanceof ContractError?e.code:'RUNTIME_UNAVAILABLE'},{status:e instanceof ContractError?e.status:503,headers:{'cache-control':'no-store'}});}
  }
};
