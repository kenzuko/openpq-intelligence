# Failure matrix và recovery runbook

## 1. Trạng thái lỗi

| Lỗi | Tiếp tục | Dừng/degrade |
|---|---|---|
| Một source | Domain sources khác và unrelated domains | Source-specific coverage thiếu, circuit/retry |
| Một executor | Runtime/Coordinator khác, history | Fresh updates domain đó; bounded LKG |
| Coordinator dataset | Bounded collection và verified checkpoint reads | Promotion/authority changes; positive validation hết hạn |
| Canonical R2 | Collection nếu evidence store còn được, cached displays | New complete blob publication; cold reads có thể unavailable |
| Evidence store | Serving committed canonical | New evidence-dependent compute, không giả input |
| Runtime | Core/Coordinator update | HTTP consumers dùng bounded cache hoặc unavailable |
| Shared registry artifact missing | Already pinned artifact nếu kiểm chứng được | New activation; positive compute thiếu artifact abstain |
| Cloudflare/account outage | Offsite archived review theo kế hoạch nếu có | Có thể cả live service unavailable; V1 không active multi-cloud |
| Semantic corruption | Quarantine/cross-check, unrelated domains | Invalid candidate; nếu đã active phải retract/degrade |

Không tự fail-open khi control/storage unavailable. Không xóa canonical chỉ vì health probe fail.

## 2. Backup phạm vi tối thiểu

Portable export bao gồm: canonical generations/receipts đang cần, authority/control audit, active rule/config/source/schema/identity/location artifacts, override/freeze state, scheduler success/gap metadata, deploy/code artifact refs và evidence còn được phép giữ. Secrets khôi phục riêng từ quản lý secrets, không nhét vào backup ZIP công khai.

Không cần đồng thời point-in-time mọi store: export có refs/checksums, thời điểm, watermark và replay capability. Restore chỉ active receipt nếu mọi blob/required artifacts còn có và verified. R2 checkpoint/export outbox lag ảnh hưởng RPO, phải đo.

Backup integrity khác quyền write production. Giữ export tách khỏi same destructive credentials; cold offsite location/cadence cần chọn theo RPO/RTO gate. Nếu chưa có offsite backup, không nhận cam kết phục hồi toàn bộ account deletion. Native PITR hữu ích nhưng không thay portable restore/test và không nằm ngoài provider.

## 3. Mục tiêu phải chốt trước live

RPO/RTO cho control, canonical, evidence theo từng domain; acceptable provider-wide downtime; max detection time; backup cadence/max export lag; restore drill frequency; người sở hữu recovery và nơi giữ trust config.

V2.1 không tự hứa SLA chưa đo. Numeric values nằm policy register: chưa đủ giá trị thì live gate fail. Development/test trong isolated environment vẫn được tiếp tục.

## 4. Restore authority không hồi sinh zombie

1. Cô lập môi trường/phạm vi dataset. Chặn promotion endpoint và tắt dispatch writers; ghi incident. Runtime còn phục vụ old bounded display nếu trust/correctness cho phép.
2. Thu hồi old writer/command/publisher write credentials và dừng old deployment/routes có thể nhận command. Revoke response không chứng minh quyền đã mất: thực hiện authorized disposable write/command auth-deny probes theo A001, ghi time/path/status/runner evidence và retry bounded nếu propagation chưa xong. Timeout/5xx/409 không là auth deny. Kiểm tra export/GC, binding và old Runtime routes; chúng không được ghi/cấp current-positive vào locator/generation mới. Nếu không chứng minh fencing đủ thì không resume. Không chỉ stop cron hoặc đợi cố định một phút rồi auto PASS.
3. Verify backup/checksums/artifacts; dựng mới Coordinator namespace/state isolated. Khôi phục payload/history cần thiết nhưng không tự enable active writer.
4. Tạo recovery_generation mới và credentials/signing trust mới phù hợp; generation cũ không còn accepted cho commands. Nếu namespace/native authority instance đổi, làm explicit locator migration có authority_locator_version mới theo A001. Bootstrap trust tuple được lưu/version hóa ở deployment/trust config, không tự restore từ backup control cũ. Old signing key không được tin cho current tuple mới.
5. Nếu biết epoch high-watermark cũ, new epoch vượt nó. Nếu không biết, không tuyên bố numeric epoch toàn lịch sử vẫn monotonic; tạo authority history mới trong generation mới và công bố discontinuity. Safety dựa việc generation/credential cũ bị loại, không UUID lớn hơn.
6. Reconcile pending/outbox/ledger records, exact active refs và semantic state. Không dispatch historical commands hoặc replay external alerts. Override đã hết hiệu lực không được revive.
7. Validate readonly Runtime, current source collection, publication, expiry và kill tests liên quan. Chỉ khi checks pass mới chuyển trust routing/config và cấp writer capability.
8. Commit recovery audit, clean old paths theo policy. Đo actual RPO/RTO; không biến dữ liệu đã mất thành success watermark.

Nếu không thể chứng minh old writer credentials/routes đã bị fence hoặc trust config mới có hiệu lực, không resume production writer. Đây là gate kỹ thuật, không cần dựng multi-cloud coordinator để né.

## 5. Retraction khi data đã active sai

Freeze scoped normal promotion nếu cần; operator được quyền publish explicit retraction/degrade. Candidate correction giữ lineage/supersedes. Runtime control validation bắt thấy invalidation trong bounded propagation; positive stamp cũ chỉ sống đến deadline cũ. Purge hỗ trợ nhanh nhưng không bảo đảm client offline.

Previous snapshot fallback chỉ khi còn đủ display policy, age/source attribution thật. Không rollback data bằng overwrite object cũ hoặc giảm revision. Ghi incident và difference verdict legacy/new/source/timing/unknown.

## 6. Sentinel tối thiểu

Check ngoài đường execution được giám sát: Runtime accessible, source ages, last canonical progress, backlog và checkpoint export lag. Có thể HTTP còn 200 nhưng domain không cập nhật -> alert. Sentinel ngoài primary provider nếu muốn phát hiện provider outage. Chọn nơi chạy/kênh gửi theo budget và quyền; chưa triển khai hoặc gửi tin trong thiết kế này.

Failure injection tối thiểu 72 giờ unattended ở isolated shadow environment trước independence claim; đây là gate đề xuất, không kết quả đã chạy. Test bao phủ source expiry, missed ticks, manual expiry và backlog. Interval có thể cần dài hơn để bao phủ model/source cycles.
