# LG INTERNAL SALES PORTAL — DESIGN IMPROVEMENT PLAN PROPOSAL

> **📌 Trạng thái (cập nhật 05/10/2026):** Tài liệu **lịch sử** — phân tích / đề xuất tại thời điểm lập, **không** mô tả đúng 100% ứng dụng hiện nay. Thông tin hiện hành: [`docs/CURRENT_STATE.md`](../CURRENT_STATE.md); thay đổi v1: [`04-v1-hardening/`](../04-v1-hardening/README.md). **Mục 3B "Vùng Bất Khả Xâm Phạm" vẫn còn hiệu lực**; các ngoại lệ đã dùng ghi tại [`04-v1-hardening/README.md`](../04-v1-hardening/README.md).

**Đề Án Nâng Cấp Toàn Diện Thẩm Mỹ & Trải Nghiệm Giao Diện Cổng Bán Hàng Nội Bộ Theo Tiêu Chuẩn GRAP & LG.com Flagship**

* **Chủ nhiệm đề án (Design Lead):** Senior Principal Brand & UI/UX Designer *(30+ năm kinh nghiệm thiết kế nhận diện thương hiệu tại LG Electronics HQ)*
* **Tài liệu căn cứ (Framework):**
  - [DESIGN_GAP_ANALYSIS.md](docs/DESIGN_GAP_ANALYSIS.md) *(Bản phân tích 8 lỗ hổng thẩm mỹ cốt lõi)*.
  - [LG web sample GRAP.html](LG%20web%20sample/LG%20web%20sample%20GRAP.html) *(Chuẩn mực cổng thông tin nội bộ - Enterprise Internal Portal)*.
  - [LG.com/vn](LG%20web%20sample/www.lg.com/www.lg.com/vn/index.html) *(Chuẩn mực bán lẻ điện tử - Flagship Commercial Web)*.
  - *LG Electronics Brand Identity Guidelines V5.2* & *LG.com Global Web Style Guide v1.3*.
* **Mục tiêu tối thượng:** Xóa bỏ hoàn toàn "vẻ ngoài hành chính, thô cứng" của ứng dụng nội bộ; kiến tạo một không gian số sang trọng, ấm áp, đậm chất LG, đem lại cảm giác tự hào và đặc quyền VIP cho từng cán bộ nhân viên LGE.
* **Nguyên tắc kỹ thuật (Karpathy Epistemics):** Phẫu thuật từng phần (Surgical Execution), bảo toàn 100% logic nghiệp vụ cốt lõi (Hẹn giờ Timer, Phân quyền PM/User, Google Sheets Sync, Đăng ký/Thanh toán). Các hàm render hiển thị (`renderProductTable`, `renderBriefTopDashboard`) được mở rộng phần trình bày thị giác (thêm Cards Grid, đổi layout Card 03) — đây được phân loại là "nâng cấp thiết kế hiển thị" (design enhancement), không phải thay đổi logic nghiệp vụ. Đo kiểm thực nghiệm qua headless browser và lint thương hiệu.

---

## 1. TỔNG QUAN LỘ TRÌNH 6 GIAI ĐOẠN (THE 6 SPRINT ROADMAP)

```mermaid
gantt
    title Lộ Trình Nâng Cấp Thẩm Mỹ Toàn Diện & Động Học LG Internal Sales Portal
    dateFormat  YYYY-MM-DD
    section Sprint 1: Shell & GNB
    Tích Hợp Header Thống Nhất & Loại Bỏ Thanh Đen Prog-Nav :s1, 2026-10-02, 1d
    section Sprint 2: Hero Dashboard
    Khôi Phục Mỏ Neo Thẻ Đen Than Chì GRAP & Ô Số Chìm       :s2, 2026-10-03, 1d
    section Sprint 3: Quick Action Bar
    Xây Dựng Dải 8 Biểu Tượng Danh Mục Đĩa Tròn Chuẩn LG.com :s3, 2026-10-04, 1d
    section Sprint 4: Merchandising Cards
    Tái Thiết Thẻ Trưng Bày Sản Phẩm VIP & Phân Cấp Giá      :s4, 2026-10-05, 1d
    section Sprint 5: Tables & Controls
    Chuẩn Hóa Bảng Quản Trị GRAP & Nút Bấm Viên Thuốc       :s5, 2026-10-06, 1d
    section Sprint 6: Living Motion
    Thổi Hồn Động Học: Digital Logo Play, Kinetic Slogan, Micro-interactions :s6, 2026-10-07, 1d
```

