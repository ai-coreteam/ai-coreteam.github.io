#!/usr/bin/env python3
"""
Sinh bản CHÍNH THỨC (production) cho nhân viên từ file nguồn demo — v1-hardening, Gói P.

    python3 scripts/build_production.py --api-url "https://script.google.com/macros/s/XXXX/exec"

Kết quả: portal.html (mặc định) — đã:
  1. Bật PORTAL_MODE = 'production' và gắn cố định URL máy chủ  → nhân viên mở link là đăng nhập được ngay.
  2. XÓA HẲN dữ liệu demo (tài khoản, chương trình, sản phẩm, đơn mẫu) khỏi mã nguồn — không chỉ ẩn.
  3. XÓA HẲN khối nút "Đăng nhập nhanh tài khoản Demo".
  4. Đổi tên các khóa bộ nhớ trình duyệt (đơn, chương trình, hẹn giờ PM, phiên, bản nháp) → bản chính thức
     KHÔNG đọc dữ liệu bản demo để lại trên cùng tên miền GitHub Pages (CURRENT_STATE mục 14).
File nguồn Mau_Dang_Ky_Internal_Sales_3009.html giữ nguyên để đào tạo / thử nghiệm.

Script tự kiểm tra kết quả và DỪNG (không ghi file) nếu còn sót dữ liệu demo.
Hướng dẫn đầy đủ: docs/04-v1-hardening/V1_RELEASE_RUNBOOK.md
"""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'Mau_Dang_Ky_Internal_Sales_3009.html'

DEMO_DATA_RE = re.compile(r'/\* @@DEMO_DATA_BEGIN.*?\*/.*?/\* @@DEMO_DATA_END \*/', re.S)
DEMO_UI_RE = re.compile(r'<!-- @@DEMO_UI_BEGIN.*?-->.*?<!-- @@DEMO_UI_END -->', re.S)
EMPTY_DEMO_DATA = (
    "/* Bản production: không có dữ liệu demo (scripts/build_production.py) */\n"
    "    const DEMO_USERS = [];\n"
    "    function getEffectiveDemoPassword(userId, defaultPw) { return defaultPw; }\n"
    "    const DEMO_PROGRAMS = [];\n"
    "    const DEMO_PRODUCTS = {};\n"
    "    let DEMO_REGISTRATIONS = [];"
)
# v1-hardening (mục 14): bản demo và portal.html cùng tên miền → dùng chung localStorage / sessionStorage.
# Đổi tên mọi khóa chứa DỮ LIỆU hoặc THAO TÁC để bản chính thức không đọc đơn ảo / hẹn giờ cũ của bản demo.
# Giữ nguyên khóa 'lg_tour_completed_*' (chỉ đánh dấu đã xem hướng dẫn, vô hại).
STORAGE_KEYS = {
    "'lg_demo_registrations'": "'lg_prod_registrations'",
    "'lg_demo_programs'": "'lg_prod_programs'",
    "'lg_demo_pw_overrides'": "'lg_prod_pw_overrides'",
    "'lg_demo_auto_email'": "'lg_prod_auto_email'",
    "'lg_program_timers_v1'": "'lg_prod_program_timers_v1'",
    "'lg_internal_sales_session'": "'lg_prod_internal_sales_session'",
    "'lg_qpay_draft_'": "'lg_prod_qpay_draft_'",
    "'lg_reg_draft'": "'lg_prod_reg_draft'",
}

# Dấu hiệu không được còn trong bản production
FORBIDDEN = {
    "mật khẩu demo 'test123'": re.compile(r"test123"),
    'serial sản phẩm demo': re.compile(r'"serial": "\d{3}[A-Z]{4,5}\w+"'),
    'đơn đăng ký mẫu REG-2026-': re.compile(r"REG-2026-\d{3}"),
    'nút đăng nhập nhanh quickLogin(': re.compile(r"quickLogin\('VH"),
    'khóa bộ nhớ dùng chung với bản demo': re.compile(r"'lg_demo_|'lg_program_timers_v1'|'lg_internal_sales_session'|'lg_qpay_draft_'|'lg_reg_draft'"),
    'hotline / email cá nhân mẫu': re.compile(r"0912 345 678|quynhnhu@lge\.com|vannam@lge\.com|ngocbao\.nguyen@lge\.com"),
}


def fail(msg):
    print('LỖI: ' + msg)
    sys.exit(1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--api-url', required=True, help='URL Web App Apps Script, dạng https://script.google.com/macros/s/.../exec')
    ap.add_argument('--out', default=str(ROOT / 'portal.html'), help='file đầu ra (mặc định: portal.html ở thư mục gốc)')
    args = ap.parse_args()

    url = args.api_url.strip()
    if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_\-]+/exec', url):
        fail('URL không đúng dạng https://script.google.com/macros/s/<ID>/exec')

    src = SOURCE.read_text(encoding='utf-8')
    out = src

    for old, new in ((r"var PORTAL_MODE = 'demo';", "var PORTAL_MODE = 'production';"),
                     (r"var PRODUCTION_API_URL = '';", f"var PRODUCTION_API_URL = '{url}';"),
                     ('placeholder="Nhập mật khẩu (test: test123)"', 'placeholder="Nhập mật khẩu"')):
        if out.count(old) != 1:
            fail(f'không tìm thấy đúng 1 dòng "{old}" trong file nguồn')
        out = out.replace(old, new)

    if len(DEMO_DATA_RE.findall(out)) != 1:
        fail('không tìm thấy đúng 1 khối @@DEMO_DATA_BEGIN … @@DEMO_DATA_END')
    out = DEMO_DATA_RE.sub(lambda m: EMPTY_DEMO_DATA, out)

    ui_blocks = len(DEMO_UI_RE.findall(out))
    if ui_blocks < 1:
        fail('không tìm thấy khối @@DEMO_UI_BEGIN … @@DEMO_UI_END')
    out = DEMO_UI_RE.sub('', out)

    for old, new in STORAGE_KEYS.items():
        if old not in out:
            fail(f'không tìm thấy khóa bộ nhớ {old} trong file nguồn (đã đổi tên? cập nhật STORAGE_KEYS)')
        out = out.replace(old, new)

    leftovers = [name for name, rx in FORBIDDEN.items() if rx.search(out)]
    if leftovers:
        fail('bản production còn sót: ' + ', '.join(leftovers) + '. Không ghi file.')

    Path(args.out).write_text(out, encoding='utf-8')
    print(f'Đã tạo {args.out}')
    print(f'  Chế độ: production · Máy chủ: {url}')
    print(f'  Đã xóa: dữ liệu demo ({len(src) - len(out):,} ký tự), {ui_blocks} khối giao diện demo')
    print(f'  Đã tách {len(STORAGE_KEYS)} khóa bộ nhớ trình duyệt khỏi bản demo')
    print('  Kiểm tra: không còn mật khẩu demo, serial demo, đơn mẫu, nút đăng nhập nhanh, khóa bộ nhớ dùng chung')


if __name__ == '__main__':
    main()
