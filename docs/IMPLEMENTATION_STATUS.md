# Implementation evidence, 2026-10-01

Result: isolated authority/publication milestone implemented; full Intelligence execution is **not complete**. No production deployment or legacy source/consumer transfer occurred.

## Verification

Local `npm run check`, `npm run verify:handoff`, and `npm test` pass. Node 24.19.0; pinned Miniflare 4.20260730.0/workerd; actual SQLite DO and local R2 APIs. **44 Node test cases pass, including three parent integration tests**. This is not 44 fully passed architecture cases and not a substitute for the V2.1 63-case matrix. Synthetic source data only. Production dependency audit has zero production-package vulnerabilities; no production third-party dependency is shipped.

Proven local behaviors: epoch fencing, concurrent revision race, content-bound idempotency, control-revision invalidation, obsolete-slot rejection, explicit permissioned correction/retraction lineage, native instance/namespace/locator denial, artifact mismatch/expiry rejection, positive evidence fail-closed, source-age advancement, bounded control stamps, signed checkpoint verification, cold Core-outage `UNVERIFIED` serving, blob hash mismatch rejection, SQLite state/dedup after DO eviction, export failure preserving authority/outbox, GET-only Runtime and production configuration denial.

Node test assertions cover errors and unchanged revisions as well as successful reads. Outbox CAS retry exhaustion, signature tamper/old generation/alternate native ID, SigV4 GET/path/denial behavior and bounded streaming reads are pure tests. DO eviction preserves attached storage and does not prove PITR/disaster restore. A test-only HTTP wrapper drops the response after the real SQL commit; retry returns the same receipt. This is not a process crash or cloud network timeout. Cloud R2 IAM denial and cloud multi-region consistency are not tested here. Four Wrangler 4.145.0 offline bundle builds pass. The manual cloud runner and read-only token/resource preflight are implemented; their API policy tests use mocks until actual isolated credentials are available.

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
| G1 | BLOCKED: dedicated Cloudflare test capability/resources and actual cloud denial/failure/cost proof missing. |
| G2 | BLOCKED: approved domain pilot, licensing/budget/mapping/time policies and golden masters. |
| G3-G5 / P4-P8 | NOT_RUN: no live mirror, shadow parity, source producer independence, backup/PITR restoration or cutover. |
| P6 console subset | Separate console/API scaffold implemented and API unit test passes; browser/security/session/SSO/audit display remain pending. |

## Next execution

1. Run CI on the exact PR commit. The new cloud workflow is manual only and must be present on main before its dispatch UI is available.
2. Prepare the exact account/resources and GitHub environment in `CLOUDFLARE_TEST_SETUP.md`; run G1 with actual credentials/resources. Never copy production secrets from another repo/workflow.
3. Finish Evidence/Assertion/Canonical contracts, registry contents and source-policy validation, then resolve a small approved pilot's licensing/time/budget policies and build golden-master fixtures from pinned existing outputs.
4. Port the approved domain kernel and run differential mirror/shadow acceptance. Compose decisions only after named dependency/policy contracts are proven.
5. Complete scheduled progress/outbox retry, budget/backpressure, retention pins, recovery/PITR fencing, monitoring and operator security. Production gates remain closed until this evidence exists.

Missing cloud capability is a concrete execution dependency, not a request for blanket permission. Repository work and local proofs are already complete for this milestone.

## Live preflight finding, 2026-10-01

Run 36836092480 attempt 3 stopped before deployment with TOKEN_PERMISSION_TOO_BROAD after the production inventory format was corrected. The old log did not identify the credential/permission, so it cannot establish which permission triggered rejection. The API documents Workers Scripts Write as the equivalent API name for the intended deployment permission; preflight now accepts that name with unchanged account/resource restrictions. Any other unexpected permission still fails closed and logs only its sanitized name and credential role. Two regression tests bring the local total to 43. Actual cloud proof is still pending.

Official naming reference: https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/subresources/permission_groups/methods/get/

The next live attempt (run 36838337708, attempt 3) identified deploy permission Workers Scripts Read after the All zones policy was removed. This narrower Worker read permission is now accepted alongside deployment permission, with unchanged exact test-account scope. A regression also proves wildcard scope still fails. Local total: 44 cases. No deployment has occurred.
