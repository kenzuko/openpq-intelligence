import { instant, requireThat, sameLocator } from './contracts.js';

// The clock is an explicit input. No resolver or collector runs in this function.
export function servingView(generation, receipt, trust, validation, now) {
  requireThat(sameLocator(receipt, trust) && sameLocator(generation, trust), 'UNTRUSTED_LOCATOR', 409);
  if(trust.semantic_profile_hash)requireThat(generation.semantic_profile_hash===trust.semantic_profile_hash&&receipt.semantic_admission?.profile_hash===trust.semantic_profile_hash&&generation.semantic_admission?.profile_hash===trust.semantic_profile_hash,'SEMANTIC_SERVING_PROFILE_DENIED',409);
  const validity = now >= instant(generation.valid_from,'VALID_FROM') && now < instant(generation.valid_to,'VALID_TO');
  const ages = generation.inputs.map(i=>({source_id:i.source_id,source_time:i.source_time,age_ms:now-instant(i.source_time,'SOURCE_TIME'),valid_to:i.valid_to,max_age_ms:i.max_age_ms}));
  const fresh = ages.every(i=>i.age_ms>=-5000 && i.age_ms<=i.max_age_ms && now<instant(i.valid_to,'INPUT_VALID_TO'));
  const verified = Boolean(validation && sameLocator(validation,trust) && validation.revision===receipt.revision && validation.control_revision===receipt.control_revision && now<instant(validation.expires_at,'VALIDATION_EXPIRES') && instant(validation.validated_at,'VALIDATED_AT')<=now+5000);
  let eligibility = 'ABSTAIN';
  const d=generation.decision;
  if (receipt.operation==='RETRACTION') eligibility='REVOKED';
  else if (d && (!validity || now>=instant(d.action_until,'ACTION_UNTIL'))) eligibility='EXPIRED';
  else if (d && d.effect==='POSITIVE') {
    if (!verified) eligibility='UNVERIFIED';
    else if (fresh && d.minimum_evidence_met && generation.quality.completeness==='COMPLETE' && generation.quality.resolution==='RESOLVED' && validation.positive_allowed) eligibility='ELIGIBLE';
  }
  // Restrictions remain historical facts/recommendations; no expired state becomes OPEN.
  else if (d && d.effect==='RESTRICTIVE' && validity && fresh && verified) eligibility='ELIGIBLE';
  const action_deadline = d ? Math.min(instant(generation.valid_to,'VALID_TO'),instant(d.action_until,'ACTION_UNTIL'), ...generation.inputs.map(i=>Math.min(instant(i.valid_to,'INPUT_VALID_TO'),instant(i.source_time,'SOURCE_TIME')+i.max_age_ms)), validation ? instant(validation.expires_at,'VALIDATION_EXPIRES') : now) : now;
  return {served_at:new Date(now).toISOString(),freshness:validity ? (fresh?'FRESH':'STALE') : 'EXPIRED',authority:verified?'VERIFIED':'UNVERIFIED',decision_eligibility:eligibility,action_until:new Date(Math.max(0,action_deadline)).toISOString(),inputs:ages,quality:generation.quality};
}
