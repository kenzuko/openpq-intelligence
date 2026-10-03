import {readFile,writeFile} from 'node:fs/promises';
import {verifyAuthoritySnapshot} from '../src/platform/authority-snapshot.js';
const [snapshotPath,trustPath,resultPath]=process.argv.slice(2);
if(!snapshotPath||!trustPath)throw new Error('Usage: node scripts/verify-authority-snapshot.js SNAPSHOT TRUST [RESULT]');
const checked=await verifyAuthoritySnapshot(JSON.parse(await readFile(snapshotPath,'utf8')),JSON.parse(await readFile(trustPath,'utf8')));
const result={...checked.verification,watermark:checked.manifest.watermark,table_counts:checked.manifest.table_counts,coverage:checked.manifest.coverage};
if(resultPath)await writeFile(resultPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
