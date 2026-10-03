import {hash,instant,locator,requireThat,sameLocator,stable} from './contracts.js';
import {attest,verifyAttestation} from './receipts.js';
import {packDomainJson,unpackDomainJson} from './domain-codec.js';
import {noSecrets} from '../preparation/common.js';

export const SNAPSHOT_VERSION='openpq-native-authority-snapshot-v1';
export const SNAPSHOT_TABLES=['prepared','commands','audit','outbox'];
export const SNAPSHOT_MAX_BYTES=8*1024*1024;
export const SNAPSHOT_MAX_ROWS=4096;
const bytes=x=>new TextEncoder().encode(stable(x)).length;
const fields=(x,names)=>requireThat(x&&stable(Object.keys(x).sort())===stable([...names].sort()),'SNAPSHOT_FIELDS_INVALID');
const coverage={native_control:true,prepared:true,commands:true,audit:true,outbox:true,external_artifacts:false,scheduler_state:false,deploy_code:false,storage_credentials:false};

function validateRows(state,tables,trust){
 requireThat(state&&sameLocator(state,trust)&&state.semantic_profile_hash===trust.semantic_profile_hash,'SNAPSHOT_CONTROL_SCOPE_INVALID');
 requireThat(Number.isSafeInteger(state.revision)&&state.revision>=0&&Number.isSafeInteger(state.control_revision)&&state.control_revision>=0&&Number.isSafeInteger(state.epoch)&&state.epoch>0,'SNAPSHOT_WATERMARK_INVALID');
 const ids=new Set(),revisions=new Set();let total=0;
 for(const table of SNAPSHOT_TABLES){
  requireThat(Array.isArray(tables[table]),'SNAPSHOT_TABLE_REQUIRED');total+=tables[table].length;
  let previous;
  for(const row of tables[table]){
   const key=table==='outbox'?row.revision:row.id;
   requireThat(previous===undefined||key>previous,'SNAPSHOT_ROW_ORDER_INVALID');previous=key;
   if(table==='commands'){
    fields(row,['id','digest','result']);requireThat(typeof key==='string'&&/^[a-f0-9]{64}$/.test(row.digest),'SNAPSHOT_COMMAND_INVALID');noSecrets(JSON.parse(row.result));
   }else{
    fields(row,table==='outbox'?['revision','body','exported']:['id','body']);const value=JSON.parse(row.body);noSecrets(value);
    if(table==='prepared'){requireThat(/^[a-f0-9]{64}$/.test(key)&&value.digest===key&&sameLocator(value,trust),'SNAPSHOT_PREPARED_INVALID');ids.add(key);}
    if(table==='audit')requireThat(Number.isSafeInteger(key)&&key>0&&typeof value.action==='string'&&typeof value.actor==='string','SNAPSHOT_AUDIT_INVALID');
    if(table==='outbox'){requireThat(Number.isSafeInteger(key)&&key>0&&key<=state.revision&&value.revision===key&&sameLocator(value,trust)&&[0,1].includes(row.exported),'SNAPSHOT_OUTBOX_INVALID');revisions.add(key);}
   }
  }
 }
 requireThat(total<=SNAPSHOT_MAX_ROWS,'SNAPSHOT_TOO_LARGE',413);
 requireThat((state.revision===0&&state.active===null)||(state.active&&state.active.revision===state.revision&&sameLocator(state.active,trust)&&ids.has(state.active.digest)&&revisions.has(state.revision)),'SNAPSHOT_ACTIVE_RECORDS_MISSING');
 noSecrets(state);
}

export async function sealAuthoritySnapshot({authority,control,tables,captured_at},signer){
 locator(authority);instant(captured_at,'SNAPSHOT_TIME');fields(tables,SNAPSHOT_TABLES);validateRows(control,tables,authority);
 requireThat(bytes({control,tables})<=SNAPSHOT_MAX_BYTES,'SNAPSHOT_TOO_LARGE',413);
 const pub=authority.receipt_keys?.[signer.key_id];requireThat(pub&&!pub.d&&pub.x===signer.private_jwk?.x&&pub.y===signer.private_jwk?.y,'SNAPSHOT_SIGNER_SCOPE_INVALID');
 const pages=[],page_refs=[];
 for(const table of SNAPSHOT_TABLES){
  let rows=[],size=2,index=0;
  const flush=async()=>{if(!rows.length)return;const codec=await packDomainJson(rows);const ref={table,index:index++,row_count:rows.length,codec_hash:await hash(codec)};pages.push({...ref,codec});page_refs.push(ref);rows=[];size=2;};
  for(const row of tables[table]){const n=bytes(row)+1;requireThat(n<=400000,'SNAPSHOT_ROW_TOO_LARGE',413);if(size+n>400000)await flush();rows.push(row);size+=n;}await flush();
 }
 requireThat(pages.length<=128&&bytes(pages)<=SNAPSHOT_MAX_BYTES,'SNAPSHOT_TOO_LARGE',413);
 const manifest={...authority,contract_version:SNAPSHOT_VERSION,snapshot_consistency:'ATOMIC_NATIVE_SQLITE_TABLES',captured_at,watermark:{revision:control.revision,control_revision:control.control_revision,epoch:control.epoch},control,table_counts:Object.fromEntries(SNAPSHOT_TABLES.map(t=>[t,tables[t].length])),page_refs,coverage};
 return {envelope:await attest(manifest,signer.key_id,signer.private_jwk),pages};
}

