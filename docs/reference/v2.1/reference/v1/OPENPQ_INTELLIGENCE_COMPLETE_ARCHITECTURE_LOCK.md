# OPENPQ INTELLIGENCE - COMPLETE ARCHITECTURE REVIEW PACK



---

# FILE: 00_README_HANDOFF.md

# OPENPQ INTELLIGENCE - ARCHITECTURE REVIEW HANDOFF

**Date:** 2026-10-01  
**Status:** ARCHITECTURE LOCK CANDIDATE - REVIEW ONLY  
**DO NOT CODE - DO NOT DEPLOY - DO NOT MERGE - DO NOT CREATE PRODUCTION RESOURCES YET**

## Purpose

This package is the final architecture-review handoff for **OpenPQ Intelligence**, the future production intelligence platform behind Open Phu Quoc.

The next Work session should **challenge the architecture**, not implement it.

## Product model

OpenPhuQuoc, Weather, Airport, Transit, JoTrip Ops, future native apps, AI agents and partner-facing tools are **consumers**.

They are not independent production brains.

The desired model is:

> **One logical brain. One canonical publishing authority. Many independent consumers.**

This does not mean one Worker, one process, one schema or one monolith.

## Existing systems are assets

Current Weather, Airport and Transit systems already contain hard-won knowledge, stable logic, source semantics, guards, historical data and incident fixes.

The new platform must not destroy that work for the sake of architectural cleanliness.

The guiding principle is:

> **Greenfield architecture, not greenfield knowledge.**

Verified algorithms, source semantics, incident lessons and data history should be preserved, ported or re-homed with parity evidence.

## Review goal

Try to disprove the design before implementation begins.

Look for:

- hidden single points of failure
- stale-as-fresh paths
- split-brain or zombie writers
- data loss during migration
- truth-resolution ambiguity
- irreversible cutover
- accidental over-engineering
- Cloudflare lock-in
- weak operator governance
- inability to reproduce past decisions
- inability to survive a few days without human babysitting

See `07_WORK_REVIEW_PROMPT.md` for the exact independent review prompt.



---

# FILE: 01_ARCHITECTURE_LOCK_MASTER.md

# OPENPQ INTELLIGENCE - ARCHITECTURE LOCK V1 CANDIDATE

## 1. Logical platform

OpenPQ Intelligence is a **logical platform**, not one giant application.

The platform owns common concerns:

- contracts
- provenance
- source registry
- identity/location/time semantics
- authority
- scheduling semantics
- execution modes
- canonical publication
- lineage
- rule versioning
- health semantics
- observability
- cutover/rollback rules

Each domain owns its domain knowledge:

- Weather owns Weather semantics.
- Marine owns Marine semantics.
- Aviation owns Aviation semantics.
- Transit owns Transit semantics.
- Cano operations owns operational semantics.

The platform must never become a giant `if domain == ...` monolith.

## 2. Domain isolation

Domains must not directly import or depend on each other.

Forbidden:

```text
Weather -> Transit
Transit -> Airport
Airport -> Marine
```

Cross-domain decisions consume published canonical outputs:

```text
Weather canonical ----\
Marine canonical ------> Island State / decision composition
Transit canonical -----/
```

## 3. Canonical authority

"One source of truth" means:

> One authority may publish the official canonical state.

It does **not** mean one evidence source.

Conflicting evidence must be preservable.

Canonical may explicitly represent uncertainty.

## 4. Core data path

```text
SOURCE REGISTRY
      |
      v
EVIDENCE INGESTION
      |
      v
IMMUTABLE EVIDENCE
      |
      v
ASSERTIONS
      |
      v
NORMALIZATION
      |
      v
TRUTH RESOLUTION
      |
      v
CANONICAL STATE
      |
      v
DETERMINISTIC DECISION
      |
      v
RUNTIME API
      |
      v
CONSUMERS
```

## 5. World state vs system state

World state describes reality:

- weather
- sea condition
- flight status
- ferry operation
- cano operation
- attraction closure

System state describes the platform:

- collector health
- source availability
- watermark
- writer epoch
- active rule version
- incident state

Never infer false world state from system state.

