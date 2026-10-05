# LG Internal Sales — System Content & Configurations

> **📌 Trạng thái (cập nhật 05/10/2026, đối chiếu code):** hai file JSON trong thư mục này là **tài liệu tham khảo — ứng dụng KHÔNG đọc chúng** (0 tham chiếu trong `Mau_Dang_Ky_Internal_Sales_3009.html`, `apps-script/Code.gs`, `scripts/build_production.py`). Sửa JSON **không** làm thay đổi gì trên web hay trong email.
>
> | Điểm cần biết | Thực tế trong code |
> |---|---|
> | Tài khoản nhận tiền | Chỉ **1** tài khoản Vietcombank `0991000012525`, viết cứng ở **9 dòng** trong HTML + **2 dòng** trong `Code.gs` (email). Tài khoản Techcombank trong JSON **không** xuất hiện trong ứng dụng (tab "Techcombank" trên web chỉ là hướng dẫn chuyển khoản *từ* app Techcombank) |
> | Chi nhánh | JSON ghi "Tây Hà Nội"; web + email ghi **"Tây Hồ"** — chờ Tài chính xác nhận ([`CURRENT_STATE.md`](../../docs/CURRENT_STATE.md) mục 9) |
> | Cú pháp | JSON `[MãNV]_[MãSlot]`; mã VietQR + email dùng `MãNV MãSlot` (khoảng trắng) — chờ chốt 1 dạng |
> | Vai trò | `system_config.json` chỉ có EMPLOYEE / PM; hệ thống thật có `USER` / `PM` / `ADMIN` |

Thư mục này lưu trữ các tệp tin cấu hình nội dung, tài khoản ngân hàng và chính sách vận hành của Cổng Bán Hàng Nội Bộ LG Electronics Việt Nam.

---

## 1. Cấu trúc tệp tin nội dung

| Tệp tin | Định dạng | Mô tả nội dung |
|---|---|---|
| **[`bank_accounts.json`](assets/content/bank_accounts.json)** | JSON | Danh sách tài khoản ngân hàng thụ hưởng chính thức của LGEVH (Vietcombank, Techcombank), số tài khoản, chi nhánh, cú pháp chuyển khoản tiêu chuẩn. |
| **[`system_config.json`](assets/content/system_config.json)** | JSON | Cấu hình hệ thống, định nghĩa phân quyền (Employee vs PM), danh sách chương trình mặc định, hạn mức đăng ký mỗi nhân viên. |

---

## 2. Hướng dẫn thay đổi thông tin ngân hàng thụ hưởng

Khi công ty thay đổi số tài khoản hoặc thêm ngân hàng mới:
1. Mở file `assets/content/bank_accounts.json` và cập nhật các trường: `account_number`, `branch`, `account_holder`.
2. *(Cập nhật 05/10/2026 — bước 1 không có tác dụng trên web.)* Việc đổi tài khoản là **thay đổi code**: tìm **mọi** chỗ chứa số tài khoản cũ và tên chi nhánh, không dùng số dòng (số dòng thay đổi theo từng bản sửa):
   ```bash
   grep -n "0991000012525\|Chi nhánh Tây\|Chi Nhánh Tây" Mau_Dang_Ky_Internal_Sales_3009.html apps-script/Code.gs
   ```
   Gồm: ô 01, cửa sổ nộp tiền (VietQR + nút sao chép), hướng dẫn giao dịch, tour, email xác nhận trong `Code.gs`.
3. Sau khi sửa: chạy lại các test ([Runbook §6](../../docs/04-v1-hardening/V1_RELEASE_RUNBOOK.md)), dán lại `Code.gs` + **Deploy phiên bản mới**, build lại `portal.html`. Thay đổi này chạm luồng nộp tiền của nhân viên → cần chủ dự án duyệt.
