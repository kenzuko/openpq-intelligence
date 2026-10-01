# OpenPQ Intelligence - Final Design Handoff V2.1

Ngày: 01/10/2026 | Phạm vi: thiết kế và bàn giao thực thi | Ngôn ngữ: Việt, giữ tên kỹ thuật cần thiết.

## Kết luận

**ARCHITECTURE LOCKED - READY TO START P0.** Các điểm chặn của review vòng 1 đã được xử lý ở mức thiết kế, kèm giao thức và ca kiểm chứng. Đây không phải chứng nhận production-ready: chưa kiểm tra repo, credentials, quota, tốc độ, source license hoặc chạy thử hạ tầng.

V2.1 là bản thiết kế cuối của vòng bàn giao này. Luồng tiếp theo được bắt đầu inventory chỉ đọc, thiết kế implementation và code/test cô lập theo yêu cầu của người dùng. Chỉ tích hợp nguồn thật sau các gate tương ứng. Deploy/cutover production cần chỉ thị rõ của chủ hệ thống tại luồng thực thi; gói này không tự cấp quyền thay DNS, cron, canonical đang chạy.

## Phạm vi đã khóa

- Một logical platform, authority riêng cho mỗi dataset; domain không import trực tiếp domain khác.
- Giữ các thuật toán, semantics và incident fixes đã kiểm chứng của Weather/Airport/Transit.
- Quyền active publication nằm ở Dataset Coordinator, có fencing và transaction; candidate không là canonical.
- Runtime đọc canonical, kiểm tra hiệu lực, phục vụ LKG có giới hạn; không làm một truth engine thứ hai.
- JoTrip Ops hiện là dashboard/read consumer. Không cấp lệnh vận hành cho Ops. Operator Console/API được thiết kế riêng; kết nối lại Ops chỉ khi chủ hệ thống yêu cầu sau này.
- OpenPhuQuoc public canonical vẫn là https://openphuquoc.com. CMS không được tái định nghĩa thành public origin. Không redesign specialized UI trong migration backend.

## Đọc theo thứ tự

Đọc `18_AMENDMENT_A001_HARDENING.md` ngay sau README. Đây là amendment đã được chấp nhận trong release V2.1, supersede các phần được chỉ rõ của parent V2. Parent ZIP nằm nguyên byte trong reference; hash tại `V2_PARENT_SNAPSHOT.json`.

1. `01_FINAL_REBUTTAL_AND_DECISION_LOG.md`: vì sao sửa, những tradeoff chấp nhận.
2. `02_ARCHITECTURE_MASTER_V2.md`, `03_INVARIANTS_V2.md`: cấu trúc và luật chung.
3. `04_DATA_CONTRACTS.md`, `05_AUTHORITY_PUBLICATION_PROTOCOL.md`: mô hình dữ liệu và đường commit.
4. `06_TRUTH_DECISION_COMPOSITION.md`, `07_RUNTIME_FRESHNESS_CACHE.md`: suy luận, hiệu lực và cách phục vụ.
5. `08_EXECUTION_SCHEDULING.md`, `09_OPERATOR_SECURITY.md`, `10_RECOVERY_RUNBOOK.md`.
6. `11_MIGRATION_CUTOVER.md`, `12_TEST_MATRIX_AND_GATES.md`, `13_IMPLEMENTATION_BLUEPRINT.md`.
7. `14_POLICY_REGISTER_AND_OPEN_ITEMS.md`, `15_TECHNOLOGY_ADRS_AND_SOURCES.md`.
8. `16_NEXT_THREAD_EXECUTION_PROMPT.md`: prompt có thể đưa nguyên sang luồng tiếp theo.

`OPENPQ_INTELLIGENCE_FINAL_DESIGN_V2_1_COMPLETE.md` gom toàn bộ tài liệu chính. `reference/` giữ gói V1 và review vòng 1 để truy vết, không phải authority khi mâu thuẫn với V2.1. `MANIFEST.json` chứa checksum các file; không chứa secrets.

## Thứ tự ưu tiên

Chỉ thị mới của chủ hệ thống > accepted amendment/release mới > hợp đồng V2.1 > policy đã duyệt có version > snapshots tham chiếu. Nếu implementation phát hiện primitive không bảo đảm invariant, dừng đúng gate, ghi concrete counterexample và tạo ADR/amendment mới có parent SHA, sections superseded, tests và quyết định. Không sửa đè released ZIP/manifest; không tự hạ tiêu chuẩn để deploy.

## Tuyên bố kiểm chứng

Đã thực hiện phản biện tài liệu nhiều vòng và đối chiếu primitive chính với tài liệu chính thức Cloudflare. Chưa có thử nghiệm phân tán, benchmark hoặc restore thật. Checklist chưa thực hiện vẫn để chưa đánh dấu. “Đã giải quyết trong thiết kế” không có nghĩa “test đã pass”.