```text
source failed != ferry cancelled
pipeline failed != no rain
no event != service normal
```

## 6. Evidence -> assertion -> resolution -> decision

### Evidence
What a source actually returned or asserted.

Immutable.

### Assertion
A structured statement derived from evidence, with explicit scope:

- variable
- location
- time
- horizon
- source
- source type
- validity

### Resolution
Versioned truth policy evaluates assertions.

It may conclude:

- resolved
- conflicting
- uncertain
- insufficient evidence

### Decision
Operational interpretation based on canonical state.

Examples:

- `GO`
- `WATCH`
- `HOLD`
- `CANCEL`
- `MOSTLY_FAVORABLE`

Decision is not evidence.

## 7. Execution modes

Every run declares one mode:

- `LIVE`
- `SHADOW`
- `BACKFILL`
- `REPLAY`

### LIVE
May promote production if it holds current authority.

### SHADOW
May ingest and compute real candidates.
Must not have permission to promote production.

### BACKFILL
May write historical state.
Must never activate current production state.

### REPLAY
May recompute historical decisions.
Must never trigger real-world side effects.

## 8. Authority and writer epochs

Each dataset has one active production authority.

Example:

```text
weather.current
owner = legacy-weather
epoch = 12
```

After migration:

```text
weather.current
owner = openpq-weather
epoch = 13
```

Epoch only increases.

Old writers may still run during migration but cannot promote canonical state.

This prevents zombie writers and split-brain.

## 9. Data plane and control plane

### Data plane

- evidence
- normalized history
- canonical versions
- active canonical state
- decisions
- historical decisions

Characteristics:

- large
- append-heavy
- versioned
- immutable where practical

### Control plane

- dataset authority
- writer epoch
- scheduler watermark
- active rule version
- source circuit state
- override state
- incident state
- cutover flags

Characteristics:

- small
- correctness-sensitive
- may require stronger transactional semantics

Storage technology is **not locked yet**.

## 10. Logical brain vs physical processes

One logical brain does not mean one process.

Executors may later be separated when justified by:

- execution duration
- dependency requirements
- secret isolation
- failure isolation
- scaling profile

Principle:

> Modular first, distributed only when needed.

## 11. Core / Runtime separation

Core:

- collect
- normalize
- resolve truth
- decide
- publish canonical state

Runtime:

- read canonical state
- expose stable contracts
- expose provenance/freshness
- serve bounded Last Known Good according to policy

Core failure must not erase the final canonical snapshot.

Runtime failure must not stop Core collection.

## 12. Consumer rules

Consumers include:

- OpenPhuQuoc
- specialist Weather UI
- specialist Airport UI
- specialist Transit UI
- JoTrip Ops
- future apps
- AI agents
- partner APIs

Consumers:

- do not own shared production collectors
- do not write canonical truth
- do not independently reconstruct hidden truth logic
- do not depend on object-storage layout



---

# FILE: 02_NON_NEGOTIABLE_INVARIANTS.md

# NON-NEGOTIABLE INVARIANTS

## Data correctness

1. Missing is never converted to zero.
2. Unknown is never converted to safe.
3. Stale is never converted to fresh.
4. Publication time never substitutes for source time.
5. One source is never relabeled as another.
6. Model data is never presented as observation.
7. Observation is never treated as forecast.
8. Different spatial scopes are never silently merged.
9. Different temporal resolutions are never silently interpolated.
10. Newer data is not automatically better data.

## Evidence/history

11. Raw evidence is immutable.
12. Corrections append/supersede; they do not rewrite history.
13. Historical decisions already emitted remain immutable.
14. Replay output is distinct from historical emitted decisions.
15. Provenance survives migration.

## Publishing

16. Immutable version first, active manifest last.
17. Partial generations never become active.
18. Active state never regresses to an older logical slot.
19. Backfill/replay cannot promote current production.
20. Shadow has no production promotion permission.
21. Duplicate delivery must not duplicate side effects.

## Authority

22. One active production authority per dataset.
23. Writer epochs increase monotonically.
24. Old writers cannot regain authority by restarting.
25. Git branch identity does not grant authority.

## Decisions

