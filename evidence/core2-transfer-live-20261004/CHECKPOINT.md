# Scoped production transfer checkpoint - 2026-10-04

This checkpoint records accepted transport evidence. It does not declare the whole Core production-ready or producer-independent. Operational positive decisions remain closed. Seven-day observation runs alongside scoped activation.

## Accepted public production
- Transit: four dedicated Workers; public Transit consumer changed; release run 37169585999 succeeded. Normal owner epoch 1 and control revision 0. Native Cron, two actual immutable producer versions, signed S3 reads, write denial, and reader rollback accepted.
- Weather: six existing runtime roles (current, forecast, marine, cloud, compact, meta) passed signed canonical gateway admission in run 37173690295. Public release 37174417824 succeeded with 6/6 digest/receipt checks and UI smoke. Read capability renewal 37174331727 succeeded. Separate CMS post-deploy verification succeeded on one rerun. Original specialist engines, CMS, UI and business logic were retained. Manifest remains outside this six-role transfer scope.

## Directory / Near Me
- Core PR 28 merged as db1f6caf2f8396c03627f22bf290261d593cd457. One authority admits the unchanged location index, support and venue files from one atomic CMS release.
- Initial authority activation run 37175953900 admitted the complete three-file publication, epoch 1/control revision 0. Adding Cron failed because the live Free account has reached five triggers (provider code 10072).
- Core PR 29 merged as dd95f613c2da7535010ee24ff3e2a36c5680f740. Native SQLite Durable Object alarms refresh only this fixed publication every two minutes. A private one-time start capability is removed after arming; failed admissions rearm and remain ABSTAIN. Native Miniflare tested unauthorized start denial, actual alarm execution and recovery cadence.
- Resume run 37176526224 succeeded: two actual alarms, revisions 3 and 4, independent signed S3 three-file readback, GET success/PUT and DELETE denied, CANONICAL -> LEGACY -> CANONICAL, same authority and protected Worker versions.
- Initial Runtime read renewal and observation run 37176741956 succeeded.
- Public consumer PR 353 is pending final UI checks and release at this checkpoint. Its loader reads one complete publication; it rejects expired/incomplete data and preserves original filtering, GPS, venue normalization and rendering.

## Airport
- Read-only live-source preflight 37175491174 succeeded; no Airport authority bootstrapped or consumer switched.
- Six actual samples, service date 2026-10-04, 139 flights (70 arrivals, 69 departures).
- Flight fields actually changed during the sample. Maximum observed board age was 22,968 ms. This is source evidence, not canonical transfer evidence.
- Next: a separate fixed Airport fact gate, same original live proxy, native source alarms, source age strictly below 60 seconds, current Vietnam service date, signed readback and measured flight-field propagation. Keep historical date boards, UI, FR24 and specialist engine intact.

## Quota and monitoring
- User limit: do not exceed 3,000 Cloudflare build minutes. The transfer uses GitHub checks and direct Wrangler upload, not a newly enabled Cloudflare Builds pipeline. Aggregate used/remaining Cloudflare build minutes have not been verified.
- No plan upgrade and no existing Cron removal. Use the native source alarm to avoid a sixth trigger.
- Temporary exact-bucket Object Read credentials remain private to Runtime, with 48-hour expiry and 12-hour GitHub renewal. Thirty-minute observations do not deploy code.
- Retained ZIP contains only allowlisted public source bytes, generations, receipts, trust/profile public data and proof. Its hashes and exact run origins are in MANIFEST.json.
