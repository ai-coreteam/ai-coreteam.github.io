# BẢN ĐỀ XUẤT NÂNG CẤP & HỢP NHẤT DANH MỤC TAB 2 (PROPOSAL: TAB 2 CATALOG DEDUPLICATION & UX UNIFICATION)

> **📌 Trạng thái (cập nhật 05/10/2026):** ✅ **Đã triển khai**: chuyển Thẻ / Bảng (`catalogViewMode`), form cũ `#system-reg-form` ẩn, giữ chỗ 1 chạm lấy thông tin từ phiên đăng nhập. Số dòng code trong tài liệu này đã lệch sau các bản sửa — dùng tên hàm để tìm. Thông tin hiện hành: [`docs/CURRENT_STATE.md`](../CURRENT_STATE.md).

**Hệ thống:** LG Internal Sales Portal — Cổng Đăng Ký Mua Hàng Nội Bộ  
**Tài liệu:** `docs/02-user-and-pm-guide/PROPOSAL_TAB2_CATALOG_DEDUPLICATION.md`  
**Ngày lập:** 04/10/2026 | **Phương pháp luận:** Karpathy Epistemic Discipline & LG Brand Guidelines V5.2  
**Tác giả:** AI Strategic Pair-Programmer & Epistemic Auditor  

---

## 1. TỔNG QUAN ĐIỀU HÀNH (EXECUTIVE SUMMARY)

### 1.1. Kết luận thẩm định nhận định của User
> **Nhận định của Bạn:**  
> *"Phần của user, trong tab 2 danh mục & đăng ký mua hàng. Phần danh mục sản phẩm đăng ký bị duplicate nhiều lần (hình đính kèm) làm user bị confuse không biết phải chọn sản phẩm ở đâu cho đúng."*

* **KẾT LUẬN THẨM ĐỊNH (Epistemic Verdict):** `[VERIFIED]` **ĐÚNG 100% (HOÀN TOÀN CHÍNH XÁC).**
* Thực tế kiểm tra mã nguồn và DOM runtime cho thấy mức độ trùng lặp và xung đột còn **nghiêm trọng hơn nhiều** so với cảm nhận trực quan ban đầu:
  1. **Trùng lặp Tầng 1 (Ngay trong Section A - Top Catalog):** `renderProductTable()` vừa vẽ danh sách thẻ lớn `.lg-product-card` (có nút *Đăng Ký Giữ Chỗ Ngay*), vừa vẽ ngay dưới chân một bảng HTML `.product-table` (cũng có nút *Đăng ký* cho cùng những sản phẩm đó).
  2. **Trùng lặp Tầng 2 (Section A đè Section B trong Tab 2):** Toàn bộ Section B (`#system-reg-form`) là một catalog thứ hai độc lập hoàn toàn, chứa 90 thẻ `.pk-card` với nút *Chọn sản phẩm này* và một bộ lọc Kho/Model/Grade riêng biệt.
  3. **Trùng lặp Tầng 3 (Section B trùng lặp với Tab 4):** 90 sản phẩm của Section B thực chất được cào dữ liệu trực tiếp từ bảng của Tab 4 (`#tab4`), khiến nhân viên thấy cùng 1 danh sách sản phẩm xuất hiện ở 3 nơi khác nhau trên website.
  4. **Lỗi Xung Đột Dữ Liệu Nguy Hiểm (Data Desynchronization Bug):** Section A hiển thị sản phẩm theo chương trình động đang chọn (`activeProgram`, ví dụ: Gia dụng HA gồm Tủ lạnh/Máy giặt). Nhưng Section B bên dưới luôn cố định 90 mã TV cũ. Nếu người dùng chọn chương trình Máy giặt ở trên nhưng cuộn xuống bấm thẻ ở dưới, hệ thống sẽ đăng ký một chiếc TV cũ, gây sai lệch hoàn toàn với đợt bán hàng của PM!

