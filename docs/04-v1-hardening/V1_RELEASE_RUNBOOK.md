# SỔ TAY TRIỂN KHAI & KHÔI PHỤC BẢN V1
### V1 Release Runbook — dành cho Admin / PIC (và PM cho mục 4)

| Mục | Giá trị |
|---|---|
| Ngày lập | 05/10/2026 |
| Áp dụng cho | Nhánh git `v1-hardening` (đã duyệt cả 5 gói P, A, B, C, D+E) |
| Mốc go-live | 10:00, 14/10/2026 |
| Tài liệu liên quan | [`V1_HARDENING_CHANGE_PROPOSAL.md`](V1_HARDENING_CHANGE_PROPOSAL.md) — lý do & bằng chứng của từng thay đổi |

> Quy tắc vàng: **làm trên STAGING trước, chính thức sau**. Mọi bước dưới đây đều có đường lùi ở mục 1.

---

## 0. Thay đổi này ảnh hưởng ai?

| Vai trò | Thay đổi nhìn thấy | Việc phải làm |
|---|---|---|
| **Nhân viên** | Mở **link chính thức** là đăng nhập được ngay (không cấu hình gì) · Danh mục và ô "03 Đơn Hàng Của Bạn" hiện đúng dữ liệu máy chủ · "Hủy giữ chỗ" có hiệu lực thật (chỉ trước khi khai nộp tiền) · Máy chủ chậm → thấy "Đang kết nối máy chủ…" + nút **Thử lại** | Đăng nhập lại 1 lần sau khi Admin đổi khóa phiên |
| **PM** | Nút **Email tự động BẬT/TẮT** trên Bảng điều khiển PM · "Duyệt hàng loạt" báo đúng số đơn máy chủ đã duyệt | Đăng nhập lại 1 lần |
| **Admin / PIC** | Hàm mới `rotateSessionSecret()` · `setupNewDatabase()` từ chối chạy đè dữ liệu · Script Property `SPREADSHEET_ID` cho staging · script `scripts/build_production.py` | Làm theo mục 2 → 3 |

---

## 1. ĐIỂM KHÔI PHỤC (đã tạo ngày 05/10/2026)

| Thành phần | Điểm khôi phục | Cách quay lại |
|---|---|---|
| Mã nguồn (web + Code.gs) | Git tag **`checkpoint-pre-v1-hardening-20261005`** (commit `5404e1a`) và nhánh **`backup/pre-v1-hardening-20261005`** | `git checkout checkpoint-pre-v1-hardening-20261005 -- Mau_Dang_Ky_Internal_Sales_3009.html apps-script/Code.gs` rồi commit; hoặc quay hẳn: `git switch main` (main chưa bị sửa) |
| Dữ liệu Google Sheet | Bản sao **"LG Internal Sales Database - BACKUP 2026-10-05 (pre-v1-hardening) - KHONG SUA"** (ID `1WIUrSzTYxqKKtt5RbJ2bF2xZiZRVpXC_pxFdpQQ9lL4`, riêng tư) | Sao chép dữ liệu từ bản backup sang Sheet chính (không xóa Sheet chính) |
| Apps Script đang chạy | Phiên bản (Version) hiện tại trong **Deploy → Manage deployments** | Trước khi deploy: **ghi lại số Version đang chạy**. Muốn quay lại: Manage deployments → ✏️ Edit → chọn Version cũ → Deploy (URL giữ nguyên) |

> Bản sao Sheet là ảnh chụp lúc 05/10. Dữ liệu phát sinh sau đó **không** có trong backup — trước khi go-live nên tạo thêm 1 bản sao mới (File → Make a copy).

---

## 2. STAGING — chạy thử trên bản sao trước (đã được duyệt)

Sheet staging đã tạo sẵn: **"LG Internal Sales Database - STAGING (test tai v1-hardening)"** — ID `1v8HIX9cqcwYTv_avwTSvRoX2FSd1MK-m5GLPhWIDxmU` (riêng tư).

