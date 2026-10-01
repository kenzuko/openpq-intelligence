# Operator, security và activation

## 1. JoTrip Ops giữ read-only

Ops hiện là dashboard lấy dữ liệu vận hành. Không thêm lệnh freeze, override, rule activation, authority transfer hoặc source credential vào Ops. Operator API/Console là private surface riêng. Sau Intelligence ổn, chủ hệ thống có thể yêu cầu kết nối/thay đổi Ops bằng scope mới.

Console có auth, role/scope policy, explicit command API và append audit. Không public anonymous control endpoints. Nếu cookie auth dùng cho mutation, cần CSRF/origin protections; chọn mechanism khi implementation, không tự reuse CMS session/credentials.

## 2. Quyền theo hành động

| Role logic | Quyền điển hình | Giới hạn |
|---|---|---|
| Reader/Ops | State, health, lineage được phép | Không commands/secrets |
| Domain confirmer | Nhập observation/confirmation ngày/phạm vi được giao | Không đổi rules/authority hoặc override official closure |
| Domain supervisor | Scoped correction/override/freeze | Giảm bảo vệ theo strong policy, không global quyền mặc định |
| Platform operator | Authority/cutover/recovery theo gate | Không tự đổi domain safety thresholds |
| Deployment administrator | Deploy/configure integrations được duyệt | Quyền hạ tầng rộng là residual risk cần audit |

Roles là semantic proposal, không đồng nghĩa phải có năm người. Một người có thể nhiều role; vẫn ghi actor/action/scope. Credentials service và human riêng.

## 3. Command contract

command_id, authenticated actor/service, action, dataset/entity/location/day scope, expected control revision, effective_from, expires_at hoặc review_due_at theo type, reason, proposed change, payload digest và approval/review reference nếu policy yêu cầu.

Preview hiển thị actual local day/time, scope và tác động cụ thể. Confirm command vẫn kiểm tra quyền/concurrency; preview không là reservation. Hai người sửa cùng revision: một thành công, người còn lại nhận conflict và phải xem state mới.

Authority/override/rule command phải audit actor, before/after, effect interval, reason, control revision và commit time. Audit không chứa raw secrets hoặc PII không cần thiết. Audit export có retention policy và backup.

## 4. High-impact giảm bảo vệ

Positive override không vượt official closure. Nếu policy cho supervisor thay một automated restriction, cần quyền rõ, lý do, thời hạn ngắn và evidence; decision vẫn giữ manual override attribution. Tùy đội ngũ có second review hoặc elevated role, phải chốt trước bật feature. Khi policy chưa được duyệt, command giảm bảo vệ disabled. Không áp two-person approval cho việc xác nhận cano hoạt động thông thường.

Break-glass scoped, owner, expiry/reconfirm deadline và incident reference. Freeze expiration không mặc định tự promote candidate cũ; unfreeze chỉ cho current-valid candidate sau recompute. Rule disabled phải có fail-safe output/abstention, không “rule missing means GO”.

## 5. Rule/source activation

Artifacts: DRAFT -> SHADOW -> APPROVED -> ACTIVE -> RETIRED. Artifact bytes/hash/version immutable. Approval ghi parity/fixture results; activation tại Coordinator từng dataset có expected control revision. Có explicit compatibility matrix code/schema/rule. Code rollback không tự kích hoạt artifact cũ.

Source registry thay endpoint/scope/license/cadence là controlled change; source name không được giữ attribution nếu upstream thực tế đổi. Identity/location mapping đổi phải có version và validity. Không unrestricted CMS cho registries.

## 6. Capability isolation

- Runtime: canonical read-only, control validate/read; không source secrets và command credential.
- Executor: source credentials cần thiết, evidence/candidate quyền domain/mode; không canonical writes.
- Publisher/Coordinator: canonical write, stage reads, receipt signing, control transactions; không cần mọi source credentials.
- Operator API: delegated command credential/identity có scope; không raw R2 admin token ở frontend.
- Backup/GC: quyền riêng và retention controls; không dùng Runtime token để ghi.

Read-only phải được chứng minh bằng denied PUT/DELETE/command tests, không bằng TypeScript interface chỉ có get(). Temporary tokens/buckets có scope thật; không giả có prefix protection nếu adapter không hỗ trợ.

## 7. Partner/AI/data rights

Partner/tenant scope trong contract; public Runtime không expose giá/inventory riêng hoặc raw feed trái redistribution policy. AI tool đọc permitted decisions, không tự mutate rule/override. Thêm action plane sau này cần scope/authorization/idempotency riêng, không mượn quyền “read intelligence”.

## 8. Security residual risk

Privileged account takeover có thể xóa stores hoặc deploy publisher độc hại; epoch không giải quyết trường hợp này. Mục tiêu V1: least privilege, secrets isolation, protected deployments, audit, offsite portable restore artifacts và restore drill. Không mở thêm monitoring/backup SaaS hoặc cấp quyền ngoài phạm vi chỉ để đủ checklist.


## A001 - Environment, locator và revocation

Capabilities/signing keys có environment+authority locator scope; test principal không sở hữu production command/storage capability. Deployment preflight ghi actual resource mapping. Recovery deny probes sau revoke là gate có evidence, không suy ra đã deny từ API revoke 200. Probes chỉ disposable/side-effect-free approved path theo A001; không thử phá payload thật.
