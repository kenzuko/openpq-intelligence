# ADR implementation 004 - real manual data shadow staging

Status: local and actual isolated cloud transport subset pass; publication admission remains closed.

Concrete need: the platform can publish synthetic protocol fixtures, but had no bounded path to bring owned real records into the isolated system without overstating authority/policy readiness. The owner requested continuing until actual data can be brought over.

Decision: use one narrow manual Cano An Thới pilot, pinned by repository/commit/path/full-byte hash. Normalize selected fields into an append-only SHADOW staging prefix. Separate Worker and ephemeral capability enforce the transport boundary; no authority/signing/command/DO binding. Preserve explicit source time and day expiry. Missing recorded author becomes quarantine, not a fabricated operator. Stored source identity assurance is SOURCE_RECORDED_ONLY.

Why no direct canonical promotion: existing semantic validators are offline, full registry graph/licensing/time/mapping/key compatibility and pilot acceptance are incomplete. Data storage success cannot supply these missing truths. Every staged record/read view explicitly denies publication/action eligibility. No weather forecast, safety recommendation or ferry status is synthesized.

Validation: local workerd/R2 bounded streams, immutable collision, idempotency, readback integrity, protected namespace sentinel, production/config denial, missing author and scope/day/time tamper; actual isolated cloud read/write/dedup/history quarantine and observed capability closure. The existing production systems and immutable V2.1/M2 snapshots remain unchanged. Remaining admission work is documented in MANUAL_CANO_DATA_INTAKE.md.

Actual cloud evidence: run 36863045164 attempt 2, code 9ab3211747afcef425fc547e227ce1ee31bbd35a; seven cases pass, three records stored/read back, old per-run capability denied with 401 after removal. First attempt is preserved and does not establish the cause of its failed denial observation.
