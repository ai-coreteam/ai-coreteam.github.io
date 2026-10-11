"""Bộ hướng dẫn (guides/) + chống "tự làm tối trang web" — v2.10.2, 11/10/2026.
Chạy sau mỗi lần dựng lại guides/ (scripts/build_guides_web.py) hoặc sửa phần <head> của web:
    python3 tests/guides_browser_check.py              # Chromium + WebKit (+ Firefox nếu đã cài: python3 -m playwright install firefox)
Kiểm 3 nhóm (không đụng máy chủ thật, chỉ đọc file trên máy):
  A. Điện thoại: 12 trang × máy (320–412 px, iPad dọc, xoay ngang): không tràn ngang, không cắt chữ, chữ ≥ 12 px,
     khung đỏ khớp ảnh, ảnh tải đủ, 0 lỗi JS.
  B. Nhận diện LG ở giao diện điện thoại (lg-brand verify chỉ đo khung 1920×1080): màu trong bảng màu LG
     (lg-brand references/color.md), font LG EI, logo là file gốc và cao ≥ 16 px.
  C. Trình duyệt bật "tự làm tối trang web" (Cốc Cốc, Samsung Internet, Opera… khi máy để giao diện tối — Chrome mặc định
     tắt; giả lập bằng cờ Blink forceDarkMode): 12 trang hướng dẫn + màn hình đăng nhập của cổng phải GIỐNG HỆT lúc bình thường.
"""
import io, os, sys, functools, http.server, socketserver, threading
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT = os.environ.get('GUIDES_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # GUIDES_ROOT=<thư mục bản cũ> để so
PAGES = [f'{d}/{r}_{l}' for d in ('phone', 'laptop') for r in ('user', 'pm', 'admin') for l in ('vi', 'en')]
PALETTE = {'#FD312E', '#A50034', '#FFFFFF', '#000000', '#262626', '#4A4946', '#716F6A', '#CBC8C2', '#E6E1D6', '#F0ECE4',
           '#F6F3EB', '#646464', '#333333', '#1A1A1A', '#EA1917'}
FORCE_DARK = ['--blink-settings=forceDarkModeEnabled=true,forceDarkModeInversionAlgorithm=4,forceDarkModeImagePolicy=2']
results = []


def check(ok, msg):
    results.append(bool(ok)); print(('  PASS ' if ok else '  FAIL ') + msg)


LAYOUT_JS = """() => { const de = document.documentElement, cw = de.clientWidth, bad = [];
  if (de.scrollWidth > cw + 1) bad.push('tràn ngang ' + de.scrollWidth);
  document.querySelectorAll('.lg-canvas').forEach((c, k) => { const C = c.getBoundingClientRect();
    if (C.left < -1 || C.right > cw + 1) bad.push('slide ' + (k + 1) + ' lệch khỏi màn hình');
    c.querySelectorAll('h1,h2,p,li,span,b,code,em,img:not(.lg-gradient)').forEach(e => { const b = e.getBoundingClientRect();
      if (!b.width || e.closest('.hl')) return;
      if (b.left < C.left - 1 || b.right > C.right + 1) bad.push('cắt chữ s' + (k + 1) + ': ' + (e.textContent || '').trim().slice(0, 30));
      if (e.tagName !== 'IMG' && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 12) bad.push('chữ < 12 px s' + (k + 1)); });
    c.querySelectorAll('.frame').forEach(f => { const im = f.querySelector('img'), I = im.getBoundingClientRect();
      if (!im.naturalWidth) bad.push('ảnh lỗi ' + im.getAttribute('src'));
      f.querySelectorAll('.hl').forEach(h => { const H = h.getBoundingClientRect();
        if (H.left < I.left - 8 || H.right > I.right + 8 || H.top < I.top - 8 || H.bottom > I.bottom + 8) bad.push('khung đỏ lệch s' + (k + 1)); }); }); });
  return bad.slice(0, 5); }"""

BRAND_JS = """() => { const hex = c => { const m = c.match(/[\\d.]+/g); if (!m || (m.length > 3 && +m[3] === 0)) return null;
    return '#' + m.slice(0, 3).map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const colors = new Set(), fonts = new Set(), logos = [];
  document.querySelectorAll('.lg-canvas, .lg-canvas *').forEach(e => { if (!e.getClientRects().length || e.closest('.frame')) return;
    const cs = getComputedStyle(e);
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) { colors.add(hex(cs.color)); fonts.add(cs.fontFamily.split(',')[0].replace(/"/g, '')); }
    const bg = hex(cs.backgroundColor); if (bg) colors.add(bg); });
  document.querySelectorAll('.hl').forEach(h => colors.add(hex(getComputedStyle(h).borderTopColor)));
  document.querySelectorAll('.lg-logo').forEach(l => { const r = l.getBoundingClientRect(); if (r.height) logos.push([l.getAttribute('src').split('/').pop(), Math.round(r.height)]); });
  return { colors: [...colors].filter(Boolean), fonts: [...fonts], logos }; }"""


def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{srv.server_address[1]}'
    try:
        with sync_playwright() as p:
            D = p.devices
            engines = [('chromium', [('Galaxy S9+', D['Galaxy S9+']), ('Pixel 7', D['Pixel 7']), ('Pixel 7 ngang', D['Pixel 7 landscape'])]),
                       ('webkit', [('iPhone SE', D['iPhone SE']), ('iPhone 13', D['iPhone 13']), ('iPad Mini', D['iPad Mini'])]),
                       ('firefox', [('Firefox 412', {'viewport': {'width': 412, 'height': 915}})])]
            print('A + B. Bố cục điện thoại và nhận diện LG — 12 trang')
            for eng, devs in engines:
                try: b = getattr(p, eng).launch()
                except Exception as e: print(f'  (bỏ qua {eng}: chưa cài — {str(e)[:60]})'); continue
                for name, o in devs:
                    ctx = b.new_context(**dict(o))
                    for pg_ in PAGES:
                        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:80]))
                        pg.goto(f'{base}/guides/{pg_}.html'); pg.wait_for_load_state('networkidle')
                        pg.evaluate('window.scrollTo(0, document.body.scrollHeight)'); pg.wait_for_timeout(300)
                        bad = pg.evaluate(LAYOUT_JS) + [f'lỗi JS {errs[0]}'] if errs else pg.evaluate(LAYOUT_JS)
                        br = pg.evaluate(BRAND_JS)
                        off = [c for c in br['colors'] if c not in PALETTE]; nf = [f for f in br['fonts'] if not f.startswith('LG EI')]
                        small = [l for l in br['logos'] if l[1] < 16]
                        check(not bad and not off and not nf and not small,
                              f'{eng} {name:12} {pg_:15} {"" if not bad else bad} {"" if not off else "màu ngoài bảng LG " + str(off)}'
                              f'{"" if not nf else " font " + str(nf)}{"" if not small else " logo nhỏ " + str(small)}')
                        pg.close()
                    ctx.close()
                b.close()
            print('C. Trình duyệt "tự làm tối trang web" (máy để giao diện tối): phải giống hệt lúc bình thường')
            urls = [f'guides/{x}.html' for x in PAGES] + ['portal.html']
            shots = {}
            for mode, args in (('normal', []), ('forcedark', FORCE_DARK)):
                b = p.chromium.launch(args=args); ctx = b.new_context(**dict(D['Galaxy S8']), color_scheme='dark')
                ctx.route('**/*', lambda r: r.abort() if 'script.google' in r.request.url or 'googleusercontent' in r.request.url else r.continue_())   # không gọi máy chủ thật
                for u in urls:
                    pg = ctx.new_page(); pg.goto(f'{base}/{u}'); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(800)
                    shots[(mode, u)] = pg.screenshot(); pg.close()
                b.close()
            for u in urls:
                a, c = [Image.open(io.BytesIO(shots[(m, u)])).convert('RGB') for m in ('normal', 'forcedark')]
                big = sum(1 for v in ImageChops.difference(a, c).convert('L').getdata() if v > 40)
                check(big == 0, f'{u}: {"giống hệt" if big == 0 else f"bị trình duyệt đổi màu ({big} điểm ảnh)"}')
    finally:
        srv.shutdown()
    print(f'\n{sum(results)}/{len(results)} checks passed')
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main()
