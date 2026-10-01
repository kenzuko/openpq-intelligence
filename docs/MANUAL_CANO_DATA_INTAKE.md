# Actual data intake pilot: manual Cano An Thới

This phase prepares and exercises **non-authoritative SHADOW staging**, not source re-homing, publication admission or production cutover. Owner has requested bringing existing project data into the new system. The narrow pilot uses owned manual records already in `kenzuko/Jotrip-Lab`'s `data-marine-ops` branch; it does not ingest provider forecast/METAR/ferry raw data or acquire external source rights.

## Source pin and mapping

Exact source commit: `e19d30df1fe068d44f66f89278b749deb7b3c3cb`. Paths are `data/marine_ops/manual-confirmations/YYYY-MM-DD-cano-an-thoi.json`. The captured 01/10 record explicitly declares schema `marine-ops-manual-1.0`, category `cano`, source `JOTRIP_FIELD_CONFIRMATION`, FIELD/DIRECT evidence, An Thới area, a same-day validity statement, source timestamp with +07:00, and `confirmed_by: kenzuko`.

The adapter does not geocode a point or expand that service area to the whole island. It accepts exact known scope strings and same-day timestamp/path agreement. Offset time is normalized to UTC. Effective start is the explicit source confirmation time; effective end is the next local midnight. Fetch/received time cannot refresh source time or extend expiry. Author identity assurance is only SOURCE_RECORDED_ONLY, not authenticated operator identity or an independent witness.

The 30/09 and 27/09 records lack the explicit author field. Their normalized records retain QUARANTINED with MANUAL_AUTHOR_NOT_EXPLICIT; no inferred author or current operating eligibility is generated. Historical records remain expired at today's evaluation. Source fields not needed for intake, including free-text notes/channel, are not copied into the staged object. Source full-byte hash and exact Git ref remain provenance references.

## Staging storage and access

`src/workers/staging.js` has one R2 binding, STAGING, to the existing isolated test bucket. It has no DO, Core/Operator service, command, signing or trust binding. It exposes authenticated `/stage` and `/read` only. No commit/control/export/delete/list API exists. Writes are conditional immutable puts under `staging/manual-cano/<source-commit>/<content-digest>.json`; readback verifies digest. Existing canonical/receipt keys are not touched. No blob deletion or lifecycle is enabled.

The new Worker is `openpq-intelligence-staging-isolated-test` in the already pinned dedicated test account. Preflight only adds this exact Worker name to the inventory allowlist; account, bucket, token scopes and namespace checks are unchanged. Config rejects production overlap, routes, crons, inheritance and authority/legacy bindings. Request/source bodies are bounded before buffering.

A random per-run staging capability is masked in logs; only its SHA256 is bound as a secret. It expires after the test's 15-minute window. After proof the workflow removes that secret, redeploys, and requires observed 401 with the old token. No new owner-created credential is required. Every output includes publication_admitted=false and action_eligible=false, including the in-day RUNNING source record.

## Execution

Workflow: `.github/workflows/manual-cano-stage.yml`, **Isolated manual Cano data staging**. It can run manually on main with service_day and exact source SHA. A deliberately named `cloud/manual-cano-staging` branch push triggers the bounded first actual staging run, using the same isolated environment; normal main/feature pushes do not deploy staging. This is an authorized isolated data test, not a production deployment path. Concurrency is shared with other isolated cloud proof workflows.

Steps: local gates -> actual resource/token preflight -> bounded pinned source fetch (one primary and two specified historical records) -> prepare validated binding config -> separate Worker deploy + capability activation -> actual write/idempotency/readback/denial/history quarantine proof -> capability removal and observed closure -> upload only selected public evidence files. Private plan/request/capability files never enter artifacts or Git.

Actual run 36863045164 attempt 2 at 9ab3211747afcef425fc547e227ce1ee31bbd35a passed seven data transport cases and observed capability removal HTTP 401; three real records were stored/read back. Raw public reports and hashes are pinned in docs/evidence/manual-cano-cloud-36863045164. Attempt 1 remains preserved as an inconclusive failed denial observation. Prior local tests and successful Worker deployment alone do not establish data write/readback. The record's reported source state is not current authoritative operating status merely because a source pin is within its stated validity interval.

## Admission still closed

Staged metadata is ready for a later versioned semantic admission adapter. It cannot directly become `openpq-candidate-v1` with minimum_evidence_met=true. Remaining gates: full registry graph and policy/schema compatibility, authenticated operator/source trust, explicit pilot source policy approval, golden parity, canonical wire adaptation, current control/locator authority, retention/recovery/budget proof and per-dataset cutover. Existing Cano/Home/Weather/Airport/Transit consumers continue using their existing producers.

The pilot proves the data transfer boundary independently of those live decision gates. Full G1/G2 remain NOT_PASSED.
