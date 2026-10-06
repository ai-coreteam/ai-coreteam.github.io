# SỔ TAY VẬN HÀNH NGÀY MỞ BÁN
### Dành cho ADMIN và PM — làm theo thứ tự, đánh dấu ☑ từng việc khi xong

| | |
|---|---|
| Áp dụng cho | Bản **v2.0** — giao diện mới bật cho mọi người 06/10/2026 (chức năng như v1.4). Tên nút / màu: [`PM_AND_USER_OPERATIONAL_GUIDE.md`](PM_AND_USER_OPERATIONAL_GUIDE.md) Phần D |
| Link nhân viên | `https://gobitangocbao.github.io/lg-internal-sales-portal/portal.html` |
| Đợt bán | Mở **10:00 ngày 14/10/2026** → kết thúc **17:00 ngày 16/10/2026** |
| Đối chiếu | Mọi bước dưới đây đã được kiểm tra với mã nguồn ngày 05/10/2026 |

> **Cách dùng:** in trang này ra hoặc mở trên máy tính. Làm xong việc nào thì đánh dấu ô ☐ → ☑. Việc nào ghi **ADMIN** thì người giữ tài khoản ADMIN làm; ghi **PM** thì PM của đợt bán làm.
> Gặp sự cố: xem **Phần 3** ở cuối trang trước khi làm gì khác.

---

## Phần 0 — 5 điều phải nhớ

| # | Điều | Vì sao |
|---|---|---|
| 1 | **Không sửa, xóa, chèn cột A–H** của tab `Users`, `Registrations`, `Programs`, `Products` trong Google Sheet | Máy chủ đọc dữ liệu theo **vị trí cột**. Đổi cột = hệ thống đọc sai hàng loạt |
| 2 | **Không ghi mật khẩu thật** vào tin nhắn nhóm, email, tài liệu | Ai có mật khẩu ADMIN = xem và duyệt được mọi đơn |
| 3 | Trạng thái chương trình chỉ đi **một chiều: Dự thảo → Mở bán → Đã kết sổ**. Đã kết sổ thì **không mở lại được** trên web | Máy chủ chặn mở lại (nút "Mở lại chương trình" trên web sẽ báo lỗi) |
| 4 | Bảng Điều Khiển PM **không tự cập nhật** — luôn bấm **`Tải lại`** trước khi xem số liệu hay duyệt | Để không duyệt trên số liệu cũ |
| 5 | **Duyệt tiền theo sao kê ngân hàng**, biên lai chỉ để đối chiếu thêm | Cửa sổ "Chứng từ thanh toán" (từ v1.2) có nút **"Mở biên lai thật ↗"** mở file trên Google Drive, hoặc ghi "Chưa có ảnh biên lai". Hệ thống **không** tự vẽ biên lai |

---

## Phần 1 — Thuật ngữ trong 1 bảng

| Từ trên màn hình | Nghĩa |
|---|---|
| **Giữ chỗ** | Nhân viên bấm chọn 1 máy. Ai bấm trước được trước. Mỗi người chỉ 1 máy |
| **Đã đăng ký - Chờ mở thanh toán** | Đã giữ chỗ, **chưa** được chuyển tiền |
| **Mở cổng thanh toán** | PM cho phép các đơn đang chờ được chuyển tiền. **Đồng hồ 24 giờ bắt đầu từ lúc này** |
| **Chờ nộp tiền** | Cổng đã mở, nhân viên có 24 giờ để chuyển khoản và tải ảnh biên lai |
| **Đã khai nộp - chờ đối soát** | Nhân viên đã báo nộp tiền, chờ PM kiểm tra |
| **Đã duyệt thanh toán** | PM đã xác nhận tiền về. Đơn hoàn tất |
| **Hết hạn giữ chỗ** | Quá 24 giờ chưa nộp → máy chủ **tự** trả máy về kho (mỗi giờ quét 1 lần) |
| **Trigger / Watchdog** | "Đồng hồ báo thức" của máy chủ, tự quét đơn quá hạn mỗi giờ. Đã cài ngày 05/10/2026 |

---

## Phần 2 — Checklist theo mốc thời gian

### A. Trước ngày mở bán (làm xong trước 17:00 ngày 13/10)

