# Nối trang đăng ký với Google Sheet (Apps Script)

Mục tiêu: nhân viên bấm Gửi ở Tab 2 (đăng ký) và Tab 3 (khai nộp tiền) thì dữ liệu tự ghi vào sheet **LG Internal Sales Database**.

## Script làm gì (Kiến trúc v8 - Cập nhật 01/10/2026)
- **Đăng ký giữ chỗ (Tab 2):** Thêm 1 dòng vào `Registrations`, trạng thái ban đầu là **`Đã đăng ký - Chờ mở thanh toán`**. Giờ Timestamp lấy theo máy chủ Google (GMT+7). Đơn được giữ chỗ FCFS nhưng chưa được nộp tiền cho đến khi PM mở cổng.
- **Mở cổng thanh toán (PM Action):** Khi PM bấm `🔓 Mở cổng thanh toán`, các đơn đăng ký trước đó chuyển sang **`Chờ nộp tiền`**, kích hoạt đồng hồ đếm ngược 24h và gửi email thông báo `PAYMENT_GATE_OPENED`.
- **Khai nộp tiền (Tab 3):** Tìm đơn theo Slot và Mã NV, ghi nhận chứng từ/mã GD, chuyển trạng thái sang **`Đã khai nộp - chờ đối soát`**. File biên lai (ảnh nén tự động < 300KB) được lưu vào Drive.
- **Hệ thống Email Tự động:** Hỗ trợ MailApp gửi email thương hiệu chuẩn LG V5.2 (`REGISTRATION_CONFIRM`, `PAYMENT_GATE_OPENED`, `PAYMENT_APPROVED`, `PAYMENT_REJECTED`, `EXPIRATION_WARNING`, `EXPIRATION_ALERT`).
- **Nhật ký:** Mọi lần gửi đều ghi thêm 1 dòng vào `ActivityLog`.

**Chặn trùng slot & FCFS:** Khóa `LockService` (tối đa 30s) đảm bảo dù hàng trăm người cùng bấm đăng ký một lúc, chỉ 1 người nhanh nhất giữ được slot. Khi PM đổi trạng thái sang `Hủy` hoặc `Từ chối`, slot được tự động mở lại cho người khác.

## Hai Chế Độ Vận Hành (Operating Modes)
1. **Chế độ Mô phỏng / Offline (Local Demo Mode):**
   - Đang hoạt động mặc định khi chạy cục bộ trên máy tính (`http://127.0.0.1:8088/Mau_Dang_Ky_Internal_Sales_3009.html`).
   - Tự động nạp tài khoản demo (`VH88921`, `VH12345`), tự lưu trữ trạng thái đổi mật khẩu và đơn đăng ký vào `localStorage` bền vững.
   - **Người dùng và AI có thể Roleplay, kiểm thử toàn bộ tính năng 100% mà không cần kết nối mạng hay thao tác gì trên Google Sheet.**
2. **Chế độ Chạy Thật Trực Tuyến (Cloud Production Mode):**
   - Đòi hỏi Admin thực hiện 3 bước triển khai (Deploy) thủ công trên Google Apps Script liên kết với sheet `LG_Internal_Sales_Database` (hướng dẫn bên dưới).

## Cài đặt và Triển khai (Apps Script Web App 1-Click Tự Động)
> Xem cẩm nang chi tiết dành cho AI Agents và PIC: [docs/01-setup-and-deployment/AGENT_GUIDE_AUTO_SETUP_SHEET.md](docs/01-setup-and-deployment/AGENT_GUIDE_AUTO_SETUP_SHEET.md)

1. Mở trình duyệt, truy cập `https://script.google.com` và tạo một **Dự án mới (New project)**.
2. Dán toàn bộ mã nguồn từ file [apps-script/Code.gs](apps-script/Code.gs) vào trình soạn thảo. Bấm **Lưu (Ctrl+S / Cmd+S)**.
3. Ở ô chọn hàm trên thanh công cụ, chọn hàm:
   👉 **`setupNewDatabase`** rồi bấm **Chạy (Run)**.
   - Google sẽ yêu cầu cấp quyền truy cập Drive và Spreadsheet. Bấm **Xem lại quyền → Nâng cao → Cho phép**.
   - Script sẽ **tự động tạo một Google Sheet mới trên Drive cá nhân của bạn** tên `LG Internal Sales Database` với đầy đủ 8 sheet và định dạng tiêu chuẩn.
