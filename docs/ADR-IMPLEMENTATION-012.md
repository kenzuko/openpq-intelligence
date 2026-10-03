# ADR 012: installed execution pin and bounded traversal

Counterexample to ADR 011: bundle and external trusted pin matched, but a copied executing source tree with a changed manual-cano.js still returned VERIFIED_FIXTURE_ONLY when outputs happened to match.

Verifier computes the 13-file execution-chain inventory from its own module-relative source root and compares it to the external trusted pin before replay. It never accepts a caller root or loads code from the bundle. Builder likewise refuses to label its executing pipeline using another root. Execution drift returns BASELINE_MISMATCH with CANO_EVIDENCE_EXECUTION_BASELINE_MISMATCH and closed flags, exit2. This is source-byte identity under trusted installed code and stable snapshot assumptions, not attestation of hostile mutable runtime memory. F14 verifier code is still reviewed separately; the 13-file pin remains the F13 pipeline scope.

Directory traversal now streams entries with 256-entry, 32-depth, and file count bounds so an invalid bundle cannot cause unbounded recursive enumeration before size checks. These are offline harness limits only. No production/domain/action/admission gate changes. Regression tests reproduce execution drift, mislabeled builder source root, and deep tree. Original F14 archive remains immutable.