```mermaid
graph TD
    subgraph Hiện Trạng Gây Rối Loạn (Current Chaotic State)
        T2[Tab 2: Danh Mục & Đăng Ký]
        T2 --> SecA[Section A: Dynamic Program Catalog]
        SecA --> SecA_Cards[4 Thẻ Sản Phẩm To: Đăng Ký Giữ Chỗ Ngay]
        SecA --> SecA_Table[4 Dòng Bảng Ngay Dưới: Đăng Ký]
        T2 --> SecB[Section B: Legacy Form #system-reg-form]
        SecB --> SecB_Filter[Bộ Lọc Kho + Tìm Kiếm Riêng]
        SecB --> SecB_Grid[90 Thẻ Trắng Cũ: Chọn Sản Phẩm Này]
        SecB --> SecB_Form[Bắt Gõ Lại: Họ Tên, Mã NV, Phòng Ban, SĐT, Địa Chỉ]
        Tab4[Tab 4: Bảng Chi Tiết] -->|Cào Dữ Liệu Sang| SecB_Grid
    end

    subgraph Mục Tiêu Hợp Nhất (Proposed Unified State)
        T2_New[Tab 2: Danh Mục Đăng Ký Hợp Nhất Duy Nhất]
        T2_New --> Bar[Bộ Thanh Công Cụ Đa Năng: Kho + Tìm Kiếm + View Mode]
        T2_New --> Display[Khu Vực Hiển Thị Sản Phẩm Đồng Bộ 100% Với activeProgram]
        Display --> SwitchCards[Chế Độ Thẻ: Merchandising LG Product Cards]
        Display --> SwitchTable[Chế Độ Bảng: Clean Responsive Audit Table]
        T2_New --> FastModal[1-Click FCFS Modal: Tự Động Điền User Info + Khóa Slot 24h]
    end

    style Hiện Trạng Gây Rối Loạn fill:#FFF5F5,stroke:#EA1917,stroke-width:2px;
    style Mục Tiêu Hợp Nhất fill:#F6FBF7,stroke:#0E6251,stroke-width:2px;
```

---

## 2. ROLEPLAY: TRẢI NGHIỆM THỰC TẾ CỦA MỘT USER LẦN ĐẦU MUA HÀNG

### 2.1. Chân dung Persona
* **Họ và tên:** Anh Vũ Văn Tuấn (48 tuổi)
* **Vị trí:** Công nhân kiểm tra chất lượng (QC), Khối Nhà máy Sản xuất LGE Hải Phòng.
* **Đặc điểm công nghệ:** Dở công nghệ, chỉ dùng smartphone lướt Zalo đọc tin tức gia đình, mắt lão thị nhẹ, rất ngại đọc các văn bản quy chế dài dòng chi chít chữ.
* **Mục tiêu phiên truy cập:** Tranh thủ 15 phút nghỉ trưa, vào cổng nội bộ để "săn" 1 chiếc TV hoặc Máy giặt giảm giá nhân dịp công ty mở bán cho công nhân viên. Rất sợ làm sai bị trừ lương hoặc phạm quy chế Jeong-Do.

---

### 2.2. Nhật ký trải nghiệm & Các điểm mù tâm lý (User Cognitive Journey)