4. Copy mã `SPREADSHEET_ID` vừa in ra ở cửa sổ Execution Log, dán vào dòng 21 `Code.gs`:
   `var SPREADSHEET_ID = '<DÁN_MÃ_TẠI_ĐÂY>';` và bấm **Lưu**.
5. Bấm **Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment)**:
   - Loại (Type): **Ứng dụng web (Web app)**.
   - Thực thi dưới danh nghĩa (Execute as): **Tôi (Me)** (`user@lge.com`).
   - Ai có quyền truy cập (Who has access): **Bất kỳ ai (Anyone)**.
   - Bấm **Triển khai**, rồi sao chép **URL ứng dụng web** (kết thúc bằng `/exec`).
6. Mở Cổng thông tin [Mau_Dang_Ky_Internal_Sales_3009.html](Mau_Dang_Ky_Internal_Sales_3009.html), nhấp vào huy hiệu **`⚪ Demo Mode (Offline)`** ở góc trên bên phải (hoặc nút **`Cấu hình API`** trong Tab PM), dán Web App URL và bấm **Kiểm Tra & Lưu Cấu Hình**.


## Thiết lập Bộ quét Tự động Giải phóng Slot 24h (Time-driven Trigger)
Để hệ thống tự động kiểm tra và giải phóng các slot giữ chỗ quá hạn 24 giờ cũng như gửi email cảnh báo trước 2 giờ:

- **Cách 1 (1-Click Tự Động Khuyến Nghị):**
  - Tại ô chọn hàm trên thanh công cụ Apps Script, chọn hàm: 👉 **`setupWatchdogTrigger`** và bấm **Chạy (Run)**.
  - Script sẽ tự động xóa các trigger trùng lặp cũ và khởi tạo trigger chạy ngầm hàm `runExpirationWatchdog` mỗi 1 giờ.

- **Cách 2 (Cài đặt thủ công qua giao diện Triggers):**
  1. Trong giao diện Google Apps Script, bấm vào biểu tượng **Kích hoạt (Triggers - Biểu tượng đồng hồ ở thanh menu trái)**.
  2. Bấm nút **+ Thêm trình kích hoạt (+ Add Trigger)** ở góc dưới bên phải:
     - Chọn hàm muốn chạy: `runExpirationWatchdog`.
     - Chọn bản triển khai: `Head`.
     - Chọn nguồn sự kiện: **Theo thời gian (Time-driven)**.
     - Chọn loại trình kích hoạt: **Bộ đếm thời gian theo giờ (Hour timer)**.
     - Chọn khoảng thời gian: **Mỗi giờ (Every hour)**.
  3. Bấm **Lưu**. Kể từ thời điểm này, Apps Script sẽ tự động chạy ngầm mỗi 60 phút để giải phóng các slot quá hạn và gửi email cảnh báo.

## Cấu hình Bật/Tắt Gửi Email Tự động (AutoEmail)
- Mặc định, hệ thống chạy ở chế độ mô phỏng an toàn: ghi nhận lịch sử vào sheet `AutoEmail` với trạng thái `[SIMULATED]`.
- Khi sẵn sàng Go-Live gửi email thật tới hộp thư `@lge.com` của nhân viên:
  - Mở sheet `Config`.
  - Tìm khóa `ENABLE_AUTO_EMAIL` và đổi giá trị thành `true`.
  - Hệ thống sẽ gửi email thật qua `MailApp` với template chuẩn nhận diện thương hiệu LG V5.2.
- **Cập nhật v1 (05/10/2026):** PM bật/tắt ngay trên web bằng nút **"Email tự động [BẬT/TẮT]"** ở Bảng Điều Khiển PM (có hiệu lực ngay, ghi `ActivityLog`). Tài khoản Gmail cá nhân giới hạn **100 email/ngày**. Xem [`docs/04-v1-hardening/V1_RELEASE_RUNBOOK.md`](../04-v1-hardening/V1_RELEASE_RUNBOOK.md) mục 4.

