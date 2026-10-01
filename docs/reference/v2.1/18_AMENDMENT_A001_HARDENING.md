# Amendment A001 - Khóa triển khai V2.1

Ngày 01/10/2026. Parent: snapshot V2 nguyên byte trong `reference/OPENPQ_INTELLIGENCE_FINAL_HANDOFF_V2_20261001.zip`, hash tại `V2_PARENT_SNAPSHOT.json`. Amendment này là quyết định mới theo phản biện của chủ hệ thống, không sửa đè V2.

**Thiết kế đã khóa.** Từ đây chỉ thay đổi khi implementation có concrete counterexample hoặc yêu cầu mới rõ của chủ hệ thống. Không mở thêm vòng so sánh kiến trúc tổng thể. Numeric policies/inventory/test evidence vẫn phải qua gates.

## A1. Coordinator locator và authority identity

Counterexample: cùng dataset nhưng namespace/binding/environment/name khác tạo hai Coordinator có state owner/epoch giống nhau. Epoch local không chống split-brain nếu Runtime có thể tin cả hai.

### Trust record bất biến và versioned

Mapping canonical `(environment_id, dataset_id) -> current authority locator` có một entry hiện hành, trong bootstrap trust artifact được triển khai có kiểm soát. Fields:

- `authority_instance_id`: identity ổn định của authority instance được đăng ký.
- `authority_locator_version`, `locator_artifact_hash`: version/hash mapping được duyệt.
- `environment_id`, provider account scope, namespace identity, native object ID.
- `dataset_id`, stable derivation name/algorithm version nếu dùng deterministic name lookup.
- `recovery_generation`, authorized command/publisher principal và receipt signing key IDs gắn đúng locator.

Dataset ID không đổi theo display name. Default derivation dùng stable dataset ID trong namespace/environment đã đăng ký; native ID kỳ vọng được resolve và lưu trước activate. Không tự dùng newUniqueId hay fallback namespace khi resolve lỗi. Metadata account/namespace xác minh từ deployment/provider inventory, không tin chỉ vì env var ghi chữ production. Actual object ID lấy từ provider runtime identity, không từ request body. Không dựa `ctx.id.name` vì name có thể không có khi lookup bằng ID string.

### Các lớp kiểm tra

1. Dispatcher resolve mapping đúng environment/version, kiểm tra binding/native ID khớp trước gửi.
2. Coordinator self-check actual instance identity với trust record/state. Mismatch -> fail closed; không auto-bootstrap một authority cho dataset đã đăng ký nơi khác.
3. Capability và COMMIT ràng locator/version/hash/environment/native identity cùng owner/epoch/generation/control/revision.
4. Receipt và control-validation stamp mang locator/environment fields; R2 checkpoint namespace chứa authority identity và recovery generation.
5. Runtime chỉ tin đúng current tuple trong trust artifact. Valid signature chưa đủ: signing key phải được đăng ký cho đúng tuple. Không chia capability signing current locator cho alternate instance. Old locator/key chỉ có thể verify historical provenance, không cấp current positive eligibility.

Bootstrap trust artifact không được lấy bản mới nhất tùy tiện từ Coordinator đang muốn được công nhận. Registry ở đây là versioned config được duyệt, không thêm distributed registry service. Chỉ có một current locator cho mỗi environment/dataset; entries PREPARED/HISTORICAL không có current write authority.

### Đổi locator là authority migration

Đổi namespace/native ID/account/environment/dataset canonical ID không là config edit thường. Phải có migration command/runbook: inventory current tuple -> quiesce/fence old writers/publisher -> prepare isolated target/read compatibility -> checksums/restore references -> epoch/generation phù hợp -> activate trust mapping version mới có audit -> xác minh all current Runtime routes dùng đúng tuple -> resume writer.

Trong khoảng chuyển, chấp nhận no positive availability thay vì để hai locator cùng current. Old Runtime routes phải drain/disable hoặc chứng minh không còn cấp valid positive stamps; cached positive stamps không sống quá deadline đã cấp. Không hứa trust config lan truyền tức thì. T59 phải bao gồm old deployment vẫn chạy và route/binding bị nhầm.

Các phần được supersede/làm rõ: 02 §3/5, 03 invariant 8-10, 04 receipts/control validation, 05 authority/commit/export, 07 trusted Runtime reads, 10 recovery, 11 authority transfer, 15 ADR-001. V2.1 thêm sections ở các tài liệu này; invariant khác giữ nguyên.

## A2. Parallel-work safety lock

Counterexample: P0 đọc commit A, luồng khác merge commit B, implementation ghi file dựa A hoặc dùng checkout chung có uncommitted changes rồi ghi đè.

P0 tuyệt đối read-only đối với repos/resources đang inventory. Ghi inventory report mới vào workspace riêng được phép; không fetch làm đổi refs trong checkout đang dùng chung, checkout/reset/stash/cherry-pick/pull/merge hoặc edit code. Muốn materialize repo, dùng clone/worktree riêng và ghi rõ nó là workspace inventory. Remote refs/PR status đọc qua API/ls-remote; auth chỉ theo quyền được cung cấp.

Record repo remote identity, branch/ref, exact local HEAD SHA, remote main SHA tại thời điểm đọc, dirty/index/untracked state liên quan, open PRs/branches, touched areas và timestamp. Không in secrets hoặc file không liên quan. Đây là inventory thực tế, không giả git state từ memory.

