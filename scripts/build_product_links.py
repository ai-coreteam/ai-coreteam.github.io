#!/usr/bin/env python3
"""
Tạo assets/content/lgcom_product_links.json — bản đồ "mã model → trang sản phẩm chính thức trên lg.com/vn"
cho link "Xem trên LG.com" ở thẻ sản phẩm (giao diện v2, design/UI_V2_DIRECTION_PROPOSAL.md §12).

    python3 scripts/build_product_links.py                       # tải https://www.lg.com/vn/sitemap.xml
    python3 scripts/build_product_links.py --sitemap-file x.xml  # dùng file đã tải sẵn

Nguồn duy nhất là sitemap.xml công khai của LG.com — không đoán URL. Model không có trong sitemap
(hàng ngừng bán / mã nội bộ) → web tự dùng link tìm kiếm Google. Chạy lại trước mỗi đợt bán để cập nhật.
Không ảnh hưởng đăng ký / dữ liệu: file này chỉ dùng để hiển thị link.

07/10/2026 — báo cáo mỗi lần chạy (so với bảng đang dùng):
    + model MỚI có trang LG.com  · − model BỊ GỠ (link cũ có thể 404 → nay web tự chuyển sang tìm Google)
    · đổi đường dẫn  · độ phủ danh mục: --catalog file.xlsx (cột "Model") → bao nhiêu model của đợt bán có trang LG.com
An toàn: số trang giảm > 30% so với bảng cũ (sitemap bị cắt / trang chặn) → KHÔNG ghi file, trừ khi thêm --force.
    python3 scripts/build_product_links.py --sitemap-file sitemap.xml --catalog data/Mau_Danh_Muc_San_Pham_Internal_Sales.xlsx
    python3 scripts/build_product_links.py --dry-run             # chỉ báo cáo, không ghi
"""
import argparse, json, re, sys, urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'content' / 'lgcom_product_links.json'
URL = 'https://www.lg.com/vn/sitemap.xml'
NON_PRODUCT = {'tro-giup', 'gioi-thieu-lg', 'lifesgood', 'khuyen-mai'}   # mục gốc không chứa trang sản phẩm
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sitemap-file', help='file sitemap.xml đã tải (bỏ qua bước tải)')
    ap.add_argument('--catalog', help='file Excel danh mục đợt bán (cột tiêu đề "Model") để đo độ phủ link LG.com')
    ap.add_argument('--dry-run', action='store_true', help='chỉ in báo cáo, không ghi file')
    ap.add_argument('--force', action='store_true', help='ghi kể cả khi số trang giảm > 30%%')
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
        if parts[1] in NON_PRODUCT:              # 07/10/2026: trang trợ giúp / thông báo / chiến dịch không phải sản phẩm
            continue
        slug = parts[-1].lower()
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{3,}', slug) or not re.search(r'\d', slug) or not re.search(r'[a-z]', slug) or slug.count('-') > 2:
            continue                             # mã model luôn có cả chữ và số → loại trang bài viết / khuyến mãi
        # cùng model có nhiều đường dẫn → giữ đường dẫn sâu nhất (trang ngành hàng chi tiết)
        if slug not in links or path.count('/') > links[slug].count('/'):
            links[slug] = path
    if len(links) < 500:
        sys.exit(f'LỖI: chỉ đọc được {len(links)} trang — sitemap có thể đã đổi cấu trúc. Không ghi file.')

    old = {}
    if OUT.exists():
        try: old = json.loads(OUT.read_text(encoding='utf-8')).get('links', {})
        except ValueError: old = {}
    added = sorted(set(links) - set(old)); removed = sorted(set(old) - set(links))
    moved = sorted(k for k in set(links) & set(old) if links[k] != old[k])
    print(f'Sitemap: {len(links)} trang sản phẩm · bảng đang dùng: {len(old)}')
    print(f'  + mới: {len(added)}   − bị gỡ: {len(removed)}   · đổi đường dẫn: {len(moved)}')
    for title, keys in (('Bị gỡ (link cũ có thể 404)', removed), ('Đổi đường dẫn', moved), ('Mới', added)):
        if keys:
            print(f'  {title}: ' + ', '.join(k.upper() for k in keys[:40]) + (f' … (+{len(keys) - 40})' if len(keys) > 40 else ''))
    if a.catalog:
        coverage(a.catalog, links)
    if old and len(links) < 0.7 * len(old) and not a.force:
        sys.exit(f'DỪNG: số trang giảm từ {len(old)} còn {len(links)} (> 30%) — sitemap có thể bị cắt hoặc bị chặn. '
                 'Không ghi file. Kiểm tra lại, chắc chắn thì chạy thêm --force.')
    if a.dry_run:
        print('--dry-run: không ghi file.'); return
    OUT.write_text(json.dumps({'source': URL, 'generated': date.today().isoformat(), 'count': len(links),
                               'links': dict(sorted(links.items()))}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Đã ghi {OUT.relative_to(ROOT)}: {len(links)} trang sản phẩm ({OUT.stat().st_size // 1024} KB)')


def coverage(path, links):
    """Độ phủ: model trong file danh mục (đọc theo tiêu đề cột "Model", như web) có trang LG.com hay không."""
    try:
        import openpyxl
    except ImportError:
        print('  (bỏ qua --catalog: cần pip install openpyxl)'); return
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    hi = next((i for i, r in enumerate(rows[:5]) if any(str(c or '').strip().lower() == 'model' for c in r)), None)
    if hi is None:
        print(f'  (không thấy cột "Model" trong {path})'); return
    mi = [str(c or '').strip().lower() for c in rows[hi]].index('model')
    models = sorted({str(r[mi]).strip().split('.')[0] for r in rows[hi + 1:] if r and r[mi] and str(r[mi]).strip()})
    hit = [m for m in models if m.lower() in links]
    print(f'Độ phủ danh mục {Path(path).name}: {len(hit)}/{len(models)} model có trang LG.com '
          f'({round(100 * len(hit) / len(models)) if models else 0}%)')
    for m in models:
        if m.lower() not in links:
            near = [k.upper() for k in links if k.startswith(m.lower()[:5])][:4]
            print(f'  → Google: {m}' + (f'   (gần giống trên LG.com: {", ".join(near)} — kiểm tra lại mã?)' if near else ''))


if __name__ == '__main__':
    main()
