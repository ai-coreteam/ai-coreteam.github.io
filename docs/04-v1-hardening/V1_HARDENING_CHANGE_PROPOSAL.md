# ĐỀ XUẤT GIA CỐ BẢN V1 TRƯỚC GO-LIVE
### V1 Hardening Change Proposal — LG Internal Sales Portal

| Mục | Giá trị |
|---|---|
| Ngày lập / cập nhật | 05/10/2026 (bản 2) |
| Mã nguồn đối chiếu | commit `5404e1a` — đã xác nhận: Apps Script đang chạy thật = `apps-script/Code.gs` tại commit này |
| CSDL đối chiếu | Google Sheet `LG Internal Sales Database - 2026-10-04` (chỉ đọc; hiện có 5 user, 9 sản phẩm, 1 đơn — dữ liệu test) |
| Mốc go-live | **10:00, 14/10/2026** |
| Trạng thái | **ĐÃ DUYỆT 05/10/2026 — ĐÃ THỰC HIỆN trên nhánh `v1-hardening`** (chờ staging + deploy). Xem [`V1_RELEASE_RUNBOOK.md`](V1_RELEASE_RUNBOOK.md) |

---

## 0. GIẢI THÍCH DỄ HIỂU — 5 VIỆC CẦN QUYẾT

Hình dung cổng bán hàng như **một cửa hàng có quầy, bảng giá điện tử, ổ khóa và sổ sách**. Hôm nay mọi thứ chạy tốt khi thử bằng **tài khoản demo**, vì tài khoản demo chỉ chơi trong "phòng tập" trên chính trình duyệt — không bao giờ đi qua máy chủ thật. Khi nhân viên thật vào, họ đi qua máy chủ thật, và đó là nơi các lỗi dưới đây xuất hiện.

| Gói | Ví von | Hôm nay nhân viên / PM gặp gì | Sau khi sửa | Có đổi cách dùng không? |
|---|---|---|---|---|
| **P — Cửa vào** | Cửa hàng chưa gắn biển địa chỉ máy chủ | Nhân viên mở link lần đầu → rơi vào **phòng tập (Demo)**, mã NV thật bị báo "chưa có trong dữ liệu Demo" — trừ khi mỗi người tự dán URL Apps Script | Có **bản chính thức** tự nối máy chủ, không có tài khoản/sản phẩm demo; bản demo vẫn giữ riêng để đào tạo | Không — chỉ là bỏ bước cấu hình |
| **A — Bảng giá điện tử** | Bảng hiện "còn hàng" cho cả món đã bán | Nhân viên thấy slot đã có người giữ vẫn "Còn trống"; ô "03 Đơn hàng của bạn" luôn trống; máy chủ chậm > 3 giây thì danh mục trống | Bảng hiện đúng như sổ; ô 03 hiện đơn thật; máy chủ chậm thì hiện "Đang kết nối… / Thử lại" | Không |
| **B — Ổ khóa** | Có một **chìa vạn năng** ai cũng tự làm được | Bất kỳ ai biết cách đều tự cấp quyền PM/Admin; có thể giữ chỗ dưới tên người khác | Chỉ người đăng nhập thật mới làm được việc của mình | Không (Admin chạy 1 lệnh đổi khóa, mọi người đăng nhập lại 1 lần) |
| **C — Sổ sách** | Hai người cùng ghi đè lên một trang sổ | Nút "Hủy giữ chỗ" chỉ hủy trên máy nhân viên, máy chủ vẫn giữ slot; PM duyệt hàng loạt báo "xong" dù máy chủ lỗi; lỡ chạy lại hàm cài đặt sẽ **xóa sạch** Sheet | Hủy có hiệu lực thật (chỉ trước khi khai nộp tiền — đã duyệt); báo đúng kết quả; hàm cài đặt từ chối chạy khi đã có dữ liệu | Hủy giữ chỗ: đúng như hướng dẫn hiện có |
| **D+E — Kiểm thử & tài liệu** | Thử bằng khách thật thay vì khách diễn | Bộ test cũ không chạy code thật | Test chạy code thật + hướng dẫn PM/NV được cập nhật | Không |

