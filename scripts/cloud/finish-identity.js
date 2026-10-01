import {readFile,writeFile} from 'node:fs/promises';
import {requireThat} from '../../src/platform/contracts.js';
import {makeAuthority} from './prepare.js';
import {BUCKET,WORKERS} from './preflight.js';

try{
  const plan=JSON.parse(await readFile('.cloud-proof/plan.private.json','utf8'));
  const api=async path=>{
    const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+plan.account_id+path,{headers:{authorization:'Bearer '+process.env.CF_TEST_API_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});requireThat(r.ok,'PROVISION_API_DENIED');const b=await r.json();requireThat(b.success,'PROVISION_API_FAILED');return b.result;
  };
  const subdomain=await api('/workers/subdomain');requireThat(typeof subdomain.subdomain==='string'&&/^[a-z0-9-]+$/.test(subdomain.subdomain),'WORKERS_SUBDOMAIN_REQUIRED');
  const namespaces=await api('/workers/durable_objects/namespaces');const selected=namespaces.filter(n=>n.script===WORKERS[0]&&n.class==='DatasetCoordinator');requireThat(selected.length===1,'NAMESPACE_AMBIGUOUS');
  const origin='https://'+WORKERS[0]+'.'+subdomain.subdomain+'.workers.dev';
  const r=await fetch(origin+'/probe',{headers:{authorization:'Bearer '+plan.provisioning_token},redirect:'error',signal:AbortSignal.timeout(15000)});requireThat(r.ok,'NATIVE_PROBE_UNAVAILABLE');const probe=await r.json();
  requireThat(probe.dataset_id===plan.dataset_id&&probe.object_name===plan.object_name,'NATIVE_PROBE_SCOPE_MISMATCH');
  requireThat(process.env.R2_TEST_READ_ACCESS_KEY_ID&&process.env.R2_TEST_READ_SECRET_ACCESS_KEY,'R2_READ_CREDENTIAL_REQUIRED');
  const authority=await makeAuthority(plan,selected[0].id,probe.native_id,{endpoint:'https://'+plan.account_id+'.r2.cloudflarestorage.com',bucket:BUCKET,access_key:process.env.R2_TEST_READ_ACCESS_KEY_ID,secret:process.env.R2_TEST_READ_SECRET_ACCESS_KEY});
  for(const [name,value] of [['core-secrets',authority.coreSecrets],['runtime-secrets',authority.runtimeSecrets]])await writeFile(`.cloud-proof/${name}.json`,JSON.stringify(value),{mode:0o600});
  await writeFile('.cloud-proof/proof.private.json',JSON.stringify({trust:authority.trust,tokens:authority.tokens,origins:Object.fromEntries(WORKERS.map((name,i)=>[['core','runtime','operator'][i],'https://'+name+'.'+subdomain.subdomain+'.workers.dev']))}),{mode:0o600});
  await writeFile('.cloud-proof/locator.public.json',JSON.stringify(authority.trust,null,2)+'\n');
  const config=JSON.parse(await readFile('.cloud-proof/core.json','utf8'));config.main='../src/workers/core.js';delete config.vars.PROVISION_DATASET_ID;delete config.vars.PROVISION_OBJECT_NAME;await writeFile('.cloud-proof/core.json',JSON.stringify(config,null,2)+'\n');
  console.log('Pinned native namespace/object identity and generated scoped proof credentials. No authority state bootstrapped.');
}catch{console.error('FINISH_NATIVE_IDENTITY_FAILED');process.exitCode=1;}
