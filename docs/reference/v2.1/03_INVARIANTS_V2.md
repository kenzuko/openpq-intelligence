# Invariants V2.1

Các invariant V1 được bảo tồn với phần làm rõ dưới đây. Khi có mâu thuẫn, cách diễn đạt V2.1 là authority.

## Dữ liệu và bằng chứng

1. Missing không thành zero; unknown không thành safe; source outage không thành service cancelled.
2. Source time không bị thay bởi collection/publication time. Nhận lại bytes cũ không làm chúng fresh.
3. Model/observation/forecast/manual/official operational report là các loại assertion riêng.
4. Spatial scope, time interval, unit, horizon và source namespace phải rõ; không interpolate/merge lén.
5. Newer không mặc định better. Raw plausible extreme không bị làm dịu hoặc xóa vì lạ.
6. Evidence còn lưu là bất biến; corrections append. Retention/legal deletion có tombstone đúng policy, không giả vờ giữ evidence mãi.
7. Conflict và correlation giữa nguồn được giữ; không manufactured consensus.

## Quyền ghi và publication

8. Một Coordinator authority cho mỗi dataset và active recovery generation.
9. Epoch tăng trong cùng authority history. Epoch cũ không được regain bằng restart. Recovery history mới có generation mới, không so random generation ID bằng thứ tự chữ.
10. Chỉ authenticated LIVE candidate dưới owner/epoch/control hiện tại được xét promotion. Mode là capability được xác minh, không chỉ enum client tự khai.
11. Complete immutable blob first, transaction active reference last. Partial generation không active; projection không là quyền promote.
12. Final transaction kiểm tra expected revision và mọi control versions liên quan sau mọi external I/O.
13. Publication revision tăng trong generation. Correction cùng slot được phép; obsolete normal candidate không được tự lùi nghiệp vụ.
14. Correction/retraction/authority/code/rule rollback là các hành động riêng có audit.
15. BACKFILL/REPLAY/SHADOW không có production promotion capability và không phát real-world side effects.
16. Duplicate delivery/retry không tạo promotion hoặc side effects trùng. Không hứa external exactly-once nếu provider thiếu idempotency.

## Decision và hiệu lực

17. Truth resolution, completeness, freshness và operational recommendation là các trục riêng.
18. Fact vận hành và recommendation không dùng chung một CANCEL flag không có loại.
19. High-impact positives có evidence minimum, validity và bounded control validation. Abstention là output hợp lệ.
20. Runtime không tái resolve truth; chỉ tính serving eligibility theo pinned policy và thời gian yêu cầu.
21. Historical emitted decision không đổi. Replay alternative không thay lịch sử.
22. Determinism bao gồm exact inputs, prior state/history khi cần, rule/config/mapping versions và evaluation time.
23. Island State giữ exact refs, scope, temporal fit và dependency-specific validity; fresh publication không làm inputs fresh.
24. AI không là production resolver, rule activator hoặc action executor V1.

## Manual, consumers và security

25. Manual assertion có actor, scope, effective interval, expiry/review policy; không globally authoritative.
26. Expiry/revocation không tạo positive fact. Mở trở lại cần evidence theo policy.
27. Changes giảm bảo vệ có quyền mạnh hơn hoặc review phù hợp; thao tác thường ngày không bị áp quy trình quá mức.
28. JoTrip Ops là read consumer ở V1. Operator control có app/API riêng.
29. Consumer không có source/promotion credentials, không import hidden truth kernels, không phụ thuộc R2 object layout.
30. Client/cache/offline không kéo dài action eligibility; không bypass expiry bằng đổi nhãn.

## Reliability và migration

31. Core/Runtime independent deployment; domain cadence/budget/secret isolation có test.
32. Control unavailable -> no new promotions; bounded LKG theo policy.
33. Health đo progress và tách source/pipeline/dataset/decision/runtime. HTTP 200 không đủ HEALTHY.
34. Restore trong isolation, fence credentials và recovery generation trước khi writers được chạy.
35. Backup không là complete trước restore drill; provider outage không được hứa zero downtime ở V1.
36. Verified legacy algorithms được inventory/golden-master/differential test trước thay thế.
37. Bridge-dependent không được gọi producer-independent; retirement chỉ sau parity, rollback và kill tests.
38. Không big-bang cutover; migration/rollback theo dataset và consumer contract.
39. Code deployment không tự đổi active rule/config hoặc authority.
40. Hạ tầng mới phải giải quyết failure mode cụ thể; không thêm service chỉ để đủ sơ đồ.


## Invariants bổ sung A001

41. Một current authority locator mỗi environment/dataset; self/runtime identity checks không tin locator fields client tự khai.
42. P0 chỉ đọc repos/resources; mọi write re-check exact main/base SHA và tránh thay đổi song song.
43. G1 primitive tests không cầm production capabilities/resources/bindings.
44. Revoke success không bằng auth deny evidence; locator/generation fencing độc lập vẫn bắt buộc.
45. Released handoff snapshot/manifest bất biến; design changes qua accepted amendment có lineage.

Chi tiết/test T59-T63 trong A001 và test matrix.