**Tài khoản & bảo mật — ADMIN**
- [ ] Tài khoản ADMIN và mọi tài khoản PM đã đổi sang mật khẩu **riêng, từ 10 ký tự**, bằng nút **"Đổi MK"** trên web (không gõ thẳng vào Sheet — đổi trên web thì mật khẩu được mã hóa)
- [ ] Tài khoản mẫu không dùng (`VH88921`, `VH55432`): tab `Users` → cột H `Status` = `Inactive`
- [ ] Nạp danh sách nhân viên thật vào tab `Users`: mỗi người 1 dòng, đủ cột A–H, cột G `Role` = `USER`, cột H `Status` = `Active`
- [ ] Thử đăng nhập 1 tài khoản nhân viên thật trên link nhân viên → vào được

**Máy chủ — ADMIN** (Google Apps Script, dự án "LG Internal sales API")
- [ ] Bấm biểu tượng **đồng hồ** (Triggers) ở cột trái → thấy **đúng 1 dòng** `runExpirationWatchdog`, Event `Time-based`
- [ ] Cột **Last run** có giờ (không phải dấu `-`) và **Error rate** = `0%` → đồng hồ quét đang chạy
- [ ] **Không sửa code** trong trình soạn thảo Apps Script từ giờ đến hết đợt bán (đồng hồ quét chạy đúng bản code đang lưu trong trình soạn thảo)

**Chương trình bán — PM** (hướng dẫn chi tiết: [`PM_AND_USER_OPERATIONAL_GUIDE.md`](PM_AND_USER_OPERATIONAL_GUIDE.md) Phần B, Bước 1)
- [ ] Đăng nhập tài khoản PM → **`+ Tạo chương trình`** → tải file Excel mẫu → điền → kéo thả → **"Kích Hoạt Mở Bán"**
- [ ] ⚠️ **Ngay sau đó (trong 1 phút):** mở Google Sheet → tab `Programs` → dòng chương trình vừa tạo → cột E `Status` gõ đúng chữ **`Draft`** (D hoa, còn lại chữ thường)
  > Lý do: nút "Kích Hoạt Mở Bán" mở bán **ngay lập tức**, máy chủ **không** tự chờ đến 10:00. Đặt `Draft` để nhân viên chưa thấy chương trình.
- [ ] Đợi 1 phút → đăng nhập bằng 1 tài khoản nhân viên → **không** thấy chương trình mới (ô 02 ghi "Chưa có đợt bán")
- [ ] Tab `Registrations` không có đơn nào của chương trình mới (nếu có: báo ADMIN — Phần 3)
- [ ] Kiểm tra số sản phẩm trên tab `Products` khớp file Excel

**Email & thông báo — ADMIN quyết định**
- [ ] Chọn 1 trong 2 và ghi lại: ☐ **TẮT** email tự động, thông báo nhân viên qua Teams/Zalo (hiện đang TẮT) · ☐ **BẬT** email
  > Hạn mức Gmail: **100 email/ngày**, ngày mở bán dự kiến cần ~180. Hết hạn mức thì email ngừng, **đơn vẫn chạy bình thường**. Bật/tắt: đăng nhập ADMIN → Bảng Điều Khiển PM → nút **"Email tự động"**.
- [ ] Đã gửi nhân viên: link nhân viên, giờ mở bán, mật khẩu ban đầu (gửi riêng từng người), [Phần A của hướng dẫn](PM_AND_USER_OPERATIONAL_GUIDE.md)

**Chốt lịch — chủ dự án**
- [ ] Giờ PM bấm **mở cổng thanh toán** lần đầu: ______ (nhân viên có 24 giờ kể từ giờ này)
- [ ] Người trực & số điện thoại liên hệ trong đợt bán: ADMIN ______ · PM ______

---

### B. Sáng 14/10 — trước giờ mở bán

| Giờ | Việc | Ai | ☐ |
|---|---|---|---|
| 9:30 | Mở Google Sheet, Bảng Điều Khiển PM, Apps Script (trang Triggers) trên máy tính trực | ADMIN, PM | ☐ |
| 9:45 | **Khởi động máy chủ**: mở link nhân viên, đăng nhập 1–2 lần. Lần đầu có thể chậm 15–40 giây — bình thường | ADMIN | ☐ |
| 9:50 | Đăng nhập lại lần nữa → phản hồi trong vài giây | ADMIN | ☐ |
| 9:55 | PM đăng nhập, chọn đúng chương trình, sẵn sàng nút **"Mở bán ngay"** | PM | ☐ |

### C. 10:00 — Mở bán

