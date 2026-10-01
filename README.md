# OpenPQ Intelligence

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

Node 24 is used in CI. No Cloudflare credential or production capability is needed for local tests. Wrangler is pinned to `4.145.0`, Miniflare to `4.20260730.0`; it executes the actual SQLite Durable Object and R2 API path. Test fixtures are synthetic and authorize no real travel decision.

Modules:

- `src/workers/core.js`: deterministic dataset dispatch to a pinned native DO ID.
- `src/workers/coordinator.js`: prepare immutable blob, verify hash, atomic SQLite commit/control/audit/outbox, owner epoch fencing, signed export.
- `src/workers/runtime.js`: committed blob reader, source-age and action expiry, bounded authority validation, signed cold checkpoint fallback. GET only; no R2 Worker write binding.
- `src/platform/s3-reader.js`: AWS SigV4 object GET adapter for a separately provisioned read-only R2 credential. Its permission boundary has actual isolated cloud PUT/DELETE denial and pinned disposable read-credential revocation evidence.
- `src/workers/operator.js`: separate console/API, forwards each operator's own capability. JoTrip Ops is not a command surface.

All Workers reject production environments in this milestone. No production routes, scheduler or legacy modification is included. The separate manual Cano staging workflow deploys only by manual dispatch or its explicit cloud/manual-cano-staging test branch trigger. See [actual data intake](docs/MANUAL_CANO_DATA_INTAKE.md). P0 snapshot records parallel branches/worktrees; future changes must re-check exact latest main before their first write.

M4 technical preparation: [executable mechanisms, evidence and activation dependencies](docs/TECHNICAL_PREPARATION.md). 108 local tests/six bundles; deterministic rehearsal and native local DO alarm proof. Cloud progress activation and live semantic admission remain closed.

M5: [trusted local semantic authority integration](docs/SEMANTIC_ADMISSION_INTEGRATION.md). 117 tests/six bundles; synthetic ABSTAIN facts only, with native alarm/signed fallback and independent-trust backup signature checks. Explicit isolated regression branch cloud/protocol-regression-m5 does not enable cloud semantic or production admission.
