# Hợp đồng dữ liệu V2.1

Đây là semantic contract, chưa phải JSON Schema/code. Luồng implementation chuyển thành schema và fixtures sau inventory. Fields bắt buộc không được điền giá trị bịa nếu nguồn không cung cấp; dùng missing reason và provenance.

## 1. Các identity riêng

| Identity | Ý nghĩa |
|---|---|
| source_id + source_namespace | Nguồn và không gian ID của nguồn |
| entity_id + entity_version | Thực thể canonical và mapping version |
| location_id + location_version | Điểm/geometry và scope bất biến của version |
| evidence_id | Receipt của payload/assertion nguồn, không là state |
| run_id | Một execution attempt |
| collection_job_id | Dataset/source + slot + mode + request intent |
| candidate_id + candidate_digest | Kết quả compute chưa được publish |
| decision_id | Một emitted hoặc replay decision, loại phân biệt |
| recovery_generation + publication_revision | Identity/order của publication đã commit |
| command_id | Idempotency cho operator/control command |

Không dùng cùng một ID cho run, evidence và logical publication. Transport retry của một command giữ command_id; sửa command body phải dùng ID mới. Cùng ID khác digest là conflict, không idempotent success.

## 2. Source registry artifact

source_id, provider, domain, source_type, namespaces, geography/scope, timezone, cadence, expected_latency, unit/interval semantics, payload_mode, auth_class, credential_reference, quality dimensions, upstream_origin/fallback_group, license/access/redistribution/retention policy, max requests/concurrency/retries/payload, timeout, redirect allowlist và artifact version/hash.

Credentials chỉ là reference, không values. Không log Authorization/query token/cookie. Kiểm soát redirect và payload limit tại adapter để tránh lộ secret và unbounded source response.

payload_mode: FULL_SNAPSHOT, DELTA, EVENT_STREAM. FULL_SNAPSHOT chỉ diễn giải “missing” nếu source bảo đảm completeness và phạm vi ngày/tuyến/entity của snapshot. DELTA missing không là xóa. Deletion/cancellation cần tombstone/event hoặc semantics rõ.

## 3. Evidence receipt

evidence_id, source_id, source_type, source_entity_id, request fingerprint đã loại secrets, observed payload hash, payload ref hoặc raw_storage_denied, source_time/source_time_basis, collected_at, received_at, source valid interval nếu có, collector/adapter version, source registry version, HTTP/result metadata đã sanitize, retention class, access scope, provenance refs.

Hash bytes giống nhau có thể có nhiều receipts: receipt mới không làm observed value/time mới. Source explicitly reconfirms unchanged operational fact khác việc cache trả lại payload cũ; adapter phải ghi confirmation semantics nếu hợp đồng nguồn cho phép. HTTP Date không tự là observation time.

## 4. Assertion

assertion_id, evidence_ref, subject/entity/location refs, variable/predicate, value hoặc missing_reason, unit, measurement/aggregation interval, source class, valid_from, valid_to, model_cycle/forecast_horizon nếu có, mapping versions, issued_at/source_time, quality dimensions, anomaly flags, supersedes/retracts nếu có, author/operator reference cho manual.

Observation, forecast, official report và manual confirmation là claim types riêng. Một manual override policy không được đổi source attribution của model.

## 5. Identity/location

Canonical identity mappings giữ source namespace, source ID, aliases, valid interval, mapper version và ambiguity state. Ambiguous match -> unresolved, không nối nhầm flight/tàu chỉ để đầy bảng.

Flight instance không chỉ là flight number: phải có operating/marketing relation, origin/destination, service date/time scope theo source semantics. Ferry trip có operator/route/day/departure và source identity; đổi giờ không được tạo trip giả hoặc bỏ trip cũ không có supersedes.

Location gồm point/geometry, CRS hoặc lat/lon interpretation, scope và version. Gió/sóng dùng cùng tọa độ theo rule đang được kiểm chứng; nếu khác phải ghi explicit spatial relation và decision abstention/tolerance policy. Không silently ghép marine point này với wind point khác.

## 6. Time model

Canonical instants UTC; operational day Asia/Ho_Chi_Minh. Khoảng hiệu lực là half-open [valid_from, valid_to). 00:00 ngày sau không thuộc ngày trước. Naive source timestamps chỉ normalize sau khi biết timezone; ambiguous -> flagged, không tự đoán.

