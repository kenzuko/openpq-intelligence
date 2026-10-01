# Giao thức authority và publication

## 1. Điểm linearization duy nhất

Mỗi dataset có một Coordinator state. Active reference, authority, control revision, idempotency result, audit và export-outbox entry được thay đổi cùng một transaction local. R2 không là nơi bầu authority. Không distributed transaction DO-R2, không hai active manifests cùng quyền.

State tối thiểu:

dataset_id; accepted recovery_generation; owner; authority_epoch; publication_revision; control_revision; active_receipt; previous_receipt refs; freeze/activation/override metadata; prepared records/pins; command/candidate deduplication; export outbox.

## 2. Identity/capability

Caller authenticated theo service/operator identity. Token/capability ràng dataset, mode, owner, epoch và recovery generation. Runtime có quyền read/validate, không command credential. SHADOW/BACKFILL/REPLAY không thể đổi mode thành LIVE bằng đổi JSON. Legacy writer không có canonical bucket credential và không có quyền bypass Coordinator.

Không cấp publisher signing/admin secrets cho collectors. Domain credentials chỉ đọc/ghi evidence-candidate storage được phép; publisher alone ghi canonical. Nếu lựa chọn R2 binding không hạn chế prefix, dùng bucket/capability phù hợp thay vì hứa prefix ACL không tồn tại.

## 3. PREPARE

1. Executor nhận control snapshot/artifact versions, chạy compute và gửi candidate refs + digest.
2. Publisher xác minh caller/mode, allowed schema, source/evidence dependencies, completeness theo policy, scope/order và size limits. Kiểm tra anomalies không đồng nghĩa từ chối mọi extreme.
3. Publisher đọc candidate bytes, xác minh hashes và ghi complete immutable generation vào canonical namespace bằng create-if-absent. Không cho executor ghi trực tiếp canonical.
4. Verifying read/checksum và full dependency manifest hoàn tất trước đăng ký PREPARED. Record có prepare deadline, candidate digest và pin để GC không xóa trong commit window. Nếu crash trước PREPARED, chỉ là orphan theo grace policy.
5. Không trả trạng thái committed ở bước này.

External I/O có thể interleave. Mọi checks có thể thay đổi sau I/O phải được kiểm tra lại ở COMMIT. Không giữ SQL cursor qua await. Transaction không chứa upload/fetch.

“Complete generation” nghĩa là envelope, manifest và các references bắt buộc hoàn chỉnh về kỹ thuật. Payload có coverage PARTIAL vẫn được phát hành nếu domain policy cho phép và ghi missingness rõ. Không từ chối mọi partial coverage rồi giữ LKG trông như đầy đủ. Không trộn hai nghĩa completeness này.

## 4. COMMIT

Request chứa command_id, candidate digest, expected active revision, expected control revision, owner, epoch, recovery_generation, prepared ref và operation kind.

Trong transaction đồng bộ:

- Nếu command_id đã commit cùng digest -> trả đúng receipt cũ. Digest khác -> reject conflict.
- Kiểm tra accepted generation và authenticated capability; caller LIVE có quyền dataset này.
- Owner/epoch/control_revision/expected_active_revision phải khớp current state.
- Prepared record còn tồn tại, chưa expired, đúng digest/hash; artifacts được phép và field-level candidate prerequisites đã verified.
- Freeze/publication restrictions không cho phép normal promotion. Retraction/degrade bởi operator được phép riêng theo command policy, không implicit bypass.
- Slot/order acceptable cho operation; normal obsolete candidate reject. Correction/retraction dùng explicit supersedes/reason/permission.
- Decision/evidence validity vẫn phù hợp commit time; positive candidate đã hết action validity không được active như eligible.
- Với stateful output, prior state reference phải khớp state/revision yêu cầu, không bỏ qua một transition mới.
- Cấp revision +1, tạo receipt, thay active ref, audit và outbox; resolve pin state thành retained committed ref.

Response chỉ sau durable commit confirmation; không cấu hình allowUnconfirmed cho đường này. Expected revision mismatch -> RECOMPUTE_REQUIRED hoặc revalidate/rebase theo pure deterministic contract; không đổi expected revision rồi gửi lại candidate stale một cách mù.

Domain admissibility về slot/order dùng pure typed policy interface được version hóa; Coordinator không có chuỗi if domain toàn cục. Checks đồng bộ trong transaction chỉ dùng metadata/policy đã nạp được kiểm chứng, không fetch hoặc chạy heavy domain compute.

## 5. Command thay đổi authority/control

Authority transfer/revoke/freeze/rule activation/override changes dùng command_id và expected control revision; kiểm tra quyền, scope, effective time và audit trong cùng transaction. Authority transfer epoch +1, không tự thay active payload. Control revision tăng; candidates computed từ revision cũ bị reject. Các dataset sử dụng chung artifact kích hoạt theo từng dataset; không cần global multi-DO transaction.