| Việc | Ai | ☐ |
|---|---|---|
| Đúng 10:00 bấm **"Mở bán ngay"** trên banner chương trình | PM | ☐ |
| Đăng nhập 1 tài khoản nhân viên → thấy chương trình và danh sách sản phẩm | ADMIN | ☐ |
| 10:05 — Bảng Điều Khiển PM → **`Tải lại`** → bắt đầu có đơn mới | PM | ☐ |
| Mỗi 15–30 phút: **`Tải lại`**, xem số đơn; mở tab `ActivityLog` xem có dòng báo lỗi bất thường không | PM, ADMIN | ☐ |

### D. Mở cổng thanh toán & đối soát (theo giờ đã chốt ở mục A)

| Việc | Ai | ☐ |
|---|---|---|
| Bấm **"Mở cổng thanh toán (N)"** — N là số đơn đang chờ. Từ lúc này các đơn đó có 24 giờ | PM | ☐ |
| ⚠️ Đơn đăng ký **sau** lần bấm này vẫn ở "Chờ mở thanh toán" → **bấm lại** khi thấy N > 0. Mỗi lần bấm, đồng hồ 24 giờ tính riêng cho nhóm đơn đó | PM | ☐ |
| Mỗi buổi: **`Tải lại`** → xem các đơn "Đã khai nộp - chờ đối soát" | PM | ☐ |
| **Đối soát:** đối chiếu **sao kê ngân hàng** (số tiền, nội dung chuyển khoản có Mã NV) với đơn. Xem biên lai: bấm nút biên lai của đơn → **"Mở biên lai thật ↗"** (mở Google Drive). Người mở cần quyền xem thư mục Drive "Bien lai nop tien" — ADMIN chia sẻ (Viewer) cho PM sau đơn nộp tiền đầu tiên | PM, ADMIN | ☐ |
| Khớp sao kê → **"Duyệt Thanh Toán Này"** (từng đơn) hoặc **"Duyệt hàng loạt (N)"**. Chờ báo *"Máy chủ đã duyệt X / Y đơn"* | PM | ☐ |
| Không khớp → **"Từ Chối Đơn"** (máy được trả về kho) | PM | ☐ |
| Đơn quá 24 giờ chưa nộp: máy chủ **tự** chuyển "Hết hạn giữ chỗ" mỗi giờ. Muốn quét ngay: nút **"Quét quá hạn 24h"** | PM | ☐ |

### E. 17:00 ngày 16/10 — Kết sổ

| Việc | Ai | ☐ |
|---|---|---|
| Bấm **"Kết sổ chương trình"** → xác nhận. Từ lúc này **không ai giữ chỗ thêm được**. Nộp tiền, duyệt, quét quá hạn **vẫn hoạt động** cho các đơn còn lại | PM | ☐ |
| Duyệt / từ chối hết các đơn còn "chờ đối soát" | PM | ☐ |
| Bấm **"Xuất Excel (CSV)"** → lưu file (gồm **mọi** đơn; lọc cột Trạng thái = "Đã duyệt thanh toán" để ra danh sách giao hàng) | PM | ☐ |
| Gửi file cho Kế toán & Kho | PM | ☐ |
| ADMIN: File → Make a copy Google Sheet làm bản lưu đợt bán | ADMIN | ☐ |

---

## Phần 3 — Xử lý sự cố (đọc cột "Làm gì" trước)

