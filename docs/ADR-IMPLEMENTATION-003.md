# ADR implementation 003 - offline semantic foundation and free-thread entry

Status: implemented local subset; supplements immutable V2.1. No authority redesign or production admission.

Problem: publication primitives had cloud subset evidence, but the handoff still described semantic Evidence/Assertion/Canonical contracts without executable local examples. A next low-capability thread could conflate timestamps, missing values, mapping scope or replay with current emitted history, or overstate test status.

Decision: add a separate `openpq-semantic-fixture-v1` validator/registry and synthetic deterministic replay corpus. Exact artifact hash/version/kind/environment checks are code-owned; fixture environment is the only admitted environment. Keep this offline layer separate from existing Worker `openpq-candidate-v1`; a future semantic admission adapter requires a versioned wire contract and compatibility tests. Add explicit free-thread tasks with file ownership and expected evidence. Preserve released references and pinned cloud reports.

Counterexamples covered: cached source age does not renew on fetch, unknown/future time abstains, ambiguous/wrong scope does not create a positive fact, scoped official closure precedes manual confirmation, manual validity expires at the explicit day boundary, hash/version tampering fails, emitted and replay history stay distinct. These are synthetic tests, not new operating thresholds or real domain policy.

Validation: 72 local Node tests, eight golden replay cases, boundary/syntax/reference checks and four offline Worker bundles. Workers are unchanged; prior exact cloud evidence remains 15 protocol/resilience subset cases and separate R2 read-credential revoke proof. Full G1/G2 remain incomplete. Future tasks must not infer registry graph/policy/dependency compatibility from shape checks alone.
