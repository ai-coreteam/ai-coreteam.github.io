# HỒ SƠ BÀN GIAO DỰ ÁN — CỔNG ĐĂNG KÝ BÁN HÀNG NỘI BỘ LG (INTERNAL SALES PORTAL)

> **📌 Trạng thái (cập nhật 05/10/2026):** Mục 0.3 bên dưới là bản mới nhất. Mục 0.2 và các mục từ 1 trở đi là **lịch sử**. Thông tin hiện hành: [`docs/CURRENT_STATE.md`](../CURRENT_STATE.md).


> **Mục đích:** Đưa file này cho một chat mới hoặc một agent khác để làm tiếp dự án mà không cần giải thích lại.
> **Chủ dự án:** Hoàng Minh Hiền, kiểm toán nội bộ & phụ trách đạo đức doanh nghiệp (Jeong-Do), LG.
> **Ngày lập:** 24/09/2026.
> **Người lập:** Claude, đọc trực tiếp mã nguồn.

---

## 0. ĐỌC TRƯỚC: NGUỒN VÀ MỨC ĐỘ TIN CẬY

| Nội dung | Nguồn | Độ tin cậy |
|---|---|---|
| Cấu trúc giao diện, trường form, dữ liệu mẫu, hàm JavaScript, CSS | Đọc toàn bộ 1.780 dòng của `Mau_Thu_Dang_Ky_Internal_Sales.html` | **Chắc chắn**: trích thẳng từ code, có số dòng |
| Danh sách file trong thư mục `C:\LG VAN PHONG AI` | Liệt kê thư mục trên máy chị Hiền ngày 24/09/2026 | **Chắc chắn** |
| "Yêu cầu chị Hiền đã đưa ra" ở mục 9 | **Suy ra** từ các dòng chữ trong file như "Cải tiến mới", "Theo yêu cầu mới", "Trường độc lập" | **Suy luận**: KHÔNG phải bản ghi hội thoại. Agent sau phải hỏi lại chị Hiền để xác nhận |
| Lỗi, mâu thuẫn, khoảng trống (mục 10) | Rà soát code | **Chắc chắn**: mỗi lỗi có số dòng để kiểm tra lại |
| Kiến trúc backend, database, domain (mục 12–13) | **Đề xuất của Claude** | **Chưa làm, chưa được duyệt**, chỉ để tham khảo |

**Những gì file này KHÔNG có:**
- Lịch sử các cuộc trò chuyện trước giữa chị Hiền và Claude về dự án. Chat lập file này không đọc được các chat cũ. Nếu còn yêu cầu nào đã trao đổi mà file này không ghi, đó là do thiếu nguồn, không phải do yêu cầu bị bỏ.
- Backend, database, domain thật. **Dự án hiện KHÔNG có backend, KHÔNG có database, KHÔNG có domain chạy thật.** Chi tiết ở mục 3.

---

## 0.3. CẬP NHẬT 05/10/2026 — V1 HARDENING (ĐỌC MỤC NÀY TRƯỚC MỤC 0.2)

> Nguồn chuẩn duy nhất về trạng thái hiện tại: [`docs/CURRENT_STATE.md`](../CURRENT_STATE.md). Mục này chỉ tóm tắt cho agent mới.

| Chủ đề | Hiện trạng 05/10/2026 | Khác gì so với mục 0.2 |
|---|---|---|
| Nhánh code | Việc v1 nằm trên nhánh `v1-hardening` (commit `e489bfa`, `9268fbf`), **chưa** gộp vào `main`, **chưa** đẩy lên remote | — |
| Điểm khôi phục | Tag `checkpoint-pre-v1-hardening-20261005`, nhánh `backup/pre-v1-hardening-20261005`, Sheet BACKUP riêng tư | Mới |
| Vai trò | `USER`, `PM`, **`ADMIN`** (toàn quyền PM trên mọi chương trình + công tắc email) | 0.2 chỉ có USER / PM |
| Bảo mật máy chủ | Khóa phiên ngẫu nhiên + `rotateSessionSecret()`; không nhận token demo; giữ chỗ / nộp tiền / hủy phải đúng chính chủ | 0.2: khóa phiên suy ra từ ID Sheet |
| Bản giao diện | `Mau_Dang_Ky_Internal_Sales_3009.html` = bản **demo**; `python3 scripts/build_production.py <URL>` sinh `portal.html` = bản **chính thức** (không có dữ liệu demo) | 0.2: dùng 1 file cho cả hai |
| Email tự động | Mặc định **TẮT**; chỉ ADMIN bật/tắt trên web. Gmail thường: 100 email/ngày dùng chung | 0.2: cờ `ENABLE_AUTO_EMAIL` chỉ sửa trong tab Config, Sheet mới tạo = `true`, không có nút trên web |
| Hủy giữ chỗ | Nhân viên tự hủy được **trước khi khai nộp tiền** | Mới |
| Polling | 6–8 giây (đo staging: 60 yêu cầu/giây, 0% lỗi) | Giữ nguyên |
| Số tải "903.7 req/s" ở mục 0.2 | **Chưa được đo lại**; số đo thật trên staging xem [Đề xuất §4.5](../04-v1-hardening/V1_HARDENING_CHANGE_PROPOSAL.md) | Thay thế |
| Kiểm thử | `backend_gas_harness.js` 67/67 · `cloud_mode_regression.py` 37/37 · `run_e2e_tests.js` 164/164 · staging ĐẠT | 0.2: 54/54 |
| Việc còn mở | 20 mục (mục 14 🔴 cần xử lý trước go-live), xem [`CURRENT_STATE.md` mục 9](../CURRENT_STATE.md) | — |

**Tài liệu hiện hành theo thứ tự đọc:** [`CURRENT_STATE.md`](../CURRENT_STATE.md) → [`04-v1-hardening/README.md`](../04-v1-hardening/README.md) → [`V1_RELEASE_RUNBOOK.md`](../04-v1-hardening/V1_RELEASE_RUNBOOK.md) → [`PM_AND_USER_OPERATIONAL_GUIDE.md`](../02-user-and-pm-guide/PM_AND_USER_OPERATIONAL_GUIDE.md).

---

## 0.2. CẬP NHẬT TOÀN DIỆN 04/10/2026 (PRODUCTION V8.2 — PHASE P8 GO-LIVE READY & 100% PASS)

> ⚠️ **ĐẶC BIỆT LƯU Ý DÀNH CHO AGENT TIẾP THEO / CHAT MỚI:**
> Các mục cũ bên dưới (viết từ 24/09 và 28/09 nói "chưa có backend, chưa có database") **ĐÃ HOÀN TOÀN LỖI THỜI VÀ CHỈ MANG TÍNH CHẤT LỊCH SỬ**. 
> Hiện tại hệ thống đã là **Bản Production V8.2 hoàn chỉnh**, vận hành trực tuyến với backend Google Apps Script + CSDL Google Sheet cá nhân.

### Hiện trạng thực tế của dự án hiện nay:
1. **File Web Portal chính thức (Portal Live):**
   - **`Mau_Dang_Ky_Internal_Sales_3009.html`** (ĐÃ THAY THẾ TOÀN BỘ các file cũ `index.html` hay `Mau_Thu_Dang_Ky_Internal_Sales.html`). File này chạy độc lập, tự động fallback chế độ mô phỏng offline với `localStorage` bền vững hoặc gọi API Google Apps Script khi có URL.
2. **Backend API chính thức:**
   - **`apps-script/Code.gs`** kết nối CSDL Google Sheet `LG_Internal_Sales_Database` (tự động tạo trên Google Drive cá nhân qua hàm `setupNewDatabase`).
3. **Các tính năng kỹ thuật cốt lõi đã hoàn thành 100%:**
   - **Phase P0 (Auth & RBAC):** Đăng nhập Mã NV/Mật khẩu; phân quyền PM (Quản trị) vs USER (Nhân viên).
   - **Phase P1 (Multi-Program):** Chạy đồng thời `IS2026Q3-HA`, `IS2026Q3-HE`, `IS2026Q4-BS` với hạn mức 1 SP / NV.
   - **Phase P2 (FCFS Locking):** Khóa `LockService` chống tranh chấp slot khi nhiều người bấm cùng lúc.
   - **Phase P3 (VietQR 1-Chạm):** Tự nạp cú pháp chuyển khoản, nén ảnh biên lai < 300KB bằng Canvas HTML5.
   - **Phase P4 (PM Dashboard):** Tab 5 dành riêng cho PM, đối soát biên lai, phê duyệt tiền hoặc từ chối hoàn slot.
   - **Phase P4.5 & Dual-Mode Password:** Người dùng tự đổi MK trên web (băm SHA-256 + Salt); Quản lý có thể gõ trực tiếp mật khẩu plaintext trên Cột B tab `Users` của Google Sheet để reset mật khẩu nhanh.
   - **Phase P4.6 (PM Allow Payment Gate):** Đơn mới đăng ký nhận trạng thái `Đã đăng ký - Chờ mở thanh toán` (khóa thanh toán, chống chuyển tiền nhầm). PM bấm `🔓 Mở cổng thanh toán` sẽ chuyển toàn bộ đơn đăng ký trước đó sang `Chờ nộp tiền` và kích hoạt đếm ngược 24h từ thời điểm mở cổng (`gateOpenTime`).
   - **Phase P5 (High Concurrency Cache):** Cache 2 tầng (Server CacheService 60s + Client SWR 25s), đã stress test đạt 903.7 req/s, chịu tải 200–300 users đồng thời.
   - **Phase P7 (AutoEmail & 24h Watchdog):** Tự động quét giải phóng slot quá hạn 24h (tính từ lúc mở cổng, không tính từ lúc nộp đơn) và gửi email thông báo theo nhận diện LG V5.2.
   - **Phase P8 (Go-Live Preparation & Data Integrity):**
     - *Đồng bộ hóa dữ liệu thời gian thực (Adaptive Polling & Concurrency Sync):* Polling thích ứng 6–8s trong đợt mở bán, tự động đồng bộ tức thì qua `BroadcastChannel` và `storage event` giữa các tab trình duyệt.
     - *Bộ sinh Mã Đợt Bán Thông Minh (Smart Program ID Generator):* Menu chọn 12 phân khúc ngành hàng (`REF`, `WM`, `Kitchen`, `TV`, `AV`, `MS`, `ES`, `RAC`, `AP`, `PC`, `Display`, `Other`) tự động tính Quý và sinh mã chuẩn `IS-YYYYQ[1-4]-<SEGMENT>-NN`, tự động phát hiện và tăng số thứ tự tránh trùng lặp.
     - *Nạp Excel Kho Vận Đa Định Dạng (Multi-format Ingestion):* Tự động trích xuất chính xác 10 cột dữ liệu bôi vàng từ file kiểm kê kho của PM (`PM internal promotion template.xlsx`: A=No, B=CAT, E=W/H, F=Model, G=Serial, H=NOTE, Y=Grade, AA=MRP, AB=D/C, AC=Selling price) và loại bỏ hoàn toàn các cột điểm số kiểm tra kỹ thuật nội bộ (I đến X).
     - *Đồng bộ Schema 12 cột Products:* Căn chỉnh hoàn hảo giữa `Code.gs`, `setupNewDatabase()` và bảng xuất dữ liệu.
     - *Kích hoạt 1-Click Trigger:* Hàm `setupWatchdogTrigger()` trong Apps Script tự cài đặt cron theo giờ.
     - *Bộ Kiểm Thử Tự Động Toàn Diện E2E:* File `tests/run_e2e_tests.js` kiểm tra 54 tiêu chí, đạt **54/54 PASS (100% Success)**.
