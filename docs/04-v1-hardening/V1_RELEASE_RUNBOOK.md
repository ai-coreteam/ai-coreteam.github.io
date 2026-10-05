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
| **Bản mới nhất v1.4** (05/10/2026) | Git tag **`v1.4`** · Apps Script chính thức **Version 7** (không đổi) | Lùi web: build `portal.html` từ tag trước (`v1.3` … `v1.1`) |
| **Bản chuẩn v1.1** (05/10/2026) | Git tag **`v1.1`** · Apps Script chính thức **Version 7** | Lùi về trước v1.1: dòng dưới + Apps Script **Version 6** |
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

**Kết quả 2b ngày 05/10/2026 (staging Version 2, có role ADMIN): ĐẠT** — ADMIN `VH22222` đọc cài đặt email (đang TẮT, còn 94 email hôm nay) và xem Dashboard chương trình của PM khác; PM `VH99999` bị chặn công tắc email; 5/5 token giả bị từ chối; phản hồi p50 ≈ 1,9 s.
**Kết quả 2b lần 2 ngày 05/10/2026 (staging Version 3, có bản sửa V1-16): ĐẠT** — lặp lại toàn bộ kiểm tra trên + **kiểm thử V1-16 trên máy chủ thật**: tạo chương trình test do ADMIN sở hữu và 1 đơn → PM `VH99999` gọi Dashboard không kèm mã chương trình **không thấy** đơn đó, ADMIN thấy. Đã hủy đơn và đóng chương trình test (chương trình có đơn không xóa được — giữ làm dấu vết). Hạn mức email trước/sau không đổi (94) → **không gửi email nào**.
   - Chương trình test còn lại trên staging (đã đóng, mỗi cái 1 đơn đã hủy): `IS-2026Q4-V116TEST-01`, `IS-SCOPETEST-1005141336`, `IS-SCOPETEST-1005141855`.
   - **Quan sát độ trễ:** 1 trong 5 lượt chạy (14:13) mất hơn 300 giây thay vì ~30–70 giây; 1 lệnh Dashboard của ADMIN quá 60 giây chờ → báo lỗi. Chạy lại ngay sau đó ĐẠT. Đây là độ trễ phía Google (cùng loại "khởi động nguội 33–37 s" đã đo), không phải lỗi logic — nhưng là lý do giữ bước 11 mục 3 (khởi động máy chủ trước giờ mở bán).
5. *(Tùy chọn, có GHI vào staging)* thêm `--scope-user <MãNV_USER>:<mk>` để chạy lại kiểm thử V1-16 (mục 2c của script). Script tự dừng nếu email staging đang BẬT.

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
| 5b | **Cài đồng hồ quét quá hạn 24h** (bắt buộc, chỉ làm 1 lần cho mỗi dự án Apps Script) | Chọn hàm **`setupWatchdogTrigger`** → **Run** | Biểu tượng đồng hồ (Triggers): **đúng 1 dòng** `runExpirationWatchdog`, Time-based. Sau ~1 giờ: Last run có giờ, Error rate 0% |
| 6 | Kiểm tra tab `Config` | Không có `ALLOW_DEMO_TOKENS` (hoặc = `false`) · `ENABLE_AUTO_EMAIL` theo quyết định (mục 4) | — |
| 7 | Sinh bản cho nhân viên | `python3 scripts/build_production.py --api-url <URL /exec chính thức>` → tạo `portal.html` | Script in "Đã tách 8 khóa bộ nhớ trình duyệt khỏi bản demo" và "Kiểm tra: không còn mật khẩu demo…" |
| 8 | Đưa `portal.html` lên GitHub Pages (**chỉ sau khi bước 0 xong — không còn tài khoản `test123`**) | Commit `portal.html` → push (sau khi chủ dự án duyệt) | Link: `https://gobitangocbao.github.io/lg-internal-sales-portal/portal.html` |
| 9 | Nạp danh sách nhân viên thật vào tab `Users` | Sheet đã ở chế độ **Restricted** (05/10) | Chỉ Admin/HR có quyền |
| 10 | Kiểm tra cuối | Mở `portal.html` ở cửa sổ ẩn danh → đăng nhập 1 tài khoản thật → thấy danh mục; thử `VH12345/test123` → **bị từ chối** | Cả hai đúng |
| 11 | **Khởi động máy chủ** 10 phút trước giờ mở bán | Mở `portal.html` và đăng nhập 1–2 lần (đo 05/10: lượt đầu sau thời gian nghỉ có thể chậm 33–37 s) | Lượt sau phản hồi ≤ 3 s |

### Tiến độ mục 3 (cập nhật 05/10/2026, 14:45)

