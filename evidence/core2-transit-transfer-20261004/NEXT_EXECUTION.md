# Transit transfer continuation

Read CHECKPOINT.md first. Implemented code is merged to main at `da05af5954c77a06490e1be970fcc39d762024ce`. Implementation PR: https://github.com/kenzuko/openpq-intelligence/pull/21 . Code pin for corrected native reader: `7af398a88d0875d4be79a802923fa2229f7ff81b`.

Accepted live gateway: `https://openpq-intelligence-transit-reader.kenzuko.workers.dev/network.json`, LEGACY mode, version `7a20ab7f-d5de-4384-9e38-8509df0466b5`. Cloud acceptance run `37159134929` attempt 2 passed. Release PR https://github.com/kenzuko/jotrip-home/pull/346 . Do not rerun create-only release against this existing target. Public app remains on its original source URL.

## Actual production access blocker

The existing site deployment credential can inventory/deploy Workers. Initial site inventory only recorded R2 HTTP403. Follow-up GET-only production diagnostics in Jotrip-Lab (run37164776842) and Jotrip-Weather (run37164777563) independently return HTTP403 with error10042 NotEntitled for both bucket listing and exact planned bucket metadata. Cloudflare official error documentation identifies10042 as account feature entitlement/subscription, distinct from permission error10003. First establish production R2 subscription entitlement; do not try broader deployment permissions as the first fix. No verified production Runtime Object Read credential is available in the handoff or current release. Do not infer bucket absence from HTTP 403 and do not copy isolated-test credentials into production.

Account: `1a64a0a081ea758f72be8254030bdf11`. Offline planned bucket: `openpq-intelligence-canonical`; existence and intended reuse remain unverified. Establish the actual exact bucket before deployment and amend the offline configuration if the intended existing bucket differs. No billing or account-admin scope is needed.

The first owner action is to enable R2 in the production account Dashboard, including any required account/payment confirmation personally. Do not change the isolated test account. Browser here has no signed-in session and its verification form remains failed after one reload; automated UI cannot complete that account step. The official R2 error reference is https://developers.cloudflare.com/r2/api/error-codes/ .

After account entitlement is established, verify these capabilities for the next cloud step:

1. Account-scoped R2 bucket discovery/provisioning and the specific bucket binding for the new Transit Core writer, using an authorized deployment credential.
2. S3 Object Read only credential restricted to that exact production bucket. Store endpoint, bucket, access key and secret as protected `S3_READONLY_CONFIG` for the new Transit Runtime. Never commit their values or place them in the reader Worker.

The Runtime credential needs an actual positive GET witness on a disposable object and denied PUT/DELETE probes at the same bucket. Retain proof, not credentials. Source and public reader have no R2/signing binding.

## Execution after access is established

- Recheck both repository main/feature heads, existing workers and namespaces before write. Reuse the accepted gateway only after checking its current mode/version.
- Build with `node scripts/prepare-transit-transfer-bundles.js`. Four new names are pinned; no existing public Worker target or UI route changes. Source cron starts disabled.
- Deploy only the new Transit Core to discover its actual namespace/native ID, then independently pin its public receipt signing key and authority/profile locator. Generate private signer and scoped command/read principals in protected workflow execution; retain private recovery assets.
- Bootstrap normal Transit fact authority with no positive decision types. Deploy new Runtime with GET-only S3 capability and new source pump with only the Transit promote/export principal. Publish an actual current source candidate before exposing canonical reader mode.
- Verify exact current source/served bytes, same receipt and expiry, actual update through authority, denied unrelated domain/account/writer routes, then actual reader LEGACY -> CANONICAL -> LEGACY -> CANONICAL. Rollback changes reader mode only, never authority epoch/revision.
- Only after those witnesses switch the public Transit consumer. Keep Weather/Airport/Transit specialist code, UI/routes, CMS and existing recovery assets. No silent fallback or source-loop migration.
- Start source cadence and scoped observation alongside accepted activation. Seven-day observation is not a blanket delay. Whole Core readiness and producer independence remain false until their own evidence passes.

No ongoing unattended monitoring or canonical activation is implied by local native tests or a deployed legacy gateway.
