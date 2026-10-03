# Normal Transit consumer transfer - 04/10/2026

This is the normal owner-report consumer path, not frozen recovery writer resume. Whole Core 2 readiness remains false. Public Transit has not been switched to canonical authority.

## Implemented

- Explicit `canonical-transit-fact` scope in production account `1a64a0a081ea758f72be8254030bdf11`, enabled only with `CANONICAL_TRANSIT_GATE=TRANSIT_FACT_ONLY_V1`, one Transit dataset, pinned semantic profile and no positive decision types. Ordinary `production`, other accounts/domains and generic candidates stay denied.
- Transit-only fact profile preserves original provider reports, fares, dates, units, missing status times and errors. It does not activate travel/business policies or producer independence. Collector remains `kenzuko/transit-jotrip`.
- Reader uses a pinned Runtime origin/trust, verified current control, exact raw/projection digests, same receipt across both reads and deadline checked after body verification. A changed snapshot, expiry, wrong trust or upstream failure is denied. No automatic source fallback.
- Explicit `LEGACY` mode is consumer rollback; it does not change Core epoch/revision or writer permission. A read-only gateway and dataset-scoped source pump are prepared. Source cron defaults to disabled; gateway defaults to `LEGACY`.
- Four Wrangler bundles build locally. No production Core/Runtime/Source is deployed from these configs.

## Evidence and limits

Full local suite at the first implementation milestone passed 335/335, versus baseline 333. Final reader MIME handling and immutable capture pins have separate focused acceptance. New native tests use the replay clock `2026-10-03T21:46:00Z`; they are not live cloud observations.

The native test advances two actual captured owner snapshots through the actual SQLite Coordinator and signed R2 generation/receipt path. Runtime performs GET-only S3 reads via a mock transport with no Core write/R2 write binding. Legacy -> canonical -> explicit legacy reader rollback is tested, along with mixed-revision, expiry, wrong-trust and HTTP failure denial. Mock S3 permissions are not cloud credential proof. Two captured versions are not unattended live production updates.

First capture is the immutable existing fixture at Transit commit `07b47173870fc7629c872739bf08f0b6d329d7f9`. Second matches actual immutable commit `26f8927968e48f60b8151d93407f32ab9cf710dc` byte-for-byte; source pin is in `tests/data/transit-transfer/SOURCE_PIN.json`. Original generated times remain intact. Service-day changes are not relabeled as same-day observations.

Production inventory GitHub run `37156845927`, code `d50114385ef55db3bad0112a1923ed94e679fe20`, artifact `11285607811`, ZIP SHA256 `b166d182238c88da2fe758b7ad43c14b1c94874a2ef26cc03f89b5348a619797`: Workers, namespace inventory and existing public Worker settings/deployments allowed; R2 bucket inventory HTTP 403. Existing site account matches the handoff after trimming account-secret whitespace. The earlier run `37156773480` failed before any API operation on the untrimmed comparison; do not label that failure a bad account or a successful inventory.

No production signing/R2 credentials were created, no permissions broadened and no protected Worker deployed by the inventory. R2 403 does not prove there is no existing bucket; inventory is unknown. Read-only S3 credentials and account/bucket resource scope are not established for production. The `openpq-intelligence-canonical` bucket name in offline config is a planned exact scope, not evidence that it exists.

## Next execution

1. Independently verify CI on this feature commit and inventory all normal-transfer targets before write.
2. A new gateway in `LEGACY` mode can be deployed using the existing Worker deployment token without R2. It is preparation of the reader boundary, not `CANONICAL_TRANSFERRED`.
3. Before canonical deploy: establish the exact production R2 bucket and bucket-scoped Object Read credential, pin new native locator and public signing trust, preserve private recovery assets, bootstrap only the new Transit authority, commit an actual new source candidate, prove scoped source admission fencing and same-source parity, then switch/rollback/re-activate actual consumers.
4. Monitoring and cycle coverage continue alongside eligible scoped activation. Never turn an isolated reference profile into production data by relabeling it.

Weather and Near Me currently ingest through their public consumer URLs, so switching those URLs to Core would create a source loop. They require a source path separation before cutover; neither that separation nor the transient Cloud-source 503 blocks building the independent Transit path.
