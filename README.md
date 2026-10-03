# OpenPQ Intelligence

Current Core 2.0 checkpoint: **282/282 native tests and a real unattended 10/10 source reference feed on isolated Cloudflare**. Ten signed Cron publications and portable backups were independently verified after download. Actual signed samples pass 5 schemas, 50 positive and 150 negative checks. A second real Cron cycle advanced all ten Runtime revisions. Operational actions and public consumer cutover remain closed.

Read [current readiness](docs/READINESS_MATRIX.md), [next-owner checkpoint](docs/NEXT_OWNER_CHECKPOINT.md), and [pinned cloud evidence](evidence/core2-source-feed-20261003/CHECKPOINT.md). F15/milestone checkpoint headers are retained in docs/history.


Isolated authority/publication foundation for the locked V2.1 architecture. This is runnable code with local workerd proof, **not a production migration or a completed Intelligence system**.

Start with [free-thread handoff](docs/free-thread/00_START_HERE.md), [semantic foundation](docs/SEMANTIC_FOUNDATION.md), [implementation status](docs/IMPLEMENTATION_STATUS.md), [P0 inventory](docs/P0_INVENTORY.md), then [cloud proof](docs/CLOUD_PROOF.md) and [Cloudflare setup in Vietnamese](docs/CLOUDFLARE_TEST_SETUP.md). The immutable V2.1 handoff is under `docs/reference/v2.1`; its original V2 parent ZIP is retained unchanged. Implementation findings go in new ADRs/amendments, never edits to the reference release.

```sh
npm ci --ignore-scripts
npm run check
npm run verify:handoff
npm test
npm run replay:semantic
npm run rehearse:technical
npm run readiness:technical
npm run check:cloud-bundles
```

Node 24 is used in CI. No Cloudflare credential or production capability is needed for local tests. Wrangler is pinned to `4.145.0`, Miniflare to `4.20260730.0`; it executes the actual SQLite Durable Object and R2 API path. Legacy fixtures are synthetic; tests/data/real-cano contains explicitly labelled captured real bytes. All authority capabilities and receipt keys in local tests are ephemeral test credentials. No local proof authorizes a real travel decision.

Modules:

- `src/workers/core.js`: deterministic dataset dispatch to a pinned native DO ID.
- `src/workers/coordinator.js`: prepare immutable blob, verify hash, atomic SQLite commit/control/audit/outbox, owner epoch fencing, signed export.
- `src/workers/ingestion.js`: scheduled owned-reference producer with ten dataset-scoped source pumps; no bootstrap/control/signing/R2 capability.
- `src/workers/runtime.js`: committed blob reader, source-age and action expiry, bounded authority validation, signed cold checkpoint fallback. GET only; no R2 Worker write binding.
- `src/platform/s3-reader.js`: AWS SigV4 object GET adapter for a separately provisioned read-only R2 credential. Its permission boundary has actual isolated cloud PUT/DELETE denial and pinned disposable read-credential revocation evidence.
- `src/workers/operator.js`: separate console/API, forwards each operator's own capability. JoTrip Ops is not a command surface.

Current authority/Runtime Workers accept only local-test or isolated-test. No public consumer switch has been performed; the read-only consumer observation schedule is separate from Core admission. The separate manual Cano staging workflow deploys only by manual dispatch or its explicit cloud/manual-cano-staging test branch trigger. See [actual data intake](docs/MANUAL_CANO_DATA_INTAKE.md). P0 snapshot records parallel branches/worktrees; future changes must re-check exact latest main before their first write.

Historical M4/M5/M6 summaries are retained in [the milestone archive](docs/history/README_M4_M6_MILESTONES.md). They do not describe current permissions or readiness.
