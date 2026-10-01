# Prompt bàn giao cho luồng thực thi

Copy phần dưới và đính kèm ZIP V2.1. Không cần đính lại gói V1 riêng, vì reference đã nằm trong ZIP.

---

Tiếp tục OpenPQ Intelligence từ gói Final Design Handoff V2.1 ngày 01/10/2026.

Đọc 00_START_HERE, `18_AMENDMENT_A001_HARDENING.md` rồi toàn bộ tài liệu chính trước khi làm. Kiểm tra MANIFEST.json/checksums. Bản V2.1 là authority; reference/V1 chỉ để truy vết. Nhiệm vụ là tiến hành inventory và implementation theo gates, không phản biện vô hạn từ đầu. Thiết kế đã khóa. Nếu phát hiện lỗi mới thật, tạo ADR/amendment mới ghi parent release+SHA, concrete counterexample, sections superseded, tests mới và quyết định/approval status trước thay đổi bước phụ thuộc. Không sửa đè released V2 hoặc V2.1 ZIP/manifest.

Mục tiêu: một logical platform và publishing authority per dataset, nhiều evidence sources, domain độc lập, Core/Runtime độc lập; giữ verified knowledge của Weather/Airport/Transit. Không rewrite thuật toán đã đúng chỉ cho đẹp.

Ranh giới bắt buộc:

- OpenPhuQuoc public canonical https://openphuquoc.com; CMS chỉ admin/editor/internal API. Không đổi public origin về CMS.
- Giữ specialized Weather/Airport/Transit UI và logic đã verified trong giai đoạn backend migration.
- JoTrip Ops hiện read-only dashboard. Không gắn commands vào Ops. Operator API/Console làm riêng; không tự nối lại Ops.
- Runtime không source credentials/canonical write; consumer không hidden collectors/truth rules.
- LIVE/SHADOW/BACKFILL/REPLAY có capability khác nhau; chỉ authenticated LIVE đúng generation/epoch/control/revision mới promote.
- Coordinator transaction là điểm active commit. Immutable canonical generation first; checkpoint R2 không có quyền bầu authority.
- Freshness/expiry/control-validation áp dụng khi serve, cả khi Core down/cache/offline. Unknown không thành safe; manual hôm trước không carry hôm sau; hết closure TTL không thành mở lại.
- Operational fact và recommendation riêng; weather recommendation không tự sửa ferry fact thành cancelled.

Bắt đầu bằng P0: tuyệt đối read-only repos/resources; inventory current repos/main, collectors, source/output paths, cron, rules/incidents, credentials references, history, licenses và consumers. Ghi repo identity, branch/ref, exact local HEAD/remote main SHA, working tree/index state và open PRs/branches/touched scopes. Report/clone riêng được phép; không checkout/reset/stash/fetch đổi refs trong checkout dùng chung. Trước write đầu tiên và push/PR update/merge re-check main/base SHA; nếu đổi thì reread affected area/dependencies và rerun relevant tests. Không force push, rewrite history hay overwrite/delete parallel changes. Dùng task branch/worktree riêng nếu checkout dirty/shared. Đừng đánh Aviation failed chỉ vì path legacy thiếu: tìm output live thật đang hoạt động.

Sau inventory làm P1-P3 contracts/harness, Coordinator/storage capability proof, Runtime expiry. Cloudflare baseline đã chọn là DO SQLite per dataset + R2 immutable + Runtime S3 read-only; verify official primitive/limits và T01-T08/T47/T50/T54 trước live integration. Không dùng primitive khác mà silently bỏ invariant. P1-P3/G1 không dùng production DO namespace/R2 bucket/route/cron/command-publisher-signing credential hoặc service binding có quyền production. Preflight ghi actual environment/account/resource IDs/bindings và sanitized capability references vào evidence report; overlap/unknown thì BLOCKED trước test. T59 kiểm tra wrong Coordinator locator, T60 revoke-deny, T61 isolation, T62 parallel-work và T63 immutable snapshot. Runtime chỉ tin current approved locator tuple/key scope; locator migration explicit, không sửa config thường.

Chọn domain pilot dựa inventory/risk, port pure verified kernels và golden masters. Shadow dùng same evidence khi được phép; parity field-level, không fake interpolate, không fake seats, không lấy monthly schedule thay ngày thật. Unknown critical differences chặn G3.

Phân biệt bridge-dependent, canonical transferred và producer-independent. Không coi cached output là kill-test pass. Không retire legacy cron trước cadence/parity/rollback/independence evidence.

T01-T63, tổng 63 tests trong gói hiện NOT RUN. Chạy appropriate tests và lưu sanitized evidence report. Policy values chưa đủ thì gate liên quan BLOCKED, vẫn tiếp tục independent authorized tasks. Không điền ngưỡng an toàn hoặc RPO/RTO bịa. Không gọi design final là production ready.

Gói cho phép tiếp tục thiết kế implementation và chuẩn bị/code/test cô lập theo nhiệm vụ này. Chưa thay DNS, deploy production Worker, activate canonical production, chuyển consumers hoặc retire cron nếu chủ hệ thống chưa đưa chỉ thị cụ thể. Có thể hoàn thành mọi công việc cần để bước cutover review được cụ thể trước khi xin quyết định cuối.

Trong báo cáo: kết quả đã làm, evidence/pass/fail/blocked, next gate và chỉ những thông tin thực sự cần chủ hệ thống cung cấp. Không hứa đã deploy/độc lập nếu chưa có bằng chứng. Không yêu cầu xác nhận lại cho read-only inventory hoặc các reversible isolated tasks thuộc scope đã được giao.

---

## Khi chủ hệ thống đã cấp thêm quyền tại luồng sau

Chỉ thị mới có phạm vi cụ thể có thể mở G4/G5 khi technical gates đã pass. Không bắt hỏi lại nếu scope đã rõ và được cấp. Deployment permission không thay parity/security/restore gates; nếu gate fail, báo evidence và tiếp tục xử lý phần có thể làm.