26. No evidence of danger is not evidence of safety.
27. Decisions may abstain.
28. `UNCERTAIN`, `CONFLICTING`, `INSUFFICIENT_EVIDENCE` are legitimate states.
29. High-impact decisions require minimum evidence contracts.
30. Same input + same rule/config/time => same output.
31. AI does not resolve production truth in V1.
32. AI may explain structured decisions.

## Manual truth

33. Manual truth always has scope.
34. Manual truth has effective time and expiry.
35. Overrides may expire, be revoked or be superseded.
36. Manual truth is not globally authoritative outside scope.
37. High-impact operator changes are auditable and reversible.

## Failure isolation

38. One domain failure does not stop unrelated domains.
39. Core failure does not erase canonical data.
40. Runtime failure does not stop collection.
41. Failing sources use bounded retry/backoff/circuit behavior.
42. Service, pipeline, source and data health are distinct.

## Migration

43. New systems are promoted only after parity/shadow evidence.
44. Verified old behavior is not rewritten just for cleanliness.
45. Cutover is reversible per dataset.
46. Code rollback does not silently roll back data.
47. Code rollback, rule rollback and authority rollback are distinct.

## Platform discipline

48. Domains do not import other domains directly.
49. UI concerns do not enter source adapters.
50. Storage layout is not a public API.
51. Cloudflare-specific primitives stay behind platform boundaries where practical.
52. New infrastructure is added only to remove a concrete risk/failure mode.



---

# FILE: 03_DATA_TRUTH_DECISION_MODEL.md

# DATA, TRUTH AND DECISION MODEL

## 1. Source Registry

Each source should have formal metadata:

```text
source_id
provider
domain
source_type
scope
geography
timezone
cadence
expected_latency
unit_semantics
payload_mode
authentication_class
quality_class
fallback_group
license
raw_storage_allowed
retention_class
redistribution_policy
```

`payload_mode` distinguishes:

- `FULL_SNAPSHOT`
- `DELTA`
- `EVENT_STREAM`

Missing records have different semantics in each mode.

## 2. Identity Registry

Source IDs are not canonical entity IDs.

Need canonical identity support:

```text
entity_id
entity_type
source_namespace
source_entity_id
aliases
valid_from
valid_to
```

Examples:

- operating vs marketing flight
- ferry routes
- ports
- attractions
- observation points

## 3. Location Registry

Locations are versioned.

```text
location_id
lat
lon
geometry_type
scope
valid_from
valid_to
```

Changing a marine point means a new version, not silently editing the old location.

## 4. Time semantics

Explicitly distinguish:

```text
source_time
valid_from
valid_to
received_at
collected_at
normalized_at
published_at
evaluation_time
```

Store canonical timestamps in UTC.

Operational-day logic uses `Asia/Ho_Chi_Minh`.

Preserve source timezone when relevant.

## 5. Units and intervals

Units and measurement windows belong in the schema.

Prefer:

```text
rain_mm_3h
wind_ms
gust_ms
wave_hs_m
```

Avoid ambiguous fields:

```text
rain = 3
wind = 8
```

## 6. Truth resolution scope

Truth resolution depends on:

- variable
- location
- time
- forecast horizon
- source class
- recency
- coverage
- agreement
- spatial fit

There is no universal rule such as `METAR > ECMWF > ICON`.

## 7. Evidence quality

Avoid fake precision such as `confidence = 87%` unless empirically calibrated.

Prefer structured dimensions:

```text
recency: HIGH
coverage: MEDIUM
source_quality: HIGH
agreement: LOW
spatial_fit: HIGH
```

## 8. Canonical state

Canonical means:

> Official state OpenPQ currently publishes, including uncertainty and lineage.

Possible states include:

- `READY`
- `PARTIAL`
- `DEGRADED`
- `UNCERTAIN`
- `CONFLICTING`
- `INSUFFICIENT_EVIDENCE`
- `STALE`
- `UNAVAILABLE`

## 9. Completeness contracts

Schema-valid data may still be incomplete.

Examples:

Weather:

- variables
- horizons
- spatial coverage
- gust coverage

Transit:

- expected operators
- routes
- date scope

Airport:

