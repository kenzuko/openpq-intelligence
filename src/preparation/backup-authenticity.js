import {locator,sameLocator} from '../platform/contracts.js';
import {verifyAttestation} from '../platform/receipts.js';
import {verifyBackup} from './recovery.js';
import {report,requireThat,stable} from './common.js';
// Signed publication receipts prove their bound generations, not unsigned control/audit state or offsite durability.
export async function verifyBackupPublications(bundle,trustedAuthority){
 requireThat(trustedAuthority,'BACKUP_INDEPENDENT_TRUST_REQUIRED');locator(trustedAuthority);requireThat(sameLocator(bundle.authority,trustedAuthority)&&stable(bundle.authority)===stable(trustedAuthority),'BACKUP_TRUST_CONFIG_MISMATCH');
 const integrity=await verifyBackup(bundle),control=bundle.entries.find(e=>e.kind==='CONTROL').content;
 const envelopes=bundle.entries.filter(e=>e.kind==='RECEIPT').map(e=>e.content);requireThat(envelopes.length>0,'BACKUP_SIGNED_RECEIPTS_REQUIRED');
 const revisions=new Set(),verified=[];for(const envelope of envelopes){const receipt=await verifyAttestation(envelope,trustedAuthority);requireThat(Number.isSafeInteger(receipt.revision)&&receipt.revision>0&&receipt.revision<=bundle.watermark.revision&&!revisions.has(receipt.revision),'BACKUP_RECEIPT_REVISION_INVALID');revisions.add(receipt.revision);if(trustedAuthority.semantic_profile_hash)requireThat(receipt.semantic_admission?.profile_hash===trustedAuthority.semantic_profile_hash,'BACKUP_SEMANTIC_PROFILE_MISMATCH');const generation=bundle.entries.find(e=>e.kind==='GENERATION'&&e.key===receipt.key);requireThat(generation&&generation.sha256===receipt.digest,'BACKUP_SIGNED_GENERATION_MISSING');verified.push(receipt);}
 if(control.active)requireThat(verified.some(r=>stable(r)===stable(control.active)),'BACKUP_ACTIVE_RECEIPT_NOT_ATTESTED');
 return report('LOCAL_BACKUP_PUBLICATION_SIGNATURES_PASS',{integrity,verified_publication_revisions:verified.map(r=>r.revision).sort((a,b)=>a-b),publication_receipt_authenticity_verified:true,control_authenticity_verified:false,audit_authenticity_verified:false,offsite_proven:false,resume_writer:false});
}
