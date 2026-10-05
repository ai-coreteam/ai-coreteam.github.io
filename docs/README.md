# Tài Liệu Kỹ Thuật & Vận Hành — LG Internal Sales Portal

> 📌 **ĐỌC TRƯỚC: [`CURRENT_STATE.md`](CURRENT_STATE.md)** — thông tin hiện hành (phiên bản, vai trò USER / PM / ADMIN, thông số vận hành, việc còn mở). Khi tài liệu khác mâu thuẫn với trang này, trang này đúng. *Cập nhật mục lục: 05/10/2026.*

Thư mục `docs/` được tổ chức theo 4 nhóm chuyên mục phục vụ triển khai, vận hành và nâng cấp hệ thống:

```text
docs/
├── CURRENT_STATE.md                # [ĐỌC TRƯỚC] Thông tin hiện hành — nguồn chuẩn duy nhất
├── 01-setup-and-deployment/        # Hướng dẫn cài đặt, triển khai GitHub & Backend Cloud
├── 02-user-and-pm-guide/           # Cẩm nang quy trình & sơ đồ hướng dẫn cho Nhân viên, PM, ADMIN
├── 03-architecture-and-analysis/   # Báo cáo phân tích (lịch sử) — mỗi file có khung "Trạng thái" ở đầu
└── 04-v1-hardening/                # Bản v1: đề xuất, Runbook triển khai & khôi phục, nhật ký thay đổi
```

**Tính chất tài liệu:** 🟢 **Hiện hành** — dùng để làm việc · 🔵 **Đã triển khai** — đề xuất đã đưa vào code, đọc để hiểu lý do thiết kế · ⚪ **Lịch sử** — phân tích tại một thời điểm, có khung trạng thái cập nhật ở đầu file.

---

## 0. Nhóm 04: Bản v1 (`04-v1-hardening/`) — 🟢 Hiện hành

| Tài liệu | Mô tả | Đối tượng |
|---|---|---|
| **[`README.md`](04-v1-hardening/README.md)** | Quy tắc thay đổi, **nhật ký thay đổi** (mọi thay đổi chạm luồng Admin / PM / Nhân viên), ngoại lệ Vùng Bất Khả Xâm Phạm | Tất cả |
| **[`V1_RELEASE_RUNBOOK.md`](04-v1-hardening/V1_RELEASE_RUNBOOK.md)** | **Điểm khôi phục & cách quay lại**, staging, trình tự triển khai chính thức, **công tắc email (ADMIN)**, **role ADMIN**, xử lý sự cố, lệnh kiểm thử | Admin / PIC, ADMIN |
| **[`V1_HARDENING_CHANGE_PROPOSAL.md`](04-v1-hardening/V1_HARDENING_CHANGE_PROPOSAL.md)** | 22 phát hiện có bằng chứng, đo rủi ro polling (mô phỏng + staging thật), các gói thay đổi đã duyệt | Chủ dự án, kỹ sư |

---

## 1. Nhóm 01: Hướng Dẫn Cài Đặt & Triển Khai (`01-setup-and-deployment/`) — 🟢 Hiện hành

| Tài liệu | Mô tả chi tiết | Đối tượng |
|---|---|---|
| **[`GIT_CONFIGURATION_AND_HANDOVER.md`](01-setup-and-deployment/GIT_CONFIGURATION_AND_HANDOVER.md)** | **[CẨM NANG GIT & BÀN GIAO PIC]** Thông tin cấu hình mạng Git kép (origin & gobita), quy trình đồng bộ giữa các AI Agent, lệnh `git push all main` và SOP bàn giao khi chuyển PIC. | AI Agent, Quản trị viên, PIC mới |
| **[`AGENT_GUIDE_AUTO_SETUP_SHEET.md`](01-setup-and-deployment/AGENT_GUIDE_AUTO_SETUP_SHEET.md)** | **[CẨM NANG AGENT & PIC]** Hướng dẫn tác nhân AI tự động dẫn dắt PIC khởi tạo CSDL riêng biệt trên Google Drive cá nhân qua 1-click `setupNewDatabase()`. | AI Agent, Kỹ sư PIC, Devs |
| **[`GITHUB_CLONE_AND_LOCAL_SETUP.md`](01-setup-and-deployment/GITHUB_CLONE_AND_LOCAL_SETUP.md)** | **[QUAN TRỌNG NHẤT]** Hướng dẫn clone mã nguồn từ GitHub về thiết bị mới (macOS, Windows, Linux) và khởi chạy hoàn hảo với chế độ Zero-Install hoặc Local Server. | Lập trình viên, AI Agent, Quản trị viên |
| **[`SETUP_APPS_SCRIPT.md`](01-setup-and-deployment/SETUP_APPS_SCRIPT.md)** | Chi tiết các bước triển khai mã nguồn Google Apps Script (`Code.gs`) làm Web App REST API kết nối Google Sheets; cập nhật bảo mật v1. | IT Engineer, Cloud Admin |
| **[`USERS_SHEET_TEMPLATE.md`](01-setup-and-deployment/USERS_SHEET_TEMPLATE.md)** | Đặc tả cấu trúc tab `Users` (cột A–H, role `USER` / `PM` / `ADMIN`) và quản trị mật khẩu. | Admin, Kế toán, PM Quản trị |

