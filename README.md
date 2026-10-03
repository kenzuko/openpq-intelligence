# OpenPQ Intelligence

Current Core 2.0 checkpoint: **268/268 native tests, 25/25 isolated cloud cases, 23/23 actual consumer outputs captured, 9/9 current-input native rehearsals**. Ten non-Cano source roles publish twice under one stable authority/profile; actual Airport bytes changed between captures. All 21 portable publication backups were independently reopened and signature verified. Operational actions and public consumer cutover remain closed.

Read [current readiness](docs/READINESS_MATRIX.md), [next-owner checkpoint](docs/NEXT_OWNER_CHECKPOINT.md), and [pinned cloud evidence](evidence/core2-continuous-reference-20261003/CHECKPOINT.md). F15/milestone checkpoint headers are retained in docs/history.


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
- `src/workers/runtime.js`: committed blob reader, source-age and action expiry, bounded authority validation, signed cold checkpoint fallback. GET only; no R2 Worker write binding.
- `src/platform/s3-reader.js`: AWS SigV4 object GET adapter for a separately provisioned read-only R2 credential. Its permission boundary has actual isolated cloud PUT/DELETE denial and pinned disposable read-credential revocation evidence.
- `src/workers/operator.js`: separate console/API, forwards each operator's own capability. JoTrip Ops is not a command surface.

All Workers reject production environments in this milestone. No production routes, scheduler or legacy modification is included. The separate manual Cano staging workflow deploys only by manual dispatch or its explicit cloud/manual-cano-staging test branch trigger. See [actual data intake](docs/MANUAL_CANO_DATA_INTAKE.md). P0 snapshot records parallel branches/worktrees; future changes must re-check exact latest main before their first write.

M4 technical preparation: [executable mechanisms, evidence and activation dependencies](docs/TECHNICAL_PREPARATION.md). 108 local tests/six bundles; deterministic rehearsal and native local DO alarm proof. Cloud progress activation and live semantic admission remain closed.

M5: [trusted local semantic authority integration](docs/SEMANTIC_ADMISSION_INTEGRATION.md). 121 tests/six bundles; synthetic ABSTAIN facts only, with native alarm/signed fallback and independent-trust backup signature checks. Explicit isolated regression branch cloud/protocol-regression-m5 does not enable cloud semantic or production admission.

Actual M5 protocol regression: run 36880999372, 15/15 subset PASS, cleanup SUCCESS; G1 remains NOT_PASSED. Raw evidence and three failed counterexamples are pinned separately.

M6 technical-only preparation: [scheduler, portable publication backup and release lock](docs/TECHNICAL_PREPARATION_M6.md). Legacy final read/integration waits for owner announcement; only explicit synthetic isolated proof may activate export scheduler. Production stays closed.

## M6 final technical-only preparation

129 tests and six offline Worker bundles pass. PR19 implements fixture-scoped cloud export-only SQL scheduler/alarm, portable publication backup and offline release-lock CLI. Actual cloud run 36889301581 at 2f777b35368fb21f3a61cbec782578ce7f6b1ce1 passed 7/7 technical subset cases, cleanup SUCCESS. Old export token 401, scheduler closure 503 and unchanged Runtime 200 publication witness were observed. Artifact 11175563456, SHA256 7afff7169d073fc8af4e9bb4c314466161c7fd9fcfe2a22df1d6b68fb03d187c, was downloaded and its partial publication backup reopened with separately pinned trust. Raw bytes, independent readback and three failed runner snapshots are pinned under docs/evidence/progress-*. This is not full-system backup, PITR, cloud semantic or full G1/G2.

Owner has not finished the old systems. Final legacy README/contracts/data reads and integration remain deferred until the owner announces completion. No intermediate exploratory legacy material is included as an M6 baseline. Production and real-domain admission stay closed. See TECHNICAL_PREPARATION_M6.md and ADR-IMPLEMENTATION-007.md. Earlier sections below preserve milestone chronology.

