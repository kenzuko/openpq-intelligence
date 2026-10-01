# OpenPQ Intelligence - bàn giao cho luồng free

Ngày: 01/10/2026. Mục tiêu: luồng free tham gia ngay bằng công việc nhỏ, độc lập, kiểm tra được. Chưa cutover production.

Đọc theo thứ tự:

1. File này.
2. `01_CURRENT_STATE.md` - kết quả thật và phần chưa đạt.
3. `02_ARCHITECTURE_AND_BOUNDARIES.md` - authority và ranh giới sửa.
4. `03_TASK_BOARD.md` - chọn đúng một task.
5. `04_FINAL_REVIEW.md` - phản biện đã xử lý và counterexample còn cần.
6. `05_FREE_EXECUTION_PROMPT.md` - prompt dùng trực tiếp.
7. `06_ACCEPTANCE_CHECKLIST.md` - điều kiện bàn giao lại.

Source of truth của implementation: https://github.com/kenzuko/openpq-intelligence . Commit phát hành và hash ZIP được ghi trong RELEASE.json của gói. Re-check main trước lần write đầu tiên. Nếu main khác snapshot, đọc lại file liên quan và chạy lại kiểm thử tương ứng. ZIP là snapshot tài liệu, không chứa credentials hoặc bản sao toàn bộ các repo đang chạy.

Kiến trúc gốc V2.1 nằm trong `reference/v2.1` ở ZIP và `docs/reference/v2.1` trong repo. Không sửa đè. Lỗi thiết kế thật phải có counterexample + ADR/amendment mới, chỉ rõ phần bị supersede và test mới.

Nếu luồng free không có terminal/GitHub: vẫn làm F01 hoặc F02, xuất Markdown/JSON/patch và ghi rõ NOT_RUN cho kiểm thử. Không nói đã chạy, merge hoặc deploy nếu không có bằng chứng. Có thể đọc code qua GitHub để đối chiếu. Nếu thiếu code cần thiết, liệt kê đúng file cần, không đoán implementation.