---

## 2. Nhóm 02: Cẩm Nang Vận Hành & Hướng Dẫn Sử Dụng (`02-user-and-pm-guide/`)

| Tài liệu | Tính chất | Mô tả chi tiết | Đối tượng |
|---|---|---|---|
| **[`SO_TAY_VAN_HANH_NGAY_MO_BAN.md`](02-user-and-pm-guide/SO_TAY_VAN_HANH_NGAY_MO_BAN.md)** | 🟢 | **[ĐỌC TRƯỚC NGÀY MỞ BÁN]** Checklist ADMIN / PM theo mốc giờ (trước 14/10 → kết sổ 16/10), ô đánh dấu, bảng xử lý sự cố cho người không chuyên. |
| **[`PM_AND_USER_OPERATIONAL_GUIDE.md`](02-user-and-pm-guide/PM_AND_USER_OPERATIONAL_GUIDE.md)** | 🟢 | **[CẨM NANG TOÀN DIỆN]** Sơ đồ chu trình bán hàng trực quan (Mermaid), hướng dẫn từng bước cho **Nhân viên** (xem catalog, đặt suất, chuyển khoản, khai báo chứng từ) và cho **Quản trị viên PM** (tạo đợt bán, nạp Excel mẫu, hẹn giờ tự động, mở cổng, soi ảnh Lightbox, duyệt hàng loạt, kết sổ). **Phần C** = những gì khác đi trong bản v1 (gồm ADMIN). | Tất cả nhân viên, PM, ADMIN |
| **[`HUONG_DAN_KIEM_THU_THUC_TE_3_VAI_TRO_E2E.md`](02-user-and-pm-guide/HUONG_DAN_KIEM_THU_THUC_TE_3_VAI_TRO_E2E.md)** | 🟢 | Hướng dẫn tự kiểm thử toàn trình 3 vai trò (Admin → PM → Nhân viên) với file mẫu 10 model. | Người kiểm thử, PM, Admin |
| **[`ONBOARDING_TOUR_GUIDANCE_FLOW_PLAN.md`](02-user-and-pm-guide/ONBOARDING_TOUR_GUIDANCE_FLOW_PLAN.md)** | 🔵 | **[KẾ HOẠCH LUỒNG HƯỚNG DẪN SPOTLIGHT TOUR]** Đặc tả chi tiết 2 luồng hướng dẫn tự động phân quyền (Nhân viên 4 bước, PM 5 bước), kiến trúc Spotlight không mờ nét quang học, hợp đồng dữ liệu localStorage và quy trình tích hợp an toàn. | Lãnh đạo duyệt, PM, Devs |
| **[`PROPOSAL_PM_FLOW_OPTIMIZATION.md`](02-user-and-pm-guide/PROPOSAL_PM_FLOW_OPTIMIZATION.md)** | 🔵 | **[ĐỀ XUẤT TỐI ƯU HÓA FLOW PM & TRIỆT TIÊU TRÙNG LẶP UX]** Báo cáo nhập vai PM Quỳnh Như (non-tech), xác thực 2 nhận định cốt lõi của người dùng, phân tích blindspot bỏ quên 'Mở cổng thanh toán', thiết kế lại 5 Bước Vàng và giải pháp ẩn hiện nút Kết Sổ thông minh. | Lãnh đạo duyệt, PM Quản trị, Devs |
| **[`PROPOSAL_USER_FLOW_OPTIMIZATION.md`](02-user-and-pm-guide/PROPOSAL_USER_FLOW_OPTIMIZATION.md)** | 🔵 | **[ĐỀ XUẤT TỐI ƯU HÓA FLOW NHÂN VIÊN MUA HÀNG & ROLEPLAY ANH TUẤN]** Báo cáo nhập vai nhân viên mới, xác thực 3 nhận định của người dùng, phân tích blindspot bỏ quên thanh chọn chương trình và hoang mang mẫu nộp tiền bị khóa, thiết kế 4 Bước Vàng trực quan 1-chạm. | Lãnh đạo duyệt, Nhân viên, Devs |
| **[`PROPOSAL_TAB2_CATALOG_DEDUPLICATION.md`](02-user-and-pm-guide/PROPOSAL_TAB2_CATALOG_DEDUPLICATION.md)** | 🔵 | Hợp nhất danh mục Tab 2 (bỏ danh mục trùng lặp 90 slot cũ). | Devs, PM |

---

## 3. Nhóm 03: Kiến Trúc Hệ Thống & Kiểm Toán Thương Hiệu (`03-architecture-and-analysis/`) — ⚪ Lịch sử

> Mỗi file có khung **"TRẠNG THÁI (cập nhật 05/10/2026)"** ở đầu cho biết hạng mục nào đã xử lý / còn mở. Thông tin hiện hành: [`CURRENT_STATE.md`](CURRENT_STATE.md).

