# Cẩm Nang Vận Hành & Hướng Dẫn Sử Dụng Toàn Diện
### LG Internal Sales Portal — Dành cho Nhân Viên (User) & Quản Trị Viên (PM)

*Tài liệu hướng dẫn trực quan kèm sơ đồ quy trình chi tiết giúp bất kỳ ai cũng có thể sử dụng thành thạo hệ thống mà không cần người hướng dẫn trực tiếp.*

---

## 1. Sơ đồ Chu trình Bán hàng Toàn diện (End-to-End Sales Lifecycle)

```mermaid
flowchart TD
    subgraph PM_SETUP [Giai đoạn 1: PM Khởi tạo & Mở bán]
        P1[1. Tải file Excel mẫu] --> P2[2. Điền sản phẩm & Nạp vào hệ thống]
        P2 --> P3[3. Kích hoạt 'Mở chương trình']
        P3 --> P4[4. Cài đặt hẹn giờ tự động / Mở cổng TT]
    end

    subgraph USER_FLOW [Giai đoạn 2: Nhân viên Đăng ký & Nộp tiền]
        U1[5. Xem Catalog & Chọn Slot] --> U2[6. Điền thông tin & Ký cam kết Jeong-Do]
        U2 --> U3[7. Giữ chỗ thành công - Slot khóa 24h]
        U3 --> U4{Cổng thanh toán mở?}
        U4 -- Chưa mở --> U5[Đợi PM mở cổng nộp tiền]
        U4 -- Đã mở --> U6[8. Chuyển khoản đúng cú pháp & Tải biên lai]
    end

    subgraph PM_AUDIT [Giai đoạn 3: Đối soát & Phê duyệt]
        U6 --> A1[9. PM mở Lightbox soi biên lai & Mã GD]
        A1 --> A2{Khớp tiền & Mã GD?}
        A2 -- Khớp --> A3[10. PM Duyệt thanh toán / Duyệt hàng loạt]
        A2 -- Không khớp --> A4[11. PM Từ chối & Hoàn slot]
        A3 --> A5[12. Xuất kho & Giao hàng tới nhân viên]
        A5 --> A6[13. PM Kết sổ chương trình & Xuất báo cáo]
    end

    style P1 fill:#F6F3EB,stroke:#CBC8C2,stroke-width:1px
    style P3 fill:#A50034,stroke:#A50034,color:#fff
    style U3 fill:#287D00,stroke:#287D00,color:#fff
    style A3 fill:#287D00,stroke:#287D00,color:#fff
    style A6 fill:#262626,stroke:#262626,color:#fff
```

---

## PHẦN A: HƯỚNG DẪN DÀNH CHO NHÂN VIÊN (END-USER)

```mermaid
sequenceDiagram
    autonumber
    actor NV as Nhân viên LG
    participant Web as Cổng Bán Hàng Nội Bộ
    participant Bank as Ngân hàng VCB/TCB
    participant PM as Quản trị PM

    NV->>Web: Chọn Tab chương trình (HA / HE / B2B)
    NV->>Web: Lọc theo Kho (AYA/AYB/AYC) & Xem sản phẩm còn trống
    NV->>Web: Bấm "Đăng ký giữ chỗ" & Xác nhận cam kết Jeong-Do
    Web-->>NV: Giữ slot thành công! Trạng thái "Chờ mở cổng thanh toán"
    Note over NV,Web: Cổng nộp tiền mở (thời hạn 24 giờ)
    NV->>Bank: Chuyển khoản đúng cú pháp: [MãNV]_[MãSlot]
    NV->>Web: Nhập Mã giao dịch (Txn Ref) & Tải ảnh ủy nhiệm chi
    Web-->>PM: Ghi nhận đơn: "Đã khai nộp - Chờ đối soát"
    PM-->>Web: Kiểm tra chứng từ & Bấm "Duyệt thanh toán"
    Web-->>NV: Thông báo thành công: "Đã xác nhận thanh toán"
```