**Việc anh cần làm ngay, không cần sửa code (5 phút):** xem mục 1.

---

## 1. VIỆC KHẨN — LÀM NGAY TRÊN GOOGLE, KHÔNG CẦN CODE

| # | Phát hiện | Bằng chứng | Việc cần làm |
|---|---|---|---|
| K1 | Google Sheet đang chia sẻ **"Bất kỳ ai có đường liên kết — Người chỉnh sửa"**. ID Sheet nằm trong repo GitHub công khai → ai đọc repo cũng mở và **sửa được** Users (mật khẩu, vai trò), giá, trạng thái đơn | Quyền Drive đọc ngày 05/10: `{"role":"writer","type":"anyone"}` | Đổi sang **Bị hạn chế (Restricted)**. Web App chạy dưới danh nghĩa chủ sở hữu nên **vẫn hoạt động bình thường**. Phải làm **trước** khi nạp danh sách nhân viên thật |
| K2 | Sheet thuộc tài khoản **Gmail cá nhân** → hạn mức Google: **100 người nhận email/ngày** (Workspace: 1.500). `ENABLE_AUTO_EMAIL` đang **TRUE** | Quyền Drive; Config!B8; [Google Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) | Ngày mở bán dự kiến ~90 email xác nhận + ~90 email mở cổng = ~180 > 100 → sau email thứ 100, hệ thống tự ngắt gửi theo từng giờ. Cần quyết: chuyển Apps Script sang tài khoản LG Workspace, hoặc chấp nhận email chỉ là kênh phụ |

---

## 2. Nhãn độ tin cậy

| Nhãn | Nghĩa |
|---|---|
| `[VERIFIED-TEST]` | Tái hiện bằng test chạy code thật (`tests/cloud_mode_regression.py`) |
| `[VERIFIED-CODE]` | Đọc trực tiếp mã nguồn, có số dòng |
| `[VERIFIED-LIVE]` | Đọc trực tiếp Google Sheet / quyền Drive (chỉ đọc) |
| `[MODEL]` | Kết quả mô phỏng, phụ thuộc giả định ghi rõ |
| `[INFERRED]` / `[UNCERTAIN]` | Suy luận / chưa đủ dữ liệu |

---

## 3. Danh mục phát hiện

