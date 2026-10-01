# Prompt dán vào luồng free

Bạn tiếp tục OpenPQ Intelligence từ gói bàn giao này. Mục tiêu turn đầu: làm F02 synthetic adversarial corpus; nếu không có source/terminal, làm F01 read-only inventory hoặc F03 review và xuất artifact. Không giả vờ chạy test/deploy.

Đọc 00_START_HERE -> 01_CURRENT_STATE -> 02_ARCHITECTURE_AND_BOUNDARIES -> 03_TASK_BOARD -> 04_FINAL_REVIEW. Repo: https://github.com/kenzuko/openpq-intelligence . Implementation commit được pin trong RELEASE.json; latest main mới hơn thì đọc diff khu vực liên quan trước write.

Quy tắc bắt buộc:
- P0 inventory read-only, record repo/branch/exact SHA/time, working tree và open PR/branch nếu có quyền xem. Unknown ghi unknown.
- Trước write đầu tiên fetch latest main và re-check SHA. SHA đổi thì re-read affected area + relevant tests. Không force push/reset/stash/rewrite hoặc đè parallel changes.
- Không sửa Weather/Home/Transit/Airport/Near Me/i18n/JoTrip Ops; không production route/cron/DO/R2/credentials. Local tests không cần cloud secrets.
- Không sửa docs/reference/v2.1 hoặc evidence snapshot đã pin. Concrete design bug -> ADR/amendment mới chỉ rõ counterexample/superseded section/new test/decision.
- Không hạ preflight/capability/trust/version/hash/expiry để làm xanh. Không tạo chính sách số/biển/licensing/RPO/RTO mới. Không coi fixture là operation thật.
- Không động Coordinator/Runtime/auth/signing/control/deploy workflows trong F02. Phạm vi F02 chỉ corpus/test/docs report đã liệt kê.

Làm ngay:
1. Ghi baseline repo SHA và task/file scope vào báo cáo.
2. Đọc src/contracts/semantic.js, src/fixtures/semantic.js, scripts/replay-semantic.js, fixtures/semantic/corpus.json, tests/semantic*.test.js và docs/SEMANTIC_FOUNDATION.md.
3. Thêm 8-12 case có expected output suy ra độc lập; giữ S01-S08. Ưu tiên source-validity future, stale source after fresh fetch, missing/type mismatch, scope/location/version, conflict và emitted/replay/history/permutation.
4. Nếu có terminal: npm ci --ignore-scripts; npm run check; npm run verify:handoff; npm test; npm run replay:semantic. Không cần chạy lại cloud vì không đổi Worker. Nếu không có terminal: xuất JSON/patch/Markdown và TESTS=NOT_RUN, nêu đúng bước để luồng có terminal kiểm.
5. Nếu gặp lỗi: lưu failing fixture + expected + actual/error + minimal counterexample; không sửa expected cho khớp implementation. Đề xuất fix hẹp trong phạm vi task hoặc chuyển owner nếu đụng authority.
6. Xuất báo cáo gồm changed files, evidence, tests thật, unresolved items, exact next step. PR draft được phép nếu có GitHub; không tự merge/deploy để thuận tiện. Owner luồng chính review/merge.

Kết quả cần trả: một task hoàn thành review được, không hứa hoàn thành cả Intelligence. G1/G2 vẫn NOT_PASSED trừ khi gate owner có đủ evidence mới. T01-T63 không tự đánh PASS toàn bộ bằng test local. R2 revoke proof là credential đọc ở một runner, không chứng minh global write revocation.
