#!/usr/bin/env node
import {canonicalEvidenceJson,evidenceExitCode,verifyCanoEvidenceBundle} from '../src/evidence/manual-cano-evidence-bundle.js';

const [bundleDir,trustedPinFile]=process.argv.slice(2);
if(!bundleDir||!trustedPinFile){
  process.stderr.write('usage: verify-manual-cano-evidence-bundle <bundle-dir> <trusted-baseline-pin.json>\n');
  process.exit(2);
}
try{
  const result=await verifyCanoEvidenceBundle({bundle_dir:bundleDir,trusted_pin_file:trustedPinFile});
  process.stdout.write(canonicalEvidenceJson(result));
  process.exit(evidenceExitCode(result));
}catch(error){
  const code=typeof error?.code==='string'?error.code:'CANO_EVIDENCE_VERIFY_FATAL';
  process.stdout.write(canonicalEvidenceJson({contract_version:'openpq-cano-offline-evidence-verification-v1',fixture_only:true,verification_status:'CORRUPT_OR_ERROR',bundle_status:null,baseline_match:false,audit_match:false,inventory_verified:false,action_eligible:false,publication_admitted:false,reason_codes:[code]}));
  process.stderr.write(code+'\n');
  process.exit(2);
}