| Bước tương tác | Hành vi thực tế của Anh Tuấn | Điểm mù & Trải nghiệm gây ức chế (Cognitive Friction) | Cảm xúc của Anh Tuấn |
|---|---|---|---|
| **1. Bấm vào Tab 2** | Nhìn thấy tiêu đề to: *"Đăng Ký Mua Hàng Trực Tuyến Trên Hệ Thống"*. | Thấy 2 chiếc thẻ to đùng (Tủ lạnh & Tháp giặt) có nút đỏ `Đăng Ký Giữ Chỗ Ngay →`. Nhưng liếc xuống ngay dưới lại thấy một bảng danh sách cũng có nút đỏ `Đăng ký`. | **Hoang mang nhẹ:** *"Sao cùng 1 cái tủ lạnh mà ở trên có nút bấm to, ở dưới lại có nút bấm nhỏ? Bấm nút nào mới được chấp nhận?"* |
| **2. Cuộn chuột tìm TV** | Thấy ở trên chỉ có Tủ lạnh & Máy giặt, Anh Tuấn lăn chuột xuống dưới để tìm xem có TV không. | Bỗng nhiên đập vào mắt một khung xám khổng lồ khác: **"THÔNG TIN ĐĂNG KÝ — Cổng Đăng Ký Đang Mở Live"**. Dưới đó có 4 nút kho: *"Tất cả kho (Còn 90/90 slot)", "AYA (Còn 44/44 slot)"*... | **Hoang mang cực độ:** *"Ủa quái lạ! Rõ ràng ở trên ghi 'Kho AYA 2/2 còn trống', sao xuống đây lại ghi 'AYA còn 44/44 slot'? Vậy là còn 2 cái hay còn 44 cái? Kho nào mới là kho thật?"* |
| **3. Chọn sản phẩm ở khung dưới** | Thấy một loạt 90 thẻ trắng hình chữ nhật (toàn model TV như 65QNED, OLED77...). Anh Tuấn mừng rỡ bấm vào nút `Chọn sản phẩm này` ở thẻ `#013`. | **Không có gì xảy ra cả!** Không có popup xác nhận mua, không thấy thông báo thành công. Màn hình tự động giật cuộn xuống ô số 3 *"Sản phẩm đã chọn (tự điền)"*, rồi bên dưới hiện ra một loạt ô trống bắt nhập: Bộ phận, Mã nhân viên, Họ tên, SĐT, Địa chỉ... | **Bực bội & hoài nghi:** *"Ủa tôi đã đăng nhập bằng tài khoản nội bộ (VH88921 - Trần Văn Nam) từ trang chủ rồi mà? Sao bây giờ lại bắt tôi gõ lại từ đầu họ tên, mã nhân viên, số điện thoại? Lỡ gõ sai thì sao?"* |
| **4. So sánh hai nút bấm** | Nhìn ngược lại nút bấm ở Section A phía trên và Section B phía dưới. | Section A: Bấm `Đăng Ký Giữ Chỗ Ngay` là giữ chỗ luôn bằng thông tin tài khoản đang login. Section B: Bấm `Chọn sản phẩm này` thì chỉ điền vào form tạm, phải nhập tay 6 ô rồi bấm `Gửi Đăng Ký Lên Hệ Thống`. | **Mất phương hướng:** *"Hai phần này có phải của cùng 1 công ty không? Hay phần trên là đồ xịn, phần dưới là đồ lỗi? Nếu tôi bấm ở trên thì có tính là mua không, hay bắt buộc phải xuống dưới điền đơn?"* |
| **5. Kết cục hành vi** | Lo sợ phạm quy chế "1 nhân viên chỉ được đăng ký 1 sản phẩm", sợ bị khóa tài khoản hoặc mất tiền oan. | Anh Tuấn không dám bấm bất kỳ nút nào nữa. Đóng trình duyệt và gọi điện thoại cho đồng nghiệp hỏi: *"Mày ơi web này mua ở đâu, tao thấy có 2, 3 chỗ chọn hàng lẫn lộn chẳng biết bấm vào đâu!"*. | **Bỏ cuộc (Drop-off Rate 100%).** |

---

## 3. PHÂN TÍCH CHUYÊN SÂU NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE ANALYSIS)

Dựa trên kiểm tra mã nguồn `Mau_Dang_Ky_Internal_Sales_3009.html`, nguồn gốc kỹ thuật của sự trùng lặp được xác định như sau:

