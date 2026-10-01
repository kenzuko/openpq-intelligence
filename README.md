# OpenPQ Intelligence

Isolated authority/publication foundation for the locked V2.1 architecture. This is runnable code with local workerd proof, **not a production migration or a completed Intelligence system**.

Start with [implementation status](docs/IMPLEMENTATION_STATUS.md), [P0 inventory](docs/P0_INVENTORY.md), then [cloud proof](docs/CLOUD_PROOF.md) and [Cloudflare setup in Vietnamese](docs/CLOUDFLARE_TEST_SETUP.md). The immutable V2.1 handoff is under `docs/reference/v2.1`; its original V2 parent ZIP is retained unchanged. Implementation findings go in new ADRs/amendments, never edits to the reference release.

```sh
npm ci --ignore-scripts
npm run check
npm run verify:handoff
npm test
npm run check:cloud-bundles
```

Node 24 is used in CI. No Cloudflare credential or production capability is needed for local tests. Wrangler is pinned to `4.145.0`, Miniflare to `4.20260730.0`; it executes the actual SQLite Durable Object and R2 API path. Test fixtures are synthetic and authorize no real travel decision.

Modules:

- `src/workers/core.js`: deterministic dataset dispatch to a pinned native DO ID.
- `src/workers/coordinator.js`: prepare immutable blob, verify hash, atomic SQLite commit/control/audit/outbox, owner epoch fencing, signed export.
- `src/workers/runtime.js`: committed blob reader, source-age and action expiry, bounded authority validation, signed cold checkpoint fallback. GET only; no R2 Worker write binding.
- `src/platform/s3-reader.js`: AWS SigV4 object GET adapter for a separately provisioned read-only R2 credential. Its real permission boundary still needs cloud probes.
- `src/workers/operator.js`: separate console/API, forwards each operator's own capability. JoTrip Ops is not a command surface.

All Workers reject production environments in this milestone. No production routes, automatic deployment, scheduler or legacy modification is included. P0 snapshot records parallel branches/worktrees; future changes must re-check exact latest main before their first write.
