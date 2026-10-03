# Checkpoint đã mở và bước tiếp theo

Owner đã nói: “Hoàn thiện f15 và thực hiện. Hệ cũ đang dừng laii tất cả chờ cậu”. Vì vậy điều kiện chờ trước fresh read-only inventory đã mở. Không tiếp tục ghi rằng đang chờ owner cho phép đọc hệ cũ.

Đã thực hiện: six repo/main code-tree pins, README và scoped producer/consumer/workflow reads, branches/open PR snapshots; pin data-marine-ops commit; lấy exact-byte 14 Cano records và local compatibility/parity probe. Không remote write/push/merge/deploy. Không đổi authority locator, route, cron hoặc legacy consumer.

Tiếp theo trong phạm vi chuyển tiếp: review per-day Git history cho immutable amendment/correction lineage; giữ 7 unsupported older records riêng, không tự đổi An Thới/Phú Quốc hay FIELD evidence; xác định adapter hẹp theo nguồn thật, exact-byte golden/shadow comparison và source trust/policy gates. Giữ source-time/day/validity; không dùng display regeneration làm source age. Xem MIGRATION_EXECUTION_PLAN.md.

Trước remote write đầu tiên hoặc PR/merge: recheck current main, affected areas/open PRs và task base; isolated branch/worktree; không reset/stash/force push hoặc overwrite công việc luồng khác. Các repo nguồn chuyên biệt giữ nguyên. Inventory remote không chứng minh worktree người khác clean.

Trước production trust switch/resume: observed deployed identity và writer fencing, deterministic versioned coordinator locator, explicit authority migration, credential revoke/rotate có observed auth-deny; immutable history/amendments; rollback/trust gates; G1/G2 real admission. Owner work-pause không là evidence các cron hay credentials bị vô hiệu. Không activation chỉ vì local tests pass.
