# Technical preparation milestone M4

This supplement keeps V2.1, M2/M3 and all earlier evidence immutable. It prepares reusable implementation before domain values, provider wiring and live admission. It does not claim the full Intelligence system is ready for production.

## Implemented and executable now

| Component | Implementation | Evidence level |
|---|---|---|
| Policy configuration | P01-P18 identities, exact environment/scope, recorded owner/rationale/version/effective interval, immutable hash, revalidate interval on use | Pure local tests. No invented business approval. |
| Registry graph | Exact kind/version/hash, immutable snapshots, dependency availability/cycle guard, source/mapping/adapter/schema linkage, policy-set pin and budget consistency | Local graph tests; no live registry activation. |
| Preparation pipeline | Evidence/assertion validation, predicate type/unit, source identity/artifacts, source-time basis, source age independent of fetch, half-open validity, missing/ambiguous/conflicting inputs | Deterministic SHADOW output only. Never a Coordinator candidate. |
| Source adapter shell | Scoped license/budget checks, exact HTTPS origin/path, no credentials embedded, bounded JSON streaming, no redirect following, timeout/abort | Injected rehearsal transport. No provider fetch scheduled. |
| Durable job runner | SQLite persistence, content-bound idempotency, queue capacity, global concurrency/request window across database handles, leases, bounded retry/backoff, expiry, quarantine, restart proof | Actual Node SQLite local test database; not an authority store. |
| Checkpoint progress scheduler | Separate SQLite DO, native alarms, durable pending exports, request window, retries, permission-denial quarantine, policy migration fence | Actual local workerd/Miniflare SQL, alarm firing and eviction. Cloud activation blocked. |
| Monitoring | Runtime response AND source age/validity/progress/backlog/checkpoint lag; missing policy blocks health claim | Deterministic report, no notifications sent. |
| Shadow/parity | Explicit field rules, exact/numeric tolerance, missing/type/scope/time differences; critical flags | Local comparisons, no cutover enabled. |
| Portable backup | Export manifest and per-record hashes/bytes, required records, active generation digest/control watermark validation, secret-field rejection | Local integrity only, not signed receipt authentication, offsite recovery or PITR. |
| Recovery and retention | New generation/locator/key requirements, recorded old command AND write denial, epoch/discontinuity plan, expired overrides not revived; pin-aware retention dry run | Plans only. No trust switch, import, resume or delete. |
| Operator security building blocks | ES256 verifier using pinned public keys, explicit app token type/issuer/audience/time/subject, server-owned roles/datasets; session/origin/CSRF/role guards, reducing-protection review checks | Local cryptographic/adversarial tests. Provider SSO, session store, review attestation and console wiring still required. |
| Readiness tools | Complete unresolved domain template, exact missing policy/binding report, explicit required cutover evidence | All production and canonical publication gates stay closed. |

`APPROVED_RECORDED` means an approval recorded in caller-controlled configuration. It is not an authenticated operator authorization. The synthetic values in `src/fixtures/preparation.js` are test values only. The real Cano template `fixtures/preparation/unresolved-domain.json` leaves all P01-P18 BLOCKED.

Preparation consumes the existing semantic fixture contract for validation and adds graph/policy checks. A live wire contract/admission adapter is deliberately not emitted. The synthetic report-only resolver/rule cannot substitute for a Weather/Marine/Aviation domain kernel. Semantic admission into `/prepare` and `/commit` remains closed pending reviewed domain contracts and rules.

## Run without cloud secrets

Node 24 is used for local SQLite. No production dependency was added.

```sh
npm ci --ignore-scripts
npm run check
npm run verify:handoff
npm test
npm run rehearse:technical
npm run readiness:technical
npm run check:cloud-bundles
```

The rehearsal creates only `.preparation` public synthetic JSON and a temporary SQLite database removed at completion. It runs adapter response -> registry/policy preparation -> queued failure -> persisted reopen -> retry -> progress/staleness monitoring -> parity -> backup integrity -> recovery/retention plan -> operator guard. Fixed evaluation time makes the report deterministic. It never calls Cloudflare, emits a command, deletes blobs or sends an alert.

