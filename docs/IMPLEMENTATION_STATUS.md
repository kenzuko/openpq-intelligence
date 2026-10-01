# Implementation evidence, 2026-10-01

## Latest: M5 local semantic authority integration

117 local tests and six bundles pass. Trusted binding-backed semantic profiles now gate actual local Coordinator prepare/commit and profile-aware Runtime serving. Nine native cases include alarm-driven signed export and cold fallback, source expiry after prepare, zero-generation-write rejection, exact replay after eviction, command-kind collision and independent-trust backup signature/tamper validation. Synthetic ABSTAIN facts only; isolated cloud semantic and real-domain admission remain closed. See SEMANTIC_ADMISSION_INTEGRATION.md, ADR-IMPLEMENTATION-006.md and evidence/semantic-admission-local-20261001. The explicit isolated 15-case cloud regression is pending this milestone; it will not be labelled cloud semantic proof. G1/G2 remain NOT_PASSED. Earlier sections preserve milestone chronology.


## Latest: M4 technical preparation

108 local tests and six offline Worker bundles pass. Registry/graph policy pins, deterministic SHADOW preparation, bounded adapter rehearsal, persistent SQLite retry/backpressure/leases, native workerd export-only DO alarms, monitoring/parity, portable integrity/fenced recovery plans and operator JWT/guards are implemented and tested. A full deterministic local rehearsal passes and is pinned under `docs/evidence/technical-preparation-local-20261001`. See TECHNICAL_PREPARATION.md and ADR-IMPLEMENTATION-005.md. The new scheduler rejects cloud activation; no new resources/credentials were created. Live candidate admission, real source/domain kernels, provider SSO/session wiring, offsite backup/actual restore and cloud acceptance remain gated. Full G1/G2 stay NOT_PASSED. Earlier counts below are milestone chronology.


## Latest: real manual data staging transport

80 local tests and five offline Worker bundles pass, including safe diagnostic regression. A separate append-only staging Worker/adapter handles pinned owned Cano An Thới manual records. 01/10 normalizes to SHADOW; 30/09 and 27/09 quarantine missing explicit authors. Current source time is 06:23 +07:00, preserved as 23:23Z on the prior UTC date; validity ends at the next Vietnam midnight. Full G1/G2 remain closed and actual cloud staging now passes 7/7 cases in run 36863045164 attempt 2 at code 9ab3211747afcef425fc547e227ce1ee31bbd35a. Three real records are stored/read back; temporary capability removal is observed as HTTP 401. Artifacts are pinned separately from the first failed observation. See MANUAL_CANO_DATA_INTAKE.md.


Result: isolated authority/publication milestone implemented; full Intelligence execution is **not complete**. No production deployment or legacy source/consumer transfer occurred.

## Current status after semantic/free-thread handoff

72 local Node tests pass, eight synthetic semantic replay cases pass, four offline bundles pass. Exact prior cloud evidence: 15 protocol/resilience cases and actual R2 read-credential revocation 401 with positive Runtime 200 witness. Full G1/G2 remain NOT_PASSED. The offline semantic layer is not integrated into the live candidate wire contract. Start `docs/free-thread/00_START_HERE.md` for scoped participation. Sections below preserve milestone chronology; earlier NOT_RUN/test counts describe their own date/commit, not current results.

## Verification (earlier milestone)

Local `npm run check`, `npm run verify:handoff`, and `npm test` pass. Node 24.19.0; pinned Miniflare 4.20260730.0/workerd; actual SQLite DO and local R2 APIs. **60 Node test cases pass, including three parent integration tests**. This is not 44 fully passed architecture cases and not a substitute for the V2.1 63-case matrix. Synthetic source data only. Production dependency audit has zero production-package vulnerabilities; no production third-party dependency is shipped.

Proven local behaviors: epoch fencing, concurrent revision race, content-bound idempotency, control-revision invalidation, obsolete-slot rejection, explicit permissioned correction/retraction lineage, native instance/namespace/locator denial, artifact mismatch/expiry rejection, positive evidence fail-closed, source-age advancement, bounded control stamps, signed checkpoint verification, cold Core-outage `UNVERIFIED` serving, blob hash mismatch rejection, SQLite state/dedup after DO eviction, export failure preserving authority/outbox, GET-only Runtime and production configuration denial.

