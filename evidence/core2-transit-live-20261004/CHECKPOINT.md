# Core2 transfer checkpoint - 2026-10-04

Transit is active on production. The previous R2 entitlement blocker is resolved after the owner enabled R2. This is a scoped canonical fact transfer, not whole-Core production readiness.

## Accepted
- Production account: 1a64a0a081ea758f72be8254030bdf11. Bucket: openpq-intelligence-canonical.
- Dataset: transit.bridge.phu-quoc; environment: canonical-transit-fact; positive decisions remain disallowed.
- Normal bootstrap retained owner-report-transit, epoch 1, control revision 0. No frozen restore, reset, or authority replacement.
- Source collector preserved. Two actual immutable source commits adbdae58458c82d311870520f8c0f61d4b217519 and e62591ea52c7ad5032c052b4d791b5bfa140048c advanced through the same authority.
- Native source Cron published revision 2 on 2026-10-04T01:38:41.046Z; subsequent cadence was observed.
- Gateway CANONICAL -> LEGACY -> CANONICAL verified with unchanged authority epoch/control revision and exact source bytes.
- Public transit/app.js now reads the canonical gateway. Public deploy 37169585999 succeeded; site routes, Weather V3, browser homepage, locale publication contract, robots, sitemap and www redirect passed.
- Runtime has an exact-bucket temporary Object Read credential. Real GET succeeded; PUT/DELETE were denied. Parent deployment credential remains only in GitHub Actions.
- Initial renewal run 37168514923 succeeded. Child expires 2026-10-06T01:39:07.919Z. Scheduled renewal every 12h and observation every 30min are configured; this checkpoint does not claim a completed multi-day observation period.

## Evidence
PUBLIC_EVIDENCE.zip and MANIFEST.json preserve 16 allowlisted public files from successful actual cloud runs. Archive and per-file SHA256 are recorded in MANIFEST.json. No credential or private signing key is included.
- Bucket creation: 37166775160.
- Read capability canary: 37166946200.
- Accepted cadence/cutover/rollback: 37168316257.
- Renewal and observation: 37168514923.
- Independent signed source update export: 37169567161.

## Failures retained honestly
- Initial activation 37167634730 failed canonical readback and safely restored LEGACY. Hidden artifact upload omitted detailed proof; only logs/metadata were retained. Do not claim a captured 1042 response.
- Resume 37167968261 failed its short Cron observation window and restored LEGACY. A later bounded observation covering provider propagation accepted actual Cron publication.
- Historical Transit collector rerun hit rebase conflicts and did not overwrite current data. Collector checkout now selects current main for non-PR runs; actual new collection succeeded.
- Public deployment exposed existing English residue and stale language QA assumptions. Translation and isolated QA fixture fixes passed. Production English remains unpublished.

## Remaining transfer
- Weather independent source adapter is deployed with exact byte parity 6/6 roles; source-path PR 350 merged at 0b132db52338a1106175f31118cc8589dfa2218f. Canonical Weather authority/runtime/reader/public routing are not activated.
- Near Me exact CMS-build source publication stage merged in site PR 351 at 72fafa5b1801677e9e8e79d83a261297aa4759eb. First publication acceptance is pending. Public Near Me consumer is unchanged.
- Airport remains on its existing specialist engine. Canonical transfer must retain the per-field one-minute lag requirement.
- Cano daily operational confirmation and all positive business decisions remain closed without day-specific owner evidence.
- Producer independence and whole-Core production readiness remain FALSE. Keep rollback and existing collectors.

## Execution recovery
The local terminal became unresponsive even for simple read-only commands. Work continued through GitHub APIs and GitHub Actions; do not repeatedly block on that terminal. Do not rerun create-only Transit activation against the live authority.
