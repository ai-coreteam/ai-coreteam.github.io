# Người nhận hàng & số điện thoại — hiện trạng & đề xuất (12/10/2026)

> Trạng thái: **ĐÃ LÀM ở v2.12.0** (12/10/2026). Chủ dự án chọn: cột riêng · mặc định "Tôi là người nhận" · **cho nhân viên tự sửa SĐT** (khác khuyến nghị: mục 6 đổi thành "tự sửa ở cửa sổ địa chỉ, ghi nhật ký PHONE_UPDATE; tra cứu đơn cũ vẫn theo SĐT lúc giữ chỗ") · gộp vào Apps Script Version 12. Câu hỏi: số điện thoại tự cập nhật — nhân viên sửa tay được
> không; thêm số điện thoại người nhận cùng địa chỉ được không (người đăng ký và người nhận có thể khác nhau).

## 1. Hiện trạng (đọc code v2.11.0)

| Hạng mục | Hiện tại | Nguồn |
|---|---|---|
| SĐT lấy từ đâu | Tab **Users cột E** → đăng nhập trả `user.phone` → web tự gửi kèm lệnh giữ chỗ → **Registrations cột I** | `auth_()`, `register_product` (`phone: currentUser.phone`) |
| SĐT cột I dùng vào việc gì | (1) **Tra cứu đơn không đăng nhập** = Mã NV + **4 số cuối SĐT** · (2) PM xem ở bảng đơn · (3) file Excel giao hàng | `lookup_()` dòng so `C.PHONE` |
| Nhân viên tự sửa SĐT | **Không có chỗ nào lưu được.** | — |
| ⚠️ Ô "Số điện thoại liên hệ" trong cửa sổ **Nộp tiền ngay** | Sửa được, web **có gửi** lên, nhưng máy chủ (`payment_`) **không đọc** → **số sửa bị bỏ qua, không báo gì** [đã kiểm code: `payment_` không có `d.phone`] | `handleQuickPaymentSubmit`, `payment_()` |
| Người nhận hàng (tên + SĐT) khác người đăng ký | **Chưa có.** Chỉ có 1 ô địa chỉ (cột J). | — |
| Form đăng ký kiểu cũ (có ô SĐT, địa chỉ) | Ẩn (`display:none`), không dùng | `#system-reg-form` |

## 2. Đề xuất (khuyến nghị)

**Nguyên tắc:** tách 2 vai trò — **người đăng ký** (SĐT chính thức, dùng để tra cứu, không đổi trên web) và **người nhận hàng**
(tên + SĐT đi cùng địa chỉ, mặc định = chính mình → không phải gõ thêm).

```mermaid
flowchart LR
  U[(Users: E = SĐT người đăng ký · Address · ReceiverName · ReceiverPhone)] -->|tự điền| M[Cửa sổ Địa chỉ nhận hàng<br>☑ Tôi là người nhận (mặc định)<br>☐ → Tên + SĐT người nhận]
  M -->|giữ chỗ| R[(Registrations: I = SĐT người đăng ký · J = Địa chỉ<br>X = Tên người nhận · Y = SĐT người nhận)]
  R --> PM[PM: bảng đơn, cửa sổ biên lai, Excel giao hàng]
  R -->|Đổi địa chỉ / người nhận<br>trước khi khai nộp| R
```

| # | Hạng mục | Cách làm | Đợt |
|---|---|---|---|
| 1 | **Người nhận = mặc định chính mình** | Cửa sổ địa chỉ thêm ô tick **"Tôi là người nhận hàng"** (mặc định bật, hiện tên + SĐT của mình). Bỏ tick → 2 ô: **Tên người nhận**, **SĐT người nhận** (10 số, bắt đầu bằng 0). | cùng V12 |
| 2 | **Lưu có cấu trúc** | Users thêm cột `ReceiverName`, `ReceiverPhone` (tìm theo tên, tự thêm như cột Address); Registrations thêm **cột X, Y** cuối bảng (sau Serial — 23 cột cũ không đổi). Trống = người nhận là người đăng ký. | cùng V12 |
| 3 | **PM & giao hàng thấy** | Bảng đơn + cửa sổ biên lai: "Người nhận: Tên · SĐT" (khi khác người đăng ký); file Excel thêm 2 cột. | cùng V12 |
| 4 | **Đổi người nhận của đơn** | Dùng chung nút "Đổi địa chỉ" (trước khi khai nộp), ghi vết cột Ghi chú. | cùng V12 |
| 5 | **Sửa lỗi ô SĐT ở "Nộp tiền ngay"** | Đổi thành **chỉ đọc** (SĐT người đăng ký) + dòng người nhận phía trên (đã có ô địa chỉ) → không còn ô sửa mà không lưu. | cùng V12 |
| 6 | **SĐT người đăng ký sai** | **Không** cho sửa trên web (là khóa tra cứu đơn + danh tính); ADMIN sửa Users cột E. Web ghi rõ: "SĐT sai? Liên hệ quản trị". | cùng V12 |

**Vì sao không gộp người nhận vào chuỗi địa chỉ:** đơn giản hơn nhưng bên giao hàng / Excel không lọc, không gọi được theo cột;
SĐT không kiểm tra định dạng; tên người có thể làm sai việc nhận miền (vd. tên có chữ "Nam").

## 3. Đo lường

| Chỉ số | Mục tiêu | Đo bằng |
|---|---|---|
| Đơn có người nhận ≠ người đăng ký nhưng thiếu SĐT người nhận | 0 | Registrations X có giá trị mà Y trống |
| SĐT người nhận sai định dạng | 0 | Kiểm tra máy chủ (10 số, đầu 0) |
| Số sửa ở "Nộp tiền ngay" bị mất | 0 (ô chỉ đọc) | — |
| Thao tác thêm của người tự nhận hàng | 0 (mặc định đã tick) | — |

## 4. Rủi ro
| Rủi ro | Xử lý |
|---|---|
| Thêm cột vào Registrations | Thêm **cuối bảng** (X, Y), tìm cột theo vị trí sau Serial như cách làm cột W; web cũ / Excel cũ không đọc → không vỡ. |
| Sát giờ mở bán | Gộp vào **cùng 1 lần deploy V12** (chưa deploy) → 1 lần kiểm tra; web vẫn chạy với V11 (tự dùng cách cũ). |
| Dữ liệu cá nhân người nhận | Chỉ chủ đơn + PM thấy (như địa chỉ); tra cứu bằng 4 số cuối không trả. |