| Bạn thấy | Nghĩa là | Làm gì | Gọi ai |
|---|---|---|---|
| Giao diện hiển thị lạ / lệch / nút không bấm được trên máy của ai đó | Lỗi hiển thị giao diện v2 trên trình duyệt đó | Mở link có thêm **`?ui=v1`** (giao diện cũ v1.4, cùng chức năng) và báo kỹ thuật kèm ảnh chụp | Kỹ thuật |
| Nhân viên báo "Đang kết nối máy chủ…" | Máy chủ Google đang chậm (hay gặp vài phút đầu) | Bảo nhân viên chờ, trang tự thử lại sau 15 giây hoặc bấm **"Thử lại ngay"**. Mạng công ty chặn → dùng 4G/5G | — |
| Nút đăng nhập ghi "Máy chủ đang khởi động… vui lòng chờ (tối đa 45 giây)" | Máy chủ vừa "ngủ", lần đầu thức dậy mất 15–40 giây | **Chờ, không bấm lại.** Phòng tránh: ADMIN khởi động máy chủ lúc 9:45 (Phần 2-B) | — |
| Báo "quá thời gian chờ (45s)" (hoặc "(12s)" nếu đang mở bản cũ) | Máy chủ quá tải / mạng chặn | Tải lại trang (Cmd/Ctrl+Shift+R) rồi đăng nhập lại sau 1–2 phút; vẫn lỗi → dùng 4G/5G, báo ADMIN | ADMIN |
| Ô 02 ghi "Đang tải…" | Danh sách sản phẩm chưa về | Chờ 15–40 giây. **Không phải** hết hàng | — |
| Nhân viên báo "đã có người đăng ký trước" | Người khác bấm nhanh hơn vài giây | Bình thường. Chọn máy khác | — |
| "Phiên đăng nhập không khớp / không hợp lệ" | Phiên cũ | Đăng xuất → đăng nhập lại | — |
| Nhân viên không đăng nhập được | Sai mật khẩu / `Status` = `Inactive` / chưa có trong `Users` | ADMIN kiểm tra dòng của người đó trong tab `Users` (cột B, H) | ADMIN |
| Nhân viên không thấy chương trình | Chương trình chưa ở trạng thái `Open`, hoặc cột E gõ sai (phải đúng `Open`) | PM kiểm tra banner chương trình; ADMIN kiểm tra tab `Programs` cột E | PM |
| Nhân viên muốn hủy nhưng không hủy được | Đã khai nộp tiền — quy định chỉ hủy **trước** khi khai nộp | PM dùng **"Từ Chối Đơn"** và xử lý hoàn tiền theo quy trình kế toán | PM |
| Có đơn đăng ký **trước 10:00** | Chương trình bị mở sớm (quên đặt `Draft`) | Chụp tab `Registrations`; báo chủ dự án quyết định giữ hay hủy (PM "Từ Chối Đơn"). Không tự xóa dòng | Chủ dự án |
| Bấm "Mở biên lai thật ↗" → Google báo "Bạn cần quyền truy cập" | Tài khoản Google của bạn chưa được chia sẻ thư mục "Bien lai nop tien" | ADMIN: Google Drive → thư mục "Bien lai nop tien" (cạnh file Sheet) → Share → thêm email PM → Viewer | ADMIN |
| Cửa sổ biên lai ghi "Chưa có ảnh biên lai trong hệ thống" | Nhân viên khai nộp nhưng không tải ảnh | Đối soát bằng sao kê; thiếu thông tin thì liên hệ nhân viên | PM |
| Cửa sổ biên lai hiện hình xanh "Giao dịch thành công" có mã GD lạ | Đang mở **bản cũ** của trang (trước v1.2) | Tải lại trang (Ctrl+Shift+R / Cmd+Shift+R). Vẫn thấy → báo kỹ thuật | Kỹ thuật |
| Bấm "Mở lại chương trình" bị báo lỗi | Máy chủ không cho mở lại chương trình đã kết sổ | Nếu thật sự cần mở lại: ADMIN đổi cột E tab `Programs` thành `Draft`, PM bấm "Mở bán ngay" | ADMIN |
| Trang Triggers: Error rate > 0% hoặc Last run quá 2 giờ trước | Đồng hồ quét lỗi / dừng | ADMIN: Apps Script → chọn hàm **`setupWatchdogTrigger`** → **Run**. Vẫn lỗi → báo kỹ thuật kèm ảnh chụp mục Executions | ADMIN → kỹ thuật |
| Email không gửi | Công tắc đang TẮT, hoặc hết 100 email/ngày | Rê chuột lên nút "Email tự động" xem số còn lại. Thông báo qua Teams/Zalo thay thế | ADMIN |
| Nghi lộ mật khẩu ADMIN / PM | — | Đổi mật khẩu ngay. Kỹ thuật chạy `rotateSessionSecret` → mọi người đăng nhập lại 1 lần | ADMIN → kỹ thuật |
| Hệ thống lỗi nặng, không ai vào được sau 10 phút | — | Kỹ thuật lùi về bản cũ: [Runbook §1](../04-v1-hardening/V1_RELEASE_RUNBOOK.md) (Apps Script → Version 6). Dữ liệu trong Sheet **không** mất | Kỹ thuật |

---

## Phần 4 — Đọc thêm khi cần

| Cần | Tài liệu |
|---|---|
| Từng thao tác của PM có giải thích | [`PM_AND_USER_OPERATIONAL_GUIDE.md`](PM_AND_USER_OPERATIONAL_GUIDE.md) Phần B, C |
| Gửi nhân viên | Cùng file, Phần A |
| Kỹ thuật: cài đặt, khôi phục, kiểm thử | [`V1_RELEASE_RUNBOOK.md`](../04-v1-hardening/V1_RELEASE_RUNBOOK.md) |
| Hệ thống đang ở trạng thái nào, việc còn mở | [`CURRENT_STATE.md`](../CURRENT_STATE.md) |