source_time, received_at, collected_at, normalized_at, evaluated_at, published_at, served_at là riêng. Forecast model_cycle không là forecast target time. accumulation_start/end không thay bằng label giờ đơn lẻ.

Future timestamp vượt accepted clock skew bị flag; không tính source_age âm rồi gọi rất fresh. Runtime dùng server clock với skew policy; client lấy server time/remaining lifetime, dùng monotonic elapsed khi có, hết thời hạn conservative nếu clock bất thường hoặc app resume quá lâu.

## 7. Canonical generation envelope

dataset_id, contract/schema version, generation_id, content hash, candidate digest, source/evidence/input refs, semantic slot/order metadata, evaluation time, prior state/history ref nếu rule stateful, source/identity/location/adapter/resolver/rule/config/policy artifact hashes, data access/retention class, generation payload refs, dependency manifest và quality axes.

Prepared generation chưa có committed publication revision. Revision và authority commit thuộc receipt trong Coordinator, tránh sửa immutable blob để thêm số sau commit. Runtime kết hợp generation + receipt, không coi generation có mặt trong R2 là đã published.

Quality axes độc lập:

| Trục | Ví dụ |
|---|---|
| completeness | COMPLETE / PARTIAL / INSUFFICIENT |
| resolution | RESOLVED / CONFLICTING / UNCERTAIN / INSUFFICIENT_EVIDENCE |
| pipeline_at_generation | HEALTHY / DEGRADED |
| freshness_at_serve | FRESH / AGING / STALE / EXPIRED / UNKNOWN |
| current_authority_check | VERIFIED / UNVERIFIED |
| decision_eligibility | ELIGIBLE / ABSTAIN / EXPIRED / REVOKED / UNVERIFIED |

Một field có thể resolved nhưng stale; một dataset có thể fresh nhưng conflicting. Không gom vào single READY enum. Data values/source times là phần immutable; freshness_at_serve là serving view không sửa lịch sử.

## 8. Publication receipt và control validation

Receipt: dataset, recovery_generation, revision, generation ref/hash, previous receipt ref, owner/epoch, control revision, committed_at, command/candidate digest, operation kind, supersedes/retracts, audit ref, activation hashes. Coordinator là nơi xác nhận commit.

Validation stamp: dataset, generation/revision, current control revision, validated_at, validation_expires_at, policy hash và revoked/frozen indicators. Runtime không được cấp stamp nếu control không xác nhận; reusing stamp không thay validated_at.

## 9. Decisions

decision_id, decision_type, kind FACT/RECOMMENDATION, scope, emitted/replay kind, generated_at/evaluation_time, valid_from/to, action_until, evidence quality, reason_codes, minimum-evidence verdict, input refs, dependency refs, rule/config/mapping/policy hashes, prior state/history/checkpoint reference khi cần.

Decision types có domain namespace. marine.recommendation.CANCEL không tự là ferry.operational.CANCELLED. Reason codes dùng cho UI explanation; code không là bằng chứng mới.

## 10. Retention/replay capability

Mỗi output có retention/access policy. Replay capability: FULL_INPUTS_AVAILABLE, DERIVED_ONLY, PARTIAL_INPUTS, NOT_REPRODUCIBLE. Evidence tombstone giữ reason/time/hash nếu được phép. Không xóa đầu vào đang cần cho active contract trước khi tạo bản thay thế/degrade hợp lệ; quy định pháp lý bắt buộc xóa vẫn ưu tiên, khi đó data/decision eligibility bị invalidated.

Normalized/derived storage không tự có quyền giữ lâu hơn raw. Public schema chỉ expose fields được redistribution; private partner/tenant facts tách scope và credentials.


## A001 - Locator fields

Control state, publication receipt, validation stamp, command/capability và trust config thêm environment_id, authority_instance_id, authority_locator_version, locator_artifact_hash và expected native instance identity. Authority identity/locator khác recovery_generation và epoch: đổi generation không tự chọn namespace mới; đổi namespace cần migration mapping riêng. Signing key authorization gắn tuple, không chỉ dataset_id. Exact self/native identity do adapter runtime/deployment xác minh. Fields/refactors schema có version mới và compatibility gate; không giả là schema V2 đã triển khai.
