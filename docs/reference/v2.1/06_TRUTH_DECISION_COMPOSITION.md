# Truth, decision và composition

## 1. Resolution có scope

Resolver nhận assertions theo variable/entity/location/time/horizon, policy version và evaluation time. Không universal source rank METAR > ECMWF cho mọi biến. Airport METAR chỉ là observation ở scope của nó; không biến thành weather toàn đảo hoặc forecast mọi giờ.

Policy xác định eligible evidence, precedence, spatial/temporal fit, completeness minimum và cách biểu diễn conflict. Evidence không được chọn vẫn giữ refs/reasons theo retention. Không cộng số feeds cùng upstream thành nhiều nguồn độc lập.

Anomaly handling: corrupted/structurally impossible có thể quarantine; plausible dangerous extreme giữ evidence + flag, cross-check và abstain/precaution theo policy. Missing gust không thành gust=wind hoặc zero. Weather ECMWF 3h không fake hourly interpolation; giữ legacy verified cycle/aggregation semantics.

## 2. Fact và recommendation

| World fact | Recommendation riêng |
|---|---|
| Cano được người vận hành xác nhận hoạt động hôm nay | Với điều kiện gió/sóng hiện tại, nên đi/chờ/đổi kế hoạch |
| Ferry operator thông báo trip cancelled | Dù chưa hủy, điều kiện hành trình cần lưu ý |
| Attraction có thông báo closure | Gợi ý hoạt động khác phù hợp thời gian |
| Flight report có actual/delay status | Lúc nào nên rời khách sạn/đón khách theo rule đã duyệt |

Official closure/scoped manual closure/safety recommendation là những inputs khác nhau. Positive manual confirmation không ghi đè closure chính thức trong cùng scope. Cross-domain recommendation có thể hạn chế gợi ý cano, không thay factual ferry status.

## 3. Minimum-evidence contract

Mỗi decision_type định nghĩa required variables, coverage, horizon, freshness, agreement policy, operational confirmations, absence handling và validity window. Thiếu minimum -> ABSTAIN/INSUFFICIENT_EVIDENCE. Không biến abstain thành thuận lợi bằng copy UI.

Các ngưỡng wave/gust/rain và quyết định high-impact phải lấy từ legacy rule inventory đã verified hoặc được chủ domain duyệt riêng. V2.1 không tự đặt ngưỡng an toàn du lịch/đường biển mới.

## 4. Manual validity

Cano confirmation chỉ áp dụng scope/ngày/thời gian được xác nhận, tối đa đến hết ngày vận hành khi policy cho phép. Nếu xác nhận ghi trong ngày 01/10, không carry vào ngày 02/10. Midday closure supersedes trong scope từ effective_from.

Manual statement đang có hiệu lực là evidence, không absolute truth cho mọi location/service. Override thay cách policy chọn evidence có active revision riêng. Expired assertion/override-based decision -> không còn đủ eligibility; Runtime không tự bỏ override rồi tái compute GO.

Closure vô thời hạn: valid_to có thể không xác định, review_due_at bắt buộc theo policy; last_reported_closed và confirmed_current_state tách riêng. Đến review deadline có thể giảm confirmation quality, không tự chuyển OPEN. Forecast reopening date lưu planned_reopen, không actual reopen.

## 5. Deterministic state transitions

Pure decision input = assertions/resolution refs + prior state/history/checkpoint + rule/config/mapping/policy versions + evaluation_time. Không hidden Date.now(), global mutable state hoặc external fetch trong pure kernel.

Hysteresis có entry/exit thresholds, required dwell window, missing interval behavior và late-evidence policy. Missing interval không được tính thành duration thuận lợi. Restart giữa dwell đọc checkpoint có exact state/history refs, không reset để thoát HOLD sớm.

Output emitted history và replay alternative distinct. Một source correction đến muộn có thể thay current decision bằng publication mới; replay quá khứ không sửa emitted record cũ. Same current values khác prior history có thể khác output đúng, vì inputs thực tế khác nhau.

## 6. Composition contract

Composition dataset định nghĩa evaluation scope/time, mandatory/optional input datasets/fields, allowed skew, valid intersection, freshness maximum, conflict precedence và action policy. Bắt đầu một decision cụ thể, không tạo global “island safe” flag.

Candidate composition ghi exact receipt/input refs. Domain updates không cần global lock. Nếu inputs lệch ngoài contract -> abstain/partial theo từng recommendation. Publication mới chỉ vì một dependency fresh không nâng tuổi dependencies khác.

Positive high-impact serving view cần control validation của các dependency có thể thu hồi/hạn chế quyết định, không chỉ Coordinator composition. Stamp của composition không tự xác nhận Weather/Marine/Cano vẫn current. Mỗi dependency stamp khớp ref/control state và còn hiệu lực; maximum validity là min của mọi deadline. Nếu ref đã bị retracted/superseded incompatible -> ABSTAIN cho đến recompute.

Không hứa zero-skew mọi domain: chọn bounded skew + bounded revocation latency đã được policy chấp nhận. Critical decision nếu yêu cầu real-time simultaneous state ngoài khả năng này phải không phát positive, hoặc có ADR mở rộng được duyệt.

## 7. Presentation/AI

Runtime/UI hiển thị fact, recommendation, uncertainty và thời gian cập nhật dễ hiểu. Labels domain/technical reasons có thể nằm phần chuyên sâu. Translation/AI explanation gắn decision ID và validity; không bịa lý do, không đổi “chưa xác nhận” thành “không hoạt động”. Không biến AI fallback text thành dữ liệu canonical.