---

## 2. CHI TIẾT KỸ THUẬT TỪNG GIAI ĐOẠN TRIỂN KHAI (TECHNICAL BLUEPRINTS)

### SPRINT 1: TÁI CẤU TRÚC SHELL & GIAO DIỆN HEADER THỐNG NHẤT (UNIFIED INTEGRATED HEADER)
* **Mục tiêu:** Khắc phục triệt để **GAP 1**, xóa bỏ thanh đen `.prog-nav` gây chia cắt thị giác, tạo dựng một Global Navigation Bar (GNB) thanh thoát, sang trọng như GRAP và LG.com.

#### 1. Thiết kế kiến trúc mới
- **Nền & Viền:** Nền trắng ngà ấm áp (`#FFFFFF`), viền đáy mỏng `1px solid #E6E1D6`, bóng đổ khuếch tán mềm mại `0 2px 12px rgba(38, 38, 38, 0.03)`.
- **Khóa Nhận Diện Thương Hiệu (Brand Lockup):**
  - Biểu tượng Logo LG gốc (PNG/SVG chuẩn có clear-space).
  - Vạch ngăn đứng thanh mảnh (Hairline Divider): `height: 28px; width: 1px; background: #E6E1D6; margin: 0 16px;`.
  - Khối định danh chữ:
    - Tiêu đề chính: `INTERNAL SALES PORTAL` (Font `LG EI Headline SemiBold`, 18px, màu `#262626`, letter-spacing `0.02em`).
    - Phụ đề thương hiệu: `Cổng Bán Hàng Đặc Quyền Nội Bộ · LG Electronics Vietnam` (Font `LG EI Text Regular`, 12px, màu `#716F6A`).
- **Bộ Chọn Chương Trình Mềm Mại (Program Capsule Selector):**
  - Thay thế thanh `.prog-nav` đen đặc bằng một cụm chọn chương trình dạng viên thuốc (`Capsule Pill Button`):
    - Đặt ngay bên cạnh tiêu đề hoặc thanh điều hướng.
    - Màu nền: Cát ấm `Warm Gray 2` (`#F0ECE4`), viền mỏng `1px solid #CBC8C2`.
    - Khi nhấp vào: Mở menu xổ xuống thanh lịch (`Dropdown Panel`) hiển thị danh sách các đợt bán hàng kèm huy hiệu trạng thái xanh/đỏ chuẩn mực.
- **Tiện ích người dùng (Right Utility Group):**
  - Nhóm người dùng: Chip định danh vai trò (`PM Quản trị` / `Nhân viên`) với bo tròn 999px, nút Đổi MK và Đăng xuất dạng icon tròn hoặc pill nhỏ 36px.
  - Công tắc Theme Đêm / Sáng dạng toggle tinh gọn.

---

### SPRINT 2: KHÔI PHỤC MỎ NEO THỊ GIÁC BỘ 3 THẺ HERO THEO NGUYÊN BẢN GRAP
* **Mục tiêu:** Khắc phục triệt để **GAP 2**, tái sinh "Bộ 3 Tri-Color Kinh Điển" của GRAP để tạo trọng lực thị giác vững chãi và quyền uy cho toàn bộ trang chủ.

#### 1. Cấu trúc 3 thẻ Hero Tri-Color chuẩn mực
```
+---------------------------+---------------------------+---------------------------+
|  THẺ 01: HERITAGE RED     |  THẺ 02: WARM SAND        |  THẺ 03: DARK CHARCOAL    |
|  Background: #A50034      |  Background: #F0ECE4      |  Background: #262626      |
|  [01]                     |  [02]                     |  [03]                     |
|  Thể Lệ & Chuyển Khoản    |  Tiến Độ Kho & Tồn Kho    |  Giám Sát Bán Hàng (PM)   |
|  • STK Vietcombank (Copy) |  • Đăng ký: 4 / 4 SP (100)|  +--------+ +--------+    |
|  • Cú pháp: [MãNV]_[Slot] |  • Thanh toán: 3/4 (75%)  |  | Tổng 4 | | Đã ĐK 4 |    |
|  • Hạn mức: 1 SP / NV     |  • Chi tiết AYA, AYB, AYC |  +--------+ +--------+    |
|                           |                           |  | Chờ 2  | | Duyệt 1 |    |
|  [Pill: 1 SP/NV]  [Mở →]  |  [Pill: Tồn kho]   [Mở →] |  [Pill: PM]        [Mở →] |
+---------------------------+---------------------------+---------------------------+
```

