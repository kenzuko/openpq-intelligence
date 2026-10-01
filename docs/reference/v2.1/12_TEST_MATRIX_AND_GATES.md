# Test matrix và bằng chứng nghiệm thu

Tất cả tests dưới đây là **NOT RUN** tại thời điểm bàn giao. Review tài liệu không thay test thật. Chạy local harness trước, sau đó primitive/race/recovery ở isolated cloud environment khi được cấp quyền phù hợp. Không fault-inject production để chứng minh thiết kế.

## 1. Giao thức và sửa dữ liệu

| ID | Fault/fixture | Expected result bắt buộc |
|---|---|---|
| T01 | Epoch cũ treo rồi gửi commit sau transfer | Reject, active không đổi |
| T02 | Hai candidates cùng expected revision | Chỉ một commit; còn lại revalidate/recompute |
| T03 | Control/rule/override đổi trong external await | Final transaction reject stale control |
| T04 | Crash trong upload/multipart | Không prepared/active partial |
| T05 | Crash sau upload hoặc prepared | Active cũ; pin/orphan GC đúng window |
| T06 | Commit thành công nhưng response timeout | Retry cùng ID/digest trả receipt cũ, không revision mới |
| T07 | Outbox export chạy đảo thứ tự hoặc CAS conflict | Projection không lùi revision cùng generation |
| T08 | Cùng command ID nhưng payload khác | Conflict; không idempotent success |
| T09 | Correction cùng logical slot | New revision/supersedes, emitted history giữ nguyên |
| T10 | Candidate obsolete đến sau current cycle | Reject normal promotion; lịch sử có thể giữ riêng |
| T11 | Late event với source/entity revision | Reconcile đúng entity/time; không overwrite global bằng timestamp lớn nhất |
| T12 | Data semantically wrong đã active | Explicit retraction/degrade/correction, không giảm revision |
| T13 | Epoch đổi rồi nhận duplicate business event | Không duplicate notification/promotion intent |

## 2. Freshness, decision và composition

| ID | Fault/fixture | Expected result bắt buộc |
|---|---|---|
| T14 | Core dừng qua 00:00, cano cache còn | Confirmation ngày cũ action-ineligible; ngày mới unknown |
| T15 | Core down, model/observation LKG già đi | Source age tăng; không fresh vì served_at mới |
| T16 | HTTP 200 trả payload/source_time cũ | Không refresh source observation time |
| T17 | 304/cache/SWR/offline kéo dài response | Không kéo dài action/validation deadline |
| T18 | Client clock skew/app resume | Conservative expiry, không tự mở GO |
| T19 | Override/retraction vừa commit, cached validation còn | Positive chỉ tồn tại bounded lifetime đã chấp nhận; sau đó abstain |
| T20 | Runtime cold start + control down + checkpoint lag/missing | Verified aged checkpoint hoặc unavailable; không list candidate latest |
| T21 | Restart giữa hysteresis dwell T | Prior-state/history bảo tồn, không thoát HOLD sớm |
| T22 | Replay exact artifacts/history/evaluation time | Deterministic equivalent output, không sửa emitted history |
| T23 | Missing interval/late out-of-order history | Không tính missing thành safe dwell; explicit late policy |
| T24 | Weather mới, Marine stale, Transit khác ngày | Composition partial/abstain đúng dependency contract |
| T25 | Manual positive cùng scope official closure | Closure/restriction không bị ghi đè bằng positive mới hơn |
| T26 | Hai feeds copy chung upstream | Không giả independent agreement |
| T27 | Wave/wind khác location hoặc rain intervals khác | No silent merge/interpolation; scope verdict rõ |
| T28 | Plausible extreme so với corrupt impossible value | Giữ nguy hiểm plausible + flag; quarantine corruption; không làm dịu |

## 3. Operator, migration và recovery

| ID | Fault/fixture | Expected result bắt buộc |
|---|---|---|
| T29 | Actor sai role/scope/ngày, mode đổi từ shadow JSON | Deny; không mutate production |
| T30 | Hai operator cùng control revision | Một commit, một conflict; audit đúng |
| T31 | Freeze/rule disabled hết hạn/quên | Alert/review và recompute; không auto-GO từ stale candidate |
| T32 | Code rollback về binary không hỗ trợ active schema/rule | Chặn incompatible activation; không auto rule rollback |
| T33 | Mirror candidate và legacy cùng evidence | Field-level comparison đủ time/unit/missingness/attribution |
| T34 | Legacy lab/cron tắt, bridge còn cached output | Không báo independence; chỉ pass khi new collection/commit qua cycle thật |
| T35 | Consumer transfer + source producer legacy fail | Degrade đúng dependency; không giấu bridge dependence |
| T36 | Dataset authority rollback, old in-flight writer trở lại | New epoch fencing, old denied |
| T37 | Partial rollback + composition inputs incompatible | Abstain/recompute, không mixed hidden truth |
| T38 | Airport path legacy không còn nhưng live output tốt | Inventory locate current output; không false FAILED |
| T39 | Control unavailable | No promotions; bounded LKG/control expiry |
| T40 | Canonical store unavailable/cache cold | Unavailable đúng policy; collection không giả publish success |
| T41 | Restore backup cũ/epoch thấp, old credentials còn | Chặn resume đến fence/recovery generation mới |
| T42 | Backup missing blob/hash mismatch/expired artifacts | Không activate broken ref; restore capability/degraded rõ |
| T43 | Queue duplicates/out-of-order/poison/backlog burst | Bounded retry/budget/DLQ, không starve unrelated domain |
| T44 | 72h unattended isolated failure/recovery | Progress checks phát hiện, retry bounded, expiry qua ngày đúng |

