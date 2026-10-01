# OpenPQ Intelligence - Phản biện kiến trúc cuối vòng 1

Ngày: 01/10/2026. Phạm vi: review gói Architecture Lock, không thực thi hệ thống.

Đã đọc bản tổng hợp và xác nhận chứa nguyên nội dung của cả 11 Markdown riêng. Đây là đánh giá thiết kế trên tài liệu được cung cấp, chưa phải kiểm chứng mã nguồn, quyền ghi, tải thực tế hoặc hạ tầng đang chạy. Các tình huống bên dưới là rủi ro suy ra từ phần hợp đồng còn thiếu, không phải sự cố đã xác nhận.

## A. Architecture verdict

**READY WITH REQUIRED CHANGES**

Hướng tổng thể phù hợp: một thẩm quyền phát hành cho mỗi dataset, nhiều nguồn bằng chứng, domain độc lập, Core tách Runtime, giữ kiến thức đã kiểm chứng. Chưa đủ điều kiện gọi là bản khóa để triển khai production. Tài liệu đã nêu nhiều invariant đúng nhưng chưa mô tả các giao thức bảo đảm chúng khi có ghi đồng thời, downtime, sửa dữ liệu và khôi phục.

Không cần đổi triết lý hoặc viết lại Weather/Airport/Transit. Cần bổ sung các hợp đồng B1-B9 rồi phản biện lại. Có thể tiếp tục thiết kế các hợp đồng này ngay; không suy ra rằng review này cho phép code, deploy hoặc cutover.

## B. Required corrections - các điểm chặn

### B1. Epoch phải được kiểm tra nguyên tử ở thời điểm promotion

Tham chiếu: 01 §8-9, 02 invariant 16-24, 04 §15.

Epoch tăng không tự chặn zombie writer. Writer cũ có thể đọc epoch 12, bị treo, rồi ghi manifest sau khi writer mới đã nhận epoch 13. Nếu cả hai có quyền ghi trực tiếp active object, việc kiểm tra trước khi ghi chưa đủ.

**Bổ sung bắt buộc:** một giao thức commit cho từng dataset kiểm tra đồng thời owner, epoch, expected active revision và candidate admissibility tại thời điểm chuyển active reference. Thay authority và promotion phải được tuần tự hóa theo dataset. Executor được ghi candidate bất biến; chỉ đường promotion được phép thay active reference. Legacy writer cũng phải đi qua hàng rào này hoặc bị thu hồi quyền ghi vào đường canonical mới.

Khi Control Store không xác nhận được authority, dừng promotion. Runtime vẫn được đọc snapshot đã commit, với freshness hiện tại. Không dùng authority cache để tự cấp lại quyền ghi. Đây là điểm giảm availability có chủ đích để giữ correctness.

Nếu blob và control metadata nằm ở hai store: ghi blob hoàn chỉnh trước, xác nhận checksum/references, sau đó commit con trỏ trong cơ chế được tuần tự hóa. Crash trước commit chỉ tạo candidate mồ côi. Không duy trì hai manifest đều được coi là authority; bản sao object chỉ là bản chiếu có revision kiểm chứng được.

**Ca phải chứng minh:** writer epoch cũ bị treo rồi quay lại; hai writer cùng epoch tranh promotion; authority đổi trong lúc upload; commit response mất rồi client retry.

### B2. Logical slot, revision và sửa sai phải là ba khái niệm riêng

Tham chiếu: 02 invariant 12, 18, 46; 04 §3; 05 §6.

“Không lùi logical slot” chưa nói cách sửa snapshot sai ngay trong cùng slot, nhận sự kiện đến muộn, hoặc bỏ dữ liệu mới nhưng hỏng. Job identity hiện thiếu cách phân biệt lần chạy lại do correction/rule change với duplicate delivery.

**Bổ sung bắt buộc:** mỗi dataset định nghĩa slot/ordering theo nghiệp vụ. Publication revision tăng đơn điệu, tách khỏi thời gian nguồn và model cycle. Có correction/retraction supersedes reference và reason. Cùng slot được có revision mới; rerun có identity riêng khi chủ đích thay đổi input/rule/config. Side-effect deduplication dùng identity nghiệp vụ, không chỉ job ID có epoch.