#### 2. Chi tiết kỹ thuật Thẻ 03 Đen Than Chì (`Dark Charcoal #262626`)
- **Nền:** `#262626` (Màu tối chuẩn thương hiệu LG, không dùng màu đen thuần `#000000` để tránh gắt thị giác).
- **Bo góc & Viền:** `border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);`.
- **4 Ô Chỉ Số Chìm (Sunken Metric Tiles):**
  - Hiển thị lưới 2×2:
    - Ô 1: `TỔNG SẢN PHẨM` $\rightarrow$ Số lớn: `4` (Font `LG EI Headline Bold`, 20px).
    - Ô 2: `ĐÃ GIỮ CHỖ` $\rightarrow$ Số lớn: `4` (100%).
    - Ô 3: `CHỜ NỘP TIỀN / SOÁT` $\rightarrow$ Số lớn: `2` (Màu vàng hổ phách nhẹ `#FAD45C`).
    - Ô 4: `ĐÃ DUYỆT BÀN GIAO` $\rightarrow$ Số lớn: `1` (Màu xanh dịu `#A5D6A7`).
  - Mỗi ô có nền chìm: `background: rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 8px 10px;`.
- **Dành cho vai trò Nhân viên (User View):**
  - Thẻ 03 chuyển sang hiển thị trạng thái đơn cá nhân: Model đã giữ chỗ, đồng hồ đếm ngược 24h nộp tiền nổi khối chìm, và nút xem biên lai.

---

### SPRINT 3: XÂY DỰNG DẢI 8 BIỂU TƯỢNG DANH MỤC ĐĨA TRÒN (CIRCULAR CATEGORY BAR) CHUẨN LG.COM
* **Mục tiêu:** Khắc phục triệt để **GAP 3**, mang linh hồn mua sắm hiện đại của LG.com vào cổng nội bộ, giúp nhân viên định hướng và lọc nhanh sản phẩm chỉ trong 1 cú chạm.

#### 1. Thông số kỹ thuật của Dải Biểu Tượng (`.lg-quick-category-bar`)
- **Vị trí đặt:** Nằm ngay dưới bộ 3 thẻ Hero Dashboard, đóng vai trò là "chiếc cầu nối" dẫn dắt vào danh mục hàng hóa.
- **Bố cục:** Lưới ngang 8 cột (`display: flex; justify-content: space-between; gap: 16px; overflow-x: auto; padding: 18px 0;`).
- **Cấu trúc từng đĩa tròn (`.cat-circle-item`):**
  1. **Đĩa biểu tượng (`.cat-disc`):**
     - Kích thước: `64px × 64px`, bo tròn tuyệt đối (`border-radius: 50%`).
     - Nền: Trắng sứ (`#FFFFFF`), viền mỏng `1.5px solid #E6E1D6`.
     - Bóng đổ: `box-shadow: 0 4px 12px rgba(38, 38, 38, 0.04);`.
     - Icon SVG bên trong: Kích thước 28px, màu than chì `#262626`, nét vẽ chuẩn `1.5px`.
  2. **Nhãn chữ bên dưới (`.cat-label`):**
     - Font: `LG EI Text Regular`, 12px, font-weight 600, màu `#4A4946`.
     - Canh giữa hoàn hảo dưới đĩa icon.
- **Danh sách 8 biểu tượng tinh hoa:**
  1. `Tất Cả Ưu Đãi` — Biểu tượng Tag giảm giá đỏ (`Ưu đãi đặc quyền`).
  2. `Tivi OLED & Loa` — Biểu tượng màn hình TV siêu mỏng & Soundbar.
  3. `Tủ Lạnh InstaView` — Biểu tượng tủ lạnh 2 cánh gõ cửa sáng đèn.
  4. `Máy Giặt WashTower` — Biểu tượng tháp giặt sấy đôi thông minh.
  5. `Điều Hòa UVnano` — Biểu tượng máy lạnh thanh lọc không khí.
  6. `Màn Hình & gram` — Biểu tượng laptop siêu nhẹ & màn hình UltraWide.
  7. `Quy Định Nộp Tiền` — Biểu tượng khiên bảo vệ & ví chuyển khoản.
  8. `Hỗ Trợ PM LGE` — Biểu tượng tai nghe tư vấn viên hoặc nhân vật hỗ trợ.
