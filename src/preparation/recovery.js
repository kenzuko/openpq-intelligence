import {locator,sameLocator} from '../platform/contracts.js';
import {PREPARATION_VERSION,closedEnvironment,clone,digest,exactKeys,freeze,hash,instant,noSecrets,object,report,requireThat,stable,text} from './common.js';
const kinds=['CONTROL','AUDIT','GENERATION','RECEIPT','REGISTRY','EVIDENCE','SCHEDULER','DEPLOY'];
function key(value){text(value,'BACKUP_KEY');requireThat(!value.startsWith('/')&&!value.split('/').some(p=>['..','.',''].includes(p))&&!value.includes('\\'),'BACKUP_PATH_INVALID');return value;}
export async function buildBackup({environment_id,authority,created_at,watermark,records,required_keys}){
 closedEnvironment(environment_id);locator(authority);requireThat(authority.environment_id===environment_id,'BACKUP_LOCATOR_ENVIRONMENT_MISMATCH');instant(created_at,'BACKUP_CREATED');object(watermark,'BACKUP_WATERMARK');
 requireThat(Number.isSafeInteger(watermark.revision)&&watermark.revision>=0&&Number.isSafeInteger(watermark.control_revision)&&watermark.control_revision>=0,'BACKUP_WATERMARK_INVALID');
 requireThat(Array.isArray(records)&&records.length>0&&records.length<=1000,'BACKUP_RECORDS_REQUIRED');requireThat(Array.isArray(required_keys)&&required_keys.length>0&&new Set(required_keys).size===required_keys.length,'BACKUP_REQUIRED_KEYS_INVALID');
 const seen=new Set(),entries=[];
 for(const input of records){exactKeys(input,['key','kind','content'],'BACKUP_RECORD');key(input.key);requireThat(!seen.has(input.key),'BACKUP_DUPLICATE_KEY');seen.add(input.key);requireThat(kinds.includes(input.kind),'BACKUP_KIND_INVALID');object(input.content,'BACKUP_CONTENT');noSecrets(input.content);const content=clone(input.content);const bytes=new TextEncoder().encode(stable(content)).length;requireThat(bytes<=262144,'BACKUP_RECORD_TOO_LARGE');entries.push({key:input.key,kind:input.kind,content,sha256:await hash(content),bytes});}
 for(const needed of required_keys)requireThat(seen.has(key(needed)),'BACKUP_REQUIRED_RECORD_MISSING');
 // This export format cannot claim an online atomic snapshot or RPO by itself.
 const manifest={contract_version:PREPARATION_VERSION,environment_id,authority:clone(authority),created_at,watermark:clone(watermark),required_keys:[...required_keys].sort(),entries:entries.sort((a,b)=>a.key.localeCompare(b.key)),snapshot_consistency:'REFERENCED_EXPORT_NOT_ATOMIC_PITR',secrets_included:false};noSecrets(manifest);
 return freeze({...manifest,bundle_hash:await hash(manifest)});
}
export async function verifyBackup(bundle){
 exactKeys(bundle,['contract_version','environment_id','authority','created_at','watermark','required_keys','entries','snapshot_consistency','secrets_included','bundle_hash'],'BACKUP');
 requireThat(bundle.contract_version===PREPARATION_VERSION&&bundle.secrets_included===false&&bundle.snapshot_consistency==='REFERENCED_EXPORT_NOT_ATOMIC_PITR','BACKUP_CONTRACT_INVALID');
 const {bundle_hash,...manifest}=bundle;digest(bundle_hash,'BACKUP_HASH');requireThat(await hash(manifest)===bundle_hash,'BACKUP_MANIFEST_MISMATCH');
 requireThat(Array.isArray(bundle.entries),'BACKUP_ENTRIES_REQUIRED');
 const rebuilt=await buildBackup({...bundle,records:bundle.entries.map(e=>({key:e.key,kind:e.kind,content:e.content}))});requireThat(rebuilt.bundle_hash===bundle_hash,'BACKUP_ENTRY_HASH_OR_ORDER_MISMATCH');
 const controls=bundle.entries.filter(e=>e.kind==='CONTROL');requireThat(controls.length===1,'BACKUP_CONTROL_REQUIRED');const control=controls[0].content;
 requireThat(sameLocator(control,bundle.authority)&&control.revision===bundle.watermark.revision&&control.control_revision===bundle.watermark.control_revision,'BACKUP_CONTROL_WATERMARK_MISMATCH');
 if(control.active){requireThat(control.active.revision===control.revision&&sameLocator(control.active,bundle.authority),'BACKUP_ACTIVE_LOCATOR_MISMATCH');const generation=bundle.entries.find(e=>e.key===control.active.key&&e.kind==='GENERATION');requireThat(generation&&generation.sha256===control.active.digest,'BACKUP_ACTIVE_BLOB_MISSING_OR_CORRUPT');}
 const present=new Set(bundle.entries.map(e=>e.kind));for(const kind of kinds.filter(k=>k!=='EVIDENCE'))requireThat(present.has(kind),'BACKUP_'+kind+'_MISSING');
 return report('LOCAL_BACKUP_INTEGRITY_PASS',{bundle_hash,record_count:bundle.entries.length,created_at:bundle.created_at,watermark:bundle.watermark,offsite_proven:false,pitr_proven:false,receipt_authenticity_verified:false});
}
export async function restorePlan(bundle,newAuthority,{old_epoch_high_watermark=null,deny_observations=[],evaluation_time}){
 const checked=await verifyBackup(bundle);locator(newAuthority);closedEnvironment(newAuthority.environment_id);requireThat(newAuthority.environment_id===bundle.environment_id,'RESTORE_ENVIRONMENT_MISMATCH');
 requireThat(newAuthority.recovery_generation!==bundle.authority.recovery_generation,'RESTORE_NEW_GENERATION_REQUIRED');
 const moved=['namespace_id','native_id','authority_instance_id','object_name','account_id'].some(k=>newAuthority[k]!==bundle.authority[k]);
 if(moved)requireThat(newAuthority.authority_locator_version!==bundle.authority.authority_locator_version&&newAuthority.locator_artifact_hash!==bundle.authority.locator_artifact_hash,'RESTORE_EXPLICIT_LOCATOR_MIGRATION_REQUIRED');
 requireThat(newAuthority.receipt_keys&&Object.keys(newAuthority.receipt_keys).length>0,'RESTORE_NEW_SIGNING_TRUST_REQUIRED');
 const oldKeys=Object.values(bundle.authority.receipt_keys||{});requireThat(Object.values(newAuthority.receipt_keys).every(k=>!oldKeys.some(o=>stable(o)===stable(k))),'RESTORE_OLD_SIGNING_KEY_REUSED');
 const control=bundle.entries.find(e=>e.kind==='CONTROL').content;
 if(old_epoch_high_watermark!==null)requireThat(Number.isSafeInteger(old_epoch_high_watermark)&&old_epoch_high_watermark>=control.epoch&&old_epoch_high_watermark<Number.MAX_SAFE_INTEGER-1,'RESTORE_EPOCH_HIGH_WATERMARK_INVALID');
 const now=instant(evaluation_time,'RESTORE_EVALUATION');requireThat(now>=instant(bundle.created_at,'BACKUP_CREATED'),'RESTORE_BACKUP_IN_FUTURE');
 const fenced=['OLD_COMMAND','OLD_STORAGE_WRITE'].map(role=>({role,observed:deny_observations.some(o=>o.role===role&&o.authority_hash===bundle.authority.locator_artifact_hash&&o.status==='AUTH_DENIED'&&[401,403].includes(o.http_status)&&o.positive_witness_status===200&&/^[a-f0-9]{64}$/.test(o.credential_fingerprint)&&instant(o.observed_at,'DENY_TIME')<=now&&instant(o.observed_at,'DENY_TIME')>=instant(o.revoked_at,'REVOKE_TIME'))}));
 const expiredOverrides=(control.overrides||[]).filter(o=>instant(o.expires_at,'OVERRIDE_EXPIRES')<=now).map(o=>o.id);
 return report('RESTORE_REHEARSAL_PLAN',{backup_integrity:checked,new_authority:clone(newAuthority),old_authority_hash:bundle.authority.locator_artifact_hash,fencing:fenced,blocked:fenced.filter(x=>!x.observed).map(x=>x.role+'_DENIAL_NOT_OBSERVED'),new_epoch:old_epoch_high_watermark===null?null:old_epoch_high_watermark+1,history_discontinuity:old_epoch_high_watermark===null,expired_overrides_not_revived:expiredOverrides,active_receipt_imported:false,credentials_restored:false,resume_writer:false,trust_switch_executed:false,required_followup:['Reconcile audit/outbox/checkpoint and evidence retention','Authenticated owner approval of new locator/signing trust','Actual isolated restore and Runtime/current-source tests','Measure RPO/RTO and offsite restore; do not treat local integrity as disaster proof']});
}
export function retentionPlan(records,policies,scope,evaluation_time){
 const now=instant(evaluation_time,'RETENTION_TIME');requireThat(Array.isArray(records),'RETENTION_RECORDS_REQUIRED');
 let p;try{p=policies.require('P11',['retention_ms','gc_grace_ms'],scope,evaluation_time);}catch{return report('RETENTION_POLICY_BLOCKED',{delete_enabled:false,candidates:[]});}
 requireThat(Number.isSafeInteger(p.retention_ms)&&p.retention_ms>0&&Number.isSafeInteger(p.gc_grace_ms)&&p.gc_grace_ms>=0,'RETENTION_POLICY_INVALID');
 const seen=new Set(),candidates=[];for(const r of records){key(r.key);requireThat(!seen.has(r.key),'RETENTION_DUPLICATE_KEY');seen.add(r.key);requireThat(Array.isArray(r.pins)&&r.pins.every(x=>typeof x==='string'),'RETENTION_PINS_REQUIRED');const created=instant(r.created_at,'RECORD_CREATED');requireThat(created<=now,'RETENTION_FUTURE_RECORD');if(!r.pins.length&&now-created>=p.retention_ms+p.gc_grace_ms)candidates.push(r.key);}
 return report('RETENTION_DRY_RUN',{delete_enabled:false,candidates:candidates.sort(),note:'Complete authoritative pin inventory and cloud race proof required before any deletion'});
}
