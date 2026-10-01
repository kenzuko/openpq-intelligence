# Runtime, freshness và cache

## 1. Hai lớp dữ liệu

Immutable generation/decision là điều đã phát hành với exact refs. Serving view là khả năng sử dụng tại served_at: current authority check, input ages, validity, decision eligibility, current invalidation status và fallback provenance. Serving view không sửa generation cũ và không tái resolve truth.

Runtime deployment riêng; không source credentials, không canonical write capability. Baseline đọc canonical R2 bằng S3 Object Read only, scope canonical bucket. Coordinator read/validate endpoint kiểm tra read principal; các command endpoint yêu cầu credential khác. Binding network access không đồng nghĩa quyền command.

## 2. Read flow

1. Lấy authoritative active receipt/control validation từ Coordinator hoặc sử dụng stamp chưa expired theo policy.
2. Fetch exact immutable generation bằng receipt/hash; không list storage để đoán latest.
3. Kiểm tra contract/hash/dependency refs và evaluate serving eligibility với pinned policy/server time.
4. Trả payload với metadata; không lấy missing field ở generation khác rồi giả đó là một complete generation.
5. Khi control/store lỗi, chỉ dùng verified LKG/checkpoint/cache còn được serve policy cho phép. Authority check UNVERIFIED, giữ source times và deadlines. Nếu thiếu trusted checkpoint -> unavailable.

## 3. Validity và tuổi

Mỗi field có source_time_basis và max_source_age/valid interval. Dataset summary không che field stale. Deadline serve/action dựa vào min của decision validity, required field expiry, override expiry và control validation expiry cho hành động liên quan.

Control validation mới có thể xác nhận snapshot chưa bị thu hồi; không refresh observation time. Khi source dữ liệu già đi, control healthy vẫn không làm source fresh.

Stamp còn phải kiểm tra current active ref/control revision và next scheduled restrictive transition. Validation endpoint không chỉ trả “Coordinator alive”. Snapshot bị retracted hoặc có rule/override effective transition làm nó không còn hợp lệ không được nhận stamp positive mới, dù active bytes chưa được Core thay.

Display fallback có thể tồn tại khi action eligibility hết hạn. UI phải ghi “thông tin gần nhất, chưa xác nhận hiện tại” hoặc câu phù hợp, không giữ nhãn thuận lợi/đang hoạt động như hiện thời. Source failed != world state failed.

## 4. Revocation và cache

Positive high-impact response mặc định không public shared cache; cache nội bộ của validation stamp chỉ sống đến expiry. Có thể vẫn cache immutable data bytes. Bounded propagation window trong policy là giới hạn chấp nhận, không tuyên bố immediate global revocation.

Policy proposed cho prototype: control validation lifetime tối đa 15 giây với positive high-impact, action offline grace bằng 0. Đây là mục tiêu thiết kế cần domain owner chấp nhận, không số đo đã đạt. Runtime phải dừng positive khi hết stamp, dù source data còn valid. Có thể chọn ngắn hơn hoặc no-cache nếu cần; không tăng số này lén để cải thiện latency.

Observation-only endpoints có cache ceiling riêng. Airport flight display đặt ceiling nhằm bảo đảm mục tiêu update không chậm quá 60 giây khi nguồn/cadence đáp ứng. Các số source freshness thật chốt sau baseline đo; API chưa có policy đủ thì action ABSTAIN.

Conditional GET/304 chỉ cho phép client reuse immutable bytes hoặc ETag có phục vụ metadata đúng. Không 304 một serving view cũ mà không cập nhật validity. TTL không reset khi nhận lại 304 nếu control/source stamp cũ. HTTP stale-while-revalidate/stale-if-error không được kéo dài positive action ngoài deadline.

## 5. Client/offline contract

Client nhận served_at, expires_at/action_until, control_validation_expires_at, source times và eligibility. Khách xem thông tin cũ được nếu display policy cho phép, nhưng app không được tự cấp GO từ cached bytes.

Client timeout/clock abnormal/app resume: tính conservative deadline từ server lifetime + monotonic elapsed; không tin local date bị chỉnh để mở lại eligibility. UI đang mở cũng phải refresh/expire nhãn theo timer, không chỉ khi reload. Sau recovery generation đổi, bỏ cache trust generation cũ theo config/API envelope.

Không thể cưỡng chế client độc hại không tuân contract. Partner dùng dữ liệu cho high-impact action phải chấp nhận contract và integration tests; V1 không thực hiện booking/payment nên không hứa transaction action enforcement.

## 6. Endpoint contract đề xuất

| Endpoint logic | Output | Hành vi lỗi |
|---|---|---|
| dataset snapshot | Receipt + generation + serving view | Verified aged LKG hoặc unavailable |
| domain decisions | Fact/recommendation + reason/validity | Abstain khi minimum/validation hết hiệu lực |
| island composition | Exact input set + per-recommendation state | Partial/abstain cho dependencies thiếu |
| provenance details | Refs/versions được phép xem | Không expose raw/secret trái access policy |
| health/progress | Runtime/pipeline/source/data axes | Không đánh đồng 200 với data current |

Actual paths chưa khóa để không ép storage layout thành public API. Semantic versioning cho public contract; backward compatibility cho consumer migration. Internal reader contract cũng versioned, không direct raw file assumption.

## 7. Availability giới hạn

Coordinator down + R2 alive: cold Runtime có thể đọc verified checkpoint nếu đã export, không positive validation mới. R2 down + Coordinator alive: dùng cached verified blob nếu còn trong display policy; ref alone không đủ. Cả hai down + cache cold: unavailable. Runtime down: Core vẫn update; consumers có thể hiển thị own bounded display cache theo contract.


## A001 - Current locator trust

Runtime kiểm tra environment/locator/native identity/key scope/generation/revision cho receipts/stamps, không signature alone. Current tuple duy nhất từ approved bootstrap artifact; historical keys chỉ verify lineage, không tạo current positive. Khi locator migration, drain/disable old Runtime routes hoặc chứng minh hết current-positive capability/stamps trước resume. Wrong environment/locator snapshot không là current LKG fallback; historical display chỉ nếu explicit policy và provenance cho phép, action-ineligible.
