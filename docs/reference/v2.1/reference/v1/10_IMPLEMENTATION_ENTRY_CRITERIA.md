# IMPLEMENTATION ENTRY CRITERIA

No production-oriented implementation should start until these are accepted.

## Architecture artifacts

- [ ] Architecture Lock approved.
- [ ] Non-negotiable invariants approved.
- [ ] Truth/Decision model approved.
- [ ] Migration/Cutover plan approved.
- [ ] Final independent Work review completed.
- [ ] Required corrections incorporated.

## Inventories required before source migration

- [ ] Weather producer inventory.
- [ ] Airport producer inventory.
- [ ] Transit producer inventory.
- [ ] Existing cron/scheduler inventory.
- [ ] Output/schema inventory.
- [ ] Historical-data inventory.
- [ ] Known-incident corpus.
- [ ] Verified-rule inventory.
- [ ] Source/license/retention inventory.

## Recommended first implementation sequence

```text
1. contracts
2. domain boundaries
3. source-registry model
4. identity/location/time semantics
5. evidence model
6. canonical publication model
7. authority/control interfaces
8. execution-mode model
9. rule/decision interfaces
10. deterministic test harness
11. incident/golden-master fixtures
12. only then integrate the first real producer
```

Weather is a strong first real producer **only after** its golden-master corpus exists, because it stresses:

- multiple source types
- model vs observation
- spatial semantics
- marine semantics
- freshness
- human-facing decisions
- substantial verified legacy knowledge

## Production lock

Until explicit approval:

- no DNS change
- no production Worker deployment
- no production R2 canonical activation
- no production Queue/Workflow activation
- no consumer cutover
- no legacy cron retirement
