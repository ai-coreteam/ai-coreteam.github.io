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
| **PM** | "Duyệt hàng loạt" báo đúng số đơn máy chủ đã duyệt · vẫn chỉ quản lý chương trình của mình | Đăng nhập lại 1 lần |
| **ADMIN** *(role mới, 05/10)* | Toàn bộ chức năng PM trên **mọi chương trình** + nút **Email tự động BẬT/TẮT** (chỉ ADMIN thấy) · thanh người dùng ghi "Admin hệ thống" | Admin gán role trong tab `Users` (mục 4b) |
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
8. *(Tùy chọn — đã quyết định KHÔNG dùng)* Muốn thử bằng tài khoản demo trên staging thì thêm `ALLOW_DEMO_TOKENS | true` vào tab `Config` **của staging**. Ngày 05/10 đã test bằng tài khoản thật nên không bật — staging giống hệt bản chính thức. Tuyệt đối **không** thêm vào bản chính thức.

> ⚠️ **Trước khi test giữ chỗ trên staging: TẮT email tự động của staging.** Hạn mức 100 email/ngày tính theo **tài khoản Google**, staging và bản chính thức **dùng chung**. Ngày 05/10, 4 lượt giữ chỗ thử đã gửi email xác nhận tới địa chỉ mẫu của tài khoản test (hạn mức 100 → 90) trước khi email staging được tắt. **Không chạy test staging vào ngày mở bán.**

### Kết quả staging ngày 05/10/2026 (code `8.3-v1-hardening`, chưa có role ADMIN)

| Bài kiểm tra | Kết quả |
|---|---|
| Thời gian phản hồi `doGet?action=taken` (20 mẫu) | p50 1,7 s · p95 2,3 s · có 1–2 lượt **khởi động nguội 33–37 s** |
| 5 loại token giả mạo | **5/5 bị từ chối** |
| Giữ chỗ hộ người khác | **Bị chặn** |
| 3 người cùng bấm 1 slot (lặp 3 lần, 1 lần kèm tải polling 50 yêu cầu/giây) | **Luôn đúng 1 người thắng** (kiểm chứng bằng tra cứu đơn trên máy chủ) |
| Người thua nhận kèm danh sách slot đã hết | Đạt |
| Hủy giữ chỗ → slot trả về kho | Đạt |
| Tải polling 10 / 20 / 30 / 45 / 60 yêu cầu/giây × 20 giây | **0% lỗi ở mọi mức** (p95 ≤ 4,9 s) |

→ Nhịp polling **giữ đúng thiết kế đã duyệt 6–8 giây** (300 người ≈ 43 yêu cầu/giây, đã đo an toàn tới 60).

### 2b. Cập nhật staging sau mỗi lần sửa `Code.gs` (vd. role ADMIN ngày 05/10)
1. Dán `Code.gs` mới vào dự án STAGING → Lưu.
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** (URL staging giữ nguyên).
3. Tab `Users` của **Sheet STAGING**: thêm 1 dòng role `ADMIN` (vd. `VH22222`).
4. Chạy: `python3 tests/staging_smoke_test.py --url <URL_STAGING> --program IS-2026Q4-OTHER-01 --samples 5 --admin VH22222:<mk> --pm VH99999:<mk>` → mục **2b phải ĐẠT** (ADMIN đọc được cài đặt email, PM bị chặn).

---

## 3. TRIỂN KHAI BẢN CHÍNH THỨC

> Chỉ làm khi mục 2 **ĐẠT**. Trình tự quan trọng — làm đúng thứ tự.

| # | Việc | Chi tiết | Kiểm tra |
|---|---|---|---|
| 0 | Gán role **ADMIN** cho đúng người (tab `Users`, cột G = `ADMIN`) | Chỉ 1–2 người (mục 4b) | Đăng nhập thấy "Admin hệ thống" |
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
| 11 | **Khởi động máy chủ** 10 phút trước giờ mở bán | Mở `portal.html` và đăng nhập 1–2 lần (đo 05/10: lượt đầu sau thời gian nghỉ có thể chậm 33–37 s) | Lượt sau phản hồi ≤ 3 s |

**Bản demo** (`Mau_Dang_Ky_Internal_Sales_3009.html`, `index.html`) giữ nguyên để đào tạo. Việc đổi `index.html` trỏ sang `portal.html` là **quyết định của chủ dự án**, chưa thực hiện.

---

## 4. CÔNG TẮC EMAIL TỰ ĐỘNG (CHỈ ADMIN)

