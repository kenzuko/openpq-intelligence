# Normal Transit consumer transfer - 04/10/2026

This is the normal owner-report consumer path, not frozen recovery writer resume. Whole Core 2 readiness remains false. Public Transit has not been switched to canonical authority.

## Implemented

- Explicit `canonical-transit-fact` scope in production account `1a64a0a081ea758f72be8254030bdf11`, enabled only with `CANONICAL_TRANSIT_GATE=TRANSIT_FACT_ONLY_V1`, one Transit dataset, pinned semantic profile and no positive decision types. Ordinary `production`, other accounts/domains and generic candidates stay denied.
- Transit-only fact profile preserves original provider reports, fares, dates, units, missing status times and errors. It does not activate travel/business policies or producer independence. Collector remains `kenzuko/transit-jotrip`.
- Reader uses a pinned Runtime origin/trust, verified current control, exact raw/projection digests, same receipt across both reads and deadline checked after body verification. A changed snapshot, expiry, wrong trust or upstream failure is denied. No automatic source fallback.
- Explicit `LEGACY` mode is consumer rollback; it does not change Core epoch/revision or writer permission. A read-only gateway and dataset-scoped source pump are prepared. Source cron defaults to disabled; gateway defaults to `LEGACY`.
- Four Wrangler bundles build locally. No production Core/Runtime/Source is deployed from these configs.

## Evidence and limits

Full local suite after the native fetch correction passed 337/337, versus baseline 333. Four new tests cover scoped authority, actual native gateway fetch, explicit redirect rejection and canonical consumer cutover/rollback. The earlier 335/335 milestone is retained as historical CI evidence. New native tests use the replay clock `2026-10-03T21:46:00Z`; they are not live cloud observations.

Feature commit `201f4eb66d32383203821ada82aa4edc6e599246` passed both remote CI runs `37157869821` and `37157871806`. Gateway release attempts `37158212383` and `37158415981` deployed only the new unwired reader, failed data acceptance and removed that new target. They are failures, not canonical cutovers. The first attempt did not capture its response status; the second recorded 503 `TRANSIT_READER_UNAVAILABLE` during acceptance. Follow-up native workerd execution reproduced a TypeError at native fetch with `redirect: "error"`; `manual` plus explicit 3xx rejection fixes the native acceptance. This is an observed local platform counterexample. Patched cloud acceptance subsequently passed as recorded below. Existing source engines/public app were not deployed by those release attempts.

The native test advances two actual captured owner snapshots through the actual SQLite Coordinator and signed R2 generation/receipt path. Runtime performs GET-only S3 reads via a mock transport with no Core write/R2 write binding. Legacy -> canonical -> explicit legacy reader rollback is tested, along with mixed-revision, expiry, wrong-trust and HTTP failure denial. Mock S3 permissions are not cloud credential proof. Two captured versions are not unattended live production updates.

First capture is the immutable existing fixture at Transit commit `07b47173870fc7629c872739bf08f0b6d329d7f9`. Second matches actual immutable commit `26f8927968e48f60b8151d93407f32ab9cf710dc` byte-for-byte; source pin is in `tests/data/transit-transfer/SOURCE_PIN.json`. Original generated times remain intact. Service-day changes are not relabeled as same-day observations.

Production inventory GitHub run `37156845927`, code `d50114385ef55db3bad0112a1923ed94e679fe20`, artifact `11285607811`, ZIP SHA256 `b166d182238c88da2fe758b7ad43c14b1c94874a2ef26cc03f89b5348a619797`: Workers, namespace inventory and existing public Worker settings/deployments allowed; R2 bucket inventory HTTP 403. Existing site account matches the handoff after trimming account-secret whitespace. The earlier run `37156773480` failed before any API operation on the untrimmed comparison; do not label that failure a bad account or a successful inventory.

No production signing/R2 credentials were created, no permissions broadened and no protected Worker deployed by the inventory. R2 403 does not prove there is no existing bucket; inventory is unknown. Read-only S3 credentials and account/bucket resource scope are not established for production. The `openpq-intelligence-canonical` bucket name in offline config is a planned exact scope, not evidence that it exists.

## Accepted live reader boundary

