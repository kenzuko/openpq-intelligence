# NON-NEGOTIABLE INVARIANTS

## Data correctness

1. Missing is never converted to zero.
2. Unknown is never converted to safe.
3. Stale is never converted to fresh.
4. Publication time never substitutes for source time.
5. One source is never relabeled as another.
6. Model data is never presented as observation.
7. Observation is never treated as forecast.
8. Different spatial scopes are never silently merged.
9. Different temporal resolutions are never silently interpolated.
10. Newer data is not automatically better data.

## Evidence/history

11. Raw evidence is immutable.
12. Corrections append/supersede; they do not rewrite history.
13. Historical decisions already emitted remain immutable.
14. Replay output is distinct from historical emitted decisions.
15. Provenance survives migration.

## Publishing

16. Immutable version first, active manifest last.
17. Partial generations never become active.
18. Active state never regresses to an older logical slot.
19. Backfill/replay cannot promote current production.
20. Shadow has no production promotion permission.
21. Duplicate delivery must not duplicate side effects.

## Authority

22. One active production authority per dataset.
23. Writer epochs increase monotonically.
24. Old writers cannot regain authority by restarting.
25. Git branch identity does not grant authority.

## Decisions

26. No evidence of danger is not evidence of safety.
27. Decisions may abstain.
28. `UNCERTAIN`, `CONFLICTING`, `INSUFFICIENT_EVIDENCE` are legitimate states.
29. High-impact decisions require minimum evidence contracts.
30. Same input + same rule/config/time => same output.
31. AI does not resolve production truth in V1.
32. AI may explain structured decisions.

## Manual truth

33. Manual truth always has scope.
34. Manual truth has effective time and expiry.
35. Overrides may expire, be revoked or be superseded.
36. Manual truth is not globally authoritative outside scope.
37. High-impact operator changes are auditable and reversible.

## Failure isolation

38. One domain failure does not stop unrelated domains.
39. Core failure does not erase canonical data.
40. Runtime failure does not stop collection.
41. Failing sources use bounded retry/backoff/circuit behavior.
42. Service, pipeline, source and data health are distinct.

## Migration

43. New systems are promoted only after parity/shadow evidence.
44. Verified old behavior is not rewritten just for cleanliness.
45. Cutover is reversible per dataset.
46. Code rollback does not silently roll back data.
47. Code rollback, rule rollback and authority rollback are distinct.

## Platform discipline

48. Domains do not import other domains directly.
49. UI concerns do not enter source adapters.
50. Storage layout is not a public API.
51. Cloudflare-specific primitives stay behind platform boundaries where practical.
52. New infrastructure is added only to remove a concrete risk/failure mode.