Node test assertions cover errors and unchanged revisions as well as successful reads. Outbox CAS retry exhaustion, signature tamper/old generation/alternate native ID, SigV4 GET/path/denial behavior and bounded streaming reads are pure tests. DO eviction preserves attached storage and does not prove PITR/disaster restore. A test-only HTTP wrapper drops the response after the real SQL commit; retry returns the same receipt. This is not a process crash or cloud network timeout. Cloud R2 IAM denial and cloud multi-region consistency are not tested here. Four Wrangler 4.145.0 offline bundle builds pass. The manual cloud runner and read-only token/resource preflight are implemented; API policy tests use mocks; live run 36840396832 also passed the actual account, token and bucket preflight.

## Architecture case evidence mapping

| V2.1 cases | Local coverage | Remaining evidence |
|---|---|---|
| T01, T02, T08, T10 | local scenario covered | Cloud repetition/current primitive gate |
| T03 | control mutation during actual externally gated R2 await rejects prepare; control changes after prepare reject commit | Cloud repetition; rule/override corpus |
| T06 | identical command returns same receipt after success, dropped post-commit HTTP response and DO eviction | Process crash/timeout at remaining commit boundaries on cloud |
| T07 | CAS exhaustion stays retryable; reordered concurrent local R2 exports cannot regress signed latest checkpoint | Cloud CAS/consistency and crash-boundary proof |
| T09, T12 | explicit correction and retraction revision/lineage | Full immutable emitted domain history |
| T15, T16, T19, T20, T39, T42 | source age, current validation, cold signed fallback, corrupt blob rejection | Source-specific offline windows, lag/missing checkpoint corpus, cloud faults |
| T29, T36, T54, T56, T59 | capability/mode/owner fences, old-generation/native ID rejection, closed positive policy gate | Actual cloud role/scope/day, rollback/config migration and full registry policies |
| T47 | Runtime no write binding; GET-only API; Core read capability cannot promote/export | Actual Runtime S3 credential PUT/DELETE probes, SigV4 cloud GET proof |
| T60, T61 | runbook and fail-closed production environment/config guard | Actual scoped test resources, revoked-credential denial and propagation evidence |
| T62, T63 | independent branch, recorded worktrees/PRs, immutable reference hashes verified | Continue SHA rechecks for every future affected legacy write; amendment lifecycle test |
| All other T01-T63 requirements | NOT_RUN or unsupported | Full fixture corpus and remaining phases |

No V2.1 system test is labelled globally PASS based on this local subset. The released reference matrix remains unchanged as NOT_RUN at release time; this newer evidence is recorded separately.

## Phase/gate state

| Phase/gate | State |
|---|---|
| P0 / G0 | Design read; source-code/parallel-work inventory recorded. Full deployed-resource/private Ops inventory pending. Isolated code work allowed. |
| P1 | Partial semantic contracts and protocol/serving harness; full domain schema/kernels pending. |
| P2 | Local Coordinator, immutable storage, atomic audit/outbox implemented. Cloud proof, crash corpus, retention pins pending. |
| P3 | Local Runtime and pinned hash/locator activation checks implemented. Full registry/version compatibility and source-policy validation pending. |
| G1 | BLOCKED in full: 12/12 actual cloud protocol subset PASS is pinned. 15/15 protocol/resilience cloud subset cases PASS; R2 read-credential revocation subset is now pinned; retention/GC, remaining crash/recovery, unattended retry and cost evidence remain pending. |
| G2 | BLOCKED: approved domain pilot, licensing/budget/mapping/time policies and golden masters. |
| G3-G5 / P4-P8 | NOT_RUN: no live mirror, shadow parity, source producer independence, backup/PITR restoration or cutover. |
| P6 console subset | Separate console/API scaffold implemented and API unit test passes; browser/security/session/SSO/audit display remain pending. |

## Next execution