| ID | Phát hiện | Bằng chứng | Nhãn | Mức |
|---|---|---|---|---|
| V1-00 | URL máy chủ chỉ lấy từ `localStorage` từng trình duyệt → nhân viên mở link lần đầu chạy **Demo Offline**, không đăng nhập được bằng mã NV thật | HTML L5761–5767 | VERIFIED-CODE | **P0 chặn go-live** |
| V1-01 | Nhân viên thật thấy slot đã có người giữ là "Available" (`syncProductRegistrationStatus` ghi đè trạng thái máy chủ bằng `DEMO_REGISTRATIONS`) | HTML L7784–7807 | VERIFIED-TEST | P0 |
| V1-02 | Ô "03 Đơn Hàng Của Bạn" chỉ đọc dữ liệu demo → nhân viên thật luôn thấy "chưa đăng ký"; nút "Nộp tiền ngay" và "Hủy giữ chỗ" ở ô này không xuất hiện | HTML L8106–8165 | VERIFIED-TEST | P0 |
| V1-03 | `loadProducts`/`loadPrograms` bỏ yêu cầu sau 3 giây, rơi về demo hoặc danh mục rỗng, không thử lại | HTML L8521, L6841 | VERIFIED-TEST | P0 |
| V1-04 | Polling kho gọi `GET ?action=taken` nhưng `doGet` không trả danh sách → không bao giờ cập nhật | HTML L11310; `Code.gs` L60 | VERIFIED-CODE | P0 |
| V1-05 | Máy chủ chấp nhận chữ ký `demo_local_signature` và bỏ qua kiểm tra quyền → tự cấp được `{uid:'ADMIN', role:'PM'}` | `Code.gs` L192–198 | VERIFIED-CODE | P0 |
| V1-06 | Khóa bí mật HMAC dự phòng suy ra từ `SPREADSHEET_ID` công khai | `Code.gs` L21, L152 | INFERRED | P0 |
| V1-07 | `register_product_`, `payment_` không đòi token; mã NV lấy từ trình duyệt | `Code.gs` L725, L1557 | VERIFIED-CODE | P0 |
| V1-08 | "Hủy giữ chỗ" gửi `user_cancel_registration` nhưng máy chủ không có route này | HTML L5743; `Code.gs` L64–85 | VERIFIED-CODE | P1 |
| V1-09 | "Duyệt hàng loạt" báo thành công trước khi máy chủ trả lời | HTML L5675–5691 | VERIFIED-CODE | P1 |
| V1-10 | Mở cổng / duyệt hàng loạt / watchdog đọc rồi ghi lại toàn bộ sheet không khóa → có thể ghi đè một lượt nộp tiền xen giữa | `Code.gs` L1158–1201, L1017–1052, L1288 | VERIFIED-CODE (tác động INFERRED) | P1 |
| V1-11 | Từ chối đơn có thể mở lại slot không khớp đơn, không kiểm tra chủ chương trình | `Code.gs` L1121–1139 | VERIFIED-CODE | P1 |
| V1-12 | `setupNewDatabase()` gọi `sheet.clear()` trước khi kiểm tra dữ liệu | `Code.gs` L1877 | VERIFIED-CODE | P1 |
| V1-13 | Xóa cache sai khóa → chương trình vừa kết sổ vẫn hiện tới 60 giây | `Code.gs` L502, L537 vs L422 | VERIFIED-CODE | P2 |
| V1-14 | Seed `ENABLE_AUTO_EMAIL=true` trái tài liệu (mặc định mô phỏng) | `Code.gs` L1924 | VERIFIED-CODE | P2 |
| V1-15 | Mảng `DEMO_USERS` trong HTML cho phép `VH12345 / test123` đăng nhập cục bộ kể cả khi đã nối máy chủ | HTML L6417–6445 | VERIFIED-CODE | P0 (giải quyết bởi Gói P) |
| V1-16 | Nội dung lỗi thời "nộp tiền mở sau 2 giờ" (Tab 3, Tour bước 3) | HTML | VERIFIED-TEST | P2 |
| V1-17 | Tài liệu mâu thuẫn: chi nhánh VCB, cú pháp CK, vị trí kho, tài khoản demo | `docs/` | VERIFIED-CODE | P2 |
| V1-18 | `tests/run_e2e_tests.js` chủ yếu dò chuỗi, không chạy code thật | `tests/` | VERIFIED-CODE | P1 |
| V1-19 | Sheet chia sẻ "Bất kỳ ai có link — chỉnh sửa" | Drive permissions | VERIFIED-LIVE | **P0 — mục 1/K1** |
| V1-20 | Tài khoản Gmail cá nhân: 100 email/ngày, 30 lượt chạy đồng thời, trigger 90 phút/ngày; `ENABLE_AUTO_EMAIL=TRUE` | Drive permissions, Config, Google quotas | VERIFIED-LIVE | P1 — mục 1/K2 |
| V1-21 | `Config!BANK_ACC` đã mất số 0 đầu (`991000012525`). Hiện không code nào đọc ô này (số TK viết cứng trong HTML) — rủi ro tiềm ẩn | Config!B5 | VERIFIED-LIVE | P2 |

---

## 4. Polling kho — đo trước khi đề xuất

### 4.1. Câu hỏi: A đăng ký trước, B bấm trong lúc màn hình chưa cập nhật — có xung đột không?

**Không thể có 2 người cùng giữ 1 slot.** Máy chủ khóa (`LockService`), đọc lại trạng thái slot **bên trong khóa** rồi mới ghi; người đến sau nhận "Sản phẩm … đã có người đăng ký trước" (`Code.gs` L756–790) `[VERIFIED-CODE]`. Polling **chỉ thay đổi điều nhân viên NHÌN THẤY, không thay đổi AI THẮNG**.

