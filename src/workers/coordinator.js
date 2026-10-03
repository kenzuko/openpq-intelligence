import {trustMap} from '../platform/trusted-config.js';
import {continuousContract} from '../platform/domain-continuous-contract.js';
import {executionEnvironment,executionDataset} from '../platform/transit-execution-scope.js';
import { DurableObject } from 'cloudflare:workers';
import { ContractError, candidate, hash, instant, locator, requireThat, revision, sameLocator, stable } from '../platform/contracts.js';
import { authorize, principal } from '../platform/auth.js';
import {validateSemanticAdmission,validateSemanticReplayActor} from '../platform/semantic-admission.js';
import { attest, exportCheckpoint } from '../platform/receipts.js';
import {isExpiredForecastRetirement,isFutureForecastExtension} from '../platform/forecast-retirement.js';
import {sealAuthoritySnapshot,SNAPSHOT_TABLES,SNAPSHOT_MAX_BYTES,SNAPSHOT_MAX_ROWS} from '../platform/authority-snapshot.js';
import {frozenRecoveryState,recoveredDomainReadback} from '../platform/recovery-bootstrap.js';

function json(value,status=200) {return Response.json(value,{status,headers:{'cache-control':'no-store'}});}
export class DatasetCoordinator extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env); this.ctx=ctx; this.env=env; this.incarnation_id=crypto.randomUUID();
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS control (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS prepared (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, digest TEXT NOT NULL, result TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS outbox (revision INTEGER PRIMARY KEY, body TEXT NOT NULL, exported INTEGER NOT NULL DEFAULT 0);');
  }
  state() { const row=this.ctx.storage.sql.exec('SELECT body FROM control WHERE id=1').toArray()[0];return row?JSON.parse(row.body):null; }
  save(s) {this.ctx.storage.sql.exec('INSERT INTO control(id,body) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',stable(s));}
  async domainRecoveryArchive(key){
    requireThat(/^recovery\/domains\/[a-zA-Z0-9_-]{1,128}\.json$/.test(key),'RECOVERY_DOMAIN_ARCHIVE_KEY_INVALID');
    const object=await this.env.CANONICAL.get(key);
    requireThat(object&&object.size<=2*SNAPSHOT_MAX_BYTES,'RECOVERY_DOMAIN_ARCHIVE_UNAVAILABLE',503);
    const text=await object.text();requireThat(new TextEncoder().encode(text).length<=2*SNAPSHOT_MAX_BYTES,'RECOVERY_DOMAIN_ARCHIVE_TOO_LARGE',413);
    return JSON.parse(text);
  }
  trust() {
    executionEnvironment(this.env);
    const map=trustMap(this.env);
    const entries=Object.values(map).filter(e=>e.native_id===this.ctx.id.toString());
    requireThat(entries.length===1,'AUTHORITY_INSTANCE_UNREGISTERED',409);
    const e=locator(entries[0]);
    executionDataset(this.env,e);
    requireThat(e.environment_id===this.env.ENVIRONMENT_ID,'ENVIRONMENT_MISMATCH',409);
    const s=this.state();
    if (s) {requireThat(sameLocator(s,e),'CONTROL_LOCATOR_MISMATCH',409);requireThat((s.semantic_profile_hash||null)===(e.semantic_profile_hash||null),'CONTROL_SEMANTIC_PROFILE_MISMATCH',409);}
    return e;
  }
  async fetch(request) {
    try {
      const trust=this.trust(), actor=await principal(request,this.env), path=new URL(request.url).pathname;
      const permission=path==='/read'||path==='/validate'?'read':path==='/prepare'||path==='/commit'?'promote':path==='/export'?'export':path==='/recovery-read'?'recovery-read':path==='/recovery-export'?'recovery-export':path==='/recovery-bootstrap'?'recovery-bootstrap':'control';
      authorize(actor,permission,trust);
      if (path==='/read' && request.method==='GET') return json({state:this.state(),instance_observation:{incarnation_id:this.incarnation_id}});
      requireThat(request.method==='POST','METHOD_DENIED',405);
      const size=Number(request.headers.get('content-length') || 0);requireThat(size<=262144,'REQUEST_TOO_LARGE',413);
      const bodyText=await request.text();requireThat(new TextEncoder().encode(bodyText).byteLength<=262144,'REQUEST_TOO_LARGE',413);
      const body=JSON.parse(bodyText), now=Date.now();
      // Re-check native/trust identity after awaits; final transactions also check state controls.
      requireThat(sameLocator(this.trust(),trust),'TRUST_CHANGED',409);
      const recoveryPlans=JSON.parse(this.env.RECOVERY_PLANS_JSON||'{}'),recoveryPlan=recoveryPlans[trust.dataset_id];
      if(path==='/recovery-bootstrap'){
        requireThat(actor.mode==='LIVE','RECOVERY_BOOTSTRAP_MODE_DENIED',403);
        requireThat(!this.state(),'ALREADY_BOOTSTRAPPED',409);
        requireThat(recoveryPlan&&stable(Object.keys(body))==='[]','RECOVERY_PLAN_REQUIRED',503);
        requireThat(/^recovery\/snapshots\/[a-zA-Z0-9_-]{1,128}\.json$/.test(recoveryPlan.snapshot_key),'RECOVERY_ARCHIVE_KEY_INVALID');
        const object=await this.env.CANONICAL.get(recoveryPlan.snapshot_key);
        requireThat(object&&object.size<=SNAPSHOT_MAX_BYTES+262144,'RECOVERY_SNAPSHOT_UNAVAILABLE',503);
        const data=await object.text();requireThat(new TextEncoder().encode(data).length<=SNAPSHOT_MAX_BYTES+262144,'RECOVERY_SNAPSHOT_TOO_LARGE',413);
        const domainArchive=recoveryPlan.domain_archive?await this.domainRecoveryArchive(recoveryPlan.domain_archive.key):null;
        const state=await frozenRecoveryState(JSON.parse(data),recoveryPlan,trust,JSON.parse(this.env.RECEIPT_SIGNING_JSON||'{}'),new Date().toISOString(),domainArchive);
        return json(this.ctx.storage.transactionSync(()=>{
          requireThat(sameLocator(this.trust(),trust),'TRUST_CHANGED',409);
          requireThat(!this.state(),'ALREADY_BOOTSTRAPPED',409);
          requireThat(['prepared','commands','audit','outbox'].every(table=>this.ctx.storage.sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).toArray()[0].n===0),'RECOVERY_TARGET_NOT_EMPTY',409);
          this.save(state);this.ctx.storage.sql.exec('INSERT INTO audit(body) VALUES(?)',stable({actor:actor.id,action:'RECOVERY_BOOTSTRAP',recovery:state.recovery}));
          return {state,writer_resumed:false};
        }));
      }
      if (path==='/bootstrap') {
        requireThat(!recoveryPlan,'RECOVERY_PLAN_REQUIRES_FROZEN_BOOTSTRAP',409);
        requireThat(actor.permissions.includes('bootstrap'),'BOOTSTRAP_DENIED',403);
        return json(this.ctx.storage.transactionSync(()=>{
          requireThat(!this.state(),'ALREADY_BOOTSTRAPPED',409);
          requireThat(sameLocator(body,trust),'BOOTSTRAP_LOCATOR_MISMATCH',409);
          const state={...trust,owner:body.owner,epoch:revision(body.epoch,'EPOCH'),revision:0,control_revision:0,active:null,frozen:false,next_transition_at:null};
          requireThat(typeof state.owner==='string' && state.owner.length>0,'OWNER_REQUIRED');
          this.save(state);return {state};
        }));
      }
      requireThat(this.state(),'NOT_BOOTSTRAPPED',409);
      if(path==='/recovery-read'){
        requireThat(actor.mode==='LIVE'&&stable(Object.keys(body))==='[]','RECOVERY_READ_REQUEST_DENIED',403);
        requireThat(recoveryPlan?.domain_archive&&recoveryPlan.target_authority_hash===await hash(trust),'RECOVERY_DOMAIN_ARCHIVE_REQUIRED',409);
        const state=this.state(),archive=await this.domainRecoveryArchive(recoveryPlan.domain_archive.key);
        const result=await recoveredDomainReadback(archive,recoveryPlan,state,new Date().toISOString());
        requireThat(sameLocator(this.trust(),trust)&&stable(this.state())===stable(state),'RECOVERY_STATE_CHANGED',409);
        return json(result);
      }
      if(path==='/recovery-export'){
        requireThat(actor.mode==='LIVE','RECOVERY_EXPORT_MODE_DENIED',403);
        const captured=this.ctx.storage.transactionSync(()=>{
          const control=this.state();requireThat(sameLocator(control,trust),'LOCATOR_CHANGED',409);
          let count=0,bytes=0;
          for(const table of SNAPSHOT_TABLES){const column=table==='commands'?'result':'body',m=this.ctx.storage.sql.exec(`SELECT COUNT(*) AS count,COALESCE(SUM(length(CAST(${column} AS BLOB))),0) AS bytes FROM ${table}`).toArray()[0];count+=m.count;bytes+=m.bytes;}
          requireThat(count<=SNAPSHOT_MAX_ROWS&&bytes<=SNAPSHOT_MAX_BYTES,'SNAPSHOT_TOO_LARGE',413);
          const tables={prepared:this.ctx.storage.sql.exec('SELECT id,body FROM prepared ORDER BY id').toArray(),commands:this.ctx.storage.sql.exec('SELECT id,digest,result FROM commands ORDER BY id').toArray(),audit:this.ctx.storage.sql.exec('SELECT id,body FROM audit ORDER BY id').toArray(),outbox:this.ctx.storage.sql.exec('SELECT revision,body,exported FROM outbox ORDER BY revision').toArray()};
          return {authority:trust,control,tables,captured_at:new Date().toISOString()};
        });
        const signer=JSON.parse(this.env.RECEIPT_SIGNING_JSON||'{}');
        const snapshot=await sealAuthoritySnapshot(captured,signer);
        requireThat(sameLocator(this.trust(),trust),'TRUST_CHANGED',409);
        return json(snapshot);
      }
      if (path==='/prepare') {
        requireThat(actor.mode==='LIVE','MODE_PROMOTION_DENIED',403);
        const c=candidate(body,now);requireThat(sameLocator(c,trust),'CANDIDATE_LOCATOR_MISMATCH',409);
        await validateSemanticAdmission(this.env,trust,c,new Date(now).toISOString(),actor);
        requireThat(actor.owner===this.state().owner && actor.epoch===this.state().epoch,'OWNER_EPOCH_DENIED',409);
        const digest=await hash(c), key=`generations/${trust.authority_instance_id}/${trust.recovery_generation}/${digest}.json`;
        const data=stable(c);const written=await this.env.CANONICAL.put(key,data,{onlyIf:{etagDoesNotMatch:'*'}});
        if (!written) {const old=await this.env.CANONICAL.get(key);requireThat(old && await old.text()===data,'IMMUTABLE_CONTENT_CONFLICT',409);}
        const verify=await this.env.CANONICAL.get(key);requireThat(verify && await hash(await verify.text())===digest,'BLOB_VERIFY_FAILED',503);
        // No deletion/lifecycle integration is enabled: prepared/active blobs are retained in this phase.
        this.ctx.storage.transactionSync(()=>{
          candidate(c,Date.now());
          const s=this.state();requireThat(sameLocator(s,trust) && s.owner===actor.owner && s.epoch===actor.epoch,'OWNER_EPOCH_DENIED',409);
          requireThat(c.expected_revision===s.revision && c.expected_control_revision===s.control_revision,'RECOMPUTE_REQUIRED',409);
          const prepared={...c,key,digest,prepared_until:Math.min(now+300000,instant(c.valid_to,'VALID_TO'))};
          this.ctx.storage.sql.exec('INSERT INTO prepared(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',digest,stable(prepared));
        });
        return json({digest,key});
      }
      if (path==='/commit') {
        requireThat(actor.mode==='LIVE','MODE_PROMOTION_DENIED',403);
        requireThat(typeof body.command_id==='string' && /^[a-zA-Z0-9_-]{1,128}$/.test(body.command_id),'COMMAND_ID_INVALID');
        requireThat(/^[a-f0-9]{64}$/.test(body.digest),'DIGEST_INVALID');
        requireThat(sameLocator(body,trust),'COMMIT_LOCATOR_MISMATCH',409);
        const deadline=instant(body.expires_at,'COMMAND_EXPIRES');
        // Validate a configured semantic generation before the transaction. Idempotent completed commands still return their exact prior receipt.
        const known=this.ctx.storage.sql.exec('SELECT digest,result FROM commands WHERE id=?',body.command_id).toArray()[0];
        if(known)await validateSemanticReplayActor(this.env,trust,actor,JSON.parse(known.result),new Date().toISOString());
        if(!known&&trust.semantic_profile_hash){const prepared=this.ctx.storage.sql.exec('SELECT body FROM prepared WHERE id=?',body.digest).toArray()[0];requireThat(prepared,'NOT_PREPARED',409);await validateSemanticAdmission(this.env,trust,JSON.parse(prepared.body),new Date().toISOString(),actor);requireThat(sameLocator(this.trust(),trust),'TRUST_CHANGED',409);}
        let retiredForecastDigest=null;
        if(!known){
          const active=this.state().active;
          const old=active&&this.ctx.storage.sql.exec('SELECT body FROM prepared WHERE id=?',active.digest).toArray()[0];
          const next=this.ctx.storage.sql.exec('SELECT body FROM prepared WHERE id=?',body.digest).toArray()[0];
          if(old&&next){const previous=JSON.parse(old.body),current=JSON.parse(next.body),at=Date.now();if(await isExpiredForecastRetirement(previous,current,at)||await isFutureForecastExtension(previous,current,at))retiredForecastDigest=active.digest;}
        }
        const receipt=this.ctx.storage.transactionSync(()=>{
          const now=Date.now();
          const s=this.state();requireThat(sameLocator(s,trust),'LOCATOR_CHANGED',409);
          requireThat(s.owner===actor.owner && s.epoch===actor.epoch,'OWNER_EPOCH_DENIED',409);
          const previous=this.ctx.storage.sql.exec('SELECT digest,result FROM commands WHERE id=?',body.command_id).toArray()[0];
          if (previous) {requireThat(previous.digest===body.digest,'COMMAND_DIGEST_CONFLICT',409);const result=JSON.parse(previous.result);requireThat(result.command_id===body.command_id&&Number.isSafeInteger(result.revision),'COMMAND_KIND_CONFLICT',409);return result;}
          requireThat(deadline>now,'COMMAND_EXPIRED',409);
          const row=this.ctx.storage.sql.exec('SELECT body FROM prepared WHERE id=?',body.digest).toArray()[0];
          requireThat(row,'NOT_PREPARED',409);const p=JSON.parse(row.body);
          requireThat(p.prepared_until>now,'PREPARE_EXPIRED',409);
          requireThat(p.expected_revision===s.revision && p.expected_control_revision===s.control_revision,'RECOMPUTE_REQUIRED',409);
          requireThat(!s.frozen || p.operation==='RETRACTION','PUBLICATION_FROZEN',409);
          requireThat(Object.keys(s.artifacts).every(k=>p.artifacts[k]===s.artifacts[k]),'ACTIVATION_MISMATCH',409);
          requireThat(p.operation!=='NORMAL'||!s.active||p.logical_slot>=s.active.logical_slot,'OBSOLETE_SLOT',409);
          if(continuousContract(p.semantic_admission?.contract_version)&&s.active){
            const prior=s.active.semantic_admission,current=p.semantic_admission;
            requireThat(prior?.contract_version===current.contract_version,'CONTINUOUS_PREVIOUS_PROFILE_DENIED',409);
            const before=instant(prior.source_version_time,'CONTINUOUS_PREVIOUS_VERSION'),after=instant(current.source_version_time,'CONTINUOUS_VERSION');
            requireThat(after>=before&&(after!==before||current.input_hash===prior.input_hash||retiredForecastDigest===s.active.digest),'CONTINUOUS_SOURCE_REGRESSION',409);
          }
          if(p.operation!=='NORMAL') {requireThat(actor.permissions.includes('correct'),'CORRECTION_DENIED',403);requireThat(p.supersedes_revision===s.revision,'SUPERSEDES_MISMATCH',409);}
          candidate(p,now);
          if(trust.semantic_profile_hash){requireThat(p.semantic_admission?.profile_hash===trust.semantic_profile_hash&&now<instant(p.semantic_admission.valid_until,'SEMANTIC_VALID_UNTIL'),'SEMANTIC_ADMISSION_EXPIRED',409);requireThat(p.decision?.effect==='ABSTAIN','SEMANTIC_ACTION_FORBIDDEN',409);}
          if(p.decision?.effect==='POSITIVE') {
            requireThat(trust.approved_positive_decision_types?.includes(p.decision.type),'POSITIVE_POLICY_NOT_ACTIVATED',409);
            requireThat(p.decision.minimum_evidence_met && p.quality.completeness==='COMPLETE' && p.quality.resolution==='RESOLVED','POSITIVE_EVIDENCE_INSUFFICIENT',409);
            requireThat(instant(p.decision.action_until,'ACTION_UNTIL')>now,'POSITIVE_EXPIRED',409);
            requireThat(!s.next_transition_at || now<instant(s.next_transition_at,'NEXT_TRANSITION'),'CONTROL_TRANSITION_REQUIRES_RECOMPUTE',409);
            requireThat(p.inputs.every(i=>now>=instant(i.source_time,'SOURCE_TIME')-5000 && now-instant(i.source_time,'SOURCE_TIME')<=i.max_age_ms && now<instant(i.valid_to,'INPUT_VALID_TO')),'POSITIVE_SOURCE_STALE',409);
          }
          const next=revision(s.revision+1,'NEW_REVISION');
          const r={...trust,...(p.semantic_admission?{semantic_admission:p.semantic_admission}:{}),revision:next,control_revision:s.control_revision,owner:s.owner,epoch:s.epoch,key:p.key,digest:p.digest,logical_slot:p.logical_slot,operation:p.operation,previous_revision:s.revision,committed_at:new Date(now).toISOString(),command_id:body.command_id};
          s.revision=next;s.active=r;this.save(s);
          this.ctx.storage.sql.exec('INSERT INTO commands(id,digest,result) VALUES(?,?,?)',body.command_id,body.digest,stable(r));
          this.ctx.storage.sql.exec('INSERT INTO audit(body) VALUES(?)',stable({actor:actor.id,action:'COMMIT',receipt:r}));
          this.ctx.storage.sql.exec('INSERT INTO outbox(revision,body) VALUES(?,?)',next,stable(r));
          return r;
        });
        return json({receipt});
      }
      if (path==='/control') {
        requireThat(typeof body.command_id==='string' && body.command_id.length>0,'COMMAND_ID_REQUIRED');
        const digest=await hash(body);
        return json(this.ctx.storage.transactionSync(()=>{
          const now=Date.now();
          const s=this.state(), prev=this.ctx.storage.sql.exec('SELECT digest,result FROM commands WHERE id=?',body.command_id).toArray()[0];
          if(prev){requireThat(prev.digest===digest,'COMMAND_DIGEST_CONFLICT',409);return JSON.parse(prev.result);}
          requireThat(body.expected_control_revision===s.control_revision,'CONTROL_CONFLICT',409);
          requireThat(instant(body.expires_at,'COMMAND_EXPIRES')>now,'COMMAND_EXPIRED',409);
          requireThat(typeof body.reason==='string'&&body.reason.length>0,'CONTROL_REASON_REQUIRED');
          if(body.action==='TRANSFER') {requireThat(typeof body.owner==='string'&&body.owner.length>0,'OWNER_REQUIRED');s.owner=body.owner;s.epoch=revision(s.epoch+1,'NEW_EPOCH');}
          else if(body.action==='FREEZE') {requireThat(typeof body.frozen==='boolean','FREEZE_VALUE_REQUIRED');requireThat(body.frozen||!s.recovery||s.recovery.writer_resume_allowed===true,'RECOVERY_RESUME_GATE_CLOSED',409);s.frozen=body.frozen;}
          else if(body.action==='RESTRICT_AT') {requireThat(instant(body.effective_from,'EFFECTIVE_FROM')>now,'TRANSITION_NOT_FUTURE');s.next_transition_at=body.effective_from;}
          else throw new ContractError('CONTROL_ACTION_UNSUPPORTED');
          s.control_revision=revision(s.control_revision+1,'NEW_CONTROL_REVISION');this.save(s);
          const result={state:s};this.ctx.storage.sql.exec('INSERT INTO commands(id,digest,result) VALUES(?,?,?)',body.command_id,digest,stable(result));
          this.ctx.storage.sql.exec('INSERT INTO audit(body) VALUES(?)',stable({actor:actor.id,action:body.action,state:s,reason:body.reason}));return result;
        }));
      }
      if (path==='/export') {
        // A failed export leaves the committed authority untouched and the outbox retryable.
        const signer=JSON.parse(this.env.RECEIPT_SIGNING_JSON || '{}');
        requireThat(signer.key_id && signer.private_jwk && trust.receipt_keys?.[signer.key_id],'SIGNER_UNAVAILABLE',503);
        const pub=trust.receipt_keys[signer.key_id];
        requireThat(pub.x===signer.private_jwk.x && pub.y===signer.private_jwk.y,'SIGNER_SCOPE_MISMATCH',409);
        const rows=this.ctx.storage.sql.exec('SELECT revision,body FROM outbox WHERE exported=0 ORDER BY revision LIMIT 5').toArray();
        const exported=[];
        for(const row of rows) {
          const receipt=JSON.parse(row.body);
          requireThat(sameLocator(receipt,trust),'OUTBOX_LOCATOR_MISMATCH',409);
          const envelope=await attest(receipt,signer.key_id,signer.private_jwk);
          requireThat(sameLocator(this.trust(),trust),'TRUST_CHANGED',409);
          const projection=await exportCheckpoint(this.env.CANONICAL,envelope);
          requireThat(projection.exported,'PROJECTION_RETRY_REQUIRED',503);
          this.ctx.storage.sql.exec('UPDATE outbox SET exported=1 WHERE revision=?',row.revision);
          exported.push(row.revision);
        }
        return json({exported});
      }
      if (path==='/validate') {
        const s=this.state();requireThat(s.active && s.active.revision===body.revision && s.active.digest===body.digest,'RECEIPT_NOT_CURRENT',409);
        requireThat(s.active.control_revision===s.control_revision,'CONTROL_REQUIRES_RECOMPUTE',409);
        const end=Math.min(now+15000,s.next_transition_at?instant(s.next_transition_at,'NEXT_TRANSITION'):Infinity);
        requireThat(end>now,'CONTROL_TRANSITION_REQUIRES_RECOMPUTE',409);
        return json({validation:{...trust,revision:s.revision,control_revision:s.control_revision,validated_at:new Date(now).toISOString(),expires_at:new Date(end).toISOString(),positive_allowed:!s.frozen && s.active.operation!=='RETRACTION'}});
      }
      throw new ContractError('NOT_FOUND',404);
    } catch(e) {return json({error:e instanceof ContractError?e.code:'INTERNAL_ERROR'}, e instanceof ContractError?e.status:500);}
  }
}