## Cập nhật bảo mật & vận hành bản v1 (05/10/2026)
- **`rotateSessionSecret()`** — chạy tay 1 lần trước go-live (và khi nghi lộ phiên): thay khóa ký phiên đăng nhập, mọi người đăng nhập lại 1 lần.
- **Không còn chấp nhận token demo** trên máy chủ. Chỉ bản STAGING được bật bằng dòng `ALLOW_DEMO_TOKENS | true` trong tab `Config`.
- **Giữ chỗ / khai nộp tiền / hủy giữ chỗ** bắt buộc phiên đăng nhập của chính nhân viên đó.
- **`setupNewDatabase()`** tự dừng nếu Sheet đã có dữ liệu (không xóa gì). CSDL mới tạo có `ENABLE_AUTO_EMAIL = false`.
- **Script Property `SPREADSHEET_ID`** (Project Settings → Script Properties) được ưu tiên hơn dòng 21 trong code — dùng cho bản STAGING mà không sửa code.
- **Deploy bản mới giữ nguyên URL:** Deploy → Manage deployments → ✏️ Edit → Version: *New version* → Deploy.
- Trình tự đầy đủ, điểm khôi phục và cách quay lại: [`docs/04-v1-hardening/V1_RELEASE_RUNBOOK.md`](../04-v1-hardening/V1_RELEASE_RUNBOOK.md).

## Tính năng Quản lý Mật khẩu (Password Management)
- **Cơ chế xác thực linh hoạt (Dual-Mode Authentication):**
  - **Admin quản trị trực tiếp trên Google Sheet (`Users` tab, Cột B):** Quản lý có thể nhập trực tiếp mật khẩu dạng plaintext (ví dụ: `lgnew2026!`, `admin123`). Người dùng có thể đăng nhập ngay lập tức bằng mật khẩu này.
  - **Người dùng tự đổi mật khẩu trên Portal (User & PM Self-Service):** Khi nhân viên hoặc PM bấm **"Đổi MK"** trên thanh header và cập nhật mật khẩu mới, hệ thống tự động băm an toàn với Salted SHA-256 (`sha256:<salt>:<hash>`) và ghi đè lại vào Google Sheet Cột B.
  - Hàm `verifyPassword_` trên backend tự động nhận diện: nếu chuỗi bắt đầu bằng `sha256:` sẽ kiểm tra theo hàm băm; nếu không, sẽ so khớp trực tiếp dạng văn bản thuần.

## Tính năng Mở cổng Thanh toán (PM Allow Payment Gate)
- **Quy trình kiểm soát rủi ro chuyển khoản nhầm/trùng lặp:**
  - **Đăng ký giữ chỗ (Tab 2):** Nhân viên đăng ký thành công sẽ nhận trạng thái **`Đã đăng ký - Chờ mở thanh toán`**. Slot được giữ chỗ theo nguyên tắc FCFS (ai nhanh hơn giữ trước), nhưng **chưa được phép nộp tiền hay tải biên lai**. Cửa sổ thanh toán tự động không mở lên.
  - **PM duyệt & Mở cổng (Tab 5):** PM vào Dashboard, kiểm tra danh sách đăng ký. Khi PM bấm **`🔓 Mở cổng thanh toán (N)`** (hoặc nút `[🔓 Mở TT]` trên từng đơn lẻ):
    - Tất cả các đơn đã đăng ký *trước thời điểm đó* sẽ chuyển trạng thái sang **`Chờ nộp tiền`**.
    - Đồng hồ đếm ngược giữ chỗ 24h bắt đầu kích hoạt từ thời điểm mở cổng (`payAllowedAt`).
    - Hệ thống tự động gửi email thông báo mở cổng thanh toán (`PAYMENT_GATE_OPENED`) tới nhân viên.
  - **Các đơn đăng ký sau thời điểm PM mở cổng:** Tiếp tục giữ trạng thái `Đã đăng ký - Chờ mở thanh toán` và chờ đến đợt mở cổng tiếp theo của PM.
  - **Lợi ích vận hành:** Giúp PM hoàn toàn chủ động rà soát hạn mức, tránh tình trạng lỗi hệ thống hoặc trùng đơn mà nhân viên đã chuyển tiền qua ngân hàng, gây phức tạp trong việc hoàn tiền đối soát kế toán.

## Rủi ro & Khuyến nghị Bảo mật
- **Bảo mật mật khẩu:** Hệ thống hỗ trợ song song băm một chiều SHA-256 kèm Salt (`LG_VN_INTERNAL_SALES_2026_SALT_`) khi người dùng tự đổi và plaintext khi Admin can thiệp nhanh qua Sheet.
- **Hạn mức Gmail:** Tài khoản Google Workspace doanh nghiệp của LG cho phép gửi tối đa 1.500 email/ngày. Với quy mô chương trình 200–300 nhân viên, hạn mức này hoàn toàn đáp ứng tốt mà không lo chạm ngưỡng.
