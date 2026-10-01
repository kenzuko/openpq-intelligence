# Phản biện cuối tại thời điểm bàn giao

Kiến trúc authority đã khóa. Chỉ thay đổi khi implementation đưa ra concrete counterexample. Không cần vòng thiết kế tổng thể vô hạn.

| Phản biện | Xử lý và bằng chứng | Giới hạn còn lại |
|---|---|---|
| Coordinator locator split-brain | Exact native tuple kiểm dispatch/DO/control/receipt/trust; alternate native locator tests; immutable A001 | Explicit authority migration/recovery chưa implemented |
| Parallel-work overwrite | P0 exact SHA/open PR/worktree snapshot, repo độc lập; prompt khóa re-check main/read affected/tests | Snapshot historical; F01 phải cập nhật |
| Test cầm production capabilities | Production environment/config guard, narrow real cloud resource/token preflight | Toàn bộ legacy/private Ops deployed inventory còn pending |
| Revoke không tức thì | Baseline fingerprint/object + actual denial + positive witness; run 36856013892 | GET credential tại một runner; chưa storage-write/command migration proof toàn cầu |
| Immutable handoff | 36 reference payload hashes + unchanged V2 ZIP; new ADR/evidence separate | Luồng sau phải tiếp tục rules và new evidence lineage |
| Native runtime khác Node | Actual workerd S3 test đã bắt Illegal invocation và redirect mode fault | Tăng corpus nếu concrete native failure mới xuất hiện |
| Secret update/deploy không đồng nghĩa revoke | Explicit pinned bundle deploy + actual capability probes | Không suy diễn control-plane update thành dataplane success |
| HTTP 401 bị đánh trượt | PR #10 hỗ trợ 401 chỉ khi removal confirmed + exact positive witness; failed run vẫn giữ | Không whitelist 404/network hoặc signature 403 làm revoke evidence |
| Semantic schema chưa có code | Fixture validators + deterministic replay/corpus, 72 local tests | Full registry graph/policy/domain/wire integration chưa hoàn tất |

## Các counterexample nên tìm tiếp

1. Artifact ID/version hợp lệ nhưng policy graph missing/incompatible/expired: chưa được admit positive chỉ nhờ hash shape.
2. Source clock/time basis không rõ hoặc payload cache re-fetched: source age không được reset.
3. Dependency bị revoke nhưng composition stamp còn sống: serving phải abstain, không coi stamp composition thay mọi dependency.
4. Retention/legal deletion làm mất pinned active evidence: decision eligibility/replay capability cần degrade rõ.
5. Authority restore/new locator trong lúc old writer còn capability: old authority không được Runtime tin là current.

Những mục trên là task proof/integration cụ thể, không lý do đổi sang kiến trúc khác. Full G1/G2 vẫn thiếu evidence/policy; không dùng bộ fixtures mới để ký thông hành production.