The progress Worker uses only a `CORE_EXPORT` service binding and a separately scoped export token. It has no canonical bucket, signing key, Coordinator namespace, promote/control/restore route or generic external request destination. It accepts only `EXPORT_CHECKPOINT` for its configured dataset. It currently refuses both `isolated-test` and `production`; no existing cloud workflow or preflight allowlist deploys it. Cloud activation needs a separately reviewed account/namespace/native-ID/binding mapping, export-only capability, approved cadence/budget and cloud failure evidence.

Node handlers must honor abort and use the stable job ID as their side-effect idempotency key. An abort signal cannot forcibly kill arbitrary injected JavaScript; lost leases fence settlement, not a non-cooperative external side effect. No current handler performs booking/payment/notification or historical command replay. Native checkpoint export is at least once; Core's existing idempotent immutable outbox preserves publication authority.

The signed app-session verifier is narrow ES256, not a complete OIDC implementation or a promise of compatibility with a particular provider's tokens. It denies remote token-supplied key URLs and algorithm changes. Provider login/discovery/key rotation, secure session cookies/server revocation, authenticated second-review records, access protection and actual browser/console security tests must be completed for the selected SSO provider before operational activation.

## What remains to supply or measure

| Input | How it is consumed | Gate |
|---|---|---|
| Approved source inventory, identity/location mapping and source permissions | SOURCE/MAPPING/SCHEMA artifacts, adapter descriptor, licensing policy | P08/P09/P16 and G2 |
| Verified existing domain rules and tolerances | RULE/RESOLVER implementation, golden-master corpus, parity policy | P05-P07/P17, G2/G3 |
| Actual request/load/storage/cost measurements | Approved request window, concurrency, payload, timeout, retry and retention configuration | P10/P11 and G1/G4 |
| RPO/RTO, backup target/cadence, restore owner | Portable export wiring and actual separate-generation restore drill | P12/P13/P18 and G4 |
| Detection cadence/channel, authenticated operators and SSO provider | Scheduler/sentinel bindings and session/console deployment | P14/P15 and G4 |
| Source/consumer deployed inventory and acceptance evidence | Domain-scoped live wire validation, mirror, shadow cycles, routing and rollback rehearsal | G0/G2-G5 |

These are not merely filenames to copy. Their approved values and provider bindings enable scoped integration and actual cloud/shadow/restore acceptance. Existing Weather, Airport, Transit, Near Me, multilingual and public consumers remain untouched. No automatic production enablement happens when a JSON field becomes filled.

## Rebuttal and decisions

- A successful prototype is not proof of live kernel correctness. The output remains SHADOW, ABSTAIN, `wire_candidate_available=false` and `publication_admitted=false`.
- A queue restart can repeat an operation after uncertain response. Use stable IDs and side-effect idempotency; do not claim global exactly once.
- A green HTTP endpoint can conceal stale data. Monitoring separately checks source time and canonical/export progress.
- A checksum proves local content integrity, not a signed authority receipt, consistent PITR or offsite durability. Restore never resumes writers.
- A revoke API acknowledgement or 5xx is not observed denial. Both command and write capability observations must be present; recorded evidence still requires owner verification before a trust switch.
- Deleting unpinned entries from an incomplete inventory can destroy replay. Retention always returns `delete_enabled=false`.
- A caller saying `signature_verified=true` is not an SSO adapter. The cryptographic verifier is provided, while all live forwarding remains absent and reducing-protection review still needs authenticated integration.

Technology references checked 01/10/2026: [Cloudflare SQLite storage/alarms/transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) and [RFC 8725 JWT security practices](https://www.rfc-editor.org/rfc/rfc8725.html). These references describe the primitives/security basis, not a PASS verdict for this implementation.
