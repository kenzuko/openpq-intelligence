#!/usr/bin/env node
import {mkdir,mkdtemp,readdir,readFile,writeFile,rename,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildCanoShadowFromRaw} from '../src/ingress/manual-cano-semantic.js';
import {wrapCanoRevision,reduceCanoLedger} from '../src/ingress/manual-cano-lineage.js';
import {runCanoImportPipeline} from '../src/ingress/manual-cano-import-pipeline.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.resolve(process.argv[2]||path.join(root,'../readiness-evidence'));
let temporary,created=false;
const report={contract_version:'openpq-cano-offline-readiness-v1',fixture_only:true,scope:'CANO_OFFLINE_SYNTHETIC_ONLY',status:'RUNNING',node_version:process.version,commands:[],schema:{status:'NOT_RUN'},full_miniflare_suite:'NOT_RUN_NOT_REQUESTED',production_ready:false,real_data_admission:false,action_eligible:false,publication_admitted:false};
async function execute(name,args,expected=0,executable=process.execPath){
 const r=spawnSync(executable,args,{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
 report.commands.push({name,executable:executable===process.execPath?'node':executable,args,expected_exit:expected,exit_code:r.status,error:r.error?.code??null,stdout_log:name+'.stdout',stderr_log:name+'.stderr'});
 await writeFile(path.join(output,name+'.stdout'),r.stdout||'');await writeFile(path.join(output,name+'.stderr'),r.stderr||'');
 if(r.status!==expected||r.error)throw new Error(name+'_FAILED');return r.stdout;
}
try{
 await mkdir(output,{recursive:false});created=true;
 const tests=await execute('selected-tests',['--test','--test-reporter=tap','tests/manual-cano-evidence-bundle.test.js','tests/manual-cano-import-pipeline.test.js','tests/manual-cano-semantic.test.js','tests/contracts.test.js','tests/semantic.test.js','tests/semantic-corpus.test.js']);
 const count=label=>Number(tests.match(new RegExp('^# '+label+' (\\d+)$','m'))?.[1]);report.tests={total:count('tests'),passed:count('pass'),failed:count('fail')};
 if(report.tests.total!==68||report.tests.passed!==68||report.tests.failed!==0)throw new Error('TEST_COUNTS_UNEXPECTED');
 const replay=JSON.parse(await execute('replay',['scripts/replay-manual-cano-offline.js']));report.replay={vectors:replay.corpus_vector_count,passed:replay.pass_count,failed:replay.fail_count};
 if(replay.pass_count!==33||replay.corpus_vector_count!==33||replay.fail_count!==0||replay.action_eligible!==false||replay.publication_admitted!==false)throw new Error('REPLAY_FAILED');
 await execute('boundaries',['scripts/check-boundaries.js']);
 temporary=await mkdtemp(path.join(tmpdir(),'openpq-ready-'));const initial=path.join(temporary,'initial'),relocated=path.join(temporary,'relocated'),invalid=path.join(temporary,'invalid');
 const fixtures='fixtures/manual-cano-import',pin='fixtures/manual-cano-evidence/TRUSTED_BASELINE_PIN.json';
 await execute('build',['scripts/build-manual-cano-evidence-bundle.js',fixtures,'manifest.correction.json',initial]);await rename(initial,relocated);
 const verified=JSON.parse(await execute('verify-relocated',['scripts/verify-manual-cano-evidence-bundle.js',relocated,pin]));
 if(verified.verification_status!=='VERIFIED_FIXTURE_ONLY'||!verified.baseline_match||!verified.audit_match||verified.action_eligible!==false||verified.publication_admitted!==false)throw new Error('VERIFY_FAILED');
 await execute('diagnostic-build',['scripts/build-manual-cano-evidence-bundle.js',fixtures,'manifest.missing-file.json',invalid],1);
 const diagnostic=JSON.parse(await execute('diagnostic-verify',['scripts/verify-manual-cano-evidence-bundle.js',invalid,pin],1));
 if(diagnostic.verification_status!=='DIAGNOSTIC_INVALID_BATCH')throw new Error('PARTIAL_FAILURE_PROMOTED');
 const wrong=path.join(temporary,'wrong-pin.json');await writeFile(wrong,JSON.stringify({contract_version:'openpq-cano-offline-baseline-pin-v1',baseline_source_sha256:'0'.repeat(64)}));
 const mismatch=JSON.parse(await execute('baseline-mismatch',['scripts/verify-manual-cano-evidence-bundle.js',relocated,wrong],2));
 if(mismatch.verification_status!=='BASELINE_MISMATCH')throw new Error('BASELINE_MISMATCH_NOT_ENFORCED');
 await cp(relocated,path.join(output,'sample-bundle'),{recursive:true});await cp(path.join(root,pin),path.join(output,'TRUSTED_FIXTURE_BASELINE_PIN.json'));
 const manifest=JSON.parse(await readFile(path.join(root,fixtures,'manifest.happy.json'),'utf8'));
 const many=structuredClone(manifest);many.records=Array.from({length:65},()=>structuredClone(manifest.records[0]));
 const malformed=structuredClone(manifest);malformed.records[0].supersedes={invalid:true};malformed.records[0].provenance.payload_sha256='invalid';
 const samples=[{schema:'openpq-cano-offline-audit-v1.schema.json',value:await runCanoImportPipeline({manifest:many})},{schema:'openpq-cano-offline-audit-v1.schema.json',value:await runCanoImportPipeline({manifest:malformed})}];
 for(const [file,schema] of [['audit/audit.json','audit'],['BUNDLE.json','evidence-bundle'],['INVENTORY.json','evidence-inventory'],['BASELINE_SOURCE.json','baseline-source']])samples.push({schema:'openpq-cano-offline-'+schema+'-v1.schema.json',value:JSON.parse(await readFile(path.join(relocated,file),'utf8'))});
 for(const value of [verified,diagnostic,mismatch])samples.push({schema:'openpq-cano-offline-evidence-verification-v1.schema.json',value});
 const shadow=await buildCanoShadowFromRaw(await readFile(path.join(root,fixtures,manifest.records[0].raw_file),'utf8'),manifest.records[0].provenance);
 const wrapper=await wrapCanoRevision(shadow);
 const ledger=await reduceCanoLedger({wrappers:[wrapper],target:manifest.target,evaluation_time:manifest.evaluation_time});
 const rejection=await reduceCanoLedger({wrappers:[],target:null,evaluation_time:manifest.evaluation_time});
 const cliError=JSON.parse(await execute('cli-error',['scripts/import-manual-cano-offline.js'],2));
 samples.push(
  {schema:'openpq-cano-manual-shadow-v1.schema.json',value:shadow},
  {schema:'openpq-cano-revision-wrapper-v1.schema.json',value:wrapper},
  {schema:'openpq-cano-ledger-result-v1.schema.json',value:ledger},
  {schema:'openpq-cano-preflight-rejection-v1.schema.json',value:rejection},
  {schema:'openpq-cano-offline-cli-error-v1.schema.json',value:cliError},
  {schema:'openpq-cano-offline-import-manifest-v1.schema.json',value:manifest},
  {schema:'openpq-cano-offline-baseline-pin-v1.schema.json',value:JSON.parse(await readFile(path.join(root,pin),'utf8'))}
 );
 const positiveSchemas=new Map(samples.map(sample=>[sample.schema,sample]));
 for(const [schema,sample] of positiveSchemas){
  const missing=structuredClone(sample.value);delete missing.contract_version;
  samples.push({schema,value:missing,expect_valid:false,case:'missing-contract-version'});
  if(Object.hasOwn(sample.value,'fixture_only')){const unsafe=structuredClone(sample.value);unsafe.fixture_only=false;samples.push({schema,value:unsafe,expect_valid:false,case:'fixture-fence'});}
 }
 const samplePath=path.join(output,'SCHEMA_SAMPLES.json');await writeFile(samplePath,JSON.stringify(samples,null,2)+'\n');
 const check=spawnSync('python3',['scripts/check-cano-offline-schemas.py','schemas',samplePath],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
 report.commands.push({name:'schema',executable:'python3',args:['scripts/check-cano-offline-schemas.py','schemas',samplePath],exit_code:check.status,error:check.error?.code??null,stdout_log:'schema.stdout',stderr_log:'schema.stderr'});
 await writeFile(path.join(output,'schema.stdout'),check.stdout||'');await writeFile(path.join(output,'schema.stderr'),check.stderr||'');
 if(check.status===3||check.error?.code==='ENOENT')report.schema={status:'NOT_RUN_VALIDATOR_UNAVAILABLE'};
 else if(check.status!==0||check.error)throw new Error('SCHEMA_CHECK_FAILED');else report.schema=JSON.parse(check.stdout);
 if(process.argv.includes('--full')){
  if(report.schema.status!=='PASS')throw new Error('FULL_READINESS_REQUIRES_SCHEMA_VALIDATOR');
  const full=await execute('full-suite',['--test','--test-reporter=tap',...(await readdir(path.join(root,'tests'))).filter(name=>name.endsWith('.test.js')).sort().map(name=>'tests/'+name)]);
  const fullCount=label=>Number(full.match(new RegExp('^# '+label+' (\\d+)$','m'))?.[1]);
  report.full_suite_tests={total:fullCount('tests'),passed:fullCount('pass'),failed:fullCount('fail')};
  if(!report.full_suite_tests.total||report.full_suite_tests.failed!==0||report.full_suite_tests.total!==report.full_suite_tests.passed)throw new Error('FULL_SUITE_COUNTS_UNEXPECTED');
  report.full_miniflare_suite='PASS';
 }
 report.baseline_source_sha256=verified.expected_baseline_source_sha256;
 report.status='PASS_OFFLINE_WITH_DECLARED_GAPS';
}catch(e){report.status='FAILED';report.error=e.code||e.message;}
finally{
 if(temporary){try{await rm(temporary,{recursive:true,force:true});report.temporary_cleaned=true;}catch(e){report.status='FAILED';report.cleanup_error=e.code||e.message;}}
 if(created)await writeFile(path.join(output,'READINESS_REPORT.json'),JSON.stringify(report,null,2)+'\n');
 process.stdout.write(JSON.stringify(report,null,2)+'\n');if(report.status==='FAILED')process.exitCode=1;
}
