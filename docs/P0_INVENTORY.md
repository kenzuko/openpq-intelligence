# P0 inventory, 2026-10-01 UTC

Inventory was read-only. New implementation files were written only in the independent `kenzuko/openpq-intelligence` repository. It was initially empty; rechecked remote main before first implementation write, then initialized with README commit `e1eed00ea239696218ceac1bd85dc09e7a8c7585` and created `feat/isolated-authority-foundation`. No other checkout, source collector, live cron, route or secret was modified.

## Repository pins

| Repo | Branch | Inventory commit SHA | Role |
|---|---|---|---|
| kenzuko/jotrip-home | main | 41b117436a8ca443c02b9a85126be3263f14c14c | Public consumer, embedded Weather producer, CMS |
| kenzuko/Jotrip-Weather | main | 386acf121c2c5849cd876bd84fb8c4a2de2d7025 | Specialist Weather Runtime, overlay and Lab mirror |
| kenzuko/Jotrip-Lab | main | 6126d7e7e2ba2ca6a3a70d2c92829c22a226c5ce | Lab Weather kernels, Marine Ops and Aviation source paths |
| kenzuko/Jotrip-Airport | main | 42617bc609cfa7e5e4952b1bf33694bb9ab71068 | Airport specialist/consumer inventory |
| kenzuko/transit-jotrip | main | 82758c5fb80df0380e9d3b4b110c905d69ae1543 | Transit collector/consumer |

Machine evidence: `evidence/P0_REPOSITORIES.json`, `evidence/PARALLEL_WORK.json`, `evidence/OPEN_PULL_REQUESTS.json`. Snapshot timestamps may differ because inventory happened during concurrent work. Remote pull refs include closed/merged PRs; the separate open-PR connector snapshot is used for open state.

JoTrip Ops was identified as the private operational dashboard and kept read-only. No private Ops source was copied into this public repository. Its full endpoint/access audit remains pending before any integration.

## Located source/output relationships

| Domain | Pinned code evidence | Finding and integration constraint |
|---|---|---|
| Home Weather | `scripts/weather-cms-sync.mjs`, `scripts/weather-engine/weather/`, `wrangler.jsonc` | Existing embedded engine and Worker cron. Model source-cycle timestamps survive dashboard regeneration; regenerated display time alone is not source age. Home Worker also has unrelated D1 CMS and asset bindings. Do not copy them to the new Core. |
| Specialist Weather | `.github/workflows/sync-weather-runtime.yml`, observation-overlay workflow | Several products mirror Lab current/nowcast/AQI/groundtruth; some normalization/build kernels are imported from Lab. Mirror plus original is one evidence lineage. |
| Weather sources | Existing collector code in Home/Lab | ECMWF, DWD ICON, NOAA/AWC METAR, Himawari and VRAIN appear in producers. Their licenses, retention, quotas, mapping and source-specific freshness are not inferred from reachable/public URLs. P01-P18 remain open. |
| Aviation | Lab `.github/workflows/airport-live-worker-deploy.yml`, `wrangler.airport-live.jsonc`, `cloudflare/airport-live-worker.mjs`, `server/airport-live-core.mjs` | Current configured Worker entrypoint is `cloudflare/airport-live-worker.mjs`, service `jotrip-airport-live`, endpoint `/api/airport-live` and `/version`. The other `cloudflare/airport-live/worker.mjs` is not the configured entrypoint. Source code presence is not deployed-version verification. |
| Aviation archive/fallback | Lab `.github/workflows/sunairport-flights.yml`, `tools/sunairport-collector/normalize.mjs` | Archive writer uses `data-sunairport` branch. Normalized `data/sunairport/latest.json`, source raw by day, `health.json` and change events. Live Worker fallback points to this branch. An old missing path cannot establish source failure. Raw and normalized board are not independent sources. |
| Marine/Cano | Lab open PR #6, Home open PR #104 | Existing work concerns manual confirmation preservation and per-item freshness. Do not overwrite these efforts or infer cano/ferry status from another vehicle group. Prototype uses synthetic cano-labelled fixtures only. |
| Transit | `update-transit.yml` and public issue #9 evidence | Best-effort schedule gaps require measurement. Cached PQE, empty Superdong and partial operator coverage remain explicit; no fake departures, private seats or booking inventory. Issue evidence is historical, not a fresh live-health assertion. |

## Parallel-work lock

Several shared Home worktrees were dirty, including Weather, i18n, entity/today data and translation changes. Their exact observed heads/paths are in `PARALLEL_WORK.json`. Open PR inventory includes editorial, Near Me/GO, Weather, CMS and multilingual branches, plus Lab Marine Ops work. This implementation does not cherry-pick, reset, stash, force-push or modify them.

Before any future legacy write: re-fetch latest main, compare exact inventory SHA, re-read affected areas if changed, inspect current open branches/PRs/worktrees, and run relevant tests against the new base. Use an isolated branch. A clean inventory clone does not imply the shared worktrees are clean.

## Facts still required

Actual deployed version/resource inventory, approved pilot/domain selection, source licenses/retention, freshness/threshold policies, golden masters, source budgets and private Ops read-only API audit. P0 is sufficient to start isolated primitives; it does not clear G2 or production cutover.
