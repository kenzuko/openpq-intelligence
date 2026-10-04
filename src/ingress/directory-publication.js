import {hash,requireThat} from '../platform/contracts.js';
import {exact,decodeOwnedSource} from './domain-source-common.js';
import {DIRECTORY_SOURCE_URLS} from '../platform/directory-execution-contract.js';
import {DIRECTORY_FACT_BUNDLE_VERSION} from '../platform/domain-continuous-contract.js';
import {unpackDomainText} from '../platform/domain-codec.js';
import {normalizeNearMeDomain} from './nearme-domain.js';
import {rehearseNearMeConsumer} from './nearme-consumer.js';
// Admit the existing three-file CMS publication as one fact, never live opening truth.
export async function projectDirectoryPublication(bundle,at){
 exact(bundle,['contract_version','pin','encoded_source','companions','publication_id'],'DIRECTORY_BUNDLE');requireThat(bundle.contract_version===DIRECTORY_FACT_BUNDLE_VERSION&&/^[a-f0-9]{40}$/.test(bundle.publication_id??''),'DIRECTORY_PUBLICATION_ID_REQUIRED');
 exact(bundle.companions,['support','venues'],'DIRECTORY_COMPANION_SET');
 const inputs={};
 for(const name of ['index','support','venues']){
  const item=name==='index'?{pin:bundle.pin,encoded_source:bundle.encoded_source}:bundle.companions[name];
  exact(item,['pin','encoded_source'],'DIRECTORY_SOURCE_ENTRY');
  requireThat(item.pin?.source_kind==='OWNER_PUBLIC_RUNTIME'&&item.pin.source_pointer?.url===DIRECTORY_SOURCE_URLS[name]&&item.encoded_source.sha256===item.pin.payload_sha256,'DIRECTORY_SOURCE_PIN_DENIED');
  inputs[name]={pin:item.pin,raw_utf8:await unpackDomainText(item.encoded_source)};await decodeOwnedSource('nearme',inputs[name]);
 }
 const normalized=await normalizeNearMeDomain(inputs.index,at),closure=await rehearseNearMeConsumer(inputs);
 const {legacy_payload,projection_digest,...base}=normalized;
 const sources=['index','support','venues'].map(name=>inputs[name].pin);
 const body={...base,sources,metadata:{...base.metadata,publication_id:bundle.publication_id,source_set_digest:await hash(sources),companion_digests:{support:inputs.support.pin.payload_sha256,venues:inputs.venues.pin.payload_sha256},consumer_rows_digest:closure.rows_digest,companion_schema_validated:true,companion_live_authority:false}};
 return {...body,projection_digest:await hash(body)};
}
