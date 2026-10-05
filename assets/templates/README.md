# LG Internal Sales — System Templates Directory

> **📌 Trạng thái (cập nhật 05/10/2026, đối chiếu code):**
> - Nút tải file mẫu trên web dùng **bản nhúng sẵn** trong HTML (biến `b64Data` trong `downloadExcelTemplate()`), **không** đọc file trong thư mục này. Sửa file ở đây mà không nhúng lại thì web vẫn tải bản cũ.
> - `assets/templates/Mau_Danh_Muc_San_Pham_Internal_Sales.xlsx` và `data/Mau_Danh_Muc_San_Pham_Internal_Sales.xlsx` hiện **khác nhau** (khác mã băm MD5). Chưa xác định bản nào khớp bản nhúng — PM kiểm tra trước khi dùng làm chuẩn.
> - `parseExcelCatalog()` nhận diện cột **theo tên tiêu đề**, không theo vị trí, nên nhận cả mẫu 7 cột bên dưới lẫn file kiểm kê kho của PM (No, CAT, W/H, Model, Serial, NOTE, Grade, MRP, D/C, Selling price). Thứ tự "Cột 1…7" bên dưới chỉ là gợi ý.
> - CSDL thật có **8 tab** do `setupNewDatabase()` tạo — danh sách tab chuẩn xem [`docs/CURRENT_STATE.md`](../../docs/CURRENT_STATE.md) mục 8; danh sách 8 sheet ghi ở bảng dưới là của file Excel mẫu cũ.

Thư mục này lưu trữ toàn bộ các tệp tin mẫu (Templates) chính thức của Cổng Bán Hàng Nội Bộ LG Electronics Việt Nam (LGEVH).

---

## 1. Danh sách tệp tin mẫu

| Tệp tin | Định dạng | Mục đích sử dụng | Vị trí áp dụng trong Web |
|---|---|---|---|
| **[`Mau_Danh_Muc_San_Pham_Internal_Sales.xlsx`](assets/templates/Mau_Danh_Muc_San_Pham_Internal_Sales.xlsx)** | `.xlsx` | File mẫu danh mục sản phẩm để PM điền và nạp vào hệ thống khi tạo đợt bán mới. | Modal *Tạo chương trình bán hàng mới* & Modal *Nạp sản phẩm từ Excel*. |
| **[`LG_Internal_Sales_Master_Database.xlsx`](assets/templates/LG_Internal_Sales_Master_Database.xlsx)** | `.xlsx` | Bảng tính cơ sở dữ liệu mẫu đầy đủ 8 sheets (Dashboard, PM xử lý, Registrations, Slots, Divisions, Config, ActivityLog, AutoEmail) kèm công thức tự động. | Dùng làm Google Sheet Backend đồng bộ với Google Apps Script. |

---

## 2. Hướng dẫn chỉnh sửa & cập nhật `Mau_Danh_Muc_San_Pham_Internal_Sales.xlsx`

Khi cần thêm các trường thông tin hoặc cập nhật danh mục mẫu:
1. Mở file bằng Microsoft Excel, Google Sheets hoặc LibreOffice.
2. Cấu trúc sheet bắt buộc phải có tên là `Slots` (hoặc `Products`, `Danh mục`, `Sản phẩm`).
3. Các cột tiêu chuẩn được thuật toán `parseExcelCatalog` tự động nhận diện:
   * **Cột 1: `WH (Kho)`** — Mã kho hàng (VD: `AYC`, `AYA`, `AYB`).
   * **Cột 2: `Slot ID`** — Mã định danh duy nhất của từng suất máy (VD: `HA-001`, `#001`).
   * **Cột 3: `Model`** — Mã sản phẩm chính xác của LG (VD: `GR-X257BG`, `WT1410NHEG`).
   * **Cột 4: `Ngành hàng`** — Phân loại thiết bị (`Tủ lạnh`, `Máy giặt`, `Tivi`, `Màn hình`, `Điều hòa`).
   * **Cột 5: `Giá bán (VNĐ)`** — Giá nội bộ ưu đãi dành riêng cho nhân viên LG.
   * **Cột 6: `Giá niêm yết (RRP)`** — Giá bán lẻ tham chiếu trên thị trường.
   * **Cột 7: `Mô tả chi tiết`** — Tên thương mại hoặc thông số nổi bật của model.
4. Header của file luôn tuân thủ chuẩn thương hiệu LG: Nền Đỏ Heritage (`#A50034`), chữ trắng, font Segoe UI / LG EI.

---

## 3. Cách cập nhật vào Cổng Bán Hàng Web

Tệp `Mau_Danh_Muc_San_Pham_Internal_Sales.xlsx` sau khi cập nhật tại thư mục này có thể:
1. Được sao chép sang thư mục `data/` (`cp assets/templates/Mau_Danh_Muc_San_Pham_Internal_Sales.xlsx data/`).
2. Mã hóa Base64 và cập nhật vào biến `b64Data` trong hàm `downloadExcelTemplate()` tại [`Mau_Dang_Ky_Internal_Sales_3009.html`](Mau_Dang_Ky_Internal_Sales_3009.html) để việc tải xuống hoạt động ngay lập tức không phụ thuộc máy chủ.
