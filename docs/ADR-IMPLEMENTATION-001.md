# ADR-IMPLEMENTATION-001: isolated protocol milestone

Status: IMPLEMENTED LOCALLY; cloud gate BLOCKED. Parent: immutable V2.1/A001 in `docs/reference/v2.1`. No parent section is superseded.

This milestone implements the authority/publication spine before source integration. SQLite DO transactions cover control, active reference, dedup, audit and outbox. R2 owns immutable generation objects and exported projections. Runtime verifies the committed hash and independently pinned locator; it performs no source collection/resolution. An explicit `/export` operation drains up to five committed outbox entries per invocation and retries after failure. No implicit export is authority.

Prototype transport `openpq-candidate-v1` is a **subset harness**, not the complete V2.1 Evidence/Assertion/Canonical/Decision schema. Domain/entity mapping, license lineage, activated registry payloads, source revision reconciliation, hysteresis history and decision composition are not yet implemented. Activating real sources/decision types is blocked until complete contracts and golden-master parity exist. The fixture type `cano.operation.fixture` is synthetic; it is not a business pilot selection or an approved operational policy.

Concrete implementation review fixed two hazards without changing architecture: full account/environment/native ID/namespace/object-name equality is now part of authority matching, and exhausted checkpoint CAS retries are reported as failure so the outbox stays retryable. Both have local regression coverage. Scope pinning by configuration still depends on independently approved Runtime trust and correctly scoped signer credentials; the service cannot attest the correctness of its own deployment configuration.

Positive publication requires explicit `approved_positive_decision_types`, activated hash equality and complete/fresh/resolved fixture evidence. This does not yet prove the corresponding production rule/config/policy artifact contents. Default absence of approval denies positive publication. Production environments are denied at Worker and DO boundaries until the remaining gates are implemented and evidenced.

The minimal separate Operator Console is included early because it provides a concrete scoped command interface. It is a prototype, with no session management, SSO, rate limiting, threat-model completion or browser QA. It forwards the entered capability, keeps it in page memory and uses no shared superuser credential. JoTrip Ops remains read-only.

New design defects require a new counterexample-backed ADR/amendment with parent hash, superseded sections and tests. Implementation progress never edits the released reference documents.
