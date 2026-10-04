# Accepted producer boundaries - 2026-10-04

Weather and Near Me now have producer views independent of their public consumer URLs. This is source-path separation only; neither canonical consumer is activated.

Weather:
- Source: openpq-intelligence-weather-source-view.kenzuko.workers.dev.
- Actual source/public parity 6/6: current, forecast, marine, cloud, compact, meta.
- Specialist weather-edge module and raw provider/model engines unchanged.
- Protected public, Airport and Weather worker versions unchanged during the source deployment.
- Run 37170563449 SUCCESS; artifact 11290947385, SHA256 dcfc2454a97c034fff2c27525f086ee62305506e9f7b0e2a8bb096bc4be98843.
- Site PR 350 merged 0b132db52338a1106175f31118cc8589dfa2218f.
- Manifest is outside these six roles and is not silently marked transferred.

Near Me:
- Source: openpq-intelligence-nearme-source-view.kenzuko.workers.dev.
- Exactly three JSON files copied byte-for-byte from the existing CMS site build; no generated observation or business opening time.
- Real publication verified 3/3 hashes against that build. POST/PUT/DELETE denied, private research path denied.
- Source deployment stage is nonblocking while canonical activation remains pending; any failed proof disqualifies activation.
- Site PR 351 merged 72fafa5b1801677e9e8e79d83a261297aa4759eb. Production deployment 37172401058 SUCCESS.
- Artifact 11291397913, SHA256 98221cbecf5239abd934048f33299c9b187134247c794721c4f8adf410c0ff53.
- Existing CMS, indexer, Near Me consumer, Weather/Transit specialized engines and public UI are preserved.

PUBLIC_EVIDENCE.zip contains allowlisted public proof and original Weather source bytes. MANIFEST.json records per-file and archive hashes. No private credentials or signing keys are included.
Transit is already canonical in production. Whole-Core readiness, source-policy activation and producer independence remain FALSE. Keep rollback and existing collector assets.
