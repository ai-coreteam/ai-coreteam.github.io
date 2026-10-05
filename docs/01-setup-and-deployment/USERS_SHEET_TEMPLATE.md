# Google Sheet "Users" — Template Specification

## Tạo trong Spreadsheet: LG Internal Sales Database

Thêm 1 sheet tab mới tên **"Users"** trong Google Sheet CSDL của bạn (hoặc tạo tự động qua hàm `setupNewDatabase()` trong `apps-script/Code.gs`).

## Cấu trúc cột (Row 1 = Header)

| Cột | Header | Kiểu | Bắt buộc | Mô tả |
|-----|--------|------|----------|-------|
| A | **ID** | Text | ✅ | Mã nhân viên (VD: VH12345). Case-insensitive khi đăng nhập |
| B | **Password** | Text | ✅ | Mật khẩu. Hỗ trợ xác thực kép: Plaintext khi Admin nhập trực tiếp trên Sheet, hoặc Salted SHA-256 (`sha256:...`) khi User đổi trên Portal |
| C | **Name** | Text | ✅ | Họ tên đầy đủ (VD: Nguyễn Thị Quỳnh Như) |
| D | **Dept** | Text | ✅ | Bộ phận / Division (VD: HS PM Support). `setupNewDatabase()` ghi tiêu đề là `Department` — tên nào cũng được |
| E | **Phone** | Text | | Số điện thoại (VD: 0912345678) |
| F | **Email** | Text | | Email LG (VD: quynhnhu@lge.com) |
| G | **Role** | Text | ✅ | `USER`, `PM` hoặc `ADMIN` — mặc định `USER` nếu để trống. **`ADMIN`** (từ 05/10/2026): toàn quyền PM trên mọi chương trình + công tắc email; chỉ gán 1–2 người. Xem `docs/04-v1-hardening/V1_RELEASE_RUNBOOK.md` mục 4b |
| H | **Status** | Text | ✅ | `Active` hoặc `Inactive` — chỉ `Active` mới đăng nhập được |

> ⚠️ **(cập nhật 05/10/2026, đối chiếu `Code.gs`)** Máy chủ đọc tab `Users` **theo vị trí cột A→H**, không theo tên tiêu đề. **Không chèn, xóa hay đổi thứ tự cột A–H** — làm vậy sẽ khiến đăng nhập / phân quyền sai hàng loạt. Cần thêm thông tin thì thêm cột **sau cột H**.

## Dữ liệu mẫu (để test)

| ID | Password | Name | Dept | Phone | Email | Role | Status |
|----|----------|------|------|-------|-------|------|--------|
| VH12345 | test123 | Nguyễn Thị Quỳnh Như | HS PM Support | 0912345678 | quynhnhu@lge.com | PM | Active |
| VH88921 | test123 | Trần Văn Nam | Audit & Jeong-Do | 0987654321 | vannam@lge.com | USER | Active |
| VH55432 | test123 | Lê Hoàng Anh | HE Sales Division | 0933445566 | hoanganh@lge.com | USER | Active |
| VH33211 | test123 | Hoàng Minh Trí | HA Production | 0911223344 | minhtri@lge.com | USER | Active |
| VH99120 | test123 | Đặng Thanh Hà | Finance & Accounting | 0955667788 | thanhha@lge.com | USER | Active |
| VH00001 | disabled | Test Inactive | IT Support | 0900000000 | test@lge.com | USER | Inactive |

> ⚠️ **Bài học 05/10/2026:** các địa chỉ `@lge.com` ở bảng trên có thể là hộp thư **thật** của người khác. Trên bất kỳ Sheet nào đang **bật email tự động**, tài khoản test phải dùng email không gửi tới người thật (vd. `ten@example.com`) — hoặc tắt email trước khi test. Danh sách tài khoản demo có trong mã nguồn: [`docs/CURRENT_STATE.md`](../CURRENT_STATE.md) mục 4.

## Hướng dẫn Quản trị & Đổi mật khẩu

### 1. Dành cho Admin (Quản trị viên)
- **Vị trí lưu trữ dữ liệu:** Toàn bộ ID và Password được lưu tập trung tại tab `Users` của Google Sheet cá nhân bạn (`SPREADSHEET_ID: <YOUR_SPREADSHEET_ID>`).
- **Cách Admin đổi/cập nhật mật khẩu:**
  1. Mở file Google Sheet nói trên, chuyển đến tab `Users`.
  2. Tìm dòng chứa Mã nhân viên (Cột A) cần xử lý.
  3. Gõ trực tiếp mật khẩu mới vào ô tương ứng ở **Cột B (Password)**.
  4. Bật/tắt tài khoản: Chỉnh **Cột H (Status)** thành `Active` hoặc `Inactive`.
  5. Phân quyền: Chỉnh **Cột G (Role)** thành `PM` (Quản trị chương trình & duyệt đơn), `USER` (Nhân viên đăng ký) hoặc **`ADMIN`** (từ 05/10/2026: toàn quyền PM trên mọi chương trình + công tắc email; chỉ gán 1–2 người).
  6. *Hiệu lực:* mật khẩu, trạng thái và role được đọc từ Sheet **ở mỗi lần đăng nhập**, không cần build hay deploy lại. Người đang đăng nhập cần **đăng xuất rồi đăng nhập lại** để nhận role mới (phiên cũ còn hiệu lực tối đa 24 giờ trên máy chủ).
  7. ⚠️ **Trước go-live:** xóa hoặc đổi mật khẩu mọi tài khoản dùng mật khẩu mẫu `test123` (mật khẩu này công khai trong repo).

### 2. Dành cho Nhân viên & PM (Tự đổi mật khẩu - Self-Service)
- Người dùng đăng nhập vào hệ thống Internal Sales Portal.
- Tại góc trên bên phải thanh tiêu đề (`#user-bar`), bấm nút **"Đổi MK"** nằm cạnh nút "Đăng xuất".
- Hộp thoại **"Bảo mật tài khoản · Đổi mật khẩu"** hiển thị yêu cầu:
  1. Nhập Mật khẩu hiện tại (Xác thực danh tính).
  2. Nhập Mật khẩu mới (Tối thiểu 6 ký tự).
  3. Xác nhận lại Mật khẩu mới.
- Bấm **"✓ Cập Nhật Mật Khẩu"**:
  - Hệ thống gửi request API `{ action: 'change_password', id, oldPassword, newPassword }` về Google Apps Script.
  - Apps Script kiểm tra mật khẩu cũ, xác thực tính hợp lệ, và tự động ghi đè mật khẩu mới vào Cột B của dòng nhân viên tương ứng trên Google Sheet tab `Users`.
  - Nếu ở chế độ Demo/Offline, mật khẩu được cập nhật ngay trong phiên làm việc local để người dùng có thể đăng nhập bằng mật khẩu mới ngay lập tức.