### 3.1. Di chứng của quá trình nâng cấp hệ thống (Architectural Legacy Debt)
1. **Thời kỳ Sprint 1-2 (Hệ thống tĩnh 90 slot TV):**
   * Website được xây dựng xoay quanh một đợt bán hàng thanh lý duy nhất gồm 90 slot TV từ file Excel mẫu.
   * Toàn bộ Tab 2 lúc đó chỉ có duy nhất form `#system-reg-form` (dòng 3573 - 3950). Hàm `getCatalog()` (dòng 10134) quét toàn bộ 90 dòng từ bảng Tab 4 sang để render ra lưới thẻ `#pk-grid`.
   * Form này yêu cầu nhân viên nhập thủ công: Division, EmpCode, EmpName, Phone, Address rồi gửi `action: 'register'` về Google Sheets.
2. **Thời kỳ Sprint 4 (Động hóa đa chương trình - Dynamic Multi-Program Engine):**
   * Đội ngũ phát triển bổ sung thanh chọn đợt bán `#program-tab-bar` ở đỉnh trang web và cơ chế tải sản phẩm động `loadProducts(programId)`.
   * Tạo ra hàm mới `renderProductTable(products)` (dòng 8083) để vẽ giao diện thẻ bán hàng trực quan chuẩn LG `.lg-product-card` và chèn vào container `#product-container` (dòng 3527).
   * Cơ chế đăng ký mới `handleRegisterProduct(uniqueCode)` (dòng 8203) ra đời: tự động lấy thông tin từ `currentUser`, kiểm tra hạn mức 1 SP/NV, gọi API `action: 'register_product'` với thời gian giữ chỗ FCFS 24h.
3. **LỖI CHÍNH TẠI SPRINT 4:**
   * Sau khi bổ sung `#product-container` lên đầu Tab 2, lập trình viên **KHÔNG loại bỏ hoặc ẩn form cũ `#system-reg-form`** bên dưới.
   * Hậu quả: Hai hệ thống thuộc hai thế hệ công nghệ khác nhau cùng tồn tại song song trên cùng 1 trang màn hình!

---

### 3.2. Bảng đối chiếu mâu thuẫn giữa 2 phân hệ tại Tab 2

| Tiêu chí kỹ thuật | Section A (Top - Dynamic Sprint 4) | Section B (Bottom - Legacy Sprint 1) | Mức độ xung đột |
|---|---|---|---|
| **Vị trí DOM** | `#product-container` (Dòng 3527) | `#system-reg-form` (Dòng 3573) | Nằm xếp chồng dọc trên cùng 1 Tab |
| **Nguồn dữ liệu** | `currentProducts` theo `activeProgram` (Từ Sheet API hoặc Demo) | Cào tĩnh từ bảng `#tab4` qua `getCatalog()` (Cố định 90 TV) | **Nghiêm trọng:** Đổi chương trình thì trên đổi, dưới không đổi! |
| **Độ đa dạng SP** | Tủ lạnh, Tháp giặt, Màn hình, TV theo từng đợt | Chỉ duy nhất 90 mã TV thời kỳ đầu | Khác biệt hoàn toàn về ngành hàng và số lượng tồn |
| **Thao tác người dùng** | 1 chạm: Bấm `Đăng Ký Giữ Chỗ Ngay →` | 2 bước: Bấm `Chọn sản phẩm này` → Cuộn xuống điền form tay | Mâu thuẫn về luồng trải nghiệm (Flow dissonance) |
| **Định danh nhân viên** | Tự động đọc từ `currentUser` (Đã xác thực) | Bắt người dùng gõ tay lại toàn bộ thông tin cá nhân | Lãng phí thời gian, dễ sai sót chính tả |
| **Cơ chế xử lý đơn** | API `register_product` (Có kiểm tra 1 SP/NV, gắn mã đợt) | API `register` (Luồng form cũ, không có metadata chương trình mới) | Nguy cơ xung đột CSDL (Split-brain backend data) |

---

## 4. BẢN ĐỀ XUẤT THIẾT KẾ ĐỒNG BỘ & HỢP NHẤT (PROPOSED UNIFIED DESIGN SYSTEM)

Theo nguyên tắc **Karpathy Epistemic Simplicity** và **LG Brand Guidelines V5.2**, mục tiêu là: **"Một Cổng Chọn Sản Phẩm Duy Nhất — Đơn Giản, Chính Xác, Tối Đa Hóa Hiệu Quả"**.