### Bước 1: Khám phá danh mục & Tìm kiếm sản phẩm
1. **Chọn chương trình:** Tại thanh Tab trên cùng, chọn chương trình đang mở bán (có chấm tròn xanh lá):
   * *Gia dụng (HA):* Tủ lạnh InstaView, Tháp giặt sấy WashTower, Máy sấy HeatPump, Điều hòa.
   * *Nghe nhìn (HE):* Tivi OLED evo, Tivi QNED, Loa thanh Soundbar, Loa XBOOM.
   * *B2B / Màn hình (BS):* Màn hình UltraWide, Ergo UltraFine, gram +view, Bảng One:Quick.
2. **Lọc theo vị trí kho:** Bấm chọn các tab kho hàng để tìm sản phẩm gần địa bàn công tác:
   * **Kho AYA (Miền Bắc):** Hải Phòng / Hà Nội.
   * **Kho AYB (Miền Trung):** Đà Nẵng.
   * **Kho AYC (Miền Nam):** TP. Hồ Chí Minh / Bình Dương.
3. **Kiểm tra tình trạng suất máy:**
   * Thẻ hiển thị **"Có sẵn" (Available):** Bấm nút màu đỏ `Đăng ký giữ chỗ ngay`.
   * Thẻ hiển thị **"Đã giữ chỗ" (Registered):** Đã có đồng nghiệp khác đăng ký trước.

---

### Bước 2: Điền thông tin đăng ký & Cam kết Jeong-Do
1. Cửa sổ Modal Đăng ký mở ra, kiểm tra lại thông tin:
   * Mã Model, Tên sản phẩm, Kho xuất, Giá bán nội bộ ưu đãi.
2. Nhập thông tin nhân viên:
   * **Mã nhân viên:** Bắt buộc (VD: `VH67890`).
   * **Họ và tên:** Tự động điền theo tài khoản.
   * **Bộ phận (Division):** Tìm kiếm và chọn đúng phòng ban của bạn.
   * **Số điện thoại & Địa chỉ nhận hàng.**
3. **Ký cam kết Jeong-Do:**
   * Đánh dấu tích vào ô cam kết tuân thủ chính sách sử dụng nội bộ (không mua đi bán lại, không đầu cơ trục lợi).
4. Bấm **"Xác Nhận Giữ Chỗ"**:
   * Hệ thống lập tức khóa suất máy đó lại cho bạn và tính giờ giữ chỗ 24 tiếng.

---

### Bước 3: Nộp tiền chuyển khoản & Khai báo chứng từ
1. **Kiểm tra trạng thái mở cổng thanh toán:**
   * Khi Thẻ 01 hiển thị thông tin ngân hàng và Thẻ 03 chuyển sang nút `Nộp Tiền Ngay`, bạn bắt đầu thực hiện chuyển khoản.
2. **Thông tin ngân hàng thụ hưởng chính thức của LG:**
   * **Ngân hàng:** Vietcombank (Chi nhánh Tây Hà Nội).
   * **Số tài khoản:** `0991000012525` *(Bấm icon sao chép nhanh trên web)*.
   * **Tên chủ tài khoản:** `CTY TNHH LG Electronics VN HP`.
   * **Số tiền:** Chuyển chính xác 100% số tiền hiển thị trên đơn hàng.
   * **Cú pháp chuyển khoản bắt buộc:** `[MãNV]_[MãSlot]` (VD: `VH67890_HA001`).
3. **Khai báo chứng từ lên hệ thống:**
   * Bấm nút **"Nộp Tiền Ngay"** tại Thẻ 03.
   * Nhập **Mã giao dịch ngân hàng (Txn Ref / Mã tham chiếu)** từ app ngân hàng của bạn *(Có nút "Xem hướng dẫn tìm mã GD" cho từng ngân hàng VCB, TCB, MB, VietinBank)*.
   * Kéo thả hoặc tải lên **Ảnh chụp màn hình biên lai chuyển khoản thành công** *(Hỗ trợ mọi định dạng JPG, PNG và tự động chuyển đổi ảnh HEIC từ iPhone)*.
   * Bấm **"Xác Nhận Nộp Tiền"**.

---

