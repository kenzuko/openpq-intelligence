# ADR-IMPLEMENTATION-008 - Offline Cano semantic shadow and correction ledger

Status: F12 offline implementation only - PROPOSED_NOT_ACTIVATED
Date: 2026-10-02

## Context

M6 already contains the trusted raw Cano manual normalizer `normalizeManualCano(raw, provenance)` and isolated staging transport. F11/F12 R2 lock the missing semantic layer: deterministic shadow identity, immutable revision wrappers, a target-bound correction ledger, and a compatibility projection that never creates publication authority.

F12 is intentionally local. It does not modify Coordinator, Core, Runtime, semantic admission, locator/trust/receipt, cloud bindings, workers, legacy repositories, routes, cron, DNS, or production credentials.

## Decision

1. `src/ingress/manual-cano-semantic.js` is the only new public raw adapter. `buildCanoShadowFromRaw()` accepts exact raw UTF-8 text plus provenance and calls the existing M6 normalizer itself.
2. The adapter removes only M6 `record_digest`, recomputes it using M6 `hash/stable`, validates normalized coherence, binds the immutable source pointer, and derives `revision_id` from the F11 identity material.
3. `validateCanoShadow()` is fixture/replay validation only. It recomputes pointer, digest and identity and keeps all authority fences false.
4. `src/ingress/manual-cano-lineage.js` validates deterministic revision wrappers and reduces a target-bound in-memory ledger. `supersedes` is explicit semantic input only. It is never inferred from time, arrival order, state, Git ancestry or a daily projection.
5. Target and evaluation clock are preflight checked before wrapper processing. Invalid target/time returns a structured fixture-only preflight rejection rather than a fake ledger result.
6. Wrapper errors are retained with input index and first prerequisite reason. Any wrapper/target validation error makes the ledger invalid and projection unresolved. Graph checks run only after wrapper validation and target binding are clean.
7. Exact duplicate wrappers collapse idempotently. Source-pointer/content conflicts, contradictory wrappers, missing/self/cyclic supersedes are invalid. Multiple graph terminals are ambiguous. A single quarantined terminal stays quarantined. Validity is `[valid_from, valid_to)`.
8. All shadow, wrapper, ledger, preflight and replay outputs hard-code `action_eligible:false` and `publication_admitted:false`.

## R2 coherence rules implemented

- dataset: `cano.operation.an-thoi`
- policy hash: `94172ce2e50559cad50e314598bbea5bad467cad0fa09973c82b0f58bcb85358`
- source repository: `kenzuko/Jotrip-Lab`
- source path: `data/marine_ops/manual-confirmations/<operational_day>-cano-an-thoi.json`
- scope: Cano / An Thới / Asia/Ho_Chi_Minh / `manual-cano-an-thoi-v1`
- `source_time === valid_from`, canonical UTC milliseconds
- source local day equals `operational_day`
- `valid_to` is next Vietnam midnight, including month/year rollover
- quarantine reasons are exact M6 order: author first, missing confirmation second
- caller-built normalized objects never become a trusted raw boundary

## Schema note

F12 copies the three R2 locked schemas into `schemas/` and adds `openpq-cano-preflight-rejection-v1.schema.json`, required by CONTRACT_LOCK_R2 for invalid target/evaluation-time responses. This schema is fixture-only and does not add a production wire.

## Consequences

The implementation can prove deterministic offline behavior and regression properties, but it does not prove current source trust, real operational state, admission, G1/G2, cloud readiness, publication eligibility or cutover readiness. Any future repository write must first recheck current main/tree/open PR state as required by F12 handoff.
