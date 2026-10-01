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
