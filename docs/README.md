# Tài Liệu Kỹ Thuật & Vận Hành — LG Internal Sales Portal

Thư mục `docs/` được tổ chức khoa học theo 3 nhóm chuyên mục phục vụ toàn diện cho việc triển khai, vận hành và nâng cấp hệ thống:

```text
docs/
├── 01-setup-and-deployment/        # Hướng dẫn cài đặt, triển khai GitHub & Backend Cloud
├── 02-user-and-pm-guide/           # Cẩm nang quy trình & sơ đồ hướng dẫn cho Nhân viên và PM
└── 03-architecture-and-analysis/   # Báo cáo kiến trúc bảo mật, kiểm toán thương hiệu & phân tích
```

---

## 1. Nhóm 01: Hướng Dẫn Cài Đặt & Triển Khai (`01-setup-and-deployment/`)

| Tài liệu | Mô tả chi tiết | Đối tượng |
|---|---|---|
| **[`GIT_CONFIGURATION_AND_HANDOVER.md`](01-setup-and-deployment/GIT_CONFIGURATION_AND_HANDOVER.md)** | **[CẨM NANG GIT & BÀN GIAO PIC]** Thông tin cấu hình mạng Git kép (origin & gobita), quy trình đồng bộ giữa các AI Agent, lệnh `git push all main` và SOP bàn giao khi chuyển PIC. | AI Agent, Quản trị viên, PIC mới |
| **[`AGENT_GUIDE_AUTO_SETUP_SHEET.md`](01-setup-and-deployment/AGENT_GUIDE_AUTO_SETUP_SHEET.md)** | **[CẨM NANG AGENT & PIC]** Hướng dẫn tác nhân AI tự động dẫn dắt PIC khởi tạo CSDL riêng biệt trên Google Drive cá nhân qua 1-click `setupNewDatabase()`. | AI Agent, Kỹ sư PIC, Devs |
| **[`GITHUB_CLONE_AND_LOCAL_SETUP.md`](01-setup-and-deployment/GITHUB_CLONE_AND_LOCAL_SETUP.md)** | **[QUAN TRỌNG NHẤT]** Hướng dẫn clone mã nguồn từ GitHub về thiết bị mới (macOS, Windows, Linux) và khởi chạy hoàn hảo với chế độ Zero-Install hoặc Local Server. | Lập trình viên, AI Agent, Quản trị viên |
| **[`SETUP_APPS_SCRIPT.md`](01-setup-and-deployment/SETUP_APPS_SCRIPT.md)** | Chi tiết các bước triển khai mã nguồn Google Apps Script (`Code.gs`) làm Web App REST API kết nối Google Sheets. | IT Engineer, Cloud Admin |
| **[`USERS_SHEET_TEMPLATE.md`](01-setup-and-deployment/USERS_SHEET_TEMPLATE.md)** | Đặc tả cấu trúc và định dạng các cột trong cơ sở dữ liệu Google Sheets đồng bộ với hệ thống. | Kế toán, PM Quản trị |

---

## 2. Nhóm 02: Cẩm Nang Vận Hành & Hướng Dẫn Sử Dụng (`02-user-and-pm-guide/`)

| Tài liệu | Mô tả chi tiết | Đối tượng |
|---|---|---|
| **[`PM_AND_USER_OPERATIONAL_GUIDE.md`](02-user-and-pm-guide/PM_AND_USER_OPERATIONAL_GUIDE.md)** | **[CẨM NANG TOÀN DIỆN]** Sơ đồ chu trình bán hàng trực quan (Mermaid), hướng dẫn từng bước cho **Nhân viên** (xem catalog, đặt suất, chuyển khoản, khai báo chứng từ) và cho **Quản trị viên PM** (tạo đợt bán, nạp Excel mẫu, hẹn giờ tự động, mở cổng, soi ảnh Lightbox, duyệt hàng loạt, kết sổ). | Tất cả nhân viên & PM LGEVH |
| **[`ONBOARDING_TOUR_GUIDANCE_FLOW_PLAN.md`](02-user-and-pm-guide/ONBOARDING_TOUR_GUIDANCE_FLOW_PLAN.md)** | **[KẾ HOẠCH LUỒNG HƯỚNG DẪN SPOTLIGHT TOUR]** Đặc tả chi tiết 2 luồng hướng dẫn tự động phân quyền (Nhân viên 4 bước, PM 5 bước), kiến trúc Spotlight không mờ nét quang học, hợp đồng dữ liệu localStorage và quy trình tích hợp an toàn. | Lãnh đạo duyệt, PM, Devs |
| **[`PROPOSAL_PM_FLOW_OPTIMIZATION.md`](02-user-and-pm-guide/PROPOSAL_PM_FLOW_OPTIMIZATION.md)** | **[ĐỀ XUẤT TỐI ƯU HÓA FLOW PM & TRIỆT TIÊU TRÙNG LẶP UX]** Báo cáo nhập vai PM Quỳnh Như (non-tech), xác thực 2 nhận định cốt lõi của người dùng, phân tích blindspot bỏ quên 'Mở cổng thanh toán', thiết kế lại 5 Bước Vàng và giải pháp ẩn hiện nút Kết Sổ thông minh. | Lãnh đạo duyệt, PM Quản trị, Devs |
| **[`PROPOSAL_USER_FLOW_OPTIMIZATION.md`](02-user-and-pm-guide/PROPOSAL_USER_FLOW_OPTIMIZATION.md)** | **[ĐỀ XUẤT TỐI ƯU HÓA FLOW NHÂN VIÊN MUA HÀNG & ROLEPLAY ANH TUẤN]** Báo cáo nhập vai nhân viên mới, xác thực 3 nhận định của người dùng, phân tích blindspot bỏ quên thanh chọn chương trình và hoang mang mẫu nộp tiền bị khóa, thiết kế 4 Bước Vàng trực quan 1-chạm. | Lãnh đạo duyệt, Nhân viên, Devs |