- arrivals/departures
- update latency

Completeness logic must distinguish:

```text
EXPECTED_AND_MISSING
NOT_EXPECTED
SOURCE_UNAVAILABLE
SERVICE_SUSPENDED
UNKNOWN
```

## 10. Sanity/anomaly checks

Schema correctness does not imply semantic correctness.

Extreme or impossible values should be:

- flagged
- cross-checked
- quarantined when appropriate

Never silently rewrite an anomaly into a more comfortable value.

## 11. Decision contract

A decision should carry:

```text
decision_id
decision_type
scope
generated_at
valid_from
valid_to
evaluation_time
rule_set_id
rule_version
config_version
input_refs
reason_codes
evidence_quality
state
```

Reason codes may include:

```text
WAVE_HIGH
GUST_HIGH
HEAVY_RAIN
SOURCE_DISAGREEMENT
SOURCE_STALE
GROUNDTRUTH_STALE
INSUFFICIENT_COVERAGE
MANUAL_OVERRIDE_ACTIVE
OFFICIAL_CLOSURE
```

## 12. Determinism

```text
same input refs
+ same rule version
+ same config version
+ same evaluation time
= same decision
```

Business logic must not depend on hidden `Date.now()`, mutable globals or live external calls.

## 13. State transitions

Some operational state should support hysteresis.

Example:

```text
enter HOLD at threshold A
leave HOLD only below threshold B for duration T
```

Recovery may require more evidence than degradation.

## 14. Explicit priority

Example:

```text
official closure
  > scoped operational manual closure
  > automated safety decision
  > favorable model conditions
```

Priority is versioned policy, not scattered `if/else` behavior.

## 15. Island State

Island State is derived and records exact inputs:

```text
weather.current -> run_x
weather.marine -> run_y
airport.live -> run_z
transit.network -> run_a
cano.operation -> run_b
```

Island State is not automatically fresh simply because it was regenerated recently.

Input freshness remains visible.

## 16. AI boundary

AI may:

- explain decisions
- summarize structured state
- translate presentation
- answer lineage questions

AI does not:

- resolve production truth in V1
- directly convert raw data to operational state
- change active rules automatically



---

# FILE: 04_EXECUTION_CONTROL_FAILOVER.md

# EXECUTION, CONTROL PLANE AND FAILOVER

## 1. Scheduler authority

One orchestration authority, but domain-specific cadence/execution policies.

Possible triggers:

- cadence
- event
- model cycle
- manual

## 2. Watermarks

Scheduler must track logical completion, not merely "current slot".

After downtime a domain policy decides whether to:

- catch up missing slots
- skip obsolete slots
- rebuild latest only
- backfill historical gaps

## 3. Idempotency

Assume at-least-once execution.

Logical job identity should include:

```text
dataset
logical_slot
execution_mode
authority_epoch
```

Duplicates must be safe.

## 4. Executor selection

Execution technology is intentionally not fixed.

Choose the simplest fit per domain:

- direct Worker execution
- queue
- workflow
- specialized executor

Selection criteria:

- execution duration
- retry needs
- dependencies
- security
- failure isolation
- scaling profile

## 5. Circuit breakers

Lifecycle:

```text
CLOSED
OPEN
HALF_OPEN
```

Distinguish:

- 429
- timeout
- network error
- TLS failure
- 5xx
- schema invalid
- semantic invalid

## 6. Source budgets

Possible controls:

```text
max_requests_per_window
max_concurrency
max_retries
timeout
max_payload_bytes
redirect_policy
```

Budget exhaustion is explicit system state.

## 7. Health model

Track separately:

```text
service_health
pipeline_health
source_health
dataset_health
decision_health
```

Example:

```text
Runtime       HEALTHY
Core          HEALTHY
Transit job   HEALTHY
Binh An       FAILED
Transit data  PARTIAL
Island state  WATCH
```

## 8. Heartbeat semantics

Health means progress, not process uptime.

Track:

- last successful collection
- last canonical promotion
- watermark advancement
- backlog age
- active manifest age

## 9. External sentinel

Future requirement:

An external synthetic check should live outside the system path it monitors.