Không quy định “timestamp lớn nhất luôn thắng”. Weather forecast phải giữ cycle và horizon; Airport/Transit phải xử lý revision theo entity/trip và ngày vận hành, không để một record mới che mọi record cũ.

Rollback authority tạo epoch mới. Sửa active data sai tạo publication mới đánh dấu bản trước bị rút hoặc thay thế. Nếu chỉ còn snapshot cũ, nó phải được công bố như fallback với tuổi thật, không được giả thành current fresh. Nếu không còn bản dùng được, phát hành trạng thái unavailable.

**Ca phải chứng minh:** dữ liệu sai hợp schema đã active; bản sửa cùng slot; sự kiện đến muộn; duplicate sau authority rollback; corrected event không gửi thông báo cũ lần nữa.

### B3. Freshness và expiry phải tiếp tục chạy khi Core dừng

Tham chiếu: 03 §4, §8, §15; 04 §13.

LKG có thể vẫn mang nhãn READY hoặc GO từ lúc phát hành. Manual cano hết ngày hoặc closure hết hạn vẫn có thể nằm trong cache. Chỉ hiển thị timestamp không ngăn consumer sử dụng quyết định hết hiệu lực.

**Bổ sung bắt buộc:** từng loại output có source age policy, validity, serve-until và action-until. Runtime đánh giá khả năng sử dụng theo thời gian phục vụ bằng policy version đã gắn với snapshot. Đó là đánh giá hiệu lực, không tái chạy truth resolver. Consumer phải kiểm tra expiry kể cả khi offline; response/cache có giới hạn tuổi phù hợp với hạn ngắn nhất của dữ liệu dùng cho hành động.

Tách tối thiểu các trục: completeness, freshness, resolution và decision eligibility. READY/PARTIAL, STALE và CONFLICTING không thể là một enum độc quyền vì có thể cùng xuất hiện. Mỗi field/source có tuổi riêng; dataset không tự fresh vì một nguồn vừa cập nhật.

Xác nhận cano 01/10 chỉ có giá trị trong phạm vi đã xác nhận của ngày 01/10 theo Asia/Ho_Chi_Minh. Hết hiệu lực chuyển unknown/unconfirmed, không suy ra hoạt động bình thường hoặc ngừng hoạt động. Tin bảo trì không có ngày mở lại cần chính sách reconfirmation rõ; “hết TTL” cũng không tự có nghĩa mở cửa lại.

**Ca phải chứng minh:** Core chết qua nửa đêm; cache tồn tại qua expiry; clock skew; client offline; nguồn trả lại dữ liệu cũ dưới HTTP 200.

### B4. Hysteresis cần trạng thái quá khứ trong hợp đồng deterministic

Tham chiếu: 02 invariant 30, 03 §11-13.

Công thức input + rule + config + time bỏ sót previous decision và transition history, trong khi exit HOLD cần thời gian T dưới ngưỡng. Hai lần chạy cùng input hiện tại có thể khác output do trạng thái trước khác nhau.

**Bổ sung bắt buộc:** decision input refs bao gồm prior state hoặc một cửa sổ lịch sử đầy đủ, state-machine version và ordering policy. Replay khởi tạo từ checkpoint có lineage hoặc tái dựng lịch sử đủ dài. Xác định xử lý late/out-of-order evidence; replay không sửa quyết định đã phát hành và không tạo side effect.

**Ca phải chứng minh:** restart giữa T; replay qua bước HOLD; evidence đến đảo thứ tự; missing interval không được tính thành một khoảng thời gian an toàn.

### B5. Island State cần hợp đồng đồng bộ và quyền hành động

Tham chiếu: 01 §2, §5-6; 03 §14-15.

Ghi exact input refs là cần thiết nhưng chưa đủ: Weather mới, Marine cũ và Transit của ngày khác vẫn có thể tạo ra một composition hoàn chỉnh về cấu trúc. GO hoặc CANCEL cũng chưa nói là lời khuyên hay trạng thái vận hành được xác nhận.

**Bổ sung bắt buộc:** composition xác định evaluation time, phạm vi giao nhau, độ lệch thời gian cho phép, dependencies bắt buộc/tùy chọn và nguyên tắc abstain từng quyết định. Field bắt buộc stale không được bù bằng field khác fresh.

