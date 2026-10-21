# Website vật tư nông nghiệp · Cửa hàng VTNN

Gian hàng trực tuyến dành cho một cửa hàng vật tư nông nghiệp tại Việt Nam, ưu tiên trải nghiệm điện thoại. Toàn bộ thương hiệu, logo, banner, địa chỉ, liên hệ, chính sách, sản phẩm, giá, tồn kho, trạng thái đơn và báo cáo được quản lý từ trang Admin.

> **Trạng thái:** Mã nguồn đã có trên GitHub. Chức năng đặt hàng thật cần Netlify, Google Sheets/Apps Script, Google Sign-In, Turnstile và Telegram được cấu hình. Mặc định **tắt nhận đơn**; không có dữ liệu khách hàng giả.

## Thành phần

| Phần | Công nghệ |
|---|---|
| Giao diện cửa hàng `/` | HTML/CSS/JS responsive, không cần build frontend |
| Quản trị `/admin` | Google Sign-In (danh sách email quản trị) |
| API server `/api/*` | Netlify Functions (Node 20) |
| Lưu ảnh | Netlify Blobs qua Functions, có xác thực upload |
| Dữ liệu cửa hàng và đơn | Google Sheets qua Google Apps Script |
| Thông báo | Telegram Bot, hàng đợi xử lý mỗi phút |
| Deploy | GitHub → Netlify tự động khi push nhánh main |

## Tính năng đã xây

- Gian hàng: trang chủ, bộ lọc danh mục, tìm theo tên/hoạt chất, xem sản phẩm và hình, giỏ hàng trong trình duyệt, đặt hàng và liên hệ.
- Admin: cấu hình thương hiệu/SEO/chính sách, upload ảnh, quản lý sản phẩm và giá, kiểm tra sản phẩm được phép kinh doanh, quản lý trạng thái đơn, xem người liên hệ, thống kê và xuất CSV.
- API: xác thực Google ID token, session HttpOnly, chặn write khác origin, kiểm tra Turnstile, chữ ký HMAC với Apps Script, lưu đơn chống trùng và tính lại giá theo dữ liệu server.
- Apps Script: bảng sản phẩm, đơn, lịch sử, tồn kho, audit, hàng đợi Telegram retry.

## Kích hoạt

**Bắt đầu tại [docs/GO_LIVE.md](docs/GO_LIVE.md).** Tài liệu hướng dẫn kết nối Google Sheet, cấu hình Script Properties, deploy Apps Script, liên kết repository với Netlify, thêm các biến môi trường và kiểm thử.

Netlify: **Import existing project → GitHub → `usnho3010-debug/cuahangvtnn` → branch `main` → deploy**. `netlify.toml` đã đặt `publish=public`, `functions=netlify/functions`. Build command để trống, Netlify tự cài dependencies cho Functions.

Các biến môi trường có tên trong [`.env.example`](.env.example). Secret tuyệt đối không lưu trong repo.

## Kiểm thử

GitHub Actions tự chạy `npm run check` và `npm test` trên mỗi lần push lên `main`.

## Trách nhiệm kinh doanh

Thuốc bảo vệ thực vật có điều kiện bán và công bố sản phẩm; cửa hàng phải xác minh pháp lý, điều kiện giao nhận, nhãn và nội dung sản phẩm trước khi bật nhận đơn. Giá web là tiền hàng chưa gồm phí giao, nhân viên xác nhận phí và đơn bằng liên hệ khách. Hỗ trợ thương mại điện tử không thay thế nghĩa vụ pháp lý của cửa hàng.

Repo và tất cả tài khoản nên được đứng tên chủ cửa hàng. Đề xuất đặt repo thành **Private** khi bàn giao.
