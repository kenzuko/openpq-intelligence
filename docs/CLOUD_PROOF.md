# Isolated cloud proof, G1 remains BLOCKED

No Cloudflare account, test API credential, test namespace or test R2 credential was available to this implementation session. Local workerd proof is not a cloud PASS. Production paths are rejected in code; no production deployment workflow exists.

## Exact next procedure

1. Supply a dedicated test capability scoped to newly created isolated resources. Do not retrieve/reuse Weather/Home/Transit production secrets. Record the account, Worker names, namespace ID, bucket name, environment, token identifiers/scopes (no token values), route/cron inventory and exact code SHA in the evidence report.
2. Copy the three `.example` files to ignored `config/*.isolated.json`. Provision a **new** `openpq-intelligence-<unique>-isolated-test` bucket. The named Core Worker owns its own new SQLite DO namespace. Do not bind an existing DO namespace or production bucket. Run `node scripts/check-isolation.js config/core.isolated.json config/runtime.isolated.json config/operator.isolated.json`. This checks config shape, not actual IAM scope.
3. Choose/pin the Wrangler version after checking the official release. Deploy Core first with the explicit isolated config. No route or cron may be added. Obtain the namespace's native ID for `idFromName(object_name)` through an authenticated temporary test-only provisioning route/tool. No self-registration endpoint is in the shipped service. Independently record and approve the locator mapping. The Core fails closed until it receives a correctly pinned `TRUST_JSON` secret; never disable the ID check to bootstrap.
4. Set Core secrets: `TRUST_JSON`, `PRINCIPALS_JSON`, `RECEIPT_SIGNING_JSON`. The trust map is keyed by dataset and includes account_id, environment, dataset, authority identity/version/hash, namespace ID, native ID, object name, recovery generation, activated artifact hashes, scoped receipt public keys and explicitly approved positive decision types. Fresh generation and signer for each locator migration. There is no production approval in this release.
5. Set Runtime secrets: the independently approved `TRUST_JSON`, `CONTROL_READ_TOKEN` and `S3_READONLY_CONFIG` with R2 S3 endpoint, bucket, access_key and secret. This credential must be **object-read only** for the isolated bucket. Runtime has no R2 Worker binding. Deploy with its explicit isolated config. Operator receives `TRUST_JSON` through Core only, and a service binding; it forwards operator capabilities and holds no universal command secret.
6. Bootstrap the test dataset once with a scoped bootstrap capability, publish only labelled synthetic fixtures, export `/export`, verify Runtime's full read path, and repeat the local adversarial scenarios on actual cloud resources. Inject R2 write/GET/sign/export failure, worker restart, concurrent commits, control mutation during external await, wrong namespace/old locator, expired manual evidence and Core outage/cold Runtime. Compare commit acknowledgements, SQL state, audit and outbox receipts. Provide timings and observation locations.
7. Perform capability-denial probes with the **actual Runtime R2 credential**: object PUT/DELETE must be denied; Core promote/control must be denied with the read capability. Use a disposable probe key in the isolated bucket. Any unexpected success is a failed gate, never a permission to continue.
8. Recovery test: freeze, increment/fence owner epoch, revoke/rotate old writer capability, run actual old-credential command and R2-write denial probes from relevant observation locations, then switch independently pinned trust and resume only after deny evidence and generation fencing. A single denied probe is not proof of global IAM propagation. Cloudflare documents up to about one minute for permission propagation; time elapsed alone is not the condition for resume. Any uncertain result keeps recovery BLOCKED.

## Evidence and policy limits

Record action ID, resource identity, code/config hashes, UTC timestamps, status/error classes and redacted request/response evidence. Never include tokens, private JWKs, S3 secrets or raw traveller location.

Positive fixture evidence booleans and per-input freshness values are supplied by a **trusted fixture writer**. They are not yet backed by the production policy registry/rule evaluator. `approved_positive_decision_types` is empty by default. Activation of real decision types, numerical thresholds, source freshness and licenses requires P01-P18 policy resolution and the remaining implementation. No cloud proof can substitute for domain-rule proof.

Outbox draining is explicit `/export` with an export capability. Automatic retry scheduler, capacity/backpressure, GC pinning and disaster/PITR restoration are pending. DO eviction tests preserve attached SQLite storage; they do not establish disaster recovery or RPO/RTO.

Official references checked 2026-10-01:
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- https://developers.cloudflare.com/r2/reference/consistency/