Tách operational fact khỏi recommendation: “hãng xác nhận hủy chuyến” khác “khuyến nghị tránh đi do sóng”. Weather có thể chặn gợi ý cano theo policy, không tự sửa sự thật ferry thành cancelled. Manual positive confirmation không được vượt official closure hoặc safety restriction chỉ vì ghi mới hơn.

Bảo tồn assertion xung đột và resolution reasons. Không lấy trung bình hai nguồn khác variable, location, horizon hoặc các model có quan hệ phụ thuộc rồi gọi đó là đồng thuận. Thêm metadata về nguồn gốc chung khi nguồn B chỉ phân phối lại nguồn A.

**Ca phải chứng minh:** manual cano mở nhưng official closure active; Airport mới + Transit hôm qua; Marine thiếu gust; nhiều feed cùng copy một nguồn; dữ liệu một vùng được hỏi cho vùng khác.

### B6. Expiry không thay thế quyền hạn và kiểm soát operator

Tham chiếu: 02 invariant 33-37, 04 §11-12, 06 §E-F.

Override có lý do và expiry vẫn có thể được tạo bởi người sai quyền, scope quá rộng, hoặc ghi đè một thay đổi mới hơn. Quên freeze/disable rule cũng có thể làm hệ thống treo nhiều ngày.

**Bổ sung bắt buộc:** ma trận quyền theo domain/action/scope; optimistic concurrency cho sửa/revoke; preview hiển thị phạm vi, thời hạn, reason và ảnh hưởng trước khi commit. Audit append-only chứa actor, before/after và version. Changes rule/source/override có activation reference rõ.

Hành động làm giảm mức bảo vệ cần cơ chế chặt hơn thao tác nhập quan sát thông thường, chẳng hạn người có quyền cao hơn hoặc phê duyệt bổ sung theo quy mô đội ngũ. Không bắt hai người duyệt mọi xác nhận cano hàng ngày. Break-glass có owner, thời hạn hoặc kỳ reconfirmation và cảnh báo khi còn treo.

**Ca phải chứng minh:** operator chọn nhầm ngày; hai người sửa đồng thời; quyền bị thu hồi; rule đã retired được code rollback nạp lại; freeze bị quên.

### B7. Migration phải tách consumer cutover khỏi producer independence

Tham chiếu: 05 sequence F-H và kill tests; 10 entry criteria.

Authority transfer trước producer re-home không nhất thiết sai: bridge có thể phát hành dữ liệu nhận từ legacy. Nhưng khi đó collector vẫn phụ thuộc legacy và chưa thể tuyên bố độc lập. Các mốc hiện dễ bị hiểu thành hoàn tất migration sau khi đã chuyển consumer.

**Bổ sung bắt buộc:** ghi rõ ba mốc: mirror/bridge, canonical + consumer transfer, production producer independence. Không đánh dấu dataset migrated hoàn toàn hoặc retirement-ready cho đến khi kill test chứng minh dữ liệu tiếp tục cập nhật qua nhiều cadence/cycle liên quan mà không dựa vào output cache hay legacy scheduler.

Trước authority transfer phải kiểm chứng fencing của mọi đường ghi cũ và compatibility của reader, rule, schema. Shadow không nhất thiết gọi nguồn hai lần; ưu tiên cùng evidence được phép chia sẻ, rồi chạy candidate pipeline riêng để tránh tăng quota và so sánh hai thời điểm khác nhau.

Định nghĩa parity gates từng dataset: fixtures bắt buộc, tolerances, freshness/latency/completeness mục tiêu, thời gian shadow bao phủ chu kỳ liên quan, ai chấp nhận expected differences và cách dừng khi difference unknown. Số liệu/SLO cần đo thực tế, không tự ấn định trong review này.

Rollback phải giữ schema reader tương thích, adapter và đường cập nhật nguồn còn hoạt động hoặc khôi phục được trong thời gian mục tiêu. Re-home xong nhưng đã bỏ credentials/legacy deploy artifact thì “rollback per dataset” chỉ còn là lời hứa.

