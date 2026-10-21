# Checklist triển khai vận hành thật — Netlify + Google Sheets + Telegram

Tài liệu dành cho người triển khai và chủ cửa hàng. Code nằm trên GitHub, máy người dùng không cần cài môi trường build. **Không công khai nhận đơn cho đến khi kiểm thử đầy đủ.**

## 1. Cài Google Sheets và Apps Script

1. Chủ cửa hàng tạo **Google Sheet mới**, cấp quyền biên tập riêng cho người vận hành (không cấp quyền công khai). Vào Extensions → Apps Script và sao chép toàn bộ `backend/apps-script.js` vào tệp `Code.gs`.
2. Vào Project Settings → Script Properties. Tạo `API_SHARED_SECRET`: chuỗi ngẫu nhiên đủ dài, giống hệt biến Netlify; tạo `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` sau khi tạo bot từ BotFather. Bí mật không được đặt trong Sheet, GitHub, URL hay gửi qua tin nhắn. Có thể đặt `SPREADSHEET_ID` nếu dùng Apps Script độc lập thay vì bound script.
3. Từ Apps Script editor chạy hàm `initialize()` một lần bằng tài khoản **chủ sở hữu**. Chấp nhận quyền cần thiết. Kiểm tra có 8 sheet: Settings, Products, Orders, OrderEvents, Contacts, NotificationQueue, StockLedger, AuditLog. Xác nhận trigger `processNotifications` chạy mỗi phút.
4. Vào Deploy → New deployment → Web app: **Execute as Me**, **Who has access: Anyone**. Copy URL `https://script.google.com/macros/s/.../exec` vào biến `APPS_SCRIPT_URL` tại Netlify. Endpoint công khai chỉ xử lý yêu cầu có chữ ký HMAC hợp lệ; chỉ Google Sheets của chủ mới có dữ liệu. Khi cập nhật Apps Script phải tạo deployment version mới và kiểm tra URL.
5. Trong Telegram, nhắn tin cho bot hoặc thêm bot vào nhóm nhân viên, cấp quyền bot gửi tin. Lấy Chat ID theo cách có kiểm soát; test một đơn hàng. Telegram chỉ nhận mã đơn, số mặt hàng và tổng tiền, không tự động gửi toàn bộ số điện thoại/địa chỉ khách.

## 2. Triển khai Netlify qua GitHub (không cần build trên máy)

