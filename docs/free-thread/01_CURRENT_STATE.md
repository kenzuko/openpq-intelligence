# Trạng thái thật

## Đã làm và đã kiểm chứng

- Repo độc lập `kenzuko/openpq-intelligence`; không sửa Weather/Home/Airport/Transit/Near Me/multilingual trong đợt này.
- Coordinator SQLite DO: native locator pin, owner/epoch/control fences, prepare blob immutable, atomic active/command/audit/outbox, explicit correction/retraction.
- Runtime GET-only SigV4 R2, hash/receipt/locator verification, control stamp hạn chế lifetime, cold fallback UNVERIFIED. Không R2 write binding.
- Operator scaffold riêng, forward capability của từng actor; JoTrip Ops vẫn read-only.
- 15/15 cloud protocol/resilience subset: run 36848850809. Có cloud scope/role proof, concurrent commit, idempotent retry, signer outage/outbox recovery, observed constructor restart + SQLite state/dedup retained. Response loss xảy ra tại socket runner sau upstream commit; không phải crash giữa SQL transaction trên Cloudflare.
- R2 read-credential revocation: baseline 36853905022; deny 36856013892. API xác nhận removal, credential cũ thực tế trả 401; Runtime witness trả 200 với đúng digest. Đã pin cả failed counterexample 36854890531 và bản sửa.
- 72 local Node tests, syntax/boundary checks, immutable handoff/evidence verification, 8 synthetic replay cases và 4 offline bundles pass. Con số Node gồm các parent integration tests, không tương đương 72 architecture cases.
- Semantic fixture v1: Evidence/Assertion/Canonical validators, source registry/hash/version lookup và deterministic replay harness. Không nối vào live publication wire contract.

## Gate hiện tại

| Gate | Trạng thái | Thiếu gì |
|---|---|---|
| G0/P0 | Partial, isolated work allowed | Deployed inventory toàn hệ cũ và private Ops audit; snapshot cũ không chứng minh main hiện tại |
| P1/P3 semantic | Local subset pass | Full registry graph/payload schemas, compatibility, policy activation adapter, candidate wire integration |
| G1 | NOT_PASSED trong toàn bộ phạm vi | Crash boundaries chưa covered, retention/pins, bounded unattended retry/backpressure, restore/recovery fencing, usage/cost evidence |
| G2 | BLOCKED | Pilot chọn rõ, source license/time/mapping/budget/freshness policies, golden corpus từ output thật |
| G3 | NOT_RUN | Shadow duration/parity/tolerance và các critical cycles |
| G4/G5 | NOT_RUN | Recovery/PITR/provider outage, approved monitoring/budget, per-dataset cutover và producer independence |

## Không được suy diễn

HTTP 401 ở một runner không chứng minh mọi khu vực đã revoke, không đo thời gian từ thao tác UI và không chứng minh revoked write credentials. 15 cloud cases không phải toàn bộ T01-T63. DO eviction/redeploy không phải disaster restore. Runner counters không phải Cloudflare billing. Fixture cano không phải xác nhận vận hành hôm nay. Pipeline Aviation không được đánh FAIL chỉ do path legacy mất.

## Các quyết định cần dữ liệu thật

P05-P18 của policy register vẫn chặn đúng scope: source ages, biển/gió/mưa thresholds, time/interval semantics, license/retention, budgets, GC/pin grace, RPO/RTO, backup/offsite, monitoring, roles giảm protection, identity/parity và artifact/key compatibility. Không tự điền số cho nhanh qua gate.