Trước write đầu tiên và trước push/PR update/merge: re-check remote main và own branch/base SHA. Nếu base/main đổi, re-read affected areas/contract deps và re-run relevant tests hoặc plan tests chưa có; rebase/update chỉ trên isolated task branch theo workflow đã có. Dirty/shared worktree -> không sửa, tạo workspace riêng. Không force push, rewrite history, auto-reset/stash, overwrite/delete changes thuộc luồng khác. Conflict về same files -> ghi concrete overlap và phối hợp, tiếp tục tasks độc lập.

Lock là workflow/record kiểm tra, không một file lock giả global registry. Không chiếm exclusive lock toàn repo khiến các luồng khác bị chặn. Exact SHAs/touched scopes đảm bảo review đúng baseline.

Supersedes/làm rõ: 11 inventory/current main, 13 P0/changesets và 16 execution prompt. T62 kiểm chứng workflow này.

## A3. Isolated primitive proof capabilities

Counterexample: tên env là test nhưng DO binding/R2 token thực tế vẫn là production. Test fault injection phá active data dù không có production deploy.

P1-P3/G1 không có production DO namespace, R2 buckets, routes, cron, source command/publisher/admin/signing credentials hoặc service bindings có thể mutate production. Test account riêng hoặc namespace/buckets/capabilities riêng được verified đủ isolation trong cùng account; tên suffix test không là bằng chứng.

Preflight evidence: environment/account scope, namespace/native IDs, bucket IDs/names, binding mapping, routes/triggers, credential reference/permission scope, signing key IDs và code/config hashes. Không lưu credential values. Đối chiếu production inventory bằng resource identity; unknown/overlap -> BLOCKED trước test. Không probe bằng production write credentials để “xem có an toàn không”.

Deny capability tests/fault injection dùng sacrificial test resources trong isolated environment. Khi runbook phục hồi production đã được chỉ thị, deny probes production là thủ tục riêng có phạm vi; không gọi chúng là G1 sandbox.

Supersedes/làm rõ: 12 G1/evidence report, 13 P1-P3, 16 prompt. T61 là preflight gate.

## A4. Revocation propagation và deny evidence

Nguồn chính thức: [R2 consistency model](https://developers.cloudflare.com/r2/reference/consistency/) ghi IAM thêm/xóa R2 Storage permissions là eventually consistent, thay đổi key có thể đến một phút để phản ánh toàn cầu. Không suy ra mọi credential/service binding đều có cùng thời gian; xác minh mechanism cụ thể.

Revoke/rotate response thành công không chứng minh old principal đã mất quyền. Trước switch trust/resume, ghi evidence old valid credential thử write trong disposable probe location được phép và old command credential thử qua cùng authorization boundary -> auth deny thật. Command probe dùng valid-format, không gây side effect, auth kiểm tra trước conflict/domain logic. Timeout/5xx/409/validation error không là auth deny. No token values trong logs.

Nếu probe còn được chấp nhận: vẫn isolation/quiesced, retry bounded theo propagation window/guidance hiện hành; không ngủ một phút rồi auto PASS. Ghi probe time/path/region hoặc runner/request identity/status và provider audit evidence nếu có. Một probe từ một nơi không tự chứng minh toàn cầu; dùng representative paths + bounded repeated probes và declared propagation policy. Locator/generation/capability checks vẫn là fencing độc lập, không bỏ chúng vì revoke đã trả 200.

PUT probe chỉ disposable marker, không production payload/active manifest; nếu write vô tình thành công, ghi FAIL và cleanup theo scope được phép. Không DELETE dữ liệu đang dùng. Old binding/deployment không có token có thể probe trực tiếp: old path đã bị disabled/authorization denied; ghi mechanism cụ thể. Nếu không chứng minh đủ fencing -> không resume.

Supersedes/làm rõ: 10 recovery step 2/7, 09 capability proof, 12 T41/T60 và 15 ADR notes.

## A5. Immutable handoff lineage

Counterexample: luồng implementation sửa trực tiếp V2 contract để hợp code và không còn biết decision ban đầu.

Mọi released ZIP và manifest là snapshot bất biến. V2.1 là release dẫn xuất, có parent SHA và amendment này; không thay file V2 đã phát hành. Mọi thay đổi thiết kế sau V2.1 tạo ADR/amendment mới: ID/date/owner, parent release+SHA, concrete counterexample hoặc user requirement, sections superseded, mới/cũ, new tests, decision và activation status. Không chỉ đổi documentation wording để gọi test PASS.

Code-specific inventory/measurement/results thêm artifacts mới, không tự supersede architecture. Accepted amendment có thể tạo release mới với derived effective docs và manifest mới; snapshot parent giữ nguyên. ADR proposed chưa approved không là authority. Thứ tự: current explicit owner scope > accepted amendment/release mới > V2.1 effective contracts > parent reference.

Supersedes câu “sửa đúng contract/ADR” trong 00/16/17 thành “tạo amendment có lineage trước thay đổi bước phụ thuộc”. T63 verify release/parent integrity.

## Readiness

Không tạo thêm framework hoặc yêu cầu numeric policy đã BLOCKED phải được giải quyết bằng suy đoán. V2.1 sẵn sàng bắt đầu P0. T01-T63 đều NOT RUN; package integrity checks có thể PASS riêng. Chưa thay production resources.
