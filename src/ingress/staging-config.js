import {instant,requireThat} from '../platform/contracts.js';
export const STAGING_WORKER='openpq-intelligence-staging-isolated-test';
export const STAGING_BUCKET='openpq-intelligence-canonical-isolated-test';
export function stagingConfig(account,sourceSha,expiresAt){
  requireThat(/^[a-f0-9]{32}$/.test(account)&&/^[a-f0-9]{40}$/.test(sourceSha),'STAGING_CONFIG_IDENTITIES_REQUIRED');
  return {account_id:account,name:STAGING_WORKER,main:'../src/workers/staging.js',compatibility_date:'2026-07-30',workers_dev:true,routes:[],vars:{ENVIRONMENT_ID:'isolated-test',STAGING_BUCKET,SOURCE_COMMIT_SHA:sourceSha,STAGING_TOKEN_EXPIRES_AT:expiresAt},r2_buckets:[{binding:'STAGING',bucket_name:STAGING_BUCKET}]};
}
export function assertStagingConfig(config,account,productionIds){
  requireThat(Array.isArray(productionIds)&&productionIds.length>0&&!productionIds.includes(account),'STAGING_PRODUCTION_ACCOUNT_FORBIDDEN');
  requireThat(config.account_id===account&&/^[a-f0-9]{32}$/.test(account),'STAGING_ACCOUNT_MISMATCH');
  requireThat(config.name===STAGING_WORKER&&config.main==='../src/workers/staging.js'&&config.workers_dev===true,'STAGING_WORKER_CONFIG_INVALID');
  requireThat(config.vars?.ENVIRONMENT_ID==='isolated-test'&&config.vars?.STAGING_BUCKET===STAGING_BUCKET&&/^[a-f0-9]{40}$/.test(config.vars?.SOURCE_COMMIT_SHA),'STAGING_VARS_INVALID');
  instant(config.vars.STAGING_TOKEN_EXPIRES_AT,'STAGING_TOKEN_EXPIRES');
  requireThat(Object.keys(config.vars).every(key=>['ENVIRONMENT_ID','STAGING_BUCKET','SOURCE_COMMIT_SHA','STAGING_TOKEN_EXPIRES_AT'].includes(key)),'STAGING_UNEXPECTED_VAR');
  requireThat((config.routes||[]).length===0&&(config.triggers?.crons||[]).length===0,'STAGING_ROUTE_OR_CRON_FORBIDDEN');
  requireThat(!config.env&&!config.services&&!config.durable_objects&&!config.d1_databases&&!config.kv_namespaces&&!config.assets&&!config.queues&&!config.workflows,'STAGING_BINDING_FORBIDDEN');
  requireThat(config.r2_buckets?.length===1&&config.r2_buckets[0].binding==='STAGING'&&config.r2_buckets[0].bucket_name===STAGING_BUCKET&&!config.r2_buckets[0].preview_bucket_name&&!config.r2_buckets[0].jurisdiction,'STAGING_BUCKET_BINDING_FORBIDDEN');
  return config;
}
