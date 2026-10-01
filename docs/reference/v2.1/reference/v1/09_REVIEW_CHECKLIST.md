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