export async function verifyAuthoritySnapshot(snapshot,trustedAuthority){
 fields(snapshot,['envelope','pages']);requireThat(trustedAuthority,'SNAPSHOT_INDEPENDENT_TRUST_REQUIRED');
 requireThat(bytes(snapshot.envelope)<=262144,'SNAPSHOT_MANIFEST_TOO_LARGE',413);
 requireThat(Array.isArray(snapshot.pages)&&snapshot.pages.length<=128&&bytes(snapshot.pages)<=SNAPSHOT_MAX_BYTES,'SNAPSHOT_TOO_LARGE',413);
 const manifest=await verifyAttestation(snapshot.envelope,trustedAuthority);
 requireThat(manifest.contract_version===SNAPSHOT_VERSION&&manifest.snapshot_consistency==='ATOMIC_NATIVE_SQLITE_TABLES'&&stable(manifest.coverage)===stable(coverage),'SNAPSHOT_CONTRACT_INVALID');
 requireThat(stable(Object.fromEntries(Object.keys(trustedAuthority).map(k=>[k,manifest[k]])))===stable(trustedAuthority),'SNAPSHOT_TRUST_CONFIG_MISMATCH');
 instant(manifest.captured_at,'SNAPSHOT_TIME');fields(manifest.table_counts,SNAPSHOT_TABLES);
 requireThat(Array.isArray(manifest.page_refs)&&manifest.page_refs.length===snapshot.pages.length,'SNAPSHOT_PAGE_COUNT_INVALID');
 const tables=Object.fromEntries(SNAPSHOT_TABLES.map(t=>[t,[]]));let decoded=0;
 for(let i=0;i<snapshot.pages.length;i++){
  const page=snapshot.pages[i],ref=manifest.page_refs[i];fields(page,['table','index','row_count','codec_hash','codec']);fields(ref,['table','index','row_count','codec_hash']);
  requireThat(SNAPSHOT_TABLES.includes(page.table),'SNAPSHOT_TABLE_INVALID');
  const {codec,...metadata}=page;requireThat(stable(metadata)===stable(ref)&&await hash(codec)===ref.codec_hash,'SNAPSHOT_PAGE_HASH_INVALID');
  requireThat(Number.isSafeInteger(ref.index)&&ref.index===manifest.page_refs.slice(0,i).filter(x=>x.table===ref.table).length,'SNAPSHOT_PAGE_ORDER_INVALID');
  decoded+=codec.uncompressed_bytes;requireThat(decoded<=SNAPSHOT_MAX_BYTES,'SNAPSHOT_TOO_LARGE',413);
  const rows=await unpackDomainJson(codec);requireThat(Array.isArray(rows)&&rows.length===ref.row_count,'SNAPSHOT_PAGE_ROWS_INVALID');tables[ref.table].push(...rows);
 }
 requireThat(SNAPSHOT_TABLES.every(t=>tables[t].length===manifest.table_counts[t]),'SNAPSHOT_TABLE_COUNT_INVALID');validateRows(manifest.control,tables,trustedAuthority);
 requireThat(stable(manifest.watermark)===stable({revision:manifest.control.revision,control_revision:manifest.control.control_revision,epoch:manifest.control.epoch}),'SNAPSHOT_WATERMARK_INVALID');
 for(const row of tables.prepared){const p=JSON.parse(row.body),{key,digest,prepared_until,...generation}=p;requireThat(await hash(generation)===digest&&key===`generations/${trustedAuthority.authority_instance_id}/${trustedAuthority.recovery_generation}/${digest}.json`,'SNAPSHOT_GENERATION_HASH_INVALID');}
 const audit=tables.audit.map(x=>JSON.parse(x.body));
 for(const row of tables.outbox){const receipt=JSON.parse(row.body),prepared=tables.prepared.find(x=>x.id===receipt.digest),command=tables.commands.find(x=>x.id===receipt.command_id);requireThat(prepared&&JSON.parse(prepared.body).key===receipt.key,'SNAPSHOT_OUTBOX_GENERATION_MISSING');requireThat(command?.digest===receipt.digest&&stable(JSON.parse(command.result))===stable(receipt),'SNAPSHOT_COMMIT_COMMAND_MISSING');requireThat(audit.some(x=>x.action==='COMMIT'&&stable(x.receipt)===stable(receipt)),'SNAPSHOT_COMMIT_AUDIT_MISSING');}
 if(manifest.control.control_revision>0){const latest=audit.find(x=>x.state?.control_revision===manifest.control.control_revision),keys=['owner','epoch','control_revision','frozen','next_transition_at','artifacts'];requireThat(latest&&keys.every(k=>stable(latest.state[k])===stable(manifest.control[k])),'SNAPSHOT_CONTROL_AUDIT_MISMATCH');}
 if(manifest.control.active){const receipt=tables.outbox.find(x=>x.revision===manifest.control.revision);requireThat(stable(JSON.parse(receipt.body))===stable(manifest.control.active),'SNAPSHOT_ACTIVE_RECEIPT_MISMATCH');}
 return {manifest,tables,verification:{status:'SIGNED_NATIVE_AUTHORITY_TABLES_PASS',control_authenticity_verified:true,audit_authenticity_verified:true,commands_authenticity_verified:true,outbox_authenticity_verified:true,external_artifacts_included:false,full_system_restore_proven:false,offsite_proven:false,resume_writer:false}};
}