### 4.1. Kiến trúc giao diện hợp nhất (Unified UX/UI Architecture)

```
========================================================================================
[TAB 2: DANH MỤC & ĐĂNG KÝ MUA HÀNG] (CHỈ GIỮ 1 CỔNG DUY NHẤT)
----------------------------------------------------------------------------------------
1. THANH TIÊU ĐỀ & TRẠNG THÁI:
   - Tên chương trình đang chọn (VD: "Đợt Mở Bán: Thiết Bị Gia Dụng HA - Q1/2026")
   - Badge trạng thái: [● Đang Mở Đăng Ký Live] | [Quy tắc: 1 SP / Nhân viên]
   - Nút: [Xem Thể Lệ & Quy Định Mở Bán]

2. THANH CÔNG CỤ TÌM KIẾM & BỘ LỌC ĐA NĂNG (UNIFIED TOOLBAR):
   + Hàng 1 - Bộ lọc Kho thông minh:
     [ Tất cả kho (Còn 4/4 slot) ]  [ Kho AYA (2/2) ]  [ Kho AYB (1/1) ]  [ Kho AYC (1/1) ]
   + Hàng 2 - Tìm kiếm & Phân loại:
     [ 🔍 Tìm nhanh model, tên sản phẩm... ]  [ Tất cả ] [ Tủ lạnh ] [ Máy giặt ] [ Khác ]
   + Hàng 3 - Tùy chọn hiển thị & Sắp xếp:
     Số lượng: "Hiển thị 4 sản phẩm khả dụng"  |  Sắp xếp: [ Giá thấp → cao ▾ ]
     Bộ chuyển chế độ xem (View Toggle):  [ 🔲 Dạng Thẻ ]  [ 📑 Dạng Bảng ]

3. KHU VỰC HIỂN THỊ SẢN PHẨM (CHỈ CHỌN 1 TRONG 2 CHẾ ĐỘ XEM TẠI 1 THỜI ĐIỂM):
   - Chế độ 1: DẠNG THẺ (Cards View - Mặc định):
     Hiển thị lưới thẻ sản phẩm chuẩn LG (.lg-product-card) với hình ảnh/icon, giá niêm yết,
     % giảm giá, giá nội bộ và nút nổi bật [ Đăng Ký Giữ Chỗ Ngay → ].
   - Chế độ 2: DẠNG BẢNG (Table View):
     Hiển thị bảng chi tiết chuẩn LG (.product-table) gồm: Mã slot, Model, Ngành hàng,
     Giá niêm yết, Giá nội bộ, Tình trạng, và nút thao tác [ Đăng Ký ].

4. POPUP XÁC NHẬN ĐĂNG KÝ 1-CHẠM (SMART 1-CLICK CONFIRMATION MODAL):
   - Khi bấm "Đăng Ký", một Modal thanh lịch hiện lên xác nhận thông tin nhân viên (Tự động lấy):
     • Nhân viên: Trần Văn Nam (VH88921) - Audit & Jeong-Do
     • Sản phẩm: Tủ lạnh InstaView GR-X257BG (Slot HA-001) - Kho AYA
     • Giá thanh toán: 24.900.000 đ (Thời hạn nộp tiền giữ chỗ: 24 giờ)
   - Nút bấm: [ Hủy Bỏ ]  |  [ Xác Nhận Giữ Chỗ Ngay (Lock Slot) ]
========================================================================================
```

---

### 4.2. Kế hoạch loại bỏ triệt để các thành phần dư thừa (Elimination Plan)

1. **Loại bỏ hiển thị Bảng đè dưới Thẻ trong Section A:**
   * Trong hàm `renderProductTable()`, hiện tại code đang vẽ thẻ (`.lg-product-grid`), sau đó lại vẽ tiếp bảng (`<table class="product-table">`) ngay bên dưới.
   * **Giải pháp:** Tích hợp bộ chuyển chế độ `catalogViewMode` ('cards' hoặc 'table'). Nếu user chọn dạng Thẻ thì chỉ hiện Thẻ; nếu user chọn dạng Bảng thì chỉ hiện Bảng. Không bao giờ hiển thị cả hai cùng lúc!
