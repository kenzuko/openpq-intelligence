import {writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {prepareCloud} from './prepare.js';

// Offline bundle proof. These synthetic IDs are never sent to Cloudflare.
await prepareCloud({status:'PREFLIGHT_PASS',account_id:'a'.repeat(32)},'offline-bundle-fixture');
const env={...process.env,CLOUDFLARE_API_TOKEN:'',CLOUDFLARE_API_KEY:'',CLOUDFLARE_EMAIL:'',CLOUDFLARE_ACCOUNT_ID:'',WRANGLER_SEND_METRICS:'false'};
const check=kind=>{
  const result=spawnSync('node_modules/.bin/wrangler',['deploy','--dry-run','--config',`.cloud-proof/${kind==='core-final'?'core':kind}.json`,'--outdir',`.cloud-proof/build-${kind}`],{env,encoding:'utf8'});
  if(result.status!==0){console.error(result.stderr||'Bundle dry-run failed');process.exit(1);}
  console.log('PASS: offline '+kind+' Worker bundle');
};
check('core');const core=JSON.parse(await readFile('.cloud-proof/core.json','utf8'));core.main='../src/workers/core.js';await writeFile('.cloud-proof/core.json',JSON.stringify(core));check('core-final');check('runtime');check('operator');