Thứ polling ảnh hưởng là **"bấm hụt"**: B bấm vào slot màn hình còn ghi trống nhưng thực ra đã hết → mất vài giây chọn lại.

### 4.2. Kết quả mô phỏng `[MODEL]` — `python3 tests/polling_race_simulation.py`

Giả định (sửa được trong file): 300 người, 90 slot, vài món rẻ/hot được nhiều người muốn (Zipf 0.8), mọi người vào trong 90 giây đầu, xem 10–40 giây trước khi bấm, mạng 0,5 giây mỗi chiều. 200 lần chạy mỗi kịch bản, lấy trung vị.

| Kịch bản | Bấm hụt / người | % người bị hụt ≥ 1 lần | p95 thời gian chờ (giây) | Số người mua được |
|---|---|---|---|---|
| **Hiện tại (không bao giờ cập nhật)** | **30,91** | 77% | 37,5 | 90 |
| Polling 30 s | 1,55 | 78% | 33,5 | 90 |
| Polling 15 s | 1,27 | 76% | 27,0 | 90 |
| Polling 10 s | 1,11 | 74% | 23,2 | 90 |
| Polling 7 s (thiết kế đã duyệt) | 0,99 | 72% | 21,7 | 90 |
| Polling 3 s | 0,81 | 68% | 19,4 | 90 |
| **10 s + làm mới ngay khi bị từ chối** | **0,98** | 74% | 23,3 | 90 |
| 7 s + làm mới ngay khi bị từ chối | 0,91 | 72% | 21,3 | 90 |

Đọc kết quả:
1. **Hôm nay** (polling không chạy): trung bình mỗi người bấm hụt **~31 lần**. Bất kỳ khoảng polling nào cũng giảm còn khoảng 1 lần.
2. **~70–78% người sẽ bấm hụt ít nhất 1 lần dù polling nhanh tới đâu**: 300 người tranh 90 slot, nhiều người bấm cùng một món hot trong cùng vài giây. Đây là bản chất FCFS, không phải lỗi hiển thị. Cách giảm đau là **thông báo rõ và gợi ý món khác ngay**, không phải polling dày hơn.
3. Không kịch bản nào làm sai kết quả: luôn đúng 90 người mua được.

### 4.3. Tải lên Apps Script — giới hạn 30 lượt chạy đồng thời / tài khoản ([nguồn Google](https://developers.google.com/apps-script/guides/services/quotas))

Thời gian một lượt `doGet` là giả định 0,3–1,0 giây `[UNCERTAIN — chưa đo trên bản thật]`.

| Polling | Yêu cầu / giây (300 người) | Lượt chạy đồng thời ước tính |
|---|---|---|
| 3 s | 100 | 30 – 100 ❌ |
| 7 s | 43 | 13 – 43 ⚠️ có thể vượt 30 |
| **10 s** | 30 | 9 – 30 ⚠️ sát ngưỡng nếu mỗi lượt ≥ 1 giây |
| 15 s | 20 | 6 – 20 ✅ |

Lúc 10:00 còn cộng thêm tải đăng nhập + tải danh mục + đăng ký → phải để dư địa. Vượt 30 thì Google trả lỗi "too many scripts running" — **đây mới là rủi ro sập thật sự**, lớn hơn rủi ro bấm hụt.

### 4.4. Đề xuất

- **10 giây + làm mới ngay khi bị từ chối:** khi máy chủ báo "đã có người", phản hồi kèm luôn danh sách slot đã hết → màn hình cập nhật tức thì, không tốn thêm yêu cầu nào.
- Dừng polling khi tab bị ẩn.
- Máy chủ cache danh sách 5 giây để mỗi lượt polling chạy ngắn.
- **Điều kiện:** đo thời gian `doGet` thật trước (cần URL Web App). Nếu ≥ 0,7 giây → dùng **15 giây** (bấm hụt tăng thêm ~0,1 lần/người so với 10 giây theo mô phỏng).

### 4.5. Đo trên máy chủ STAGING thật (05/10/2026) — thay thế giả định ở 4.3 `[VERIFIED-LIVE]`