---

## 3. Nhóm 03: Kiến Trúc Hệ Thống & Kiểm Toán Thương Hiệu (`03-architecture-and-analysis/`)

| Tài liệu | Mô tả nội dung chuyên sâu |
|---|---|
| **[`SINGLE_SOURCE_OF_TRUTH_DATA_ARCHITECTURE.md`](03-architecture-and-analysis/SINGLE_SOURCE_OF_TRUTH_DATA_ARCHITECTURE.md)** | **[KIẾN TRÚC ĐỒNG BỘ DỮ LIỆU TẬP TRUNG (SSOT)]** Động cơ đồng bộ thời gian thực `syncProductRegistrationStatus`, cơ chế đảm bảo khớp 100% số liệu giữa 4 màn hình (PM Tab 1 & 2, User Tab 2 & 4) và chuẩn hóa tự động cho các chương trình mới tạo. |
| **[`GO_LIVE_SECURITY_ARCHITECTURE_ANALYSIS.md`](03-architecture-and-analysis/GO_LIVE_SECURITY_ARCHITECTURE_ANALYSIS.md)** | Báo cáo kiểm định an toàn thông tin, bảo mật mã token chống gian lận giữ chỗ, cam kết đạo đức kinh doanh Jeong-Do. |
| **[`LG_BRAND_ARTISTIC_GAP_ANALYSIS.md`](03-architecture-and-analysis/LG_BRAND_ARTISTIC_GAP_ANALYSIS.md)** | Phân tích tuân thủ hướng dẫn nhận diện thương hiệu LG Electronics Brand Guidelines V5.2 (Màu sắc, Font chữ LG EI, Khoảng thở lưới). |
| **[`LG_BRAND_ARTISTIC_IMPROVEMENT_PLAN_PROPOSAL.md`](03-architecture-and-analysis/LG_BRAND_ARTISTIC_IMPROVEMENT_PLAN_PROPOSAL.md)** | Kế hoạch cải tiến thẩm mỹ và đồ họa UI/UX theo tiêu chuẩn trang chủ LG.com toàn cầu. |
| **[`DESIGN_GAP_ANALYSIS.md`](03-architecture-and-analysis/DESIGN_GAP_ANALYSIS.md)** | Đánh giá tổng thể thiết kế hệ thống và trải nghiệm tương tác màn hình. |
| **[`TECHNICAL_IMPROVEMENT_PLAN_PROPOSAL.md`](03-architecture-and-analysis/TECHNICAL_IMPROVEMENT_PLAN_PROPOSAL.md)** | Đề xuất tối ưu hóa hiệu năng, thuật toán xử lý dữ liệu và bộ nhớ đệm SWR. |
| **[`KE_HOACH_TOI_UU_TOAN_DIEN_INTERNAL_SALES.md`](03-architecture-and-analysis/KE_HOACH_TOI_UU_TOAN_DIEN_INTERNAL_SALES.md)** | Kế hoạch hành động tổng thể chuyển đổi hệ thống bán hàng nội bộ LGEVH. |
| **[`UX_GAP_ANALYSIS_OPERATIONAL.md`](03-architecture-and-analysis/UX_GAP_ANALYSIS_OPERATIONAL.md)** | Phân tích khoảng cách vận hành trải nghiệm người dùng thực tế. |
| **[`UX_IMPROVEMENT_PLAN_PROPOSAL.md`](03-architecture-and-analysis/UX_IMPROVEMENT_PLAN_PROPOSAL.md)** | Đề xuất giải pháp nâng cấp trải nghiệm luồng thao tác. |
| **[`HANDOVER.md`](03-architecture-and-analysis/HANDOVER.md)** | Biên bản bàn giao kỹ thuật giai đoạn trước. |
| **[`../assets/images/quick-links-ani/README.md`](../assets/images/quick-links-ani/README.md)** | **[BỘ MOTION ICONS & KINETIC SVG]** Đặc tả kỹ thuật hoạt ảnh GIF từ CDN LG.com, vector SVG động học và 4 SOP thay thế icon hot-swapping. |