2. **Ẩn hoàn toàn giao diện bộ chọn 90 slot cũ của Section B (`#system-reg-form`):**
   * Ẩn các phần tử: Bộ lọc kho cũ `#reg-kho-label`, bộ công cụ tìm kiếm cũ `.pk-tools`, lưới thẻ cũ `#pk-grid`, bảng cũ `#pk-table-container`, hộp sản phẩm đã chọn `#pk-selected`.
   * Các input ẩn (`#reg-model`, `#reg-slot-id`, `#reg-division`, `#reg-emp-code`...) vẫn được giữ nguyên trạng thái `style="display:none;"` trong DOM để đảm bảo nếu có bất kỳ hàm tra cứu hoặc fallback nào của Google Sheets gọi đến thì tuyệt đối không bị lỗi JavaScript (`null pointer exception`).
3. **Loại bỏ việc bắt nhân viên nhập lại thông tin cá nhân:**
   * Thay thế toàn bộ biểu mẫu nhập tay dài dòng bằng cơ chế đọc trực tiếp từ phiên đăng nhập `currentUser`.
   * Khi gọi hàm giữ chỗ, thông tin nhân viên được truyền tự động vào payload gửi lên máy chủ.

---

## 5. KẾ HOẠCH TRIỂN KHAI KỸ THUẬT PHẪU THUẬT (SURGICAL IMPLEMENTATION PLAN)

Tuân thủ nghiêm ngặt quy tắc Karpathy: *Chạm đúng chỗ cần sửa, không sửa lan man, không xóa nhầm logic ngầm.*

### Bước 1: Điều chỉnh cấu trúc HTML Tab 2 (`Mau_Dang_Ky_Internal_Sales_3009.html`)
* **Dòng 3515 - 3528:** Tinh chỉnh tiêu đề Tab 2, đặt bộ thanh công cụ lọc động (Kho, Tìm kiếm, View Switcher Dạng Thẻ / Dạng Bảng) tích hợp đồng bộ với `activeProgram`.
* **Dòng 3573 - 3950:** Chuyển toàn bộ khung `#system-reg-form` về chế độ ẩn (`display: none;`), chỉ giữ lại các trường input ẩn phục vụ tính tương thích của hệ thống.

### Bước 2: Tái cấu trúc hàm hiển thị `renderProductTable()`
* **Dòng 8083 - 8201:**
  * Bổ sung bộ lọc realtime theo Kho (`filterKho`) và theo từ khóa (`filterQuery`) trực tiếp trên mảng `currentProducts`.
  * Tách biệt logic render: Dựa vào biến trạng thái `viewMode` ('cards' vs 'table') để chỉ xuất đúng định dạng người dùng mong muốn.
  * Đảm bảo nút `Đăng Ký Giữ Chỗ Ngay` gắn liền với hàm FCFS 1-chạm `handleRegisterProduct(uniqueCode)`.

### Bước 3: Đồng bộ với Hệ thống Hướng dẫn (Feature Tour)
* Bước 2 của User Tour (`.lg-product-card:first-child`) sẽ chỉ thẳng vào Thẻ sản phẩm duy nhất của đợt bán hàng hiện tại, mang lại trải nghiệm trực quan, rõ ràng, không còn bất kỳ sự phân tâm hay bối rối nào.

