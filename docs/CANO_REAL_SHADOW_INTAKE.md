Current checkpoint adds a separate local recorded-fact profile, described in CANO_REAL_LOCAL_ADMISSION.md. This shadow audit itself remains non-admitting; admission cannot be enabled by changing an audit flag. Earlier checkpoint statements below describe its diagnostic scope.

# Real Cano shadow intake - proposed local adapter, not authority admission

This is a narrow local adapter for the already locked An Thới manual dataset. It reuses the existing `normalizeManualCano` and operating-day validity. It does not replace the F14 ledger, add an authority store or change Worker/API/cron/deployment configuration.

## Input contract

| Field | Rule |
|---|---|
| contract_version | openpq-cano-real-shadow-intake-v1 |
| mode | SHADOW_ONLY |
| dataset_id | cano.operation.an-thoi |
| source_kind / fixture_only | OWNER_REPOSITORY_SNAPSHOT / false for actual files; SYNTHETIC_TEST / true for tests |
| snapshot_commit_sha | Pin the data branch snapshot separately from source code |
| evaluation_time | Explicit canonical UTC with milliseconds; preserved in the manifest |
| records | 1-64 records, each raw file <=8192 bytes; manifest <=131072 bytes |
| source_pointer | Exact kenzuko/Jotrip-Lab, commit SHA, original manual-confirmation path |
| payload_sha256 | Hash exact bytes, not regenerated JSON |
| git_blob_sha | Check Git's blob-header/content SHA-1 as a second retrieval check; not source-author authentication |
| external manifest pin | CLI caller supplies reviewed SHA-256; never bootstrapped from an unknown input manifest |

The normalizer retains original status, source timestamp, exact per-day scope and midnight validity. Phú Quốc-wide paths do not become An Thới. OFFICIAL archive rows do not become JoTrip FIELD observations. A recorded username does not become authenticated operator authority.

## Output and fences

Output is a diagnostic audit, never a Coordinator candidate or publication generation. All action/publication/real admission/production flags are false; operator_authenticated=false and SOURCE_RECORDED_ONLY remain explicit. Raw source bytes, their original Git version pointers and content hashes are preserved externally in the snapshot.

Missing/invalid raw or missing author closes the entire batch's promotion fence, even when a subset normalizes. Exact duplicate occurrences are counted. Same pointer/different content rejects both versions. Multiple raw variants for a day remain correction-review-required, regardless of source timestamps or equal RUNNING values. No terminal record is selected and no supersedes relation is created.

The existing fixture-only correction ledger is not invoked on real bytes. Source history notes may support a reviewed amendment proposal but cannot silently activate an authority edge. Current real-data intake is proposal/audit work; signed real admission and reviewed source/operator policy still require separate implementation.

Local files must be a stable snapshot. The loader rejects symlinks, traversal, nonregular files, excessive size, missing files and observed file changes. It is not a concurrent hostile-filesystem sandbox. No network, object-store credentials or remote write exists in the pure adapter.

## Evidence scope

14 current source paths have 16 reachable path-history versions. All 16 historical raw payloads match their commit file Git blob SHAs; all 14 current files match Git blob SHAs. Source commits are unsigned; this describes Git signature metadata, not whether the owner's source is truthful.

Current14: 3 contract-ready, 4 missing-author quarantined, 7 rejected by locked scope/evidence rules. History16: 3 contract-ready, 5 missing-author quarantined, 8 rejected. Scoped 01-03/10: 3 contract-ready for shadow only. Readiness is metadata/shape compatibility, not trust or permission to act.

Day 23/09 has explicit raw text replacing 06:25 RUNNING with 07:04 SUSPENDED; candidate linkage preserves both hashes but remains quarantined because its Phú Quốc scope and author fields do not satisfy the locked An Thới intake. Day 28/09 is an editorial-note change with identical state/time, missing author in both versions; it is retained as two versions, not inferred authority.

Latest legacy Cano state and confirmation text match the 03/10 raw record. The newly pinned derived latest output has no categories.cano.confirmed_at_vn; exact timestamp parity is therefore NOT_AVAILABLE, not PASS. The adapter keeps raw 06:06 rather than substituting collector refresh time. Derived history matches the three metadata-ready days; neither derived view counts as independent evidence.

## Remaining real admission work

A genuine manual-source semantic profile must be reviewed and implemented with authenticated operator/source bindings, explicit authority approval and correction-amendment handling. The currently activated semantic admission profile accepts SYNTHETIC_ONLY; real data cannot be smuggled through it. Native negative tests verify no generation writes/revision increments for attempted real payload and source-kind substitution. Real positive G1/G2 remains NOT_PASSED. Cutover still needs observed writer/credential deny fences, deployment identity and concrete rollback evidence.
