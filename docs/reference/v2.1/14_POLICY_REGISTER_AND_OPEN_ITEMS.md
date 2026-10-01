# Policy register và phần cần dữ liệu thật

Không còn yêu cầu “chọn architecture sau” cho critical authority path: baseline và protocol đã khóa. Những mục bên dưới cần inventory/measurement/business acceptance, không được tự điền để qua live gate.

## 1. Đã khóa

Coordinator authority per dataset, immutable generation + local transaction active ref, no dual active manifests, explicit correction/retraction, separate quality axes, deterministic history inputs, scope-aware composition, readonly Ops/Runtime, separate Operator, mode capabilities, retention-aware replay và fenced recovery generation.

## 2. Proposed numerical targets

| ID | Policy proposal | Status | Gate |
|---|---|---|---|
| P01 | Positive high-impact control validation <=15s, offline action grace=0 | PROPOSED, cần chấp nhận và test T19 | G3/G4 |
| P02 | Airport live display update lag <=60s khi nguồn đáp ứng | USER TARGET, cần đo source/cadence/cache | G3/G4 Aviation |
| P03 | Shadow >=7 ngày và >=2 critical cycles; dài hơn nếu cycle yêu cầu | PROPOSED migration acceptance | G3 |
| P04 | Unattended isolated failure test >=72h | PROPOSED resilience gate | G4/G5 |

Proposal là defaults cho prototype/test, chưa là SLA đo thực tế. Nếu không đạt, báo chênh lệch và sửa topology/policy có reason. Không đổi ngầm giá trị để gọi PASS.

## 3. Giá trị phải chốt theo dataset/source

| ID | Cần quyết định/đo | Nếu chưa có |
|---|---|---|
| P05 | Max source age, display serve-until và action-until mỗi field/decision | Không phát positive decision dùng field đó |
| P06 | Marine/rain/gust thresholds và hysteresis từ verified rule inventory | Không tạo ngưỡng mới, mirror/fixtures trước |
| P07 | Composition required fields, max skew, scopes, dependency revalidation | Composition high-impact abstain |
| P08 | Source time basis, timezone/interval/full-delta semantics | Không normalize đoán hoặc declare fresh |
| P09 | Source license/raw/derived/redistribution/access/retention | Không source integration thật ngoài quyền rõ |
| P10 | Requests/concurrency/retries/payload/timeouts/redirect budget | Không activate collector unlimited |
| P11 | Prepare timeout/GC grace/pin retention, canonical/history retention | Không bật destructive GC/lifecycle rules |
| P12 | RPO/RTO/control/evidence/canonical, provider-wide outage acceptance | Chặn G4 production claim |
| P13 | Backup/export cadence, max lag, offsite location, restore ownership | Chặn G4; chưa tuyên bố account-loss recovery |
| P14 | Monitoring cadence/detection max/kênh nhận/sentinel provider | Chặn unattended independence/production acceptance |
| P15 | Operator roles và review cho giảm protection, max override duration | Disable reducing-protection commands |
| P16 | Identity/mapping coverage và legacy reader/schema compatibility | Chặn dataset cutover |
| P17 | Per-field parity tolerance/accepted differences/golden corpus | Unknown critical differences chặn G3 |
| P18 | Artifact compatibility/receipt signing/key rotation/recovery trust config | Chặn authority/cached checkpoint integration |

Mỗi policy activated có policy_id/version/hash, scope, owner, approval rationale và effective interval. Thiếu mục một domain không làm mọi domain unusable; gate scope rõ.

## 4. Technology decisions thực thi

- DO SQLite Coordinator + R2 baseline: đã chọn để prototype, phải chứng minh primitive/permissions/limits/cost ở G1.
- Direct Worker/Queue/Workflow: quyết định theo source/domain inventory, không global lock.
- Registry artifacts: default code-owned versioned controlled activation; database động chỉ khi operator need cụ thể.
- Runtime S3 readonly access: default capability enforcement, benchmark/credential rotation proof; nếu cần adapter khác vẫn deny writes thật.
- Sentinel/offsite location: chọn ở G4 theo quyền và budget, không thêm dịch vụ vô cớ.

## 5. Không thuộc scope V1

Active multi-cloud, global atomic cross-domain transaction, AI truth resolver, automatic rule tuning, booking/payment/action plane, JoTrip Ops command execution, redesign Weather/Airport/Transit UI, và việc mở rộng ra ngoài Phú Quốc.

Các mục này có thể đề xuất sau với concrete failure/product requirement. Không dùng future scale để xây hết hạ tầng ngay.


## A001 - Technical hardening không đổi numeric policy register

P01-P18 giữ nguyên status/gates. Authority locator mapping/bootstrap và test-isolation preflight là hợp đồng kỹ thuật mới bắt buộc trước G1/live admission, không một numeric policy P19 tùy chọn. Đã khóa cách làm, IDs/account/resource values lấy từ inventory thật; không bịa locator. Đổi design qua accepted amendment, không sửa released snapshot.