- **Hiệu ứng Micro-interaction:** Khi hover, đĩa tròn nhấc bổng lên 4px (`transform: translateY(-4px)`), viền chuyển sang màu Đỏ Heritage (`#A50034`), bóng đổ sâu hơn `0 8px 20px rgba(165, 0, 52, 0.15)`.

---

### SPRINT 4: TÁI THIẾT HỆ THỐNG THẺ TRƯNG BÀY SẢN PHẨM VIP (PRODUCT MERCHANDISING CARDS)
* **Mục tiêu:** Khắc phục triệt để **GAP 4**, biến Tab 2 từ một "bảng tính kê khai hàng hóa" khô khan thành một "Showroom ưu đãi cao cấp dành riêng cho người LG".

#### 1. Cấu trúc thẻ sản phẩm VIP (`.lg-product-card`)
- **Hình học:** Thẻ bo góc 20px (`border-radius: 20px`), nền trắng (`#FFFFFF`), viền `1px solid #E6E1D6`, padding 24px.
- **Nhãn độc quyền (Exclusive Tag):** Góc trên bên trái gắn nhãn `ƯU ĐÃI NỘI BỘ` hoặc `-42% VIP` (Font LG EI Text 11px, nền đỏ `#A50034`, chữ trắng, bo tròn 999px).
- **Tình trạng kho hàng (Stock Status):** Góc trên bên phải hiển thị kho AYA/AYB/AYC kèm chấm trạng thái (`● Còn 1 slot duy nhất` hoặc `● Đang mở đăng ký`).
- **Hình ảnh sản phẩm thực tế:** Ảnh sản phẩm độ phân giải cao, đặt trang trọng ở trung tâm với nền trắng sạch sẽ, tỷ lệ cân đối, có hiệu ứng zoom nhẹ (`scale(1.03)`) khi hover.
- **Thông tin sản phẩm:**
  - Tên Model: Font `LG EI Headline SemiBold`, 17px, màu `#262626`.
  - Dòng mô tả ngắn gọn: Tóm tắt 2 tính năng đắt giá nhất (ví dụ: *Công nghệ Door-in-Door 635L · Tiết kiệm điện Inverter*).
- **Hệ thống giá kép (Dual-Pricing Architecture) — Điểm nhấn đắt giá:**
  ```html
  <div class="price-container">
    <div class="price-retail-row">
      <span class="price-label">Giá niêm yết:</span>
      <span class="price-retail">42.990.000 đ</span>
      <span class="discount-pill">-42%</span>
    </div>
    <div class="price-internal-row">
      <span class="price-label-vip">Giá Ưu Đãi Nội Bộ:</span>
      <span class="price-vip">24.900.000 đ</span>
    </div>
  </div>
  ```
- **Nút hành động (Action CTA):** Nút bo tròn viên thuốc (`border-radius: 999px`), chiều cao 44px, phủ màu **Active Red (`#EA1917`)** rực rỡ với dòng chữ `Đăng Ký Mua Ngay →`. Khi sản phẩm đã hết slot, nút tự động chuyển sang màu xám trung tính `Đã Hết Hạn Mức`.

---

### SPRINT 5: CHUẨN HÓA BẢNG QUẢN TRỊ THEO GRAP & HỆ THỐNG NÚT BẤM VIÊN THUỐC
* **Mục tiêu:** Khắc phục triệt để **GAP 5, GAP 6, GAP 7 & GAP 8**, đưa bảng dữ liệu ở Tab 4 và Tab PM lên tầm cao thẩm mỹ doanh nghiệp của GRAP.

