import {mkdir,writeFile,readFile,lstat,readdir,open} from 'node:fs/promises';
import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {hash,requireThat,stable} from '../../src/platform/contracts.js';
import {verifyBackupPublications} from '../../src/preparation/backup-authenticity.js';
const MAX_TOTAL=32*1024*1024;
async function regular(path,limit){const info=await lstat(path);requireThat(info.isFile()&&!info.isSymbolicLink()&&info.size<=limit,'PORTABLE_BACKUP_FILE_INVALID');return readFile(path,'utf8');}
async function durableFile(path,content){const fd=await open(path,'wx',0o600);try{await fd.writeFile(content);await fd.sync();}finally{await fd.close();}}
export async function savePortableBackup(bundle,trustedAuthority,directory){
 const verified=await verifyBackupPublications(bundle,trustedAuthority);let total=0;const objects=new Map();
 const {entries,...metadata}=bundle;const references=[];
 for(const entry of entries){const content=stable(entry.content);total+=Buffer.byteLength(content);requireThat(total<=MAX_TOTAL,'PORTABLE_BACKUP_TOO_LARGE');const name=entry.sha256+'.json';objects.set(name,content);const {content:ignored,...rest}=entry;references.push({...rest,object_file:name});}
 const index=stable({format:'openpq-portable-publication-backup-v1',metadata,references});requireThat(Buffer.byteLength(index)<=1048576,'PORTABLE_BACKUP_INDEX_TOO_LARGE');
 // Exclusive destination, COMPLETE marker last. A crashed/incomplete export is never a valid backup.
 await mkdir(directory,{mode:0o700});await mkdir(join(directory,'objects'),{mode:0o700});
 for(const [name,content] of objects)await durableFile(join(directory,'objects',name),content);
 const objectDir=await open(join(directory,'objects'),'r');try{await objectDir.sync();}finally{await objectDir.close();}
 await durableFile(join(directory,'index.json'),index);await durableFile(join(directory,'COMPLETE'),await hash(index)+'\n');
 const fd=await open(directory,'r');try{await fd.sync();}finally{await fd.close();}
 return {...verified,portable_filesystem_exported:true,object_count:objects.size,offsite_proven:false,control_authenticity_verified:false,audit_authenticity_verified:false,resume_writer:false};
}
export async function loadPortableBackup(directory,trustedAuthority){
 const folder=await lstat(directory);requireThat(folder.isDirectory()&&!folder.isSymbolicLink(),'PORTABLE_BACKUP_DIRECTORY_INVALID');
 const names=(await readdir(directory)).sort();requireThat(stable(names)===stable(['COMPLETE','index.json','objects']),'PORTABLE_BACKUP_LAYOUT_INVALID');
 const raw=await regular(join(directory,'index.json'),1048576),complete=await regular(join(directory,'COMPLETE'),65);requireThat(complete===await hash(raw)+'\n','PORTABLE_BACKUP_INCOMPLETE_OR_CORRUPT');
 const index=JSON.parse(raw);requireThat(index.format==='openpq-portable-publication-backup-v1'&&Array.isArray(index.references)&&index.references.length<=1000,'PORTABLE_BACKUP_INDEX_INVALID');
 const objects=await lstat(join(directory,'objects'));requireThat(objects.isDirectory()&&!objects.isSymbolicLink(),'PORTABLE_BACKUP_OBJECT_DIRECTORY_INVALID');
 const expected=[...new Set(index.references.map(e=>e.object_file))].sort();requireThat(stable((await readdir(join(directory,'objects'))).sort())===stable(expected),'PORTABLE_BACKUP_EXTRA_OR_MISSING_OBJECT');
 let total=0;const entries=[];
 for(const ref of index.references){requireThat(/^[a-f0-9]{64}\.json$/.test(ref.object_file)&&ref.object_file===ref.sha256+'.json','PORTABLE_BACKUP_PATH_INVALID');const content=await regular(join(directory,'objects',ref.object_file),262144);total+=Buffer.byteLength(content);requireThat(total<=MAX_TOTAL&&await hash(content)===ref.sha256,'PORTABLE_BACKUP_OBJECT_CORRUPT');const {object_file,...rest}=ref;entries.push({...rest,content:JSON.parse(content)});}
 const bundle={...index.metadata,entries};const verification=await verifyBackupPublications(bundle,trustedAuthority);
 return {bundle,verification:{...verification,portable_filesystem_readback_verified:true,offsite_proven:false,resume_writer:false}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const [mode,source,trustFile,destination,...extra]=process.argv.slice(2);requireThat(!extra.length&&['export','verify'].includes(mode)&&source&&trustFile&&(mode==='export'?Boolean(destination):!destination),'PORTABLE_BACKUP_ARGUMENTS_INVALID');const trust=JSON.parse(await readFile(trustFile,'utf8'));const result=mode==='export'?await savePortableBackup(JSON.parse(await readFile(source,'utf8')),trust,destination):(await loadPortableBackup(source,trust)).verification;console.log(JSON.stringify(result,null,2));}
 catch(error){console.error(error.code||'PORTABLE_BACKUP_FAILED');process.exitCode=1;}
}