1. Run CI on the exact PR commit. The new cloud workflow is manual only and must be present on main before its dispatch UI is available.
2. Existing dedicated account/resources and GitHub environment passed preflight. Run the expanded manual cloud workflow on the new main commit using those credentials. Never copy production secrets from another repo/workflow.
3. Finish Evidence/Assertion/Canonical contracts, registry contents and source-policy validation, then resolve a small approved pilot's licensing/time/budget policies and build golden-master fixtures from pinned existing outputs.
4. Port the approved domain kernel and run differential mirror/shadow acceptance. Compose decisions only after named dependency/policy contracts are proven.
5. Complete scheduled progress/outbox retry, budget/backpressure, retention pins, recovery/PITR fencing, monitoring and operator security. Production gates remain closed until this evidence exists.

The next cloud run requires manual workflow dispatch; dedicated credentials already work. Remaining policy and evidence gaps are explicit, not a request for blanket permission.

## Live preflight finding, 2026-10-01

Run 36836092480 attempt 3 stopped before deployment with TOKEN_PERMISSION_TOO_BROAD after the production inventory format was corrected. The old log did not identify the credential/permission, so it cannot establish which permission triggered rejection. The API documents Workers Scripts Write as the equivalent API name for the intended deployment permission; preflight now accepts that name with unchanged account/resource restrictions. Any other unexpected permission still fails closed and logs only its sanitized name and credential role. Two regression tests bring the local total to 43. Actual cloud proof is still pending.

Official naming reference: https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/subresources/permission_groups/methods/get/

The next live attempt (run 36838337708, attempt 3) identified deploy permission Workers Scripts Read after the All zones policy was removed. This narrower Worker read permission is now accepted alongside deployment permission, with unchanged exact test-account scope. A regression also proves wildcard scope still fails. Local total: 44 cases. No deployment had occurred at that attempt.

## Cloud secret limit counterexample, 2026-10-01

Run 36840396832 passed real scoped-token/resource preflight, deployed temporary isolated Core and resolved the actual DO namespace/native instance. Final deployment stopped with Cloudflare error 10054: PRINCIPALS_JSON was 9.4 kB, exceeding the 5.1 kB text-binding limit. Runtime, Operator and cloud protocol proof did not execute. Cleanup removed the provisioning token. No production deployment or authority bootstrap occurred.

Capabilities now contain only the ten locator fields needed for authorization, plus actor-specific permission/mode/owner/epoch data. Preparation packs them into at most three explicitly named secret arrays, checks every generated Core/Runtime secret against a conservative 5,000 UTF-8 byte limit before deployment, and writes unused arrays as [] to clear old capabilities. Authentication parses every array before granting a token; a malformed array fails closed. The outage probe removes the read capability across every shard and restores all original values afterward. The immutable V2.1 reference is unchanged; this addresses implementation serialization, not an authority contract amendment. Three new tests cover longest supported dataset IDs with all seven capabilities, alternate authority denial, oversize/exhaustion, malformed shards and legacy configuration. Local total: 47. Cloud proof remains pending a fresh workflow run on the corrected main commit.

## Native probe readiness and diagnostics, 2026-10-01

Fresh runs 36841923311 and 36842309107 on the secret-size fix passed preflight and temporary Core deployment, but identity resolution failed before final deployment. Existing logs only emitted FINISH_NATIVE_IDENTITY_FAILED; the specific failing API/probe stage cannot be inferred from that log. Identity resolution now reports sanitized fixed error codes per API stage, probe HTTP status, malformed native identity or stale fixture scope, and saves a public diagnostic artifact. It never logs response bodies, credentials or raw exception messages.

The authenticated GET-only native-ID probe now tolerates a bounded propagation window after Worker/secret deployment. Only the exact current dataset/object name and a valid 64-hex native ID can proceed. Stale scope, persistent denial and network failure remain fail-closed after bounded retry. This is readiness hardening and better observability, not proof that propagation caused the observed failures. Three additional tests cover stale/denied responses before readiness, exhaustion, malformed identity and safe network diagnostics. Local total: 50. A fresh actual cloud run is still required to establish the cause/result.

## Actual cloud adapter fault, 2026-10-01