#### 1. Quy chuẩn bảng dữ liệu GRAP (Enterprise Table System)
- **Top Accent Line:** Viền trên cùng của thẻ bảng dày 2px màu than chì (`border-top: 2px solid #262626`).
- **Header Cells (`th`):** Nền màu xám sáng `Warm Gray 1` (`#F6F3EB`), font chữ `LG EI Text SemiBold`, cỡ 11px, màu `#4A4946`, padding `10px 12px`, canh giữa hoặc canh trái theo bản chất dữ liệu, không dùng viền kẻ dọc.
- **Data Rows (`td`):** Chiều cao hàng đồng đều 48px, viền đáy siêu mảnh `1px solid #E6E1D6`, font số định dạng thẳng cột (`font-variant-numeric: tabular-nums`).
- **Row Hover Effect:** Khi di chuột qua hàng, nền đổi sang màu xanh xám siêu nhẹ `#EAF1F8` (chuẩn GRAP) tạo cảm giác mượt mà và trực quan khi dò tìm đơn hàng.
- **Huy hiệu trạng thái Pastel GRAP:**
  - `Đã duyệt TT`: `.tb-badge.grn` (Nền `#DDF0DC`, chữ `#2F6B2E`, viền bo 4px).
  - `Chờ nộp tiền`: `.tb-badge.me` (Nền `#FFF6DD`, chữ `#8A6A00`, viền bo 4px).
  - `Chờ mở cổng TT`: `.tb-badge.blu` (Nền `#E3F2FD`, chữ `#1565C0`, viền bo 4px).
  - `Từ chối / Hết hạn`: `.tb-badge.hi` (Nền `#FDECEC`, chữ `#B03030`, viền bo 4px).
  - `Mã Slot / STT`: Huy hiệu tròn `.bdg` nền than chì chữ trắng nổi bật.

#### 2. Chuẩn hóa hệ thống nút bấm viên thuốc (Pill Buttons) & Icon 1.5px
- Toàn bộ các nút tác vụ trên trang được quy về 3 kích thước:
  - **Small (36px):** Nút xem biên lai, đổi mật khẩu, copy số tài khoản.
  - **Medium (44px):** Nút mở cổng TT, duyệt hàng loạt, hẹn giờ timer, nạp Excel.
  - **Large (52px):** Nút đăng ký mua tại modal và Hero Banner.
- Định hình hình học: **100% bo góc dạng viên thuốc (`border-radius: 999px`)**, loại bỏ các góc bo 4px/6px chắp vá.
- Màu sắc nút:
  - Nút Mua hàng / Kích hoạt chính: **Active Red (`#EA1917`)** nổi khối.
  - Nút Quản trị / Duyệt đơn: **Đỏ Heritage (`#A50034`)** hoặc **Xanh Rừng (`#287D00`)**.
  - Nút Phụ / Hẹn giờ / Xuất Excel: **Viền đen mảnh Outlined (`border: 1.5px solid #262626; color: #262626`)**, hover đảo nền đen chữ trắng sang trọng.

---

### SPRINT 6: THỔI HỒN ĐỘNG HỌC THƯƠNG HIỆU LG (THE LIVING BRAND & MOTION SYSTEM)
* **Mục tiêu:** Khắc phục triệt để **GAP 9**, đưa toàn bộ website từ trạng thái "tĩnh lặng đóng băng" bước vào kỷ nguyên "Living & Dynamic" của LG Brand Reinvention V5.2 mà vẫn giữ trọn vẹn sự trang nhã, không phá vỡ tính hài hòa (Harmonism).

#### 1. Nguyên Tắc Thiết Kế Động Học LG (Motion Philosophy & Safeguards)
- **3 Họ chuyển động chính thức:**
  - `adaptive` ("Adapt Flexibly"): Các thành phần nội dung trượt vào tuần tự và lắng đọng êm ái (`cubic-bezier(.22, .61, .36, 1)`).
  - `connected` ("Connect with Experiences"): Vạch tiến độ, thanh thời gian, mối liên kết quy trình được vẽ liên tục.
  - `fluid` ("Flow Organically"): Nhịp thở mềm mại, ánh sáng khuếch tán cho trạng thái sống (ambient pulse), tuyệt đối không giật cục.
- **Biện pháp bảo vệ tiếp cận (Accessibility Guard):**
  - Mọi hiệu ứng đều nằm dưới phạm vi `@media (prefers-reduced-motion: reduce) { * { animation-duration: 1ms !important; transition-duration: 1ms !important; } }`.

