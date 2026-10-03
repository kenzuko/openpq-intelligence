import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import path from 'node:path';
import {ContractError,stable} from '../platform/contracts.js';
import {CANO_IMPORT_MAX_MANIFEST_BYTES,CANO_IMPORT_MAX_RAW_BYTES,preflightCanoImportManifest,runCanoImportPipeline} from './manual-cano-import-pipeline.js';

function fail(code){throw new ContractError(code);}
function safeRelative(value){
  if(typeof value!=='string'||value.length<1||value.length>512||value.includes('\0')||value.includes('\\')||path.isAbsolute(value)||/^[A-Za-z]:\//.test(value))return false;
  const parts=value.split('/');
  return parts.every(part=>part.length>0&&part!=='.'&&part!=='..');
}
function inside(root,candidate){return candidate===root||candidate.startsWith(root+path.sep);}
async function digestBytes(bytes){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function resolveContainedFile(rootReal,relative,{missingCode='CANO_IMPORT_RAW_FILE_MISSING'}={}){
  if(!safeRelative(relative))fail('CANO_IMPORT_RAW_PATH_INVALID');
  const syntactic=path.resolve(rootReal,...relative.split('/'));
  if(!inside(rootReal,syntactic))fail('CANO_IMPORT_RAW_PATH_ESCAPE');
  try{await lstat(syntactic);}catch(error){if(error?.code==='ENOENT')fail(missingCode);throw error;}
  let resolved;
  try{resolved=await realpath(syntactic);}catch(error){if(error?.code==='ENOENT')fail(missingCode);throw error;}
  if(!inside(rootReal,resolved))fail('CANO_IMPORT_RAW_SYMLINK_ESCAPE');
  return resolved;
}
async function readBoundedRegularFile(filename,maxBytes,{tooLargeCode,notRegularCode}){
  // Offline input root must be a stable snapshot; this is not a concurrent filesystem sandbox.
  const before=await lstat(filename);
  if(!before.isFile())fail(notRegularCode);
  if(before.size>maxBytes)fail(tooLargeCode);
  const handle=await open(filename,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
  try{
    const stat=await handle.stat();
    if(!stat.isFile())fail(notRegularCode);
    if(stat.dev!==before.dev||stat.ino!==before.ino)fail('CANO_IMPORT_FILE_CHANGED');
    if(stat.size>maxBytes)fail(tooLargeCode);
    const buffer=Buffer.alloc(maxBytes+1);let length=0;
    while(length<buffer.length){
      const {bytesRead}=await handle.read(buffer,length,buffer.length-length,null);
      if(bytesRead===0)break;
      length+=bytesRead;
    }
    if(length>maxBytes)fail(tooLargeCode);
    return buffer.subarray(0,length);
  }finally{await handle.close();}
}
function codeOf(error,fallback){return typeof error?.code==='string'?error.code:fallback;}

export async function loadCanoImportFromLocalFiles({input_root,manifest_file}){
  if(typeof input_root!=='string'||input_root.length===0)fail('CANO_IMPORT_ROOT_REQUIRED');
  const rootReal=await realpath(input_root);
  const manifestPath=await resolveContainedFile(rootReal,manifest_file,{missingCode:'CANO_IMPORT_MANIFEST_FILE_MISSING'});
  const manifestBytes=await readBoundedRegularFile(manifestPath,CANO_IMPORT_MAX_MANIFEST_BYTES,{tooLargeCode:'CANO_IMPORT_MANIFEST_PAYLOAD_TOO_LARGE',notRegularCode:'CANO_IMPORT_MANIFEST_NOT_REGULAR_FILE'});
  if(manifestBytes.byteLength>CANO_IMPORT_MAX_MANIFEST_BYTES)fail('CANO_IMPORT_MANIFEST_PAYLOAD_TOO_LARGE');
  let manifestText;
  try{manifestText=new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes);}catch{fail('CANO_IMPORT_MANIFEST_UTF8_INVALID');}
  let manifest;
  try{manifest=JSON.parse(manifestText);}catch{fail('CANO_IMPORT_MANIFEST_JSON_INVALID');}
  const manifest_payload_sha256=await digestBytes(manifestBytes);
  let preflight;
  try{preflight=await preflightCanoImportManifest(manifest);}
  catch{return runCanoImportPipeline({manifest,manifest_payload_sha256,loaded_records:[]});}
  if(!preflight.ok){
    return runCanoImportPipeline({manifest:preflight.manifest,manifest_payload_sha256,loaded_records:[]});
  }
  const loaded_records=[];
  for(let index=0;index<preflight.manifest.records.length;index++){
    const record=preflight.manifest.records[index];
    try{
      const resolved=await resolveContainedFile(rootReal,record.raw_file);
      const bytes=await readBoundedRegularFile(resolved,CANO_IMPORT_MAX_RAW_BYTES,{tooLargeCode:'CANO_IMPORT_RAW_PAYLOAD_TOO_LARGE',notRegularCode:'CANO_IMPORT_RAW_NOT_REGULAR_FILE'});
      loaded_records.push({index,raw_file:record.raw_file,bytes:new Uint8Array(bytes)});
    }catch(error){
      loaded_records.push({index,raw_file:record.raw_file,bytes:null,load_error:codeOf(error,'CANO_IMPORT_LOCAL_IO_ERROR')});
    }
  }
  return runCanoImportPipeline({manifest:preflight.manifest,manifest_payload_sha256,loaded_records});
}

export function canonicalAuditJson(report){return stable(report)+'\n';}
