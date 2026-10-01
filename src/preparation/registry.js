import {sourceRegistry,scope,ref} from '../contracts/semantic.js';
import {PREPARATION_VERSION,closedEnvironment,clone,digest,exactKeys,freeze,hash,noSecrets,object,requireThat,stable,text} from './common.js';
export const ARTIFACT_KINDS=['SOURCE','MAPPING','ADAPTER','RESOLVER','RULE','CONFIG','POLICY','SCHEMA'];
export async function makeArtifact(kind,id,payload,environment='local-test',version='1'){
 const item={contract_version:PREPARATION_VERSION,artifact_id:id,version,environment_id:environment,kind,payload};return {...item,hash:await hash(item)};
}
export async function preparationRegistry(inputs,environment){
 closedEnvironment(environment);requireThat(Array.isArray(inputs)&&inputs.length>0&&inputs.length<=256,'REGISTRY_REQUIRED');const map=new Map();
 for(const input of inputs){
  const a=clone(input);exactKeys(a,['contract_version','artifact_id','version','environment_id','kind','payload','hash'],'ARTIFACT');noSecrets(a);ref(a);
  requireThat(a.contract_version===PREPARATION_VERSION&&a.environment_id===environment,'REGISTRY_ENVIRONMENT_OR_VERSION_MISMATCH');requireThat(ARTIFACT_KINDS.includes(a.kind),'REGISTRY_KIND_UNKNOWN');object(a.payload,'ARTIFACT_PAYLOAD');
  const {hash:expected,...content}=a;requireThat(await hash(content)===expected,'REGISTRY_CONTENT_MISMATCH');
  const key=a.artifact_id+'\0'+a.version;requireThat(!map.has(key),'REGISTRY_VERSION_CONFLICT');map.set(key,freeze(a));
 }
 const lookup=(r,kind)=>{ref(r);const a=map.get(r.artifact_id+'\0'+r.version);requireThat(a&&a.hash===r.hash,'REGISTRY_REF_UNAVAILABLE');requireThat(a.kind===kind,'REGISTRY_KIND_MISMATCH');return a;};
 // Validate every declared edge, including unselected artifacts; dangling registry references are errors.
 for(const a of map.values()){
  if(a.kind==='SOURCE'){
   sourceRegistry(a.payload);lookup(a.payload.mapping_ref,'MAPPING');
   for(const r of Object.values(a.payload.policy_refs))lookup(r,'POLICY');
  }
  if(a.payload.dependencies!==undefined){requireThat(Array.isArray(a.payload.dependencies),'ARTIFACT_DEPENDENCIES_INVALID');for(const edge of a.payload.dependencies){requireThat(ARTIFACT_KINDS.includes(edge.kind),'DEPENDENCY_KIND_INVALID');lookup(edge,edge.kind);}}
 }
 const visiting=new Set(),visited=new Set();
 const visit=a=>{const key=a.artifact_id+'\0'+a.version;requireThat(!visiting.has(key),'REGISTRY_DEPENDENCY_CYCLE');if(visited.has(key))return;visiting.add(key);const edges=[...(a.payload.dependencies||[])];if(a.kind==='SOURCE')edges.push({...a.payload.mapping_ref,kind:'MAPPING'},...Object.values(a.payload.policy_refs).map(r=>({...r,kind:'POLICY'})));for(const edge of edges)visit(lookup(edge,edge.kind));visiting.delete(key);visited.add(key);};
 for(const a of map.values())visit(a);
 const snapshot=[...map.values()].sort((a,b)=>(a.artifact_id+'\0'+a.version).localeCompare(b.artifact_id+'\0'+b.version));
 return Object.freeze({environment_id:environment,snapshot:freeze(snapshot),hash:await hash(snapshot),lookup});
}
export function graph(registry,refs,targetScope){
 scope(targetScope);object(refs,'GRAPH_REFS');requireThat(Object.keys(refs).length===8,'GRAPH_EXACT_KINDS_REQUIRED');
 const nodes=Object.fromEntries(ARTIFACT_KINDS.map(kind=>[kind,registry.lookup(refs[kind.toLowerCase()],kind)]));
 const source=nodes.SOURCE.payload,mapping=nodes.MAPPING.payload,adapter=nodes.ADAPTER.payload;
 requireThat(source.domain===targetScope.domain,'SOURCE_DOMAIN_MISMATCH');requireThat(source.mapping_ref.hash===nodes.MAPPING.hash,'SOURCE_MAPPING_MISMATCH');
 requireThat(adapter.source_id===source.source_id&&adapter.source_namespace===source.source_namespace,'ADAPTER_SOURCE_MISMATCH');
 requireThat(adapter.schema_ref?.hash===nodes.SCHEMA.hash&&registry.lookup(adapter.schema_ref,'SCHEMA')===nodes.SCHEMA,'ADAPTER_SCHEMA_MISMATCH');
 requireThat(Array.isArray(mapping.scopes)&&mapping.scopes.some(s=>stable(s)===stable(targetScope)),'MAPPING_SCOPE_UNAVAILABLE');
 for(const s of mapping.scopes)scope(s);
 requireThat(nodes.CONFIG.payload.dataset_id&&nodes.CONFIG.payload.source_id===source.source_id,'CONFIG_SOURCE_REQUIRED');text(nodes.CONFIG.payload.dataset_id,'DATASET_ID');
 digest(nodes.POLICY.hash);return freeze(nodes);
}
