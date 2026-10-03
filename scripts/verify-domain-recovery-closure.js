import {readFile,writeFile} from 'node:fs/promises';
import {verifyDomainRecoveryClosure} from '../src/platform/domain-recovery-closure.js';
const [bundleFile,trustFile,evaluationTime,resultFile]=process.argv.slice(2);
if(!bundleFile||!trustFile||!evaluationTime)throw new Error('usage: BUNDLE INDEPENDENT_TRUST EVALUATION_TIME [RESULT]');
const result=await verifyDomainRecoveryClosure(JSON.parse(await readFile(bundleFile,'utf8')),JSON.parse(await readFile(trustFile,'utf8')),evaluationTime);
const {legacy_payload,projection,field_serving,...summary}=result;
if(resultFile)await writeFile(resultFile,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
