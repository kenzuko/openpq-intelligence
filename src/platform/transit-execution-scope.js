import {requireThat} from './contracts.js';
export const TRANSIT_FACT_ENVIRONMENT='canonical-transit-fact';
export const TRANSIT_FACT_ACCOUNT='1a64a0a081ea758f72be8254030bdf11';
export const TRANSIT_FACT_GATE='TRANSIT_FACT_ONLY_V1';
export function executionEnvironment(env){
 if(['local-test','isolated-test'].includes(env.ENVIRONMENT_ID))return;
 requireThat(env.ENVIRONMENT_ID===TRANSIT_FACT_ENVIRONMENT&&env.ACCOUNT_ID===TRANSIT_FACT_ACCOUNT&&env.CANONICAL_TRANSIT_GATE===TRANSIT_FACT_GATE,'PRODUCTION_GATE_CLOSED',503);
}
export function executionDataset(env,trust){
 executionEnvironment(env);
 if(env.ENVIRONMENT_ID!==TRANSIT_FACT_ENVIRONMENT)return;
 requireThat(trust.environment_id===TRANSIT_FACT_ENVIRONMENT&&trust.account_id===TRANSIT_FACT_ACCOUNT&&trust.dataset_id==='transit.bridge.phu-quoc'&&/^[a-f0-9]{64}$/.test(trust.semantic_profile_hash??'')&&Array.isArray(trust.approved_positive_decision_types)&&trust.approved_positive_decision_types.length===0,'TRANSIT_FACT_EXECUTION_SCOPE_DENIED',503);
}
