# Migration và cutover V2.1

## 1. Nguyên tắc

Greenfield architecture, giữ verified knowledge. Không rewrite Weather/Airport/Transit cho đẹp. Không đổi UI/domain/public routing cùng lúc chuyển producer. Recheck latest main/trạng thái thật trước patch; nhánh khác đang sửa không được bị ghi đè.

Không đánh giá Aviation FAILED vì path legacy thiếu. Inventory phải tìm output live/normalized đang dùng thật rồi mới kết luận health.

## 2. Ba mốc độc lập

| Mốc | Đã đạt gì | Chưa được tuyên bố |
|---|---|---|
| MIRROR/BRIDGE_DEPENDENT | V2.1 đọc/mirror output legacy, normalize/compare | Không producer independence |
| CANONICAL_TRANSFERRED | Coordinator V2.1 authority + consumers chuyển có rollback | Có thể vẫn dùng legacy collector |
| PRODUCER_INDEPENDENT | Production collector/executor tự cập nhật qua source cycles, kill-test pass | Chưa tự cho phép xóa lịch sử/retire rollback assets |

Một dataset ở bridge mode vẫn hữu ích nhưng phải rõ provenance/dependency. R2 cache không là evidence independence.

## 3. Inventory bắt buộc

Producer/repo/current commit, scheduled/event triggers, source endpoints/auth references, output paths/contracts, runtime routes/readers, history locations/retention, source licenses/budgets, verified rules/configs, source time/units/mapping semantics, incident fixes, credentials owners và rollback artifacts.

Không giả repo/tables/storage path từ memory. Repo mới/suggested layout trong blueprint không là repo đã có. Read-only inventory không thay secrets hoặc cron.

## 4. Golden masters

Frozen real evidence được phép lưu, expected emitted output, semantics và known issue verdict. Bao gồm model cycle/stale/regression, ECMWF 3h không interpolate, gust missing, marine point alignment, model/groundtruth disagreement, Human Weather outputs; Airport actual/delay/mapping/count mismatch; Transit ngày thật/operator partial/no seat count; manual expiry/midday closure; HTTP 200 semantic invalid; writer race và restart.

Extract pure kernel -> document -> fixture -> differential test -> port/re-home. Legacy bug chỉ được sửa sau concrete evidence/approved expected difference, không coi legacy hoặc new luôn đúng.

## 5. Shadow parity

So sánh same evidence khi được phép; field-level value/time/unit/missingness/scope/coverage/attribution/status/freshness/decision. Verdict EXACT, TOLERANCE, SEMANTIC_EQUIVALENCE, EXPECTED_DIFFERENCE. Difference class legacy bug/new bug/source changed/timing/intentional/unknown.

Unknown trong critical field chặn authority transfer. Tolerance numerical và expected difference có reason/owner; không aggregate match% che missing gust/source time sai. Giữ source request budget, không double-poll vô ý.

Shadow duration khởi điểm ít nhất 7 ngày liên tục và bao phủ ít nhất hai cycle quan trọng liên quan; fixtures bù sự kiện hiếm. Đây là gate thiết kế đề xuất phải chốt theo domain, không parity evidence đã có. Không kéo dài thử vô hạn khi criteria rõ đã pass; nếu source chu kỳ dài, ghi lý do thời gian bổ sung.

## 6. Authority transfer

Trước transfer: current readers tương thích schema/API, production candidate mới đủ latest validity, authority fencing đã test, legacy không có bypass canonical credentials, rollback assets/source access còn hoạt động.

Operator command epoch +1, expected control revision. In-flight old writer reject. Active dữ liệu cũ giữ đến candidate mới committed; không tự reset state bằng transfer. Consumers chuyển từng nhóm; fallback reader tuân expiry/access contract, không query trực tiếp source để lấp gap.

Chỉ sau chỉ thị cutover rõ tại luồng thực thi. Không lấy “final design” làm deployment authorization.

## 7. Re-home và retirement

Re-home producer có thể trước hoặc sau consumer transfer tùy risk, nhưng independence milestone luôn sau đủ bằng chứng. Disable legacy lab ở controlled test, quan sát new source collection + canonical updates qua nhiều cadence/cycle; không dựa snapshot preloaded.

Retire cron khi new cadence/progress/parity/consumer transfer/rollback test pass. Archive repo chỉ sau retention/rollback plan được chấp nhận. Không xóa historical evidence hay credentials phục hồi chỉ vì task được gọi hoàn tất.

## 8. Rollback per dataset

- Authority rollback -> epoch mới, authenticated legacy/restored producer còn source access, vẫn qua Coordinator.
- Code rollback -> compatibility check với active artifacts/contracts; không tự đổi rule.
- Rule rollback -> explicit activation of approved version, control_revision +1, recompute.
- Data correction -> new revision with supersedes/retraction, không epoch decrement.
- Consumer rollback -> API adapter/version phù hợp, không public-origin redirect về CMS.

Partial rollback phải test composition dependents: dependencies khác generation/revision có thể invalid; abstain/recompute theo contract. Consumer rollback không tự khôi phục write permission cho legacy.

## 9. Done definition

Dataset done khi source independent updates, canonical protocol proof, parity gates, reader compatibility, expiry/revocation, access/retention, backup restore, monitoring và rollback đều có evidence. Toàn platform done khi mọi migrated dataset và relevant kill tests đạt; không dùng UI “đẹp/nhanh” làm bằng chứng pipeline đúng.


## A001 - P0 parallel-work safety và locator migration

P0 ghi repo/ref/local HEAD/exact remote main SHA, tree/index changes và open PR/branch/touched scopes, timestamp. Không sửa repo/production state. Report/clone riêng được phép; không đổi refs/reset/stash trong checkout chia sẻ. Trước write đầu tiên/push/PR update/merge re-check remote main/base SHA; changed baseline -> reread affected areas/contract dependencies và relevant tests. Không force-push/rewrite/overwrite parallel changes. Isolated branch/worktree khi checkout dirty/shared.

Authority locator đổi phải explicit migration, pin old/new environment/namespace/native IDs và trust artifact versions. Fence old Coordinator/Runtime routes, scoped signing/command keys và deny probes trước new resume. Một current locator per dataset/environment; old retained history không current authority. Xem A001.