4. **Tài liệu chuẩn cần đọc:**
   - [docs/01-setup-and-deployment/AGENT_GUIDE_AUTO_SETUP_SHEET.md](docs/01-setup-and-deployment/AGENT_GUIDE_AUTO_SETUP_SHEET.md): Hướng dẫn PIC & Agent tự động tạo Sheet trong 2 phút.
   - [docs/01-setup-and-deployment/SETUP_APPS_SCRIPT.md](docs/01-setup-and-deployment/SETUP_APPS_SCRIPT.md): Hướng dẫn triển khai Web App và cài đặt Trigger.
   - [docs/01-setup-and-deployment/USERS_SHEET_TEMPLATE.md](docs/01-setup-and-deployment/USERS_SHEET_TEMPLATE.md): Cấu trúc tab `Users` và hướng dẫn quản trị mật khẩu.
   - [docs/03-architecture-and-analysis/PHASE_P8_GO_LIVE_DEEP_ANALYSIS_AND_BLINDSPOTS.md](docs/03-architecture-and-analysis/PHASE_P8_GO_LIVE_DEEP_ANALYSIS_AND_BLINDSPOTS.md): Phân tích chi tiết 5 điểm mù vận hành và giải pháp.
   - [tests/run_e2e_tests.js](tests/run_e2e_tests.js): Kịch bản kiểm thử tự động E2E chạy độc lập.

---

## 1. TỔNG QUAN DỰ ÁN

### 1.1. Dự án là gì
Một trang web HTML đơn (single file, mở bằng trình duyệt) mô phỏng **quy trình bán hàng nội bộ cho nhân viên LG Electronics Việt Nam**. Trang chuyển quy trình cũ (nhân viên *reply email* để đăng ký) sang quy trình mới: **đăng ký trực tuyến trên cổng hệ thống**, có ghi nhận thời điểm đăng ký, nộp tiền chuyển khoản và upload biên lai để PM đối soát.

Tiêu đề trang (dòng 6):
`LG ELECTRONICS - CỔNG ĐĂNG KÝ BÁN HÀNG NỘI BỘ & XÁC NHẬN NỘP TIỀN`

Tiêu đề hiển thị ở banner (dòng 748–749):
- `CỔNG ĐĂNG KÝ BÁN HÀNG NỘI BỘ (INTERNAL SALES PORTAL)`
- `Hệ Thống Đăng Ký Trực Tuyến & Xác Nhận Nộp Tiền Ngân Hàng - Chuẩn Hóa LGEVH`

### 1.2. Bản chất ban đầu (Lịch sử ngày 24/09/2026)
> ⚠️ **LƯU Ý:** Mục 1.2, 2, 3 bên dưới ghi nhận tình trạng nguyên bản ngày 24/09 khi mới tạo mockup. Hiện tại (04/10/2026), hệ thống đã là **Bản Production V8.2 Live** với backend Google Apps Script và Google Sheets đầy đủ (xem chi tiết tại Mục 0.2).

Đây là **bản mẫu / prototype giao diện (mockup)** ban đầu: trình bày được quy trình và tương tác trên trình duyệt, nhưng không lưu dữ liệu thật. Tải lại trang là mất hết dữ liệu đã nhập. Phù hợp để:
- Trình bày ý tưởng cải tiến quy trình với PM Support, TL/BOD.
- Làm tài liệu đặc tả (spec) cho IT xây hệ thống thật.
- Làm mẫu thư thông báo (có bản text để copy vào Outlook).

### 1.3. Bối cảnh nghiệp vụ (theo nội dung file)
- **Đơn vị tổ chức bán:** Bộ phận HS PM Support.
- **Người gửi thư mẫu:** Ban Quản Trị Bán Hàng Nội Bộ (Internal Sales PM Team), `internalsales.support@lge.com`.
- **Người nhận:** All LG Team Members `all.vietnam@lge.com` (dòng 795).
- **Pháp nhân nhận tiền:** CÔNG TY TNHH LG ELECTRONICS VIỆT NAM HẢI PHÒNG (LGEVH) (dòng 848).
- **Đợt bán mẫu:** mã đợt `IS-2026-AUG-01`, "Đợt T8/2026" (dòng 799, 814).
- **Dòng sản phẩm nêu trong thư:** Dishwasher (DW), Microwave Oven (MWO), LG Styler (dòng 819). *Lưu ý: danh sách thực tế trong form còn có Tủ lạnh, xem lỗi M-02.*
- **Góc độ đạo đức doanh nghiệp:** Cam kết Jeong-Do Management, cấm bán lại cho bên thứ ba, giới hạn 01 sản phẩm/nhân viên, nguyên tắc ai đến trước được trước dựa trên timestamp, tách bạch người đăng ký và người nộp tiền để đối soát minh bạch.

---

## 2. VỊ TRÍ FILE VÀ PHIÊN BẢN

| Mục | Giá trị |
|---|---|
| File chính | `C:\LG VAN PHONG AI\Mau_Thu_Dang_Ky_Internal_Sales.html` |
| Dung lượng | 75.983 byte |
| Số dòng | 1.780 |
| Sửa lần cuối trên máy | 17/09/2026 15:05 (giờ VN) |
| Bản chị Hiền upload vào chat này | Cùng dung lượng 75.983 byte, coi như cùng phiên bản |
| Ngôn ngữ giao diện | Tiếng Việt, có bản thư tiếng Anh để copy |
| Kiểm soát phiên bản | Không có git, không có bản đánh số. **Đề xuất:** trước mỗi lần sửa, lưu bản mới dạng `..._v2.html`, `..._v3.html`, không ghi đè bản cũ (quy tắc "chỉ THÊM, không XOÁ" của chị Hiền) |

---

## 3. TÌNH TRẠNG KỸ THUẬT: FRONTEND, BACKEND, DATABASE, DOMAIN

### 3.1. Frontend: CÓ (prototype)
- HTML + CSS + JavaScript thuần (vanilla JS), không framework, không thư viện JS.
- Tất cả nằm trong 1 file: CSS ở `<style>` (dòng 10–739), HTML (dòng 741–1474), JS ở `<script>` (dòng 1476–1778).
- Tài nguyên ngoài duy nhất: Google Fonts `Inter` và `Outfit` (dòng 7–9). Không có mạng thì font rơi về `system-ui`.

### 3.2. Backend: KHÔNG CÓ
- Không có máy chủ, không gọi API, không có `fetch`/`XMLHttpRequest`.
- Mọi "gửi đăng ký", "upload", "xác nhận" chỉ là JavaScript sửa bảng HTML trên trình duyệt của người đang mở trang.
- Không có đăng nhập, không phân quyền.

### 3.3. Database: KHÔNG CÓ
- Dữ liệu mẫu (5 đơn) được viết cứng trong HTML (dòng 1186–1275, 1313–1357).
- Dữ liệu người dùng nhập chỉ tồn tại trong DOM. Không dùng `localStorage`, không cookie. **F5 là mất.**
- File upload chỉ đọc vào biến `uploadedFileBase64` trong bộ nhớ (dòng 1477, 1572), không gửi đi đâu.

### 3.4. Domain / URL: KHÔNG CÓ (chỉ là chữ minh hoạ)
- Link `https://internalsales.lge.com/register` (dòng 803) và `https://internalsales.lge.com` (dòng 887) là **placeholder**. Bấm link trong trang chỉ chuyển sang Tab 2 (`href="javascript:goToPortal()"`).
- Chưa kiểm tra domain này có tồn tại không. **Không được giả định nó là hệ thống thật của LG.**
- Trang chưa được host ở đâu: không có artifact, không có SharePoint, không có intranet.

### 3.5. File đính kèm được nhắc tới nhưng KHÔNG tồn tại
- `LG_Internal_Sales_Product_List_Aug2026.xlsx` (dòng 807, mật khẩu ghi là "MÃ_NV"). Không có file này trong thư mục `C:\LG VAN PHONG AI`.

---

## 4. CẤU TRÚC GIAO DIỆN

```
┌───────────────────────────────────────────────────────────┐
│ HEADER (gradient đỏ LG): huy hiệu "LG" tròn + tiêu đề      │
│   Nút: [🖨️ In / Xuất PDF]  [🌓 Đêm / Sáng]                  │
├───────────────────────────────────────────────────────────┤
│ TABS:                                                      │
│  📧 1. Thư Thông Báo Mở Bán        (Announcement)          │
│  💻 2. Đăng Ký Trực Tuyến          (Portal Live)           │
│  ✅ 3. Xác Nhận Mua & Nộp Tiền     (badge đếm "5 Đã Xác Nhận")│
│  📎 4. File Danh Sách & Slot ID    (Excel List)            │
│  ⚙️ 5. Quy Trình Chuẩn (SOP)       (Standard)              │
├───────────────────────────────────────────────────────────┤
│ NỘI DUNG TAB (1 tab hiện tại một thời điểm)                │
└───────────────────────────────────────────────────────────┘
+ MODAL "Xem biên lai" (ẩn, bật khi bấm 🔍 Xem Biên Lai)
```

- Container tối đa 1280px, căn giữa (dòng 56–62).
- Tab mặc định khi mở: Tab 1 (`class="tab-content active"`, dòng 778).

---

## 5. CHI TIẾT TỪNG TAB

### 5.1. TAB 1: Thư Thông Báo Mở Bán (dòng 777–912)

**Mục đích:** Mẫu email PM Support gửi toàn nhân viên trước 24h khi mở cổng.

**Phần đầu tab:**
- Tiêu đề: "Mẫu Thư Thông Báo Mở Bán Sản Phẩm Nội Bộ (PM Gửi Toàn Nhân Viên)".
- Nút `👉 Đăng Ký Ngay Trên Hệ Thống` gọi `goToPortal()`, chuyển sang Tab 2.

**Khung meta email (dòng 788–809):**
| Trường | Giá trị |
|---|---|
| Từ | Ban Quản Trị Bán Hàng Nội Bộ - HS PM Support <internalsales.support@lge.com> |
| Đến | All LG Team Members <all.vietnam@lge.com> |
| Tiêu đề | [INTERNAL SALES ANNOUNCEMENT] Thông Báo Mở Đăng Ký Bán Hàng Nội Bộ Qua Hệ Thống Trực Tuyến (Đợt T8/2026) |
| Link đăng ký | https://internalsales.lge.com/register (placeholder) |
| Đính kèm | LG_Internal_Sales_Product_List_Aug2026.xlsx (Mật khẩu: MÃ_NV) |

**Thân email, 4 khối:**

