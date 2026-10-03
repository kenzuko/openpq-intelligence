# Checkpoint Core 2.0 - 03/10/2026

Đã chứng minh đường nhận snapshot nguồn thật trên Cloudflare account riêng. Chưa hoàn tất vận hành production và chưa nối consumer hệ cũ.

## Bằng chứng mới

- Actions 37101416540 SUCCESS, source deploy b245ac102df3d97c257fab03cd8153ac0d08e341.
- 264/264 native tests PASS, không fail/skip. Các test cũ vẫn giữ nguyên ý nghĩa; đã thêm kiểm tra môi trường isolated, pin account, registry nhiều dataset, quyền theo dataset, giới hạn thời gian và readiness theo đúng digest mới.
- 15/15 ca cloud PASS: 11 dataset thật, native identity, cùng tồn tại trên Runtime, mất quyền đọc Core và phục hồi đủ 11, đóng quyền admission tạm với witness dương tính.
- 11 backup tải về đã xác minh chữ ký và retained generation bằng locator/key public ghim riêng. Các lớp control/audit trong backup không được nâng thành toàn hệ thống đã phục hồi. Chưa chứng minh offsite/PITR/RPO/RTO/resume writer.
- Schema cloud: 5 schema, 50 mẫu hợp lệ và 150 mẫu âm tính PASS.
- CLOUD_PROOF.zip là artifact gốc, SHA256 9467f3f779f8659bab91685ead4b39c7117aa6d9e63fa1cf2e8877bdf9248ded; chứa locator public, profile, evidence, mẫu schema và cả 11 portable backup.
- 34 lần đọc Runtime VERIFIED đo tại runner: median 267.5ms, max 364ms. Đây là đo trong lượt proof, không phải SLA production hoặc độ trễ cập nhật nguồn.

## Phạm vi nguồn

Weather: current, forecast, marine, cloud, compact, meta và manifest (7 dataset). Airport: 1. Transit: 1. Near Me index: 1. Cano An Thới: 1. Tổng 11.

Nguồn là snapshot thật đã capture và ghim trước đó, không đọc mới hệ cũ trong lượt này. Airport giữ timestamp capture và nhãn quá độ trễ mục tiêu khi đã cũ; không đánh giá pipeline đang chạy lỗi từ dữ liệu replay. Weather giữ thời gian quan trắc/mô hình riêng. Transit giữ ngày thật và trạng thái vé chưa biết. Near Me giữ dữ liệu nguồn và không chế toạ độ/trạng thái mở cửa.

Các bridge còn là reference-only, effect ABSTAIN, không bật production hoặc độc lập producer. Lease reference của 10 bridge có giới hạn 5 phút và sẽ hết hạn; đây không phải feed liên tục. Cano giữ giới hạn ngày theo source timestamp, không kéo trạng thái qua ngày mới. Support/venue companion của Near Me đã có parity nhưng chưa là authority dataset riêng trên cloud.

## Những lỗi đã xử lý

- Registry trust/profile và capability được chia binding có giới hạn UTF-8, hỗ trợ đủ 11 dataset đồng thời. Runtime dùng read capability riêng theo dataset.
- API /datasets/<id>/legacy-reference trả nguyên byte JSON nguồn sau khi kiểm độc lập signed receipt, generation hash, profile pin và source hash. Có header reference-only, ABSTAIN, digest và display deadline. Không tự gia hạn source time.
- Cloud runner tạo command ID đúng tập ký tự cho phép. Lease lấy từ một clock sample, tránh trượt quá 300000ms chỉ vì hai lần đọc đồng hồ khác nhau.
- Readiness đối chiếu digest vừa commit; bản Runtime cũ trả DISPLAY_EXPIRED không được tính là thành công. Outage/recovery kiểm từng dataset, đúng receipt và không có operational eligibility.
- Khi đổi capability ở Core, proof triển khai lại Runtime cùng binding, ghi mã lỗi nội bộ an toàn và xác minh cả đường Core trực tiếp lẫn Runtime. Lượt cuối hồi phục đủ 11.
- Helper deploy một dataset đã được vá để xóa slot trust/profile/read-token map không dùng, tránh cấu hình nhiều nguồn sót lại khi quay về workflow cũ. Đây là thay đổi tooling sau source deploy, đã chạy lại 264/264 local tests; Worker source trùng bản cloud đã kiểm chứng.
- FAILED_ATTEMPTS.json giữ riêng các lượt lỗi; không nâng lượt lỗi thành PASS. R2 lịch sử chưa bị xóa và GC chưa được bật.

## Điểm cần chủ hệ thống

Yêu cầu ban đầu giữ khóa đọc hệ cũ. Cloud riêng đã có snapshot/recovery proof và CONSUMER_REVIEW_PLAN.json đã chuẩn bị mapping 11 dataset. Cần chủ hệ thống mở phạm vi đọc output và cấu hình consumer hiện tại để đối chiếu nguồn đang cập nhật, chuẩn bị continuous ingestion và bản chuyển đổi.

Việc tiếp theo sau khi mở khóa: đọc đúng output hiện hành, xác minh dependency các companion, giữ engine/UI đang tốt, xây cấu hình ingest có identity/provenance cố định thay vì đổi pin capture mỗi lần, chuẩn bị diff và rollback có thể review. Sau đó hoàn tất các gate production còn lại trước khi chuyển consumer.

Main vẫn c8d020acd14267f673ffae1dc06f851f511b2027. Không ghi hoặc đọc mới repo hệ cũ, không deploy production, không sửa DNS và không cutover public consumer. Account test dùng đúng c61a28455fe22f30619b35dd80c2d495 và bucket isolated đã preflight.
