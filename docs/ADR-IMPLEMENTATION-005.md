# ADR-IMPLEMENTATION-005: Prepare mechanisms before domain activation

Status: local implementation and native workerd evidence; production/live gates remain closed.

Context: primitive authority proof and actual owned manual SHADOW transport passed. Registry semantics, bounded unattended progress, portable integrity/recovery planning, monitoring/parity and operator verifier/guards can be implemented before domain policies and final provider bindings exist.

Decision: add side-effect-free preparation modules, a separate Node SQLite rehearsal runner and an export-only progress DO whose cloud activation is closed. Preserve the existing authority/publication Workers and all immutable evidence. Do not create a second truth store: preparation output cannot be submitted as a wire candidate, and scheduler calls only the existing Core export route in local tests.

The real domain configuration remains BLOCKED. Recorded policy approvals and offline session/review attestations never grant live authority. Domain kernels, live candidate wire checks, provider SSO/discovery/session storage, real monitoring/backup wiring and cloud acceptance depend on concrete reviewed inventory/policies. No thresholds, license rights, RPO/RTO or billed cost are invented.

Validation: deterministic integrated rehearsal; adversarial graph/value/time/secret checks; SQLite dedup/backpressure/leases/rate windows/retries/reopen; native workerd SQL/alarm/eviction; JWT signature/algorithm/issuer/audience/subject/expiry; backup corruption/active references and fenced restore plans; immutable evidence checks and Worker bundles. Exact release results are pinned separately.

Consequences: the remaining work is scoped activation/adapters/domain rules plus real evidence, not a blanket production switch. A concrete counterexample requires a new amendment with affected contract and test; V2.1/M2/M3 stay unchanged.
