import {readFile} from 'node:fs/promises';
import {reviewCoreRelease} from '../src/preparation/core-release-review.js';
try{if(process.argv.length!==3)throw Error('One input file required');console.log(JSON.stringify(await reviewCoreRelease(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2));}
catch(e){console.error(e.code||e.message);process.exitCode=1;}
