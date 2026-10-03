# Chạy F15

Node >=22. Từ source/, light offline run không cần npm install:

```bash
node scripts/check-cano-offline-ready.js ../evidence-new
```

Full local verification cần đúng dependency lock và jsonschema đã cài trong môi trường tách biệt:

```bash
npm ci --ignore-scripts --no-audit --no-fund
python3 -m venv ../schema-env
../schema-env/bin/pip install jsonschema==4.26.0
PATH="$(pwd)/../schema-env/bin:$PATH" node scripts/check-cano-offline-ready.js ../evidence-new --full
```

Chỉ cài local test dependencies, không Cloudflare/GitHub credentials. Output phải chưa tồn tại, runner không overwrite. Full mode requires schema PASS, runs all tests/*.test.js with exact pinned Miniflare. Light mode declares absent validator NOT_RUN and full-suite NOT_RUN_NOT_REQUESTED. Status PASS_OFFLINE_WITH_DECLARED_GAPS giữ vì operational gates chưa đóng.

Fixture pin nằm ngoài bundle, không tự lấy pin từ unknown bundle làm authority. Pin 13 pipeline files không phải full release attestation. Synthetic VALID không xác nhận hoạt động thực tế. Dữ liệu thật trong inventory/ không được nạp vào fixture runner; probe-real-cano.mjs chỉ normalize shadow local và không publish.

Evidence hiện hành: evidence-release/. Schema checker validates definitions + positive/negative sample coverage, resolves references only from local schema registry. Không claim exhaustive coverage mọi branch hoặc semantic checks bằng JSON Schema.