| Bước | Trạng thái | Bằng chứng |
|---|---|---|
| 0 | ⚠️ `test123` đã gỡ (bị từ chối trên máy chủ). Còn mật khẩu dễ đoán: ADMIN `VH22222`, PM `VH99999` + 3 USER dùng chuỗi số 6 chữ số đơn giản — **phải đổi trước 14/10** | Kiểm tra máy chủ 05/10 |
| 1 | ✅ Bản sao "Copy of LG Internal Sales Database - 2026-10-04 (Appscript v6)" | Ảnh |
| 2 | ✅ Version cũ: **6** (đường lùi: Edit → chọn Version 6 → Deploy) | Tên bản sao |
| 3–5 | ✅ `rotateSessionSecret` 14:37:04; **Version 7** deploy 14:37, URL `/exec` không đổi | Ảnh Execution log + Manage deployments |
| 5b | ✅ **Làm bù 05/10/2026 15:46** — trước đó dự án chính thức có **0 trigger** (bước này thiếu trong Runbook bản đầu; xem mục 3b). Đã có 1 trigger `runExpirationWatchdog` | Ảnh Triggers + Execution log |
| 6 | ✅ Không có `ALLOW_DEMO_TOKENS` · `ENABLE_AUTO_EMAIL = FALSE` (chủ dự án tắt 05/10; máy chủ xác nhận TẮT) | Ảnh tab `Config` + kiểm tra máy chủ |
| Dữ liệu test | ✅ 4 chương trình test → `CLOSED`; nhân viên thấy 0 chương trình | Kiểm tra máy chủ |
| Kiểm tra máy chủ chính thức (Claude, chỉ đọc) | ✅ **10/10**: 4/4 token giả bị từ chối (chứng minh Version 7 = code v1) · `VH12345/test123` bị từ chối · ADMIN đọc công tắc email (BẬT, còn 94 email) · PM bị chặn · PM không chọn chương trình chỉ thấy chương trình của mình | Không tạo đơn, không gửi email; mỗi lượt đăng nhập ghi 1 dòng `AUTH_LOGIN` vào ActivityLog |
| 7 | ✅ `portal.html` build với URL chính thức; mở bằng trình duyệt thật, đăng nhập 1 nhân viên: thấy 3 chương trình + danh mục, không lỗi JS, chỉ gọi lệnh đọc | Lượt đầu tải danh mục **> 15 giây** (máy chủ nguội) |
| 8 | ✅ Chủ dự án duyệt 05/10 (biết rủi ro bước 0): gộp `main` (`49c7630`), tag `v1.1`, đẩy 2 remote; GitHub Pages cập nhật sau ~10 giây | `git ls-remote` cả 2 remote |
| 10 | ✅ **8/8 trên link thật** (trình duyệt mới, như cửa sổ ẩn danh): chế độ production · không có nút demo · `VH12345/test123` bị từ chối · nhân viên thật đăng nhập được · ô 02 "Chưa có đợt bán" · không lỗi JS · chỉ gọi lệnh đọc · link demo `index.html` không đổi | Kiểm tra tự động 05/10 |
| 11 | ⏳ Làm vào **sáng 14/10**, 10 phút trước 10:00 | — |

Ghi chú: ô `BANK_ACC` trong tab `Config` hiện `991000012525` (Google Sheet tự đổi chuỗi `0991000012525` thành số khi `setupNewDatabase()` ghi). Code **không đọc** các ô `BANK_*`; nhân viên thấy số **đầy đủ `0991000012525`** ở ô 01, cửa sổ nộp tiền, mã VietQR (`970436-0991000012525`) và email — đã kiểm chứng trên `portal.html` 05/10. Muốn ô trong Sheet cũng đúng: gõ lại `'0991000012525` (có dấu nháy đơn ở đầu).

### 3b. Danh mục cài đặt một lần (đối chiếu toàn bộ `Code.gs` ngày 05/10/2026)

> **Vì sao có mục này:** ngày 05/10, bước cài trigger quét quá hạn chỉ có trong [`SETUP_APPS_SCRIPT.md`](../01-setup-and-deployment/SETUP_APPS_SCRIPT.md) (hướng dẫn cài mới), **không** có trong trình tự mục 3 → dự án chính thức chạy với 0 trigger cho tới khi chủ dự án kiểm tra. Bảng dưới liệt kê **mọi** thứ code cần mà không tự làm, để mỗi lần dựng / chuyển dự án Apps Script đều đối chiếu đủ.