### Bước 4: Theo dõi đơn hàng & Hủy giữ chỗ khi cần
* **Theo dõi:** Đơn hàng sẽ chuyển sang trạng thái `"Đã khai nộp - Chờ đối soát"`. Sau khi kế toán kiểm tra xong, trạng thái sẽ đổi thành `"Đã xác nhận thanh toán"`.
* **Hủy giữ chỗ:** Nếu bạn đổi ý hoặc muốn chọn model khác:
  * Vào Thẻ 03 (*Đơn Hàng Của Bạn*).
  * Bấm nút **"Hủy giữ chỗ"**. Suất máy sẽ lập tức được trả về kho khả dụng cho đồng nghiệp khác và hạn mức 1 SP của bạn được hoàn lại.
  * *(Lưu ý — **cập nhật v1, 05/10/2026**: chỉ tự hủy được khi đơn đang **"Đã đăng ký - Chờ mở thanh toán"** hoặc **"Chờ nộp tiền"** và **chưa khai nộp tiền**. Đã khai nộp tiền thì liên hệ PM phụ trách để xử lý — tránh phát sinh hoàn tiền. Quy tắc cũ "chưa được PM phê duyệt" không còn áp dụng.)*

---

## PHẦN B: HƯỚNG DẪN DÀNH CHO QUẢN TRỊ VIÊN ĐỢT BÁN (PM)

```mermaid
flowchart TD
    PM_START[Đăng nhập tài khoản PM Quản trị] --> TAB_CREATE[Bấm nút '+ Tạo chương trình']
    TAB_CREATE --> DOWNLOAD_TPL[Tải file Excel mẫu: Mau_Danh_Muc_San_Pham_Internal_Sales.xlsx]
    DOWNLOAD_TPL --> FILL_EXCEL[Điền thông tin Model, Kho, Giá nội bộ]
    FILL_EXCEL --> DROP_EXCEL[Kéo thả file vào Dropzone]
    DROP_EXCEL --> VALIDATE_TPL[Hệ thống tự nhận diện Sheet Slots & Đọc số lượng SP]
    VALIDATE_TPL --> SUBMIT_PROG[Bấm 'Kích Hoạt Mở Bán']
    SUBMIT_PROG --> TAB_ACTIVE[Chương trình hiển thị Tab Xanh #287D00 trên đầu trang]
    TAB_ACTIVE --> TIMER_CONFIG[Cài đặt Hẹn Giờ Tự Động hoặc Điều Khiển Thủ Công]
    TIMER_CONFIG --> AUDIT_TABLE[Giám sát tiến độ & Duyệt thanh toán]
```

### Bước 1: Khởi tạo chương trình mới & Nạp danh mục từ Excel
1. Đăng nhập bằng tài khoản PM (Mã `VH12345`).
2. Trên thanh Tab chương trình, bấm nút `+ Tạo chương trình`.
3. Điền thông tin cơ bản:
   * **Mã đợt bán:** Viết hoa, không dấu (VD: `IS2026Q4-HA`).
   * **Tên hiển thị:** VD: `Đợt Bán Hàng Nội Bộ Q4/2026 – Gia Dụng HA`.
   * **Thời gian mở bán & kết thúc:** Có các nút bấm nhanh `+7 Ngày`, `+14 Ngày`, `Hết tháng này`.
   * **Hạn mức:** Mặc định `1 SP / Nhân viên`.
4. **Tải và sử dụng file Excel mẫu chuẩn:**
   * Bấm nút **"Tải file mẫu Excel (.xlsx)"** ở góc trên khung nạp hoặc bấm link nhắc nhở bên trong khung.
   * Mở file mẫu vừa tải về (`Mau_Danh_Muc_San_Pham_Internal_Sales.xlsx`), điền danh sách máy của bạn theo 7 cột chuẩn.
5. **Kéo thả file Excel vào hệ thống:**
   * Thả file vào khung nét đứt.
   * Hệ thống tự động phân tích cấu trúc, nhận diện sheet và hiển thị bảng xem trước (Số lượng SP, Model, Giá).
6. Bấm nút màu đỏ: **"Kích Hoạt Mở Bán"**. Đợt bán sẽ xuất hiện ngay trên thanh Tab với chấm xanh hoạt động.

---