- Truy cập [Netlify](https://app.netlify.com/start), đăng nhập, chọn **Add new project → Import an existing project → GitHub**.
- Cấp quyền GitHub App Netlify vào repo `usnho3010-debug/cuahangvtnn`, chọn nhánh `main`.
- Build command: **để trống**, Publish directory: **public**, Functions directory: **netlify/functions**. `netlify.toml` đã có sẵn.
- Thêm các Environment Variables trong Site configuration (cấu hình cho cả Functions và mọi deploy context sử dụng): `APPS_SCRIPT_URL`, `API_SHARED_SECRET`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`. Tạo `API_SHARED_SECRET` và `SESSION_SECRET` **khác nhau**. Không đưa giá trị thật vào repo. Với Netlify Blobs, `@netlify/blobs` dùng site identity tự động trong môi trường Netlify.
- Sau khi Netlify cấp domain `https://<site>.netlify.app`, cấu hình Google Cloud Console → Credentials → OAuth Client ID → Web application: **Authorized JavaScript origins** bao gồm chính xác origin này và domain riêng của khách (nếu có). Google Identity dùng để đăng nhập admin; biến `ADMIN_EMAILS` chứa email Google được cấp quyền quản trị, phân tách bằng dấu phẩy.
- Tạo Turnstile widget trên [Cloudflare Turnstile](https://dash.cloudflare.com/), thêm đúng domain .netlify.app/domain riêng, nhập Site Key & Secret Key vào Netlify. **Không tắt Turnstile trên production**.
- Deploy production; kiểm tra `/api/health` trả `{"ok":true,"data":{"status":"up",...}}` và `/api/site` trả cấu hình Google Sheets sau khi kết nối.
- Vào `/admin` bằng email thuộc `ADMIN_EMAILS`. Thiết lập tên, logo, banner, địa chỉ, hotline, Zalo, chính sách, sản phẩm và kiểm duyệt. Tải ảnh từ admin và dán URL sinh ra vào trường ảnh cần dùng.
- Giữ trạng thái **Tắt nhận đơn** cho tới khi hoàn tất các bước nghiệm thu.

## 3. Tiêu chí trước khi bật nhận đơn

- Chủ cửa hàng xác nhận đăng ký kinh doanh, điều kiện buôn bán thuốc BVTV và danh mục từng sản phẩm phù hợp văn bản hiện hành. Các thuốc chưa được duyệt phải để **ẩn**; admin không cho phép hiển thị sản phẩm chưa đánh dấu đã kiểm tra.
- Điền thật: tên, địa chỉ, hotline, phương thức liên hệ, nội dung về chúng tôi, chính sách giao hàng, đổi trả, quyền riêng tư, điều khoản, vùng giao và giá cuối cùng (phí ship phải được xác nhận).
- Thử nhập 2 sản phẩm thật, nhiều ảnh, tìm kiếm/lọc, thêm giỏ, đặt **một** đơn với số điện thoại thật được phép dùng thử. Kiểm tra Google Sheets, mã đơn, Telegram và trang admin.
- Thử nhấn nút đặt hai lần, mạng chập chờn, Turnstile hết hạn, SKU hết tồn, hủy/khôi phục tồn, đơn thành công đưa về trạng thái COMPLETED và thống kê doanh thu chỉ ghi đơn hoàn tất.
- Phân quyền: tài khoản Google không trong `ADMIN_EMAILS` bị từ chối cả giao diện/admin API.
- Thử sao lưu và khôi phục Google Sheets, quyền truy cập repo, báo cáo lỗi, dung lượng/credits Netlify. Cân nhắc chuyển repo từ Public sang **Private** vì đây là website khách hàng; giữ secrets ngoài repo trong cả hai trường hợp.
- Bật `ordersEnabled` ở Cấu hình cửa hàng; xác nhận API tạo đơn còn hoạt động sau đợt deploy cuối cùng.

## 4. Giới hạn phiên bản đầu và vận hành

- Website chạy thật nhưng số đơn lớn cần chuyển database giao dịch chuyên dụng (ví dụ PostgreSQL) vì Google Sheets/Apps Script có quotas, khóa ghi và timeout. Không coi Sheet là hệ thống kho đa chi nhánh.
- Chỉ một cửa hàng, quản trị 1–3 người, định giá VNĐ, COD/đặt hàng xác nhận thủ công. Hệ thống lưu **tiền hàng**, phí giao được cửa hàng báo sau. Không có xử lý thanh toán tự động, hóa đơn điện tử hay giao vận hóa chất tự động.
- Ảnh dùng **Netlify Blobs** nên có mức sử dụng/credits và có thể có phí khi vượt hạn mức. Ảnh cũng cần sao lưu riêng nếu chuyển nền tảng.
- Telegram gửi bằng trigger Apps Script khoảng mỗi phút; có thể trễ/ gửi lặp khi mất mạng, còn đơn vẫn lưu trong Sheet. Kiểm tra hàng đợi NotificationQueue thường xuyên, đặc biệt khi bot token, nhóm chat thay đổi hoặc trigger ngừng hoạt động.
- Cập nhật source trên GitHub có thể tự kích hoạt Netlify deploy khi đã kết nối Git. Không cần clone hoặc cài Node trên máy chủ cửa hàng.

## 5. Khi chưa kết nối hạ tầng

Website hiển thị giao diện trung tính; không tạo danh mục, sản phẩm, dữ liệu đơn giả. API trả lỗi rõ khi Sheets, Google login hoặc Turnstile chưa được cấu hình. Đây là trạng thái triển khai chưa hoàn thành, **không được thông báo là đã mở bán thực tế**.