1. Vào https://script.google.com → **Dự án mới** → đặt tên `LG Internal Sales API — STAGING`.
2. Dán toàn bộ `apps-script/Code.gs` (nhánh `v1-hardening`) → Lưu.
3. ⚙️ **Project Settings → Script Properties → Add property**: `SPREADSHEET_ID` = `1v8HIX9cqcwYTv_avwTSvRoX2FSd1MK-m5GLPhWIDxmU`.
   *(Code mới ưu tiên Script Property này, nên không phải sửa dòng 21 trong code.)*
4. Chọn hàm **`rotateSessionSecret`** → **Run** → cấp quyền.
5. **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → copy URL `/exec`.
6. Trong Sheet staging: tab `Users` thêm 3–5 tài khoản test (ví dụ `VH90001`…), tab `Products` có ít nhất 1 slot `Available`.
7. Chạy kiểm thử trên máy tính:
   ```bash
   python3 tests/staging_smoke_test.py --url <URL_STAGING> --program <MÃ_CHƯƠNG_TRÌNH> \
     --users VH90001:mk1,VH90002:mk2,VH90003:mk3 --slot <MÃ_SLOT_AVAILABLE> --load-rps 20 --load-seconds 30
   ```
   Kết quả phải là **ĐẠT**. Script in luôn **nhịp polling đề xuất (10 hay 15 giây)** từ thời gian phản hồi đo được.
8. Nếu muốn thử bằng tài khoản demo trên staging: thêm dòng `ALLOW_DEMO_TOKENS | true` vào tab `Config` **của staging**. Tuyệt đối **không** thêm vào bản chính thức.

---

## 3. TRIỂN KHAI BẢN CHÍNH THỨC

> Chỉ làm khi mục 2 **ĐẠT**. Trình tự quan trọng — làm đúng thứ tự.

| # | Việc | Chi tiết | Kiểm tra |
|---|---|---|---|
| 1 | Tạo backup mới của Sheet chính | File → Make a copy | Có file backup mới, riêng tư |
| 2 | Ghi lại Version Apps Script đang chạy | Deploy → Manage deployments | Đã ghi số Version |
| 3 | Dán `Code.gs` mới vào **dự án Apps Script đang chạy** | Thay toàn bộ → Lưu | Không báo lỗi cú pháp |
| 4 | Chạy **`rotateSessionSecret`** 1 lần | Chọn hàm → Run | Execution log: "Đã thay khóa ký phiên đăng nhập" |
| 5 | Deploy **phiên bản mới trên deployment cũ** | Manage deployments → ✏️ Edit → Version: **New version** → Deploy | **URL `/exec` không đổi** |
| 6 | Kiểm tra tab `Config` | Không có `ALLOW_DEMO_TOKENS` (hoặc = `false`) · `ENABLE_AUTO_EMAIL` theo quyết định (mục 4) | — |
| 7 | Sinh bản cho nhân viên | `python3 scripts/build_production.py --api-url <URL /exec chính thức>` → tạo `portal.html` | Script in "Kiểm tra: không còn mật khẩu demo…" |
| 8 | Đưa `portal.html` lên GitHub Pages | Commit `portal.html` → push (sau khi chủ dự án duyệt) | Link: `https://gobitangocbao.github.io/lg-internal-sales-portal/portal.html` |
| 9 | Nạp danh sách nhân viên thật vào tab `Users` | Sheet đã ở chế độ **Restricted** (05/10) | Chỉ Admin/HR có quyền |
| 10 | Kiểm tra cuối | Mở `portal.html` ở cửa sổ ẩn danh → đăng nhập 1 tài khoản thật → thấy danh mục; thử `VH12345/test123` → **bị từ chối** | Cả hai đúng |

**Bản demo** (`Mau_Dang_Ky_Internal_Sales_3009.html`, `index.html`) giữ nguyên để đào tạo. Việc đổi `index.html` trỏ sang `portal.html` là **quyết định của chủ dự án**, chưa thực hiện.

---

## 4. CÔNG TẮC EMAIL TỰ ĐỘNG (PM & Admin)

**Vị trí:** Bảng Điều Khiển PM → thanh nút phía trên → nút **"Email tự động [BẬT | TẮT]"**.