**Ca phải chứng minh:** consumer chuyển rồi producer legacy chết; rollback code đọc schema mới; rollback một dataset trong composition; cron cũ tự chạy lại; nguồn thay đổi giữa hai lượt shadow.

### B8. Phục hồi dữ liệu và phát hiện sự cố tối thiểu không nên để “eventually”

Tham chiếu: 04 §9, §13-14; 06 §H-I.

Một Control Store và canonical store vẫn là điểm tập trung rủi ro, dù Core/Runtime là hai process. Đây có thể là tradeoff V1 hợp lý; tách process không đồng nghĩa sống sót qua lỗi store, account hoặc provider.

**Bổ sung bắt buộc trước production:** failure matrix cho từng dependency; mục tiêu RPO/RTO được chấp nhận; backup tối thiểu của rules/config/control và canonical cần phục hồi; restore drill. Active multi-cloud có thể tiếp tục hoãn. Nếu provider-wide outage được chấp nhận trong V1, ghi rõ mức gián đoạn và cách phục hồi được cam kết, không mô tả như hệ thống vẫn online.

Restore control từ backup có thể làm epoch lùi và cho zombie writer có quyền lại. Recovery phải cách ly writer, thu hồi credentials cũ hoặc tạo recovery generation mới kiểm chứng được, rồi mới cấp authority. Không đơn giản khôi phục epoch cũ và bật cron.

Cần sentinel tối thiểu ngoài đường Core/Runtime được giám sát để phát hiện thiếu progress và gửi cảnh báo qua kênh đã chọn. Không cần một platform monitoring lớn. Hệ thống “không cần trông vài ngày” phải có diễn tập outage và không tăng backlog/retry vô hạn.

**Ca phải chứng minh:** mất Control Store; mất blob store; restore backup cũ; provider outage; credential hết hạn; dead-letter/backlog vượt giới hạn.

### B9. Lineage phải phù hợp quyền lưu và vòng đời dữ liệu

Tham chiếu: 02 invariant 11-15; 03 §1; 04 §14.

Raw evidence immutable không có nghĩa được giữ vô hạn. Source Registry đã có raw_storage_allowed/retention nhưng chưa mô tả hành vi khi không được lưu payload, khi hết hạn hoặc khi input đã bị xóa. Đây là lỗ hổng hợp đồng, chưa phải kết luận pháp lý về bất kỳ nguồn nào.

**Bổ sung bắt buộc:** inventory quyền sử dụng cho từng nguồn thật trước onboarding; phân loại raw/normalized/derived/public; thời hạn và quy trình xóa; không lưu tokens/credentials trong evidence. Immutability là không sửa nội dung một evidence còn tồn tại, không cấm xóa theo policy. Nếu chỉ được giữ hash/metadata/derived output, ghi replay capability tương ứng; hash không tái tạo được input.

Thêm contract/schema/adapter/resolver/location/identity versions vào lineage cần cho reproducibility. Lưu artifacts rules/config tương ứng trong khoảng retention đã cam kết. Snapshot cũ phải ghi rõ “không còn tái dựng đầy đủ” khi evidence đã hết hạn. AI/partner không tự được quyền xem raw chỉ vì Core đã ingest.

**Ca phải chứng minh:** source cấm raw retention; evidence hết hạn; identity/location mapping đổi; partner bị giới hạn quyền; corrupted blob hoặc thiếu reference.

## C. Optional improvements

- Đo source latency, semantic error rate và khả năng thay thế từ lịch sử trước khi hiệu chỉnh quality_class.
- AI explanation nên trỏ về decision ID, lý do và validity; bản dịch không được đổi operational meaning. Không cần AI service trong V1 để pipeline chạy đúng.
- Theo dõi chi phí theo nguồn/domain và đặt budget cảnh báo, trước khi tách thêm executor.
- Dùng adaptive polling khi đã có số liệu, miễn không phá cadence và quota hợp đồng.
- Đánh giá cold offsite export sau khi chốt RPO/RTO và quyền lưu nguồn.

## D. Simplification opportunities

