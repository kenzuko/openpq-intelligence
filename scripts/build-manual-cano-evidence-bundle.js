#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCanoEvidenceBundle,canonicalEvidenceJson,evidenceExitCode} from '../src/evidence/manual-cano-evidence-bundle.js';

const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [inputRoot,manifestFile,outputDir]=process.argv.slice(2);
if(!inputRoot||!manifestFile||!outputDir){
  process.stderr.write('usage: build-manual-cano-evidence-bundle <input-root> <manifest-relative-path> <new-output-dir>\n');
  process.exit(2);
}
try{
  const built=await buildCanoEvidenceBundle({input_root:inputRoot,manifest_file:manifestFile,output_dir:outputDir,source_root:sourceRoot});
  const invalid=built.report?.aggregate_result?.status==='INVALID';
  const result={contract_version:'openpq-cano-offline-evidence-build-result-v1',fixture_only:true,status:invalid?'DIAGNOSTIC_INVALID_BATCH':'BUNDLE_CREATED',bundle_status:built.marker.bundle_status,baseline_source_sha256:built.baseline.baseline_source_sha256,action_eligible:false,publication_admitted:false};
  process.stdout.write(canonicalEvidenceJson(result));
  process.exit(invalid?1:0);
}catch(error){
  const code=typeof error?.code==='string'?error.code:'CANO_EVIDENCE_BUILD_FATAL';
  process.stdout.write(canonicalEvidenceJson({contract_version:'openpq-cano-offline-evidence-build-error-v1',fixture_only:true,status:'ERROR',code,action_eligible:false,publication_admitted:false}));
  process.stderr.write(code+'\n');
  process.exit(2);
}
