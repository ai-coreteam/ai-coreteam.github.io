# v3 (giao diện điện thoại): hồ sơ tạm dừng, chờ quyết định

> **Mục đích:** quay lại việc v3 bất cứ lúc nào mà không thiếu gì. Đọc trang này trước, rồi mới mở báo cáo chi tiết.
> **Trạng thái (11/10/2026):** chủ dự án đã trả lời đủ 6 câu (§2). **Đợt 0 + Đợt 1 làm xong ở bản web v2.5.0** (§8). Đợt 2–3 chờ duyệt.
> **Điểm xuất phát code:** tag **`v2.4.1`** (11/10: dùng bản mới nhất; trước ghi `v2.4.0` sẽ làm mất bản sửa cột "Giảm") (= `v2-final` + tiếng Anh; ở tiếng Việt DOM trùng `v2-final` 56/56 màn hình). Mọi việc v3 làm trên nhánh mới tạo từ tag này.

---

## 1. Đã làm xong
| Việc | Kết quả | Ở đâu |
|---|---|---|
| Chốt v2 | Tag `v2-final`; `docs/CURRENT_STATE.md` cập nhật 07/10 | git, `docs/CURRENT_STATE.md` |
| Giả lập điện thoại | iPhone 13 (390×664) + Galaxy S8 (360×740), 22 màn hình, có số đo | `design/v3/mobile_audit/`, `scripts/mobile_audit.py` |
| Báo cáo giao diện điện thoại | 10 phát hiện của Nhân viên (N1–N10), 3 phát hiện của PM (P1–P3), đề xuất A1–A5 / B1–B4 / C1–C3 | `design/UI_V3_MOBILE_AUDIT.md` §0–§6 |
| Đối chiếu bằng ảnh thật Android | 22 ảnh: xác nhận 9/11 phát hiện, sửa lại 1, chưa kiểm 1; phát hiện thêm **3 lỗi số liệu (R1–R3)** và **5 điểm mù giao diện (R4–R9)** | `design/UI_V3_MOBILE_AUDIT.md` §7 · ảnh gốc + ảnh ghép chỉ có trên máy: `Phone test (Android)/` và `…/_evidence/` (**không commit**: có dữ liệu cá nhân; đã thêm vào `.gitignore`) |
| Trả lời "điện thoại có ảnh hưởng máy tính không" | Không, ngoại trừ 2 trường hợp (§3) | trang này |

---

## 2. Sáu câu hỏi chờ chủ dự án trả lời
| # | Câu hỏi | Lựa chọn | Đề xuất của Claude | Trả lời |
|---|---|---|---|---|
| **Q1** | Thanh danh mục HOT/NEW (Ưu đãi độc quyền, TV & Loa, Tủ lạnh…): bấm vào **không lọc**, chỉ chuyển sang tab 2 (N8) | (a) Ẩn trên điện thoại · (b) Làm thành bộ lọc thật (thay đổi chức năng) | (a) ở đợt 1; cân nhắc (b) ở đợt 2 | ✅ (a) Ẩn trên điện thoại — làm ở v2.5.0 |
| **Q2** | Làm gì trước ngày mở bán 14/10? | (a) Đợt 1 (A1–A5, chỉ CSS) · (b) Không đổi gì trước mở bán | (a) | ✅ (a) Đợt 1 — làm ở v2.5.0, **trừ A5** (xem §8) |
| **Q3** | Thanh tab trên điện thoại | (a) Giữ lưới 2×2 ở đầu trang · (b) Thanh tab cố định ở đáy màn hình | (a); để (b) sau | ✅ (a) Giữ lưới 2×2 |
| **Q4** | Tab 1 ghi cứng "90 sản phẩm (43 model)" (N10) | Lấy số thật từ danh mục · Sửa tay | Lấy số thật (đổi chữ trên cả máy tính, xem §3) | ✅ Web tự lấy số thật từ danh mục — làm ở v2.5.0 (cả máy tính) |
| **Q5** | **Đợt 0: sửa 3 lỗi số liệu** R1 (badge tab 3 "0 Đơn"), R2 (KPI PM "Tổng SP 0 · 0.0%"), R3 ("Tổng tiền đã nộp" cộng cả đơn chưa nộp) | Duyệt · Không duyệt | Duyệt, **trước 14/10**. Đây là lỗi có cả trên máy tính; chỉ sửa cách tính và nhãn, không đổi dữ liệu máy chủ | ✅ Duyệt — làm ở v2.5.0 |
| **Q6** | Đợt bán 14/10 có khoảng **bao nhiêu sản phẩm**? | Con số | Quyết định độ ưu tiên của B1 (thẻ gọn): 6 SP thì gọn sẵn, 50 SP thì phải cuộn 45 màn hình | **50–100 sản phẩm** → B1 (thẻ gọn) thành ưu tiên số 1 của Đợt 2 (chờ duyệt) |

