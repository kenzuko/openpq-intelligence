# M6: technical preparation only, legacy integration deferred

Owner clarified 2026-10-01: legacy systems are unfinished. Do not research their final README/contracts/data or prepare a migration against intermediate versions. Wait for the owner to announce completion, then perform a fresh read-only inventory. Earlier exploratory reads are not a release baseline and are not included in this release's evidence.

## Implemented technical paths

| Mechanism | Behavior | Explicit limit |
|---|---|---|
| Native export scheduler | Existing local SQL/alarm path plus explicit isolated fixture activation, account/dataset/config/policy/time pins, authenticated scoped export-only jobs | Only `fixture.*`, SYNTHETIC technical proof; production always blocked, no periodic cron, no real-domain activation |
| Portable publication backup | Exclusive directory, individual canonical objects, fsync, completion marker last, independent receipt/signature/hash verification on readback | Partial publication backup; unsigned control/audit metadata, full-system consistency, PITR/RPO/RTO and writer resume not proven |
| Immutable release lock | Exact repo/branch/code SHA/contract hashes; code/contract/route drift blocks, same-contract data commits may keep updating | Offline inputs only; cannot prove stopped deployments or authorize cutover |
| Explicit cloud proof workflow | Fresh isolated native identity/bootstrap, export-only capability, native scheduler alarm, signed checkpoint, Runtime, portable backup and observed capability closure | No legacy reads, no real data, no production route/cron/credentials |

The isolated Worker `openpq-intelligence-progress-isolated-test` has one native SQL DO namespace and exactly one service binding `CORE_EXPORT` to the isolated Core. No CANONICAL/R2/D1/KV, Core command, signer, rule or source collector capability is bound. Preflight permits only this exact Worker and `ProgressScheduler` pair in the existing dedicated test account; any other namespace/Worker remains rejected. Existing test token scopes are unchanged.

Cloud activation additionally requires a hash-pinned, time-bounded synthetic configuration with `ISOLATED_EXPORT_PROOF_ONLY`, matching account, fixture dataset and recorded test-only P10 budget. Jobs have a separate hash-authenticated token; Core sees a different export-only principal, not the operator's control/promote capability. Cleanup removes both scheduler capabilities and that Core principal and observes old export-token denial with a working Runtime witness. Fixture config expiry independently stops alarms. No real scheduler policy is invented.

Portable backup CLI:

```
node scripts/preparation/portable-backup.js export bundle.json independently-trusted-authority.json new-directory
node scripts/preparation/portable-backup.js verify new-directory independently-trusted-authority.json
```

Export refuses an existing directory. Missing completion marker, changed bytes, extra objects/files or symlinks fail readback. A successful local or GitHub-artifact readback proves transport/integrity/publication signatures only, never complete disaster recovery. Backup audit/registry/deploy placeholders in the synthetic proof are labelled explicitly.

## Ready before final legacy versions

Test resources, bindings, auth boundaries, bounded retry/backpressure, immutable blobs/receipts, native checkpoint export, signed Runtime fallback, portable publication backup, deployment/CI checks and release drift detection can be exercised independently now. Operator signature/session guard and semantic preparation remain available from M4/M5; no final provider/SSO or business rules are assumed.

## What happens after the owner says legacy is finished

1. Read final README, consumer code, producer/schema, workflows, actual endpoints and owned data; pin exact code SHAs separately from changing data SHAs.
2. Record deployed identity and active jobs; a code freeze must not silently stop data collectors.
3. Build the narrow source/consumer adapters against those final versions, preserve observation time and source validity, and run actual golden/parity/shadow tests.
4. Establish real policy/licensing/identity/backup/monitoring gates and approved cutover/rollback evidence. M6 cannot turn the owner's announcement or offline `legacy_final_declared` flag into deployment evidence or authority approval.
5. Switch only the approved dataset/consumer after required gates. Keep history, locator migration and credential-denial fences. No modification of old systems is authorized by the current technical-preparation phase.

Actual cloud result and exact code/evidence identities are recorded separately once the workflow completes. G1/G2 remain NOT_PASSED; no technical subset is relabelled as total production readiness.

Run 36886876385 on e9cf5addd8702ab74ca0c2840ced2cb6308aca00 passed 12 old regression cases then failed PREPARE_FAILED before the new scheduler was prepared/deployed. That old error retained no HTTP/code; cause UNKNOWN, scheduler proof NOT_RUN. M6 now runs its own fresh scoped fixture/bootstrap directly, without preceding unrelated fault injection. M5 15-case evidence remains unchanged and is not relabelled as a new M6 run.
