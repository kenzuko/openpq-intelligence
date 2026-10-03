# Core 2.0 Cloudflare checkpoint — 2026-10-03

Status: ISOLATED_CLOUD_DEPLOYED_AND_VERIFIED. Production migration is not complete.

## Deployment identity

Dedicated account: c61a28455fe22f30619b35dd80c2d495.
Bucket: openpq-intelligence-canonical-isolated-test.
Final deployed source commit: dec9086175cdff524301cb9bf1b3197418e0eb88.
Core, Runtime, Operator Console and export scheduler were deployed to their existing isolated-test Worker names. Routes remain empty. Production gates remain closed.

## Fresh results

- Protocol workflow 37098801370, commit 61b2b0bf1ddbaae116adc38d1da9e18682d23384: SUCCESS; 254/254 native tests, no failures/skips; 5 bridge schemas with 50 positive and 150 negative samples; pinned account and actual read-only token/resource preflight; 15/15 actual cloud protocol cases.
- Progress workflow 37098956441, final source commit above: SUCCESS; 254/254 native tests, no failures/skips; same schema gate and fresh preflight; 7/7 actual alarm, signed publication backup and temporary capability closure cases.
- Portable publication backup was downloaded and independently reopened with the separately pinned locator/public verification key. Publication revision 1 signature and retained objects verified. This does not authenticate all control/audit state or prove whole-system restore, offsite backup, PITR, RPO/RTO or resumed writer authority.
- Fresh external Runtime read: HTTP 200, VERIFIED authority, ABSTAIN eligibility, fixture_only=true; see FRESH_RUNTIME_WITNESS.json.
- Core and Runtime /health returned HTTP 200. Operator / returned HTTP 200 with expected title and restrictive CSP. Operator has no /health endpoint.
- Local Cano readiness rerun: 68/68 selected tests, replay 33/33, 12 schemas / 38 samples PASS. These counts refer to the offline synthetic scope.

## Failed attempt retained

Workflow 37098667005 stopped before preflight/deploy: two denial tests hit Miniflare Node upload ECONNRESET when the Worker rejected before reading the body. The test client now buffers unchanged request bytes at the HTTP boundary and forwards via a real service binding. All denial assertions remain; no application authority checks were relaxed. Both subsequent CI suites passed all 254 tests. Failure remains reviewable in GitHub Actions.

## Source readiness boundaries

Cano plus Weather, Airport, Transit and Near Me code is present in the deployed release. Four-domain captured producer snapshots have native local admission/serving/recovery proofs across ten dataset roles. The current semantic bridge contracts explicitly permit local-test only; cloud tests publish synthetic fixture datasets only. Real source admission has NOT been activated on Cloudflare. Near Me support/venue companions have parity coverage but are not separate authority datasets. No current source freshness or whole-brain production readiness is inferred from test counts.

## Next execution checkpoint

1. Add a separately pinned isolated-test bridge profile contract and native negative tests without broadening production admission. Do not repurpose a local profile as cloud authorization.
2. Admit current/captured source snapshots per dataset with explicit source time, provenance, reference-only serving and separate operator capabilities; verify each role on actual cloud.
3. Verify multi-source outage/recovery and exact consumer response parity on cloud. Preserve working source engines and public UI. Archive only components with dependency/consumer proof.
4. Complete remaining G1 evidence: crash/timeout injection, current R2 read-credential revocation propagation, retention pins, disaster restore/RPO/RTO and quota/cost/unattended resilience.
5. Prepare concrete consumer migration and rollback checkpoint after these gates. Do not announce full Core 2.0 completion before source and consumer gates pass.

## Existing system boundary

Main remains c8d020acd14267f673ffae1dc06f851f511b2027. No legacy repository/cloud reads, production deployment, public DNS changes or consumer cutover were performed. New code and evidence are on isolated release/evidence branches. Temporary scheduler and export-only capabilities were removed and actual denial observed with a positive Runtime witness.