#### 2. Chi Tiết Kỹ Thuật 5 Điểm Chạm Chuyển Động Đắt Giá
1. **Trợ Lý Nổi Digital Logo Play Tương Tác (Floating Smart Concierge Widget):**
   - **Vị trí:** Góc dưới bên phải màn hình (`bottom: 24px; right: 24px; z-index: 9999;`).
   - **Cấu trúc:** Vòng tròn trắng nổi bật (`box-shadow: 0 8px 24px rgba(0,0,0,0.12); border: 2px solid #F0ECE4; width: 68px; height: 68px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #FFFFFF; cursor: pointer; transition: transform 0.35s cubic-bezier(.22,.61,.36,1);`).
   - **Asset chuyển động chính hãng:**
     - Bình thường: GIF mặt cười nhìn xung quanh tò mò (`LGE_Electronics_Digital_Logo_Play_Transparent_Black_LookingAround.gif`).
     - Khi hover: Chuyển sang nháy mắt hóm hỉnh (`Wink.gif`) kèm tooltip chào đón ấm áp: *"Chào bạn! Hôm nay bạn muốn khám phá ưu đãi nội bộ nào?"*.
     - Khi đăng ký / nộp tiền thành công: Đổi sang gật đầu tán thưởng (`Nodding.gif`).
     - Khi đồng bộ Google Sheets: Đổi sang xoay vòng tải trang (`Spinning.gif`).
   - **Quy chuẩn nhận diện:** Logo Master trên thanh GNB vẫn đứng yên trang nghiêm; Digital Logo Play đóng vai trò người bạn đồng hành sống động ở góc màn hình.
2. **Khẩu Hiệu Chuyển Động "Life's Good" (Kinetic Slogan Typography):**
   - **Vị trí:** Chân Hero Banner và Footer của trang web (tách rời khỏi Master Logo theo đúng Rule 5 của Brand Guidelines).
   - **Hiệu ứng:** Áp dụng component `headline-rise` từ `lg-motion`: Slogan với font LG EI Text SemiBold lướt nhẹ từ dưới lên với độ trong suốt mờ dần (`opacity: 0` $\rightarrow$ `1`, `translateY(16px)` $\rightarrow$ `0`) với thời lượng 900ms điềm đạm.
3. **Hiệu Ứng Nhảy Số Động Hero Numbers (`counter-hero`):**
   - Trong Thẻ Đen Than Chì GRAP (Thẻ 03), khi người dùng cuộn đến hoặc trang vừa tải xong, các chỉ số:
     - `4` Sản phẩm, `100%` Đăng ký, `2` Chờ duyệt, `1` Đã thanh toán sẽ nhảy mượt mà từ 0 lên giá trị thực trong vòng 600ms với thuật toán `easeOutQuad`.
4. **Vi Tương Tác Nâng Bổng (Micro-lift) Trên Dải Icon & Thẻ Sản Phẩm:**
   - **Dải đĩa tròn 64px:** Khi hover, đĩa tròn nhấc bổng lên 4px (`transform: translateY(-4px)`), viền chuyển từ `#E6E1D6` sang Đỏ Heritage `#A50034`, bóng mờ chuyển từ đen nhẹ sang ánh đỏ khuếch tán dịu dàng `0 8px 20px rgba(165,0,52,0.12)`.
   - **Thẻ sản phẩm:** Ảnh sản phẩm phóng to nhẹ `scale(1.03)` bên trong khung hình ẩn (`overflow: hidden; border-radius: 16px`), viền thẻ sáng nhẹ, tạo cảm giác sang trọng như chạm vào mặt kính pha lê.
5. **Hiệu Ứng Nhịp Thở Đồng Hồ Flash-Sale & Nút Bấm:**
   - Huy hiệu `Flash Sale 24h` có hiệu ứng nhịp thở quang học dịu nhẹ (`@keyframes lg-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.75; } }`).
   - Nút bấm viên thuốc khi hover: Mũi tên `→` dịch chuyển sang phải 4px (`transform: translateX(4px)`), nền màu Active Red đậm hơn một bậc (`#EA1917` $\rightarrow$ `#D01412`), tạo lực kích thích thôi thúc hành động.

---

## 3. MA TRẬN ĐỐI CHIẾU TIÊU CHÍ HOÀN TẤT (VERIFIABLE ACCEPTANCE CRITERIA)

Dựa trên nguyên tắc **Karpathy Epistemic & Drucker Principle ("If it cannot be measured, it cannot be managed")**, toàn bộ đề án nâng cấp sẽ được nghiệm thu qua các chỉ số đo lường thực nghiệm sau:

| STT | Hạng mục kiểm tra | Phương pháp đo kiểm | Tiêu chí đạt chuẩn (Pass Criteria) |
| :---: | :--- | :--- | :--- |
| **1** | **Bảo tồn tính toàn vẹn chức năng** | Chạy kịch bản kiểm thử Node CDP headless | • Đăng nhập PM & User hoạt động tức thì.<br>• Timer 3 tác vụ đếm ngược và tự động kích hoạt chuẩn xác.<br>• Mở cổng thanh toán và duyệt đơn không lỗi JS. |
| **2** | **Loại bỏ thanh đen `.prog-nav`** | Kiểm tra cấu trúc DOM & Screenshot | • Thanh đen cũ biến mất.<br>• Header tích hợp một khối thống nhất với logo, tên cổng và bộ chọn chương trình capsule. |
| **3** | **Khôi phục Thẻ Đen Than Chì GRAP** | Đo lường CSS Computed Style | • Thẻ 3 trong `#grap-brief-dashboard` có `background-color: rgb(38, 38, 38)` (`#262626`).<br>• Hiển thị 4 ô số chìm `rgba(255, 255, 255, 0.06)` có số liệu thời gian thực. |
| **4** | **Dải Biểu Tượng Danh Mục Đĩa Tròn** | Đếm phần tử DOM & Đo kích thước | • Đúng 8 đĩa tròn `64px × 64px`, `border-radius: 50%`.<br>• Icon vector SVG nét mảnh 1.5px, nhãn danh mục rõ ràng bên dưới. |
| **5** | **Thẻ Sản Phẩm Merchandising VIP** | Kiểm tra hiển thị Tab 2 | • Sản phẩm hiển thị dạng lưới thẻ bo góc 20px.<br>• Đầy đủ giá niêm yết gạch ngang, nhãn giảm giá `-XX%`, và giá nội bộ đỏ đậm. |
| **6** | **Chuẩn hóa Bảng Dữ Liệu GRAP** | Kiểm tra CSS Tab 4 và Tab PM | • Bảng có `border-top: 2px solid #262626`.<br>• Huy hiệu trạng thái dùng bảng màu pastel chuẩn GRAP (`#DDF0DC`, `#FFF6DD`, `#FDECEC`). |
| **7** | **Động học & Digital Logo Play (Sprint 6)** | Kiểm tra hiển thị & Tương tác động | • Widget nổi Digital Logo Play tải đúng GIF chính hãng (không giật, trong suốt, kích thước 68px).<br>• Hiệu ứng nhảy số Hero count-up mượt mà.<br>• Vi tương tác hover mượt 60fps, tuân thủ `prefers-reduced-motion`. |
| **8** | **Tuân thủ nhận diện thương hiệu LG** | Chạy `python3 scratch/verify_brand_artistic_excellence.py` | • 0 lỗi vi phạm nhận diện (`0 errors`).<br>• 0 ký tự Unicode raw emoji.<br>• Tuyệt đối không có hiệu ứng rung lắc sai quy chuẩn trên Logo Master. |

---

## 3B. VÙNG BẤT KHẢ XÂM PHẠM (NO-TOUCH ZONE)

Danh sách các hàm nghiệp vụ đã được duyệt — **TUYỆT ĐỐI KHÔNG được sửa đổi, thêm bớt dòng, hoặc tiêm logic mới** trong bất kỳ Sprint thiết kế nào:

| # | Tên hàm | Vai trò | Lý do bảo vệ |
| :---: | :--- | :--- | :--- |
| 1 | `handleRegisterProduct(uniqueCode)` | Đăng ký giữ chỗ sản phẩm | Luồng giao dịch chính — ảnh hưởng Google Sheets |
| 2 | `pmApprovePayment(regId)` | PM duyệt thanh toán | Luồng phê duyệt tài chính |
| 3 | `pmRejectPayment(regId)` | PM từ chối đơn | Luồng từ chối tài chính |
| 4 | `submitQuickPayment(regId)` | Nhân viên nộp chứng từ | Luồng thanh toán nhanh |
| 5 | `quickLogin(userId)` | Đăng nhập nhanh | Xác thực người dùng |
| 6 | `clearSession()` | Đăng xuất | Quản lý phiên |
| 7 | `switchTab(tabId)` | Chuyển tab | Điều hướng cốt lõi |
| 8 | `loadProducts(programId)` | Tải dữ liệu sản phẩm từ API | Kết nối dữ liệu |
| 9 | `calculatePMStats(programId)` | Tính toán thống kê PM | Logic tính toán |
| 10 | `openPaymentGate(regId)` | Mở cổng thanh toán | Luồng tài chính |

> **Quy tắc:** Nếu một Sprint thiết kế cần widget/animation phản ứng theo trạng thái giao dịch, phải sử dụng **event listener bên ngoài** (Observer Pattern) thay vì tiêm dòng vào các hàm trên. Hoặc phải có phê duyệt riêng biệt với ghi nhận rõ ràng "Tính năng mới" (Feature Addition), không phải "Nâng cấp thiết kế" (Design Enhancement).