| Tải polling `doGet?action=taken` | Số yêu cầu | Lỗi | p50 | p95 |
|---|---|---|---|---|
| 10 / giây × 20 s | 200 | **0%** | 1,66 s | 2,56 s |
| 20 / giây × 20 s | 400 | **0%** | 1,77 s | 4,87 s |
| 30 / giây × 20 s | 600 | **0%** | 1,95 s | 3,73 s |
| 45 / giây × 20 s | 900 | **0%** | 2,08 s | 2,79 s |
| 60 / giây × 20 s | 1.200 | **0%** | 2,00 s | 2,40 s |
| 50 / giây × 30 s **+ 3 người tranh 1 slot cùng lúc** | 1.500 | **0%** | 1,72 s | 2,29 s |

- Giả định ở 4.3 (lấy thời gian phản hồi × tốc độ để ước lượng lượt chạy đồng thời) **sai**: thời gian phản hồi gồm cả mạng và bước chuyển hướng của Google, không phải thời gian script chạy. Số đo thực: 60 yêu cầu/giây vẫn 0% lỗi.
- **Quyết định:** giữ đúng thiết kế đã duyệt **6–8 giây** (300 người ≈ 43 yêu cầu/giây, nằm trong vùng đã đo an toàn) + làm mới ngay khi bị từ chối. Theo mô phỏng 4.2: ~0,9–1,0 lần bấm hụt / người.
- Giới hạn của phép đo `[UNCERTAIN]`: tải gửi từ 1 máy; chưa đo 300 trình duyệt thật cùng lúc. Lượt đầu sau thời gian nghỉ có thể chậm 33–37 s (khởi động nguội) → Runbook §3 bước 11 "khởi động máy chủ" trước giờ mở bán.

---

## 5. Các gói thay đổi

> Cột "No-Touch" đối chiếu Vùng Bất Khả Xâm Phạm (`03-architecture-and-analysis/IMPROVEMENT_PLAN_PROPOSAL.md` §3B).

### Gói P — Bản chính thức (production) · sửa V1-00, V1-15

| # | Thay đổi | Ghi chú |
|---|---|---|
| P1 | Thêm khối cấu hình duy nhất ở đầu file: `PORTAL_MODE` (`demo` / `production`) và `PRODUCTION_API_URL` | 1 nguồn, không nhân bản code |
| P2 | Ở `production`: không nạp `DEMO_USERS` / `DEMO_PRODUCTS` / `DEMO_REGISTRATIONS`; ẩn nút đăng nhập nhanh demo và link "Cấu hình API"; không bao giờ tạo token demo; luôn dùng `PRODUCTION_API_URL` | Đóng V1-15 |
| P3 | Script `scripts/build_production.py`: từ file nguồn sinh `portal.html` đã bật `production` và **xóa hẳn** dữ liệu demo khỏi mã nguồn (không chỉ ẩn) | View-source không còn dữ liệu test |
| P4 | Bản demo hiện tại giữ nguyên để đào tạo / thử nghiệm | Không đổi luồng đã duyệt |

- **Phụ thuộc:** Gói B phải xong trước, vì bản production công khai URL Web App (URL này vốn lộ trong tab Network của mọi trình duyệt).
- **Nghiệm thu:** mở `portal.html` trên trình duyệt sạch → đăng nhập được bằng tài khoản Sheet; `VH12345/test123` bị từ chối; tìm "DEMO_USERS" trong mã nguồn → 0 kết quả.

### Gói A — Bảng hiển thị đúng (chỉ file HTML) · sửa V1-01, 02, 03, 16

