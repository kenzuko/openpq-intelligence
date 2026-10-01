# ADR-IMPLEMENTATION-002: isolated cloud runner and concrete local fault evidence

Status: accepted for isolated implementation only. Date: 2026-10-01.

## Findings

Cloud deployment tokens can bind resources inside their account. An environment label alone cannot demonstrate absence of production capabilities. Also, a commit retry after an ordinary successful response did not exercise response loss; sequential export tests did not exercise reordered concurrent R2 projections; a control change after prepare did not exercise mutation during external I/O.

## Decision

Use a separate Cloudflare test account. Require a read-only API preflight inspecting actual account-owned deploy/R2 token policies and inventories before any deploy. Use only a manually dispatched GitHub environment, exact test resource names, pinned Wrangler, a temporary authenticated metadata-only native-ID probe, and fresh synthetic dataset/generation/signer per run attempt. Final Runtime retains read-only S3 credentials and no write binding. Only redacted evidence is uploaded.

Add test-only faults around the actual local SQLite DO/R2 path: gate external I/O through a Node host, change control or owner during the await, fail/corrupt storage operations, drop a successful commit HTTP response, and reorder concurrent checkpoint CAS updates. Add scope/preparation/denial-probe tests, preserving explicit limits on what mocks establish.

## Evidence and limits

41 Node cases pass, including three parent integration tests. All four offline Worker bundles pass using Wrangler 4.145.0. No actual cloud capability, IAM denial, crash or global consistency claim is made. The runner's successful terminal state is a cloud protocol subset, never complete G1. Numerical/domain policy gates remain closed.

This records implementation choices and new evidence. No V2.1 reference section is superseded and no immutable release file is edited. A future concrete contract counterexample must create a new amendment identifying the affected section, failing test and replacement decision.
