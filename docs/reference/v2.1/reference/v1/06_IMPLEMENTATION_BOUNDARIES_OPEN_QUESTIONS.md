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
