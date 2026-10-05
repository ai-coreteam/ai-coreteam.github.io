# 04 — V1 Hardening (Gia cố bản v1 chính thức)

Thư mục này lưu mọi thay đổi trong giai đoạn chuẩn bị go-live bản v1 (14/10/2026) và sau đó.

## Quy tắc

1. **Đề xuất trước, sửa sau.** Thay đổi chạm luồng Admin / PM / Nhân viên, hoặc chạm hàm trong Vùng Bất Khả Xâm Phạm (`03-architecture-and-analysis/IMPROVEMENT_PLAN_PROPOSAL.md` §3B), phải được chủ dự án duyệt.
2. **Mỗi thay đổi đã làm** cập nhật: bảng *Nhật ký thay đổi* bên dưới, và hướng dẫn sử dụng liên quan trong `02-user-and-pm-guide/`.
3. **Có test chạy code thật** cho mỗi lỗi được sửa (`tests/cloud_mode_regression.py` hoặc test staging).

## Tài liệu

| File | Nội dung | Dành cho |
|---|---|---|
| [`V1_HARDENING_CHANGE_PROPOSAL.md`](V1_HARDENING_CHANGE_PROPOSAL.md) | 22 phát hiện có bằng chứng, đo rủi ro polling, 5 gói thay đổi, tiêu chí go-live | Chủ dự án, kỹ sư |
| [`V1_RELEASE_RUNBOOK.md`](V1_RELEASE_RUNBOOK.md) | Điểm khôi phục & cách quay lại, staging, trình tự triển khai, **công tắc email**, xử lý sự cố, lệnh kiểm thử | Admin / PIC, PM (mục 4) |
| [`../02-user-and-pm-guide/PM_AND_USER_OPERATIONAL_GUIDE.md`](../02-user-and-pm-guide/PM_AND_USER_OPERATIONAL_GUIDE.md) — Phần C | Những gì nhân viên & PM thấy khác đi trong bản v1 | Nhân viên, PM |

## Vùng Bất Khả Xâm Phạm — ngoại lệ đã dùng (ghi minh bạch)

