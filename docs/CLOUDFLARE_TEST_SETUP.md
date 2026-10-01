# Tạo môi trường Cloudflare thử nghiệm

Ngày kiểm tra tài liệu: 2026-10-01. Mã và runner đã sẵn sàng kiểm tra local. Chưa deploy hoặc chạy cloud. Chuẩn bị theo thứ tự dưới đây; không cần tạo Worker hay Durable Object bằng tay.

## 1. Account riêng

Trong đăng nhập Cloudflare hiện có, vào **Accounts → Create Account**, đặt tên **OpenPQ Intelligence Test**. Đây là account mới trong cùng đăng nhập, không yêu cầu email mới. Cloudflare áp dụng điều kiện user hoạt động ít nhất 7 ngày, có Super Administrator ở account hiện tại và giới hạn số account bổ sung. Nếu không thấy nút hoặc gặp giới hạn, gửi tên lỗi để xử lý.

Chọn Workers Free. Trong Workers & Pages, cấu hình subdomain `workers.dev` cho account mới. Không cần tên miền riêng hay DNS. Account này chỉ dành cho thử nghiệm Intelligence; không chuyển ứng dụng cũ sang đây.

Ghi lại Account ID mới và Account ID của **tất cả account production đang dùng cho OpenPQ/JoTrip**. ID là 32 ký tự hex, không phải tên account hay Zone ID. Có thể gửi các ID này trong chat.

Account riêng là lựa chọn triển khai để ngăn token deploy gắn nhầm tài nguyên production: quyền deploy Worker có thể gắn binding đến tài nguyên trong cùng account mà không cần quyền riêng tương ứng. Đổi tên environment trong account production không tạo được ranh giới này.

## 2. Bucket R2

Trong account mới, tạo bucket tên chính xác:

`openpq-intelligence-canonical-isolated-test`

Dùng jurisdiction mặc định, bucket private, không bật public access hoặc lifecycle xóa. Để account này chỉ có bucket trên. Nếu bật R2 yêu cầu xác nhận thanh toán hoặc nâng gói, dừng và báo lại trước khi chấp nhận.

## 3. Hai credentials riêng

Tạo **account-owned token**, không dùng Global API Key hoặc token có quyền nhiều account.

**Token deploy**: Manage Account → Account API Tokens → Create Token. Chọn duy nhất Account ID thử nghiệm và các quyền:

| Quyền | Mục đích |
|---|---|
| Workers Admin | Tạo/deploy ba Worker thử nghiệm và DO, quản lý Worker secrets |
| Account API Tokens Read | Đọc policy thực của chính token deploy và token R2 để preflight |
| Workers R2 Storage Read | Inventory bucket trước khi deploy |
| Account Settings Read | Đọc cấu hình account/subdomain nếu API yêu cầu |

Runner chấp nhận `Workers Scripts Edit` trong dashboard và tên tương đương `Workers Scripts Write` do API trả về; `Workers Scripts Read` đi kèm cũng được phép trên đúng account thử nghiệm. Nếu UI chỉ hiện tên khác hoặc preflight báo thiếu quyền, gửi tên permission/error; kiểm tra lại contract trước khi thay đổi. Không cấp All Accounts, DNS/Zone, Account API Tokens Write hoặc R2 write cho token deploy. Ghi token vào GitHub secret bên dưới.

**Credential Runtime**: R2 → Manage R2 API Tokens → Create **Account API Token**, chọn **Object Read only**, chỉ bucket vừa tạo. Lưu Access Key ID và Secret Access Key vào hai GitHub secrets. Secret chỉ hiển thị lúc tạo. Không chọn Object Read & Write hay Admin Read & Write.

## 4. GitHub environment

Repo: https://github.com/kenzuko/openpq-intelligence

Vào **Settings → Environments → New environment**, tên `intelligence-test`. Thêm Environment secrets:

| Secret | Giá trị |
|---|---|
| `CF_TEST_ACCOUNT_ID` | Account ID mới |
| `CF_TEST_API_TOKEN` | Token deploy account-owned |
| `R2_TEST_READ_ACCESS_KEY_ID` | Access Key ID của credential Object Read only |
| `R2_TEST_READ_SECRET_ACCESS_KEY` | Secret Access Key của credential Object Read only |

Thêm Environment variable `CF_PRODUCTION_ACCOUNT_IDS`: JSON array chứa toàn bộ Account ID production, ví dụ `["0123456789abcdef0123456789abcdef"]`. Không để trống, không dùng ID ví dụ và không thêm Account ID thử nghiệm vào array.

Credentials đi thẳng vào GitHub environment; không gửi token hoặc secret trong chat. Chỉ cần báo đã tạo xong và gửi Account IDs để đối chiếu.

## 5. Chạy thử

Sau khi workflow nằm trên main và CI xanh, vào **Actions → Isolated Cloudflare protocol proof → Run workflow**, chọn main. Không cần kết nối Cloudflare Workers Builds với GitHub.

Preflight là read-only và phải qua trước lần write Cloudflare đầu tiên. Runner tự tạo:

- `openpq-intelligence-core-isolated-test`
- `openpq-intelligence-runtime-isolated-test`
- `openpq-intelligence-operator-isolated-test`
- Namespace SQLite DO thuộc Core, được ghim bằng ID thực.

Mỗi lần chạy tạo dataset fixture/generation/signer mới; dữ liệu cũ trong namespace/bucket được giữ lại. Ba Worker dùng tên cố định và sẽ được redeploy, nên chỉ chạy trên account thử nghiệm chuyên dụng, không dùng cho người dùng thật. Runner không xóa tài nguyên sau test; credential/quota/account vẫn do chủ account quản lý.

Tải artifact `intelligence-isolated-evidence-<run-id>` để xem kết quả đã loại secrets. Nếu thành công, đó là proof một phần giao thức trên cloud. G1, recovery IAM và các gate domain/production vẫn cần evidence còn lại theo `CLOUD_PROOF.md`.

## Nguồn chính thức

- Account bổ sung: https://developers.cloudflare.com/fundamentals/account/create-account/
- Account-owned token: https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/
- R2 credentials: https://developers.cloudflare.com/r2/api/tokens/
- Workers roles/binding permissions: https://developers.cloudflare.com/workers/authorization/workers/
- workers.dev: https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- SQLite DO pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- R2 consistency/revocation: https://developers.cloudflare.com/r2/reference/consistency/