Do not rely on Core alone to report that Core is alive.

## 10. Incidents

Incident lifecycle:

```text
OPEN
ACKNOWLEDGED
MITIGATED
RESOLVED
```

Deduplicate repeated failures by incident identity.

## 11. Manual overrides

Lifecycle:

```text
PENDING
ACTIVE
SUPERSEDED
EXPIRED
REVOKED
```

Mandatory metadata:

```text
scope
effective_from
expires_at
reason
operator_ref
```

## 12. Break-glass controls

Must be scoped.

Examples:

- freeze one dataset's publication
- disable one source
- disable one rule
- force one dataset into safe degraded mode

Avoid global platform kill switches where possible.

## 13. Failover

### Source fails
Retry/backoff/circuit.
Use alternatives only if semantically valid and correctly attributed.

### Collector fails
Keep Last Known Good.
Freshness ages naturally.

### Core fails
Runtime continues serving canonical LKG according to policy.

### Runtime fails
Core continues collecting/publishing.

### Canonical store temporary issue
Bounded cache may serve LKG where allowed.
Never relabel it Fresh.

### Full primary-provider outage
V1 does not require active multi-cloud.
Design for optional offsite cold DR later.

## 14. Backup/recovery

Backup scope eventually includes:

- evidence
- canonical data
- source registry
- schema registry
- rules
- authority/control state

Secrets restore separately.

Backup is not considered complete until restore is tested.

## 15. Privilege direction

Desired direction:

```text
Core      -> canonical READ/WRITE
Runtime   -> canonical READ ONLY
Consumer  -> Runtime HTTP READ
```

Source credentials are available only to the executors that need them.

## 16. Observability

Each run should expose structured metadata:

```text
run_id
dataset
source
execution_mode
authority_epoch
scheduled_at
started_at
finished_at
duration
retry_count
records_in
records_out
source_age
completeness
publish_result
```



---

# FILE: 05_MIGRATION_AND_CUTOVER_LOCK.md

# MIGRATION AND CUTOVER LOCK

## 1. Principle

Do not replace a stable system simply because the new architecture is cleaner.

Protect verified behavior and data first.

## 2. Existing verified assets

Examples that should be preserved unless explicitly disproven.

### Weather

- model-cycle semantics
- ECMWF 3h handling
- no fake interpolation
- gust coverage rules
- marine semantics
- groundtruth separation
- satellite/observation logic
- freshness/stale guards
- Human Weather behavior
- incident fixes

### Airport

- live update behavior
- flight mapping
- known fallback behavior
- operational status semantics

### Transit

- date-specific schedule policy
- no fake seat count
- stale guards
- monotonic publication
- operator provenance
- source-specific failures

## 3. Verified kernels

Do not inherit legacy application architecture.

Verified pure algorithms may be:

```text
extract
document
freeze fixtures
differential test
port/re-home
```

Do not rewrite proven behavior just for aesthetic purity.

## 4. Migration sequence

### A. Inventory

Inventory:

- producers
- schedulers/cron
- source endpoints
- outputs
- historical datasets
- schemas
- retention
- incidents
- rules
- credentials
- data locations

### B. Golden Masters

Create frozen real-world regression cases.

Include:

- TLS/source expiry
- partial operator coverage
- model-cycle regression
- missing gust coverage
- model/groundtruth disagreement
- cano manual verification
- mid-day closure
- airport count mismatch
- HTTP 200 invalid semantics
- duplicate jobs
- manifest races

### C. Mirror

Legacy remains production.
New system only mirrors/normalizes outputs.

### D. Shadow

Candidate logic runs without production authority.

Compare at field level:

```text
value
timestamp
missingness
unit
coverage
source attribution
status
freshness
decision
```

Comparison class:

```text
EXACT
TOLERANCE
SEMANTIC_EQUIVALENCE
EXPECTED_DIFFERENCE
```

### E. Difference verdict

Classify differences:

```text
legacy bug
new bug
intentional improvement
source changed
timing difference
unknown
```

Never assume old or new automatically wins.

### F. Authority transfer

Per dataset:

```text
legacy epoch 12
       ->
new writer epoch 13
```

