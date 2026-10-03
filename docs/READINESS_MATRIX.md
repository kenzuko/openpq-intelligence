# Readiness hiện hành - Core 2.0

| Phần | Trạng thái | Evidence / giới hạn |
|---|---|---|
| F15 Cano offline | PASS_OFFLINE | 68/68, replay 33/33; không là xác nhận vận hành |
| Full native Miniflare | PASS | 282/282; deployed source 1c9ca5f |
| Finite isolated cloud baseline | PASS_SUBSET | 25/25 run 37112667895, giữ riêng với Cron proof |
| Unattended reference feed | PASS_ACTUAL_CRON_SUBSET | 10/10 nguồn; run 37117134469; narrow feed được giữ chạy |
| Follow-up Cron | PASS_PUBLIC_HEALTH_SUBSET | Cả 10 revision tăng; Runtime khỏe lúc 10:49:40Z |
| Capability fencing | PASS_SUBSET | Giữ signer/locator/generation; bootstrap/control/cross-dataset 403 |
| Independent signed backups | PASS_SUBSET | 10 bản Cron mở lại sau tải xuống; 21 baseline giữ riêng; chưa full restore |
| Continuous-reference schemas | PASS_ACTUAL_SIGNED_SAMPLES | 5 schema, 50 positive/150 negative từ 10 bản sao Cron thực |
| Read-only monitoring | CONFIGURED | Audit 30 phút; không tự chứng minh uptime/SLA |
| Consumer capture / native rehearsal | PASS_PREVIOUS_SCOPED_SNAPSHOT | 23/23 capture, 9/9 rehearsal; không tự biến mọi route thành Core contract |
| Near Me companions | PARITY_PASS_NOT_AUTHORITY | Chưa dùng editorial data xác nhận live opening |
| Airport source semantics | PRESERVED | Null schedule unresolved; archive/fallback không bị sửa |
| Additional Weather/Cano report contracts | PENDING | Cần semantic admission riêng |
| Full G1/G2/G3/G4/G5 | NOT_PASSED | Restore/fencing, retention/cost, 72 giờ/7 ngày và switch/rollback còn thiếu |
| Production authority / public cutover | NOT_EXECUTED | Giữ hệ nguồn, UI và route đang dùng tốt |
| Whole Core 2.0 production-ready | FALSE | Feed reference đã chạy; các gate vận hành còn thiếu |

Owner đã cấp toàn quyền. Không có yêu cầu xin phép đang chờ. Lease display không thay thời gian observation/model/provider; reference vẫn ABSTAIN và operational action bị đóng.

Đọc [checkpoint đã ghim](../evidence/core2-source-feed-20261003/CHECKPOINT.md). Immutable V2.1 và mọi counterexample được giữ nguyên.
