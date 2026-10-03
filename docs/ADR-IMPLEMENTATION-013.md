# ADR-IMPLEMENTATION-013 - Isolated scheduled owned-reference ingestion

Status: implemented for isolated reference admission; operational action remains closed.
Date: 2026-10-03

A separate Source Worker dispatches ten dataset-specific SQLite source pumps every four minutes. Producers have only dataset-scoped read/promote/export/domain-source-admit actors, with no bootstrap, control, signing, R2 or production binding. The existing Core authority and GET-only Runtime boundary remains intact.

Refresh inherits the committed logical slot. Lost commit responses retry only the identical command; semantic denials are not converted into new commits. Pending exports are attempted before fetching source data. HTTP redirects are denied with the Workers-supported manual redirect mode. Repository data discovers exactly one main ref through bounded Git smart HTTP advertisement, then reads the immutable raw commit path and computes payload/Git blob identities. No repository credential is added.

The owned Forecast endpoint removes expired frames without changing its model cycle. Core permits same-time/different-input refresh only for the same Forecast profile when all non-frame fields match and new frames form an exact ordered subset of previously admitted frames. Every removed frame must have a valid time at or before authority evaluation. Added, reordered, changed or still-live removed frames remain denied. The check uses native previously admitted prepared data and fences the exact previous committed digest again inside the transaction. Older source times remain denied in all domains. This does not manufacture a model time or activate an operational freshness policy.

Actual null Airport scheduled times are preserved with an unresolved issue. Malformed times remain denied. Specialist source engines, UI, routes and public traffic remain unchanged.

Proof preserves signer, locator, native objects, control state and recovery generation, rotating only narrow actor bindings. Actual Cron publications must pass independent immutable receipt/hash verification and portable backup reopen. Backup parents are created before the exclusive COMPLETE-last export layout. Failure revokes writers and disables Cron; success retains only the narrow feed. Failed attempts remain archived.

Reference leases do not prove observation/model freshness. One signed publication window and a second public health observation do not prove SLA, 72-hour/seven-day gates, full restore, retention/cost or Airport's one-minute target. All decisions remain FACT/ABSTAIN, policies unactivated and independence unclaimed. Whole Core 2.0 production readiness remains false.
