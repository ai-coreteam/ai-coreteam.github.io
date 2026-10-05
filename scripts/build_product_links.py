#!/usr/bin/env python3
"""
Tạo assets/content/lgcom_product_links.json — bản đồ "mã model → trang sản phẩm chính thức trên lg.com/vn"
cho link "Xem trên LG.com" ở thẻ sản phẩm (giao diện v2, design/UI_V2_DIRECTION_PROPOSAL.md §12).

    python3 scripts/build_product_links.py                       # tải https://www.lg.com/vn/sitemap.xml
    python3 scripts/build_product_links.py --sitemap-file x.xml  # dùng file đã tải sẵn

Nguồn duy nhất là sitemap.xml công khai của LG.com — không đoán URL. Model không có trong sitemap
(hàng ngừng bán / mã nội bộ) → web tự dùng link tìm kiếm Google. Chạy lại trước mỗi đợt bán để cập nhật.
Không ảnh hưởng đăng ký / dữ liệu: file này chỉ dùng để hiển thị link.
"""
import argparse, json, re, sys, urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'content' / 'lgcom_product_links.json'
URL = 'https://www.lg.com/vn/sitemap.xml'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sitemap-file', help='file sitemap.xml đã tải (bỏ qua bước tải)')
    a = ap.parse_args()
    if a.sitemap_file:
        xml = Path(a.sitemap_file).read_text(encoding='utf-8')
    else:
        xml = urllib.request.urlopen(urllib.request.Request(URL, headers={'User-Agent': UA}), timeout=60).read().decode('utf-8')
    links = {}
    for loc in re.findall(r'<loc>(https://www\.lg\.com(/vn/[^<]+?/))</loc>', xml):
        path = loc[1]
        parts = path.strip('/').split('/')
        if len(parts) < 3:                       # /vn/<ngành>/<model>/ trở lên mới là trang sản phẩm
            continue
        slug = parts[-1].lower()
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{3,}', slug) or not re.search(r'\d', slug) or not re.search(r'[a-z]', slug) or slug.count('-') > 2:
            continue                             # mã model luôn có cả chữ và số → loại trang bài viết / khuyến mãi
        # cùng model có nhiều đường dẫn → giữ đường dẫn sâu nhất (trang ngành hàng chi tiết)
        if slug not in links or path.count('/') > links[slug].count('/'):
            links[slug] = path
    if len(links) < 500:
        sys.exit(f'LỖI: chỉ đọc được {len(links)} trang — sitemap có thể đã đổi cấu trúc. Không ghi file.')
    OUT.write_text(json.dumps({'source': URL, 'generated': date.today().isoformat(), 'count': len(links),
                               'links': dict(sorted(links.items()))}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Đã ghi {OUT.relative_to(ROOT)}: {len(links)} trang sản phẩm ({OUT.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