| # | Hạng mục | Bắt buộc? | Cách làm | Cách kiểm tra | Bản chính thức 05/10 |
|---|---|---|---|---|---|
| 1 | Deployment Web app: Execute as **Me**, Who has access **Anyone** | ✅ | Deploy → New deployment | Mở URL `/exec` thấy JSON `ok` | ✅ |
| 2 | Sheet dữ liệu: `SPREADSHEET_ID` dòng 21 `Code.gs` **hoặc** Script Property `SPREADSHEET_ID` | ✅ | Sửa dòng 21 / Project Settings → Script Properties | Đăng nhập được | ✅ |
| 3 | Khóa ký phiên: `rotateSessionSecret` | ✅ | Run 1 lần | Log "Đã thay khóa ký phiên đăng nhập" | ✅ 14:37 |
| 4 | **Trigger quét quá hạn: `setupWatchdogTrigger`** | ✅ | Run 1 lần (tự xóa trigger trùng) | Triggers: 1 dòng `runExpirationWatchdog`; Last run có giờ | ✅ 15:46 (làm bù) — **đã chạy thật 16:15:39, Error rate 0%** |
| 5 | Cấp quyền Google (Sheet, Drive, Gmail) cho tài khoản chạy script | ✅ | Tự hỏi ở lần Run đầu tiên → Allow | Không còn hộp "Authorization required" | ✅ |
| 6 | Tab `Config`: không có `ALLOW_DEMO_TOKENS` (hoặc `false`); `ENABLE_AUTO_EMAIL` theo quyết định | ✅ | Sửa Sheet | ADMIN đọc công tắc email trên web | ✅ (email TẮT) |
| 7 | Tab `Users`: ≥ 1 ADMIN, mật khẩu riêng; nhân viên thật | ✅ | Sửa Sheet | Đăng nhập thử | ⚠️ còn mật khẩu yếu |
| 8 | Thư mục biên lai Drive "Bien lai nop tien" | Tự động | Tạo ở lần nộp tiền đầu tiên, cạnh file Sheet; ID lưu vào Script Property `RECEIPT_FOLDER_ID` | Thư mục xuất hiện sau đơn nộp tiền đầu tiên | ✅ Có (tạo 04/10 khi test), cùng thư mục với Sheet chính · ⚠️ **có cả 1 file test của STAGING** (xem dưới) |
| 9 | Quyền **xem** thư mục biên lai cho người đối soát (PM / Kế toán) | Khi cần | Drive → thư mục "Bien lai nop tien" → Share → Viewer | Người đối soát mở được link cột R `Receipt` | ⚠️ 05/10 đang để **"Anyone with the link – Viewer"** — chờ chủ dự án chốt (CURRENT_STATE mục 28) |
| 10 | `setupNewDatabase` | ❌ chỉ khi tạo Sheet **mới** | — | Tự từ chối chạy trên Sheet đã có dữ liệu | Không dùng |
| 11 | `clearCache`, `testSetup` | ❌ tiện ích | Chạy khi kỹ thuật cần | — | Không dùng |

⚠️ Trigger chạy bản code **đang lưu trong trình soạn thảo** (cột Deployment = `Head`), không phải Version đã deploy. Sau khi deploy: **không** để code đang sửa dở trong trình soạn thảo của dự án chính thức.

Staging **không cần** trigger (tránh tự hủy đơn test).

⚠️ **Thư mục biên lai dùng chung (phát hiện 05/10):** chỉ có **1** thư mục "Bien lai nop tien" (cạnh Sheet chính), nhưng biên lai test của **staging** (`BL_IS-RECEIPTTEST-…png`) cũng nằm trong đó, dù Sheet staging ở thư mục khác. Nguyên nhân **chưa xác minh**; khả năng cao dự án staging có Script Property `RECEIPT_FOLDER_ID` trỏ vào thư mục chính thức. Cách kiểm tra: dự án STAGING → ⚙️ Project Settings → Script Properties → nếu có `RECEIPT_FOLDER_ID` = `1UBgtt…` thì **xóa** dòng đó (lần nộp tiền test sau, staging tự tạo thư mục riêng cạnh Sheet staging). Chương trình test thêm trên staging ngày 05/10 (đã đóng): `IS-RECEIPTTEST-1005161946` (1 đơn đã từ chối, 1 file ảnh test 1×1 px trong thư mục biên lai của staging).

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
| Nhân viên / PM thấy đơn **"Đã duyệt thanh toán" mà mình không đăng ký** | `portal.html` build **trước** ngày 05/10 còn đọc dữ liệu bản demo trong trình duyệt ([`CURRENT_STATE.md`](../CURRENT_STATE.md) mục 14 — đã sửa) | Build lại `portal.html` bằng script hiện tại (bước 7). Máy chủ **không** bị ghi sai |

---

## 6. Kiểm thử tự động (chạy trên máy tính trước mỗi lần phát hành)

| Lệnh | Kiểm tra gì | Kết quả 05/10/2026 |
|---|---|---|
| `node tests/backend_gas_harness.js` | Chạy **Code.gs thật** với Sheet giả lập: xác thực, giữ chỗ, hủy, mở cổng, watchdog, công tắc email, role ADMIN, khóa ghi | **67/67** (bản trước sửa: token giả mạo lọt qua; PM thấy đơn chương trình khác) |
| `python3 tests/cloud_mode_regression.py` | Chạy **trang web thật** với máy chủ giả lập: 8 kịch bản nhân viên, PM, ADMIN, bản production, demo, dữ liệu demo còn sót trong trình duyệt | **37/37** (bản trước sửa: 3/7; build cũ: hẹn giờ demo gửi lệnh thật) |
| `node tests/run_e2e_tests.js` | Bộ kiểm tra cũ (hồi quy) | **164/164** |
| `python3 tests/polling_race_simulation.py` | Mô phỏng rủi ro polling | Xem đề xuất §4 |
| `python3 tests/staging_smoke_test.py …` | Máy chủ **staging thật**: thời gian phản hồi, token giả, ADMIN, FCFS, tải | **ĐẠT** 05/10 (bảng mục 2); mục 2b ADMIN + 2c V1-16 **ĐẠT** 05/10 (Version 3) |
