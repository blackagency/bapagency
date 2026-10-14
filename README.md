# BAP-Agency

Sổ nội bộ tính **lãi / lỗ** và **cổ tức** theo USD. Giao diện tối, viền bo tròn, màu neon.

Một dự án Cloudflare gồm:

- **Worker** phục vụ API (`/api/*`)
- **Assets** phục vụ giao diện (cùng kiểu Cloudflare Pages)

Đăng nhập: tên **Admin111**. Mật khẩu không nằm trong git. Đặt bằng secret `ADMIN_PASSWORD` trên Cloudflare.

## Công thức

Mỗi phiếu có ngày, tên mục, danh sách cổ phần, nhiều khoản chi và nhiều khoản thu.

- Tổng lãi = tổng tiền thu − tổng tiền chi
- Cổ tức = tổng lãi / số cổ phần
- Lợi nhuận từng người = cổ tức − thu của người đó + chi của người đó

Số dương là tiền người đó được nhận thêm. Số âm là tiền người đó cần đưa ra. Cộng lợi nhuận của mọi người thì về `$0.00`.

Nếu tổng lãi không chia hết từng cent, phần dư được cộng lần lượt cho người đứng trước để sổ vẫn cân.

Ví dụ: An chi `$100`, Bình thu `$300`, 2 cổ phần.

| | Thu | Chi | Cổ tức | Lợi nhuận |
|---|---:|---:|---:|---:|
| An | $0 | $100 | $100 | $200 |
| Bình | $300 | $0 | $100 | -$200 |

Tổng lãi = `$200`. Cổ tức = `$100`.

Ngày mặc định là ngày hiện tại theo `Asia/Ho_Chi_Minh`. Có thể sửa ngày trên phiếu.

## Chạy trên máy này

Phần này chỉ để thử trên Windows. Bạn dùng VPS thì bỏ qua và làm theo mục Cloudflare bằng dashboard.

Cần Node.js 22+.

```powershell
cd C:\Users\PC\Desktop\TTVoi
npm install
copy .dev.vars.example .dev.vars
```

Sửa `.dev.vars` (file này không được commit):

```text
ADMIN_PASSWORD=mat-khau-ban-tu-dat
SESSION_SECRET=chuoi-ngau-nhien-it-nhat-32-ky-tu
```

Tạo database local và mở app:

```powershell
npm run db:migrate:local
npm run dev
```

Mở `http://localhost:5173`, đăng nhập `Admin111` và mật khẩu trong `.dev.vars`.

Trên Windows, nếu `wrangler` báo lỗi workerd / VC++ Redistributable, cài [VC++ Redistributable mới nhất](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist) rồi chạy lại.

Kiểm tra công thức:

```powershell
npm test
```

## Cách dùng

1. Nhập **ngày** và **tên mục**.
2. Nhập **số cổ phần**. 2 cổ phần có 2 ô tên, 3 cổ phần có 3 ô, tối đa 30.
3. Thêm khoản **Chi**: số USD và ai chi. Thêm khoản **Thu**: số USD và ai thu. Có thể thêm nhiều dòng. Tiền dùng dấu chấm (`1250.50`) hoặc dấu phẩy thập phân (`1250,50`).
4. Bảng bên phải tính ngay tổng thu, tổng chi, tổng lãi, cổ tức và lợi nhuận từng người.
5. Bấm **Lưu phiếu**. Phiếu nằm trong sổ, mở lại để sửa hoặc xóa.

## Đưa code lên GitHub bằng trình duyệt

Repo: https://github.com/blackagency/bapagency

Đăng nhập đúng tài khoản GitHub có quyền ghi repo này.

1. Mở repo → **Add file** → **Upload files**.
2. Kéo thả toàn bộ file trong gói `BAP-Agency-upload.zip` sau khi giải nén. Gói này không có `node_modules`, `.git`, `.dev.vars`.
3. Bấm **Commit changes**.

## Cloudflare bằng dashboard

Dùng tài khoản Cloudflare của bạn. Địa chỉ `bapagency.hnmv210595.workers.dev` thuộc tài khoản khác trên máy Windows, không dùng địa chỉ đó.

1. Vào [Cloudflare Dashboard](https://dash.cloudflare.com) → **Storage & databases** → **D1** → **Create**. Đặt tên `bapagency`.
2. Mở database vừa tạo → **Console**. Dán toàn bộ nội dung file `migrations/0001_init.sql` rồi **Execute**.
3. Copy **Database ID**.
4. Trên GitHub, mở `wrangler.toml` → biểu tượng bút chì. Thay dòng `database_id` bằng ID vừa copy. Commit.
5. **Workers & Pages** → **Create** → **Import a repository** → chọn `blackagency/bapagency`.
6. Build command: `npm ci && npm run build`. Deploy command: `npx wrangler deploy`. Nhánh `main`.
7. Worker `bapagency` → **Settings** → **Variables and Secrets** → **Add** → bật **Encrypt**:
   - `ADMIN_PASSWORD` = mật khẩu bạn tự đặt
   - `SESSION_SECRET` = một chuỗi ngẫu nhiên dài
8. **Deployments** → **Retry deployment** nếu lần build đầu chạy trước khi sửa `database_id` hoặc thêm secret.
9. Mở địa chỉ `*.workers.dev` trên trang Worker. Đăng nhập `Admin111` và mật khẩu vừa đặt.

Gắn tên miền: **Settings** → **Domains & Routes** → **Add custom domain**.

## Biến môi trường

| Tên | Loại | Ý nghĩa |
|---|---|---|
| `ADMIN_USERNAME` | var | Mặc định `Admin111` |
| `ADMIN_PASSWORD` | secret | Mật khẩu đăng nhập |
| `SESSION_SECRET` | secret | Ký session, ít nhất 32 ký tự |
| `SESSION_TTL_HOURS` | var | Thời hạn đăng nhập, mặc định 24 |
| `TIMEZONE` | var | `Asia/Ho_Chi_Minh` |
| `CURRENCY` | var | `USD` |

Session nằm trong cookie `HttpOnly`. Mật khẩu không lưu trong database và không lưu trong trình duyệt ngoài cookie phiên.
