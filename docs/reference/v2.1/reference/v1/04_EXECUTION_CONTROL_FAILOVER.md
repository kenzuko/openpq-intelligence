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
