# OPENPQ INTELLIGENCE - ARCHITECTURE REVIEW HANDOFF

**Date:** 2026-10-01  
**Status:** ARCHITECTURE LOCK CANDIDATE - REVIEW ONLY  
**DO NOT CODE - DO NOT DEPLOY - DO NOT MERGE - DO NOT CREATE PRODUCTION RESOURCES YET**

## Purpose

This package is the final architecture-review handoff for **OpenPQ Intelligence**, the future production intelligence platform behind Open Phu Quoc.

The next Work session should **challenge the architecture**, not implement it.

## Product model

OpenPhuQuoc, Weather, Airport, Transit, JoTrip Ops, future native apps, AI agents and partner-facing tools are **consumers**.

They are not independent production brains.

The desired model is:

> **One logical brain. One canonical publishing authority. Many independent consumers.**

This does not mean one Worker, one process, one schema or one monolith.

## Existing systems are assets

Current Weather, Airport and Transit systems already contain hard-won knowledge, stable logic, source semantics, guards, historical data and incident fixes.

The new platform must not destroy that work for the sake of architectural cleanliness.

The guiding principle is:

> **Greenfield architecture, not greenfield knowledge.**

Verified algorithms, source semantics, incident lessons and data history should be preserved, ported or re-homed with parity evidence.

## Review goal

Try to disprove the design before implementation begins.

Look for:

- hidden single points of failure
- stale-as-fresh paths
- split-brain or zombie writers
- data loss during migration
- truth-resolution ambiguity
- irreversible cutover
- accidental over-engineering
- Cloudflare lock-in
- weak operator governance
- inability to reproduce past decisions
- inability to survive a few days without human babysitting

See `07_WORK_REVIEW_PROMPT.md` for the exact independent review prompt.
