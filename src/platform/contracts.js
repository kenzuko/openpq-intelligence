export class ContractError extends Error {
  constructor(code, status = 422) { super(code); this.code = code; this.status = status; }
}
export function requireThat(condition, code, status = 422) {
  if (!condition) throw new ContractError(code, status);
}
export function object(value, label) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), `${label}_OBJECT_REQUIRED`);
  return value;
}
export function text(value, label) {
  requireThat(typeof value === 'string' && value.length > 0 && value.length <= 256, `${label}_TEXT_REQUIRED`);
  return value;
}
export function instant(value, label) {
  requireThat(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value), `${label}_UTC_REQUIRED`);
  const n = Date.parse(value);
  requireThat(Number.isFinite(n) && new Date(n).toISOString().replace('.000Z','Z') === value.replace('.000Z','Z'), `${label}_INVALID`);
  return n;
}
export function revision(value, label) {
  requireThat(Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER, `${label}_INVALID`);
  return value;
}
export function stable(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { requireThat(Number.isFinite(value), 'NONFINITE_NUMBER'); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  object(value, 'JSON');
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
}
export async function hash(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : stable(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2,'0')).join('');
}
export function candidate(value, now) {
  object(value, 'CANDIDATE');
  requireThat(value.schema_version === 'openpq-candidate-v1', 'SCHEMA_UNSUPPORTED');
  for (const k of ['dataset_id','candidate_id','environment_id','recovery_generation','authority_instance_id','authority_locator_version','locator_artifact_hash']) text(value[k], k);
  revision(value.expected_revision, 'EXPECTED_REVISION'); revision(value.expected_control_revision,'EXPECTED_CONTROL_REVISION');
  requireThat(Number.isSafeInteger(value.logical_slot) && value.logical_slot >= 0, 'SLOT_INVALID');
  const from = instant(value.valid_from, 'VALID_FROM'), to = instant(value.valid_to, 'VALID_TO');
  requireThat(from < to && to > now, 'CANDIDATE_EXPIRED');
  const evaluation = instant(value.evaluation_time, 'EVALUATION_TIME');
  requireThat(evaluation <= now + 5000, 'EVALUATION_IN_FUTURE');
  requireThat(Array.isArray(value.inputs) && value.inputs.length > 0 && value.inputs.length <= 100, 'INPUTS_REQUIRED');
  for (const input of value.inputs) {
    object(input, 'INPUT'); text(input.source_id, 'SOURCE_ID');
    instant(input.source_time,'SOURCE_TIME'); instant(input.valid_to,'INPUT_VALID_TO');
    requireThat(['OBSERVATION','FORECAST','MANUAL','OFFICIAL_REPORT'].includes(input.source_type), 'SOURCE_TYPE_INVALID');
    requireThat(Number.isSafeInteger(input.max_age_ms) && input.max_age_ms > 0, 'INPUT_FRESHNESS_POLICY_REQUIRED');
  }
  object(value.quality,'QUALITY');
  requireThat(['COMPLETE','PARTIAL','INSUFFICIENT'].includes(value.quality.completeness), 'COMPLETENESS_INVALID');
  requireThat(['RESOLVED','CONFLICTING','UNCERTAIN','INSUFFICIENT_EVIDENCE'].includes(value.quality.resolution), 'RESOLUTION_INVALID');
  object(value.artifacts,'ARTIFACTS');
  for (const k of ['rule','config','policy','schema']) requireThat(/^[a-f0-9]{64}$/.test(value.artifacts[k]), `ARTIFACT_${k}_HASH_REQUIRED`);
  object(value.payload,'PAYLOAD');
  requireThat(['NORMAL','CORRECTION','RETRACTION'].includes(value.operation),'OPERATION_INVALID');
  if (value.operation !== 'NORMAL') {
    revision(value.supersedes_revision,'SUPERSEDES_REVISION'); text(value.reason,'CORRECTION_REASON');
  }
  if (value.decision) {
    const d=object(value.decision,'DECISION'); text(d.type,'DECISION_TYPE');
    requireThat(['FACT','RECOMMENDATION'].includes(d.kind),'DECISION_KIND_REQUIRED');
    requireThat(['POSITIVE','RESTRICTIVE','ABSTAIN'].includes(d.effect),'DECISION_EFFECT_REQUIRED');
    instant(d.action_until,'ACTION_UNTIL');
    requireThat(typeof d.minimum_evidence_met === 'boolean','MINIMUM_EVIDENCE_REQUIRED');
    requireThat(Array.isArray(d.reason_codes) && d.reason_codes.every(x=>typeof x === 'string'),'REASON_CODES_REQUIRED');
  }
  return value;
}
export function locator(value) {
  object(value,'LOCATOR');
  for (const k of ['environment_id','dataset_id','authority_instance_id','authority_locator_version','locator_artifact_hash','namespace_id','native_id','object_name','recovery_generation']) text(value[k], k);
  requireThat(/^[a-f0-9]{64}$/.test(value.native_id), 'NATIVE_ID_INVALID');
  object(value.artifacts,'LOCATOR_ARTIFACTS');
  for (const k of ['rule','config','policy','schema']) requireThat(/^[a-f0-9]{64}$/.test(value.artifacts[k]),'LOCATOR_ARTIFACT_HASH_INVALID');
  return value;
}
export function sameLocator(value, trust) {
  return Boolean(value && trust && ['environment_id','dataset_id','authority_instance_id','authority_locator_version','locator_artifact_hash','namespace_id','native_id','object_name','recovery_generation'].every(k=>typeof trust[k]==='string' && trust[k].length>0 && value[k] === trust[k]));
}