### G. Consumer transfer

Consumers move independently:

- domain page
- homepage/Island State
- Ops
- specialist viewer

No big-bang required.

### H. Producer re-home

After parity is stable, move producer logic away from lab repos where true independence requires it.

Re-home/port is allowed.
Rewrite is not mandatory.

### I. Old cron retirement

Disable old scheduler only after:

- new cadence evidence
- canonical promotion evidence
- consumer cutover
- tested rollback

### J. Kill tests

Required:

```text
turn off Weather lab repo
-> production Weather still updates

turn off Airport lab repo
-> production Airport still updates

turn off Transit lab repo
-> production Transit still updates

turn off OpenPhuQuoc UI
-> Core + Runtime continue

break one source
-> unrelated domains continue

break Core
-> Runtime serves aging LKG

break Runtime
-> Core continues publishing
```

## 5. Historical continuity

Raw legacy evidence remains untouched.

Legacy history may be mapped to canonical history using versioned migration mappers.

Preserve:

```text
original source time
original ingestion time if known
migration time
mapper version
original provenance
```

## 6. Rollback

Rollback is per dataset.

Producer rollback creates a **new epoch**.

Example:

```text
epoch 13 new producer fails
epoch 14 legacy producer restored
```

Never decrement epoch.

Code rollback, rule rollback, authority rollback and data correction remain separate.

## 7. No-cutover rule

Before final approval do not:

- disable legacy producers
- disable legacy cron
- archive lab repos
- redirect production consumers
- change canonical authority
- perform irreversible data migration



---

# FILE: 06_IMPLEMENTATION_BOUNDARIES_OPEN_QUESTIONS.md

# IMPLEMENTATION BOUNDARIES AND OPEN QUESTIONS

Architecture is intentionally locked above specific technology choices.

These remain implementation decisions for final review.

## A. Control Store

Needs semantics for:

- authority epoch
- watermark
- active rules
- override state
- source circuit state
- incident state
- cutover flags

Candidates may include:

- D1
- Durable Object
- hybrid
- another approach

Decision criteria:

- atomicity
- concurrency
- recovery
- operational simplicity
- portability

## B. Canonical/Evidence Store

R2 is a strong candidate for:

- immutable evidence
- canonical versions
- historical snapshots
- LKG

Still review:

- prefix/version strategy
- lifecycle/retention
- public/private access
- checksums/content hashes
- DR export

## C. Executor model

Choose per domain:

- direct Worker
- Queue
- Workflow
- specialized executor

Do not force all domains into one mechanism.

## D. Runtime topology

Review whether V1 needs:

- one Runtime Worker
- internal read service
- gateway only later

Bias toward simplest topology preserving failure isolation.

## E. Rule Registry

Required lifecycle:

```text
DRAFT
SHADOW
APPROVED
ACTIVE
RETIRED
```

Activation/rollback must be auditable.

## F. Source Registry

Possible forms:

- code-owned
- controlled configuration
- small database
- versioned file with controlled activation

Do not make it an unrestricted CMS.

## G. Identity Registry

Need canonical identity management for future domains:

- flights
- ferry trips
- routes
- ports
- attractions
- weather/marine points
- hotels
- events

## H. External sentinel

Technology deferred.

Requirement:

- outside primary system path
- verifies progress/freshness, not only HTTP uptime

## I. Offsite DR

Not required as active multi-cloud in V1.

Architecture should allow later:

- periodic cold snapshot
- restore drills
- provider-independent archival

## J. 2-5 year scale test

Test future domains:

- road traffic
- crowds
- hotel inventory
- events
- attraction status
- air quality
- pricing
- partner feeds
- AI agents

The design passes if new domains can be added without:

- modifying unrelated domain code
- creating a second truth plane
- giving consumers direct source dependencies
- creating hidden cross-domain imports



---

# FILE: 07_WORK_REVIEW_PROMPT.md

# PROMPT FOR FINAL WORK REVIEW

Use this prompt with the full package.

---

You are reviewing the proposed architecture for **OpenPQ Intelligence**, the future production intelligence platform behind Open Phu Quoc.

Do **not** implement code yet.

