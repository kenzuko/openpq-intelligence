# Readiness hiện hành - Core 2.0

| Phần | Trạng thái | Evidence / giới hạn |
|---|---|---|
| F15 Cano offline | PASS_OFFLINE | 68/68, replay 33/33; không là xác nhận vận hành |
| Full native Miniflare | PASS | 325/325 local và CI 37133160112; ingestion giữ source 1c9ca5f |
| Finite isolated cloud baseline | PASS_SUBSET | 25/25 run 37112667895, giữ riêng với Cron proof |
| Unattended reference feed | PASS_ACTUAL_CRON_SUBSET | 10/10 nguồn; run 37117134469; narrow feed được giữ chạy |
| Follow-up Cron | PASS_PUBLIC_HEALTH_SUBSET | Cả 10 revision tăng; Runtime khỏe lúc 10:49:40Z |
| Capability fencing | PASS_SUBSET | Giữ signer/locator/generation; bootstrap/control/cross-dataset 403 |
| Independent signed backups | PASS_SUBSET | 10 bản Cron mở lại sau tải xuống; 21 baseline giữ riêng; chưa full restore |
| Continuous-reference schemas | PASS_ACTUAL_SIGNED_SAMPLES | 5 schema, 50 positive/150 negative từ 10 bản sao Cron thực |
| Read-only monitoring | CONFIGURED_WITH_COUNTEREXAMPLES | 2 health PASS, 1 FAIL, 1 UNKNOWN trong lịch sử ghi nhận; chưa chứng minh uptime/SLA |
| Consumer capture / native rehearsal | PASS_PREVIOUS_SCOPED_SNAPSHOT | 23/23 capture, 9/9 rehearsal; không tự biến mọi route thành Core contract |
| Near Me companions | PARITY_PASS_NOT_AUTHORITY | Chưa dùng editorial data xác nhận live opening |
| Airport source semantics | PRESERVED | Null schedule unresolved; archive/fallback không bị sửa |
| Additional Weather/Cano report contracts | PENDING | Cần semantic admission riêng |
| Frozen native recovery trên cloud | PASS_ACTUAL_CLOUD_SUBSET | 5/5 run 37126753697; đọc lại độc lập, namespace/generation/signer mới, token command/gateway cũ 401, cleanup xong; chưa S3 write-key revocation/full restore |
| Domain archive dependency closure | PASS_CAPTURED_SUBSET | 10/10 signed native archives after disposal and independent child readback; semantic artifacts/all prepared generations verified; no live restore |
| Full G1/G2/G3/G4/G5 | NOT_PASSED | Restore/fencing, retention/cost, 72 giờ/7 ngày và switch/rollback còn thiếu |
| Production authority / public cutover | NOT_EXECUTED | Giữ hệ nguồn, UI và route đang dùng tốt |
| Whole Core 2.0 production-ready | FALSE | Feed reference đã chạy; các gate vận hành còn thiếu |

Owner đã cấp toàn quyền. Không có yêu cầu xin phép đang chờ. Lease display không thay thời gian observation/model/provider; reference vẫn ABSTAIN và operational action bị đóng.

Đọc [checkpoint đã ghim](../evidence/core2-source-feed-20261003/CHECKPOINT.md). Immutable V2.1 và mọi counterexample được giữ nguyên.

Cloud recovery mới: [checkpoint và bằng chứng đã ghim](../evidence/core2-cloud-recovery-20261003/CHECKPOINT.md). Không resume writer và không đổi 10 feed đang chạy.

Frozen domain restore: 10/10 Miniflare targets sống qua persisted restart, chữ ký/semantic archive đọc lại sau dispose. Cloud ten-domain acceptance chưa PASS. Các run lỗi được giữ, latest 37133160893 thiếu observed restart incarnation, cleanup SUCCESS.

Forecast: signed old/current capture chứng minh cùng model cycle giữ nguyên metadata và mọi frame cũ, chỉ thêm 1 future frame. Rule đã vá giới hạn, 325 tests PASS. Isolated Core patch workflow có giữ binding và rollback đang chạy; chưa tuyên bố deploy PASS.