## 4. Retention, permission và growth

| ID | Fault/fixture | Expected result bắt buộc |
|---|---|---|
| T45 | Source raw storage denied hoặc hết retention | Không giữ raw trái policy; replay capability đúng |
| T46 | Mapping/location/rule versions thay rồi replay | Dùng đúng artifacts cũ hoặc báo không tái dựng đủ |
| T47 | Runtime credentials thử PUT/DELETE/control command | Denied thật tại capability boundary |
| T48 | Partner/AI hỏi raw/tenant scope không được phép | Deny/filter, không expose secrets/private facts |
| T49 | Export outbox lag và sentinel HTTP 200 nhưng không progress | Alert dataset/source/checkpoint failure riêng |
| T50 | GC đua PREPARED/COMMIT; retention xóa active inputs | Pins/ref safety hoặc explicit invalidation; không active missing blob |
| T51 | Tắt UI/Runtime/một domain/source lần lượt | Relevant independent paths còn update; cache-only không tính pass |
| T52 | Flight count/mapping/actual, ferry ngày thật/partial operator fixtures | Bảo tồn verified semantics, không fake seats/missing thành zero |
| T53 | Closure chưa có reopen evidence hoặc ngày dự kiến đã đến | Không auto OPEN; last report/current confirmation tách |
| T54 | Recovery generation mới, old signed receipt/projection replay | Không trust generation cũ như current hoặc cấp new validation |
| T55 | Add hotel offer/event/AQI/crowd fixture | Scope/units/time phù hợp, không sửa unrelated kernel |
| T56 | Rule threshold/config/source budget thiếu policy | Live/action gate fail rõ, không default permissive |
| T57 | Future closure effective_from đến khi Core đã dừng | Old positive expires đúng transition; control không cấp stamp positive mới |
| T58 | Dedup record đã GC, job/command cũ redeliver quá deadline | Reject hoặc historical, không new live intent/alert |
| T59 | Cùng dataset_id route nhầm old/alternate namespace/environment/instance, old deployment còn chạy | Self/dispatcher/runtime trust reject wrong locator; không accepted current receipt hoặc positive stamp |
| T60 | Revoke/rotate trả success nhưng old permission chưa propagate | No resume cho đến auth-deny probe evidence; timeout/conflict không PASS; fencing độc lập vẫn giữ |
| T61 | Tên env test nhưng binding/token/namespace/bucket là production hoặc không biết scope | Preflight BLOCKED trước fault test, không cầm production capability |
| T62 | Main SHA đổi hoặc shared worktree có parallel changes sau inventory | Recheck/reread/relevant tests/isolated branch; không overwrite hoặc force push |
| T63 | New amendment/release tạo ra từ V2 parent | Parent ZIP bytes/hash giữ nguyên; amendment sections/tests/precedence và new manifest đúng |

T57-T58 được bổ sung ở vòng rà V2; A001 bổ sung T59-T63, tổng cộng 63 ca. Không ca nào đã chạy tại thời điểm bàn giao.

## 5. Gates

| Gate | Được làm sau khi đạt | Evidence tối thiểu |
|---|---|---|
| G0 - Handoff | Read-only inventory, isolated design/code | Đã đọc V2.1 và current user scope |
| G1 - Primitive proof | Chọn storage/control adapters cho integration | T01-T08, T39-T42, T47, T50, T54, T59-T61 phù hợp môi trường; permission/cost/limits record |
| G2 - Domain integration | Nối source thật vào mirror/shadow | Inventory/license/budget, golden masters, mapping/time/rule policies |
| G3 - Shadow acceptance | Chuẩn bị authority transfer review | Differential/parity report, freshness/latency/coverage targets, tests liên quan pass |
| G4 - Production cutover | Chuyển dataset/consumers đã được chỉ thị | Explicit scope, rollback compatibility, monitoring/backup restore, policies không còn live blockers |
| G5 - Independence/retirement | Retire legacy cron theo chỉ thị | Source updates kill tests, cycle coverage, rollback assets và retention |

G1 có thể cần cloud sandbox để test primitive thật. Không deploy production để gọi đó là sandbox. Nếu quyền/provisioning không có, hoàn thành local proof và ghi phần chưa kiểm chứng, không bịa PASS.

## 6. Evidence report format

Test ID, dataset, actual environment/account scope/namespace/native object ID/bucket/binding/routes/trigger IDs, sanitized credential permission references, locator version/hash, repo/branch/exact commit SHA, environment/isolation, code/artifact hashes, fixture refs và license, fault injected, expected/actual, timestamps/latency, result PASS/FAIL/BLOCKED/NOT_RUN, log references sanitized, owner và accepted difference nếu có. Một screenshot UI không là proof của control commit hoặc source independence.
