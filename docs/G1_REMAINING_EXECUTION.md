# G1 execution after the first cloud subset pass

The released V2.1 reference remains immutable. This implementation evidence supplements it; no production gates are opened.

## Evidence already pinned

Run https://github.com/kenzuko/openpq-intelligence/actions/runs/36847033329 passed 12/12 cloud subset cases at a2a9eb32db7b2798b47a6a780734c756a69462bf. Raw public files and SHA-256 manifest are in evidence/cloud-36847033329. Preserve this directory as a snapshot; add a new directory for later runs.

## Next manual cloud run

Run cloud-proof.yml on the new main commit. The runner repeats the existing cases and adds response-loss retry, signer/outbox recovery, and observed Coordinator restart. A changed constructor incarnation must be seen before claiming a restart. Mere deployment success is insufficient. All probes use the dedicated test account and bucket. The loss proxy listens on loopback, never receives credentials from callers, and invokes only a closure over the authorized exact command.

These cases do not prove mid-transaction process crash, cross-region timeout, PITR or disaster recovery. Never relabel the complete T01-T63 matrix PASS from this subset.

## Retention and retry

No blob deletion or R2 lifecycle cleanup is enabled by this implementation. Keep all prepared/active/history/checkpoint objects until explicit retention policy and pin rules are approved. A lifecycle rule on the test bucket must also be inventoried before claiming retention proof. Pending outbox entries remain durable and manually retryable; the new signer-outage case checks eventual export without advancing authority again. Unattended scheduling, bounded backoff, backpressure, retry budget and GC remain unimplemented. Do not invent policy thresholds or enable a cron to make the gate appear complete.

## Separate R2 credential revocation proof

Use a disposable additional Object Read only credential scoped to the exact dedicated test bucket. Do not revoke or rotate the current Runtime credential as an experiment. First prove the disposable key can GET a known immutable object and record only its credential fingerprint, exact account/bucket/key, timestamp and digest. Then revoke that disposable credential through the owner's Cloudflare account UI. Poll actual signed GET of the same object until denial is observed, with a bounded deadline; timeouts, 404, DNS failure and network errors do not count as credential denial. Record observed HTTP status and propagation duration, not private key or authorization headers. Resume a writer/trust migration only after its required old-command and old-storage credentials are both observed denied. This probe is a dependency for later execution, not fulfilled by the command-capability outage case.

## Recovery and cost gates

Prepare restore into a distinct versioned authority generation, explicit locator migration and rejection of the old generation before enabling any restore/import command. RPO/RTO values require approved policy; local eviction and redeploy are not disaster restore. No automatic restore or production migration is authorized by this test runner.

Runner request counters and per-case duration are diagnostic measurements, not Cloudflare billed DO/R2 operations or monetary cost. Obtain actual isolated usage, billing metrics, concurrency profile and storage growth before selecting budgets or declaring quota/cost acceptance. The current deploy token has no blanket billing/admin permission; do not broaden it as a convenience.

## Domain pilot

After primitive gates and approved policies, choose one explicit domain pilot, pin the existing producer outputs and build golden-master comparisons. Keep existing Weather, Airport, Transit and public consumers independent until shadow acceptance and cutover gates pass. Manual cano fixtures here are synthetic protocol inputs, never today's operational confirmation.
