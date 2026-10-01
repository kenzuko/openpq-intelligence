# Semantic foundation - implementation subset

Version: `openpq-semantic-fixture-v1`. This supplements the immutable V2.1 design. It does not replace the current Worker candidate wire contract or activate a production domain. No new deployed Worker, collector, cron, source credential or R2 write is introduced.

## Implemented interfaces

| Interface | Code | Behavior |
|---|---|---|
| Source registry | `src/contracts/semantic.js: sourceRegistry` | Source namespace/type, time basis metadata, payload mode, declared snapshot completeness, exact policy/mapping refs, explicit budgets, credential reference only |
| Evidence | `evidence` | Separate evidence/source identities, payload/request hashes, explicit raw-storage disposition, known UTC source time or null with missing reason; collection time cannot replace source time |
| Assertion | `assertion` | Exactly value or missing_reason; null cannot stand for a known value; scope/entity/location versions, half-open validity, mapping ambiguity, manual author; forecast cycle and interval required |
| Canonical envelope | `canonical` | All eight artifact refs, evidence/assertion refs, independent quality axes, retention/access/replay capability; rejects publication revision or commit timestamp on a prepared generation |
| Fixture registry | `artifact`, `registry` | Content hash covers version/kind/environment/payload; exact ID/version/hash/kind lookup; duplicate versions rejected; copies and deep-freezes loaded artifacts; fixture-only activation |
| Replay kernel | `fixtureReplay` | Explicit evaluation time, prior-history hash, record kind and synthetic time policy; no fetch or wall-clock calls; no input mutation |
| Corpus runner | `scripts/replay-semantic.js` | Hand-specified expected effects/deadlines; repeats exact replay; asserts no mutation; emits deterministic input/output hashes |

Run `npm run replay:semantic`. The eight S01-S08 fixtures are original synthetic data. Their reference hashes are fixture placeholders, not real activated source/rule artifacts. They authorize no real-world operation.

## Synthetic decision semantics

The deliberately narrow `synthetic.operation.fixture` kernel considers only explicitly confirmed MANUAL assertions and explicitly closed OFFICIAL_REPORT assertions with matching exact scope. Eligible scoped closure precedes manual confirmation. Future/unknown/stale source time, ambiguous identity, missing value, incomplete/conflicting quality, or expired intervals cannot create a positive result. Action lifetime is the minimum of assertion, source age and source-validity deadlines. The supplied UTC interval in the fixture ends at 17:00Z, corresponding to the following midnight in Vietnam; the kernel does not infer operational-day boundaries from arbitrary source text.

EMITTED and REPLAY records have different decision identities. Input hashes bind evidence/assertions, policy, scope and prior history; stable ID sorting avoids locale-dependent ordering. This kernel is a contract demonstration, not the real Cano resolver or any Weather/Marine safety rule. It does not count mirrored providers as independent evidence or implement universal source ranking.

## Explicit limitations

These are executable JS validators, not a complete JSON Schema release. Mapping/adapter/resolver/rule/config/policy/schema artifact payloads receive structural/hash/kind checks only; their full domain schemas and approved compatibility matrices remain tasks. Registry refs in evidence are shape-checked; full graph resolution and retention/license activation are not wired to the publication Coordinator. Dependency manifests are structural placeholders, not validated cross-domain serving stamps. Forecast assertions have metadata checks, but forecast resolution is not implemented by the synthetic kernel.

The semantic layer is offline and separate from `openpq-candidate-v1`. Integration needs a new wire schema/version, migration/compatibility fixtures and a reviewed activation adapter. Do not add an optional unchecked field and claim semantic enforcement in Core. Do not replace a full policy activation with the fixture `environment_id` string.

## Review and acceptance

72 local Node tests pass, including 11 added semantic/corpus tests and existing workerd integration parents. Four offline Worker bundles pass. Actual cloud evidence remains the prior 15 protocol/resilience cases and the pinned R2 read-credential revocation proof. New semantic checks are local only. Full G1/G2 remain incomplete.