**Thêm (không bắt buộc):** chụp ảnh trên **1 iPhone thật** và **cửa sổ "Nộp tiền ngay"**, để kiểm N5 (iPhone tự phóng to ô nhập) và N6 (form 2 cột).

---

## 3. Cam kết về giao diện máy tính (đã trả lời chủ dự án 07/10)
- Mọi thay đổi cho điện thoại nằm trong điều kiện **`@media (max-width: 719px)`**: màn hình máy tính (≥ 1024px) không chịu ảnh hưởng. Bản v2.0.4 đã dùng đúng cách này.
- **Ngoại lệ 1:** Đợt 0 (R1–R3) **đổi con số** trên máy tính, vì là lỗi có cả ở máy tính. Bố cục không đổi. Cần duyệt (Q5).
- **Ngoại lệ 2:** cửa sổ trình duyệt máy tính thu hẹp dưới 720px sẽ hiện bố cục điện thoại. Bản v2 hiện tại cũng như vậy.
- Thay đổi về **chữ** (Q4, R9 "Đang gửi…" → "Đang tải đơn…") sẽ chỉ áp dụng trên điện thoại, nếu chủ dự án muốn máy tính giữ nguyên tuyệt đối.

**Tiêu chí nghiệm thu bắt buộc mỗi lần phát hành v3:**
1. Tạo nhánh từ `v2.4.0`.
2. So máy tính trước/sau ở **1920 / 1440 / 1280 / 1024px**, cả 3 vai trò, các tab chính, sáng và tối:
   - **Thuộc tính hiển thị của từng phần tử phải giống hệt.**
   - **Ảnh chụp phải trùng từng điểm ảnh** (che đồng hồ và thời gian thay đổi theo giây).
3. Ba bộ test (hồi quy mặc định và `?ui=v1`, e2e, harness) đều đạt.
4. Khác biệt nào ngoài Đợt 0 đã duyệt → **dừng, báo, không phát hành**.

---

## 4. Số đo gốc để so sánh sau khi sửa
| Chỉ số | Hiện tại (v2-final) | Đích |
|---|---|---|
| Đầu trang trên điện thoại | 357px = 54% màn hình đầu | ≤ 120px |
| Vị trí ô 03 "Đơn hàng của bạn" | màn hình thứ 2,0 | màn hình 1 |
| Danh mục 50 SP | 45 màn hình (iPhone 13) · 41,9 (S8) | ≤ 15 |
| Ô nhập < 16px | 19/19 | 0 |
| Nút trợ lý ảo đè "Xác Nhận Nộp Tiền" | 1.560px² | 0 |
| Khung phải vuốt ngang | 4 bảng | 0 trên điện thoại |
| R1 badge tab 3 | "0 Đơn" khi có đơn | = số đơn trên máy chủ |
| R2 KPI "Tổng SP" | 0 (ảnh A3) | = số SP của chương trình |
| R3 "Tổng tiền đã nộp" | cộng mọi đơn | chỉ đơn "chờ đối soát" + "đã duyệt" |

Chạy lại số đo: `python3 scripts/mobile_audit.py "iPhone 13"` và `"Galaxy S8"` → `design/v3/mobile_audit/*_metrics.json`.

---