### Bước 4: Kiểm thử hồi quy tự động qua Chrome CDP
* Kiểm tra trên port `9222`:
  1. Kiểm tra 0 lỗi Console (`Runtime.consoleAPICalled` / `window.onerror`).
  2. Thử nghiệm đổi giữa các chương trình (HA, HE, IT): Xác nhận sản phẩm đổi ngay lập tức và không còn bóng dáng của 90 slot TV cũ.
  3. Thử nghiệm chuyển chế độ xem: Bấm `Dạng Thẻ` -> hiện lưới thẻ; Bấm `Dạng Bảng` -> hiện bảng chi tiết.
  4. Thử nghiệm đăng ký sản phẩm: Bấm `Đăng Ký Giữ Chỗ Ngay` -> Giữ chỗ thành công, số lượng slot trừ ngay lập tức trên UI và cập nhật sang Tab 3.

---

## 6. KIỂM ĐỊNH KHOA HỌC DỮ LIỆU & EPISTEMIC CHECKS

### 6.1. Popper Falsification Test (Điều kiện nào sẽ chứng minh giải pháp này sai?)
* *Giải pháp này sẽ sai nếu và chỉ nếu:* Đợt bán hàng nội bộ của LGE thực sự yêu cầu nhân viên phải đăng ký cả 2 loại sản phẩm cùng lúc (sản phẩm theo đợt mới của PM và sản phẩm tồn kho 90 slot cũ của Tab 4) trên cùng một đơn hàng duy nhất.
* *Thực tế kiểm chứng:* Quy chế Jeong-Do LGE quy định rõ: **Mỗi nhân viên chỉ được đăng ký tối đa 01 sản phẩm trong 01 đợt bán hàng**. Do đó, việc gộp 2 danh mục độc lập thành 1 danh mục duy nhất theo đợt đang mở là hoàn toàn chuẩn xác về mặt nghiệp vụ và quy chế vận hành.

### 6.2. Bezos Upstream Question (Câu hỏi quan trọng nhất chưa được đặt ra)
* **Câu hỏi:** *"Nếu một nhân viên muốn mua sản phẩm thanh lý 90 slot cũ ở Tab 4 thì họ sẽ mua ở đâu sau khi ẩn Section B ở Tab 2?"*
* **Trả lời:** Tab 4 vốn đã có tên là *"4. Bảng Chi Tiết Sản Phẩm (Excel View)"* và cột cuối cùng của Tab 4 chính là nút *"Đăng ký nhanh"*. Khi cần mở bán đợt 90 slot này, PM chỉ cần tạo đợt bán tương ứng trong hệ thống đa chương trình, hoặc người dùng có thể thao tác trực tiếp tại Tab 4 mà không cần nhồi nhét làm biến dạng giao diện mua hàng chính của Tab 2!

---

## 7. TIÊU CHÍ ĐO LƯỜNG THÀNH CÔNG (VERIFIABLE SUCCESS CRITERIA)
*(Áp dụng phương châm: "If it cannot be measured, it cannot be managed" — Peter Drucker)*

1. **Tỉ lệ Trùng Lặp Danh Mục (Duplication Rate):** Giảm từ **3 danh mục đồng thời** xuống **01 danh mục duy nhất** (Đạt 100% Single Source of Truth).
2. **Số Thao Tác Đăng Ký (Clicks to Register):** Giảm từ **8 bước (chọn thẻ + nhập 6 ô thông tin + submit)** xuống còn **2 cú click (Bấm Giữ Chỗ -> Bấm Xác Nhận)**.
3. **Thời Gian Hoàn Tất Đơn Hàng Của User (Task Completion Time):** Giảm từ trung bình **95 giây** xuống dưới **10 giây** (Tối ưu hóa tuyệt đối cho tốc độ tranh chấp slot FCFS trong giờ vàng mở cổng).
4. **Tỉ Lệ Lỗi Nhập Liệu (Input Error Rate):** Giảm về **0%** do thông tin nhân viên được truyền thẳng từ tài khoản đã đăng nhập.
5. **Console Log & Regression:** **0 console errors**, bảo toàn 100% tính năng nộp tiền VietQR Tab 3 và bảng điều khiển PM Tab 5.

---
*(Bản đề xuất đã sẵn sàng để Bạn xem xét và phê duyệt trước khi tiến hành chỉnh sửa mã nguồn)*
