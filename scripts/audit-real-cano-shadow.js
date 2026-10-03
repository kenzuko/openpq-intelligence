#!/usr/bin/env node
import {loadRealCanoShadow} from '../src/ingress/cano-real-shadow-local.js';
const [input_root,manifest_file,expected_manifest_sha256]=process.argv.slice(2);
try{
 if(!input_root||!manifest_file||!/^[a-f0-9]{64}$/.test(expected_manifest_sha256??''))throw Object.assign(new Error(),{code:'REAL_CANO_CLI_ARGS_REQUIRED'});
 const result=await loadRealCanoShadow({input_root,manifest_file,expected_manifest_sha256});
 process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.status!=='CONTRACT_READY_SHADOW_BATCH')process.exitCode=1;
}catch(e){process.stdout.write(JSON.stringify({status:'REJECTED',reason_codes:[e.code??'REAL_CANO_LOCAL_IO_ERROR'],mode:'SHADOW_ONLY',real_data_admission:false,action_eligible:false,publication_admitted:false})+'\n');process.exitCode=2;}
