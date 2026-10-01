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