| Hàm (No-Touch #) | Thay đổi | Lý do | Duyệt |
|---|---|---|---|
| `loadProducts` (#8) | Chờ 8 giây + thử lại 2 lần; tài khoản thật không rơi về dữ liệu demo | V1-03 | Gói A — 05/10 |
| `handleRegisterProduct` (#1) | **Chỉ thêm 2 dòng gọi hàm**: làm mới ô 03 khi giữ chỗ thành công; áp danh sách slot đã hết khi bị từ chối. Logic giữ chỗ không đổi | V1-02, C6 | Gói A + C — 05/10 (phần này chưa ghi rõ trong bảng đề xuất, bổ sung tại đây) |

## Nhật ký thay đổi

| Ngày | ID | Thay đổi | Ảnh hưởng luồng | Trạng thái | Tài liệu đã cập nhật |
|---|---|---|---|---|---|
| 05/10/2026 | — | Lập đề xuất V1 Hardening | — | Chờ duyệt | Thư mục này |
| 05/10/2026 | D | Thêm `tests/cloud_mode_regression.py` (baseline 3/7) | Không | Đã thêm | Thư mục này |
| 05/10/2026 | C2 | Quy tắc hủy giữ chỗ: chỉ trước khi khai nộp tiền | Nhân viên | **Đã duyệt** (chưa code) | Đề xuất §5, §8 |
| 05/10/2026 | D | Thêm `tests/polling_race_simulation.py` | Không | Đã thêm | Đề xuất §4 |
| 05/10/2026 | — | Đề xuất bản 2: thêm V1-00 (nhân viên không có URL máy chủ), V1-19 (Sheet ai có link cũng sửa được), đo polling, Gói P | — | **Đã duyệt cả 5 gói** | Đề xuất |
| 05/10/2026 | K1 | Sheet chính chuyển sang Restricted (chủ dự án tự làm) | Admin | Xong — đã xác minh quyền Drive | Runbook §1 |
| 05/10/2026 | — | Điểm khôi phục: git tag `checkpoint-pre-v1-hardening-20261005`, nhánh `backup/pre-v1-hardening-20261005`, bản sao Sheet BACKUP + STAGING (riêng tư) | Không | Xong | Runbook §1–2 |
| 05/10/2026 | B1–B4 | Máy chủ: bỏ chấp nhận token demo, khóa phiên ngẫu nhiên + `rotateSessionSecret()`, giữ chỗ/nộp tiền/hủy bắt buộc phiên chính chủ, từ chối đơn chỉ mở đúng slot | Admin (1 lệnh), mọi người đăng nhập lại 1 lần | Code xong, test 52/52 | Runbook §3; SETUP_APPS_SCRIPT |
| 05/10/2026 | C1–C7 | Khóa khi ghi sheet; route hủy giữ chỗ; `setupNewDatabase` an toàn; cache chương trình; seed email TẮT; endpoint polling `taken`; duyệt hàng loạt chờ máy chủ | Nhân viên (hủy), PM (duyệt hàng loạt) | Code xong, test 52/52 + 25/25 | Guide Phần C |
| 05/10/2026 | K2 | **Công tắc Email tự động BẬT/TẮT** + action `email_setting` (sau đó giới hạn **chỉ ADMIN** — xem dòng ADMIN) | ADMIN | Code xong, test | Runbook §4; Guide C.3; SETUP_APPS_SCRIPT |
| 05/10/2026 | A1–A4 | Danh mục, ô 02, ô 03 đúng dữ liệu máy chủ; không rơi về demo; panel "Đang kết nối máy chủ… / Thử lại"; sửa chữ "sau 2 giờ"; polling 10–12 giây *(sau đó trả về 6–8 giây — dòng Q2)* | Nhân viên | Code xong, test 25/25 | Guide C.1 |
| 05/10/2026 | P | `PORTAL_MODE` + `scripts/build_production.py` → `portal.html` không có dữ liệu demo; nút Hỗ trợ dùng bí danh chung thay tên/hotline mẫu | Nhân viên (link mới) | Code xong, test | Runbook §3 |
| 05/10/2026 | D | `tests/backend_gas_harness.js`, `tests/staging_smoke_test.py`; mở rộng `cloud_mode_regression.py` (7 kịch bản) | Không | Xong | Runbook §6 |
| 05/10/2026 | Staging | Chủ dự án deploy staging (Runbook §2 bước 1–6). Đo trên máy chủ thật: token giả 5/5 bị chặn, FCFS đúng 1 người thắng (3 lần, kể cả dưới tải), polling 0% lỗi tới 60 yêu cầu/giây | Không | **ĐẠT** | Runbook §2, Đề xuất §4.5 |
| 05/10/2026 | Staging | Sự cố do test: 4 lượt giữ chỗ thử đã gửi email xác nhận thật tới địa chỉ mẫu của tài khoản test trước khi tắt email staging. Đã TẮT `ENABLE_AUTO_EMAIL` trên staging; thêm cảnh báo hạn mức email dùng chung | Không | Đã xử lý | Runbook §2, §4 |
| 05/10/2026 | Q2 | Polling trả về **6–8 giây** (thiết kế đã duyệt) theo số đo staging | Nhân viên | Code xong | Đề xuất §4.5; Guide C.1 |
| 05/10/2026 | ADMIN | **Role mới `ADMIN`**: toàn quyền PM trên mọi chương trình + cài đặt hệ thống. Công tắc email **chỉ ADMIN** thấy & đổi được (máy chủ kiểm tra `ADMIN`) | ADMIN, PM | Code xong, test 63/63 + 32/32; staging chờ deploy bản mới | Runbook §4, §4b; Guide C.3; USERS_SHEET_TEMPLATE |
| 05/10/2026 | — | Nút Hỗ trợ: liên hệ `minhhien.hoang@lge.com` (theo chủ dự án) | Nhân viên | Code xong | — |
| 05/10/2026 | Docs | **Rà soát toàn bộ tài liệu**: tạo `docs/CURRENT_STATE.md` (nguồn chuẩn); viết lại `docs/README.md`; sửa Hướng dẫn vận hành Phần A/B theo giao diện thật (giữ chỗ 1 chạm, nhãn nút, trạng thái, hẹn giờ chỉ chạy khi trang PM mở); cập nhật 01-setup, E2E walkthrough, README gốc, PROJECT_PLANNING; khung trạng thái cho 4 đề xuất 02 + 13 file 03; HANDOVER mục 0.3; ghi chú `assets/` | Không (chỉ tài liệu) | Xong | Toàn bộ `docs/`, `assets/*/README.md` |
| 05/10/2026 | Phát hiện | Trong lúc rà soát: **đơn ảo từ bản demo hiện trong `portal.html`** (tái hiện bằng test), PM Dashboard không tự làm mới, hẹn giờ phụ thuộc trình duyệt PM, Jeong-Do không có ô tích, câu chữ Tour lệch v1, tab `Users` đọc theo vị trí cột | Nhân viên, PM | **Chờ duyệt** — không sửa code | `CURRENT_STATE.md` mục 9 (14–20); Runbook §5 |
| 05/10/2026 | 2b | Staging chạy bản có role ADMIN (Version 2): ADMIN đọc công tắc email + xem Dashboard PM khác, PM bị chặn, 5/5 token giả bị từ chối | Không | **ĐẠT** | Runbook §2b |
| 05/10/2026 | V1-16 | `pm_dashboard_`: PM không gửi mã chương trình → chỉ nhận đơn chương trình mình phụ trách (trước: mọi chương trình). ADMIN không đổi. 5 dòng `Code.gs` | PM (không thấy khác khi dùng bình thường) | Code xong, harness 67/67 (bản cũ FAIL 2); chờ deploy staging → chính thức | CURRENT_STATE §7, §9 |
| 05/10/2026 | 14 | `build_production.py` đổi tên 8 khóa bộ nhớ trình duyệt trong `portal.html` → không đọc đơn ảo và **hẹn giờ cũ của bản demo** (build cũ: hẹn giờ demo gửi lệnh thật `program_update`). Bản demo không đổi | Nhân viên, PM | Code xong, Kịch bản 8 — 37/37 (build cũ FAIL 3) | CURRENT_STATE §9; Runbook §3 bước 7, §5 |
| 05/10/2026 | 2b/2c | Staging Version 3 (có V1-16): 2b ĐẠT lần 2; V1-16 kiểm chứng trên máy chủ thật (PM không thấy đơn chương trình ADMIN, ADMIN thấy); không gửi email. Thêm cờ `--scope-user` vào `staging_smoke_test.py` | Không | **ĐẠT** | Runbook §2b |