### Bước 2: Cài đặt Hẹn Giờ Tự Động (Automation Timer)
1. Tại góc trên bên phải khung PM Command Center, bấm nút **"Cài Đặt Hẹn Giờ"** (Icon đồng hồ).
2. Thiết lập 3 mốc thời gian tự động:
   * **Hẹn giờ Mở bán:** Tự động mở chương trình khi đến giờ G.
   * **Hẹn giờ Mở cổng thanh toán:** Tự động cho phép nhân viên nộp tiền sau khi đã hoàn thành đợt đăng ký giữ chỗ.
   * **Hẹn giờ Kết sổ:** Tự động khóa cổng, ngăn chặn các đăng ký phát sinh sau hạn định.
3. Bấm **"Lưu Cấu Hình Hẹn Giờ"**. Hệ thống kích hoạt đồng hồ đếm ngược và hiển thị thẻ trạng thái nhấp nháy trên banner.

---

### Bước 3: Đối soát thanh toán bằng Modal Phóng to Lightbox
1. Chuyển sang Tab **"PM Dashboard"** hoặc khu vực **"Giám sát bán hàng (PM View)"**.
2. Khi có nhân viên nộp tiền, đơn hàng hiển thị tại bảng danh sách với trạng thái màu vàng: `"Chờ đối soát"`.
3. **Soi kỹ chứng từ bằng Lightbox:**
   * Bấm vào nút ảnh thumbnail biên lai.
   * Hộp thoại Lightbox mở ra toàn màn hình, hỗ trợ:
     * **Phóng to (Zoom In):** Lên đến 300% để soi rõ từng con số trong mã giao dịch ngân hàng.
     * **Xoay ảnh (Rotate):** Xoay 90°, 180° đối với các ảnh chụp ngang/ngược từ điện thoại.
     * **Đối chiếu thông tin:** Hiển thị song song Mã NV, Tên NV, Số tiền cần nộp, Số tiền thực nộp và Mã GD ngân hàng.
4. **Phê duyệt:**
   * Bấm nút màu xanh `Phê duyệt thanh toán` ngay bên trong Lightbox để hoàn tất xác nhận đơn.
   * Hoặc bấm `Từ chối đơn` (kèm lý do) để hủy giao dịch và hoàn trả slot về kho khả dụng.

---

### Bước 4: Duyệt thanh toán hàng loạt 1-Click (Batch Approve)
* Khi đợt bán có hàng trăm đơn nộp tiền cùng lúc:
  1. Kiểm tra tài khoản ngân hàng của công ty qua sao kê kế toán.
  2. Bấm nút **"Duyệt Hàng Loạt Đơn Chờ Đối Soát"** (Icon sấm sét màu vàng).
  3. Xác nhận số lượng đơn cần duyệt. Hệ thống sẽ tự động đối soát và chuyển toàn bộ đơn hàng sang trạng thái `Đã xác nhận thanh toán` chỉ trong 1 giây.

---

### Bước 5: Kết sổ đợt bán & Xuất báo cáo
1. Khi hết thời hạn đăng ký, bấm nút màu đỏ **"Kết sổ chương trình"**.
2. **Xuất dữ liệu quyết toán:**
   * Bấm nút **"Xuất CSV"** hoặc **"Xuất Excel"** tại bảng quản trị PM.
   * File xuất ra chứa đầy đủ 22 trường thông tin: Mã đợt, Mã NV, Họ tên, Phòng ban, Model, Kho, Số tiền, Mã GD ngân hàng, Giờ nộp, Người phê duyệt, sẵn sàng nộp cho Giám đốc Tài chính và Kế toán kho LGEVH.

---

## PHẦN C: CẬP NHẬT BẢN V1 CHÍNH THỨC (05/10/2026)

> Chi tiết kỹ thuật và lý do: [`docs/04-v1-hardening/`](../04-v1-hardening/README.md). Phần này chỉ mô tả những gì người dùng **thấy và làm khác đi**.

### C.1. Nhân viên

