# Isolated cloud proof, G1 remains BLOCKED

No Cloudflare account, test API credential, test namespace or test R2 credential was available to this implementation session. Local workerd proof is not a cloud PASS. Production paths are rejected in code; no production deployment workflow exists.

## Implemented manual runner

Follow [CLOUDFLARE_TEST_SETUP.md](CLOUDFLARE_TEST_SETUP.md). The runner uses a separate test account and the exact private bucket `openpq-intelligence-canonical-isolated-test`, rather than a manually assembled example config. It provisions only three fixed test Workers and one Core SQLite DO namespace. Wrangler is pinned to 4.145.0.

`.github/workflows/cloud-proof.yml` is `workflow_dispatch` only, with a dedicated GitHub environment, serial concurrency, explicit account IDs and no route/cron. Before any Cloudflare write, `scripts/cloud/preflight.js` performs only GET requests: verifies the account-owned deployment token, reads both token policies, compares the test account against the production account inventory, and inventories Workers, buckets and namespaces. Unknown/broad scopes, foreign resources or truncated inventory stop execution. Mock policy tests do not prove actual cloud IAM; the real API must pass.

The temporary authenticated provisioning Worker obtains `idFromName` metadata without creating/bootstraping authority state. The runner pins the real namespace/native ID, generates a fresh fixture dataset, generation, signer and capabilities for each run attempt, and replaces the provisioning code with final Core. The temporary token is removed in an always-run cleanup step. Final Core has no provisioning endpoint. Test trust approves only the synthetic `cano.operation.fixture` decision type.

The 12 cloud protocol checks cover bootstrap, alternate-authority/mode denial, publication race, idempotency, real Runtime S3 GET/hash verification, control invalidation, owner epoch transfer, signed outbox export/retry, actual Runtime credential PUT/DELETE denial, read/control API denial and signed cold fallback while the Core read principal is removed. The original principal list is restored in `finally`. This outage test revokes an application capability; it does not prove Cloudflare IAM revocation or full recovery.

Only public preflight, locator and redacted cloud evidence files are uploaded. The evidence includes code SHA, configuration hashes, resource identity and timed check outcomes. No private plan, key, secret file or complete `.cloud-proof` directory is an artifact. Success is `CLOUD_PROTOCOL_SUBSET_PASS`; **G1 remains NOT_PASSED**.

## Remaining G1 proof

Run the remaining architecture corpus against actual cloud resources: R2 write/GET/sign/export faults, crash/timeout boundaries, control mutation during external await, alternate native namespace/old locator, manual evidence expiry, retention and budget behavior. Compare SQL state, audit, outbox receipts and observations from relevant locations.

Recovery remains a separate explicit test: freeze, increment/fence owner epoch, revoke/rotate old writer capability, run actual old-credential command and R2-write denial probes from relevant observation locations, then switch independently pinned trust and resume only after deny evidence and generation fencing. A single denied probe is not proof of global IAM propagation. Cloudflare documents up to about one minute for permission propagation; time elapsed alone is not the condition for resume. Any uncertain result keeps recovery BLOCKED.

## Evidence and policy limits

Record action ID, resource identity, code/config hashes, UTC timestamps, status/error classes and redacted request/response evidence. Never include tokens, private JWKs, S3 secrets or raw traveller location.

Positive fixture evidence booleans and per-input freshness values are supplied by a **trusted fixture writer**. They are not yet backed by the production policy registry/rule evaluator. `approved_positive_decision_types` is empty by default. Activation of real decision types, numerical thresholds, source freshness and licenses requires P01-P18 policy resolution and the remaining implementation. No cloud proof can substitute for domain-rule proof.

Outbox draining is explicit `/export` with an export capability. Automatic retry scheduler, capacity/backpressure, GC pinning and disaster/PITR restoration are pending. DO eviction tests preserve attached SQLite storage; they do not establish disaster recovery or RPO/RTO.

Official references checked 2026-10-01:
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- https://developers.cloudflare.com/r2/reference/consistency/