| Tài liệu | Mô tả nội dung chuyên sâu |
|---|---|
| **[`SINGLE_SOURCE_OF_TRUTH_DATA_ARCHITECTURE.md`](03-architecture-and-analysis/SINGLE_SOURCE_OF_TRUTH_DATA_ARCHITECTURE.md)** | **[KIẾN TRÚC ĐỒNG BỘ DỮ LIỆU TẬP TRUNG (SSOT)]** Động cơ đồng bộ thời gian thực `syncProductRegistrationStatus`, cơ chế đảm bảo khớp 100% số liệu giữa 4 màn hình (PM Tab 1 & 2, User Tab 2 & 4) và chuẩn hóa tự động cho các chương trình mới tạo. |
| **[`GO_LIVE_SECURITY_ARCHITECTURE_ANALYSIS.md`](03-architecture-and-analysis/GO_LIVE_SECURITY_ARCHITECTURE_ANALYSIS.md)** | Báo cáo kiểm định an toàn thông tin, bảo mật mã token chống gian lận giữ chỗ, cam kết đạo đức kinh doanh Jeong-Do. |
| **[`PHASE_P8_GO_LIVE_DEEP_ANALYSIS_AND_BLINDSPOTS.md`](03-architecture-and-analysis/PHASE_P8_GO_LIVE_DEEP_ANALYSIS_AND_BLINDSPOTS.md)** | Phân tích 6 yêu cầu & 5 điểm mù vận hành giai đoạn P8. |
| **[`PHASE_P8_GO_LIVE_EXECUTION_BLUEPRINT.md`](03-architecture-and-analysis/PHASE_P8_GO_LIVE_EXECUTION_BLUEPRINT.md)** | Bản thiết kế 7 gói công việc P8 (polling, mã đơn, mã đợt, schema 12 cột, bộ đọc Excel, watchdog, bàn giao). |
| **[`LG_BRAND_ARTISTIC_GAP_ANALYSIS.md`](03-architecture-and-analysis/LG_BRAND_ARTISTIC_GAP_ANALYSIS.md)** | Phân tích tuân thủ hướng dẫn nhận diện thương hiệu LG Electronics Brand Guidelines V5.2 (Màu sắc, Font chữ LG EI, Khoảng thở lưới). |
| **[`LG_BRAND_ARTISTIC_IMPROVEMENT_PLAN_PROPOSAL.md`](03-architecture-and-analysis/LG_BRAND_ARTISTIC_IMPROVEMENT_PLAN_PROPOSAL.md)** | Kế hoạch cải tiến thẩm mỹ và đồ họa UI/UX theo tiêu chuẩn trang chủ LG.com toàn cầu. |
| **[`DESIGN_GAP_ANALYSIS.md`](03-architecture-and-analysis/DESIGN_GAP_ANALYSIS.md)** | Đánh giá tổng thể thiết kế hệ thống và trải nghiệm tương tác màn hình. |
| **[`IMPROVEMENT_PLAN_PROPOSAL.md`](03-architecture-and-analysis/IMPROVEMENT_PLAN_PROPOSAL.md)** | Lộ trình 6 sprint nâng cấp thiết kế (GRAP + LG.com) và **Vùng Bất Khả Xâm Phạm** (§3B). |
| **[`TECHNICAL_IMPROVEMENT_PLAN_PROPOSAL.md`](03-architecture-and-analysis/TECHNICAL_IMPROVEMENT_PLAN_PROPOSAL.md)** | Đề xuất tối ưu hóa hiệu năng, thuật toán xử lý dữ liệu và bộ nhớ đệm SWR. |
| **[`KE_HOACH_TOI_UU_TOAN_DIEN_INTERNAL_SALES.md`](03-architecture-and-analysis/KE_HOACH_TOI_UU_TOAN_DIEN_INTERNAL_SALES.md)** | Kế hoạch hành động tổng thể chuyển đổi hệ thống bán hàng nội bộ LGEVH. |
| **[`UX_GAP_ANALYSIS_OPERATIONAL.md`](03-architecture-and-analysis/UX_GAP_ANALYSIS_OPERATIONAL.md)** | Phân tích khoảng cách vận hành trải nghiệm người dùng thực tế. |
| **[`UX_IMPROVEMENT_PLAN_PROPOSAL.md`](03-architecture-and-analysis/UX_IMPROVEMENT_PLAN_PROPOSAL.md)** | Đề xuất giải pháp nâng cấp trải nghiệm luồng thao tác. |
| **[`HANDOVER.md`](03-architecture-and-analysis/HANDOVER.md)** | Biên bản bàn giao kỹ thuật các giai đoạn (24/09 → 05/10/2026). |
| **[`../assets/images/quick-links-ani/README.md`](../assets/images/quick-links-ani/README.md)** | **[BỘ MOTION ICONS & KINETIC SVG]** Đặc tả kỹ thuật hoạt ảnh GIF từ CDN LG.com, vector SVG động học và 4 SOP thay thế icon hot-swapping. |
