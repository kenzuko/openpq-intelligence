# Blueprint thực thi

## 1. Trình tự và deliverables

| Phase | Công việc | Deliverable / stop gate |
|---|---|---|
| P0 | Đọc V2.1, current instructions, read-only inventory latest systems | Inventory thật, dependency map, policy unknowns; không sửa production |
| P1 | Semantic contracts và pure kernels harness | Schemas/interfaces, fixtures, missingness/time/scope tests |
| P2 | Coordinator prototype + object adapter + capability proof | T01-T08/T47/T50, crash/race results; G1 |
| P3 | Registry/version activation + runtime serving view | Contract compatibility, expiry/control validation, readonly tests |
| P4 | Domain pilot mirror, port verified kernel | Golden master/differential report; G2 |
| P5 | Shadow cadence và composition tối thiểu | Parity, budget, health/failure reports; G3 |
| P6 | Operator Console riêng + backup/restore/sentinel | Role/audit/restore gates; Ops vẫn readonly |
| P7 | Per-dataset cutover được chỉ thị | G4, rollout/rollback evidence |
| P8 | Producer re-home và independence tests | G5; chỉ sau đó retire cron được phép |

Có thể port producer sớm hơn nếu giảm bridge risk. Phase dependencies và gates quyết định; không lấy số phase làm ép big-bang.

## 2. Repo/module layout đề xuất

Đây là cấu trúc bàn giao, chưa tạo repo. Repo name phải kiểm tra với chủ hệ thống/current inventory.

```text
contracts/
  evidence, assertion, canonical, decision, serving, commands
platform/
  authority, publication, storage, identity, time, registry, health
domains/
  weather, marine, aviation, transit, cano
composition/
  named decision policies, dependency contracts
runtime/
  contract readers, expiry serving view, provenance/access
operator/
  private commands/API, validation/preview, audit
fixtures/
  licensed evidence, golden masters, adversarial scenarios
docs/
  ADRs, inventories, policies, rollout/recovery runbooks
```

Tree trên là đề xuất tên module, không diagram hạ tầng. Domain imports platform contracts/pure utilities, không other domain implementation. Shared utilities không lén chứa weather/transit branches. Runtime không import collector/resolver; port verified kernel vào domain library để test, không into consumer.

## 3. Pilot lựa chọn bằng inventory

Weather có nhiều verified knowledge và stress contracts tốt, nhưng rủi ro cao hơn domain nhỏ. Chọn pilot ít nguồn/ít high-impact khi inventory chứng minh đủ đại diện; cũng phải test manual expiry nếu chọn Cano. Weather không được rewrite/chuyển first chỉ vì gói V1 gọi nó strong candidate.

Pilot không được trở thành kiến trúc đặc biệt bỏ fencing/retention rồi sửa sau. Có thể ít fields nhưng phải đi đúng end-to-end contract.

## 4. Interface boundaries cần định nghĩa trước code adapters

- EvidenceStore: receipt/payload append, integrity, retention/access status.
- RegistryReader: exact version/hash artifact lookup, compatibility metadata.
- DomainKernel: deterministic inputs/history -> assertions/resolution/decision.
- CandidatePreparer: validation, immutable generation, pin/prepare result.
- DatasetCoordinator: read state, validate receipt, commit command, change control, export outbox.
- CanonicalReader: exact committed generation/ref/hash, no latest listing guesses.
- ServingPolicy: evaluation_time/source times/control stamps -> eligibility view.
- SchedulerLedger: required slot/lease/progress/skip/fail semantics.
- OperatorCommands: authenticated actor/scope + expected revision -> audited result.

Không phải mọi interface một service. Network separation chỉ khi permission/failure/execution risk yêu cầu.

## 5. PR/changesets dự kiến

1. Contracts + fixture corpus metadata.
2. Coordinator + publish protocol prototype + proof tests.
3. Runtime/read-only + freshness/cache policy tests.
4. Domain pilot mirror + differential report.
5. Shadow cadence/source budgets/health.
6. Private Operator Console + audited control.
7. Backup/restore/sentinel + compatibility runbook.
8. Dataset-specific rollout chỉ khi được chỉ thị.

Giữ changesets nhỏ để review/rollback. Không merge code ảnh hưởng live pipeline trong PR chỉ “contracts”. Existing external git repos không copy cả repo vào tài liệu ZIP hoặc persistent file store; chỉ handoff docs.

## 6. Dừng đúng chỗ khi gặp thiếu thông tin

Thiếu source policy không dừng toàn dự án: tiếp tục contracts/local fixtures/other independent domain tasks. Nhưng không integrate source/live positive khi contract thiếu. Ghi BLOCKED ở đúng gate với required fact/value, không hỏi approval chung chung cho reversible inventory/code đã được user yêu cầu.

Không auto nâng plan Cloudflare, tạo external accounts hoặc thay quota. Đo actual resource profile trước lựa chọn. Không gán pipeline fail do path cũ; no data claim phải có scope/time/current endpoint evidence.

## 7. Definition of implementation complete

Code pass domain/protocol tests, activated policies đầy đủ, parity evidence, readonly permissions enforced, producer independence demonstrated, recovery và consumer compatibility proven. Bản thiết kế V2.1 tự nó không đạt definition này.


## A001 - Work/environment preflight

P0 là read-only repo/resource inventory với exact SHA và parallel-work record. P1-P3/G1 chỉ isolated resources/capabilities. Trước test, record actual account/environment/namespace/native IDs, buckets/bindings/routes/cron và credential permission references; production overlap hoặc unknown -> BLOCKED. T59-T63 và A001 là G1/workflow proof tương ứng. Trước write re-check baseline main; không overwrite các luồng khác. Không nối Ops commands.
