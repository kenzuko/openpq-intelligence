import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import path from 'node:path';
import {ContractError} from '../platform/contracts.js';
import {auditRealCanoShadow,sha256Bytes,safeIntakePath,validateRealCanoManifest} from './cano-real-shadow.js';
const fail=code=>{throw new ContractError(code);};
async function readSnapshotFile(root,relative,limit){
 if(!safeIntakePath(relative))fail('REAL_CANO_LOCAL_PATH_INVALID');
 let target=root;
 for(const part of relative.split('/')){
  target=path.join(target,part);let stat;try{stat=await lstat(target);}catch(e){if(e.code==='ENOENT')fail('REAL_CANO_LOCAL_FILE_MISSING');throw e;}
  if(stat.isSymbolicLink())fail('REAL_CANO_LOCAL_SYMLINK_DENIED');
 }
 const before=await lstat(target);if(!before.isFile())fail('REAL_CANO_LOCAL_NOT_REGULAR');if(before.size>limit)fail('REAL_CANO_LOCAL_LIMIT');
 const handle=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{
  const first=await handle.stat();if(!first.isFile()||first.dev!==before.dev||first.ino!==before.ino)fail('REAL_CANO_LOCAL_FILE_CHANGED');
  const buffer=Buffer.alloc(limit+1);let length=0;
  while(length<buffer.length){const r=await handle.read(buffer,length,buffer.length-length,null);if(!r.bytesRead)break;length+=r.bytesRead;}
  if(length>limit)fail('REAL_CANO_LOCAL_LIMIT');
  const after=await handle.stat();if(after.size!==first.size||after.mtimeMs!==first.mtimeMs||after.ctimeMs!==first.ctimeMs)fail('REAL_CANO_LOCAL_FILE_CHANGED');
  return new Uint8Array(buffer.subarray(0,length));
 }finally{await handle.close();}
}
// Input must remain a stable snapshot; this is not an adversarial concurrent-filesystem sandbox.
export async function loadRealCanoShadow({input_root,manifest_file,expected_manifest_sha256}){
 const stat=await lstat(input_root);if(!stat.isDirectory()||stat.isSymbolicLink())fail('REAL_CANO_LOCAL_ROOT_INVALID');
 const root=await realpath(input_root),bytes=await readSnapshotFile(root,manifest_file,131072);
 const actual=await sha256Bytes(bytes);if(actual!==expected_manifest_sha256)fail('REAL_CANO_MANIFEST_PIN_MISMATCH');
 let manifest;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('REAL_CANO_LOCAL_MANIFEST_INVALID');}
 validateRealCanoManifest(manifest);
 const loaded_records=[];
 for(let index=0;index<manifest.records.length;index++){
  try{loaded_records.push({index,bytes:await readSnapshotFile(root,manifest.records[index].raw_file,8192)});}
  catch(e){loaded_records.push({index,load_error:e.code||'REAL_CANO_LOCAL_IO_ERROR'});}
 }
 return auditRealCanoShadow({manifest,loaded_records,manifest_payload_sha256:actual,expected_manifest_sha256});
}
