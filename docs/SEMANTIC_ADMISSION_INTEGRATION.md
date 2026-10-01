# M5: trusted semantic integration in the local authority path

M4 prepared reusable mechanisms but did not connect semantic checks to Coordinator admission. This supplement connects a strictly synthetic local profile through the actual SQLite Coordinator, immutable R2 generation, receipt, export-only progress alarm, signed checkpoint and readonly Runtime. No real-domain or positive-action admission is enabled.

## Trusted activation

A dataset declaring `semantic_profile_hash` in its authority locator/control must supply the exact profile via three explicitly named bindings, each <=5,000 UTF-8 bytes. Profile packaging is <=15,000 bytes and preserves Unicode code points. The profile pins exact registry artifacts, policy set, source/mapping/schema/rule/config references, dataset and environment. Request bodies contain evidence/assertions, not replacement registry/policy configuration. Binding content is rehashed against the authority pin. Control state rejects a profile-pin edit as an explicit migration requirement.

The profile contract is `openpq-semantic-admission-local-v1`, environment `local-test`, source kind `SYNTHETIC_ONLY`. Both isolated cloud semantic activation and production remain blocked. No semantic bindings/profile are added to the existing cloud resource config. Legacy synthetic protocol fixtures without an activated semantic profile retain their previous behavior; attaching a semantic bundle to them is rejected rather than pretending it was checked.

## Admission and serving

For a configured dataset, a generic candidate cannot bypass admission. Before blob storage, the Coordinator independently reconstructs preparation from trusted artifacts/policies, checks type/unit/time/quality/linkage, exact candidate payload, inputs/max ages, quality, artifact pins, source/validity bounds and proof. Unlinked evidence, nested credential fields, future issue time, quarantine/missing inputs or forged proof fail before generation writes.

Only NORMAL synthetic FACT with effect ABSTAIN, minimum_evidence_met=false and the fixed no-action reason is allowed. The producer helper cannot make this a Weather/Marine rule, operational RUNNING decision, retraction/correction, real manual source admission or production permission. Conflict remains visible, never resolved by arrival order.

At commit the immutable prepared data is revalidated against current policy interval/source age. The final synchronous transaction enforces the bounded admission expiry, owner/epoch/revision/control/activation fences and ABSTAIN. Successful command retries return their exact prior typed receipt, even after eviction; they do not create a new publication. Runtime checks the activated profile pin on generation and receipt and remains a reader. It does not run preparation/resolution.

## Complete local stack evidence

Nine native integration cases cover actual publication/Runtime, generic/forged candidate denial with zero generation writes, UTF-8 binding/pin/environment fences, actual source expiry after prepare, content-bound replay after DO eviction, profile migration and old-profile serving denial, alarm-driven export with export-only capability, signed cold Runtime fallback, future issue time/credential/unlinked evidence and command-kind collision.

The complete stack also builds a portable local backup from the real generated blob, signed receipt and captured control watermark. `verifyBackupPublications` requires an independently supplied trusted authority configuration; it cannot bootstrap signing trust from the backup itself. It verifies generation-bound publication signatures and rejects tampered signed receipts. It explicitly does not authenticate unsigned control/audit, prove offsite/PITR, or resume writers. Audit/scheduler/deploy records in this test are labelled synthetic fixture metadata, not an actual full disaster export.

The earlier deterministic M4 report remains byte-for-byte reproducible. New findings supplement it and do not overwrite snapshots.

## Concrete counterexamples fixed

1. Future assertion `issued_at` could remain eligible in M4 if source_time was current. It now quarantines `ASSERTION_ISSUED_IN_FUTURE`; old fixed-clock replay outputs remain unchanged.
2. `commands` stores both control and commit dedup. Reusing a control command ID with its exact body hash at `/commit` previously returned a control result as a publication receipt. Commit now requires a typed receipt matching command_id/revision and returns COMMAND_KIND_CONFLICT without advancing publication.
3. Hash-only portable integrity did not prove a signed publication. The new verifier requires independent trust and validates signed receipt/generation references, while preserving the explicit unsigned-control limitation.

## Cloud regression and remaining scope

An explicit push to `cloud/protocol-regression-m5` invokes the existing isolated 15-case protocol workflow. Ordinary main/feature pushes do not deploy cloud; preflight still pins the original dedicated account, bucket and Worker allowlist, and uses existing scoped test credentials. This is regression of legacy synthetic protocol behavior after the Coordinator change, not cloud semantic admission proof. Artifact names now distinguish run attempts.

Remaining: reviewed real-domain source/kernel/wire contracts; authenticated source/operator policy and provider SSO/session/review integration; separately scoped cloud profile/progress activation; actual independent backup/restore/control-audit export and offsite drill; measured budgets, shadow/consumer parity and cutover. G1/G2 remain NOT_PASSED. Existing public Weather/Airport/Transit/Near Me/i18n and production are untouched.

Actual regression 36880999372 at 7a5425f244ca8c39d2ba27bfefd1fc28c4393889: 15/15 PASS, cleanup SUCCESS. This is existing generic synthetic cloud protocol behavior, not cloud semantic integration. Failed runs 36878858323, 36879691210 and 36880314625 remain byte-preserved. Local total 121; semantic native cases remain nine. Binding-only deploy is not assumed to restart an isolate: constructor observation remains mandatory. Cloudflare references checked 2026-10-01: https://developers.cloudflare.com/workers/runtime-apis/bindings/ and https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/ . These explain possible isolate reuse/eventual code rollout; they do not establish the cause of any failed run.