| Tình huống | Bản v1 hoạt động thế nào |
|---|---|
| Vào hệ thống | Dùng **link chính thức** do PM/Admin gửi (`…/portal.html`). Đăng nhập bằng Mã NV + mật khẩu được cấp — **không cần cấu hình gì**. Bản chính thức không có tài khoản demo. |
| Xem danh mục | Trạng thái "Còn trống / Đã có người giữ" lấy trực tiếp từ máy chủ và tự cập nhật khoảng **6–8 giây** một lần khi bạn đang ở Tab Danh mục. |
| Bấm giữ chỗ nhưng vừa có người nhanh hơn | Hệ thống báo *"đã có người đăng ký trước"* và **cập nhật ngay** các slot đã hết trên màn hình. Không bao giờ có 2 người cùng giữ 1 slot — chọn sản phẩm khác. |
| Ô "03 Đơn Hàng Của Bạn" | Hiện **đơn thật** của bạn từ máy chủ. Khi đơn đang chờ PM mở cổng, ô này tự kiểm tra lại mỗi 60 giây — khi PM mở cổng sẽ hiện **"CỔNG TT ĐÃ MỞ"** và nút **"Nộp tiền ngay"**. |
| Hủy giữ chỗ | Có hiệu lực thật trên máy chủ, slot trả về kho cho đồng nghiệp ngay. Chỉ hủy được **trước khi khai nộp tiền** (xem Bước 4). |
| Thấy "Đang kết nối máy chủ…" | Máy chủ Google đang chậm (thường vài phút đầu mở bán). Trang tự thử lại sau 15 giây, hoặc bấm **Thử lại ngay**. Nếu mạng công ty chặn, chuyển sang 4G/5G. Dữ liệu của bạn không bị mất. |
| Báo "phiên đăng nhập không khớp / không hợp lệ" | Đăng xuất rồi đăng nhập lại. |

### C.2. PM

| Tình huống | Bản v1 hoạt động thế nào |
|---|---|
| Bật/tắt email tự động | **Chỉ tài khoản ADMIN** thấy nút **"Email tự động [BẬT/TẮT]"** trên thanh nút Bảng Điều Khiển PM. PM cần đổi thì liên hệ ADMIN. Hướng dẫn: [`V1_RELEASE_RUNBOOK.md` mục 4](../04-v1-hardening/V1_RELEASE_RUNBOOK.md). |
| Duyệt hàng loạt | Hệ thống chờ máy chủ xác nhận rồi mới báo **"Máy chủ đã duyệt X / Y đơn"**, sau đó tự tải lại bảng. Nếu máy chủ lỗi: không đơn nào bị đánh dấu duyệt nhầm — bấm lại. |
| Đơn nhân viên tự hủy | Hiện trạng thái **"Đã hủy bởi nhân viên"**, slot đã trả về kho. |
| Tài khoản demo | Chỉ dùng trong **bản demo** để đào tạo. Không thao tác được trên máy chủ chính thức. |

### C.3. ADMIN (role mới, 05/10/2026)

| Tình huống | Bản v1 hoạt động thế nào |
|---|---|
| Đăng nhập | Giao diện giống PM, thanh người dùng ghi **"Admin hệ thống"**. |
| Quản lý chương trình | Thấy và thao tác **mọi chương trình** của mọi PM (mở cổng, duyệt, từ chối, kết sổ…). Mọi thao tác ghi `ActivityLog`. |
| Cài đặt hệ thống | Nút **"Email tự động [BẬT/TẮT]"** — rê chuột xem số email còn gửi được hôm nay. |
| Gán / bỏ quyền | Admin sửa cột `Role` trong tab `Users` (`ADMIN` / `PM` / `USER`). Chi tiết: [`V1_RELEASE_RUNBOOK.md` mục 4b](../04-v1-hardening/V1_RELEASE_RUNBOOK.md). |

## BẢNG TRA CỨU MÃ MÀU TRẠNG THÁI CHUẨN THƯƠNG HIỆU LG

| Ký hiệu màu | Mã HEX chuẩn | Trạng thái hiển thị | Ý nghĩa vận hành |
|---|---|---|---|
| **Chấm Xanh Lá** | `#287D00` | `Đang Mở Bán` | Chương trình đang hoạt động, nhân viên được đăng ký. |
| **Chấm Vàng Toast** | `#DEAD25` | `Dự Thảo` / `Chờ đối soát` | Chương trình chưa mở bán hoặc đơn hàng đang chờ PM duyệt tiền. |
| **Icon Khóa Xám** | `#716F6A` | `Đã Kết Sổ` | Chương trình đã đóng, không tiếp nhận thêm đăng ký. |
| **Đỏ Heritage** | `#A50034` | Nút bấm chính / Header | Màu sắc nhận diện danh tính cao cấp của tập đoàn LG Electronics. |
