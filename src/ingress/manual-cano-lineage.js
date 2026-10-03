import {ContractError,hash,stable} from '../platform/contracts.js';
import {validateCanoShadow} from './manual-cano-semantic.js';

export const CANO_WRAPPER_VERSION='openpq-cano-revision-wrapper-v1';
export const CANO_WRAPPER_ID_VERSION='openpq-cano-wrapper-id-v1';
export const CANO_LEDGER_VERSION='openpq-cano-ledger-result-v1';
export const CANO_PREFLIGHT_REJECTION_VERSION='openpq-cano-preflight-rejection-v1';

const DIGEST=/^[a-f0-9]{64}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const UTC_MILLIS=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DATASET=/^cano\.operation\.[a-z0-9-]+$/;

function fail(code){throw new ContractError(code);}
function isObject(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function exactKeys(value,keys){
  if(!isObject(value))return false;
  const a=Object.keys(value).sort(),b=[...keys].sort();
  return a.length===b.length&&a.every((x,i)=>x===b[i]);
}
function clone(value){return JSON.parse(stable(value));}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function immutable(value){return freeze(clone(value));}
function validDay(value){
  if(typeof value!=='string'||!DAY.test(value))return false;
  const [y,m,d]=value.split('-').map(Number),n=Date.UTC(y,m-1,d),dt=new Date(n);
  return Number.isFinite(n)&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}
function canonicalUtcMillis(value){
  if(typeof value!=='string'||!UTC_MILLIS.test(value))return false;
  const n=Date.parse(value);return Number.isFinite(n)&&new Date(n).toISOString()===value;
}
function targetValid(target){
  if(!exactKeys(target,['dataset_id','scope'])||typeof target.dataset_id!=='string'||!DATASET.test(target.dataset_id))return false;
  const s=target.scope;
  return exactKeys(s,['category','service_area','operational_day','timezone','mapping_id'])&&s.category==='cano'&&typeof s.service_area==='string'&&s.service_area.length>0&&s.service_area.length<=128&&validDay(s.operational_day)&&s.timezone==='Asia/Ho_Chi_Minh'&&typeof s.mapping_id==='string'&&s.mapping_id.length>0&&s.mapping_id.length<=128;
}
function rejection(code){return immutable({contract_version:CANO_PREFLIGHT_REJECTION_VERSION,fixture_only:true,status:'INVALID',projection_status:'UNRESOLVED',reason_codes:[code],action_eligible:false,publication_admitted:false});}
function emptyProjection(state='UNRESOLVED',reason_codes=[]){return {state,terminal_revision_id:null,reported_state:null,source_time:null,valid_to:null,reason_codes:[...reason_codes],action_eligible:false,publication_admitted:false};}
function codeOf(error,fallback='CANO_SCHEMA_INVALID'){return typeof error?.code==='string'?error.code:fallback;}
function unique(values){return [...new Set(values)];}
function sortUnique(values){return unique(values).sort();}
function wrapperShape(wrapper){
  if(!exactKeys(wrapper,['contract_version','fixture_only','revision_id','wrapper_id','shadow_record','supersedes','action_eligible','publication_admitted']))fail('CANO_SCHEMA_INVALID');
  if(typeof wrapper.contract_version!=='string'||typeof wrapper.fixture_only!=='boolean'||!DIGEST.test(wrapper.revision_id)||!DIGEST.test(wrapper.wrapper_id)||!(wrapper.supersedes===null||DIGEST.test(wrapper.supersedes))||typeof wrapper.action_eligible!=='boolean'||typeof wrapper.publication_admitted!=='boolean')fail('CANO_SCHEMA_INVALID');
  if(wrapper.contract_version!==CANO_WRAPPER_VERSION||wrapper.fixture_only!==true||wrapper.action_eligible!==false||wrapper.publication_admitted!==false)fail('CANO_FIXTURE_FENCE_VIOLATION');
}
async function wrapperId(revision_id,supersedes){return hash({identity_version:CANO_WRAPPER_ID_VERSION,revision_id,supersedes});}

export async function wrapCanoRevision(shadow,{supersedes=null}={}){
  if(!(supersedes===null||DIGEST.test(supersedes)))fail('CANO_SCHEMA_INVALID');
  const verified=await validateCanoShadow(shadow);
  const wrapper={contract_version:CANO_WRAPPER_VERSION,fixture_only:true,revision_id:verified.revision_id,wrapper_id:await wrapperId(verified.revision_id,supersedes),shadow_record:verified,supersedes,action_eligible:false,publication_admitted:false};
  return validateCanoRevisionWrapper(wrapper);
}

export async function validateCanoRevisionWrapper(wrapper){
  wrapperShape(wrapper);
  const shadow=await validateCanoShadow(wrapper.shadow_record);
  if(wrapper.revision_id!==shadow.revision_id)fail('CANO_REVISION_ID_MISMATCH');
  const expected=await wrapperId(wrapper.revision_id,wrapper.supersedes);
  if(wrapper.wrapper_id!==expected)fail('CANO_WRAPPER_ID_MISMATCH');
  return immutable({...wrapper,shadow_record:shadow});
}

function makeLedger({evaluation_time,target,input_count,retained,duplicates,quarantined,errors,reason_codes,projection,status}){
  const orderedErrors=[...errors].sort((a,b)=>a.input_index-b.input_index);
  return immutable({contract_version:CANO_LEDGER_VERSION,fixture_only:true,evaluation_time,target:clone(target),ledger_status:status,input_count,retained_revision_count:retained.length,revision_ids:sortUnique(retained.map(x=>x.wrapper.revision_id)),duplicate_revision_ids:sortUnique(duplicates),quarantined_revision_ids:sortUnique(quarantined),validation_errors:orderedErrors.map(x=>({input_index:x.input_index,claimed_revision_id:x.claimed_revision_id,reason_codes:unique(x.reason_codes)})),reason_codes:unique([...orderedErrors.flatMap(x=>x.reason_codes),...reason_codes]),projection,action_eligible:false,publication_admitted:false});
}
function claimedId(value){return DIGEST.test(value?.revision_id||'')?value.revision_id:null;}
function targetMatches(wrapper,target){
  const r=wrapper.shadow_record.normalized_record;
  return r.dataset_id===target.dataset_id&&stable(r.scope)===stable(target.scope);
}
function pointerKey(wrapper){return stable(wrapper.shadow_record.source_pointer);}
function addError(errors,input_index,wrapper,code){errors.push({input_index,claimed_revision_id:claimedId(wrapper),reason_codes:[code]});}
function detectCycle(entries){
  const byId=new Map(entries.map(x=>[x.wrapper.revision_id,x.wrapper]));
  const visiting=new Set(),done=new Set();
  function walk(id){
    if(done.has(id))return false;if(visiting.has(id))return true;
    visiting.add(id);const p=byId.get(id)?.supersedes;if(p&&byId.has(p)&&walk(p))return true;
    visiting.delete(id);done.add(id);return false;
  }
  for(const id of byId.keys())if(walk(id))return true;return false;
}

export async function reduceCanoLedger({wrappers,target,evaluation_time}={}){
  if(!targetValid(target))return rejection('TARGET_INVALID');
  if(!canonicalUtcMillis(evaluation_time))return rejection('EVALUATION_TIME_INVALID');
  if(!Array.isArray(wrappers)){
    return makeLedger({evaluation_time,target,input_count:0,retained:[],duplicates:[],quarantined:[],errors:[{input_index:0,claimed_revision_id:null,reason_codes:['CANO_SCHEMA_INVALID']}],reason_codes:['CANO_SCHEMA_INVALID'],projection:emptyProjection('UNRESOLVED'),status:'INVALID'});
  }

  const verified=[];const errors=[];
  for(let i=0;i<wrappers.length;i++){
    try{verified.push({wrapper:await validateCanoRevisionWrapper(wrappers[i]),inputIndex:i});}
    catch(error){addError(errors,i,wrappers[i],codeOf(error));}
  }
  for(const entry of verified){if(!targetMatches(entry.wrapper,target))addError(errors,entry.inputIndex,entry.wrapper,'TARGET_BINDING_MISMATCH');}
  if(errors.length){
    const invalidIndexes=new Set(errors.map(x=>x.input_index));
    const retained=verified.filter(x=>!invalidIndexes.has(x.inputIndex));
    return makeLedger({evaluation_time,target,input_count:wrappers.length,retained,duplicates:[],quarantined:retained.filter(x=>x.wrapper.shadow_record.normalized_record.normalization_status==='QUARANTINED').map(x=>x.wrapper.revision_id),errors,reason_codes:unique(errors.flatMap(x=>x.reason_codes)),projection:emptyProjection('UNRESOLVED'),status:'INVALID'});
  }

  const retained=[];const duplicates=[];const byRevision=new Map();const graphErrors=[];
  for(const entry of verified){
    const id=entry.wrapper.revision_id,prior=byRevision.get(id);
    if(!prior){byRevision.set(id,entry);retained.push(entry);continue;}
    if(prior.wrapper.wrapper_id===entry.wrapper.wrapper_id&&stable(prior.wrapper)===stable(entry.wrapper)){duplicates.push(id);continue;}
    addError(graphErrors,entry.inputIndex,entry.wrapper,'CANO_REVISION_WRAPPER_CONFLICT');
  }
  const byPointer=new Map();
  for(const entry of retained){
    const key=pointerKey(entry.wrapper),digest=entry.wrapper.shadow_record.normalized_record_digest,prior=byPointer.get(key);
    if(prior&&prior.digest!==digest)addError(graphErrors,entry.inputIndex,entry.wrapper,'CANO_SOURCE_POINTER_CONTENT_CONFLICT');
    else if(!prior)byPointer.set(key,{digest,entry});
  }
  const map=new Map(retained.map(x=>[x.wrapper.revision_id,x]));
  for(const entry of retained){
    const w=entry.wrapper,p=w.supersedes;if(!p)continue;
    if(p===w.revision_id){addError(graphErrors,entry.inputIndex,w,'CANO_SUPERSEDES_SELF');continue;}
    const parent=map.get(p);
    if(!parent){addError(graphErrors,entry.inputIndex,w,'CANO_SUPERSEDES_TARGET_MISSING');continue;}
    const a=w.shadow_record.normalized_record,b=parent.wrapper.shadow_record.normalized_record;
    if(a.dataset_id!==b.dataset_id){addError(graphErrors,entry.inputIndex,w,'CANO_SUPERSEDES_CROSS_DATASET');continue;}
    if(stable(a.scope)!==stable(b.scope)){
      if(a.scope.operational_day!==b.scope.operational_day)addError(graphErrors,entry.inputIndex,w,'CANO_SUPERSEDES_CROSS_DAY');
      else addError(graphErrors,entry.inputIndex,w,'CANO_SUPERSEDES_CROSS_SCOPE');
    }
  }
  if(!graphErrors.length&&detectCycle(retained)){
    const entry=retained.find(x=>x.wrapper.supersedes)||retained[0];
    addError(graphErrors,entry?.inputIndex??0,entry?.wrapper||null,'CANO_SUPERSEDES_CYCLE');
  }
  if(graphErrors.length){
    const quarantined=retained.filter(x=>x.wrapper.shadow_record.normalized_record.normalization_status==='QUARANTINED').map(x=>x.wrapper.revision_id);
    return makeLedger({evaluation_time,target,input_count:wrappers.length,retained,duplicates,quarantined,errors:graphErrors,reason_codes:[...unique(graphErrors.flatMap(x=>x.reason_codes)),'CANO_PROJECTION_GRAPH_INVALID'],projection:emptyProjection('UNRESOLVED',['CANO_PROJECTION_GRAPH_INVALID']),status:'INVALID'});
  }

  const superseded=new Set(retained.map(x=>x.wrapper.supersedes).filter(Boolean));
  const terminals=retained.filter(x=>!superseded.has(x.wrapper.revision_id));
  const quarantined=retained.filter(x=>x.wrapper.shadow_record.normalized_record.normalization_status==='QUARANTINED').map(x=>x.wrapper.revision_id);
  const info=duplicates.length?['CANO_EXACT_DUPLICATE_REPLAY']:[];
  let projection;
  if(terminals.length===0){projection=emptyProjection('UNRESOLVED',['CANO_PROJECTION_NO_TERMINAL']);}
  else if(terminals.length>1){projection=emptyProjection('AMBIGUOUS',['CANO_PROJECTION_MULTIPLE_TERMINALS']);}
  else{
    const terminal=terminals[0].wrapper,r=terminal.shadow_record.normalized_record;
    const common={terminal_revision_id:terminal.revision_id,source_time:r.source_time,valid_to:r.valid_to,action_eligible:false,publication_admitted:false};
    if(r.normalization_status==='QUARANTINED')projection={state:'QUARANTINED',...common,reported_state:null,reason_codes:['CANO_PROJECTION_TERMINAL_QUARANTINED']};
    else if(Date.parse(evaluation_time)<Date.parse(r.valid_from))projection={state:'UNRESOLVED',...common,reported_state:null,reason_codes:['CANO_PROJECTION_NOT_YET_EFFECTIVE']};
    else if(Date.parse(evaluation_time)>=Date.parse(r.valid_to))projection={state:'EXPIRED',...common,reported_state:null,reason_codes:['CANO_PROJECTION_TERMINAL_EXPIRED']};
    else projection={state:'RESOLVED',...common,reported_state:r.reported_state,reason_codes:['CANO_PROJECTION_SINGLE_TERMINAL']};
  }
  return makeLedger({evaluation_time,target,input_count:wrappers.length,retained,duplicates,quarantined,errors:[],reason_codes:[...info,...projection.reason_codes],projection,status:'VALID'});
}
