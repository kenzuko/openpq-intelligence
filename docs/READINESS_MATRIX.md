# Readiness hiện hành - Core 2.0

| Phần | Trạng thái | Evidence / giới hạn |
|---|---|---|
| F15 Cano offline | PASS_OFFLINE | 68/68, replay 33/33; không xác nhận vận hành ngày hiện tại |
| Full native Miniflare | PASS | 333/333 local; CI 37137862700 đạt 331/331 trước 2 acceptance tests cloud; final CI xác minh commit mới |
| Finite isolated cloud baseline | PASS_SUBSET | 25/25 run 37112667895; giữ riêng với Cron proof |
| Unattended reference feed | PASS_ACTUAL_CRON_SUBSET | 10/10 nguồn, run 37117134469; ingestion giữ source 1c9ca5f |
| Latest scoped feed health | PASS_AT_OBSERVATION | 10/10 healthy lúc 2026-10-03T16:01:00.146Z; không tự chứng minh uptime |
| Independent signed Cron backups | PASS_SUBSET | 10 bản Cron mở lại độc lập; chưa full disaster restore |
| Continuous-reference schemas | PASS_ACTUAL_SIGNED_SAMPLES | 5 schema, 50 positive/150 negative cho Cron; thêm 50/150 từ cloud restore thực |
| Read-only monitoring | CONFIGURED_WITH_COUNTEREXAMPLES | Lịch sử 2 health PASS, 1 FAIL, 1 UNKNOWN; gaps và 72 giờ/7 ngày chưa PASS |
| Consumer capture / native rehearsal | PASS_PREVIOUS_SCOPED_SNAPSHOT | 23/23 capture, 9/9 rehearsal; không tự biến mọi route thành Core contract |
| Near Me companions | PARITY_PASS_NOT_AUTHORITY | Editorial data chưa xác nhận live opening |
| Airport source semantics | PRESERVED | Null schedule unresolved; không sửa specialist engine/archive fallback |
| Additional Weather/Cano report contracts | PENDING | Cần admission riêng, không cấp operational action từ reference |
| Generic frozen native recovery cloud | PASS_ACTUAL_SUBSET | 5/5 run 37126753697; original command/gateway deny, distinct target, restart, cleanup |
| Domain archive dependency closure | PASS_CAPTURED_SUBSET | 10 signed native archives, full semantic artifact preimages/all generations, independent readback |
| Frozen native domain restore | PASS_ACTUAL_NATIVE_SUBSET | 10/10 fresh targets, persisted restart, signed target reopened after disposal |
| Frozen cloud domain restore | PASS_ACTUAL_CLOUD_SUBSET | 10/10 run 37134123700; current owned captures, narrow authenticated archive read, epoch 8 frozen, restart, fencing and cleanup; independent signature/schema readback |
| Recovered archive Runtime | PASS_ACTUAL_READONLY_CLOUD_SUBSET | 10/10 run 37137903513; direct R2 read, không Core/native/write binding; source time giữ nguyên, lease expired/ABSTAIN; read key PUT/DELETE 403, cleanup xong; chưa live writer resume |
| Forecast future-frame admission | PASS_BOUNDED_FIX | Signed counterexample: same cycle, unchanged metadata/retained values, one future frame; mutation/rollback/live removal denied |
| Isolated Core Forecast patch | PASS_ACTUAL_SCOPED_DEPLOY | Run 37134617745, Core version 21c8c7c3-195e-43ff-8b53-c69a8aad57ce; signed revision 70 to 71; owner/epoch/profile held, other 5 Worker versions unchanged |
| Full G1/G2/G3/G4/G5 | NOT_PASSED | Complete restore/credential/config coverage, retention/cost, cycle coverage, 72 giờ/7 ngày và controlled consumer switch/rollback còn thiếu |
| Production authority / public cutover | NOT_EXECUTED | Giữ specialist engines, UI và routes đang dùng tốt |
| Whole Core 2.0 production-ready | FALSE | Frozen archive recovery không phải live Runtime restoration hay writer resume |

Owner đã cấp toàn quyền. Không có yêu cầu xin phép đang chờ. Display lease không thay source observation/model/provider time; reference vẫn FACT/ABSTAIN, source policies và operational action chưa kích hoạt.

Bằng chứng: [cloud domain recovery](../evidence/core2-domain-frozen-cloud-20261003/success-37134123700/CHECKPOINT.md), [Forecast patch](../evidence/core2-forecast-regression-20261003/CHECKPOINT.md), [scheduled feed](../evidence/core2-source-feed-20261003/CHECKPOINT.md). Immutable V2.1 và counterexamples được giữ nguyên. Direct S3 writer-key revocation, full offsite/deployment/scheduler/credential restore và domain SLA/RPO/RTO chưa được chứng minh.

Đọc [recovered Runtime checkpoint](../evidence/core2-recovered-runtime-cloud-20261003/CHECKPOINT.md). Protected Runtime chưa deploy tính năng mới; đây là code/harness và temporary cloud proof, không cutover serving công khai.
