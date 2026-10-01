# Phản biện cuối và sổ quyết định

## 1. Vòng 1 được xử lý ở đâu

| Điểm chặn | Quyết định V2.1 | Bằng chứng cần khi thực thi |
|---|---|---|
| B1 - Epoch chưa chặn race | Coordinator commit owner/epoch/control/expected revision trong một transaction | T01-T08 |
| B2 - Slot lẫn correction/rollback | Slot nghiệp vụ riêng; publication revision riêng; correction/retraction append | T09-T13 |
| B3 - LKG giữ nhãn GO | Runtime serve view riêng, expiry và control freshness giới hạn hành động | T14-T20 |
| B4 - Hysteresis thiếu lịch sử | Prior-state/history refs bắt buộc cho stateful rule | T21-T23 |
| B5 - Composition trộn thời điểm/fact | Dependency contract, temporal/spatial fit, fact và recommendation riêng | T24-T28 |
| B6 - Operator thiếu quyền | Console/API riêng; scope, audit, concurrency, policy cho giảm bảo vệ | T29-T32 |
| B7 - Bridge bị gọi độc lập | Ba mốc migration và kill tests cập nhật qua cycle thật | T33-T38 |
| B8 - Restore làm epoch lùi | Recovery generation mới, revoke credential, restore trong isolation | T39-T44 |
| B9 - Immutable bị hiểu lưu mãi | Retention/license và replay capability rõ | T45-T48 |

## 2. Phản biện chính bản sửa

### “Chỉ cần một DO, mọi race tự hết?”

Không. External await có thể làm handler xen kẽ. V2.1 yêu cầu kiểm tra lại mọi điều kiện sau I/O trong transaction đồng bộ. Blob upload không nằm trong transaction control. Candidate được chuẩn bị trước; final commit là điểm linearization. Không dựa vào process uptime hoặc thứ tự request.

### “Hai store thì vẫn cần distributed transaction?”

Không cần two-phase commit cho V1. Blob chưa được active chỉ là candidate. Ghi blob hoàn chỉnh, kiểm tra hash, đăng ký prepared record/pin rồi transaction đổi con trỏ active. Nếu crash, trạng thái active vẫn là trước hoặc sau transaction. Blob orphan được GC có grace period. Active manifest duy nhất nằm ở Coordinator. R2 checkpoint là bản sao để đọc LKG, không được bầu writer hay tự promote.

### “Checkpoint R2 có thể chạy lùi khi hai tác vụ xuất cùng lúc?”

Có nếu ghi mù. Export dùng receipt đã commit, identity recovery-generation + revision, conditional write và kiểm tra ordinal cùng generation. Update cũ không ghi đè projection mới. Retry conflict đọc lại rồi hội tụ. Recovery dùng namespace mới và danh sách generation được deployment chấp nhận, không so UUID như số tăng dần. Runtime không gọi projection là authoritative latest khi control không kiểm chứng được.

### “Một snapshot có GO hợp lệ còn dùng được sau override mới?”

Chỉ trong giới hạn propagation được ghi rõ. V2.1 không hứa immediate global revocation qua cache. Positive recommendation/action eligibility phải có control validation hạn ngắn, revision/control stamp còn khớp và các dependency còn valid. Khi mất control, positive eligibility chỉ sống đến expiry đã cấp, sau đó abstain. Observation/display có thể tiếp tục lâu hơn nhưng nhãn thay đổi. Purge cache chỉ hỗ trợ tốc độ, không là nền correctness.

### “Manual hết TTL là mở cửa lại?”

Không. Expiry làm mất assertion/override đang dùng, không tạo bằng chứng positive. Closure có ngày mở lại dự kiến vẫn là một dự kiến, không phải open confirmation. Một closure vô thời hạn cần review_due_at; không vì thiếu reconfirmation mà tự public OPEN. Giữ last reported closure tách khỏi current confirmed operational state.

### “Nếu source phát cực trị thật, quarantine có làm bỏ cảnh báo?”

Có nguy cơ. V2.1 phân biệt structurally impossible/corrupted với plausible extreme. Extreme hợp lý được giữ như evidence có anomaly flag. Với dữ liệu chưa kiểm chứng, abstain hoặc precaution theo policy; không silently thay số bằng giá trị dễ chịu, cũng không bỏ bằng chứng nguy hiểm chỉ vì khác model.

### “Một producer/queue bị lỗi có làm domain khác treo?”

Nếu gom chung concurrency/secret/CPU có thể xảy ra. V2.1 khóa isolation budget theo domain; process riêng khi source/security/duration cần. Không một queue chung không giới hạn, không global synchronous pipeline. Coordinator sharded theo dataset. Shared account/storage/provider vẫn là correlated risk được thừa nhận.

