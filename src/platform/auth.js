import { ContractError, requireThat, sameLocator } from './contracts.js';

export async function principal(request, env) {
  let entries;
  try { entries=JSON.parse(env.PRINCIPALS_JSON || '[]'); } catch { throw new ContractError('AUTH_CONFIGURATION_INVALID',503); }
  const raw=request.headers.get('authorization') || '';
  const token=raw.startsWith('Bearer ') ? raw.slice(7) : '';
  const encoder=new TextEncoder();
  // HMAC comparison avoids a raw-token early-exit comparison. Secrets never enter logs/state.
  const key=await crypto.subtle.importKey('raw',encoder.encode('openpq-local-token-comparison'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const supplied=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(token)));
  let match=null;
  for (const item of entries) {
    const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(item.token || '')));
    let diff=supplied.length ^ expected.length;
    for (let i=0;i<supplied.length;i++) diff|=supplied[i]^expected[i];
    if (!diff && token) match=item;
  }
  requireThat(match,'AUTH_DENIED',401);
  return match;
}
export function authorize(actor, permission, trust) {
  requireThat(actor.permissions?.includes(permission),'CAPABILITY_DENIED',403);
  requireThat(actor.environment_id===trust.environment_id && actor.dataset_id===trust.dataset_id,'CAPABILITY_SCOPE_DENIED',403);
  if (permission !== 'read') requireThat(sameLocator(actor,trust),'CAPABILITY_LOCATOR_DENIED',403);
}
