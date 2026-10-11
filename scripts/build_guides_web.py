#!/usr/bin/env python3
"""Xuất bộ hướng dẫn bằng hình lên web cho nút "Docs" (v2.8, 11/10/2026, chủ dự án duyệt đưa lên web công khai).

Nguồn (chỉ có trên máy, dựng bằng skill smart-image-guideline-creator / tools riêng):
    docs/05-visual-guide/          bộ máy tính: guide_{vi,en}.html (đầy đủ = ADMIN), guide_user_*, guide_pm_*  (tools/build_deck.py all user pm)
    docs/06-visual-guide-phone/    bộ điện thoại: 4-output/guide_phone_{vi,en}.html (đầy đủ), guide_phone_user_*, guide_phone_pm_*
Đích (đưa lên GitHub Pages):
    guides/brand/                         font + logo LG dùng chung (1 bản)
    guides/laptop/{user,pm,admin}_{vi,en}.html + assets/{vi,en}/*.webp
    guides/phone/{user,pm,admin}_{vi,en}.html  + shots/{vi,en}/*.webp + media/
Web mở: guides/<laptop|phone>/<vai trò>_<ngôn ngữ>.html (openDocsModal). Ảnh chỉ có dữ liệu mẫu.
Điện thoại (v2.10.1, 11/10/2026): mỗi trang được chèn guides/mobile.css (nguồn scripts/guides_mobile.css: < 1024 px → slide
thành thẻ dọc, chữ đọc được) và sửa độ rộng thu nhỏ slide: innerWidth → clientWidth (Android Chrome tự thu nhỏ trang khi
slide 1920 px tràn → innerWidth phình ra → slide lệch trái, bị cắt chữ). Nguồn docs/05, docs/06 và skill KHÔNG đổi.

    python3 scripts/build_guides_web.py
"""
import os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAP = os.path.join(ROOT, 'docs/05-visual-guide')
PHO = os.path.join(ROOT, 'docs/06-visual-guide-phone/4-output')
OUT = os.path.join(ROOT, 'guides')
ROLE_FILES = {   # vai trò → (file bộ máy tính, file bộ điện thoại) theo ngôn ngữ
    'admin': ('guide_{l}.html', 'guide_phone_{l}.html'),
    'user': ('guide_user_{l}.html', 'guide_phone_user_{l}.html'),
    'pm': ('guide_pm_{l}.html', 'guide_phone_pm_{l}.html'),
}
MOBILE_CSS = os.path.join(ROOT, 'scripts/guides_mobile.css')
FIT_OLD = "r.setProperty('--fit-page', (innerWidth >= 1920 ? 1 : (innerWidth - 32) / 1920).toFixed(4));"
FIT_NEW = "const cw = document.documentElement.clientWidth || innerWidth; r.setProperty('--fit-page', (cw >= 1920 ? 1 : (cw - 32) / 1920).toFixed(4));"
BRAND = ['LGEIHeadline-Regular.otf', 'LGEIHeadline-Semibold.otf', 'LGEIText-Bold.otf', 'LGEIText-Regular.otf', 'LGEIText-SemiBold.otf',
         'LGE_Logo_HeritageRed_Grey_RGB.png', 'LGE_Logo_HeritageRed_White_RGB.png', 'LGE_Electronics_Gradient_01_RGB.jpg',
         'LGE_Electronics_Slogan_Horizontal_Mono_ActiveRed_RGB.png']


def fail(m): print('LỖI:', m); sys.exit(1)


def copy_tree(src, dst, exts):
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(src):
        if f.lower().endswith(exts): shutil.copy2(os.path.join(src, f), os.path.join(dst, f))


def main():
    for d in (LAP, PHO):
        if not os.path.isdir(d): fail(f'thiếu thư mục nguồn {d}')
    if os.path.isdir(OUT): shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, 'brand'))
    for f in BRAND:
        src = os.path.join(LAP, 'assets/brand', f)
        if not os.path.exists(src): fail(f'thiếu {src} — chạy find_brand.py của skill')
        shutil.copy2(src, os.path.join(OUT, 'brand', f))
    for l in ('vi', 'en'):
        copy_tree(os.path.join(LAP, 'assets', l), os.path.join(OUT, 'laptop/assets', l), ('.webp',))
        copy_tree(os.path.join(PHO, 'shots', l), os.path.join(OUT, 'phone/shots', l), ('.webp',))
    copy_tree(os.path.join(PHO, 'media'), os.path.join(OUT, 'phone/media'), ('.png', '.jpg', '.webp'))
    shutil.copy2(MOBILE_CSS, os.path.join(OUT, 'mobile.css'))
    n = 0
    for role, (lap, pho) in ROLE_FILES.items():
        for l in ('vi', 'en'):
            o = 'en' if l == 'vi' else 'vi'
            for src_dir, name, kind, other in ((LAP, lap, 'laptop', lap), (PHO, pho, 'phone', pho)):
                p = os.path.join(src_dir, name.format(l=l))
                if not os.path.exists(p): fail(f'thiếu {p}')
                h = open(p, encoding='utf-8').read()
                if kind == 'laptop':
                    h = h.replace('assets/brand/', '../brand/')                     # ảnh: assets/<lang>/ giữ nguyên; QR ../../assets/qr/ = assets/qr/ của web
                else:
                    h = re.sub(r'(["(])brand/', r'\1../brand/', h)                  # ảnh: shots/<lang>/, media/ giữ nguyên
                h = h.replace(f'href="{other.format(l=o)}"', f'href="{role}_{o}.html"')   # nút đổi ngôn ngữ trong slide
                if re.search(r'["\'(](assets/)?brand/', h): fail(f'{kind}/{role}_{l}: còn đường dẫn brand chưa đổi')
                if h.count(FIT_OLD) != 1 or h.count('</head>') != 1: fail(f'{kind}/{role}_{l}: mẫu trang khác dự kiến (fit / </head>) — kiểm lại trước khi chèn CSS điện thoại')
                h = h.replace(FIT_OLD, FIT_NEW).replace('</head>', '<link rel="stylesheet" href="../mobile.css">\n</head>')
                h = h.replace('within 24 h<', 'within 24\u00a0h<')                 # điện thoại: không để "h" rơi xuống dòng riêng
                open(os.path.join(OUT, kind, f'{role}_{l}.html'), 'w', encoding='utf-8').write(h); n += 1
    open(os.path.join(OUT, 'README.md'), 'w', encoding='utf-8').write(
        '# Bộ hướng dẫn bằng hình (nút "Docs" trên web)\n\nSINH TỰ ĐỘNG bằng `python3 scripts/build_guides_web.py` — không sửa tay.\n'
        'Nguồn: `docs/05-visual-guide` (máy tính) và `docs/06-visual-guide-phone` (điện thoại), chỉ có trên máy của người dựng.\n'
        'Ảnh chụp thật từ cổng chính thức chạy với máy chủ giả: chỉ có dữ liệu mẫu, không có dữ liệu thật.\n')
    print(f'guides/: {n} trang (2 thiết bị × 3 vai trò × 2 ngôn ngữ)')


if __name__ == '__main__':
    main()