GitHub run `37159134929`, attempt 2, release `9ee0ad2bb3dbf02f0c97eeb7faaa9677f0f9ffcb`, pinned Core code `7af398a88d0875d4be79a802923fa2229f7ff81b`: SUCCESS. Attempt 1 stopped at `PINNED_CODE_CI_NOT_PASSED` before Cloudflare operations; rerun happened only after both pinned CI runs completed successfully.

New gateway `https://openpq-intelligence-transit-reader.kenzuko.workers.dev/network.json` is deployed and accepted in explicit LEGACY mode. At `2026-10-03T22:41:11.840Z`, actual gateway GET returned 200 and exactly matched independently fetched raw source bytes, SHA256 `0a0f6258969a9d563e6c20a9ba76e215a0e544fd687b7127ee88f94fa32aba6f`, original generated time `2026-10-04T05:06:34.735667+07:00`, 46 departures and 3 services. HEAD 200 empty, POST/PUT/DELETE 405; no-store and CORS verified. Public/Airport versions were identical before/after. Deployed reader version `7a20ab7f-d5de-4384-9e38-8509df0466b5`. Independent subsequent root GET also returned 200/LEGACY, 57769 UTF8 bytes.

Retained artifact `11286561936`, ZIP SHA256 `2773d3e5ba88c07981cc00acee54181f7fafc152c559fcf83a91373029c1607a`: `READER_ACCEPTED_37159134929.json` and ZIP include gateway/source bytes. Release PR https://github.com/kenzuko/jotrip-home/pull/346 . Reader boundary is active; public app, canonical authority and producer independence are not transferred. No unattended monitoring is claimed.

Latest main recheck: Core remains `5c752383fa16c2988f6ff1e840ae4512a26a73f2`; site advanced to `4d9f794cc834820b0c88cf4cf909501b89b6b2b7` with only currency data sync. No overlapping specialist/UI route change was introduced by this work.

## Next execution

1. Recheck remote heads/current scopes and accepted reader version before the next write; see NEXT_EXECUTION.md for the concrete missing R2 capabilities.
2. Keep the accepted gateway in `LEGACY` until actual canonical evidence passes. The release script deliberately refuses to overwrite an existing target; do not rerun it as a monitor or an in-place cutover.
3. Before canonical deploy: establish the exact production R2 bucket and bucket-scoped Object Read credential, pin new native locator and public signing trust, preserve private recovery assets, bootstrap only the new Transit authority, commit an actual new source candidate, prove scoped source admission fencing and same-source parity, then switch/rollback/re-activate actual consumers.
4. Monitoring and cycle coverage continue alongside eligible scoped activation. Never turn an isolated reference profile into production data by relabeling it.

Weather and Near Me currently ingest through their public consumer URLs, so switching those URLs to Core would create a source loop. They require a source path separation before cutover; neither that separation nor the transient Cloud-source 503 blocks building the independent Transit path.

## Follow-up root cause - 04/10/2026 07:23 Vietnam time

Two bounded alternate checks use existing deploy credentials without changing permissions or deploying specialist engines:

- Jotrip-Lab run37164776842, code00ccd1ffcab6ca91900186c576d8869865b9779f, artifact11289490992, zip SHA256762ca39b1aa0079d5aa0433dc909f808ba8ce13683bcbc8df66f322597fe6842.
- Jotrip-Weather run37164777563, code566909d9d0d651b237efc9027ff6677eefebb90b, artifact11289535752, zip SHA256f138f5660d59155c09f9229ae667a2b448a8b3af3f9dd3607d6560586216e7ab.

Both Workers GET200, R2 listing and exact planned bucket GET403/error10042. Official Cloudflare documentation maps10042 to NotEntitled and requires R2 subscription; this is more specific than the original unclassified403, not proof that broader token permission alone fixes access. Subscription entitlement is the first concrete owner account step. R2 access/credential probes must then be repeated before canonical deployment. No billing or permission changes made. Dashboard in this browser has no login session and a persistent verification error after one allowed reload; no authentication values requested or exposed.

Core PR21 is merged at main `da05af5954c77a06490e1be970fcc39d762024ce`, after successful feature CI37159395055 and37159397801. Merge only triggers verification on the affected paths, no cloud deployment workflow. The deployed reader remains code7af398a88d0875d4be79a802923fa2229f7ff81b in LEGACY, public consumer/canonical authority still pending. Refer to NEXT_EXECUTION.md for the concrete continuation. No seven-day blanket activation delay is introduced.