Run 36843360343 completed native identity pinning and deployment of final Core, Runtime and Operator. The first five cloud cases passed: provisioning-route absence, native-pinned single-use bootstrap, capability/mode denial, concurrent publication with one winner, and idempotent retry. Runtime verification then failed with RUNTIME_NOT_VERIFIED; a direct GET returned RUNTIME_UNAVAILABLE. Full G1 remains incomplete.

A new workerd test using native outbound fetch and a mocked R2 HTTP endpoint reproduced TypeError: Illegal invocation. The adapter stored native fetch as an object property and called it with the adapter instance as this. Node unit tests accepted that call; workerd rejects it. The default transport now wraps the global fetch invocation in an arrow function, preserving native receiver semantics. The regression invokes the actual GET-only S3 adapter inside workerd and requires its signed request to reach the mocked endpoint and return the object. It fails on the previous implementation and passes after the fix. Cloud proof now preserves safe Runtime error codes on HTTP failure instead of reducing all such failures to RUNTIME_NOT_VERIFIED. The same workerd test then exposed a second issue: native Workers fetch supports only manual/follow redirect modes, so redirect:error raised TypeError. The adapter now uses manual and rejects every non-success response, including redirects, without following Location or forwarding signed credentials. Regression coverage checks 301/302/307/308 denial as well. Local total: 51; actual cloud re-execution is still required.

## Cloud protocol progress and binding activation, 2026-10-01

Run 36846260706 on d74a85a passed 11 of 12 cloud subset cases, including actual signed R2 GET/hash verification, current control validation, owner transfer, signed checkpoint export, real Runtime credential PUT/DELETE denial and GET-only serving. The final read-capability outage case failed with READ_CAPABILITY_CHANGE_NOT_OBSERVED. The prior runner did not distinguish revoke from restore or record observed status, so that error cannot establish which transition failed or why.

The fixture now explicitly re-deploys the pinned Core bundle after each scoped secret update to activate updated DO bindings. It separately observes revoke (401) and restore (200), with bounded 90-second polling and redacted phase/last-status/attempt evidence. A successful secret write or deployment never counts as observed revocation. Existing authority state remains in SQLite. Three tests cover eventual observed denial, restoration across transient errors and fail-closed deadline with distinct phase codes. This is a test-runner hardening, not evidence that secret-only deployment caused the observed failure. Actual cloud re-execution and full G1 are still pending. This read command capability probe does not substitute for the separate revoked R2 credential propagation test. Local total: 54.

## Cloud subset PASS snapshot and next resilience runner

Actual run 36847033329 at code a2a9eb32db7b2798b47a6a780734c756a69462bf passed all 12 cloud subset cases. The original public preflight, locator and cloud report are preserved byte-for-byte in docs/evidence/cloud-36847033329 with per-file SHA-256 hashes and the original artifact archive hash. CI verifies them separately from the immutable design reference. Full G1 is still NOT_PASSED. Observed command capability revoke returned 401; restoration returned 200. The signer/outbox/crash/retention/PITR and billing gates were not covered by that snapshot.

The next manual cloud runner adds three cases, currently NOT_RUN on cloud: (1) actual loopback client socket loss after the real upstream commit response, followed by identical receipt/revision retry; (2) temporary signer removal, observed constructor restart, unchanged authority on export failure, restore and exactly-once pending export; (3) explicit re-deploy, observed changed Coordinator constructor incarnation, unchanged SQLite state/dedup, and verified Runtime read. The loss occurs in the runner between upstream response and client, not within Cloudflare or mid-SQL transaction. The incarnation observation is process metadata only; it never enters authority receipts, locator hashes or persisted state. Local eviction coverage confirms it changes on actual DO eviction while authority state stays equal.

The runner records request counts and elapsed times but does not label them billing, quota or multi-region evidence. Worker source and all 56 tests, including native workerd S3 and actual socket-loss harness checks, pass locally. G1 remains incomplete until these new cloud cases and the other named gates have actual evidence. See G1_REMAINING_EXECUTION.md for next dependencies.

## Resilience cloud PASS and read-only R2 revocation workflow

Actual run 36848850809 at 17ad9edcec99b8ce0e0196653323cacc55a944fa passed 15/15 cloud subset cases. The loss/retry, signer-outbox recovery and changed constructor incarnation/state-dedup recovery cases all passed. Public artifacts are preserved byte-for-byte under docs/evidence/cloud-36848850809 with hashes and provenance, alongside the earlier unchanged 12-case snapshot. Full G1 remains NOT_PASSED.