## 5. Nguyên nhân 3 lỗi số liệu (đã kiểm bằng code, để sửa nhanh khi được duyệt)
| # | Vị trí code (tại `v2-final`) | Nguyên nhân |
|---|---|---|
| R1 | `Mau_Dang_Ky_Internal_Sales_3009.html`: dòng 12555 (ghi `tab3-count-badge`) | Chỉ đếm số dòng `#confirmation-tbody` (đơn gửi từ máy này qua form tab 2). Không đọc `myServerOrders` / tra cứu máy chủ |
| R2 | `calculateRegionalStats` (dòng 8443), `calculatePMStats` (9843), `loadProducts` (9173) | Tổng SP = `currentProducts` chỉ khi đúng chương trình, nếu không thì dùng demo (rỗng). `loadProducts` **không gọi lại** `calculatePMStats` khi danh mục tải xong |
| R3 | bảng PM, dòng 10485 (`Tổng tiền thanh toán đã nộp`) | Cộng `r.amount` của mọi đơn đang lọc. Máy chủ luôn trả `amount` = giá sản phẩm, kể cả khi chưa nộp |

---

## 6. Việc tồn đọng khác (từ lúc chốt v2, xem hàng `v2-final` trong `docs/04-v1-hardening/README.md`)
1. Nạp Excel: giá nhập **dạng chữ** kiểu Việt Nam (`24.900.000`) bị đọc thành 24,9 đ. Đề xuất chỉ giữ chữ số (cần duyệt).
2. Email Apps Script ghi tiền bằng `toLocaleString('vi-VN')`: chưa kiểm hiển thị thật.
3. Mã DVH09B / 34WP65C trong file mẫu không có trên LG.com (có thể là DVHP09B / 34WP65G-B).
4. **Trước 14/10:** xoá dữ liệu test trong sheet chính thức (serial `TEST-…`, đơn test, chương trình test).

---

## 7. Việc song song: tiếng Anh (VI/EN)
**ĐÃ LÀM XONG 08/10 (bản `v2.4.0`)**: [`design/I18N_EN_FEASIBILITY.md`](I18N_EN_FEASIBILITY.md) §9. Khi làm v3: mọi chữ mới hoặc đổi phải thêm vào `assets/i18n/en_source.json`, chạy `python3 scripts/i18n_build.py` và `python3 scripts/i18n_collect.py` (= 0). So sánh máy tính trước/sau ở §3 dùng tag `v2.4.0` làm bản gốc.

---

## 8. Kết quả bản web v2.5.0 (11/10/2026)
**Nhánh** `v2.5-phone-fixes`, tạo từ `v2.4.1`, đưa lên ngang `main` (79c9780). Apps Script **không đổi** (Version 10).

### 8.1 Đã làm
| Mục | Trước | Sau | Kiểm bằng |
|---|---|---|---|
| **Token "Mở bán ngay" / "Kết sổ" / Hẹn giờ** | Web không gửi `token`, máy chủ từ chối. Sheet thật: **0 dòng** `PROGRAM_OPEN/CLOSED` trong 101 dòng ActivityLog (05–10/10) | Gửi `token`, máy chủ giả nhận lệnh | `tests/v25_phone_fixes_test.py` §1 |
| R1 badge tab 3 | "0 Đơn" khi có đơn | = số đơn trên máy chủ, cùng bộ lọc với ô 03 | §2 |
| R2 KPI "Tổng SP" của PM | 0 khi danh mục tải sau (tái hiện: tải chậm 3,5 giây) | = số SP của chương trình | §3 |
| R3 dòng tổng bảng PM | "Tổng tiền thanh toán **đã nộp**" = mọi đơn | "Tổng giá trị đơn: X · Đã nộp (chờ đối soát + đã duyệt): Y" | §4 |
| B1 PM chưa có chương trình | Lỗi JS `Cannot read properties of null` | Không lỗi | §6 |
| B2 nút "Đôn đốc" | Báo "Đã gửi…", thực tế không gửi gì | Ẩn; nút "Hủy slot" giữ nguyên | §5 |
| B3 EN ô mật khẩu (bản chính thức) | "Nhập mật khẩu" | "Enter password" | §7 |
| B4 chế độ Đêm "Google Cloud Live" | Tương phản **1,03:1** | **9,45:1** | §8 |
| C3 (Q4) Tab 1 | Ghi cứng "90 sản phẩm (43 model) tại 3 kho…" | Số SP / model / kho thật của đợt đang xem (cả máy tính; EN tự dịch) | §9 |
| A1 đầu trang (điện thoại) | 285 px, 7 nút | **61 px**: logo · tên · EN · ☰ (bấm ☰ hiện lại đủ nút) | §10 |
| A2 ô 03 | Bắt đầu ở 1.393 px (màn 2,1) | **487 px (màn 1)** khi nhân viên có đơn | §10 |
| A3 "Nộp tiền ngay" | Link chữ 128×42 px | Nút đỏ rộng hết thẻ × 48 px; "Hủy giữ chỗ" dòng riêng 44 px | §10 |
| A4 nút trợ lý ảo | Che nút "Xác Nhận Nộp Tiền" | Ẩn khi mở cửa sổ / form nộp tiền; 52 → 44 px | §10 |
| Q1 thanh HOT/NEW | Hiện, không lọc | Ẩn trên điện thoại | §10 |
| R4 thanh chương trình | Đợt 2 bị cắt | Xuống dòng, thấy đủ (tên dài xuống dòng trong nút) | §10 |
| R8 "↗" và "·" ô 02 | Rơi dòng | Mỗi kho 1 dòng; "↗" đi cùng chữ | §10 + ảnh |