### “Một sổ source/rule ở git thì rollback code kéo rule cũ?”

V2.1 tách artifact đã build khỏi activation record. Code rollback không đổi active rule/config. Nếu code không hỗ trợ active contract thì không cho activate code đó, hoặc thực hiện explicit rule rollback có audit trước. Hash/version không được tái sử dụng cho nội dung khác.

### “Một lần replay đủ chứng minh deterministic?”

Không. Replay phải dùng đúng input refs, history/checkpoint, mapping, policy/config, evaluation time. Cùng artifacts nhưng khác arrival history có thể khác emitted decision hợp lệ. V2.1 tái hiện đúng history đã được quyết định, hoặc đánh dấu recomputed alternative, không tráo hai loại.

### “Closure đặt trước cho chiều nay, Core chết trước giờ đó?”

V2.1 bổ sung next restrictive transition vào control metadata. Positive action validity/control stamp bị clamp đến effective_from liên quan. Khi qua thời điểm đó, Runtime không cấp stamp positive mới cho snapshot chưa recompute, dù bytes cũ vẫn active. Không dựa cron chạy đúng giờ để chặn quyết định cũ.

### “GC xóa dedup record rồi message rất cũ quay lại?”

V2.1 gắn command/job deadline và retention tối thiểu cho supported retry window. Message vượt cửa sổ reject hoặc historical handling, không tự trở thành live intent mới. Business dedup phải tồn tại qua epoch transfer; replay/recovery không phát lại notifications cũ.

### “Partial operator coverage có bị xem là incomplete generation?”

Không. V2.1 làm rõ technical completeness khác data coverage. Generation đủ envelope/references có thể chứa PARTIAL coverage được domain policy cho phép và missingness rõ. Nếu cấm mọi partial coverage, hệ thống dễ giữ một LKG nhìn đầy đủ nhưng đã lỗi thời; đó cũng là stale-as-fresh path.

## 3. Tradeoff đã chấp nhận

| Tradeoff | Chọn V2.1 | Giới hạn |
|---|---|---|
| Control unavailable | Dừng promotion, bounded LKG reads | Không có continuous fresh truth khi control down |
| Một provider V1 | Cloudflare baseline, portable artifacts/interfaces | Không active multi-cloud; provider outage có thể unavailable |
| Cache và revocation | Bounded validation lifetime | Không guarantee thu hồi tức thì trên client offline |
| Cross-domain state | Exact refs + skew/validity contracts | Không global atomic snapshot mọi domain |
| Raw retention | Tuân quyền nguồn, replay có giới hạn | Không hứa replay đầy đủ sau khi evidence hết hạn |
| Domain autonomy | Cadence/executor/budget riêng | Shared platform outage vẫn có thể ảnh hưởng nhiều domain |
| Manual operations | Quyền có scope, giảm bảo vệ kiểm soát hơn | Không thêm approval hai người cho mọi thao tác thường ngày |

## 4. Cơ hội giản lược đã thực hiện

- Registry bắt đầu bằng versioned artifacts; chưa làm CMS cho registry.
- Không thêm message bus cho từng tầng xử lý.
- Không thêm global gateway hoặc database analytics vào critical path.
- Incidents/telemetry không bị ép dùng transaction chung với authority.
- Không đưa booking, payment hay lệnh AI vào V1.
- Ops không là control plane; chỉ thiết kế Operator API/Console tối thiểu riêng.
- Hysteresis chỉ áp dụng rule thực sự cần, không mọi trạng thái.

## 5. Kết luận vòng cuối

Không còn mâu thuẫn kiến trúc đã biết trong phạm vi tài liệu sau khi áp dụng hợp đồng V2.1. Các unknown còn lại là inventory, giá trị policy nghiệp vụ và khả năng primitive thực tế. Chúng có gate chặn cụ thể, không bị che bằng lời “sẽ xử lý sau”. Có thể đi sang thiết kế implementation; chưa được bỏ qua test hay coi hệ thống đã production-ready.


## Amendment A001 - 5 hardening được chấp nhận

Coordinator locator, parallel-work safety lock, isolation capabilities, revocation deny probes và immutable handoff lineage đã được áp dụng trong V2.1. Counterexamples/sections superseded chi tiết tại `18_AMENDMENT_A001_HARDENING.md`. Đây là bổ sung bảo đảm implementation, không thay kiến trúc tổng thể. Không tiếp tục tìm framework tốt hơn khi chưa có counterexample thật.