Act as a hostile-but-constructive architecture reviewer.

## Context

Current Weather, Airport and Transit systems already contain substantial verified logic, source semantics, history and operational fixes.

The goal is not to rewrite that knowledge blindly.

The goal is to create a clean production intelligence platform with:

- one logical brain
- one canonical publishing authority
- multiple evidence sources
- many independent consumers
- execution/failure isolation
- no hidden production dependency on old lab repositories

Eventually the specialist lab repos should be turn-off-able without stopping production data updates.

## Review tasks

Read every Markdown file in the package.

Then:

1. Identify contradictions.
2. Identify missing failure modes.
3. Identify accidental single points of failure.
4. Identify split-brain/zombie-writer risks.
5. Identify stale-as-fresh paths.
6. Identify places canonical truth may destroy useful conflicting evidence.
7. Identify migration steps that could damage stable Weather/Airport/Transit behavior.
8. Identify over-engineering.
9. Identify prematurely locked technologies.
10. Stress-test 2-5 year growth:
   - road traffic
   - crowds
   - hotel inventory
   - events
   - attractions
   - air quality
   - pricing
   - partner feeds
   - AI agents
11. Stress-test operator behavior:
   - wrong override
   - stale manual truth
   - forgotten flag
   - old cron restarts
   - partial rollback
12. Stress-test disaster/recovery:
   - Core down
   - Runtime down
   - storage unavailable
   - provider outage
   - corrupted source
   - schema-valid but semantically wrong data
13. Review portability and Cloudflare lock-in.
14. Review lineage, retention and licensing assumptions.

## Constraints

Do not recommend rewriting verified legacy algorithms without a concrete reason.

Do not add infrastructure just because it exists.

Every new component must remove a specific failure mode or operational risk.

Prefer durable invariants over layers of ad-hoc fallback logic.

## Required output

### A. Architecture verdict
Choose one:

- `READY TO DESIGN IMPLEMENTATION`
- `READY WITH REQUIRED CHANGES`
- `NOT READY`

### B. Required corrections
Only blockers before implementation.

### C. Optional improvements
Useful but non-blocking.

### D. Simplification opportunities
What can be removed safely.

### E. Final component boundaries
Responsibilities only, no code.

### F. Unresolved technology decisions
Examples:

- Control Store
- Queue vs Workflow
- source registry storage
- rule registry storage
- DR mechanism

### G. Implementation entry criteria
A checklist that must be true before production-oriented implementation begins.

Do not merge, deploy or connect to production during this review.

---



---

# FILE: 08_SUPERSEDED_IDEAS.md

# SUPERSEDED IDEAS - DO NOT REINTRODUCE WITHOUT NEW EVIDENCE

## 1. Put the brain inside OpenPhuQuoc Home
Rejected.

OpenPhuQuoc is a consumer/product UI.

## 2. One Worker does everything
Rejected.

One logical brain does not mean one physical process.

## 3. R2 is the only state store
Not locked.

R2 fits evidence/canonical object data, but control state may need different semantics.

## 4. One Queue for everything
Not locked.

Execution technology is domain-dependent.

## 5. Rewrite Weather/Airport/Transit from scratch
Rejected.

Preserve verified logic and knowledge.
Use golden masters, differential tests and re-home/port where appropriate.

## 6. Newer snapshot always wins
Rejected.

Candidates must pass semantic and completeness checks.

## 7. Manual truth always wins
Rejected.

Manual truth only has authority according to scope/time/policy.

## 8. Confidence score 0-100 by default
Rejected for V1 unless empirically calibrated.

Prefer structured evidence-quality dimensions.

## 9. Canonical means certainty
Rejected.

Canonical may explicitly communicate uncertainty/conflict.

## 10. Cached data means repo independence
Rejected.

True independence means production data continues updating without lab repos.

## 11. Big-bang cutover
Rejected.

Authority and consumer cutover are per dataset/domain.

## 12. AI is the truth resolver
Rejected for V1.

AI is an explainer/consumer of structured truth.



---

# FILE: 09_REVIEW_CHECKLIST.md

# FINAL REVIEW CHECKLIST

## Truth