- Giữ Source/Rule/Schema registries dưới dạng artifacts được version hóa và kích hoạt có kiểm soát nếu chưa cần giao diện chỉnh thường xuyên. Không tạo CMS registry mới.
- Một Runtime có module độc lập theo domain là đủ ban đầu nếu tải và quyền truy cập cho phép. Không thêm gateway/internal read service chỉ vì sơ đồ đẹp.
- Không bắt một queue/workflow riêng cho mỗi tầng evidence/assertion/normalization. Đây có thể là các bước của một executor có checkpoints phù hợp.
- Một orchestration authority là một policy thống nhất, không bắt buộc một scheduler process đơn lẻ cho toàn đảo. Triggers có thể độc lập theo domain, dùng chung contract/deduplication.
- Chưa cần hệ thống identity tổng quát cho mọi thực thể tương lai. Bắt đầu entity types thực sự dùng, nhưng giữ namespace và versioned mapping.
- Không lưu mọi thành phần Control Store cùng cơ chế transaction mạnh. Authority/promotion cần mạnh; telemetry và một số incident metadata có thể dùng cơ chế đơn giản hơn.
- Cân nhắc domain ít nguồn làm pilot trước Weather nếu inventory cho thấy rủi ro thấp hơn. Không mặc định cano dễ: manual validity qua ngày cũng cần kiểm chứng.

## E. Final component boundaries - trách nhiệm, chưa chọn deployment topology

| Thành phần logic | Sở hữu | Giới hạn |
|---|---|---|
| Registry artifacts | Source contracts, schema, rule/config, identity/location versions | Không suy luận tình trạng vận hành |
| Domain executors | Thu thập, normalize, quality checks, assertion, resolve/decide theo domain | Không tự thay active reference |
| Evidence/history store | Bằng chứng và phiên bản theo retention/access policy | Không giữ raw trái quyền nguồn |
| Authority + promotion control | Epoch, serialized commit, revision, audit, freeze | Không trở thành domain resolver |
| Canonical store | Immutable complete generations và references/checksums | Storage layout không thành API |
| Decision composition | Ghép input hợp phạm vi/thời gian, giữ lineage, abstain | Không đổi operational fact từ recommendation |
| Runtime | Đọc bản commit, contract/access, expiry/LKG policy, provenance | Không collect hoặc tái dựng truth riêng |
| Operator controls | Xác nhận/override/rule activation có quyền và audit | Không ghi bypass promotion |
| Monitoring/recovery | Progress checks, alerting, backup/restore runbooks | Không tự sửa world state để “healthy” |
| Consumers | Hiển thị và sử dụng quyết định trong validity/access scope | Không duy trì hidden shared collectors |

Các hàng trên là trách nhiệm logic; không yêu cầu mười service hoặc mười repo.

## F. Unresolved technology decisions

| Quyết định | Bằng chứng cần trước khi chọn |
|---|---|
| Control Store và active reference | Chứng minh serialized authority/promotion, race handling, crash recovery và restore fencing |
| Object/evidence store | Kiểm tra complete generation, integrity, retention, quyền truy cập và export cần thiết |
| Worker/Queue/Workflow | Duration/dependencies/quota/retry thật của producer; at-least-once và backlog policy |
| Runtime cache | Expiry đúng cả khi Core/store down; không tái gắn nhãn fresh |
| Registries | Tần suất thay đổi và ai quản trị; mặc định artifact đơn giản trước database động |
| Sentinel và DR | Mục tiêu RPO/RTO, kênh cảnh báo, phạm vi provider outage chấp nhận |

Gói hiện chưa khóa công nghệ quá sớm. Không nên chọn D1, Durable Object hay hybrid chỉ từ tên sản phẩm. Chọn sau khi kiểm chứng primitive đáp ứng B1/B8 bằng tài liệu nhà cung cấp và thử nghiệm có kiểm soát ở vòng thiết kế implementation.

Portability nên tập trung vào contracts, portable evidence/decision export, pure domain kernels và interfaces cho authority/storage/execution. Không cần viết một bản mô phỏng mọi primitive Cloudflare. Chuyển provider vẫn cần kiểm chứng lại atomicity và delivery semantics.

## Kiểm thử khả năng mở rộng 2-5 năm