1. **📌 Thông tin chương trình & thời gian** (dòng 822–831)
   - Thông báo trước: 24 giờ.
   - Mở cổng: **10:00 AM, 31/07/2026**.
   - Hạn chót: **trước 17:00, 02/08/2026**.
   - Nguyên tắc: `FIRST COME, FIRST SERVED`, căn cứ timestamp hệ thống khi nhấn Gửi.
   - Hạn mức: **tối đa 01 sản phẩm / 01 nhân viên**.

2. **💻 Hướng dẫn đăng ký trên hệ thống** (khối xanh teal, dòng 833–842)
   - Trường 1–3: Bộ phận | Mã NV đăng ký | Họ tên NV đăng ký.
   - Trường 4–7: Mã Model | Slot ID (#001, #002…) | SĐT | Địa chỉ giao hàng.
   - **Trường 8 (độc lập): Họ và tên nhân viên nộp tiền** (in đỏ).
   - **Trường 9 (độc lập): Mã NV người nộp tiền** (in đỏ).

3. **💳 Phương thức thanh toán** (dòng 844–854)
   - Chuyển khoản 100% giá trị sau khi hệ thống xác nhận slot.
   - Tên TK: CÔNG TY TNHH LG ELECTRONICS VIỆT NAM HẢI PHÒNG.
   - Số TK: `0991000012525`. **Cần Tài chính xác nhận, xem mục 15.**
   - Ngân hàng: VIETCOMBANK – Chi nhánh Tây Hồ.
   - Cú pháp CK (bản tiếng Việt): `[Mã NV] - [Họ Tên] - [Mã Model] - [STT Ordinal]`.
   - Upload biên lai: vào Tab 3, điền mẫu, tải ảnh/PDF.

4. **⚠️ Điều khoản, bảo hành & Jeong-Do** (khối vàng amber, dòng 856–864)
   - Vận chuyển: công ty hỗ trợ đến địa chỉ đăng ký.
   - Bảo hành: **không bảo hành** (Clearance/Internal Sales).
   - Đổi trả: trong 07 ngày làm việc, chỉ đổi khi lỗi chức năng cơ bản.
   - Jeong-Do: **nghiêm cấm bán lại cho bên thứ 3**, vi phạm xử lý kỷ luật.

- Ký tên: Ms. Dương Thị Nguyệt, HS PM Support.
- Có dòng in nghiêng "💡 Cải tiến mới: Các trường thông tin về Nhân Viên Nộp Tiền được tách thành các trường riêng độc lập!" (dòng 820).

**Khối copy text cho Outlook** (dòng 872–911):
- Hộp nền tối, font monospace, nút `Sao chép Text` gọi `copyContent('raw-text-1')`.
- Nội dung **tiếng Anh**, 4 mục: Registration Time, Registration Rules & System Portal (liệt kê 9 trường), Payment Method & Payer Verification, Other Policies.
- Cú pháp CK trong bản tiếng Anh: `[Employee Code] - [Employee Name] - [Model Name] - [Slot ID]`. **Khác bản tiếng Việt, xem lỗi M-01.**

### 5.2. TAB 2: Đăng Ký Trực Tuyến Trên Hệ Thống (dòng 914–1027)

**Mục đích:** Form nhân viên tự đăng ký mua.

- Tiêu đề: "Portal Đăng Ký Mua Hàng Trực Tuyến Trên Hệ Thống (Direct Registration Form)".
- Nhãn trạng thái: "🔴 Cổng Đăng Ký Đang Mở Live" (chữ tĩnh, không phụ thuộc thời gian thật).
- Form `id="system-reg-form"`, `onsubmit="handleFormSubmit(event)"`.
- Lưới 3 cột (≤900px: 2 cột, ≤600px: 1 cột).

**Đặc tả 9 trường + ô cam kết:**

| # | Nhãn | id | Kiểu | Bắt buộc | Giá trị / placeholder |
|---|---|---|---|---|---|
| 1 | Bộ phận (Division) | `reg-division` | select | Có | 8 lựa chọn, xem dưới |
| 2 | Mã Nhân Viên Đăng Ký (EMP Code) | `reg-emp-code` | text | Có | "Ví dụ: VH12345". Không kiểm tra định dạng |
| 3 | Họ và Tên Nhân Viên Đăng Ký | `reg-emp-name` | text | Có | "Ví dụ: Nguyễn Thị Quỳnh Như" |
| 4 | Mã Model Sản Phẩm | `reg-model` | select | Có | 4 model, xem dưới |
| 5 | Mã Slot ID Đăng Ký | `reg-slot-id` | select | Có | #001–#005 |
| 6 | Số Điện Thoại Liên Hệ | `reg-phone` | tel | Có | "Ví dụ: 0912345678". Không kiểm tra định dạng |
| 7 | Địa Chỉ Giao Hàng Chi Tiết | `reg-address` | text (full width) | Có | Ví dụ địa chỉ Thiso Hall, TP. Thủ Đức |
| 8 | 👤 Họ và Tên Nhân Viên Nộp Tiền (Trường Độc Lập) | `reg-payer-name` | text, khung nền xanh | Có | Tự điền theo trường 3 cho tới khi người dùng tự gõ |
| 9 | 🪪 Mã NV Người Nộp Tiền (Trường Độc Lập) | `reg-payer-code` | text, khung nền xanh | Có | Tự điền theo trường 2 cho tới khi người dùng tự gõ |
| – | Cam kết Jeong-Do | `reg-agree` | checkbox | Có | Xem dưới |

**Danh sách Bộ phận (dòng 932–940):**
`HS PM Support` · `Audit & Jeong-Do` (hiển thị "Audit & Jeong-Do Team") · `HE Sales Division` · `HA Production` (hiển thị "HA Production Division") · `HR & Admin` (hiển thị "HR & Admin Department") · `Finance & Accounting` · `R&D Center` (hiển thị "R&D Center Vietnam") · `Supply Chain Management` (hiển thị "Supply Chain Management (SCM)").
*Đây là danh sách minh hoạ, cần đối chiếu cơ cấu phòng ban thật của LGEVH.*

**Danh sách Model (dòng 960–965):**
| value | Mô tả hiển thị | Giá hiển thị |
|---|---|---|
| MS3032JAS.BBKPLVN | Lò vi sóng LG 30L | 1,850,000 VNĐ |
| LDFB7623S.ABMETVN | Máy rửa bát QuadWash | 12,500,000 VNĐ |
| S5GOC.ABMETVN | Tủ chăm sóc quần áo LG Styler | 22,000,000 VNĐ |
| GR-X257MC.AMCKVN | Tủ lạnh InstaView 635L | 28,900,000 VNĐ |

**Danh sách Slot (dòng 972–978):**
`#001 (Microwave - Slot 1)` · `#002 (Microwave - Slot 2)` · `#003 (Dishwasher - Slot 1)` · `#004 (LG Styler - Slot 1)` · `#005 (InstaView Refrigerator - Slot 1)`.

**Nội dung cam kết (dòng 1017):**
"Tôi cam kết thông tin đăng ký là chính xác, tuân thủ hạn mức 01 sản phẩm/nhân viên, thực hiện nộp tiền thanh toán đúng cú pháp ngay khi nhận thông báo và không bán lại cho bên thứ 3 theo nguyên tắc **Jeong-Do Management LGEVH**."

**Nút:** `🔄 Nhập Lại Form` (reset) · `🚀 Gửi Đăng Ký Lên Hệ Thống (Record Timestamp)` (submit).

**Hành vi khi gửi:** xem hàm `handleFormSubmit` ở mục 7.

### 5.3. TAB 3: Xác Nhận Mua & Nộp Tiền (dòng 1029–1287)

**Mục đích:** (a) mẫu biểu cho nhân viên khai báo đã nộp tiền và upload biên lai; (b) bảng tổng hợp để PM/Kế toán đối soát.

**Nút trên cùng:**
- `📤 Điền Thông Tin & Upload File Nộp Tiền`: gọi `togglePaymentUploadForm()`, ẩn/hiện khung form.
- `📥 Xuất Excel`: gọi `exportToCSV()`, thực chất xuất file **.csv**, không phải .xlsx.

**Form nộp tiền `id="payment-form"` (dòng 1061–1144):**

| # | Nhãn | id | Kiểu | Ghi chú |
|---|---|---|---|---|
| 1 | Chọn Mã Slot ID Đã Đăng Ký | `pay-slot-select` | select | 5 lựa chọn ghép sẵn tên NV + model + giá. `onchange="autoFillPaymentOrderInfo()"` |
| 2 | Mã NV Đăng Ký | `pay-emp-code` | text | |
| 3 | Họ & Tên NV Đăng Ký | `pay-emp-name` | text | |
| 4 | 👤 Họ và Tên Nhân Viên Nộp Tiền (Trường Độc Lập) | `pay-payer-name` | text | |
| 5 | 🪪 Mã NV Người Nộp Tiền (Trường Độc Lập) | `pay-payer-code` | text | |
| 6 | Số Tiền Đã Chuyển Khoản (VNĐ) | `pay-amount` | **text** | Không phải number, không so với giá |
| 7 | Ngân Hàng & Mã Giao Dịch | `pay-txn-id` | text | Gộp ngân hàng + mã GD vào 1 ô |
| 8 | Ngày Giờ Nộp Tiền | `pay-date` | **text** | Không phải datetime-local |
| 9 | Upload File Chứng Từ / Ảnh Biên Lai | `file-input-receipt` | file (ẩn) | `accept="image/*,application/pdf"`. Có ảnh xem trước cho file ảnh |

- Khung upload ghi "Nhấn vào đây để tải file ảnh hoặc kéo thả…", "Tối đa 10MB". **Kéo thả và giới hạn 10MB chưa được code** (lỗi L-07, L-08).
- Nút: `Hủy Bỏ` (reset) · `📤 Gửi Xác Nhận Nộp Tiền & Upload File Chứng Từ`.

**Thanh lọc (dòng 1148–1159):**
- Ô tìm kiếm `table-search` (tìm theo mọi chữ trong dòng).
- Select `status-filter`: `ALL` / `CONFIRMED` (🟢 Đã Xác Nhận Nộp Tiền) / `PENDING` (🟡 Chờ Nộp Tiền Ngân Hàng).

**Bảng xác nhận `id="confirmation-table"`, 12 cột (dòng 1163–1277):**
1. Slot ID
2. Mã NV Đăng Ký
3. Họ & Tên NV Đăng Ký
4. 👤 Họ Tên NV Nộp Tiền (Trường 1): header nền xanh đậm #1E40AF
5. 🪪 Mã NV Nộp Tiền (Trường 2): header nền #1E3A8A
6. Bộ Phận
7. Mã Model Sản Phẩm
8. Số Tiền (VNĐ)
9. Ngân Hàng & Mã GD
10. 📄 File Chứng Từ Nộp Tiền: header nền xanh lá #047857, nút `🔍 Xem Biên Lai`
11. Thời Gian Nộp Tiền
12. Trạng Thái PM Xác Nhận

**Ghi chú cuối tab (dòng 1280–1286):** giải thích lý do tách 2 trường người nộp tiền và tách 2 cột trong bảng "để PM & Kế toán dễ đối soát sao kê ngân hàng".

### 5.4. TAB 4: File Danh Sách & Slot ID (dòng 1289–1370)

**Mục đích:** Mẫu cấu trúc file danh sách sản phẩm mở bán (bản bảo mật) và các nguyên tắc bảo mật/timestamp.

**Bảng Slot, 7 cột:** Mã Slot ID · Danh Mục · Model · Mô tả chi tiết · Giá niêm yết (RRP) · Giá nội bộ · Trạng thái. (Dữ liệu ở mục 6.2.)

**Khối "🔒 Bảo mật dữ liệu cá nhân & chống tranh chấp timestamp" (dòng 1362–1369):**
- Timestamp mili-giây, máy chủ lưu giờ UTC+7. **Chưa code: hiện lấy giờ máy người dùng, chính xác tới giây (lỗi L-11).**
- SĐT và địa chỉ chỉ hiển thị cho Vận chuyển & PM Support. **Chưa code: không có phân quyền; SĐT/địa chỉ nhập vào rồi bị bỏ, không lưu ở đâu (lỗi L-12).**
- Bảng xác nhận công khai có 2 trường người nộp tiền và link xem biên lai "để toàn thể nhân viên kiểm tra". **Cần cân nhắc bảo vệ dữ liệu cá nhân, xem mục 13.3.**

### 5.5. TAB 5: Quy Trình Chuẩn (SOP) (dòng 1372–1438)

**Sơ đồ 4 bước (lưới 4 cột; bước 3 được tô viền đỏ `active-step`):**
1. **Gửi Mail Thông Báo:** PM gửi mail trước 24h kèm link portal và file danh sách sản phẩm được mã hoá.
2. **Đăng Ký Trực Tuyến:** NV đăng ký trên portal với đầy đủ các trường bắt buộc độc lập.
3. **Nộp Tiền & Upload File:** NV chuyển khoản Vietcombank, điền form, upload biên lai, khai trường độc lập người nộp tiền.
4. **Xuất Kho & Giao Hàng:** PM kiểm tra chứng từ, xác nhận đơn, bàn giao Logistics.

**Bảng "🎯 Điểm cải tiến nổi bật theo yêu cầu mới" (dòng 1404–1437):**

| Tiêu chí | Quy trình email cũ | Quy trình mới trên hệ thống |
|---|---|---|
| Phương thức đăng ký | Reply email thủ công | Đăng ký trực tiếp trên Portal |
| Trường NV nộp tiền | Gộp chung hoặc dễ gõ thiếu | Tách 2 trường độc lập (Họ tên & Mã NV nộp tiền) |
| Xác nhận nộp tiền (Bước 3) | Không có file chứng từ/nộp hộ | Mẫu biểu + Upload biên lai + đối soát 2 cột NV nộp tiền |
| Độ chính xác thời gian | Tranh chấp thứ tự mail | Timestamp máy chủ chính xác mili-giây |

### 5.6. MODAL xem biên lai (dòng 1441–1474)
- Mở bằng `openReceiptModal(title, payer, amount, txnCode)`.
- Hiển thị một **khung dựng sẵn** ghi "VIETCOMBANK - XÁC NHẬN CHUYỂN KHOẢN THÀNH CÔNG", số tiền, TK thụ hưởng, người nộp, mã GD, trạng thái "Đã ghi nhận Nộp Tiền Thành Công".
- **Không hiển thị file biên lai thật mà người dùng đã upload** (lỗi L-09).
- Nút `📥 Tải File Biên Lai` chỉ bật `alert(...)`, không tải gì.

---

## 6. DỮ LIỆU MẪU TRONG FILE

> Tất cả là **dữ liệu minh hoạ** viết cứng trong HTML. Tên người, mã NV, mã giao dịch đều là mẫu. Chưa xác nhận giá và model có đúng với đợt bán thật nào không.

### 6.1. 5 đơn trong bảng xác nhận Tab 3 (dòng 1186–1275)

| Slot | Mã NV ĐK | Họ tên NV ĐK | Tên NV nộp tiền | Mã NV nộp | Bộ phận | Model | Số tiền | Mã GD | File | Thời gian | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|---|---|
| #001 | VH12345 | Nguyễn Thị Quỳnh Như | Nguyễn Thị Quỳnh Như | VH12345 | HS PM Support | MS3032JAS.BBKPLVN | 1,850,000 | VCB - TXN9823411 | .PNG | 31/07/2026 10:04:12 | 🟢 Đã Nộp & Xác Nhận |
| #002 | VH88921 | Trần Văn Nam | Trần Văn Nam | VH88921 | Audit & Jeong-Do | MS3032JAS.BBKPLVN | 1,850,000 | VCB - TXN9823455 | .JPG | 31/07/2026 10:06:45 | 🟢 |
| #003 | VH55432 | Lê Hoàng Anh | **Phạm Thị Mai (Nộp hộ)**, chữ màu cam | **VH77123**, badge vàng | HE Sales Division | LDFB7623S.ABMETVN | 12,500,000 | VCB - TXN9823901 | .PDF | 31/07/2026 10:12:03 | 🟢 |
| #004 | VH33211 | Hoàng Minh Trí | Hoàng Minh Trí | VH33211 | HA Production | S5GOC.ABMETVN | 22,000,000 | VCB - TXN9824102 | .PNG | 31/07/2026 10:15:22 | 🟢 |
| #005 | VH99120 | Đặng Thanh Hà | Đặng Thanh Hà | VH99120 | Finance & Accounting | GR-X257MC.AMCKVN | 28,900,000 | VCB - TXN9824589 | .JPG | 31/07/2026 10:18:50 | 🟢 |

- Dòng #003 là **ca nộp hộ** duy nhất. Đây là ví dụ minh hoạ vì sao phải tách 2 trường người nộp tiền.
- Badge đếm ở Tab 3: "5 Đã Xác Nhận" (dòng 767).

### 6.2. Bảng Slot ở Tab 4 (dòng 1313–1357)

| Slot | Danh mục | Model | Mô tả | RRP | Giá nội bộ | Trạng thái |
|---|---|---|---|---|---|---|
| #001 | Microwave (MWO) | MS3032JAS.BBKPLVN | Lò vi sóng LG 30L tráng men kháng khuẩn EasyClean | 3,990,000 | 1,850,000 | 🔴 Đã Đăng Ký Mua |
| #002 | Microwave (MWO) | MS3032JAS.BBKPLVN | (như trên) | 3,990,000 | 1,850,000 | 🔴 Đã Đăng Ký Mua |
| #003 | Dishwasher (DW) | LDFB7623S.ABMETVN | Máy rửa bát LG QuadWash TrueSteam 14 bộ bát đĩa | 24,900,000 | 12,500,000 | 🔴 Đã Đăng Ký Mua |
| #004 | LG Styler | S5GOC.ABMETVN | Tủ chăm sóc quần áo thông minh LG Styler 5 móc | 45,000,000 | 22,000,000 | 🔴 Đã Đăng Ký Mua |
| #005 | Refrigerator | GR-X257MC.AMCKVN | Tủ lạnh LG InstaView Door-in-Door 635L Side by Side | 52,000,000 | 28,900,000 | 🔴 Đã Đăng Ký Mua |

**Cảnh báo:** các con số RRP và giá nội bộ này **chưa được xác minh** với PM hay bảng giá thật. Không đưa ra ngoài như số liệu thật.

### 6.3. Dữ liệu tự điền trong form Tab 3 (`autoFillPaymentOrderInfo`, dòng 1585–1604)
- Chọn `#001`: điền VH12345 / Nguyễn Thị Quỳnh Như / người nộp trùng / 1,850,000 / "Vietcombank - VCB-TXN9823411" / "31/07/2026 10:15:00".
- Chọn `#003`: điền VH55432 / Lê Hoàng Anh / Phạm Thị Mai (Nộp hộ) / VH77123 / 12,500,000 / "Vietcombank - VCB-TXN9823901" / "31/07/2026 10:20:00".
- Chọn #002, #004, #005: **không điền gì** (lỗi L-05).
- Lưu ý: giờ nộp tự điền của #001 (10:15:00) khác giờ trong bảng (10:04:12); #003 là 10:20:00 so với 10:12:03 (lỗi M-05).

---

## 7. CÁC HÀM JAVASCRIPT (dòng 1476–1778)

### Biến toàn cục
- `uploadedFileBase64` (null): chuỗi base64 của ảnh vừa chọn.
- `uploadedFileName` (''): tên file vừa chọn.

### `switchTab(tabId, element)` (1481–1493)
Bỏ class `active` khỏi mọi nút tab và nội dung tab, gắn `active` cho nút được bấm (hoặc tìm nút có `onclick` chứa `tabId` nếu không truyền `element`), hiện nội dung `tabId`.

### `goToPortal()` (1495–1498)
Lấy nút tab thứ 2 (index 1), gọi `switchTab('tab2', …)`. Dùng ở nút "Đăng ký ngay" và link trong email mẫu.

### `togglePaymentUploadForm()` (1501–1509)
Nếu `payment-upload-card` đang `display:none` thì hiện và cuộn tới; ngược lại thì ẩn. Mặc định ban đầu form đang hiện, lần bấm đầu tiên sẽ **ẩn** form.

### `toggleTheme()` (1512–1519)
Bật/tắt thuộc tính `data-theme="dark"` trên `<html>`. Không lưu lựa chọn; tải lại trang về chế độ sáng.

### `copyContent(elementId)` (1522–1536)
Lấy `innerText` của khối, bỏ chữ "Sao chép Text"/"Sao chép", ghi vào clipboard bằng `navigator.clipboard.writeText`. Nút đổi thành "✓ Đã Sao Chép!" màu xanh trong 2 giây. Clipboard API cần HTTPS hoặc `file://`/localhost tuỳ trình duyệt; không có xử lý lỗi `.catch`.

### Tự đồng bộ người nộp tiền = người đăng ký (1539–1559)
- Khi gõ `reg-emp-name`, nếu `reg-payer-name` chưa bị người dùng sửa (`dataset.userModified` rỗng) thì copy sang.
- Tương tự `reg-emp-code` sang `reg-payer-code`.
- Khi người dùng gõ vào ô người nộp, đặt `userModified="true"` để ngừng tự đồng bộ.
- **Hạn chế:** bấm "Nhập Lại Form" (reset) không xoá cờ `userModified`, nên lần nhập sau không tự đồng bộ nữa (lỗi L-15).

### `handleFileSelected(event)` (1562–1582)
- Lấy file đầu tiên, hiển thị tên và dung lượng (KB).
- Nếu là ảnh: đọc base64, hiện thumbnail `file-preview-img`.
- Nếu là PDF: không xem trước, `uploadedFileBase64 = null`.
- Không kiểm tra dung lượng, không kiểm tra loại file ngoài thuộc tính `accept`.

### `autoFillPaymentOrderInfo()` (1585–1604)
Xem mục 6.3. Chỉ xử lý #001 và #003, viết cứng.

### `handleFormSubmit(event)` (1607–1657), gửi đăng ký Tab 2
1. `preventDefault`.
2. Đọc division, empCode, empName, model, slotId, payerName, payerCode. **Không đọc SĐT và địa chỉ.**
3. `timestampStr` = ngày giờ máy khách, định dạng `vi-VN`, tới giây.
4. Suy giá bằng `model.includes(...)`: mặc định `1,850,000`; LDFB7623S → 12,500,000; S5GOC → 22,000,000; GR-X257MC → 28,900,000.
5. Tạo dòng mới nền xanh nhạt, chèn **lên đầu** bảng Tab 3, gồm:
   - Mã GD = `VCB - TXN` + số ngẫu nhiên 7 chữ số (**tự bịa mã GD dù người dùng chưa nộp tiền**).
   - Nút xem biên lai gọi modal với **một số ngẫu nhiên khác** (2 lần `Math.random`).
   - Thời gian nộp tiền = timestamp đăng ký.
   - Trạng thái = **"🟢 Đã Nộp & Xác Nhận"** ngay khi mới đăng ký.
6. Cập nhật badge Tab 3: "`N` Đã Xác Nhận".
7. `alert` thông báo thành công, liệt kê Slot, NV, trường 8, trường 9, timestamp; nhắc sang Tab 3 upload biên lai.
8. Chuyển sang Tab 3.
- **Không kiểm tra:** trùng mã NV (hạn mức 1 SP/NV), slot đã có người, model khớp slot, trong/ngoài khung giờ mở cổng.

### `handlePaymentSubmit(event)` (1660–1719), gửi xác nhận nộp tiền Tab 3
1. Đọc slotId, empCode, empName, payerName, payerCode, amount, txnId, payDate.
2. `fileName` = tên file đã chọn, hoặc tự đặt `Bien_Lai_Chuyen_Khoan_<slot>.png` nếu **không chọn file**. Nghĩa là có thể gửi mà không có biên lai (lỗi L-06).
3. `alert` "ĐÃ UPLOAD CHỨNG TỪ NỘP TIỀN THÀNH CÔNG!…PM Support đã nhận được… tiến hành duyệt xuất kho!"
4. Tìm dòng trong bảng có `innerText` chứa slotId:
   - Nếu có: cập nhật cột 4, 5, 9, 10, 11, 12 (người nộp, mã, mã GD, nút biên lai, ngày nộp, trạng thái 🟢).
   - Nếu không có: thêm dòng mới, Bộ phận = "N/A", Model = "Internal Model".
- Vì bảng có thể có nhiều dòng cùng slot (do Tab 2 không chặn trùng), hàm sẽ cập nhật **tất cả** dòng khớp.
- Trạng thái chuyển thẳng sang "Đã Nộp & Xác Nhận"; **không có bước PM duyệt** riêng.

### `openReceiptModal(...)` / `closeReceiptModal()` (1722–1732)
Điền tiêu đề, người nộp, số tiền, mã GD vào modal; bật/tắt class `active`.

### `filterTable()` (1735–1757)
Lọc từng dòng theo chữ tìm kiếm (không phân biệt hoa thường) và trạng thái: CONFIRMED = dòng chứa "Đã Nộp"; PENDING = dòng chứa "Chờ Nộp". **Không dòng nào có chữ "Chờ Nộp"**, nên lọc PENDING luôn ra rỗng (lỗi L-10).

### `exportToCSV()` (1760–1777)
- Duyệt mọi `tr` của bảng (kể cả header), bọc từng ô trong ngoặc kép, escape `"`.
- Có BOM `\uFEFF` để Excel đọc đúng tiếng Việt.
- Tải về tên `Xac_Nhan_Dang_Ky_Banh_Hang_Noi_Bo_LGEVH.csv` (**lỗi chính tả "Banh" → "Ban"**, lỗi M-06).
- Cột "File chứng từ" xuất ra chữ "🔍 Xem Biên Lai (.PNG)" thay vì tên file.
- Dùng `data:` URI + `encodeURI`: ký tự `#` trong "#001" có thể làm cắt file CSV ở một số trình duyệt (`#` bắt đầu fragment; `encodeURI` không mã hoá `#`). **Cần kiểm thử; nên dùng Blob** (lỗi L-14).

---

## 8. HỆ THỐNG THIẾT KẾ (CSS)

### 8.1. Biến màu (`:root`, dòng 11–29)
| Biến | Giá trị | Dùng cho |
|---|---|---|
| `--lg-red` | #A50034 | Màu chủ đạo |
| `--lg-red-dark` | #7A0026 | Gradient nút |
| `--lg-red-light` | #FFF0F3 | Nền form nộp tiền |
| `--lg-red-border` | #F5C6D0 | Viền form nộp tiền |
| `--lg-gray-dark` | #1E293B | Chữ chính |
| `--lg-gray-muted` | #64748B | Chữ phụ |
| `--lg-bg` | #F1F5F9 | Nền trang |
| `--lg-card-bg` | #FFFFFF | Nền thẻ |
| `--lg-border` | #E2E8F0 | Viền |
| `--lg-green` / `-bg` / `-border` | #059669 / #ECFDF5 / #A7F3D0 | Khối teal, trạng thái OK |
| `--lg-amber` / `-bg` / `-border` | #D97706 / #FFFBEB / #FDE68A | Khối cảnh báo |
| `--font-main` | 'Inter', system-ui | Chữ thân |
| `--font-heading` | 'Outfit', 'Inter' | Tiêu đề |

Chế độ tối `[data-theme="dark"]` (dòng 31–40) ghi đè: nền #0F172A, thẻ #1E293B, chữ #F8FAFC, muted #94A3B8, viền #334155, red-light #31111D, green-bg #064E3B, amber-bg #451A03.

### 8.2. Thành phần chính
`.top-header` (gradient đỏ → #60001D, bo 16px) · `.lg-badge` (vòng tròn trắng chữ "LG") · `.btn-action` / `.btn-secondary` · `.nav-tabs` / `.tab-btn` / `.tab-badge` · `.tab-content` (hiệu ứng fadeIn) · `.sec-card` (+ `-teal`, `-amber`) · `.email-container` / `.email-header-meta` / `.email-body` · `.custom-table` (header #1E293B) · badge: `.badge-code`, `.badge-ordinal`, `.badge-payer` (chưa dùng), `.badge-status-ok` · `.btn-view-slip` · form: `.form-grid`, `.form-group`, `.form-label`, `.form-control`, `.btn-submit` · `.file-upload-box`, `.preview-thumbnail` · `.filter-bar`, `.search-box` · modal: `.modal-overlay`, `.modal-card` (hiệu ứng modalIn), `.modal-close` · `.copy-box`, `.btn-copy` · SOP: `.sop-grid`, `.sop-card`, `.sop-num`, `.sop-title`, `.sop-desc`, `.highlight-pill`.

### 8.3. In ấn (`@media print`, dòng 734–738)
Ẩn nút header, thanh tab, nút copy, thanh lọc, nút submit và **cả khung form nộp tiền**; hiện **tất cả** các tab liên tiếp. Nút "🖨️ In / Xuất PDF" gọi `window.print()`.

### 8.4. Tuân thủ nhận diện LG: CHƯA đạt
- Dùng font Inter/Outfit, **không phải LG EI** (font thương hiệu).
- Logo là vòng tròn chữ "LG" tự vẽ, **không phải logo LG chính thức**.
- Chưa chạy trình kiểm tra của skill `/lg-brand`.
- Mã #A50034 cần đối chiếu với LG BI Guidelines (thư mục `BI 10.2023 -20260904T070805Z-1-004` và skill `/lg-brand` có sẵn).

---

## 9. YÊU CẦU CỦA CHỊ HIỀN (SUY RA TỪ FILE, CẦN XÁC NHẬN)

> Các ý dưới đây **suy ra từ chữ trong file**, ví dụ "Cải tiến mới", "Theo yêu cầu mới", "Chuẩn Hóa LGEVH". Đây không phải bản ghi các cuộc trò chuyện trước. Agent tiếp theo nên đọc cho chị Hiền duyệt lại và hỏi thêm có yêu cầu nào bị thiếu không.

| # | Yêu cầu | Bằng chứng trong file |
|---|---|---|
| R-01 | Chuyển từ đăng ký bằng reply email sang **đăng ký trực tiếp trên hệ thống/portal** | Bảng cải tiến Tab 5 (1416–1418); text "Employees register DIRECTLY on the online portal" (877) |
| R-02 | **Giữ nguyên các tiêu chí đăng ký gốc** khi chuyển sang portal | "with original registration criteria preserved" (877) |
| R-03 | **Tách "Họ tên người nộp tiền" và "Mã NV người nộp tiền" thành 2 trường độc lập** (không gộp 1 ô) | Nhắc ở Tab 1 (820, 839–840), Tab 2 (918, 923, 996, 1005), Tab 3 (1090, 1096, 1170–1173, 1283–1284), Tab 4 (1367), Tab 5 (1394, 1423) |
| R-04 | Bảng tổng hợp phải **tách 2 cột người nộp tiền** để PM & Kế toán đối soát sao kê | 1284 |
| R-05 | Có **mẫu biểu xác nhận nộp tiền + upload file biên lai** (ảnh/PDF) ở bước 3 | Tab 3; bảng cải tiến (1428) |
| R-06 | Hỗ trợ **nộp hộ** (người nộp khác người đăng ký) | Ghi chú trường 8 (998); dòng mẫu #003 |
| R-07 | **Ghi nhận timestamp hệ thống** để xét "ai đến trước được trước", chấm dứt tranh chấp thứ tự email | 828, 1365, 1433 |
| R-08 | **Thông báo trước 24h** kèm danh sách sản phẩm và Slot ID | 825, 881, 1382 |
| R-09 | Mỗi sản phẩm có **mã Slot ID cố định** (#001, #002…) | Tab 4 (1295) |
| R-10 | **Hạn mức 01 SP/NV**; **cam kết Jeong-Do**, cấm bán lại | 829, 862, 1017 |
| R-11 | Cú pháp chuyển khoản bắt buộc có Mã NV, Họ tên, Model, Slot/STT | 851, 901 |
| R-12 | Có **bản text copy vào Outlook** cho thư thông báo | 872–911 |
| R-13 | **Xuất danh sách ra Excel** | Nút 1044–1046 |
| R-14 | **In / xuất PDF** và **chế độ Đêm/Sáng** | 753–754 |
| R-15 | **Bảo mật SĐT/địa chỉ**, chỉ Vận chuyển & PM xem | 1366 |
| R-16 | **Công khai minh bạch** danh sách xác nhận cho toàn nhân viên kiểm tra | 1367 |
| R-17 | Có **SOP 4 bước** chuẩn hoá quy trình | Tab 5 |

**Quy tắc làm việc chung của chị Hiền (từ hồ sơ cá nhân chị đã lưu), agent nào cũng phải tuân thủ:**
- Không bịa số. Không chắc thì nói không chắc.
- Thiếu thì nói rõ thiếu vì sao; không bỏ qua, không ghi 0.
- Việc tự chạy chỉ được **THÊM**, không được **XOÁ**. Không ghi đè file cũ; lưu bản mới.
- Lọc dữ liệu riêng tư trước khi đăng bất cứ đâu.
- **Nút GỬI luôn do chị Hiền bấm**: không tự gửi email, không tự đăng.
- Trả lời câu ngắn, ra lệnh trực tiếp, không lan man; không chép nội dung skill vào câu trả lời.
- Thông tin có thể thay đổi theo thời gian (quy định, luật…) phải tra cứu mới nhất trước khi nêu.
- Skill hay dùng: `/smart-thinking`, `/my-writing-style` (khi soạn thư/bài), `/lg-brand` (khi làm giao diện/slide mang thương hiệu LG), `docx/xlsx/pptx/pdf` khi cần xuất file.

---

## 10. LỖI, MÂU THUẪN VÀ KHOẢNG TRỐNG ĐÃ PHÁT HIỆN

Mức độ: **C** = nghiêm trọng (sai logic nghiệp vụ/kiểm soát), **L** = lỗi chức năng, **M** = mâu thuẫn nội dung / nhỏ.

### 10.1. Nghiêm trọng (sai logic kiểm soát)
| Mã | Mô tả | Vị trí | Hướng sửa |
|---|---|---|---|
| C-01 | Vừa đăng ký ở Tab 2 đã hiện trạng thái **"🟢 Đã Nộp & Xác Nhận"** dù chưa nộp tiền | 1645 | Trạng thái mới phải là "🟡 Chờ Nộp Tiền" |
| C-02 | Đăng ký **tự sinh mã giao dịch ngân hàng ngẫu nhiên**, lại là 2 số khác nhau giữa cột và modal | 1638, 1640 | Để trống "—" cho tới khi NV khai mã GD ở Tab 3 |
| C-03 | Không chặn **1 NV đăng ký nhiều lần** (vi phạm hạn mức 01 SP/NV) | 1607–1657 | Kiểm tra mã NV đã tồn tại trước khi ghi |
| C-04 | Không chặn **slot đã có người**; cả 5 slot đã "Đã Đăng Ký Mua" nhưng vẫn chọn được | 972–978, 1320–1356 | Vô hiệu hoá slot đã bán; báo "Slot đã hết" |
| C-05 | **Model và Slot không liên kết**: chọn được model lò vi sóng với slot Styler | 959–978 | Chọn slot sẽ tự xác định model (hoặc ngược lại) |
| C-06 | Nộp tiền xong chuyển thẳng "Đã Nộp & Xác Nhận"; **không có bước PM đối soát và duyệt** | 1691, 1715 | Thêm trạng thái "Đã khai nộp – Chờ PM đối soát", PM bấm Duyệt/Từ chối |
| C-07 | Không so **số tiền đã nộp với giá** của slot | 1668 | Cảnh báo khi lệch |
| C-08 | Modal biên lai hiển thị **khung "Vietcombank – chuyển khoản thành công" dựng sẵn**, không phải file thật. Nếu dùng thật dễ gây hiểu nhầm là chứng từ ngân hàng | 1452–1466 | Hiển thị đúng ảnh/PDF NV đã upload, ghi rõ "Ảnh do NV cung cấp, chưa đối soát" |
| C-09 | Không kiểm tra **khung giờ mở cổng** (10:00 31/07 – 17:00 02/08); nhãn "Đang mở Live" là chữ tĩnh | 924 | Kiểm tra giờ **máy chủ**, không dùng giờ máy khách |

### 10.2. Lỗi chức năng
| Mã | Mô tả | Vị trí |
|---|---|---|
| L-01 | Không có lưu trữ: F5 là mất dữ liệu | Toàn file |
| L-02 | SĐT (trường 6) và địa chỉ (trường 7) **nhập xong bị bỏ**, không lưu, không hiển thị ở đâu | 1610–1616 |
| L-03 | Giá suy từ `model.includes`, mặc định 1,850,000 nếu không khớp | 1621–1624 |
| L-04 | Không kiểm tra định dạng mã NV (VHxxxxx?), SĐT (10 số?) | 947, 984 |
| L-05 | Tự điền form nộp tiền chỉ chạy cho #001 và #003 | 1585–1604 |
| L-06 | Có thể gửi xác nhận nộp tiền **không kèm file** (input file ẩn, không `required`, tự bịa tên file) | 1131, 1672 |
| L-07 | Ghi "kéo thả" nhưng chưa có xử lý drag & drop | 1126 |
| L-08 | Ghi "tối đa 10MB" nhưng không kiểm tra dung lượng | 1129 |
| L-09 | "Tải File Biên Lai" chỉ là `alert` | 1471 |
| L-10 | Bộ lọc "Chờ Nộp" không bao giờ có kết quả | 1747–1748 |
| L-11 | Timestamp lấy **giờ máy người dùng**, chính xác tới **giây**; trang lại ghi "máy chủ, mili-giây" | 1618–1619 vs 1365 |
| L-12 | Không có phân quyền; mọi người thấy mọi thứ | – |
| L-13 | **Lỗ hổng chèn mã (XSS):** dữ liệu người dùng gắn thẳng vào `innerHTML` và vào chuỗi `onclick`; tên có dấu nháy đơn (vd. "O'Neil") làm hỏng nút | 1629–1646, 1682–1689, 1699–1716 |
| L-14 | Xuất CSV bằng `data:` URI + `encodeURI`; ký tự `#` có thể cắt file; cột file xuất chữ nút | 1762–1773 |
| L-15 | Reset form không xoá cờ `userModified` nên hết tự đồng bộ người nộp tiền | 1553–1559 |
| L-16 | Dùng `alert()` chặn màn hình; nên thay bằng thông báo trong trang (toast) | 1653, 1674, 1471 |
| L-17 | Chế độ tối: khung trường 8/9 (#EFF6FF), khung upload hover (#FFF0F3), bảng modal (#F8FAFC, #FFF) vẫn nền sáng; badge cũng giữ màu sáng | 994, 1003, 551, 1452–1453 |
| L-18 | Không lưu lựa chọn Đêm/Sáng | 1512–1519 |
| L-19 | Header không xuống dòng trên điện thoại (chưa có media query cho `.top-header`), dễ tràn | 65–76 |
| L-20 | "Xuất Excel" thực ra xuất .csv | 1045, 1773 |
| L-21 | `copyContent` không xử lý lỗi khi clipboard bị chặn | 1525 |
| L-22 | Class `.badge-payer` định nghĩa nhưng không dùng | 408–418 |
| L-23 | Tab 4 dùng badge xanh (`badge-status-ok`) cho chữ "🔴 Đã Đăng Ký Mua": màu và biểu tượng mâu thuẫn | 1320… |

### 10.3. Mâu thuẫn nội dung
| Mã | Mô tả | Vị trí |
|---|---|---|
| M-01 | Cú pháp CK: bản Việt dùng `[STT Ordinal]`, bản Anh dùng `[Slot ID]` | 851 vs 901 |
| M-02 | Thư nói bán DW, MWO & Styler, nhưng danh sách có thêm **Tủ lạnh GR-X257MC** | 819, 877 vs 964, 1351 |
| M-03 | Tiêu đề "Đợt T8/2026" nhưng mở cổng 31/07/2026 | 799 vs 826 |
| M-04 | Email nói "truy cập tab 2" (ngôn ngữ của mockup), khi thành hệ thống thật cần viết lại thành hướng dẫn truy cập link | 835, 852 |
| M-05 | Giờ nộp tự điền (10:15:00, 10:20:00) khác giờ trong bảng (10:04:12, 10:12:03) | 1594, 1602 vs 1201, 1237 |
| M-06 | Tên file CSV "Banh_Hang" sai chính tả | 1773 |
| M-07 | Ngân hàng chi nhánh Tây Hồ (Hà Nội) cho pháp nhân Hải Phòng; cần Tài chính xác nhận thông tin TK | 850 |
| M-08 | Mật khẩu file Excel = Mã NV: yếu và mỗi người một mật khẩu khác nhau thì không khả thi với 1 file gửi chung | 807 |
| M-09 | Địa chỉ ví dụ ở TP.HCM trong khi pháp nhân ở Hải Phòng (chỉ là placeholder, nên đổi cho sát thực tế) | 990 |
| M-10 | Tên "Mã Slot ID" và "STT Ordinal" dùng lẫn lộn; class `badge-ordinal` cho Slot ID | Nhiều nơi |

---

## 11. VIỆC CHƯA LÀM (BACKLOG, ƯU TIÊN)

> Thứ tự ưu tiên là đề xuất; chị Hiền quyết định.

### Ưu tiên 1: sửa prototype cho đúng logic (vẫn là file HTML, chưa cần backend)
1. Sửa C-01, C-02: đăng ký mới → trạng thái "🟡 Chờ Nộp Tiền", mã GD để trống.
2. Sửa C-03, C-04, C-05: chặn trùng NV, chặn slot đã bán, liên kết slot ↔ model ↔ giá bằng **một mảng dữ liệu JS duy nhất** thay vì viết cứng rải rác.
3. Sửa C-06: thêm cột thao tác PM "Duyệt / Từ chối / Yêu cầu bổ sung" và trạng thái trung gian.
4. Sửa C-07: cảnh báo số tiền lệch giá.
5. Sửa C-08, L-09: modal hiển thị đúng ảnh/PDF đã upload.
6. Sửa L-02: lưu SĐT, địa chỉ vào bản ghi (ẩn khỏi bảng công khai).
7. Sửa L-06, L-07, L-08: bắt buộc file, kéo thả, giới hạn 10MB.
8. Sửa L-13: escape dữ liệu, bỏ `onclick` dạng chuỗi.
9. Sửa L-14, L-20, M-06: xuất CSV bằng Blob, đúng tên file, cột file = tên file; hoặc xuất .xlsx thật.
10. Sửa M-01, M-02, M-03, M-10: thống nhất thuật ngữ và nội dung thư.
11. (Tuỳ chọn) lưu tạm bằng `localStorage` để demo không mất dữ liệu khi F5. **Chỉ dùng cho demo**, không phải lưu trữ thật.

### Ưu tiên 2: tuân thủ thương hiệu & trải nghiệm
12. Chạy `/lg-brand`: logo thật, font LG EI, màu chuẩn, kiểm tra bằng trình verifier của skill.
13. Sửa chế độ tối (L-17), responsive header (L-19), thay `alert` bằng toast (L-16).
14. Viết lại thư thông báo bằng `/my-writing-style` cho đúng giọng; bản Anh và Việt khớp nhau. **Chị Hiền tự bấm gửi.**

### Ưu tiên 3: thành hệ thống thật (cần IT và các bên duyệt)
15. Chọn nền tảng (mục 12.1) với IT LGEVH.
16. Xây backend + database theo mô hình dữ liệu (mục 12.2).
17. Đăng nhập bằng tài khoản công ty (SSO); phân quyền (mục 12.4).
18. Lưu file biên lai an toàn; nhật ký truy vết (audit log).
19. Domain/host nội bộ do IT cấp. **Không tự nhận `internalsales.lge.com`.**
20. Đánh giá bảo vệ dữ liệu cá nhân (mục 13.3) trước khi chạy thật.
21. Tạo file Excel danh sách sản phẩm thật (hiện không tồn tại), hoặc bỏ file đính kèm vì danh sách đã có trên portal.

### Ưu tiên 4: tài liệu đi kèm
22. SOP chính thức dạng .docx (có RACI, biểu mẫu, thời hạn).
23. Slide trình bày cải tiến quy trình cho TL/BOD (Slides hoặc .pptx, đúng `/lg-brand`).
24. Bài tạp chí nội bộ về case "minh bạch trong bán hàng nội bộ" (liên kết Jeong-Do).

---

## 12. ĐỀ XUẤT KIẾN TRÚC HỆ THỐNG THẬT (CHƯA LÀM, CHƯA DUYỆT)

> **Toàn bộ mục này là đề xuất của Claude để làm việc tiếp.** Chưa có gì được xây. Chưa biết LGEVH đang dùng nền tảng nào (M365, Google Workspace, hệ thống nội bộ riêng). Agent sau **phải hỏi chị Hiền/IT** trước khi chọn.

### 12.1. Ba phương án nền tảng
| Phương án | Mô tả | Ưu | Nhược | Hợp khi |
|---|---|---|---|---|
| A. Low-code M365 | Microsoft Forms/Power Apps + SharePoint List + Power Automate | Đăng nhập sẵn bằng tài khoản công ty, không cần server, IT dễ duyệt | Khó chặn trùng slot theo thời gian thực khi đông người; giao diện hạn chế | Công ty dùng Outlook/M365 (email @lge.com gợi ý Outlook, **chưa xác nhận**) |
| B. Google Workspace | Google Form/Apps Script + Google Sheets | Nhanh, rẻ | Có thể không được phép nếu công ty không dùng Google; dữ liệu cá nhân ra ngoài hệ thống công ty | Chỉ khi IT cho phép |
| C. Web app riêng | Frontend (dựa trên file HTML hiện có) + API (Node.js/Python) + CSDL (PostgreSQL/SQL Server) + lưu file, host nội bộ | Kiểm soát đầy đủ: timestamp máy chủ, khoá slot, audit log | Cần đội IT phát triển, vận hành, bảo mật | Quy mô lớn, bán định kỳ nhiều đợt |

### 12.2. Mô hình dữ liệu đề xuất (suy từ các trường trong file)

**`campaigns`**: đợt bán
`id` (vd. IS-2026-AUG-01) · `name` · `announce_at` · `open_at` · `close_at` · `bank_account_name` · `bank_account_no` · `bank_name` · `transfer_syntax` · `status` (DRAFT/ANNOUNCED/OPEN/CLOSED)

**`slots`**: từng suất hàng
`id` (#001…) · `campaign_id` · `category` · `model_code` · `description` · `rrp` · `internal_price` · `status` (AVAILABLE/RESERVED/PAID/DELIVERED/CANCELLED) · `version` (khoá lạc quan để chống 2 người giữ cùng slot)

**`registrations`**: đăng ký
`id` · `campaign_id` · `slot_id` (UNIQUE theo campaign) · `division` · `emp_code` (UNIQUE theo campaign, thực thi 1 SP/NV) · `emp_name` · `phone` (hạn chế xem) · `delivery_address` (hạn chế xem) · `payer_name` · `payer_emp_code` · `jeongdo_agreed` (bool) · `server_timestamp` (UTC+7, mili-giây, do máy chủ ghi) · `status` (PENDING_PAYMENT/PAYMENT_SUBMITTED/VERIFIED/REJECTED/EXPIRED/CANCELLED)

**`payments`**: khai nộp tiền
`id` · `registration_id` · `payer_name` · `payer_emp_code` · `amount` · `bank_name` · `txn_ref` · `paid_at` · `receipt_file_id` · `submitted_at` · `verified_by` · `verified_at` · `verify_note`

**`files`**: biên lai
`id` · `original_name` · `mime` · `size` · `storage_path` · `sha256` (chống sửa/đổi file) · `uploaded_by` · `uploaded_at`

**`audit_log`**: truy vết
`id` · `actor` · `action` · `entity` · `entity_id` · `before` · `after` · `at`

### 12.3. Luồng trạng thái đề xuất
```
AVAILABLE ──(NV đăng ký, trong giờ mở, chưa có đơn)──► PENDING_PAYMENT
PENDING_PAYMENT ──(NV khai nộp + upload)──► PAYMENT_SUBMITTED
PENDING_PAYMENT ──(quá hạn nộp X giờ*)──► EXPIRED ──► slot quay lại AVAILABLE
PAYMENT_SUBMITTED ──(PM/Kế toán đối soát sao kê khớp)──► VERIFIED ──► Logistics giao ──► DELIVERED
PAYMENT_SUBMITTED ──(không khớp)──► REJECTED / yêu cầu bổ sung
```
*\*Hạn nộp tiền sau khi đăng ký **chưa được quy định trong file**. Cần chị Hiền/PM quyết.*

### 12.4. Phân quyền đề xuất
| Vai trò | Được làm |
|---|---|
| Nhân viên | Đăng ký, xem và sửa đơn của mình, upload biên lai |
| PM Support | Tạo đợt, quản lý slot, xem toàn bộ, duyệt |
| Kế toán | Xem khoản nộp + biên lai, đối soát, xác nhận |
| Logistics | Xem đơn đã VERIFIED + SĐT/địa chỉ |
| Kiểm toán nội bộ / Jeong-Do | Chỉ đọc toàn bộ + audit log |
| Toàn nhân viên (bảng công khai) | Chỉ thấy Slot, Model, trạng thái, có thể thêm tên đã che một phần. **Cần cân nhắc, mục 13.3** |

### 12.5. API tối thiểu (nếu chọn phương án C)
`GET /campaigns/:id` · `GET /campaigns/:id/slots` · `POST /registrations` (máy chủ ghi timestamp, khoá slot trong transaction) · `GET /registrations/me` · `POST /registrations/:id/payment` (multipart kèm file) · `POST /payments/:id/verify` · `GET /campaigns/:id/export.xlsx` · `GET /audit?entity=…`

---

## 13. GÓC ĐỘ KIỂM SOÁT NỘI BỘ & JEONG-DO (ĐỀ XUẤT)

### 13.1. Rủi ro và kiểm soát
| Rủi ro | Kiểm soát trong thiết kế | Tình trạng prototype |
|---|---|---|
| Ưu tiên người quen, "giữ chỗ" trước giờ mở | Timestamp máy chủ; cổng chỉ mở đúng giờ; công bố danh sách slot trước 24h | Chỉ có trên chữ |
| 1 người mua nhiều suất (qua tên người khác) | UNIQUE mã NV; theo dõi người nộp hộ nộp cho nhiều đơn | Chưa có |
| Bán lại cho bên thứ 3 | Cam kết Jeong-Do; theo dõi địa chỉ giao trùng nhiều đơn | Có checkbox; chưa có theo dõi |
| Khai nộp tiền giả / biên lai sửa | Đối soát với sao kê ngân hàng thật; lưu hash file | Chưa có (và modal hiện đang "xác nhận" sẵn) |
| Sai lệch số tiền | So số tiền với giá slot | Chưa có |
| Lộ dữ liệu cá nhân | Phân quyền; không công khai SĐT/địa chỉ | Chưa có phân quyền |
| Sửa dữ liệu sau khi chốt | Audit log, khoá bản ghi sau VERIFIED | Chưa có |

### 13.2. Chỉ số theo dõi gợi ý
Số slot / số đăng ký / tỷ lệ nộp đúng hạn / tỷ lệ nộp hộ / số đơn bị từ chối đối soát / thời gian từ đăng ký đến giao hàng.

### 13.3. Bảo vệ dữ liệu cá nhân: phải kiểm tra trước khi chạy thật
- Luật Bảo vệ dữ liệu cá nhân (có hiệu lực từ 01/01/2026) và Nghị định 356/2025/NĐ-CP hướng dẫn thi hành đang áp dụng tại Việt Nam (đã tra cứu ngày 24/09/2026; xem nguồn cuối file).
- Hệ thống thu thập họ tên, mã NV, SĐT, địa chỉ, thông tin giao dịch ngân hàng và ảnh biên lai (có thể chứa số tài khoản cá nhân). Cần: thông báo mục đích xử lý, giới hạn người xem, thời hạn lưu, không công khai rộng.
- Yêu cầu "công khai bảng xác nhận cho toàn thể nhân viên kiểm tra" (R-16) **có thể xung đột** với yêu cầu bảo vệ dữ liệu. Đề xuất: bảng công khai chỉ hiện Slot, Model, trạng thái và tên đã che (vd. "Nguyễn T. Q. Như", mã NV che "VH1***5"); không hiện link biên lai công khai.
- **Claude không phải luật sư.** Cần bộ phận Pháp chế/Compliance LG xác nhận.

---

## 14. KỊCH BẢN KIỂM THỬ (ACCEPTANCE CRITERIA) ĐỀ XUẤT

| # | Kịch bản | Kết quả mong đợi |
|---|---|---|
| T-01 | Đăng ký hợp lệ trong giờ mở | Tạo đơn PENDING_PAYMENT, slot chuyển RESERVED, ghi timestamp máy chủ |
| T-02 | Đăng ký trước 10:00 31/07 hoặc sau 17:00 02/08 | Từ chối, báo ngoài giờ |
| T-03 | Cùng mã NV đăng ký lần 2 | Từ chối "Mỗi NV tối đa 01 sản phẩm" |
| T-04 | Hai người bấm cùng một slot gần như đồng thời | Chỉ người có timestamp sớm hơn thành công; người sau báo slot đã hết |
| T-05 | Chọn model không khớp slot | Không thể (slot quyết định model) |
| T-06 | Không tick cam kết Jeong-Do | Không gửi được |
| T-07 | Để trống trường 8/9 | Tự điền theo NV đăng ký; nếu xoá trống thì báo lỗi |
| T-08 | Nộp hộ: trường 8/9 khác trường 2/3 | Lưu đúng, bảng hiện 2 cột người nộp riêng, đánh dấu "Nộp hộ" |
| T-09 | Khai nộp tiền không kèm file | Báo lỗi, bắt buộc file |
| T-10 | File > 10MB hoặc sai định dạng | Báo lỗi |
| T-11 | Số tiền khai ≠ giá slot | Cảnh báo; PM thấy cờ lệch |
| T-12 | PM duyệt | Trạng thái VERIFIED, ghi người duyệt + giờ + audit log |
| T-13 | PM từ chối | REJECTED kèm lý do, NV được thông báo |
| T-14 | Quá hạn nộp | EXPIRED, slot mở lại |
| T-15 | Lọc "Chờ nộp" | Ra đúng các đơn PENDING_PAYMENT |
| T-16 | Xuất Excel | File mở đúng tiếng Việt, đủ cột, cột file có tên file thật |
| T-17 | Nhập tên có dấu nháy hoặc thẻ `<script>` | Hiển thị đúng chữ, không chạy mã |
| T-18 | NV thường xem bảng công khai | Không thấy SĐT, địa chỉ, biên lai của người khác |
| T-19 | Chế độ tối | Mọi khung đọc được, không còn nền trắng chói |
| T-20 | Màn hình điện thoại 375px | Không tràn ngang |
| T-21 | In / PDF | Ra bản sạch, đúng thương hiệu |

---

## 15. CÂU HỎI CẦN CHỊ HIỀN TRẢ LỜI / THÔNG TIN CẦN XÁC MINH

1. Có yêu cầu nào đã trao đổi trong các chat trước mà mục 9 **chưa ghi**? (Chat lập file này không đọc được chat cũ.)
2. Mục tiêu tiếp theo: (a) chỉ hoàn thiện prototype để trình bày, hay (b) chuẩn bị đặc tả cho IT xây hệ thống thật, hay cả hai?
3. Công ty dùng nền tảng nào (M365/SharePoint, Google, hệ thống nội bộ)? IT có cho phép công cụ nào?
4. Số tài khoản `0991000012525`, chi nhánh Tây Hồ, tên pháp nhân có **đúng** không? (Tài chính xác nhận.)
5. Email liên hệ hỗ trợ chính thức là `internalsales.support@lge.com` (đã chuẩn hoá bí danh chung, không dùng tên cá nhân).
6. Danh sách model, RRP, giá nội bộ, số slot của đợt thật là gì? (Số trong file là mẫu.)
7. Danh sách bộ phận thật của LGEVH?
8. Hạn nộp tiền sau khi đăng ký là bao lâu? Quá hạn xử lý thế nào?
9. Có giữ Tủ lạnh trong đợt không (mâu thuẫn M-02)?
10. Cú pháp CK cuối cùng dùng "Slot ID" hay "STT Ordinal" (M-01)?
11. Bảng công khai được hiện tới mức nào (tên đầy đủ, mã NV, link biên lai)? Pháp chế đã ý kiến chưa?
12. File Excel đính kèm còn cần không? Nếu cần, bảo vệ bằng cách nào (thay mật khẩu = Mã NV)?
13. Phạm vi nhân viên: chỉ LGEVH (Hải Phòng) hay toàn LG Việt Nam? (Thư gửi `all.vietnam@lge.com`.)
14. Có muốn đổi tên file cho rõ (vd. `Internal_Sales_Portal_v2.html`) và giữ bản cũ không?

---

## 16. CÁC FILE KHÁC TRONG THƯ MỤC `C:\LG VAN PHONG AI`

> Chỉ liệt kê tên; **chưa mở và không thuộc dự án này**, trừ khi chị Hiền nói khác.

- Ảnh: `1.jpg`, `2.jpg`, `3.jpg`, `HANG1.jpg`, 7 ảnh tên dài dạng `1788…jpg` / `1789…jpg` / `1790…jpg`
- Demo thương hiệu: `demo1_slide.png`, `demo2_poster.png`, `demo3_social.png`; thư mục `Claude outputs/` (có `demo1_slide.png`)
- HTML khác: `email_template_morning.html`, `newsletter_preview.html`, `LG_ban-tin-XNK_5-slides.html`
- PowerPoint (market/shop visit 22/09/2026): `Market_Visit_DMX_Van_Phuc_22_09_2026.pptx`, `Market_Visit_Vinh_Yen_22_09_2026.pptx`, `…_EN.pptx`, `…_Report.pptx`, `Shop Visit 22 09 2026_V9 Final.pptx`
- Skill: `lg-brand.skill`, `smart-thinking.skill`
- Notebook rỗng: `Untitled-1.ipynb`, `Untitled-2.ipynb`
- Tài liệu thương hiệu: `BI 10.2023 -20260904T070805Z-1-004/BI 10.2023/Brand Communication Guidelines_V5.1_EN_3/`

---

## 17. HƯỚNG DẪN CHO AGENT TIẾP THEO

1. Đọc hết file này. Mở `C:\LG VAN PHONG AI\Mau_Thu_Dang_Ky_Internal_Sales.html` để đối chiếu (số dòng trong file này khớp bản 75.983 byte ngày 17/09/2026; nếu file đã đổi, số dòng có thể lệch).
2. Hỏi chị Hiền các câu ở mục 15 (ít nhất câu 1, 2), dùng câu hỏi trắc nghiệm ngắn.
3. **Không ghi đè file gốc.** Lưu bản sửa thành file mới (`…_v2.html`).
4. Sửa theo backlog mục 11, ưu tiên 1 trước. Mỗi thay đổi ghi lại vào một mục "Nhật ký thay đổi" cuối file bàn giao này.
5. Khi làm phần giao diện mang thương hiệu LG, dùng `/lg-brand`. Khi soạn thư thông báo, dùng `/my-writing-style`. Áp dụng `/smart-thinking`.
6. Không tự gửi email, không tự đăng lên đâu. Chị Hiền bấm gửi.
7. Không đưa số liệu giá/tài khoản ra ngoài như số thật khi chưa được xác nhận.
8. Mở trang bằng trình duyệt để tự kiểm tra sau mỗi lần sửa (chạy các kịch bản ở mục 14).

**Prompt mẫu để dán vào chat mới:**
```
Tôi đang làm dự án "Cổng Đăng Ký Bán Hàng Nội Bộ LG". Đính kèm file bàn giao
HANDOVER_Internal_Sales_Portal.md và file Mau_Thu_Dang_Ky_Internal_Sales.html.
Đọc hết file bàn giao trước. Hỏi tôi các câu ở mục 15 còn chưa trả lời.
Sau đó làm tiếp backlog mục 11, ưu tiên 1. Lưu bản mới, không ghi đè bản cũ.
```

---

## 18. NHẬT KÝ THAY ĐỔI

| Ngày | Người | Nội dung |
|---|---|---|
| 17/09/2026 | (chưa rõ) | Bản HTML hiện tại được lưu lần cuối trên máy |
| 24/09/2026 | Claude | Lập file bàn giao này từ việc đọc toàn bộ mã nguồn. Chưa sửa code |
| 28/09/2026 | Claude (v2) | Bộ phận: 173 phòng ban kèm ô tìm nhanh; sửa 2 tên có dấu cách thừa |
| 28/09/2026 | Claude (v3) | Thêm trường 4 Kho; nạp 43 model và 90 slot; liên kết Model ↔ Slot |
| 28/09/2026 | Claude (v4) | Gắn slot với kho (WH); bỏ hiển thị giá bán ở mọi nơi |
| 28/09/2026 | Claude (v5) | Bỏ trường 9, 10 (người nộp tiền) khỏi form đăng ký |
| 28/09/2026 | Claude (v6) | Áp nhận diện LG: logo gốc, font LG EI, bảng màu LG.com web; bỏ gradient và emoji |
| 28/09/2026 | Claude | Thêm `data/LG_Internal_Sales_Database.xlsx` (file tổng hợp đăng ký) |
| 28/09/2026 | Claude (v7) | Nối Google Sheet qua Apps Script (`apps-script/Code.gs`, hướng dẫn `docs/SETUP_APPS_SCRIPT.md`); sửa lỗi C-01 (đơn mới hiện "Chờ nộp tiền") và C-02 (bỏ mã GD ngẫu nhiên); Tab 3 nạp đủ 90 slot, điền sẵn thông tin sau khi đăng ký |
| 28/09/2026 | Claude (v7.1) | Chặn trùng slot ở máy chủ (đơn Hủy/Từ chối thì mở lại slot); cột F–I sheet Slots chỉ tính đơn còn hiệu lực |
| 28/09/2026 | Claude (v7.2) | Tab điều hướng đậm hơn (nút viền đen, tab đang chọn màu Heritage Red) |
| 28/09/2026 | Claude (v7.3) | Chịu tải tốt hơn (khoá ngắn, bộ nhớ đệm, tự gửi lại khi bận); tra cứu đơn bằng Mã NV + 4 số cuối SĐT; thay dữ liệu mẫu cũ ở Tab 1, 3, 4 bằng 90 slot thật; khoá cột trên sheet; thêm sheet PM xử lý |
| 30/09/2026 | Claude (v8) | Thêm file `Mau_Dang_Ky_Internal_Sales_3009.html` (chưa thay `index.html`). Tab 3: nộp tiền chỉ mở sau 2 giờ kể từ lúc đăng ký, qua nút Nộp tiền ở Tra cứu đơn (hằng `PAY_OPEN_DELAY_HOURS`); kéo thả biên lai; ô tick "người nộp tiền giống người đăng ký"; hiện số tiền cần nộp và cảnh báo khi khai lệch. Tab 2: chọn sản phẩm bằng thẻ (lọc kho, loại hàng, tìm model, sắp xếp giá), đưa bước chọn sản phẩm lên đầu. Tab 4: lọc kho, cột "Đăng ký nhanh" với link Đặt hàng sang Tab 2 điền sẵn. |
| 01/10/2026 | Antigravity AI (v8 Production) | Hoàn thiện 100% Phase P0-P7 & P4.6: Quản lý mật khẩu linh hoạt kép (Admin đổi trực tiếp Sheet Cột B + User đổi qua SHA-256); Mở cổng thanh toán (PM Allow Payment Gate); Cache 2 tầng SWR đạt 903.7 req/s; Email tự động LG V5.2 và Watchdog 24h. Kiểm thử tự động Playwright 4/4 suites pass 100%. File chính thức: `Mau_Dang_Ky_Internal_Sales_3009.html`. |
| 04/10/2026 | Antigravity AI (v8.2 Phase P8) | Hoàn thiện toàn diện Quy trình Chuẩn bị Go-Live (Phase P8): Adaptive polling 6–8s & cross-tab sync chống tranh chấp slot; Sinh mã đợt bán thông minh tự động (12 phân khúc ngành hàng, chống trùng lặp, tính Quý chuẩn); Nạp Excel kho vận đa định dạng lọc chính xác 10 cột vàng từ template PM; Đồng bộ 12 cột CSDL `Products` & 10 cột `Programs`; Sửa logic 24h Watchdog đếm từ `gateOpenTime`; Tích hợp 1-click trigger installer `setupWatchdogTrigger()`; Xây dựng bộ kiểm thử tự động E2E (`node tests/run_e2e_tests.js`) đạt 54/54 PASS (100%). |

---

## NGUỒN

- Mã nguồn: `C:\LG VAN PHONG AI\Mau_Thu_Dang_Ky_Internal_Sales.html` (75.983 byte, 1.780 dòng)
- [Nghị định 356/2025/NĐ-CP – Công báo Chính phủ](https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-356-2025-nd-cp-468371.htm)
- [EY Việt Nam – Tin nhanh pháp lý tháng 3/2026 về Nghị định 356/2025/NĐ-CP](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-so-356-2025-nd-cp-quy-dinh-chi-tiet-mot-so-dieu-va-bien-phap-thi-hanh-luat-bao-ve-du-lieu-ca-nhan)
- [Luật sư Việt Nam – Thay đổi trong xử lý dữ liệu cá nhân từ 01/01/2026](https://lsvn.vn/mot-so-thay-doi-can-luu-y-trong-xu-ly-du-lieu-ca-nhan-tu-01-01-2026-a167892.html)
