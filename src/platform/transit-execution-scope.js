import {AIRPORT_FACT_ENVIRONMENT,AIRPORT_FACT_ACCOUNT,AIRPORT_FACT_GATE,AIRPORT_FACT_DATASET} from './airport-execution-contract.js';
import {DIRECTORY_FACT_ENVIRONMENT,DIRECTORY_FACT_ACCOUNT,DIRECTORY_FACT_GATE,DIRECTORY_FACT_DATASET} from './directory-execution-contract.js';
import {requireThat} from './contracts.js';
import {WEATHER_FACT_ENVIRONMENT,WEATHER_FACT_ACCOUNT,WEATHER_FACT_GATE,WEATHER_FACT_DATASETS} from './weather-execution-contract.js';
export const TRANSIT_FACT_ENVIRONMENT='canonical-transit-fact';
export const TRANSIT_FACT_ACCOUNT='1a64a0a081ea758f72be8254030bdf11';
export const TRANSIT_FACT_GATE='TRANSIT_FACT_ONLY_V1';
export function executionEnvironment(env){
 if(['local-test','isolated-test'].includes(env.ENVIRONMENT_ID))return;
 requireThat(env.ENVIRONMENT_ID===TRANSIT_FACT_ENVIRONMENT&&env.ACCOUNT_ID===TRANSIT_FACT_ACCOUNT&&env.CANONICAL_TRANSIT_GATE===TRANSIT_FACT_GATE||env.ENVIRONMENT_ID===WEATHER_FACT_ENVIRONMENT&&env.ACCOUNT_ID===WEATHER_FACT_ACCOUNT&&env.CANONICAL_WEATHER_GATE===WEATHER_FACT_GATE||env.ENVIRONMENT_ID===AIRPORT_FACT_ENVIRONMENT&&env.ACCOUNT_ID===AIRPORT_FACT_ACCOUNT&&env.CANONICAL_AIRPORT_GATE===AIRPORT_FACT_GATE||env.ENVIRONMENT_ID===DIRECTORY_FACT_ENVIRONMENT&&env.ACCOUNT_ID===DIRECTORY_FACT_ACCOUNT&&env.CANONICAL_DIRECTORY_GATE===DIRECTORY_FACT_GATE,'PRODUCTION_GATE_CLOSED',503);
}
export function executionDataset(env,trust){
 executionEnvironment(env);
 if(env.ENVIRONMENT_ID===AIRPORT_FACT_ENVIRONMENT){
  requireThat(trust.environment_id===AIRPORT_FACT_ENVIRONMENT&&trust.account_id===AIRPORT_FACT_ACCOUNT&&trust.dataset_id===AIRPORT_FACT_DATASET&&/^[a-f0-9]{64}$/.test(trust.semantic_profile_hash??'')&&Array.isArray(trust.approved_positive_decision_types)&&trust.approved_positive_decision_types.length===0,'AIRPORT_FACT_EXECUTION_SCOPE_DENIED',503);return;
 }
 if(env.ENVIRONMENT_ID===DIRECTORY_FACT_ENVIRONMENT){
  requireThat(trust.environment_id===DIRECTORY_FACT_ENVIRONMENT&&trust.account_id===DIRECTORY_FACT_ACCOUNT&&trust.dataset_id===DIRECTORY_FACT_DATASET&&/^[a-f0-9]{64}$/.test(trust.semantic_profile_hash??'')&&Array.isArray(trust.approved_positive_decision_types)&&trust.approved_positive_decision_types.length===0,'DIRECTORY_FACT_EXECUTION_SCOPE_DENIED',503);return;
 }
 if(env.ENVIRONMENT_ID===WEATHER_FACT_ENVIRONMENT){
  requireThat(trust.environment_id===WEATHER_FACT_ENVIRONMENT&&trust.account_id===WEATHER_FACT_ACCOUNT&&WEATHER_FACT_DATASETS.includes(trust.dataset_id)&&/^[a-f0-9]{64}$/.test(trust.semantic_profile_hash??'')&&Array.isArray(trust.approved_positive_decision_types)&&trust.approved_positive_decision_types.length===0,'WEATHER_FACT_EXECUTION_SCOPE_DENIED',503);
  return;
 }
 if(env.ENVIRONMENT_ID!==TRANSIT_FACT_ENVIRONMENT)return;
 requireThat(trust.environment_id===TRANSIT_FACT_ENVIRONMENT&&trust.account_id===TRANSIT_FACT_ACCOUNT&&trust.dataset_id==='transit.bridge.phu-quoc'&&/^[a-f0-9]{64}$/.test(trust.semantic_profile_hash??'')&&Array.isArray(trust.approved_positive_decision_types)&&trust.approved_positive_decision_types.length===0,'TRANSIT_FACT_EXECUTION_SCOPE_DENIED',503);
}
