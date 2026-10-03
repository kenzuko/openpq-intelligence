# ADR 010: bounded local reads and valid rejection diagnostics

Review amendment to ADR 009, offline only. Counterexamples: local raw files were read fully before the 8192-byte check; directories/non-regular inputs were not explicitly rejected. Also a rejected 65-record manifest emitted input_count=65 against audit maximum=64, and invalid hash/supersedes hints were echoed into constrained fields.

Use bounded regular-file reads with size checks before allocation, descriptor check, at most limit+1 bytes, and no invented hash for skipped oversized input. Parent/root directory mutation remains outside the offline stable-snapshot assumption; these checks do not authorize reading a hostile concurrently changing filesystem. Reject directories/device/FIFO inputs before read.

Keep observed input_count on rejection, cap diagnostic inputs at 64, allow audit input_count above 64 only as observed rejected batch count. Invalid claimed hash/edge hints become null; reason codes identify rejection and manifest digest preserves input integrity. Acceptance max remains 64. No domain/production policy changes. Tests in manual-cano-import-pipeline cover these counterexamples. Original F13 is immutable.
