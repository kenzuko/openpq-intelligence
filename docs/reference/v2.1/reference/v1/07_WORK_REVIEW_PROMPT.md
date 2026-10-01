# PROMPT FOR FINAL WORK REVIEW

Use this prompt with the full package.

---

You are reviewing the proposed architecture for **OpenPQ Intelligence**, the future production intelligence platform behind Open Phu Quoc.

Do **not** implement code yet.

Act as a hostile-but-constructive architecture reviewer.

## Context

Current Weather, Airport and Transit systems already contain substantial verified logic, source semantics, history and operational fixes.

The goal is not to rewrite that knowledge blindly.

The goal is to create a clean production intelligence platform with:

- one logical brain
- one canonical publishing authority
- multiple evidence sources
- many independent consumers
- execution/failure isolation
- no hidden production dependency on old lab repositories

Eventually the specialist lab repos should be turn-off-able without stopping production data updates.

## Review tasks

Read every Markdown file in the package.

Then:

1. Identify contradictions.
2. Identify missing failure modes.
3. Identify accidental single points of failure.
4. Identify split-brain/zombie-writer risks.
5. Identify stale-as-fresh paths.
6. Identify places canonical truth may destroy useful conflicting evidence.
7. Identify migration steps that could damage stable Weather/Airport/Transit behavior.
8. Identify over-engineering.
9. Identify prematurely locked technologies.
10. Stress-test 2-5 year growth:
   - road traffic
   - crowds
   - hotel inventory
   - events
   - attractions
   - air quality
   - pricing
   - partner feeds
   - AI agents
11. Stress-test operator behavior:
   - wrong override
   - stale manual truth
   - forgotten flag
   - old cron restarts
   - partial rollback
12. Stress-test disaster/recovery:
   - Core down
   - Runtime down
   - storage unavailable
   - provider outage
   - corrupted source
   - schema-valid but semantically wrong data
13. Review portability and Cloudflare lock-in.
14. Review lineage, retention and licensing assumptions.

## Constraints

Do not recommend rewriting verified legacy algorithms without a concrete reason.

Do not add infrastructure just because it exists.

Every new component must remove a specific failure mode or operational risk.

Prefer durable invariants over layers of ad-hoc fallback logic.

## Required output

### A. Architecture verdict
Choose one:

- `READY TO DESIGN IMPLEMENTATION`
- `READY WITH REQUIRED CHANGES`
- `NOT READY`

### B. Required corrections
Only blockers before implementation.

### C. Optional improvements
Useful but non-blocking.

### D. Simplification opportunities
What can be removed safely.

### E. Final component boundaries
Responsibilities only, no code.

### F. Unresolved technology decisions
Examples:

- Control Store
- Queue vs Workflow
- source registry storage
- rule registry storage
- DR mechanism

### G. Implementation entry criteria
A checklist that must be true before production-oriented implementation begins.

Do not merge, deploy or connect to production during this review.

---
