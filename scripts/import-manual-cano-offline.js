#!/usr/bin/env node
import {canonicalAuditJson,loadCanoImportFromLocalFiles} from '../src/ingress/manual-cano-local-files.js';
import {stable} from '../src/platform/contracts.js';

const [input_root,manifest_file]=process.argv.slice(2);
function fatal(code){
  const payload={contract_version:'openpq-cano-offline-cli-error-v1',fixture_only:true,mode:'FIXTURE_ONLY',status:'INVALID',reason_codes:[code],action_eligible:false,publication_admitted:false};
  process.stdout.write(stable(payload)+'\n');
  process.stderr.write(code+'\n');
  process.exitCode=2;
}

if(!input_root||!manifest_file){
  fatal('CANO_IMPORT_CLI_ARGS_REQUIRED');
}else{
  try{
    const report=await loadCanoImportFromLocalFiles({input_root,manifest_file});
    process.stdout.write(canonicalAuditJson(report));
    if(report.aggregate_result?.status!=='VALID')process.exitCode=1;
  }catch(error){
    fatal(typeof error?.code==='string'?error.code:'CANO_IMPORT_LOCAL_IO_ERROR');
  }
}
