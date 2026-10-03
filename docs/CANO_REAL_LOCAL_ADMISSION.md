# Narrow local real Cano admission

The existing real-shadow audit stays diagnostic and cannot emit a candidate. A separate `openpq-real-cano-admission-local-v1` profile activates only in local-test, through the existing trusted semantic_profile_hash and three bounded profile bindings. Synthetic profile v1 behavior and production closure remain intact.

`src/platform/real-cano-admission.js` recomputes exact raw SHA256/Git blob, pins the complete repository/commit/path tuple, runs the existing manual normalizer, checks recorded author/scope/day/explicit validity, and emits only a local recorded fact with ABSTAIN. Authority admission independently repeats producer checks. The pinned artifact refs identify contracts/configuration, not signed code or authenticated source authorship. Validity uses existing source confirmation-to-midnight policy rather than synthetic P05 values.

The Coordinator obtains actor from existing server principal authentication, then enforces manual-source-admit plus existing promote, LIVE/scope/locator/owner/epoch fences. Actor ID must be allowlisted in the trusted profile and match proof. Commit repeats checks; completed-command replay additionally checks current real-source actor permissions. A denied replay leaves the prior committed receipt and revision intact. Idempotency is not a permission bypass.

One source pin per operational day is allowed. Multiple same-day variants require amendment review, independent of timestamp/state. Only NORMAL is admitted; this profile does not introduce an amendment authority. Missing-author/scope-invalid historical records cannot be repaired by a profile flag. Recorded source metadata and operator authentication remain separate claims.

Source bytes in tests/data/real-cano are actual captured data (`fixture_only:false`); source-kind assurance does not turn local test capability/receipt keys into production auth. Positive tests using replay clocks say so explicitly. `scripts/rehearse-real-cano-local.js` uses actual wall clock, returns BLOCKED once the captured source expires, and tests native Core/SQLite/R2/receipt/Runtime, signed fallback, capability revocation and local freeze. No remote service is contacted.

The midnight replay proves expiry rather than renewal; Runtime returns DISPLAY_EXPIRED at exact local midnight, and fresh commit admission denies expired source. Local freeze is not deployment rollback. Production identity, operational action policy, G1 operational, G2 release, live writer/cron fences and consumer cutover remain open.
