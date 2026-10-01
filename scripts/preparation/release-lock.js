import {readFile,writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {buildReleaseLock,checkReleaseLock} from '../../src/preparation/release-lock.js';import {requireThat} from '../../src/platform/contracts.js';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [mode,source,other,at,...extra]=process.argv.slice(2);requireThat(!extra.length&&['create','check'].includes(mode)&&source&&other,'RELEASE_CLI_ARGUMENTS_INVALID');
  const input=JSON.parse(await readFile(source,'utf8'));
  if(mode==='create'){requireThat(at===undefined,'RELEASE_CLI_ARGUMENTS_INVALID');const lock=await buildReleaseLock(input);await writeFile(other,JSON.stringify(lock,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({status:'RELEASE_LOCK_SAVED',lock_hash:lock.lock_hash,execution_allowed:false,deployments_stopped_proven:false}));}
  else{requireThat(at,'RELEASE_CLI_EVALUATION_REQUIRED');const report=await checkReleaseLock(input,JSON.parse(await readFile(other,'utf8')),at);console.log(JSON.stringify(report,null,2));if(report.blocked.length)process.exitCode=2;}
 }catch(e){console.error(e.code||'RELEASE_CLI_FAILED');process.exitCode=1;}
}
