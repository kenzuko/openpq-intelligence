import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),files=[];
async function walk(dir){for(const entry of await readdir(path.join(root,dir),{withFileTypes:true})){const p=dir+'/'+entry.name;if(entry.isDirectory())await walk(p);else if(p.endsWith('.js'))files.push(p);}}
await walk('src');await walk('scripts');await walk('tests');
const edges={},external={},unresolved=[];
for(const file of files){const text=await readFile(path.join(root,file),'utf8'),imports=[...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)].map(x=>x[1]);edges[file]=[];external[file]=[];
 for(const spec of imports){if(!spec.startsWith('.')){external[file].push(spec);continue;}const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));if(files.includes(target))edges[file].push(target);else unresolved.push({from:file,to:target});}
}
function closure(roots){const found=new Set(),pending=[...roots];while(pending.length){const p=pending.pop();if(found.has(p))continue;found.add(p);pending.push(...edges[p]||[]);}return [...found].sort();}
const workerRoots=files.filter(p=>p.startsWith('src/workers/')),workerClosure=closure(workerRoots),runtimeClosure=closure(['src/workers/runtime.js']),devClosure=closure(files.filter(p=>p.startsWith('scripts/')||p.startsWith('tests/')));
const report={scope:'STATIC_LITERAL_ESM_IMPORT_GRAPH_NOT_PRODUCTION_RESOURCE_INVENTORY',worker_roots:workerRoots.sort(),worker_reachable:workerClosure,runtime_reachable:runtimeClosure,development_only:files.filter(p=>!workerClosure.includes(p)&&devClosure.includes(p)).sort(),unclassified:files.filter(p=>!workerClosure.includes(p)&&!devClosure.includes(p)).sort(),unresolved_literal_imports:unresolved,dynamic_nonliteral_imports_not_proven:true,archive_removal_authorized_by_graph:false,duplicate_authority_claim:false};
if(runtimeClosure.some(p=>p.startsWith('src/ingress/')||p.startsWith('tests/')||p.startsWith('scripts/')))throw Error('Runtime depends on collector/test/tooling');
if(unresolved.length)throw Error('Unresolved imports: '+JSON.stringify(unresolved));await writeFile(process.argv[2]||'../CODE_REACHABILITY.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS_STATIC_IMPORT_AUDIT',worker_reachable:workerClosure.length,development_only:report.development_only.length,unclassified:report.unclassified.length,runtime_collector_dependencies:0}));
