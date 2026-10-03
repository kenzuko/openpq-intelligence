# ADR-IMPLEMENTATION-011 - Portable fixture-only evidence bundle and independent verifier

Status: F14 offline implementation only - PROPOSED_NOT_ACTIVATED
Date: 2026-10-02

## Decision

F14 packages the reviewed F13 offline Cano pipeline output as a portable directory bundle. The builder copies only the exact manifest bytes and referenced bounded regular raw files, writes the canonical F13 audit report, writes an inventory of path/size/SHA256, and records a hash inventory of the reviewed F13 execution chain. It never recursively copies the input root and never includes credentials or unreferenced files.

The bundle is fixture-only evidence. `action_eligible=false`, `publication_admitted=false`, and `source_authenticated=false` are hard closed. A VALID batch is marked `EVIDENCE_ONLY`, never READY. An INVALID batch may be preserved as diagnostic evidence and remains `INVALID`.

The verifier is code outside the bundle. It accepts a trusted baseline pin from outside the bundle, verifies the complete inventory and closed flags, checks target/evaluation/contract bindings, re-runs the actual F13 pipeline from the exact bundled snapshot, and requires byte-equivalent canonical audit output. It never imports executable code from the bundle. A baseline mismatch is reported separately and cannot become VERIFIED.

The portable bundle layout is fixed: `snapshot/manifest.json`, referenced `snapshot/<raw_file>`, `audit/audit.json`, `BASELINE_SOURCE.json`, `BUNDLE.json`, and `INVENTORY.json`. `INVENTORY.json` inventories every other regular file; the verifier rejects missing, extra, symlink, non-regular, size or SHA mismatch.

F14 local limits are evidence-harness limits only: at most 128 inventory payload files, 512 KiB per evidence file, and 4 MiB total payload bytes. F13 manifest/raw limits remain unchanged. A raw input that cannot be copied byte-for-byte within the F13 bound (for example oversized, non-regular, or symlink escape) is unbundleable and the builder exits as an error rather than rewriting the diagnostic into a different replay result.

No production authority, store, archive extractor, publication path, Coordinator/Core/Runtime linkage, cloud workflow, repository write or domain admission is introduced.
