# ADR công nghệ và nguồn đối chiếu

Đối chiếu tài liệu chính thức ngày 01/10/2026. Không dùng search snippet như proof toàn bộ implementation; primitive vẫn cần isolated tests. URL được giữ trong tài liệu kỹ thuật để luồng sau mở nguồn chính thức, khác quy tắc hyperlink của nội dung website public.

## ADR-001 - Control và điểm commit

**Chọn baseline:** SQLite-backed Durable Object theo dataset cho authority/active reference/control revision/audit/outbox. Domain-heavy computation không chạy trong transaction hoặc giữ global lock.

**Cơ sở nhà cung cấp:** DO storage có semantics transactional/strongly consistent. transactionSync dùng callback đồng bộ; external I/O không thể nằm trong callback. PITR có API riêng; khôi phục native vẫn cần fencing/trust procedure của V2.1.

Nguồn: [SQLite-backed Durable Object Storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

**Suy luận thiết kế của V2.1:** primitive này phù hợp local atomic boundary cho B1. Không suy ra input/output gates tự bảo vệ mọi handler có await. Explicit rechecks/CAS và race tests vẫn bắt buộc. Không DO toàn đảo chứa mọi domain computation; một namespace với instance per dataset đủ trước khi scale.

**Phương án thay thế:** transactional SQL store có thực tế chứng minh được epoch + expected revision + active reference commit cùng boundary. Nếu chọn, ghi ADR thay thế, test lại concurrency/restore semantics. Không thêm DO+D1 hybrid chỉ vì có hai sản phẩm.

## ADR-002 - Blob và canonical history

**Chọn baseline:** private R2 cho immutable objects/checkpoint exports, Coordinator active reference là authority duy nhất.

**Cơ sở:** R2 có strong consistency cho object operations; đọc qua custom domain cache có thể vẫn thấy bản cũ. Worker API có conditional put options. Đây không phải transaction bao trùm nhiều objects và control store.

Nguồn: [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/), [Workers API conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

**Suy luận V2.1:** complete generation có manifest/checksum riêng, create-if-absent, active pointer last. Mutable projection chỉ là checkpoint, update bằng conditional write và ordinal cùng generation. Không canonical public bucket/custom-domain cache cho active authority.

## ADR-003 - Runtime read-only thật

**Chọn baseline:** Runtime dùng S3-compatible credentials Object Read only scoped canonical bucket. Không raw/source bucket access hoặc write binding. Command credentials tách.

**Cơ sở:** R2 token docs có Object Read only bucket scope; loại permission này áp dụng S3-compatible API, không Cloudflare REST API.

Nguồn: [R2 authentication and permissions](https://developers.cloudflare.com/r2/api/tokens/).

**Suy luận V2.1:** deny-write được enforce bằng capability và T47, không chỉ interface TypeScript. Chi phí/latency/secret rotation phải benchmark. Nếu adapter khác thay S3, nó phải giữ capability boundary tương đương; thêm read facade chỉ khi giải quyết risk cụ thể, không tự phát.

## ADR-004 - Execution delivery

**Chọn:** direct execution là đơn giản nhất khi bounded; Queue/Workflow theo duration/retry/security need. Domain budgets độc lập.

**Cơ sở:** Cloudflare Queues mặc định at-least-once; delivery ordering không được bảo đảm.

Nguồn: [Queue delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/), [How Queues works](https://developers.cloudflare.com/queues/reference/how-queues-works/).

**Suy luận V2.1:** consumer job idempotency, deadlines, business dedup và out-of-order policies là trách nhiệm ứng dụng. Queue không tự làm exactly-once canonical hay alert. Không chọn Workflow chỉ để tránh viết retry policies.

## ADR-005 - Portability

Giữ core contracts/pure kernels portable; interfaces cho object/control/scheduler; receipts/artifacts/history export có schemas và hashes. Dataset Coordinator là adapter-dependent concurrency boundary, migration provider phải chứng minh primitive mới. Không viết abstraction framework bao mọi Cloudflare API.

V1 chấp nhận correlated provider risk và không active multi-cloud. Offsite restore artifacts và drill tối thiểu phải có theo RPO/RTO production policy. Không hứa cold backup đem lại live uptime.

## ADR-006 - Registry và governance

Default versioned artifacts trong code/release pipeline, kích hoạt riêng tại Coordinator per dataset. Source/Rule registry không unrestricted CMS. Audit/operator commands riêng; Ops read-only. Analytics datastore optional ngoài critical path.

## Ghi chú về thời điểm

Không khóa pricing/quota/plan cụ thể từ trí nhớ. Luồng implementation kiểm tra account entitlements, current official limits/pricing và profile producer trước provisioning. Gói không yêu cầu nâng plan hoặc tạo dịch vụ trả phí.


## A001 - Locator và permission propagation

Đối chiếu thêm [Durable Object ID](https://developers.cloudflare.com/durable-objects/api/id/), [Durable Object namespace](https://developers.cloudflare.com/durable-objects/api/namespace/). Native ID/self identity và registered namespace dùng để kiểm tra correct instance; deterministic name alone không là global authority. V2.1 chọn versioned bootstrap locator artifact và scoped signer/capability, không thêm registry service.

[R2 consistency model](https://developers.cloudflare.com/r2/reference/consistency/) phân biệt strong object operations với eventually consistent IAM permission changes, có thể mất đến một phút. Runbook dùng actual deny probes và bounded propagation evidence trước resume, không extrapolate thời gian này cho mọi credential kind.
