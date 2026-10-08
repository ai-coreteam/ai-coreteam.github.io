# v3 (giao diện điện thoại): hồ sơ tạm dừng, chờ quyết định

> **Mục đích:** quay lại việc v3 bất cứ lúc nào mà không thiếu gì. Đọc trang này trước, rồi mới mở báo cáo chi tiết.
> **Trạng thái (08/10/2026):** **TẠM DỪNG, chờ chủ dự án trả lời 6 câu hỏi ở §2.** Chưa có thay đổi nào trên web.
> **Điểm xuất phát code:** tag **`v2.4.0`** (= `v2-final` + tiếng Anh; ở tiếng Việt DOM trùng `v2-final` 56/56 màn hình). Mọi việc v3 làm trên nhánh mới tạo từ tag này.

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
| **Q1** | Thanh danh mục HOT/NEW (Ưu đãi độc quyền, TV & Loa, Tủ lạnh…): bấm vào **không lọc**, chỉ chuyển sang tab 2 (N8) | (a) Ẩn trên điện thoại · (b) Làm thành bộ lọc thật (thay đổi chức năng) | (a) ở đợt 1; cân nhắc (b) ở đợt 2 | ☐ |
| **Q2** | Làm gì trước ngày mở bán 14/10? | (a) Đợt 1 (A1–A5, chỉ CSS) · (b) Không đổi gì trước mở bán | (a) | ☐ |
| **Q3** | Thanh tab trên điện thoại | (a) Giữ lưới 2×2 ở đầu trang · (b) Thanh tab cố định ở đáy màn hình | (a); để (b) sau | ☐ |
| **Q4** | Tab 1 ghi cứng "90 sản phẩm (43 model)" (N10) | Lấy số thật từ danh mục · Sửa tay | Lấy số thật (đổi chữ trên cả máy tính, xem §3) | ☐ |
| **Q5** | **Đợt 0: sửa 3 lỗi số liệu** R1 (badge tab 3 "0 Đơn"), R2 (KPI PM "Tổng SP 0 · 0.0%"), R3 ("Tổng tiền đã nộp" cộng cả đơn chưa nộp) | Duyệt · Không duyệt | Duyệt, **trước 14/10**. Đây là lỗi có cả trên máy tính; chỉ sửa cách tính và nhãn, không đổi dữ liệu máy chủ | ☐ |
| **Q6** | Đợt bán 14/10 có khoảng **bao nhiêu sản phẩm**? | Con số | Quyết định độ ưu tiên của B1 (thẻ gọn): 6 SP thì gọn sẵn, 50 SP thì phải cuộn 45 màn hình | ☐ |

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