| # | Thay đổi | Hàm | No-Touch? |
|---|---|---|---|
| A1 | Người dùng không phải PM ở chế độ máy chủ: giữ nguyên trạng thái máy chủ; chế độ Demo giữ nguyên | `syncProductRegistrationStatus` | Không |
| A2 | Ô "03 Đơn Hàng Của Bạn" lấy đơn từ action `lookup` có sẵn (cùng nguồn Tab 3) | `renderBriefTopDashboard` + 1 hàm mới | Không |
| A3 | Không bao giờ rơi về demo; dùng `fetchWithBackoff` có sẵn (8 giây, thử lại 2 lần); hiện "Đang kết nối máy chủ…" + **Thử lại** | `loadProducts`, `loadPrograms` | **Có — `loadProducts` (#8)** |
| A4 | Sửa nội dung "sau 2 giờ" theo quy trình PM mở cổng | nội dung tĩnh | Không |

- **Nghiệm thu:** `tests/cloud_mode_regression.py` 7/7; `node tests/run_e2e_tests.js` vẫn 164/164.

### Gói B — Ổ khóa máy chủ · sửa V1-05, 06, 07, 11

| # | Thay đổi | Hàm |
|---|---|---|
| B1 | Từ chối chữ ký `demo_local_signature` (chỉ bật khi Config có `ALLOW_DEMO_TOKENS = true`) | `verifySessionToken_` |
| B2 | Khóa bí mật sinh ngẫu nhiên + hàm `rotateSessionSecret()` để Admin chạy 1 lần | `getServerSecret_` + hàm mới |
| B3 | `register_product_`, `payment_` bắt buộc token, mã NV trong token phải trùng mã NV đăng ký; client tự gắn token | `register_product_`, `payment_`, `postToSheet` |
| B4 | Từ chối đơn chỉ mở lại slot của dòng đã khớp và thuộc chương trình của PM đó | `pm_reject_payment_` |

- **Admin:** chạy `rotateSessionSecret()` 1 lần → Deploy → Manage deployments → **New version**. Mọi người đăng nhập lại 1 lần.
- **Nghiệm thu:** 5 loại token giả bị từ chối; giữ chỗ hộ mã NV khác bị từ chối.

### Gói C — Sổ sách máy chủ · sửa V1-04, 08, 09, 10, 12, 13, 14

| # | Thay đổi | Hàm |
|---|---|---|
| C1 | Khóa `LockService` quanh đọc-sửa-ghi; kiểm tra lại trạng thái trong khóa; email gửi ngoài khóa | `pm_allow_payment_`, `pm_batch_approve_payment_`, `check_expired_slots_`, `pm_reject_payment_` |
| C2 | Route `user_cancel_registration` — **quy tắc đã duyệt 05/10:** chỉ hủy khi đơn ở "Đã đăng ký - Chờ mở thanh toán" hoặc "Chờ nộp tiền"; token phải trùng mã NV; trả slot về kho; ghi ActivityLog | hàm mới |
| C3 | `setupNewDatabase()` từ chối chạy nếu Sheet đã có đơn | `setupNewDatabase` |
| C4 | Sửa khóa xóa cache chương trình | `program_create_`, `program_update_` |
| C5 | Seed `ENABLE_AUTO_EMAIL = false` (không đụng Sheet đang chạy) | `setupNewDatabase` |
| C6 | `doGet?action=taken&programId=…` (cache 5 giây) + phản hồi "đã có người" kèm danh sách slot đã hết; client polling theo mục 4.4 | `doGet`, `register_product_`, `refreshTaken` |
| C7 | "Duyệt hàng loạt" chờ máy chủ trả lời rồi mới báo kết quả | `pmBatchApprovePayments` |

### Gói D + E — Kiểm thử chạy code thật & tài liệu · sửa V1-17, 18
- `tests/cloud_mode_regression.py` (đã thêm, baseline 3/7) — mở rộng kịch bản PM, hủy giữ chỗ, bản production.
- `tests/polling_race_simulation.py` (đã thêm) — mô phỏng polling.
- Smoke test trên Apps Script **staging** (bản sao Sheet) — cần PIC deploy.
- Cập nhật `02-user-and-pm-guide/` cho mọi thay đổi chạm luồng; thống nhất dữ kiện mâu thuẫn sau khi chủ dự án chốt.

### Không làm trong đợt này (v1.2, sau go-live — trước đây ghi "v1.1"; tên v1.1 nay là bản phát hành 05/10/2026)
- Chuẩn hóa 177 vị trí màu ngoài bảng màu LG; đo lại tương phản khi đã đăng nhập; quyết định Active Red `#EA1917` (web LG.com) hay `#FD312E` (BI nội bộ).
- Tách file HTML 1 MB.

---

## 6. Lộ trình

```mermaid
gantt
  title V1 Hardening → Go-live 14/10/2026
  dateFormat YYYY-MM-DD
  section Ngay
  K1 khóa quyền Sheet · K2 quyết email   :k, 2026-10-05, 1d
  section Thực thi
  Gói B + C (máy chủ)                    :b, 2026-10-06, 1d
  Gói A + P (giao diện, bản production)   :a, 2026-10-07, 1d
  PIC deploy STAGING + smoke test         :s, 2026-10-08, 1d
  Đo doGet + load test 300 user           :l, 2026-10-09, 1d
  section Khóa & UAT
  Code freeze + tài liệu                  :milestone, m1, 2026-10-10, 0d
  UAT: 1 PM + 5 nhân viên thật            :u, 2026-10-11, 3d
  section Vận hành
  Go-live 10:00                           :milestone, m2, 2026-10-14, 0d
  Hypercare tới 17:00 16/10               :h, 2026-10-14, 3d
```

## 7. Tiêu chí go-live (đo được)

| Chỉ số | Ngưỡng | Cách đo |
|---|---|---|
| Nhân viên mới mở link đăng nhập được bằng tài khoản Sheet | 100% | `portal.html` trên trình duyệt sạch |
| UI khớp máy chủ | 7/7 | `python3 tests/cloud_mode_regression.py` |
| Hồi quy luồng cũ | 164/164 | `node tests/run_e2e_tests.js` |
| Token giả mạo lọt qua | 0/5 | script gọi Apps Script staging |
| Đặt trùng slot | 0 / 50 request đồng thời | load test staging |
| Lượt chạy đồng thời lúc cao điểm | < 25 (chừa 5 dư địa) | Apps Script → Executions khi load test |
| Quyền Sheet | Restricted | Drive → Chia sẻ |

## 8. Quyết định & câu hỏi

| # | Nội dung | Trạng thái |
|---|---|---|
| Q1 | Duyệt gói P, A, B, C, D+E | ✅ **Đã duyệt cả 5 gói 05/10** — đã thực hiện |
| Q2 | Polling | ✅ **Chốt 6–8 s** (thiết kế đã duyệt) sau khi đo staging thật 05/10: 60 yêu cầu/giây 0% lỗi (mục 4.5). Hằng số `TAKEN_POLL_MS = 6000` |
| Q3 | Quy tắc hủy giữ chỗ | ✅ **Đã duyệt 05/10:** chỉ trước khi khai nộp tiền |
| Q4 | Cách tạo bản production | ✅ Đã duyệt & làm: `scripts/build_production.py` → `portal.html` |
| Q5 | Dữ kiện chuẩn: chi nhánh VCB, cú pháp CK, vị trí kho AYA/AYB/AYC | Chờ chủ dự án |
| Q6 | Được tạo Sheet + Apps Script staging để test tải? | ✅ Đồng ý. Sheet STAGING đã tạo (riêng tư); Apps Script staging chờ PIC deploy (Runbook §2) |
| Q7 | Email | ✅ Giữ tính năng, thêm **công tắc BẬT/TẮT** cho PM/Admin cho tới khi lên LG Workspace (Runbook §4) |

## 9. Nhật ký trạng thái

| Ngày | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 05/10/2026 | Đề xuất bản 1 | Thay thế bởi bản 2 | |
| 05/10/2026 | `tests/cloud_mode_regression.py` | Đã thêm | Baseline 3/7 |
| 05/10/2026 | Q3 quy tắc hủy giữ chỗ | Đã duyệt | Chỉ trước khi khai nộp |
| 05/10/2026 | Đề xuất bản 2 | Chờ duyệt | Thêm V1-00, V1-19–21, đo polling, Gói P |
| 05/10/2026 | `tests/polling_race_simulation.py` | Đã thêm | Mô phỏng Monte Carlo |
