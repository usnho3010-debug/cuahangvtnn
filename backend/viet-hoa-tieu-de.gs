/**
 * Việt hóa dòng tiêu đề của 8 bảng Google Sheets đang dùng.
 *
 * CÁCH DÙNG:
 * 1. Mở Google Sheets -> Tiện ích -> Apps Script.
 * 2. Tạo tệp tập lệnh mới (ví dụ: VietHoaTieuDe.gs), dán toàn bộ mã này.
 * 3. Chọn hàm vietHoaTieuDe và bấm Chạy một lần.
 *
 * Chỉ thay đổi các ô ở HÀNG 1 và định dạng hàng tiêu đề.
 * Giữ nguyên tên 8 tab và dữ liệu/khóa nội bộ để không làm lỗi website.
 * Không cần triển khai lại Apps Script Web App hoặc Netlify.
 */
function vietHoaTieuDe() {
  const tieuDe = {
    Settings: [
      'Tên trường cấu hình', 'Giá trị'
    ],
    Products: [
      'Mã sản phẩm', 'Mã SKU', 'Tên sản phẩm', 'Danh mục',
      'Thương hiệu', 'Thành phần', 'Quy cách đóng gói', 'Mô tả',
      'Hướng dẫn an toàn', 'Số đăng ký', 'Giá bán (VNĐ)', 'Số lượng tồn',
      'Đang hiển thị', 'Đã kiểm duyệt', 'Sản phẩm nổi bật', 'Hình ảnh',
      'Ngày tạo', 'Ngày cập nhật'
    ],
    Orders: [
      'Mã đơn hàng', 'Ngày đặt hàng', 'Tên khách hàng', 'Số điện thoại',
      'Địa chỉ nhận hàng', 'Khu vực', 'Ghi chú', 'Danh sách sản phẩm',
      'Tiền hàng (VNĐ)', 'Phí vận chuyển', 'Tổng tiền (VNĐ)', 'Trạng thái',
      'Mã chống tạo đơn trùng', 'Thời điểm đồng ý', 'Ngày cập nhật'
    ],
    OrderEvents: [
      'Mã sự kiện', 'Mã đơn hàng', 'Trạng thái trước', 'Trạng thái sau',
      'Người thực hiện', 'Ghi chú', 'Thời gian'
    ],
    Contacts: [
      'Mã liên hệ', 'Ngày gửi', 'Họ và tên', 'Số điện thoại',
      'Nội dung tư vấn', 'Trạng thái', 'Thời điểm đồng ý'
    ],
    NotificationQueue: [
      'Mã thông báo', 'Mã đơn hàng/liên hệ', 'Nội dung thông báo',
      'Số lần thử gửi', 'Thời gian thử lại', 'Trạng thái gửi', 'Chi tiết lỗi'
    ],
    StockLedger: [
      'Mã giao dịch kho', 'Mã SKU', 'Số lượng thay đổi', 'Lý do',
      'Mã đơn hàng', 'Người thực hiện', 'Thời gian'
    ],
    AuditLog: [
      'Mã nhật ký', 'Người thao tác', 'Hành động', 'Đối tượng', 'Thời gian'
    ]
  };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Hãy chạy mã từ Apps Script liên kết với Google Sheets.');
  const thieuTab = Object.keys(tieuDe).filter(ten => !ss.getSheetByName(ten));
  if (thieuTab.length) {
    throw new Error('Chưa có các trang tính: ' + thieuTab.join(', ') + '. Hãy chạy initialize() trước.');
  }

  Object.keys(tieuDe).forEach(ten => {
    const sh = ss.getSheetByName(ten);
    const nhan = tieuDe[ten];
    const header = sh.getRange(1, 1, 1, nhan.length);
    header.setValues([nhan]);
    header.setFontWeight('bold');
    header.setBackground('#dcefe5');
    header.setFontColor('#164f37');
    header.setWrap(true);
    header.setVerticalAlignment('middle');
    sh.setRowHeight(1, 44);
    sh.setFrozenRows(1);
  });
  SpreadsheetApp.flush();
  const result = 'Đã Việt hóa tiêu đề cột của ' + Object.keys(tieuDe).length + ' bảng.';
  Logger.log(result);
  return result;
}