| Trạng thái | Nghĩa | Khi nào dùng |
|---|---|---|
| **BẬT** (nhãn xanh) | Hệ thống gửi email thật tới nhân viên khi: giữ chỗ, mở cổng thanh toán, duyệt, từ chối, sắp hết hạn, hết hạn 24h | Khi còn hạn mức email trong ngày |
| **TẮT** (nhãn xám) | Không gửi email thật. Vẫn ghi nhật ký vào tab `AutoEmail` với nhãn `[SIMULATED]` | Khi gần chạm hạn mức, hoặc muốn thông báo qua Teams/Zalo thay thế |

- Bấm nút → hộp xác nhận → **có hiệu lực ngay** (không chờ cache).
- Rê chuột lên nút để xem **số email còn được gửi hôm nay** (Google cung cấp).
- Mọi lần đổi được ghi vào tab `ActivityLog` (hành động `EMAIL_SETTING`, ai đổi, lúc nào).
- Chỉ tài khoản vai trò **PM** đổi được. Nhân viên không thấy nút này.
- Cách dự phòng (không cần web): sửa ô `ENABLE_AUTO_EMAIL` trong tab `Config` thành `true`/`false` (có hiệu lực sau tối đa 5 phút).

**Hạn mức hiện tại:** Apps Script chạy dưới **tài khoản Gmail cá nhân → tối đa 100 email/ngày** ([nguồn Google](https://developers.google.com/apps-script/guides/services/quotas)). Ngày mở bán dự kiến ~180 email. Khi chạm hạn mức, hệ thống tự ngừng gửi 1 giờ và **đơn hàng vẫn xử lý bình thường**.

**Khi nâng cấp lên LG Workspace (1.500 email/ngày):** tạo lại dự án Apps Script dưới tài khoản Workspace, làm lại mục 3 (bước 3–7) với URL mới, rồi build lại `portal.html` bằng URL mới.

---

## 5. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| Nhân viên thấy "Đang kết nối máy chủ…" | Máy chủ Google chậm (thường vài phút đầu mở bán) | Trang tự thử lại sau 15 giây; hoặc bấm **Thử lại ngay**. Nếu mạng công ty chặn → dùng 4G/5G |
| "Phiên đăng nhập không khớp…" / "Chữ ký phiên … không hợp lệ" | Admin vừa đổi khóa phiên, hoặc phiên cũ | Đăng xuất → đăng nhập lại |
| Bấm giữ chỗ → "đã có người đăng ký trước" | Người khác bấm trước vài giây (FCFS) | Màn hình tự cập nhật slot đã hết ngay; chọn sản phẩm khác |
| Nhân viên không hủy được giữ chỗ | Đã khai nộp tiền (quy tắc đã duyệt 05/10) | PM xử lý từ chối / hoàn tiền theo quy trình |
| Lỡ chạy `setupNewDatabase()` trên Sheet chính | — | Hàm tự **dừng**, không xóa gì (log: "DỪNG: Sheet … đã có dữ liệu") |
| Nghi ngờ lộ phiên đăng nhập | — | Chạy `rotateSessionSecret()` → mọi người đăng nhập lại |

---

## 6. Kiểm thử tự động (chạy trên máy tính trước mỗi lần phát hành)

| Lệnh | Kiểm tra gì | Kết quả 05/10/2026 |
|---|---|---|
| `node tests/backend_gas_harness.js` | Chạy **Code.gs thật** với Sheet giả lập: xác thực, giữ chỗ, hủy, mở cổng, watchdog, công tắc email, khóa ghi | **52/52** (bản trước sửa: token giả mạo lọt qua) |
| `python3 tests/cloud_mode_regression.py` | Chạy **trang web thật** với máy chủ giả lập: 7 kịch bản nhân viên, PM, bản production, demo | **25/25** (bản trước sửa: 3/7) |
| `node tests/run_e2e_tests.js` | Bộ kiểm tra cũ (hồi quy) | **164/164** |
| `python3 tests/polling_race_simulation.py` | Mô phỏng rủi ro polling | Xem đề xuất §4 |
| `python3 tests/staging_smoke_test.py …` | Máy chủ **staging thật**: thời gian phản hồi, token giả, FCFS, tải | Chờ deploy staging |
