# Task board cho luồng free

Chọn một task trong một turn. Ưu tiên F01 hoặc F02. Chưa cần tạo tài khoản, credential hoặc cloud resource mới.

| Task | Việc làm | File/output được ghi | Tiêu chí đạt | Gate |
|---|---|---|---|---|
| F01 | Re-inventory latest main của Home/Weather/Lab/Airport/Transit bằng code read-only | `docs/free-results/F01_INVENTORY_<date>.md/json` | Exact repo/branch/SHA/time; producer/output/reader relationship; open PR overlap; tách code presence với deployed evidence; unknown ghi rõ | Có thể làm ngay |
| F02 | Thêm 8-12 synthetic adversarial replay cases | New cases trong `fixtures/semantic/corpus.json`, `tests/semantic*.test.js`, report riêng | Hand-derived expected effect/deadline/reasons; case cũ giữ nguyên; schema missing/time/scope/expiry fail-closed; chạy local nếu có terminal | Có thể làm ngay |
| F03 | Review full registry graph contract và lập counterexample trước integration | `docs/free-results/F03_REGISTRY_GAPS.md`; fixture/test đề xuất | Chỉ rõ semantic ref nào shape-checked nhưng chưa resolved; license/mapping/version/time activation còn thiếu; không chỉnh Core/trust | Có thể làm ngay dưới dạng review |
| F04 | Lập ma trận T01-T63 đối chiếu test/evidence thật | `docs/free-results/F04_TEST_EVIDENCE_MATRIX.md/json` | Mỗi row có exact test/file/run/SHA, LOCAL/CLOUD/PARTIAL/NOT_RUN; không nâng global PASS; T59-T63 đúng hardening | Có thể làm ngay |
| F05 | Chuẩn bị golden corpus pilot từ output thật đã được phép | Plan và schema corpus, không thu thập raw chưa rõ quyền | Chỉ thực thi sau chọn pilot và xác định P05/P08/P09/P10/P16/P17; nếu thiếu ghi BLOCKED và câu hỏi cụ thể | BLOCKED về source ingestion |

## Gợi ý case cho F02

Expiry đúng [from,to), just-before/at/after boundary; source_validity bắt đầu tương lai; clock skew vượt policy; fresh fetch với source_time cũ; assertion/evidence mismatched time/type; manual confirmation location/version khác; official closure wrong scope; expired closure không tự thành OPEN; replay/emitted phân biệt; input permutation không đổi output identity; history hash thay đổi phải đổi input identity; PARTIAL/CONFLICTING quality không positive.

Fixture policy chỉ dùng số synthetic được ghi rõ, không lấy số đó làm SLA. Không thêm test đòi actual GO/HOLD/CANCEL theo ngưỡng chưa duyệt. Không tự sửa expected để khớp code sau khi phát hiện bug. Ghi counterexample trước, giữ failing fixture, đề xuất sửa hẹp rồi kiểm lại.

## Chủ trách nhiệm cho phần chưa giao free

Authority migration/recovery, scheduler ledger/retry/backpressure, retention/pins/GC, security/roles/SSO và cloud failure proof cần changeset chuyên biệt với test gate. Luồng free có thể review/đề xuất fixtures; chưa được tự deploy/activate. Usage/cost/RPO/RTO cần owner dữ liệu/chấp nhận thật; không sinh thêm quyền billing/admin cho tiện.
