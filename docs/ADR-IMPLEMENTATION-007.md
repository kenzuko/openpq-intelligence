# ADR-007: isolated export scheduler and portable publication backup

Status: implementation amendment to M4/M5, source-independent technical preparation.

Counterexample/need: a passing local alarm does not prove the exported checkpoint path on actual cloud, and an in-memory backup object does not prove portable filesystem readback. Conversely, collecting unfinished legacy snapshots would lock a moving contract before owner freeze.

Decision: permit only explicit time-bound synthetic isolated scheduler proof; production stays closed. Add an exact Worker/class pair to the already dedicated test preflight, with export-only service/principal capability and observed cleanup. Preserve local contracts and old immutable evidence. Add exclusive portable backup files with completion marker and independent receipt trust. Add pure offline release-lock drift checks with no execution path. Do not read final legacy systems until owner announces they are complete.

Supersedes only M4/M5 wording that the scheduler has no isolated proof path; it does not supersede production/semantic/source/policy/PITR gates. Old snapshots/archives remain unchanged. Tests cover fixture scope/account/time, native alarm/capability disappearance, filesystem overwrite/tamper/incomplete/symlink failures, and code-vs-data release drift. Actual cloud evidence is pinned separately; no offline input claims deployment stop or cutover authorization.
