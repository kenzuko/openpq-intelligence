import {hash,requireThat} from './contracts.js';
import {domainLegacyView} from './domain-serving.js';
import {unpackDomainJson,unpackDomainText} from './domain-codec.js';
import {DIRECTORY_FACT_PROFILE_VERSION} from './domain-continuous-contract.js';
import {DIRECTORY_SOURCE_URLS} from './directory-execution-contract.js';
export async function directoryLegacyReference(generation,envelope,trust,name='index'){
 requireThat(generation.semantic_admission?.contract_version===DIRECTORY_FACT_PROFILE_VERSION&&Object.hasOwn(DIRECTORY_SOURCE_URLS,name),'DIRECTORY_REFERENCE_SCOPE_DENIED',409);
 await domainLegacyView(generation,envelope,trust);
 const projection=await unpackDomainJson(generation.payload.domain_snapshot.encoded_projection),proof=generation.semantic_admission;
 requireThat(projection.domain==='nearme'&&projection.sources.length===3&&projection.sources.every((p,i)=>p.source_kind==='OWNER_PUBLIC_RUNTIME'&&p.source_pointer?.url===Object.values(DIRECTORY_SOURCE_URLS)[i])&&await hash(projection.sources)===proof.source_set_hash&&projection.metadata.source_set_digest===proof.source_set_hash&&projection.metadata.publication_id===proof.publication_id,'DIRECTORY_REFERENCE_PUBLICATION_DENIED',503);
 const source=name==='index'?{pin:generation.semantic_bundle.pin,encoded_source:generation.semantic_bundle.encoded_source}:generation.semantic_bundle.companions?.[name];requireThat(source?.pin?.source_pointer?.url===DIRECTORY_SOURCE_URLS[name],'DIRECTORY_REFERENCE_SOURCE_DENIED',503);
 const raw=await unpackDomainText(source.encoded_source);requireThat(await hash(raw)===source.pin.payload_sha256&&projection.sources[['index','support','venues'].indexOf(name)].payload_sha256===source.pin.payload_sha256,'DIRECTORY_REFERENCE_DIGEST_DENIED',503);
 return {raw,source_digest:source.pin.payload_sha256,publication_id:proof.publication_id,source_set_hash:proof.source_set_hash};
}

export async function directoryPublicationReference(generation,envelope,trust){
 const index=await directoryLegacyReference(generation,envelope,trust,'index');
 const projection=await unpackDomainJson(generation.payload.domain_snapshot.encoded_projection),raws={index:index.raw};
 for(const [name,offset] of [['support',1],['venues',2]]){
  const source=generation.semantic_bundle.companions?.[name];requireThat(source?.pin?.source_pointer?.url===DIRECTORY_SOURCE_URLS[name],'DIRECTORY_REFERENCE_SOURCE_DENIED',503);
  raws[name]=await unpackDomainText(source.encoded_source);requireThat(await hash(raws[name])===source.pin.payload_sha256&&projection.sources[offset].payload_sha256===source.pin.payload_sha256,'DIRECTORY_REFERENCE_DIGEST_DENIED',503);
 }
 return {...index,raws};
}