### 8.2 Không làm và lý do
- **A5 (ô nhập 16 px):** trang đã có `maximum-scale=1` trong thẻ viewport. Theo tài liệu cộng đồng, iPhone (Safari) **không** tự phóng to ô nhập khi có thẻ này. **[INFERRED]** Chưa kiểm trên iPhone thật vì chủ dự án chỉ có Android. Cách kiểm 30 giây: mượn 1 iPhone, mở link, chạm ô "Mã nhân viên". Nếu trang phóng to thì báo lại, sửa trong 1 dòng CSS.
- Đợt 2–3 (B1–B4 thẻ gọn / bảng → thẻ / form 1 cột, C1–C3 PM): **chờ duyệt**. Với Q6 = 50–100 SP, ưu tiên số 1 của Đợt 2 là **B1 thẻ gọn**, vì danh mục 50 SP hiện dài 44,5 màn hình.

### 8.3 Số đo điện thoại sau sửa (`scripts/mobile_audit.py`, iPhone 13 · Galaxy S8)
- Mọi màn: nút < 44 px giảm 4 (đầu trang).
- Khung phải vuốt ngang: bỏ thanh HOT/NEW. Còn lại bảng tab 3, tab 4 và bảng PM, thuộc Đợt 2 (B3).
- Màn PM ngắn đi khoảng 0,6 màn hình.

### 8.4 Máy tính không đổi
**144 trạng thái** = 4 độ rộng (1920 / 1440 / 1280 / 1024) × (v2, `?ui=v1`) × 3 vai trò (Nhân viên 4 tab, PM 4 màn, ADMIN) × Sáng / Đêm. Mỗi trạng thái chụp 3 lần: bản cũ `v2.4.1` × 2 để lọc nhiễu, bản mới × 1.
- Máy chủ giả trả 90 SP / 43 model / 3 kho, nên câu tab 1 mới (C3) **trùng chữ** với câu ghi cứng cũ. Nhờ vậy mọi khác biệt khác đều lộ ra.
- **Mọi vùng khác nhau đã được phân loại, 0 vùng không giải thích được:**
  - B4: 72 vùng, đúng chữ "Google Cloud Live" ở cả 72 trạng thái Đêm.
  - R3: 32 vùng, dòng tổng bảng PM.
  - B2: 37 vùng, cột thao tác bảng "Chưa nộp tiền".
  - Thanh HOT/NEW: 95 vùng. Đây là hoạt ảnh biểu tượng; bản cũ chụp 2 lần cũng khác nhau, đã xem ảnh để xác nhận.
- Không có lỗi JS ở cả 144 trạng thái.
- Lệnh chạy lại (script trong scratchpad của phiên 11/10, chưa đưa vào repo): xem `tests/v25_phone_fixes_test.py` cho phần chức năng.
