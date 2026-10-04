import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {ACCOUNT,api,mintVerifiedReadCapability} from './transit-r2-capability.js';
import {requireThat,hash,sameLocator} from '../../src/platform/contracts.js';
import {verifyAttestation} from '../../src/platform/receipts.js';
import {S3ReadonlyReader} from '../../src/platform/s3-reader.js';
import {readTransitConsumer,TRANSIT_CANONICAL_ORIGIN} from '../../src/platform/transit-consumer.js';
const worker='openpq-intelligence-transit-runtime',proof={status:'RUNNING',started_at:new Date().toISOString(),account_id:ACCOUNT,worker};
await mkdir('.transit-renew-proof',{recursive:true});
try{
 requireThat(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()===ACCOUNT,'TRANSIT_RENEW_ACCOUNT_DENIED');
 const trust=JSON.parse(await readFile(process.env.TRANSIT_TRUST_PATH,'utf8'));
 const settings=await api('/accounts/'+ACCOUNT+'/workers/scripts/'+worker+'/settings');
 requireThat(settings.bindings.some(x=>x.type==='service'&&x.name==='CORE_READ'&&x.service==='openpq-intelligence-transit-core')&&!settings.bindings.some(x=>['r2_bucket','durable_object_namespace'].includes(x.type)),'TRANSIT_RENEW_RUNTIME_BINDINGS_DENIED');
 const before=await readTransitConsumer({mode:'CANONICAL',origin:TRANSIT_CANONICAL_ORIGIN,trust});
 const config=await mintVerifiedReadCapability(proof),reader=new S3ReadonlyReader(config);
 const view=await (await fetch(TRANSIT_CANONICAL_ORIGIN+'/datasets/'+trust.dataset_id,{redirect:'manual',signal:AbortSignal.timeout(15000)})).json();
 const signed=await reader.get('checkpoints/'+trust.authority_instance_id+'/'+trust.recovery_generation+'/receipts/'+view.receipt.revision+'.json');
 requireThat(signed,'TRANSIT_RENEW_SIGNED_RECEIPT_REQUIRED');
 const receipt=await verifyAttestation(JSON.parse(signed),trust),raw=await reader.get(receipt.key);
 requireThat(sameLocator(receipt,trust)&&receipt.digest===view.receipt.digest&&await hash(raw)===receipt.digest,'TRANSIT_RENEW_GENERATION_DENIED');
 await writeFile('.transit-transfer/renew.private.json',JSON.stringify({S3_READONLY_CONFIG:JSON.stringify(config)}),{mode:0o600});
 const r=spawnSync('node_modules/.bin/wrangler',['secret','bulk','.transit-transfer/renew.private.json','--config','.transit-transfer/runtime.json'],{encoding:'utf8',timeout:90000,env:{...process.env,CLOUDFLARE_API_TOKEN:process.env.CLOUDFLARE_API_TOKEN.trim(),CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false'}});
 requireThat(r.status===0,'TRANSIT_RENEW_SECRET_UPDATE_FAILED');
 let after;for(let i=0;i<12;i++){try{after=await readTransitConsumer({mode:'CANONICAL',origin:TRANSIT_CANONICAL_ORIGIN,trust});break;}catch{await new Promise(r=>setTimeout(r,2000));}}
 requireThat(after&&after.revision>=before.revision,'TRANSIT_RENEW_READBACK_FAILED');
 proof.status='READ_CAPABILITY_RENEWED_VERIFIED';proof.before_revision=before.revision;proof.after_revision=after.revision;
}catch(e){proof.status='READ_CAPABILITY_RENEWAL_FAILED';proof.error=e.code??'TRANSIT_RENEW_FAILED';process.exitCode=1;}
proof.finished_at=new Date().toISOString();await writeFile('.transit-renew-proof/PROOF.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:proof.status,error:proof.error??null,expires_at:proof.read_capability?.expires_at}));