- [ ] Conflicting evidence can be preserved.
- [ ] Unknown is distinct from zero/false/safe.
- [ ] Forecast and observation are distinct.
- [ ] Spatial/time scope is explicit.
- [ ] Canonical uncertainty is representable.
- [ ] Truth resolution is versioned.

## History

- [ ] Evidence is immutable.
- [ ] Corrections append/supersede.
- [ ] Historical decisions are immutable.
- [ ] Replay cannot overwrite historical emitted decisions.
- [ ] Migration preserves provenance.

## Publishing

- [ ] Partial generations cannot become active.
- [ ] Active state cannot regress.
- [ ] Backfill cannot activate current state.
- [ ] Shadow cannot promote production.
- [ ] Duplicate jobs are safe.

## Authority

- [ ] One active writer per dataset.
- [ ] Writer epoch blocks zombies.
- [ ] Authority rollback creates a new epoch.
- [ ] Git branch does not define authority.

## Scheduling

- [ ] Scheduler uses watermarks.
- [ ] Catch-up policy is domain-specific.
- [ ] Missed scheduler ticks do not silently lose required work.
- [ ] Source budgets/backoff are represented.

## Decisions

- [ ] Deterministic decisions.
- [ ] Input/rule/config versions recorded.
- [ ] Scope and validity explicit.
- [ ] Abstention supported.
- [ ] High-impact decisions define minimum evidence.
- [ ] Hysteresis/state transitions possible.
- [ ] AI is not a hidden decision authority.

## Manual operations

- [ ] Manual truth is scoped.
- [ ] Overrides expire.
- [ ] Overrides can be revoked/superseded.
- [ ] Operator actions are audited.
- [ ] Break-glass controls are scoped.

## Health

- [ ] World state distinct from system state.
- [ ] Service/pipeline/source/data health distinct.
- [ ] Heartbeats measure progress.
- [ ] Incidents deduplicate repeated errors.
- [ ] External monitoring is possible.

## Migration

- [ ] Existing verified behavior protected.
- [ ] Golden masters required.
- [ ] Shadow parity is field-level.
- [ ] Differences are classified.
- [ ] Cutover is per dataset.
- [ ] Old cron retirement requires evidence.
- [ ] Lab repo kill-tests required.

## Extensibility

- [ ] Domains do not directly import other domains.
- [ ] Shared platform responsibilities remain domain-neutral.
- [ ] Runtime API independent of storage layout.
- [ ] Cloudflare-specific implementation can be isolated.
- [ ] Future domains do not require a second truth plane.



---

# FILE: 10_IMPLEMENTATION_ENTRY_CRITERIA.md

# IMPLEMENTATION ENTRY CRITERIA

No production-oriented implementation should start until these are accepted.

## Architecture artifacts

- [ ] Architecture Lock approved.
- [ ] Non-negotiable invariants approved.
- [ ] Truth/Decision model approved.
- [ ] Migration/Cutover plan approved.
- [ ] Final independent Work review completed.
- [ ] Required corrections incorporated.

## Inventories required before source migration

- [ ] Weather producer inventory.
- [ ] Airport producer inventory.
- [ ] Transit producer inventory.
- [ ] Existing cron/scheduler inventory.
- [ ] Output/schema inventory.
- [ ] Historical-data inventory.
- [ ] Known-incident corpus.
- [ ] Verified-rule inventory.
- [ ] Source/license/retention inventory.

## Recommended first implementation sequence

```text
1. contracts
2. domain boundaries
3. source-registry model
4. identity/location/time semantics
5. evidence model
6. canonical publication model
7. authority/control interfaces
8. execution-mode model
9. rule/decision interfaces
10. deterministic test harness
11. incident/golden-master fixtures
12. only then integrate the first real producer
```

Weather is a strong first real producer **only after** its golden-master corpus exists, because it stresses:

- multiple source types
- model vs observation
- spatial semantics
- marine semantics
- freshness
- human-facing decisions
- substantial verified legacy knowledge

## Production lock

Until explicit approval:

- no DNS change
- no production Worker deployment
- no production R2 canonical activation
- no production Queue/Workflow activation
- no consumer cutover
- no legacy cron retirement