Override có expiry; Runtime không coi expired override-based positive còn eligible. Việc expired không tự thay truth payload; Core recompute sau đó. Gate cuối kiểm tra effective interval và control changes theo nguồn thời gian server.

Future-effective restrictive commands phải có next_transition_at. Candidate positive và validation stamp không sống quá transition liên quan, dù Core không chạy lại đúng giờ. Đến transition, old output action-ineligible cho đến recompute đủ evidence. Không cần timer chạy đúng mili giây để bảo vệ expiry.

## 6. EXPORT và LKG checkpoint

Sau commit, outbox retry ghi immutable receipt và projection LKG vào R2. Receipt export phải được publisher attested theo signing/key policy hoặc một cơ chế integrity equivalently verified; read-only Runtime xác minh receipt identity/hash, không chỉ tin filename. Chọn ký receipt ở baseline để checkpoint đọc khi control down có provenance kiểm chứng được. Key IDs/version và public verification keys nằm trong deployed trust config; signing secret chỉ publisher.

Projection là cache của committed receipt, không quyền promotion. Conditional write theo object ETag; chỉ replace cùng recovery generation khi receipt revision lớn hơn. Failed CAS -> reread/retry có budget. Generation mới dùng namespace projection mới; Runtime chỉ đọc generation trong trust config hiện hành. Không so UUID để chọn latest.

Nếu export trễ, Runtime bình thường đọc Coordinator active ref rồi lấy blob. Nếu Coordinator down, dùng checkpoint đã verified, ghi authority UNVERIFIED và tuổi thật. Checkpoint không cấp control validation mới hoặc positive eligibility mới. Có thể không có LKG trên cold start nếu commit mới chưa export; chấp nhận unavailable, không list rồi lấy candidate mới nhất.

## 7. Failure table

| Crash/lỗi | Kết quả đúng |
|---|---|
| Upload chưa hoàn tất | Không PREPARED/COMMITTED |
| Blob complete, chưa prepared | Orphan; active cũ |
| Prepared, chưa commit | Pin có deadline; active cũ |
| Transaction abort | Không tăng revision; không receipt/outbox một phần |
| Commit xong, response mất | Retry cùng command/digest trả receipt đã có |
| Commit xong, export mất | Active mới tại Coordinator; outbox retry; LKG projection có thể lag |
| Freeze/epoch đổi trong upload | Final commit rejects stale control/capability |
| Runtime đọc ref nhưng blob unavailable | Retry bounded; fallback verified previous nếu policy cho phép; không partial generation |
| Candidate hash sai/missing ref | Reject/quarantine và incident; không activate |

## 8. Correction, retraction và garbage collection

Correction tạo generation/receipt mới và supersedes; bản emitted cũ vẫn là lịch sử. Retraction tạo receipt/tombstone trạng thái invalidated, action-ineligible; có thể chỉ định fallback ref với freshness thật. Không xóa bản sai rồi giả như chưa từng phát hành.

GC không được dùng lifecycle rule mù cho active canonical namespace. Dựa vào active/retained refs, prepared pins, historical retention và grace > prepare/retry window. Publisher/GC protocol phải chứng minh không xóa blob giữa prepared verify và commit. Purging lawful evidence không đảm bảo replay; invalidation/degrade cần được áp dụng theo policy.

Idempotency retention phải bao phủ supported redelivery/retry window. Command/job có deadline; message cũ vượt cửa sổ không được biến thành new live intent sau khi dedup entry bị GC. Business-event dedup cho alerts tồn tại qua epoch/cutover theo policy; recovery reconciliation không phát lại events trước checkpoint như mới.

## 9. Giới hạn bảo đảm

Fencing bảo vệ authorized writers tuân protocol và không có bypass credentials. Publisher admin compromise vẫn là nguy cơ rộng hơn; cần least privilege, deployment access và audit. Không hứa chịu được mọi privileged attacker chỉ bằng epoch. R2 content-addressed objects là application immutability, không tự là WORM backup.


## A001 - Locator admission

PREPARE/COMMIT/read-validation xác minh authority locator/environment với bootstrap trust artifact và self identity trước owner/epoch/control checks. Final transaction so locator/state/capability version; client không tự bootstrap authority instance khác. Receipt/export paths và signing key scope mang cùng authority tuple. Alternate/old namespace không được dùng fallback nếu resolver lỗi. Lookup ID deterministic theo stable dataset ID trong registered namespace; pin expected native ID, không chỉ name. Locator transfer dùng runbook A001, fence old routes/trust, một current tuple, audit và T59 proof.