---

## 3C. BÁO CÁO ĐỐI SOÁT SAU TRIỂN KHAI (POST-IMPLEMENTATION RECONCILIATION)

*Cập nhật: 2026-10-02 — Sau kiểm toán chức năng và hiệu chỉnh P0/P1*

### Trạng thái triển khai từng Sprint:

| Sprint | Kế hoạch | Kết quả thực tế | Phân loại | Trạng thái |
| :--- | :--- | :--- | :--- | :---: |
| **1** | Xóa thanh đen, Header Capsule | CSS thuần túy, không sửa hàm nào | ✅ Thiết kế thuần túy | Hoàn tất |
| **2** | Card 03 Dark Charcoal | Sửa `renderBriefTopDashboard()` — thay đổi layout Card 03 | ✅ Nâng cấp thiết kế hiển thị *(đã duyệt P2)* | Hoàn tất |
| **3** | Dải 8 đĩa tròn danh mục | HTML + CSS tạo visual bar | ✅ Thiết kế thuần túy | Hoàn tất |
| **3** *(đã loại bỏ)* | ~~Lọc sản phẩm + auto-switch tab~~ | ~~`filterCategoryByQuickBar()` — thay đổi luồng điều hướng~~ | 🔴 ~~Chức năng mới — vượt phạm vi~~ | **Đã xóa (P1)** |
| **4** | Thẻ sản phẩm VIP | Sửa `renderProductTable()` — thêm Cards Grid phía trên, giữ nguyên bảng gốc bên dưới | ✅ Nâng cấp thiết kế hiển thị *(đã duyệt P2)* | Hoàn tất |
| **5** | GRAP Table CSS + Pill Buttons | CSS thuần túy, không sửa hàm nào | ✅ Thiết kế thuần túy | Hoàn tất |
| **6** | Digital Logo Play Widget + Motion | Widget HTML/CSS/JS mới (không xâm lấn hàm cũ) | ✅ Thiết kế thuần túy | Hoàn tất |
| **6** *(đã loại bỏ)* | ~~Widget phản ứng theo trạng thái giao dịch~~ | ~~4 dòng `triggerAssistantReaction` tiêm vào `handleRegisterProduct` và `pmApprovePayment`~~ | 🔴 ~~Xâm lấn logic đã duyệt~~ | **Đã xóa (P0)** |

### Bài học rút ra:
1. **Tách bạch "thiết kế" vs "chức năng"** ngay từ giai đoạn lập kế hoạch — mỗi Sprint cần ghi rõ: "Chỉ CSS/HTML" hay "Cần sửa JS".
2. **Định nghĩa No-Touch Zone** trước khi triển khai — danh sách hàm bất khả xâm phạm phải được duyệt trước.
3. **Observer Pattern cho cross-cutting concerns** — nếu cần widget phản ứng theo trạng thái, dùng CustomEvent / MutationObserver thay vì tiêm trực tiếp.

---

## 4. KẾT LUẬN & KIẾN NGHỊ THỰC THI (EXECUTIVE RECOMMENDATION)

Bản Đề Án Cải Tiến Này không phải là một sự thay đổi tùy hứng, mà là **một cuộc cách mạng về độ hoàn thiện thẩm mỹ dựa trên hai di sản vĩ đại sẵn có của LG**:
- **Tính trật tự, tinh anh, chuẩn mực doanh nghiệp của GRAP.**
- **Tính cảm xúc, ấm áp, cao cấp và thôi thúc mua sắm của LG.com.**
- **Linh hồn động học trẻ trung, tương tác hóm hỉnh của LG Brand Reinvention V5.2.**

Toàn bộ mã nguồn hiện tại đã được sao lưu an toàn tại [Mau_Dang_Ky_Internal_Sales_3009.html.bak_20261002_pre_design_revamp](Mau_Dang_Ky_Internal_Sales_3009.html.bak_20261002_pre_design_revamp). 

Tôi đề xuất tiến hành triển khai nâng cấp trực tiếp theo từng Sprint đã hoạch định, bắt đầu ngay từ **Sprint 1 (Tích hợp Header thống nhất & loại bỏ thanh đen)** và **Sprint 2 (Khôi phục Thẻ Đen Than Chì GRAP)** để tạo ngay bước nhảy vọt về đẳng cấp thị giác cho Cổng Bán Hàng Nội Bộ.
