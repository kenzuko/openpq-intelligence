import {mkdir,writeFile} from 'node:fs/promises';
import {TRANSIT_FACT_ENVIRONMENT,TRANSIT_FACT_ACCOUNT,TRANSIT_FACT_GATE} from '../src/platform/transit-execution-scope.js';
// Offline configuration only. No provisioning, source fetch, secret creation or deployment.
const root='.transit-transfer',common={account_id:TRANSIT_FACT_ACCOUNT,compatibility_date:'2026-07-30',workers_dev:true,routes:[]};
const vars={ENVIRONMENT_ID:TRANSIT_FACT_ENVIRONMENT,ACCOUNT_ID:TRANSIT_FACT_ACCOUNT,CANONICAL_TRANSIT_GATE:TRANSIT_FACT_GATE};
const names={core:'openpq-intelligence-transit-core',runtime:'openpq-intelligence-transit-runtime',source:'openpq-intelligence-transit-source',consumer:'openpq-intelligence-transit-reader'};
const configs={
 core:{...common,name:names.core,main:'../src/workers/core.js',vars,durable_objects:{bindings:[{name:'DATASETS',class_name:'DatasetCoordinator'}]},migrations:[{tag:'canonical-transit-v1',new_sqlite_classes:['DatasetCoordinator']}],r2_buckets:[{binding:'CANONICAL',bucket_name:'openpq-intelligence-canonical'}]},
 runtime:{...common,name:names.runtime,main:'../src/workers/runtime.js',vars,services:[{binding:'CORE_READ',service:names.core}]},
 source:{...common,name:names.source,main:'../src/workers/transit-ingestion.js',vars,durable_objects:{bindings:[{name:'SOURCE_PUMPS',class_name:'TransitSourcePump'}]},migrations:[{tag:'transit-source-v1',new_sqlite_classes:['TransitSourcePump']}],services:[{binding:'CORE_COMMAND',service:names.core}],triggers:{crons:[]}},
 consumer:{...common,compatibility_flags:['global_fetch_strictly_public'],name:names.consumer,main:'../src/workers/transit-consumer.js',vars:{TRANSIT_READER_MODE:'LEGACY'}}
};
await mkdir(root,{recursive:true});for(const [name,config] of Object.entries(configs))await writeFile(root+'/'+name+'.json',JSON.stringify(config,null,2)+'\n');
await writeFile(root+'/READINESS.json',JSON.stringify({scope:'transit-owner-report-facts-only',configs_prepared:true,public_reader_switched:false,canonical_active:false,whole_core_production_ready:false,source_cron_enabled:false,required_before_canonical_deploy:['current account-scoped R2 bucket inventory and exact bucket pin','bucket-scoped Object Read S3 credential and deny/positive probes','actual namespace/native ID and independently pinned public signing trust','new candidate committed before canonical reader switch','same-source field/byte parity and actual reader rollback'],legacy_consumer_deploy_requires_no_r2_permission:true},null,2)+'\n');
console.log('Prepared four scoped bundles; source cron and canonical consumer remain closed.');
