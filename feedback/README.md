# feedback/ — phản hồi và ảnh chụp từ máy thật (chỉ lưu trên máy)

Ảnh chụp màn hình do chủ dự án / người dùng gửi khi thử trên thiết bị thật. **Có thể chứa tên người, số điện thoại, dữ liệu thật
→ không commit** (`.gitignore`: chỉ file README này được đưa lên repo).

Quy ước thư mục: `<YYYY-MM-DD>_<thiết bị>_<chủ đề>/`. Kết quả xử lý ghi trong nhật ký phát hành
[`docs/04-v1-hardening/README.md`](../docs/04-v1-hardening/README.md).

| Thư mục | Nội dung | Xử lý |
|---|---|---|
| `2026-10-07_android_portal-test/` | 22 ảnh cổng bán hàng trên Android (User view, Admin & PM view) + `_evidence/` ảnh ghép | `design/UI_V3_MOBILE_AUDIT.md` §7 → sửa ở v2.5.0–v2.8.0 |
| `2026-10-11_android_visual-guide/` | 3 ảnh bộ hướng dẫn (nút Docs) mở trên Android: slide lệch trái, bị cắt chữ | v2.10.1: `guides/mobile.css` + sửa độ rộng thu nhỏ (`scripts/build_guides_web.py`) |
