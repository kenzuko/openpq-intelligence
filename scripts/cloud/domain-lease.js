export function captureReferenceLease(now){
 return {valid_from:new Date(now-1000).toISOString(),valid_to:new Date(now+299000).toISOString(),basis:'ISOLATED_CAPTURE_REFERENCE_ONLY'};
}
