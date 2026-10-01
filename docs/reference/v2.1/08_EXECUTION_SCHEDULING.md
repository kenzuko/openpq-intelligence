# Execution, scheduling và budgets

## 1. Modes và identities

LIVE có thể submit promotion khi capability/control hợp lệ. SHADOW chỉ candidate namespace. BACKFILL ghi lịch sử trong historical namespace. REPLAY recompute alternative outputs, không gửi thông báo hoặc thay active pointer. Permissions tách theo mode, không chỉ flag truyền từ caller.

Collection identity: source/dataset + logical slot + mode + request intent. Execution attempt có run_id, authority generation/epoch và retry attempt. Evaluation identity có evidence fingerprint + rule/config/policy/prior-state refs. Publication idempotency dựa candidate/command identity, không đơn giản source slot.

Epoch thuộc execution capability; không nằm trong business dedup key duy nhất vì epoch đổi không tạo sự kiện thế giới mới. Ví dụ cùng thông báo đóng cửa không phát alert lại chỉ vì cutover epoch mới.

## 2. Scheduling và completion

Mỗi domain policy định nghĩa expected cadence, source latency, slot meaning, backlog cap và catch-up. Một logical orchestration policy không bắt một scheduler process cho mọi domain. Triggers cadenced/event/manual có thể độc lập, cùng durable job ledger semantics.

Ledger states: REQUIRED, LEASED, COLLECTED, COMPUTED, COMMITTED hoặc TERMINAL_FAILED/SKIPPED_WITH_REASON. Watermarks theo ý nghĩa: collected-through, evaluated-through, published-through không đồng nhất. Failed slot không được tăng success watermark; explicit skip obsolete được ghi riêng. Lease expired có thể retry, không xác nhận success.

Baseline persistence: slot/lease ledger gắn Coordinator hoặc control instance theo domain khi volume cần tách; shared-source budget có control instance theo quota group nếu nhiều executors dùng chung quota. Có thể dùng cùng DO technology/namespace với typed IDs, không bắt thêm database/service. Scheduler/budget instance không có quyền promote dataset khác.

Trước fetch dùng source budget; trước promotion dùng Coordinator gate. Control unavailable có thể tiếp tục collection bounded nếu allowed policy và evidence store hoạt động, nhưng không promote hoặc tích backlog vô hạn.

## 3. Catch-up theo domain

| Domain | Chính sách khởi điểm để kiểm chứng |
|---|---|
| Weather/model | Thu latest eligible model cycle; historical gaps backfill riêng; không lấy obsolete forecast làm current |
| Aviation/live | Rebuild latest live scope và reconcile late source updates; không replay mỗi poll missed như current |
| Transit/schedule | Recheck ngày thực và trip scope; bỏ obsolete query có reason; vé chỉ on-demand theo nghiệp vụ |
| Cano/manual | Chờ đúng xác nhận ngày/phạm vi; không tự replay confirmation hôm trước |
| Composition | Coalesce triggers, dùng exact admissible refs; bỏ candidate outdated bằng commit checks |

Source-specific verified semantics từ inventory có quyền ưu tiên hơn giả định bảng này sau khi được đưa vào policy version. Không dùng monthly ferry schedule thay ngày thật, không seat count bịa.

## 4. Queues/workflows

Direct Worker khi bounded duration và dependencies phù hợp. Queue khi cần async retry/load buffer/failure isolation. Workflow chỉ khi long-lived multi-step/resume cần thiết. Không chọn một cơ chế cho mọi domain từ đầu.

Queue messages có idempotency identity, slot, mode, source/candidate refs, deadline, intent và attempt. Không chứa raw secrets hoặc payload khổng lồ. Assume duplicate và out-of-order. Retry không được đổi mode; late expired jobs trở thành historical/skip theo policy, không force current.

Poison payload -> bounded retries, dead-letter/quarantine với reason, không infinite retry. Domain concurrency và source budget caps; một nguồn 429 không giữ toàn bộ consumers bận. Nếu queue dùng chung vật lý, phải chứng minh per-domain fairness/budget; nếu không, tách vì isolation cụ thể.

## 5. Circuit/budget semantics

Distinguish timeout/network/TLS/429/5xx/schema/semantic errors. Respect provider retry window; jitter/backoff bounded. Circuit CLOSED/OPEN/HALF_OPEN, half-open concurrency bounded. Budget counters owner theo source/quota group; shadow reuse evidence tránh double-fetch.

Shadow thu cùng evidence được phép dùng tạo comparison tốt hơn gọi hai thời điểm khác. Nếu cần independent collector comparison, có request budget và attribution rõ. Không vượt source permissions để đạt parity.

Max payload/redirect/timeouts/requests/concurrency/retries phải có values trong activated source policy trước live integration. Defaults conservatively bounded, không “unlimited until measured”.

## 6. Health và incidents

Run metadata: run_id/dataset/source/mode/epoch/generation, slot, scheduled/start/finish, retry_count, records_in/out, source_age, completeness, candidate digest, publish result, watermark effect và error class.

Health axes riêng; heartbeat đo last successful source collection, source progress, last semantic validation, last commit, backlog age và active snapshot/source ages. Có thể producer chạy đều nhưng source không đổi hoặc source timestamp stale; đừng gọi pipeline-good là world-fresh.

Incident key theo domain/source/failure class/scope; repeated errors update một incident. Recovery requires progress, không đóng incident chỉ vì một HTTP 200. Alerts không phát vô hạn; audit/dedup bảo tồn qua authority migration.

## 7. Side effects V1

V1 không thực hiện booking/payment hay lệnh cho partner. Monitoring alert là optional integration sau chọn kênh/người nhận có quyền. Nếu triển khai alert, outbox + business idempotency; provider thiếu idempotency có thể duplicate trong ambiguous delivery, ghi rõ thay vì hứa exactly once. Replay/shadow/backfill không dispatch.
