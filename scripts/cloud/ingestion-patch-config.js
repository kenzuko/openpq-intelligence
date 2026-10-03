import {writeFile} from 'node:fs/promises';
import {ISOLATED_ACCOUNT_ID} from '../../src/platform/domain-bridge-admission.js';
import {requireThat} from '../../src/platform/contracts.js';
requireThat(process.env.CF_TEST_ACCOUNT_ID===ISOLATED_ACCOUNT_ID,'INGEST_ACCOUNT_PIN_REQUIRED');
const config={name:'openpq-intelligence-ingestion-isolated-test',account_id:ISOLATED_ACCOUNT_ID,main:'../src/workers/ingestion.js',compatibility_date:'2026-07-30',workers_dev:true,routes:[],vars:{ENVIRONMENT_ID:'isolated-test',ACCOUNT_ID:ISOLATED_ACCOUNT_ID,SOURCE_CODE_SHA:process.env.SOURCE_BASE_RELEASE_SHA||process.env.GITHUB_SHA,SOURCE_PATCH_SHA:process.env.SOURCE_BASE_RELEASE_SHA?process.env.GITHUB_SHA:''},services:[{binding:'CORE_COMMAND',service:'openpq-intelligence-core-isolated-test'}],durable_objects:{bindings:[{name:'SOURCE_PUMPS',class_name:'DatasetSourcePump'}]},migrations:[{tag:'source-pump-v1',new_sqlite_classes:['DatasetSourcePump']}],triggers:{crons:['*/4 * * * *']}};
await writeFile('.cloud-proof/ingestion-patch.json',JSON.stringify(config,null,2)+'\n');
