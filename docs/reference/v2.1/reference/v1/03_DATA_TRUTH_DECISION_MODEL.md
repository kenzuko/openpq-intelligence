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
