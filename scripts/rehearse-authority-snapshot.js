import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {setup} from '../tests/support.js';
const root=process.argv[2]||'.authority-snapshot';
await mkdir(root,{recursive:true});
const s=await setup();
try{
 s.principals.find(x=>x.id==='operator').permissions.push('recovery-export');await s.mf.setOptions(s.options());
 const p=await s.call('prepare',s.make());assert.equal(p.status,200);
 assert.equal((await s.commit(p.body,'recovery-proof-commit')).status,200);
 assert.equal((await s.call('control',{command_id:'recovery-proof-freeze',action:'FREEZE',frozen:true,reason:'isolated signed native snapshot proof',expected_control_revision:0,expires_at:new Date(Date.now()+60000).toISOString()},'test-only-operator')).status,200);
 const snapshot=await s.call('recovery-export',{},'test-only-operator');assert.equal(snapshot.status,200,JSON.stringify(snapshot.body));
 await writeFile(root+'/SNAPSHOT.json',JSON.stringify(snapshot.body,null,2)+'\n');
 // Trust is a separate input from the native fixture, never accepted from the snapshot itself.
 await writeFile(root+'/TRUST.json',JSON.stringify(s.trust,null,2)+'\n');
}finally{await s.mf.dispose();}
// The native source is disposed before a fresh process reopens downloaded bytes.
const result=spawnSync(process.execPath,['scripts/verify-authority-snapshot.js',root+'/SNAPSHOT.json',root+'/TRUST.json',root+'/VERIFICATION.json'],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);console.log(result.stdout);