**Vị trí:** đăng nhập bằng tài khoản **ADMIN** → Bảng Điều Khiển PM → thanh nút phía trên → nút **"Email tự động [BẬT | TẮT]"**. PM và nhân viên **không thấy** nút này; máy chủ cũng từ chối nếu không phải ADMIN.

| Trạng thái | Nghĩa | Khi nào dùng |
|---|---|---|
| **BẬT** (nhãn xanh) | Hệ thống gửi email thật tới nhân viên khi: giữ chỗ, mở cổng thanh toán, duyệt, từ chối, sắp hết hạn, hết hạn 24h | Khi còn hạn mức email trong ngày |
| **TẮT** (nhãn xám) | Không gửi email thật. Vẫn ghi nhật ký vào tab `AutoEmail` với nhãn `[SIMULATED]` | Khi gần chạm hạn mức, hoặc muốn thông báo qua Teams/Zalo thay thế |

- Bấm nút → hộp xác nhận → **có hiệu lực ngay** (không chờ cache).
- Rê chuột lên nút để xem **số email còn được gửi hôm nay** (Google cung cấp).
- Mọi lần đổi được ghi vào tab `ActivityLog` (hành động `EMAIL_SETTING`, ai đổi, lúc nào).
- Chỉ tài khoản role **ADMIN** thấy và đổi được (máy chủ kiểm tra qua phiên đăng nhập có chữ ký).
- Cách dự phòng (không cần web): sửa ô `ENABLE_AUTO_EMAIL` trong tab `Config` thành `true`/`false` (có hiệu lực sau tối đa 5 phút).

**Hạn mức hiện tại:** Apps Script chạy dưới **tài khoản Gmail cá nhân → tối đa 100 email/ngày** ([nguồn Google](https://developers.google.com/apps-script/guides/services/quotas)). Ngày mở bán dự kiến ~180 email. Khi chạm hạn mức, hệ thống tự ngừng gửi 1 giờ và **đơn hàng vẫn xử lý bình thường**.

**Hạn mức dùng chung:** mọi dự án Apps Script của cùng một tài khoản Google (staging + chính thức) chia nhau 100 email/ngày.

**Khi nâng cấp lên LG Workspace (1.500 email/ngày):** tạo lại dự án Apps Script dưới tài khoản Workspace, làm lại mục 3 (bước 3–7) với URL mới, rồi build lại `portal.html` bằng URL mới.

---

## 4b. ROLE ADMIN (thêm ngày 05/10/2026)

| | PM | **ADMIN** |
|---|---|---|
| Tạo chương trình, nạp Excel, mở cổng, duyệt / từ chối, kết sổ, quét quá hạn | Chỉ chương trình **của mình** | **Mọi chương trình** |
| Xem danh sách chương trình | Của mình | Tất cả (kể cả Dự thảo / Đã kết sổ) |
| Công tắc email tự động | ✗ | ✓ |
| Giao diện | Bảng điều khiển PM | Như PM, thanh người dùng ghi **"Admin hệ thống"** |

- **Cách gán:** tab `Users`, cột G (`Role`) = `ADMIN`. Có hiệu lực ở lần đăng nhập kế tiếp. Muốn bỏ quyền: đổi lại `PM` hoặc `USER`.
- **Nguyên tắc Jeong-Do:** ADMIN thao tác được trên chương trình của mọi PM → chỉ gán cho **1–2 người** (vd. Kiểm toán nội bộ). Mọi thao tác vẫn ghi `ActivityLog` kèm mã NV của ADMIN.
- Tài khoản demo không có ADMIN; role này chỉ dùng với tài khoản trong Sheet.

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
| `node tests/backend_gas_harness.js` | Chạy **Code.gs thật** với Sheet giả lập: xác thực, giữ chỗ, hủy, mở cổng, watchdog, công tắc email, role ADMIN, khóa ghi | **63/63** (bản trước sửa: token giả mạo lọt qua) |
| `python3 tests/cloud_mode_regression.py` | Chạy **trang web thật** với máy chủ giả lập: 7 kịch bản nhân viên, PM, ADMIN, bản production, demo | **32/32** (bản trước sửa: 3/7) |
| `node tests/run_e2e_tests.js` | Bộ kiểm tra cũ (hồi quy) | **164/164** |
| `python3 tests/polling_race_simulation.py` | Mô phỏng rủi ro polling | Xem đề xuất §4 |
| `python3 tests/staging_smoke_test.py …` | Máy chủ **staging thật**: thời gian phản hồi, token giả, ADMIN, FCFS, tải | **ĐẠT** 05/10 (bảng mục 2); mục 2b ADMIN chờ deploy bản mới |
