# ADR-IMPLEMENTATION-009 - Fixture-only local Cano import and audit pipeline

Status: F13 offline implementation only - PROPOSED_NOT_ACTIVATED  
Date: 2026-10-02

## Context

F12 locks the raw Cano semantic adapter, deterministic revision wrapper and target-bound correction ledger. F13 needs a runnable local-file harness that proves those pieces can be composed without creating a production ingest path, publication authority or clock/network dependency.

## Decision

1. The manifest contract is `openpq-cano-offline-import-manifest-v1`. It requires `fixture_only:true`, an explicit target, explicit `evaluation_time`, and an ordered record list. Each record contains one relative raw file path, full provenance and explicit `supersedes` revision ID or `null`.
2. `src/ingress/manual-cano-import-pipeline.js` is the pure orchestration layer. It calls the existing F12 functions in order: `buildCanoShadowFromRaw()` -> `wrapCanoRevision()` -> `reduceCanoLedger()`. It does not mock or bypass M6/F12 validation.
3. `src/ingress/manual-cano-local-files.js` is the only file-system adapter. It uses local `fs`/`path` only. It rejects absolute paths, `..`, backslashes, path escape and symlink escape outside the real input root.
4. `scripts/import-manual-cano-offline.js` is a thin CLI. It takes `<input-root> <manifest-relative-path>`, emits exactly one canonical JSON object to stdout and uses stderr only for diagnostics/errors. It never reads credentials or environment variables.
5. Offline harness limits are fixed in code: maximum 64 records, 8,192 raw bytes per record, and 131,072 manifest bytes. These are test-harness safety limits only and are not operational quotas.
6. Evaluation time is always supplied by the manifest. F13 code does not use `Date.now()` or infer a newest record. `supersedes` is never inferred from time, input order, Git history or state.
7. The audit contract is `openpq-cano-offline-audit-v1`. It includes canonical manifest digest, exact manifest payload digest when loaded from file, exact raw payload digests, input indexes, source pointers, normalization/wrapper status, revision/wrapper IDs, target/evaluation, errors, diagnostic ledger and batch projection.
8. Any load/bytes/normalize/wrap failure fences the batch to `INVALID/UNRESOLVED`. A ledger computed from the healthy subset may be retained only under `diagnostic_ledger.diagnostic_only:true`; it is not the batch projection.
9. F12 target/evaluation preflight happens before raw records are processed. Graph errors such as missing `supersedes` target or cycle remain F12 ledger decisions and are surfaced by input index.
10. All F13 outputs hard-code `mode:"FIXTURE_ONLY"`, `action_eligible:false`, and `publication_admitted:false`. No Coordinator/Core/Runtime/semantic-admission integration is added.

## Determinism

- The manifest semantic digest hashes the stable canonical JSON object.
- Local-file mode separately records SHA-256 of the exact manifest bytes.
- Every raw input records SHA-256 of the exact bytes before UTF-8 decode/normalization.
- CLI output uses the existing stable canonical JSON serializer, so replay with the same files and explicit clock is byte-equivalent.
- Reordering clean equivalent graph inputs changes the per-input audit indexes as expected, but the F12 ledger projection remains deterministic because correction edges are explicit.

## Security boundary

Hashes bind bytes but do not authenticate the author or source. All bundled inputs are synthetic fixture-only data. The local path checks are harness containment, not a production sandbox or authorization framework.

## Non-goals

No live repository read/write, no cloud, no Workers/Durable Objects, no routes/cron/DNS, no persisted publication store, no credentials, no legacy production data, no G1/G2 admission, no production cutover.