| Domain tương lai | Contract cần có để không phá kiến trúc |
|---|---|
| Traffic/crowds | Geometry/coverage và sampling time; thiếu cảm biến không thành vắng người |
| Hotel inventory | Hotel-room-rate-date-occupancy và seller scope; availability là trạng thái tại thời điểm kiểm tra |
| Events/attractions | Occurrence ID, timezone, cancellation/retraction, ngày hiệu lực; expiry không tự mở cửa |
| Air quality | Pollutant/unit/averaging window/station/model scope; không trộn AQI chuẩn khác nhau |
| Pricing | Currency, tax/fees, điều kiện và thời hạn quote; canonical không là một giá duy nhất cho mọi seller |
| Partner feeds | Tenant/access/license boundary, namespace và source revisions; raw không mặc định public |
| AI agents | Đọc state + expiry + reason; booking/payment là action plane có quyền và idempotency riêng nếu thêm sau |

“Một logical brain” áp dụng cho dữ liệu và chính sách dùng chung trong phạm vi được định nghĩa. Nó không biến offer riêng của từng đối tác hoặc thông tin riêng của khách thành một global public truth. Với inventory/pricing, canonical là trạng thái có scope, không xóa bằng chứng khác scope.

## G. Implementation entry criteria

### Trước production-oriented implementation

- [ ] B1-B9 được đưa vào Architecture Lock mới với version và người chấp nhận rõ.
- [ ] Hợp đồng authority/promotion mô tả atomic boundary, permissions và crash states.
- [ ] Ordering, correction/retraction, deduplication và rollback semantics từng dataset được định nghĩa.
- [ ] Freshness/validity/expiry/completeness/resolution tách riêng và có contract cho consumer offline/cache.
- [ ] Determinism bao gồm historical state cho hysteresis.
- [ ] Composition và fact/recommendation boundaries được khóa.
- [ ] Operator access/audit/activation rules được khóa theo quy mô đội ngũ thực tế.
- [ ] Failure matrix, RPO/RTO, restore fencing và monitoring tối thiểu được chấp nhận.
- [ ] Retention/access/replay policy rõ, không hứa replay vô hạn.
- [ ] Không còn unknown difference được chấp nhận ngầm trong tiêu chí migration.

### Trước source integration/cutover

- [ ] Có inventory thật của producer, cron, output/path/schema, credentials, lịch sử và incident của domain đầu tiên.
- [ ] Xác nhận đường output đang dùng thật; không kết luận Airport lỗi chỉ vì path legacy không còn.
- [ ] Source permissions và budgets được kiểm tra; shadow không nhân đôi polling vô ý.
- [ ] Golden masters bao phủ behavior cũ và các ca B1-B9 liên quan.
- [ ] Primitive công nghệ được xác minh với tài liệu chính thức và thử nghiệm race/crash phù hợp.
- [ ] Parity gates, latency/completeness targets và rollback compatibility được đo/duyệt.
- [ ] Các kill tests chạy ở môi trường kiểm soát; chưa tác động production chỉ để review.
- [ ] Có bằng chứng backup restore và external progress check trước nhận traffic production.
- [ ] Có chấp thuận riêng cho production cutover theo quy định bàn giao.

## Các câu nên sửa trực tiếp trong bản khóa

1. “Epoch prevents zombie writers” thành “Epoch được kiểm tra nguyên tử tại promotion boundary; writer không có quyền bypass boundary”.
2. “Active state never regresses to older logical slot” thêm correction/retraction và aged fallback semantics của B2.
3. “Same input + rule/config/time” thêm prior state/history reference cho stateful decisions.
4. Danh sách canonical states chuyển thành các trục độc lập; không dùng một enum để che conflict và stale cùng lúc.
5. “Keep LKG” thêm serve/action expiry kiểm tra khi phục vụ và phía consumer.
6. “Producer re-home after consumer transfer” thêm trạng thái bridge-dependent và retirement gate.
7. “Backup eventually / external sentinel future” chuyển phần tối thiểu thành production entry criteria; hoãn active multi-cloud.
8. “Raw evidence immutable” thêm retention/license deletion policy và replay capability thực tế.

Kết luận review: giữ kiến trúc tổng thể, bổ sung hợp đồng bảo đảm trước khi gọi là khóa cuối. Những sửa đổi này nhằm làm các invariant có thể chứng minh được, không nhằm thêm tầng hạ tầng.