The new manual R2 revocation workflow is NOT_RUN against actual disposable credentials. It performs only GET and account API reads; no token mutation, deployment or storage write. Baseline proves a separate bucket-scoped Object Read credential and current Runtime witness both read the same signed-checkpoint-pinned immutable object. Deny phase downloads that exact successful baseline, matches the original credential pair fingerprint/account/bucket/trust, confirms token removal/disablement, requires recognized S3 403 denial, and verifies the Runtime witness still returns the same digest. Changed credentials, 404/network/signature errors or a failing witness cannot pass. This requires two new disposable GitHub environment secrets and owner-controlled revocation after baseline PASS; existing Runtime/deploy credentials stay unchanged. See R2_REVOCATION_SETUP.md.

Four new tests exercise distinct credential/account guards, signed HTTP result capture, recognized denial with positive witness, and fail-closed errors/timeouts. Local total: 60. Timing is runner-local observation after manual revocation, not exact propagation latency or global convergence. Remaining retention/GC, unattended retries, backup/PITR and billed cost/policy gates remain pending.


## Actual isolated R2 credential revocation evidence, 2026-10-01

Baseline 36853905022: disposable and Runtime credentials both read the same immutable object with HTTP 200 and the expected digest. Failed deny 36854890531 is preserved as a counterexample: actual HTTP 401 was rejected by the original probe. PR #10 fixed that assumption. Deny 36856013892 on d25c3b12467d89c216386f183934d15161e51fa6: account API confirmed removal; unchanged disposable credential returned HTTP 401; independent Runtime GET returned HTTP 200 with unchanged digest. Raw reports and archive/file checksums are pinned in `docs/evidence/r2-revocation-36856013892/`.

This proves the read-credential revocation subset at the observed runner. It does not prove revoked write/command credentials, global propagation time, authority migration, or complete G1. Local tests: 61 pass. Production gates remain closed. The two disposable `R2_REVOKE_PROBE_*` environment secrets can now be removed; retain original Runtime and deploy secrets.


## Actual real-data staging milestone

Run 36863045164 attempt 2 passed seven isolated data transport cases and observed temporary token denial after removal. Exact public reports, original archive/file hashes and both attempt identities are preserved under docs/evidence/manual-cano-cloud-36863045164. Primary owner-confirmed 01/10 data is NORMALIZED_SHADOW; 30/09 and 27/09 remain QUARANTINED for missing explicit authors. Source times and day expiry survived unchanged. Full G1/G2 and canonical/publication admission remain closed.

Attempt 1 failed a denial probe but did not capture HTTP status. The old error name STAGING_UNAUTHENTICATED_WRITE_ALLOWED does not prove a successful unauthorized write or its cause. A same-code retry passed. Future runners now record safe HTTP/code observations, use a neutral fail-closed error label, record run_attempt and distinguish artifact names by attempt. No Worker or admission logic is weakened by this diagnostics change.

## M5 cloud regression counterexample

Run 36878858323 on c63ae401562753175b8217bea4cd40e6f86de837 failed its first case with PROVISION_ROUTE_STILL_PRESENT. Cleanup succeeded. This does not establish propagation as the cause: the old check did not capture HTTP status. The runner now waits at most 90 seconds for observed 404, retains status/attempt/time, and fails closed at its deadline. Network errors and other HTTP statuses never count as removal. Two tests exercise eventual removal and persistent/network failure. Local total: 119. Actual rerun pending; G1 remains NOT_PASSED. Worker authority and capability scopes unchanged.

Run 36879691210 at 22ac4fca059838b41e638d3c4c18b9a275f7852d passed 13 cases then failed OUTBOX_RECOVERY_FAILED. Read restoration had returned 200, but export status was not retained, so cause remains UNKNOWN. The runner now independently observes first successful export with bounded polling and preserves its actual response for the unchanged exact-one/revision assertions and empty retry. It never treats restored read as restored signer. Local total: 120. Both failed snapshots will be pinned, not overwritten.
