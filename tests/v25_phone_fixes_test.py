"""v2.5 (11/10/2026) — kiểm từng lỗi đã sửa + bố cục điện thoại. Chạy trang thật với máy chủ giả (không đụng máy chủ thật).
    python3 tests/v25_phone_fixes_test.py                     # bản nguồn hiện tại
    git show v2.4.1:Mau_Dang_Ky_Internal_Sales_3009.html > .v241_baseline.html
    PAGE=.v241_baseline.html python3 tests/v25_phone_fixes_test.py   # chạy trên bản cũ để thấy lỗi (tái hiện); xong thì xoá file tạm
    BROWSER=webkit python3 tests/v25_phone_fixes_test.py      # engine Safari (không có iPhone thật)
Mỗi kịch bản = 1 mục đã duyệt: token program_update, R1, R2, R3, B1–B4, C3, A1–A4, Q1, R4, R8 (v2.5.0);
12 = chờ máy chủ khi đổi trạng thái chương trình, 13 = thẻ sản phẩm gọn (v2.6.0);
13 (mô tả 2 dòng + Xem đủ), 14 = bảng → thẻ (B3), 15 = cửa sổ nộp tiền toàn màn hình (B4), 16 = máy tính không đổi (v2.7.0);
17–20 = PM điện thoại (C1, C2, cửa sổ biên lai), tab 3 (C3, nhãn), nút Docs, bản dịch EN (v2.8.0);
21–24 = địa chỉ nhận hàng, Config (public_config), hạn mức theo chương trình, EN (v2.9.0);
25 = hạn nộp tiền theo Config PAYMENT_DEADLINE_HOURS + nhắc đổi địa chỉ ở bước nộp tiền (v2.10.0);
26 = địa chỉ lưu trên Sheet, tỉnh/thành + cảnh báo khác miền, tự đổi địa chỉ đơn (v2.11.0);
27 = người nhận hàng + nhân viên tự sửa SĐT (v2.12.0);
28 = thứ tự tab mới của nhân viên: Danh mục → Nộp tiền → Chi tiết → Thông báo (v2.13.0);
29 = bộ lọc "Kho" trên điện thoại thành lưới 2 cột, máy tính giữ nguyên (v2.13.1).
"""
import os, sys, re, copy, json, subprocess, functools, http.server, socketserver, threading
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tests')); os.chdir(ROOT)
import cloud_mode_regression as T
from playwright.sync_api import sync_playwright

PAGE = os.environ.get('PAGE', T.PAGE)
ENGINE = os.environ.get('BROWSER', 'chromium')
PROD = '.portal_v25_test.html'
results = []


def check(ok, msg):
    results.append(bool(ok))
    print(('  PASS ' if ok else '  FAIL ') + msg)


class Mock(T.MockServer):
    def __init__(self, programs=None, **kw):
        super().__init__(**kw)
        self.programs = programs if programs is not None else [dict(id=T.PID, name='Dot test', status='Open')]

    def do_programs(self, d):
        return {'ok': True, 'programs': [{'id': p['id'], 'name': p['name'], 'pmId': T.PM, 'pmName': 'PM That', 'status': p['status'],
                                          'startDate': '', 'endDate': '', 'description': '', 'maxPerEmployee': p.get('max', 1)} for p in self.programs]}

    update_delay_s = 0      # v2.6: máy chủ chậm (khởi động nguội)
    update_fail = False     # v2.6: mất mạng → yêu cầu program_update bị hủy

    public_config = None    # v2.9: dict → trả cho GET ?action=public_config (None = Apps Script cũ, không có lệnh này)

    def handle(self, route):
        if route.request.method == 'GET' and 'action=public_config' in route.request.url and self.public_config is not None:
            self.calls.append(('GET public_config', {}))
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'config': self.public_config}))
        if self.update_fail and route.request.method == 'POST' and '"program_update"' in (route.request.post_data or ''):
            self.calls.append(('program_update', json.loads(route.request.post_data)))
            return route.abort()
        return super().handle(route)

    def do_program_update(self, d):   # Code.gs program_update_: verifySessionToken_(d.token, 'PM') đứng đầu
        if self.update_delay_s:
            import time; time.sleep(self.update_delay_s)
        if not d.get('token'):
            return {'ok': False, 'message': 'Thiếu Token phiên làm việc (Chưa đăng nhập hoặc phiên đã kết thúc).'}
        for p in self.programs:
            if p['id'] == d.get('programId'):
                p['status'] = d.get('newStatus')
        return {'ok': True, 'message': 'Đã chuyển chương trình sang ' + str(d.get('newStatus'))}


def reg(i, status, amount):
    return {'id': f'REG-{i}', 'programId': T.PID, 'slotId': f'{T.PID}-AYA-00{i}', 'kho': 'AYA', 'model': f'M{i}', 'serial': '',
            'empCode': f'VH7000{i}', 'empName': f'NV {i}', 'division': 'QA', 'phone': '0900000000', 'status': status,
            'internalPrice': amount, 'amount': amount, 'bankTxn': '', 'payTime': '', 'receipt': '', 'timestamp': '2026-10-11T01:00:00.000Z'}


def open_page(browser, port, server, page_name=None, device=None, extra_init='', query='', no_addr=False):
    opts = dict(device) if device else {'viewport': {'width': 1440, 'height': 900}}
    ctx = browser.new_context(**opts)
    ctx.add_init_script("localStorage.setItem('lg_tour_completed_employee','true'); localStorage.setItem('lg_tour_completed_pm','true');"
                        f"localStorage.setItem('LGE_PORTAL_API_URL', '{T.API}');"
                        + ("" if no_addr else f"localStorage.setItem('lg_delivery_addr_{T.ME}','So 1 Duong Thu, Hai Phong');") + extra_init)
    if server:
        ctx.route(T.API + '**', server.handle)
    page = ctx.new_page()
    page.errors, page.dialogs = [], []
    page.on('pageerror', lambda e: page.errors.append(str(e)[:200]))
    page.on('dialog', lambda dlg: (page.dialogs.append(dlg.message), dlg.accept()))
    page.goto(f'http://127.0.0.1:{port}/{page_name or PAGE}{query}')
    return ctx, page


CONTRAST_JS = """sel => { const el = document.querySelector(sel); const span = el.querySelector('span:last-child') || el;
  const rgb = s => { const m = s.match(/[\\d.]+/g).map(Number); return m.length > 3 ? m : m.concat([1]); };
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  let layers = [], n = el;   // trộn các lớp nền bán trong suốt từ trên xuống tới lớp nền đặc đầu tiên
  while (n && n.nodeType === 1) { const b = rgb(getComputedStyle(n).backgroundColor); if (b[3] > 0) { layers.push(b); if (b[3] >= 1) break; } n = n.parentElement; }
  let bg = [255, 255, 255]; for (const b of layers.reverse()) bg = bg.map((v, i) => v * (1 - b[3]) + b[i] * b[3]);
  const fg = rgb(getComputedStyle(span).color), a = L(fg), b = L(bg);
  return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)); }"""


def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    # bản chính thức (kịch bản 7) luôn build từ file nguồn hiện tại; khi PAGE=bản cũ thì kịch bản 7 đo từ điển EN hiện tại
    subprocess.run([sys.executable, 'scripts/build_production.py', '--api-url', T.API, '--out', PROD], capture_output=True, text=True)
    try:
        with sync_playwright() as p:
            browser = getattr(p, ENGINE).launch()
            ip13 = dict(p.devices['iPhone 13']); ip13['device_scale_factor'] = 2
            if ENGINE == 'firefox': ip13.pop('is_mobile', None)

            print('1. Token: "Mở bán ngay" và Hẹn giờ gửi program_update kèm token (máy chủ bắt buộc)')
            s = Mock(programs=[dict(id=T.PID, name='Dot test', status='Draft')])
            ctx, page = open_page(browser, port, s)
            T.login(page, T.PM)
            page.evaluate(f"updateProgramStatus('{T.PID}', 'Open')"); page.wait_for_timeout(1500)
            calls = [c[1] for c in s.calls if c[0] == 'program_update']
            check(calls and calls[-1].get('token') == 'mock.sig', f'Mở bán ngay: program_update có token ({calls[-1].get("token") if calls else "không gửi"})')
            check(not [d for d in page.dialogs if 'Lỗi cập nhật máy chủ' in d], f'không có hộp thoại lỗi máy chủ ({page.dialogs[-1:]})')
            check(s.programs[0]['status'] == 'Open', 'máy chủ giả đã chuyển chương trình sang Open')
            n0 = len([c for c in s.calls if c[0] == 'program_update'])
            page.evaluate(f"saveProgramTimers('{T.PID}', {{ open: {{ enabled: true, datetime: new Date(Date.now() - 1000).toISOString(), executed: false }},"
                          " close: { enabled: false, datetime: '', executed: false }, payment: { enabled: false, datetime: '', executed: false } })")
            page.wait_for_timeout(2500)
            calls = [c[1] for c in s.calls if c[0] == 'program_update'][n0:]
            check(calls and calls[-1].get('token') == 'mock.sig', f'Hẹn giờ tự mở: program_update có token ({len(calls)} lệnh)')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('2. R1: badge tab 3 = số đơn của nhân viên trên máy chủ')
            s = Mock(my_status=T.NEW)
            ctx, page = open_page(browser, port, s)
            T.login(page, T.ME)
            b = page.inner_text('#tab3-count-badge').strip()
            check(b == '1 Đơn', f'có 1 đơn chờ nộp tiền → badge "1 Đơn" ({b!r})')
            s.my_status = None
            page.evaluate('refreshMyServerOrders()'); page.wait_for_timeout(1200)
            b = page.inner_text('#tab3-count-badge').strip()
            check(b == '0 Đơn', f'hết đơn → "0 Đơn" ({b!r})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('3. R2: KPI "Tổng sản phẩm" của PM đúng sau khi danh mục tải chậm')
            s = Mock(products_delay_ms=3500)
            ctx, page = open_page(browser, port, s)
            T.login(page, T.PM, settle_ms=9000)
            v = page.inner_text('#kpi-total-units').strip()
            check(v == str(len(s.products)), f'Tổng SP = {len(s.products)} ({v!r})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('4. R3: dòng tổng bảng PM tách "Tổng giá trị đơn" và "Đã nộp"')
            s = Mock(); s.pm_regs = [reg(1, 'Đã khai nộp - chờ đối soát', 1000000), reg(2, 'Đã duyệt thanh toán', 2000000), reg(3, 'Chờ nộp tiền', 4000000)]
            ctx, page = open_page(browser, port, s)
            T.login(page, T.PM)
            page.evaluate('loadPMDashboardData()'); page.wait_for_timeout(2500)
            page.evaluate("setPMViewMode('all')"); page.wait_for_timeout(800)
            t = page.inner_text('#pm-summary-amount').strip()
            check(t == 'Tổng giá trị đơn: 7.000.000 đ · Đã nộp (chờ đối soát + đã duyệt): 3.000.000 đ', f'({t!r})')
            print('5. B2: bảng "Chưa nộp tiền" không còn nút "Đôn đốc" (chỉ báo đã gửi, thực tế không gửi gì); "Hủy slot" còn')
            page.evaluate("setPMViewMode('unpaid')"); page.wait_for_timeout(800)
            btns = page.evaluate("[...document.querySelectorAll('#pm-unpaid-table button')].map(b => b.innerText.trim())")
            check(btns and not any('Đôn đốc' in t for t in btns) and any('Hủy slot' in t for t in btns), f'nút trong bảng: {sorted(set(btns))}')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('6. B1: PM chưa có chương trình nào — không lỗi JS')
            s = Mock(programs=[])
            ctx, page = open_page(browser, port, s)
            T.login(page, T.PM)
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('7. B3: bản chính thức, tiếng Anh — ô mật khẩu ghi "Enter password"')
            ctx, page = open_page(browser, port, None, page_name=PROD, extra_init="localStorage.setItem('lg_lang','en');")
            page.wait_for_timeout(1500)
            ph = page.get_attribute('#login-password', 'placeholder')
            check(ph == 'Enter password', f'placeholder = {ph!r}')
            ctx.close()

            print('8. B4: chế độ Đêm — chữ "Google Cloud Live" đọc được (tương phản ≥ 4,5:1)')
            s = Mock()
            ctx, page = open_page(browser, port, s)
            T.login(page, T.ME)
            light = page.evaluate(CONTRAST_JS, '#top-api-badge')
            page.evaluate('toggleTheme()'); page.wait_for_timeout(500)
            dark = page.evaluate(CONTRAST_JS, '#top-api-badge')
            check(dark >= 4.5, f'Đêm: {dark}:1 (Sáng: {light}:1)')
            page.evaluate('toggleTheme()')

            print('9. C3: Tab 1 lấy số thật từ danh mục (không còn "90 sản phẩm (43 model)")')
            hero = page.inner_text('#tab1-hero-subtitle').strip()
            letter = page.inner_text('#tab1-letter-count').strip()
            exp = '3 sản phẩm (3 model) tại 1 kho AYA'
            check(hero.startswith(exp + ' chính thức mở bán trực tuyến.'), f'đầu trang tab 1: {hero[:60]!r}')
            check(letter == exp, f'thư thông báo: {letter!r}')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            ctx, page = open_page(browser, port, Mock(), extra_init="localStorage.setItem('lg_lang','en');")
            T.login(page, T.ME)
            hero = page.inner_text('#tab1-hero-subtitle').strip()
            check(hero.startswith('3 items (3 models) in 1 warehouse(s) (AYA) are now on sale online.'), f'EN: {hero[:70]!r}')
            ctx.close()

            print('10. Điện thoại (iPhone 13): A1 đầu trang, A2 ô 03 lên đầu, A3 nút nộp tiền, A4 nút trợ lý ảo, Q1, R4, R8')
            s = Mock(my_status=T.NEW, programs=[dict(id=T.PID, name='Đợt Bán Hàng Nội Bộ Test', status='Open'), dict(id='IS-2026Q4-OTHER-02', name='Chương trình Bán hàng Nội bộ HE (Tivi & Loa) - Q3/2026', status='Open')])   # tên dài: không được tràn khỏi màn hình
            ctx, page = open_page(browser, port, s, device=ip13)
            T.login(page, T.ME); page.evaluate('window.scrollTo(0,0)'); page.wait_for_timeout(500)
            m = page.evaluate("""() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return {top: Math.round(b.top + scrollY), bottom: Math.round(b.bottom + scrollY), w: Math.round(b.width), h: Math.round(b.height), vis: b.width > 0 && getComputedStyle(e).display !== 'none'}; };
              const pay = document.querySelector('#grap-card3-footer [onclick^="openQuickPaymentModalForReg"]');
              const bar = document.getElementById('program-tab-bar');
              return { vh: innerHeight, header: r('.top-header'), progBar: r('#program-tab-bar'), card3: r('#grap-card-context'), card1: r('.grap-card-red'),
                       pay: pay && r('#grap-card3-footer [onclick^="openQuickPaymentModalForReg"]'), cardW: r('#grap-card3-footer'),
                       cancel: r('#grap-card3-footer [onclick^="cancelUserRegistration"]'), changePw: r('#user-bar .btn-logout'), en: r('.header-actions > .btn-lang'),
                       menu: r('.btn-header-menu'), catBar: r('.lg-quick-category-bar'), barOverflow: bar.scrollWidth - bar.clientWidth,
                       link: r('.grap-card-light .grap-card-link'), pageHScroll: document.documentElement.scrollWidth > innerWidth + 1 }; }""")
            check(m['header']['bottom'] <= 120, f"A1: đầu trang cao {m['header']['bottom']} px (trước: 285, đích ≤ 120)")
            names = page.evaluate("[...document.querySelectorAll('#program-tab-bar .program-tab')].map(e => { const r = e.getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0; })")
            check(len(names) == 2 and all(names), f"R4: thấy đủ 2 đợt, không đợt nào bị cắt ({names}); đầu trang + thanh chương trình = {m['progBar']['bottom']} px (trước: 357, khi đó đợt 2 bị cắt)")
            check(m['card3']['top'] < m['vh'] and m['card3']['top'] < m['card1']['top'], f"A2: ô 03 bắt đầu ở {m['card3']['top']} px (< {m['vh']} = màn 1), trước ô 01 ({m['card1']['top']})")
            check(m['pay'] and m['pay']['h'] >= 48 and m['pay']['w'] >= m['cardW']['w'] - 2, f"A3: nút Nộp tiền ngay {m['pay'] and (m['pay']['w'], m['pay']['h'])} (≥48 px cao, rộng = thẻ {m['cardW']['w']})")
            check(m['cancel'] and m['cancel']['h'] >= 44 and m['cancel']['top'] >= m['pay']['bottom'], f"A3: Hủy giữ chỗ ở dòng riêng, cao {m['cancel'] and m['cancel']['h']}")
            check(not m['changePw']['vis'] and m['en']['vis'] and m['menu']['vis'], f"A1: menu đóng → ẩn Đổi MK; EN và ☰ hiện ({m['changePw']['vis']}, {m['en']['vis']}, {m['menu']['vis']})")
            check(not m['catBar']['vis'], 'Q1: thanh HOT/NEW ẩn trên điện thoại')
            check(m['barOverflow'] <= 0, f"R4: thanh chương trình không bị cắt (thừa {m['barOverflow']} px)")
            check(m['link']['h'] <= 30, f"R8: \"Xem báo cáo kho ↗\" 1 dòng (cao {m['link']['h']} px)")
            check(not m['pageHScroll'], 'không cuộn ngang cả trang')
            page.click('.btn-header-menu'); page.wait_for_timeout(300)
            vis = page.evaluate("[...document.querySelectorAll('#user-bar .btn-logout, #btn-header-tour, .header-actions > .btn-action')].map(e => e.getBoundingClientRect().width > 0)")
            check(all(vis) and page.get_attribute('.btn-header-menu', 'aria-expanded') == 'true', f'A1: bấm ☰ → hiện đủ nút ({vis})')
            page.click('.btn-header-menu'); page.wait_for_timeout(300)
            fab = lambda: page.evaluate("getComputedStyle(document.getElementById('lg-digital-assistant')).display")
            check(fab() != 'none', 'A4: ngoài cửa sổ → nút trợ lý ảo vẫn hiện')
            page.evaluate(f"openQuickPaymentModalForReg('{T.PID}-AYA-003')"); page.wait_for_timeout(1200)
            check(fab() == 'none', 'A4: đang mở "Nộp tiền ngay" → nút trợ lý ảo ẩn (không che nút Xác nhận)')
            page.evaluate('closeQuickPaymentModal()'); page.wait_for_timeout(400)
            check(fab() != 'none', 'A4: đóng cửa sổ → nút trợ lý ảo hiện lại')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('12. v2.6: "Mở bán ngay" khi máy chủ chậm 6 giây / mất mạng — không báo thành công giả')
            s = Mock(programs=[dict(id=T.PID, name='Dot test', status='Draft')]); s.update_delay_s = 6
            ctx, page = open_page(browser, port, s)
            T.login(page, T.PM)
            # máy chủ giả "ngủ" trong luồng Python → trình duyệt tự ghi trạng thái ở giây 1,5 (lúc vẫn đang chờ máy chủ)
            page.evaluate(f"setTimeout(() => {{ window.__probe = [(programs.find(p => p.id === '{T.PID}') || {{}}).status, document.getElementById('wait-overlay').classList.contains('show')]; }}, 1500);"
                          f"setTimeout(() => updateProgramStatus('{T.PID}', 'Open'), 0)")
            page.wait_for_timeout(9000)
            st = page.evaluate('window.__probe')
            check(st == ['Draft', True], f'đang chờ máy chủ (giây 1,5): màn hình chưa đổi, có màn chờ ({st})')
            st = page.evaluate(f"[(programs.find(p => p.id === '{T.PID}') || {{}}).status, document.getElementById('wait-overlay').classList.contains('show')]")
            check(st == ['Open', False] and s.programs[0]['status'] == 'Open' and not page.dialogs, f'máy chủ trả lời sau 6 giây → Open, hết màn chờ, không hộp thoại lỗi ({st}, {page.dialogs[-1:]})')
            ctx.close()
            s = Mock(programs=[dict(id=T.PID, name='Dot test', status='Draft')]); s.update_fail = True
            ctx, page = open_page(browser, port, s)
            T.login(page, T.PM)
            page.evaluate(f"updateProgramStatus('{T.PID}', 'Open')"); page.wait_for_timeout(2500)
            st = page.evaluate(f"[(programs.find(p => p.id === '{T.PID}') || {{}}).status, document.getElementById('wait-overlay').classList.contains('show')]")
            check(st == ['Draft', False], f'mất mạng: màn hình KHÔNG đổi sang Open, hết màn chờ ({st})')
            check(any('CHƯA XÁC NHẬN ĐƯỢC VỚI MÁY CHỦ' in d for d in page.dialogs), f'có hộp thoại hướng dẫn kiểm tra cột E ({[d[:40] for d in page.dialogs]})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('13. v2.6 B1: thẻ sản phẩm gọn trên điện thoại — đủ thông tin, nút giữ chỗ vẫn gửi đúng slot')
            s = Mock(my_status=None)
            s.products[0]['description'] = 'Màn hình có 2 điểm chết góc trái, thùng rách, thiếu Magic Remote, viền trầy nặng, panel có vệt sáng mờ khi nền tối, cổng HDMI 2 lỏng, thiếu sách hướng dẫn, chân đế cong nhẹ'
            ctx, page = open_page(browser, port, s, device=ip13)
            T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(1500)
            c = page.evaluate("""() => { const card = document.querySelector('.lg-product-card'); const q = s => card.querySelector(s).getBoundingClientRect();
              const desc = card.querySelector('.lg-card-desc'), more = card.querySelector('.lg-desc-more');
              return { h: Math.round(card.getBoundingClientRect().height), vis: q('.lg-card-visual'), model: q('.lg-card-model'), btn: q('.lg-btn-buy'), cardW: card.clientWidth,
                       descH: desc.clientHeight, lineH: parseFloat(getComputedStyle(desc).lineHeight), clipped: getComputedStyle(desc).webkitLineClamp === '2',
                       moreVisible: !more.hidden && more.getBoundingClientRect().height > 0, moreText: more.textContent }; }""")
            check(c['h'] <= 320, f"thẻ cao {c['h']} px (v2.5.0: 515 px)")
            check(c['vis']['width'] <= 64 and c['vis']['right'] <= c['model']['left'], f"biểu tượng 64 px nằm bên trái model ({round(c['vis']['width'])} px)")
            check(c['clipped'] and c['descH'] <= 2 * c['lineH'] + 1 and c['moreVisible'], f"v2.7 (a): mô tả dài hiện 2 dòng ({c['descH']} px) + nút \"{c['moreText']}\"")
            page.click('.lg-product-card >> nth=0 >> .lg-desc-more'); page.wait_for_timeout(400)
            o = page.evaluate("""() => { const card = document.querySelector('.lg-product-card'), d = card.querySelector('.lg-card-desc');
              return { full: getComputedStyle(d).webkitLineClamp === 'none' && d.clientHeight > 2 * parseFloat(getComputedStyle(d).lineHeight) + 1, text: d.innerText, more: card.querySelector('.lg-desc-more').textContent }; }""")
            check(o['full'] and 'chân đế cong nhẹ' in o['text'] and 'Thu gọn' in o['more'], f"bấm \"Xem đủ\" → hiện ĐỦ mô tả, nút đổi thành \"{o['more']}\"")
            page.evaluate('renderProductTable(currentProducts)'); page.wait_for_timeout(400)   # polling vẽ lại danh mục
            still = page.evaluate("document.querySelector('.lg-product-card').classList.contains('desc-open')")
            check(still, 'danh mục vẽ lại (polling) → mô tả đã mở vẫn mở')
            short = page.evaluate("[...document.querySelectorAll('.lg-product-card')].slice(1).every(c => c.querySelector('.lg-desc-more').hidden)")
            check(short, 'mô tả ngắn (vừa 2 dòng) → không có nút "Xem đủ"')
            check(c['btn']['height'] >= 44 and c['btn']['width'] >= c['cardW'] - 30, f"nút giữ chỗ cao {round(c['btn']['height'])} px, rộng gần hết thẻ")
            page.click('.lg-product-card >> nth=0 >> .lg-btn-buy'); page.wait_for_timeout(2500)
            regs = [x[1] for x in s.calls if x[0] == 'register_product']
            check(regs and regs[-1].get('uniqueCode') == f'{T.PID}-AYA-001', f"bấm nút trên thẻ → gửi giữ chỗ đúng slot ({regs[-1].get('uniqueCode') if regs else 'không gửi'})")
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            CARD_CHECK = """sel => { const t = document.querySelector(sel); if (!t || !t.offsetParent) return null;
              const ths = [...t.querySelectorAll('thead th')].map(x => x.textContent.replace(/\\s+/g, ' ').trim());
              const rows = [...t.querySelectorAll('tbody tr')].filter(r => r.offsetParent);
              let out = 0, mism = 0, cells = 0;
              rows.forEach(tr => { const R = tr.getBoundingClientRect(); let i = 0;
                [...tr.cells].forEach(td => { if (td.colSpan === 1) { cells++; if ((td.dataset.label || '') !== ths[i]) mism++; } i += td.colSpan;
                  td.querySelectorAll('*').forEach(e => { const b = e.getBoundingClientRect(); if (b.width && (b.right > R.right + 1 || b.left < R.left - 1)) out++; }); }); });
              const sc = t.closest('[style*="overflow"], .pm-table-wrapper'); 
              return { rows: rows.length, cells, mism, out, theadShown: getComputedStyle(t.querySelector('thead')).display !== 'none',
                       hscroll: document.documentElement.scrollWidth > innerWidth + 1 || (sc ? sc.scrollWidth > sc.clientWidth + 1 : false) }; }"""
            s8 = dict(p.devices['Galaxy S8']); s8['device_scale_factor'] = 2
            if ENGINE == 'firefox': s8.pop('is_mobile', None)
            for dev_name, dev in (('iPhone 13', ip13), ('Galaxy S8', s8)):
                print(f'14. v2.7 B3 ({dev_name}): bảng → thẻ "nhãn: giá trị" — tab 3, tab 4, bảng PM; không vuốt ngang; nút trong bảng vẫn chạy')
                s = Mock(my_status=T.NEW)
                ctx, page = open_page(browser, port, s, device=dev)
                T.login(page, T.ME)
                page.evaluate("switchTab('tab3', document.getElementById('tab3-btn'))"); page.wait_for_timeout(2500)
                for sel in ('#lookup-result table', '#confirmation-table'):
                    r = page.evaluate(CARD_CHECK, sel)
                    check(r and r['rows'] >= 1 and r['mism'] == 0 and r['out'] == 0 and not r['theadShown'] and not r['hscroll'], f'{sel}: {r}')
                page.click('#lookup-result .btn-pay-open'); page.wait_for_timeout(1500)
                check(page.evaluate("!document.getElementById('payment-form').hidden"), 'tab 3: nút "Nộp tiền" trong thẻ vẫn mở form nộp tiền')
                page.evaluate("switchTab('tab4', document.getElementById('tab4-btn'))"); page.wait_for_timeout(1500)
                r = page.evaluate(CARD_CHECK, '#tab4 .slot-table')
                check(r and r['rows'] >= 3 and r['mism'] == 0 and r['out'] == 0 and not r['hscroll'], f'tab 4: {r}')
                page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(1200)
                check(page.evaluate("[...document.querySelectorAll('.btn-view-mode')].every(b => getComputedStyle(b).display === 'none')"), 'tab 2: nút "Dạng Thẻ / Dạng Bảng" ẩn trên điện thoại')
                check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
                ctx.close()
                s = Mock(); s.pm_regs = [reg(4, 'Đã khai nộp - chờ đối soát', 1000000), reg(5, 'Chờ nộp tiền', 4000000), reg(6, 'Đã đăng ký - Chờ mở thanh toán', 3000000)]   # slot 4–6: để 3 sản phẩm còn trống cho bảng "Hàng còn trống"
                ctx, page = open_page(browser, port, s, device=dev)
                T.login(page, T.PM)
                page.evaluate('loadPMDashboardData()'); page.wait_for_timeout(2500)
                for mode, sel in (('all', '#pm-reg-table'), ('unpaid', '#pm-unpaid-table'), ('remaining', '#pm-remaining-table')):
                    page.evaluate(f"setPMViewMode('{mode}')"); page.wait_for_timeout(800)
                    r = page.evaluate(CARD_CHECK, sel)
                    check(r and r['rows'] >= 1 and r['mism'] == 0 and r['out'] == 0 and not r['hscroll'], f'PM {mode}: {r}')
                page.evaluate("toggleTheme()"); page.wait_for_timeout(300)
                dk = page.evaluate("""() => { const td = document.querySelector('#pm-remaining-tbody td'); return [getComputedStyle(td.parentElement).backgroundColor, getComputedStyle(td).color, getComputedStyle(td, '::before').color]; }""")
                check(dk == ['rgb(255, 255, 255)', 'rgb(38, 38, 38)', 'rgb(74, 73, 70)'], f'PM chế độ Đêm: thẻ nền trắng, chữ tối như bảng PM trên máy tính ({dk})')
                page.evaluate("toggleTheme()")
                page.evaluate("setPMViewMode('all')"); page.wait_for_timeout(800)
                page.click('#pm-reg-tbody [onclick*="pmApprovePayment"]'); page.wait_for_timeout(2000)
                check(any(c[0] in ('pm_approve_payment',) for c in s.calls), f'PM: nút "Duyệt" trong thẻ vẫn gửi lệnh duyệt ({[c[0] for c in s.calls][-3:]})')
                check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
                ctx.close()

            print('15. v2.7 B4: cửa sổ "Nộp tiền ngay" toàn màn hình, ô nhập 1 cột, 2 nút luôn thấy ở đáy')
            s = Mock(my_status=T.NEW)
            ctx, page = open_page(browser, port, s, device=ip13)
            T.login(page, T.ME)
            page.evaluate(f"openQuickPaymentModalForReg('{T.PID}-AYA-003')"); page.wait_for_timeout(1500)
            m = page.evaluate("""() => { const card = document.querySelector('#quick-payment-modal .modal-card').getBoundingClientRect();
              const L = id => document.getElementById(id).getBoundingClientRect();
              const btns = [...document.querySelectorAll('#quick-payment-form > div:last-child > button')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(r.height)]; });
              return { vh: innerHeight, vw: innerWidth, card: [Math.round(card.left), Math.round(card.top), Math.round(card.width), Math.round(card.height)],
                       name: L('quick-payer-name').left, code: L('quick-payer-code').left, codeTop: L('quick-payer-code').top, nameTop: L('quick-payer-name').top, btns }; }""")
            check(m['card'][2] == m['vw'] and m['card'][3] == m['vh'], f"toàn màn hình: {m['card']} (màn {m['vw']}×{m['vh']})")
            check(abs(m['name'] - m['code']) < 1 and m['codeTop'] > m['nameTop'], 'ô nhập 1 cột (Mã NV nằm dưới Họ tên)')
            check(len(m['btns']) == 2 and all(b[1] <= m['vh'] and b[2] >= 48 for b in m['btns']), f"mở cửa sổ: 2 nút thấy ngay ở đáy, cao ≥ 48 px ({m['btns']})")
            page.evaluate("document.querySelector('#quick-payment-modal .modal-card').scrollTop = 300"); page.wait_for_timeout(300)
            bt = page.evaluate("[...document.querySelectorAll('#quick-payment-form > div:last-child > button')].map(b => Math.round(b.getBoundingClientRect().bottom))")
            check(all(x <= m['vh'] for x in bt), f'cuộn giữa form: 2 nút vẫn ở đáy ({bt})')
            page.click('#quick-payment-form > div:last-child > button >> nth=0'); page.wait_for_timeout(500)
            check(not page.evaluate("document.getElementById('quick-payment-modal').classList.contains('active')"), 'bấm "Để sau" → đóng cửa sổ (như cũ)')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('17. v2.8 C1/C2 + lỗi 1 (điện thoại, PM): 2 nút chính + "Thêm thao tác"; KPI 2 cột; cửa sổ biên lai nút ở đáy')
            s = Mock(); s.pm_regs = [reg(4, 'Đã khai nộp - chờ đối soát', 1000000), reg(5, 'Chờ nộp tiền', 4000000)]
            s.pm_regs[0]['receipt'] = 'https://drive.google.com/file/d/x/view'
            ctx, page = open_page(browser, port, s, device=ip13)
            T.login(page, T.PM); page.evaluate('loadPMDashboardData()'); page.wait_for_timeout(2500)
            vis = lambda sel: page.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && e.offsetParent !== null; }})()")
            check(vis('#btn-allow-payment-header') and vis('#btn-batch-approve-header') and vis('.btn-pm-more') and not vis('#btn-pm-export-csv') and not vis('#btn-timer-settings-header'),
                  'C1: đóng → chỉ thấy Mở cổng, Duyệt hàng loạt, Thêm thao tác')
            page.click('.btn-pm-more'); page.wait_for_timeout(300)
            check(vis('#btn-pm-export-csv') and vis('#btn-timer-settings-header') and vis('#btn-pm-expired-check'), 'C1: bấm "Thêm thao tác" → hiện các nút phụ')
            page.click('.btn-pm-more'); page.wait_for_timeout(300)
            t = page.evaluate("(() => { const e = findTourTargetElement('#btn-pm-export-csv, .btn-pm-export, .pm-header-actions'); return e && e.id; })()")
            check(t == 'btn-pm-export-csv', f'C1: Hướng dẫn nhanh chỉ nút Xuất Excel → tự mở nhóm, khung đúng nút ({t})')
            k = page.evaluate("[...document.querySelectorAll('.pm-kpi-grid > .pm-kpi-card')].map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; })")
            cols = sorted(set(x for x, _ in k))
            check(len(cols) == 2 and max(w for _, w in k) <= page.evaluate('innerWidth'), f'C2: KPI 2 cột, không tràn ({k})')
            page.evaluate("openPMReceiptModal(pmRegistrations[0].id)"); page.wait_for_timeout(1000)
            m = page.evaluate("""() => { const c = document.querySelector('#receipt-modal .modal-card').getBoundingClientRect();
              return { vh: innerHeight, card: [Math.round(c.width), Math.round(c.height)], btns: ['#modal-btn-approve', '#modal-btn-reject'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().bottom)) }; }""")
            check(m['card'] == [page.evaluate('innerWidth'), m['vh']] and all(b <= m['vh'] for b in m['btns']), f"lỗi 1: biên lai toàn màn hình, nút Duyệt / Từ chối thấy ngay ({m})")
            page.click('#modal-btn-approve'); page.wait_for_timeout(1500)
            check(any(c[0] == 'pm_approve_payment' for c in s.calls), 'lỗi 1: nút Duyệt trong cửa sổ vẫn gửi lệnh duyệt')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('18. v2.8 C3 + lỗi 2 (điện thoại, tab 3): 2 nút xếp dọc; nhãn "Dành cho Nhân Viên" 1 dòng')
            s = Mock(my_status=T.NEW); ctx, page = open_page(browser, port, s, device=ip13); T.login(page, T.ME)
            page.evaluate("switchTab('tab3', document.getElementById('tab3-btn'))"); page.wait_for_timeout(1500)
            r = page.evaluate("""() => { const b = [...document.querySelectorAll('#tab3 > div:first-child > div:last-child > button')].map(x => x.getBoundingClientRect());
              const badge = document.querySelector('#payment-upload-card > div:first-child > span:last-child').getBoundingClientRect();
              return { tops: b.map(x => Math.round(x.top)), widths: b.map(x => Math.round(x.width)), badgeH: Math.round(badge.height) }; }""")
            check(len(r['tops']) == 2 and r['tops'][1] > r['tops'][0] and min(r['widths']) >= 300, f"C3: 2 nút xếp dọc, rộng hết hàng ({r['tops']}, {r['widths']})")
            check(r['badgeH'] <= 30, f"lỗi 2: nhãn 1 dòng (cao {r['badgeH']} px; trước: hình tròn 4 dòng)")
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('19. v2.8 Docs: đúng vai trò + ngôn ngữ; file tồn tại; điện thoại: nút trong ☰, bản điện thoại đứng đầu')
            for uid, role, lang, dev, first in ((T.ME, 'user', 'vi', None, 'laptop'), (T.PM, 'pm', 'en', None, 'laptop'), (T.ADMIN, 'admin', 'vi', ip13, 'phone')):
                s = Mock(); ctx, page = open_page(browser, port, s, device=dev, extra_init=f"localStorage.setItem('lg_lang','{lang}');"); T.login(page, uid)
                if dev:
                    check(not vis('#btn-header-docs'), 'điện thoại: Docs ẩn khi ☰ đóng')
                    page.click('.btn-header-menu'); page.wait_for_timeout(300)
                page.click('#btn-header-docs'); page.wait_for_timeout(400)
                links = page.evaluate("[...document.querySelectorAll('#docs-links a')].map(a => a.getAttribute('href'))")
                exp = [f'guides/{first}/{role}_{lang}.html', f"guides/{'phone' if first == 'laptop' else 'laptop'}/{role}_{lang}.html"]
                exists = page.evaluate("Promise.all([...document.querySelectorAll('#docs-links a')].map(a => fetch(a.href).then(r => r.status)))")
                check(links == exp and exists == [200, 200], f'{uid} {lang} {"điện thoại" if dev else "máy tính"}: {links} → {exists}')
                check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
                ctx.close()

            print('20. v2.8 tiếng Anh: chữ Việt không dấu đã dịch (STT, TV & Loa Thanh, Xoay 90°, Còn trống · Nhận ĐK)')
            s = Mock(); s.pm_regs = [reg(4, 'Đã khai nộp - chờ đối soát', 1000000)]; s.pm_regs[0]['receipt'] = 'https://drive.google.com/file/d/x/view'
            ctx, page = open_page(browser, port, s, extra_init="localStorage.setItem('lg_lang','en');"); T.login(page, T.PM)
            page.evaluate('loadPMDashboardData()'); page.wait_for_timeout(2500)
            txt = page.evaluate("document.body.innerText")
            page.evaluate("setPMViewMode('remaining')"); page.wait_for_timeout(600); txt += page.evaluate("document.body.innerText")
            page.evaluate("openPMReceiptModal(pmRegistrations[0].id)"); page.wait_for_timeout(800); txt += page.evaluate("document.querySelector('#receipt-modal').innerText")
            left = [w for w in ('STT', 'Loa Thanh', 'Xoay', 'Còn trống') if w in txt]
            check(not left and 'TV & Soundbar' in txt and 'Rotate 90°' in txt, f'còn: {left}')
            ctx.close()

            print('21. v2.9 địa chỉ nhận hàng: chưa có → hỏi khi giữ chỗ (kèm kho khu vực), gửi lên máy chủ, PM thấy')
            s = Mock(my_status=None)
            ctx, page = open_page(browser, port, s, device=ip13, no_addr=True); T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(1200)
            row = page.inner_text('#delivery-addr-row')
            check('Chưa có địa chỉ nhận hàng' in row, f'tab 2: dòng nhắc thêm địa chỉ ({row[:60]!r})')
            page.evaluate(f"setTimeout(() => handleRegisterProduct('{T.PID}-AYA-001'), 0)"); page.wait_for_timeout(600)   # không chờ: hàm đợi người dùng nhập địa chỉ
            mod = page.evaluate("[document.getElementById('addr-modal').classList.contains('active'), document.getElementById('addr-modal-product').textContent]")
            check(mod[0] and 'Miền Bắc' in mod[1] and 'MODEL-FREE' in mod[1], f'giữ chỗ khi chưa có địa chỉ → cửa sổ địa chỉ, ghi kho khu vực ({mod[1]!r})')
            page.fill('#addr-input', 'ngắn'); page.click('#addr-save-btn'); page.wait_for_timeout(200)
            check(page.evaluate("!document.getElementById('addr-error').hidden") and not [c for c in s.calls if c[0] == 'register_product'], 'địa chỉ quá ngắn → báo lỗi, chưa gửi giữ chỗ')
            page.fill('#addr-input', 'Số 5 Lê Lợi, Quận 1, TP Hồ Chí Minh'); page.click('#addr-save-btn'); page.wait_for_timeout(2500)
            regs = [c[1] for c in s.calls if c[0] == 'register_product']
            check(regs and regs[-1].get('address') == 'Số 5 Lê Lợi, Quận 1, TP Hồ Chí Minh', f"lệnh giữ chỗ gửi kèm địa chỉ ({regs[-1].get('address') if regs else 'không gửi'})")
            check(any('Giao đến: Số 5 Lê Lợi' in d for d in page.dialogs), 'hộp thoại xác nhận ghi "Giao đến: …"')
            check('Số 5 Lê Lợi' in page.inner_text('#delivery-addr-row'), 'tab 2 hiện địa chỉ đã lưu + nút Sửa')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            s = Mock(); r1 = reg(4, 'Đã khai nộp - chờ đối soát', 1000000); r1['address'] = 'Số 5 Lê Lợi, Quận 1, TP Hồ Chí Minh'; r1['receipt'] = 'https://drive.google.com/file/d/x/view'; s.pm_regs = [r1]
            ctx, page = open_page(browser, port, s); T.login(page, T.PM); page.evaluate('loadPMDashboardData()'); page.wait_for_timeout(2500)
            check('Số 5 Lê Lợi' in page.inner_text('#pm-reg-tbody'), 'PM: bảng đơn hiện địa chỉ nhận hàng')
            page.evaluate("openPMReceiptModal(pmRegistrations[0].id)"); page.wait_for_timeout(600)
            check(page.inner_text('#modal-address').startswith('Số 5 Lê Lợi'), 'PM: cửa sổ biên lai hiện địa chỉ')
            ctx.close()

            print('22. v2.9 Config: web đọc tab Config (public_config); ô sai dạng → giữ mặc định; EN dùng cột D')
            cfgv = {'BANK_ACC': {'vi': '0123456789012', 'en': ''}, 'BANK_BIN': {'vi': 'abc', 'en': ''}, 'TRANSFER_SYNTAX': {'vi': '{SLOT} {EMP}', 'en': ''},
                    'SUPPORT_EMAIL': {'vi': 'hotro@example.com', 'en': ''}, 'SUPPORT_PHONE': {'vi': '0900000000', 'en': ''},
                    'ANNOUNCEMENT': {'vi': 'Mở bán lúc 10:00 ngày 14/10', 'en': 'Sale opens 10:00 on 14 Oct'},
                    'DELIVERY_POLICY': {'vi': 'Giao trong 7 ngày', 'en': 'Delivered within 7 days'}}
            s = Mock(my_status=T.NEW); s.public_config = cfgv
            ctx, page = open_page(browser, port, s); page.wait_for_timeout(1500)
            check('hotro@example.com' in page.inner_text('#login-support'), f"đăng nhập: email hỗ trợ từ Config ({page.inner_text('#login-support')!r})")
            T.login(page, T.ME)
            st = page.evaluate("""() => ({ acc: document.querySelector('#grap-card1-body [data-cfg="BANK_ACC"]').textContent, syn: document.querySelector('#grap-card1-body [data-cfg-syntax]').textContent,
              ann: document.getElementById('site-announcement').hidden ? '' : document.getElementById('site-announcement').textContent, bin: cfg('BANK_BIN'),
              qr: vietQrUrl(100, buildTransferSyntax('VH70001', 'SLOT-1')), title: document.querySelector('#grap-card-context').previousElementSibling ? '' : '' })""")
            check(st['acc'] == '0123456789012', f"ô 01: số tài khoản từ Config, giữ số 0 đầu ({st['acc']})")
            check(st['syn'] == '[Mã Slot] [Mã NV]', f"cú pháp CK theo mẫu Config ({st['syn']})")
            check(st['bin'] == '970436' and '970436-0123456789012' in st['qr'] and 'addInfo=SLOT-1%20VH70001' in st['qr'], f"BIN sai dạng → mặc định; mã VietQR dùng tài khoản + nội dung mới ({st['qr'][:90]})")
            check(st['ann'] == 'Mở bán lúc 10:00 ngày 14/10', f"dòng thông báo hiện ({st['ann']!r})")
            page.evaluate("openSupportModal()"); page.wait_for_timeout(300)
            check(any('Hotline: 0900000000' in t for t in page.evaluate("[...document.querySelectorAll('.toast, .lg-toast, [class*=toast]')].map(e => e.innerText)")), 'nút Hỗ trợ: email + hotline từ Config')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            s = Mock(); s.public_config = cfgv
            ctx, page = open_page(browser, port, s, extra_init="localStorage.setItem('lg_lang','en');"); T.login(page, T.ME)
            page.evaluate("openFullLetterModal && 0"); en = page.evaluate("[document.getElementById('site-announcement').textContent, document.querySelector('[data-cfg=\"DELIVERY_POLICY\"]').textContent]")
            check(en == ['Sale opens 10:00 on 14 Oct', 'Delivered within 7 days'], f'EN: dùng cột D ({en})')
            ctx.close()

            print('23. v2.9 hạn mức theo chương trình (2 SP): mọi chữ hạn mức đổi theo')
            s = Mock(my_status=None, programs=[dict(id=T.PID, name='Dot test', status='Open', max=2)])
            ctx, page = open_page(browser, port, s); T.login(page, T.ME)
            t = page.evaluate("[document.getElementById('grap-limit-pill').textContent, document.getElementById('rules-limit-text').textContent, document.getElementById('grap-card3-body').innerText, document.getElementById('tab1-hero-title').textContent]")
            check(t[0] == '2 SP / NV' and t[1] == '02 sản phẩm / 01 nhân viên' and 'Hạn mức: 2 SP' in t[2], f'ô 01, Thể lệ, ô 03 = 2 ({t[:2]}, {t[2][:60]!r})')
            check(t[3] == 'Dot test', f'Tab 1: tiêu đề = tên chương trình ({t[3]!r})')
            ctx.close()

            print('24. v2.9 EN: "Chưa có chương trình nào được chọn" đã dịch; ô 01 = "Bank Transfer"')
            s = Mock(programs=[]); ctx, page = open_page(browser, port, s, extra_init="localStorage.setItem('lg_lang','en');"); T.login(page, T.PM)
            check(page.inner_text('#grap-program-title') == 'No program selected', f"({page.inner_text('#grap-program-title')!r})")
            ctx.close()
            s = Mock(); ctx, page = open_page(browser, port, s, extra_init="localStorage.setItem('lg_lang','en');"); T.login(page, T.ME)
            check(page.inner_text('.grap-card-red .grap-card-title') == 'Bank Transfer', f"({page.inner_text('.grap-card-red .grap-card-title')!r})")
            ctx.close()
            s = Mock(); ctx, page = open_page(browser, port, s); T.login(page, T.ME)
            check(page.inner_text('.grap-card-red .grap-card-title') == 'Thông Tin Chuyển Khoản', 'VI: "Thông Tin Chuyển Khoản"')
            ctx.close()

            print('25. v2.10 hạn nộp tiền theo Config PAYMENT_DEADLINE_HOURS + nhắc đổi địa chỉ ở bước nộp tiền')
            # Mọi chữ "24h / 24 giờ / 24 hours" còn lại trên trang (cả phần đang ẩn) phải nằm trong vùng được loại trừ
            LEFT24 = """() => { const re = /(^|[^\\d.,:+])24\\s?(h|H|giờ|Giờ|GIỜ|tiếng|hours?|Hours?)(?![A-Za-zÀ-ỹ\\d])/; const out = [];
              const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
              while ((n = w.nextNode())) { const p = n.parentElement; if (!p || /SCRIPT|STYLE/.test(p.nodeName)) continue;
                if (re.test(n.nodeValue) && !p.closest('[data-no-hours], [data-no-i18n], .lg-card-desc')) out.push(n.nodeValue.trim().slice(0, 70)); }
              document.querySelectorAll('[title], [placeholder]').forEach(e => ['title', 'placeholder'].forEach(a => { const v = e.getAttribute(a); if (v && re.test(v) && !e.closest('[data-no-hours]')) out.push(a + ': ' + v.slice(0, 60)); }));
              return out; }"""
            TXT = "id => (document.getElementById(id) || {}).textContent || ''"
            class AddrMock(Mock):
                lookup_addr = 'Số 9 Trần Phú, Ba Đình, Hà Nội'
                def do_lookup(self, d):
                    r = super().do_lookup(d)
                    for o in r['orders']: o['address'] = self.lookup_addr
                    return r
            def h_cfg(v): return {'PAYMENT_DEADLINE_HOURS': {'vi': v, 'en': ''}}
            s = AddrMock(my_status=T.NEW); s.public_config = h_cfg('48')
            ctx, page = open_page(browser, port, s); T.login(page, T.ME)
            sub = page.evaluate(TXT, 'grap-program-subtitle'); tab3 = page.evaluate(TXT, 'tab3')
            check('Thời hạn giữ slot: 48h' in sub and '24h' not in sub, f'VI hạn 48: dòng chương trình ({sub[-30:]!r})')
            check('bạn có 48 giờ để nộp tiền' in tab3 and '24 giờ để nộp' not in tab3, 'VI hạn 48: tab 3 "bạn có 48 giờ để nộp tiền"')
            check('tối đa 48 Giờ' in page.evaluate("document.body.textContent"), 'VI hạn 48: Thể lệ "tối đa 48 Giờ"')
            check('24 Giờ (Giúp nhân viên' in page.evaluate("document.body.textContent"), 'không đổi: "Thời gian thông báo trước: 24 Giờ" (không phải hạn nộp tiền)')
            left = page.evaluate(LEFT24)
            check(left == [], f'không còn chữ hạn 24 giờ ngoài vùng loại trừ ({left[:4]})')
            page.evaluate("setTimeout(() => alert('Để sau (Nộp trong 24h)'), 0)"); page.wait_for_timeout(400)
            check(page.dialogs and page.dialogs[-1] == 'Để sau (Nộp trong 48h)', f'hộp thoại cũng đổi số giờ ({page.dialogs[-1:]})')
            page.evaluate("SITE_CFG = cfgClean({PAYMENT_DEADLINE_HOURS: {vi: '72'}}); applySiteConfig()"); page.wait_for_timeout(300)
            check('slot: 72h' in page.evaluate(TXT, 'grap-program-subtitle') and page.evaluate(LEFT24) == [], 'Config đổi 48 → 72: chữ đổi theo, không còn 48')
            page.evaluate("SITE_CFG = cfgClean({}); applySiteConfig()"); page.wait_for_timeout(300)
            check('slot: 24h' in page.evaluate(TXT, 'grap-program-subtitle') and 'bạn có 24 giờ' in page.evaluate(TXT, 'tab3'), 'Config về trống → trả lại 24h')
            page.evaluate("SITE_CFG = cfgClean({PAYMENT_DEADLINE_HOURS: {vi: '48'}}); applySiteConfig()")
            page.evaluate("switchTab('tab3', document.getElementById('tab3-btn'))"); page.wait_for_timeout(2500)
            page.click('#lookup-result .btn-pay-open'); page.wait_for_timeout(1200)
            note = page.evaluate(TXT, 'pay-addr-note')
            check(s.lookup_addr in note and 'liên hệ trực tiếp PM phụ trách' in note and not page.evaluate("document.getElementById('pay-addr-note').hidden"),
                  f'tab 3 nộp tiền: hiện địa chỉ của đơn + "liên hệ trực tiếp PM phụ trách" ({note[:90]!r})')
            page.evaluate(f"openQuickPaymentModalForReg('{T.PID}-AYA-003')"); page.wait_for_timeout(800)
            qn = page.evaluate(TXT, 'quick-addr-note')
            check(s.lookup_addr in qn and 'liên hệ trực tiếp PM phụ trách' in qn, f'cửa sổ "Nộp tiền ngay": địa chỉ + câu nhắc ({qn[:90]!r})')
            check('Nộp trong 48h' in page.evaluate("document.querySelector('#quick-payment-modal .btn-secondary').textContent"), 'nút "Để sau (Nộp trong 48h)"')
            page.evaluate("closeQuickPaymentModal(); switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(800)
            check('liên hệ trực tiếp PM phụ trách' in page.evaluate(TXT, 'delivery-addr-row'), 'tab 2: dòng địa chỉ ghi "liên hệ trực tiếp PM phụ trách"')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            for bad in ('1', 'abc', '200', '12.5'):
                s = Mock(); s.public_config = h_cfg(bad)
                ctx, page = open_page(browser, port, s); T.login(page, T.ME, settle_ms=3000)
                check('slot: 24h' in page.evaluate(TXT, 'grap-program-subtitle') and page.evaluate('payH()') == 24, f'giá trị sai "{bad}" → giữ 24h')
                ctx.close()
            s = Mock(); ctx, page = open_page(browser, port, s); T.login(page, T.ME, settle_ms=3000)
            check('slot: 24h' in page.evaluate(TXT, 'grap-program-subtitle') and 'bạn có 24 giờ' in page.evaluate(TXT, 'tab3'), 'máy chủ cũ (không có public_config): giữ 24h như cũ')
            ctx.close()
            # EN: dịch trước rồi mới đổi số giờ
            s = AddrMock(my_status=T.NEW); s.public_config = h_cfg('48')
            ctx, page = open_page(browser, port, s, extra_init="localStorage.setItem('lg_lang','en');"); T.login(page, T.ME)
            sub = page.evaluate(TXT, 'grap-program-subtitle'); tab3 = page.evaluate(TXT, 'tab3')
            check(sub.startswith('Limit:') and sub.endswith('Slot hold: 48h'), f'EN hạn 48: dòng chương trình đã dịch + 48h ({sub!r})')
            check('you have 48 hours to pay' in tab3 and '24 hours' not in tab3, 'EN hạn 48: tab 3 "you have 48 hours to pay"')
            left = page.evaluate(LEFT24)
            check(left == [], f'EN: không còn chữ hạn 24 giờ ngoài vùng loại trừ ({left[:4]})')
            page.evaluate("setTimeout(() => confirm('Bạn có muốn quét kiểm tra các đơn hàng quá hạn giữ chỗ 24h và tự động giải phóng slot không?'), 0)"); page.wait_for_timeout(400)
            check(page.dialogs and page.dialogs[-1] == 'Scan for reservations past 48 hours and release those slots automatically?', f'EN hộp thoại: dịch rồi đổi giờ ({page.dialogs[-1:]})')
            page.evaluate("setTimeout(() => alert(T('Quét hoàn tất: Đã giải phóng 2 slot quá hạn 48h, nhắc nhở 1 slot sắp hết hạn.')), 0)"); page.wait_for_timeout(400)
            check(page.dialogs[-1] == 'Scan done: released 2 slot(s) past 48h, reminded 1 slot(s) about to expire.', f'EN: thông báo quét của máy chủ (48h) vẫn dịch ({page.dialogs[-1:]})')
            page.evaluate("switchTab('tab3', document.getElementById('tab3-btn'))"); page.wait_for_timeout(2500)
            page.click('#lookup-result .btn-pay-open'); page.wait_for_timeout(1200)
            note = page.evaluate(TXT, 'pay-addr-note')
            check('Delivery address:' in note and 'contact the PM in charge directly' in note and s.lookup_addr in note, f'EN: câu nhắc địa chỉ ({note[:100]!r})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            # PM: đồng hồ "Còn ~Nh" và nhãn "Quá hạn" theo hạn cấu hình
            import datetime as _dt
            old = (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(hours=30)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
            for hv, expect in (('48', 'Còn ~18h'), (None, 'Quá hạn 24h')):
                s = Mock(); r5 = reg(5, 'Chờ nộp tiền', 4000000); r5['timestamp'] = old; s.pm_regs = [r5]
                if hv: s.public_config = h_cfg(hv)
                ctx, page = open_page(browser, port, s); T.login(page, T.PM); page.evaluate('loadPMDashboardData()'); page.wait_for_timeout(2500)
                page.evaluate("setPMViewMode('unpaid')"); page.wait_for_timeout(800)
                tx = page.inner_text('#pm-unpaid-table')
                check(expect in tx and (f'Hạn chót {hv or 24}h' in tx), f'PM hạn {hv or 24}: đơn giữ 30 giờ → "{expect}", tiêu đề cột "Hạn chót {hv or 24}h" ({tx[:0]})')
                check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
                ctx.close()
            # Điện thoại: câu nhắc địa chỉ không tràn
            s = AddrMock(my_status=T.NEW); s.lookup_addr = 'Căn hộ 1205 tòa S2.03 Vinhomes Ocean Park, xã Đa Tốn, huyện Gia Lâm, thành phố Hà Nội'
            ctx, page = open_page(browser, port, s, device=ip13); T.login(page, T.ME)
            page.evaluate("switchTab('tab3', document.getElementById('tab3-btn'))"); page.wait_for_timeout(2500)
            page.click('#lookup-result .btn-pay-open'); page.wait_for_timeout(1200)
            r = page.evaluate("(() => { const e = document.getElementById('pay-addr-note'), b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), innerWidth, e.scrollWidth <= e.clientWidth + 1, document.documentElement.scrollWidth <= innerWidth + 1]; })()")
            check(r[0] >= 0 and r[1] <= r[2] and r[3] and r[4], f'iPhone 13: câu nhắc địa chỉ nằm trong màn hình, không vuốt ngang ({r})')
            page.evaluate(f"openQuickPaymentModalForReg('{T.PID}-AYA-003')"); page.wait_for_timeout(800)
            r = page.evaluate("(() => { const e = document.getElementById('quick-addr-note'), b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), innerWidth, e.scrollWidth <= e.clientWidth + 1]; })()")
            check(r[0] >= 0 and r[1] <= r[2] and r[3], f'iPhone 13: cửa sổ nộp tiền — câu nhắc địa chỉ không tràn ({r})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('26. v2.11 địa chỉ lưu trên Sheet: máy A lưu → máy B tự điền; mở lại trang lấy bản mới; tỉnh/thành + cảnh báo khác miền; tự đổi địa chỉ đơn')
            class AddrV12(Mock):   # giả lập Apps Script Version 12 (Code.gs v2.11)
                def __init__(self, **kw):
                    super().__init__(**kw); self.addr = {}; self.order_addr = ''; self.order_paid = False
                def do_auth(self, d):
                    r = super().do_auth(d)
                    if r.get('ok'): r['user']['address'] = self.addr.get(d['id'], '')
                    return r
                def do_my_address(self, d): return {'ok': True, 'address': self.addr.get(T.ME, '')}
                def do_update_my_address(self, d):
                    a = ' '.join(str(d.get('address', '')).split())
                    if len(a) < 10: return {'ok': False, 'message': 'Vui lòng nhập địa chỉ đầy đủ (ít nhất 10 ký tự).'}
                    self.addr[T.ME] = a; return {'ok': True, 'address': a, 'message': 'Đã lưu địa chỉ nhận hàng.'}
                def do_user_update_order_address(self, d):
                    if self.order_paid: return {'ok': False, 'message': f"Đơn {d.get('slotId')} đã khai nộp tiền hoặc đã xử lý nên không tự đổi địa chỉ được. Vui lòng liên hệ trực tiếp PM phụ trách."}
                    self.order_addr = d['address']; return {'ok': True, 'address': d['address'], 'message': f"Đã đổi địa chỉ nhận hàng của đơn {d.get('slotId')}."}
                def do_lookup(self, d):
                    r = super().do_lookup(d)
                    for o in r['orders']: o['address'] = self.order_addr; o['paid'] = self.order_paid
                    return r
            calls = lambda s_, a: [c[1] for c in s_.calls if c[0] == a]
            OPEN = "setTimeout(() => openAddressModal(null), 0)"
            ROW = "document.getElementById('delivery-addr-row').innerText"
            # a) máy A: chưa có địa chỉ → chọn tỉnh + nhập chi tiết → lưu lên Sheet
            s = AddrV12(my_status=None)
            ctx, page = open_page(browser, port, s, no_addr=True); T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(800)
            check('Chưa có địa chỉ' in page.evaluate(ROW), 'máy A: chưa có địa chỉ → nút Thêm địa chỉ')
            page.evaluate(OPEN); page.wait_for_timeout(400)
            page.click('#addr-save-btn'); page.wait_for_timeout(200)
            check(not page.evaluate("document.getElementById('addr-error').hidden"), 'chưa chọn tỉnh → báo lỗi, không lưu')
            page.select_option('#addr-province', 'Hải Phòng'); page.fill('#addr-input', 'Số 1 Lê Lợi, phường Ngô Quyền'); page.click('#addr-save-btn'); page.wait_for_timeout(1500)
            check(s.addr.get(T.ME) == 'Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng', f"lưu lên Sheet (update_my_address): {s.addr.get(T.ME)!r}")
            check('Đã lưu trên hệ thống' in page.evaluate(ROW) and 'Hải Phòng' in page.evaluate(ROW), 'tab 2: hiện địa chỉ + "Đã lưu trên hệ thống…"')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            # b) máy B: không có gì trên máy → đăng nhập là có địa chỉ; sửa ở máy khác rồi mở lại trang → lấy bản mới
            ctx, page = open_page(browser, port, s, no_addr=True); T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(800)
            check('Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng' in page.evaluate(ROW), 'máy B: tự điền địa chỉ từ Sheet ngay khi đăng nhập')
            s.addr[T.ME] = 'Số 9 Trần Phú, Ba Đình, Hà Nội'
            page.reload(); page.wait_for_timeout(5000)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(800)
            check('Số 9 Trần Phú' in page.evaluate(ROW) and calls(s, 'my_address'), 'mở lại trang (phiên còn hạn): hỏi my_address → địa chỉ mới nhất')
            ctx.close()
            # c) địa chỉ cũ chỉ có trên máy (v2.9–v2.10), Sheet trống → tự đưa lên Sheet
            s = AddrV12(my_status=None)
            ctx, page = open_page(browser, port, s); T.login(page, T.ME); page.wait_for_timeout(1500)
            check(s.addr.get(T.ME) == 'So 1 Duong Thu, Hai Phong', f"địa chỉ cũ trên máy → tự đưa lên Sheet ({s.addr.get(T.ME)!r})")
            ctx.close()
            # d) Apps Script cũ (V11, chưa có lệnh): giữ cách cũ, chữ cũ, không lỗi
            s = Mock(my_status=None)
            ctx, page = open_page(browser, port, s, no_addr=True); T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(800)
            page.evaluate(OPEN); page.wait_for_timeout(300); page.select_option('#addr-province', 'Đà Nẵng'); page.fill('#addr-input', 'Số 5 Bạch Đằng, Hải Châu'); page.click('#addr-save-btn'); page.wait_for_timeout(800)
            r = page.evaluate(ROW)
            check('Số 5 Bạch Đằng, Hải Châu, Đà Nẵng' in r and 'liên hệ trực tiếp PM phụ trách' in r and not calls(s, 'update_my_address'), 'máy chủ cũ: lưu trên máy như cũ, chữ cũ, không gọi lệnh mới')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            # e) nhận miền + cảnh báo khác miền (chỉ cảnh báo, vẫn giữ chỗ được)
            s = AddrV12(my_status=None); s.addr[T.ME] = 'Số 12 Nguyễn Huệ, Quận 1, TP Hồ Chí Minh'
            ctx, page = open_page(browser, port, s, no_addr=True); T.login(page, T.ME)
            u = page.evaluate("""() => [addrRegion('Số 12 Điện Biên Phủ, Ngô Quyền, Hải Phòng'), addrRegion('Q1, TP HCM'), addrRegion('Thủ Dầu Một, Bình Dương'), addrRegion('Hải Châu, Đà Nẵng'), addrRegion('abc xyz'),
              JSON.stringify(splitAddress('Số 1 Lê Lợi, TP Hồ Chí Minh')), JSON.stringify(splitAddress('12 Nguyễn Huệ Q1 HCM')), joinAddress('Số 1 Lê Lợi, Hải Phòng', 'Hải Phòng')]""")
            check(u[:5] == ['Bắc', 'Nam', 'Nam', 'Trung', None], f'nhận miền: {u[:5]}')
            check(u[5] == '{"province":"TP Hồ Chí Minh","detail":"Số 1 Lê Lợi"}' and '"province":"TP Hồ Chí Minh"' in u[6] and u[7] == 'Số 1 Lê Lợi, Hải Phòng', f'tách / ghép tỉnh: {u[5:]}')
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(1200)
            aya = page.evaluate("currentProducts.find(p => p.kho === 'AYA' && p.status === 'Available').uniqueCode")
            page.evaluate(f"setTimeout(() => handleRegisterProduct('{aya}'), 0)"); page.wait_for_timeout(2500)
            dlg = [x for x in page.dialogs if 'Xác nhận đăng ký' in x]
            check(dlg and 'Lưu ý: địa chỉ ở Miền Nam, sản phẩm ở kho AYA (Miền Bắc)' in dlg[-1] and calls(s, 'register_product'), 'giữ chỗ kho AYA, địa chỉ HCM: hộp xác nhận có cảnh báo, vẫn giữ chỗ được')
            reg_addr = calls(s, 'register_product')[-1].get('address') if calls(s, 'register_product') else None
            check(reg_addr == 'Số 12 Nguyễn Huệ, Quận 1, TP Hồ Chí Minh', f'lệnh giữ chỗ gửi đúng địa chỉ ({reg_addr!r})')
            ctx.close()
            # f) đơn đang Chờ nộp tiền: ô 03 "Giao đến" + Đổi địa chỉ; gợi ý "Dùng lại"; đổi → máy chủ ghi; đã khai nộp → không đổi được
            s = AddrV12(my_status=T.NEW); s.addr[T.ME] = 'Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng'; s.order_addr = 'Số 7 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội'
            ctx, page = open_page(browser, port, s, no_addr=True); T.login(page, T.ME); page.wait_for_timeout(1500)
            c3 = page.inner_text('#grap-card3-body')
            check('Giao đến: Số 7 Lý Thường Kiệt' in c3 and 'Đổi địa chỉ' in c3, f'ô 03: dòng Giao đến + nút Đổi địa chỉ ({c3[-90:]!r})')
            page.click('#grap-card3-body .addr-link-btn'); page.wait_for_timeout(500)
            st = page.evaluate("[document.getElementById('addr-province').value, document.getElementById('addr-input').value, document.getElementById('addr-modal-product').textContent, [...document.querySelectorAll('#addr-suggest .addr-chip')].map(b=>b.textContent)]")
            check(st[0] == 'Hà Nội' and st[1] == 'Số 7 Lý Thường Kiệt, Hoàn Kiếm' and 'Đổi địa chỉ cho đơn' in st[2], f'cửa sổ đổi địa chỉ đơn: điền sẵn địa chỉ của đơn ({st[:3]})')
            check(st[3] == ['Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng'], f'gợi ý "Dùng lại" = địa chỉ mặc định ({st[3]})')
            page.click('#addr-suggest .addr-chip'); page.wait_for_timeout(200)
            check(page.evaluate("document.getElementById('addr-province').value") == 'Hải Phòng', 'bấm gợi ý → điền tỉnh + chi tiết')
            check(page.evaluate("document.getElementById('addr-region-warn').hidden"), 'địa chỉ Hải Phòng + đơn kho AYA (cùng miền Bắc) → không cảnh báo')
            page.click('#addr-save-btn'); page.wait_for_timeout(2500)
            check(s.order_addr == 'Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng' and 'Số 1 Lê Lợi' in page.inner_text('#grap-card3-body'), 'đổi địa chỉ đơn → máy chủ ghi, ô 03 cập nhật')
            check(s.addr[T.ME] == 'Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng', 'đổi địa chỉ đơn không đổi địa chỉ mặc định')
            page.evaluate(f"openQuickPaymentModalForReg('{T.PID}-AYA-003')"); page.wait_for_timeout(600)
            check('trước khi khai nộp tiền' in page.inner_text('#quick-addr-note') and page.query_selector('#quick-addr-note .addr-link-btn'), 'cửa sổ nộp tiền: nút Đổi địa chỉ (chưa khai nộp)')
            ctx.close()
            s.order_paid = True
            ctx, page = open_page(browser, port, s, no_addr=True); T.login(page, T.ME); page.wait_for_timeout(1500)
            check('Đổi địa chỉ' not in page.inner_text('#grap-card3-body'), 'đã khai nộp: ô 03 không có nút Đổi địa chỉ')
            page.evaluate(f"openQuickPaymentModalForReg('{T.PID}-AYA-003')"); page.wait_for_timeout(600)
            check('liên hệ trực tiếp PM phụ trách' in page.inner_text('#quick-addr-note'), 'đã khai nộp: bước nộp tiền ghi liên hệ PM')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            # g) PM: nhãn Khác miền kho / Đã đổi địa chỉ
            s = Mock(); r1 = reg(4, 'Chờ nộp tiền', 1000000); r1['address'] = 'Số 5 Lê Lợi, Quận 1, TP Hồ Chí Minh'; r1['note'] = 'Nhân viên đổi địa chỉ lúc 12/10/2026 09:00:00 (cũ: x)'
            r2 = reg(5, 'Chờ nộp tiền', 1000000); r2['address'] = 'Số 2 Lạch Tray, Ngô Quyền, Hải Phòng'; s.pm_regs = [r1, r2]
            ctx, page = open_page(browser, port, s); T.login(page, T.PM); page.evaluate('loadPMDashboardData()'); page.wait_for_timeout(2500)
            fl = page.evaluate("[...document.querySelectorAll('#pm-reg-tbody tr')].map(tr => [...tr.querySelectorAll('.pm-addr-flag')].map(x => x.textContent))")
            check(fl == [['Khác miền kho', 'Đã đổi địa chỉ'], []] or sorted(map(tuple, fl)) == sorted([('Khác miền kho', 'Đã đổi địa chỉ'), ()]), f'PM: nhãn đúng đơn ({fl})')
            ctx.close()
            # h) EN + điện thoại
            s = AddrV12(my_status=None)
            ctx, page = open_page(browser, port, s, device=ip13, no_addr=True, extra_init="localStorage.setItem('lg_lang','en');"); T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(800)
            page.evaluate("setTimeout(() => openAddressModal({model: 'M1', kho: 'AYA'}), 0)"); page.wait_for_timeout(400)
            page.select_option('#addr-province', 'Cần Thơ'); page.fill('#addr-input', 'Số 3 Hòa Bình, Ninh Kiều'); page.wait_for_timeout(200)
            en = page.evaluate("[document.querySelector('label[for=addr-province]').textContent, document.getElementById('addr-province').options[0].text, document.querySelector('#addr-province optgroup').label, document.getElementById('addr-region-warn').textContent, document.getElementById('addr-input').placeholder]")
            check(en[0] == 'Province / City *' and en[1] == '— Choose province / city —' and en[2] == 'North' and en[3].startswith('Note: the address is in the South region, but the item is in warehouse AYA (North region)') and en[4].startswith('e.g.'), f'EN: {en}')
            r = page.evaluate("(() => { const c = document.querySelector('#addr-modal .modal-card').getBoundingClientRect(); return [Math.round(c.left), Math.round(c.right), innerWidth, document.documentElement.scrollWidth <= innerWidth + 1]; })()")
            check(r[0] >= 0 and r[1] <= r[2] and r[3], f'iPhone 13: cửa sổ địa chỉ vừa màn hình ({r})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('27. v2.12 người nhận hàng + nhân viên tự sửa SĐT (mặc định "Tôi là người nhận")')
            class RecvV12(Mock):   # giả lập Apps Script Version 12 (Code.gs v2.12)
                def __init__(self, **kw):
                    super().__init__(**kw); self.prof = {'address': '', 'receiverName': '', 'receiverPhone': '', 'phone': '0900001234'}; self.order = {'address': 'Số 7 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội', 'receiverName': '', 'receiverPhone': ''}
                def do_auth(self, d):
                    r = super().do_auth(d)
                    if r.get('ok'): r['user'].update(address=self.prof['address'], receiverName=self.prof['receiverName'], receiverPhone=self.prof['receiverPhone'], phone=self.prof['phone'])
                    return r
                def do_my_address(self, d): return dict(ok=True, **self.prof)
                def do_update_my_address(self, d):
                    self.prof.update(address=d['address'], receiverName=d.get('receiverName', ''), receiverPhone=d.get('receiverPhone', ''))
                    if d.get('phone'): self.prof['phone'] = d['phone']
                    return {'ok': True, 'address': d['address'], 'message': 'Đã lưu địa chỉ nhận hàng.'}
                def do_user_update_order_address(self, d):
                    self.order.update(address=d['address'], receiverName=d.get('receiverName', ''), receiverPhone=d.get('receiverPhone', ''))
                    return {'ok': True, 'address': d['address'], 'message': f"Đã đổi địa chỉ nhận hàng của đơn {d.get('slotId')}."}
                def do_lookup(self, d):
                    r = super().do_lookup(d)
                    for o in r['orders']: o.update(self.order)
                    return r
            calls = lambda s_, a: [c[1] for c in s_.calls if c[0] == a]
            ROW = "document.getElementById('delivery-addr-row').innerText"
            s = RecvV12(my_status=None); s.prof['address'] = 'Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng'
            ctx, page = open_page(browser, port, s, no_addr=True); T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(1200)
            check('Người nhận: Nhan Vien That · 0900001234 (bạn)' in page.evaluate(ROW), f"tab 2: mặc định người nhận = chính bạn ({page.evaluate(ROW)[:160]!r})")
            page.evaluate("setTimeout(() => openAddressModal(null), 0)"); page.wait_for_timeout(400)
            st = page.evaluate("[document.getElementById('addr-contact').hidden, document.getElementById('addr-self').checked, document.getElementById('addr-receiver').hidden, document.getElementById('addr-my-phone').value]")
            check(st == [False, True, True, '0900001234'], f'cửa sổ: có mục người nhận, mặc định "Tôi là người nhận", SĐT của bạn điền sẵn ({st})')
            page.uncheck('#addr-self'); page.wait_for_timeout(100)
            check(not page.evaluate("document.getElementById('addr-receiver').hidden"), 'bỏ tick → hiện Tên + SĐT người nhận')
            page.fill('#addr-recv-name', 'Trần Thị Bình'); page.fill('#addr-recv-phone', '12345'); page.click('#addr-save-btn'); page.wait_for_timeout(300)
            check('người nhận không hợp lệ' in page.inner_text('#addr-error') and not calls(s, 'update_my_address'), 'SĐT người nhận sai → báo lỗi, không lưu')
            page.fill('#addr-recv-phone', '+84 912 345 678'); page.fill('#addr-my-phone', '0988 777 666'); page.click('#addr-save-btn'); page.wait_for_timeout(1500)
            u = calls(s, 'update_my_address')[-1] if calls(s, 'update_my_address') else {}
            check(u.get('receiverName') == 'Trần Thị Bình' and u.get('receiverPhone') == '0912345678' and u.get('phone') == '0988777666', f'lưu lên Sheet: người nhận + SĐT mới chuẩn hóa ({u.get("receiverPhone")}, {u.get("phone")})')
            check('Người nhận: Trần Thị Bình · 0912345678' in page.evaluate(ROW), 'tab 2 hiện người nhận mới')
            aya = page.evaluate("currentProducts.find(p => p.kho === 'AYA' && p.status === 'Available').uniqueCode")
            page.evaluate(f"setTimeout(() => handleRegisterProduct('{aya}'), 0)"); page.wait_for_timeout(2500)
            rp = calls(s, 'register_product')[-1] if calls(s, 'register_product') else {}
            dlg = [x for x in page.dialogs if 'Xác nhận đăng ký' in x]
            check(rp.get('receiverName') == 'Trần Thị Bình' and rp.get('receiverPhone') == '0912345678' and rp.get('phone') == '0988777666', f'giữ chỗ gửi người nhận + SĐT mới ({rp.get("phone")})')
            check(dlg and 'Người nhận: Trần Thị Bình · 0912345678' in dlg[-1], 'hộp xác nhận giữ chỗ có dòng Người nhận')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            # đổi người nhận của đơn; ô 03 + bước nộp tiền hiện người nhận; ô SĐT "Nộp tiền ngay" chỉ đọc
            s = RecvV12(my_status=T.NEW); s.prof['address'] = 'Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng'; s.order.update(receiverName='Lê Văn Cường', receiverPhone='0903333444')
            ctx, page = open_page(browser, port, s, no_addr=True); T.login(page, T.ME); page.wait_for_timeout(1500)
            check('Người nhận: Lê Văn Cường · 0903333444' in page.inner_text('#grap-card3-body'), 'ô 03 hiện người nhận của đơn')
            page.click('#grap-card3-body .addr-link-btn'); page.wait_for_timeout(400)
            st = page.evaluate("[document.getElementById('addr-myphone-wrap').hidden, document.getElementById('addr-self').checked, document.getElementById('addr-recv-name').value]")
            check(st == [True, False, 'Lê Văn Cường'], f'đổi địa chỉ đơn: ẩn SĐT của bạn, điền sẵn người nhận của đơn ({st})')
            page.check('#addr-self'); page.click('#addr-save-btn'); page.wait_for_timeout(2000)
            check(s.order['receiverName'] == '' and 'Người nhận' not in page.inner_text('#grap-card3-body'), 'chuyển đơn sang tự nhận → máy chủ xóa người nhận, ô 03 cập nhật')
            page.evaluate(f"openQuickPaymentModalForReg('{T.PID}-AYA-003')"); page.wait_for_timeout(600)
            q = page.evaluate("[document.getElementById('quick-phone').readOnly, document.getElementById('quick-phone').value, document.getElementById('quick-phone-hint').hidden]")
            check(q == [True, '0900001234', False], f'"Nộp tiền ngay": ô SĐT chỉ đọc + hướng dẫn sửa ở tab 2 ({q})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            # máy chủ cũ (V11): không có mục người nhận; ô SĐT vẫn chỉ đọc, không hiện hướng dẫn
            s = Mock(my_status=T.NEW); ctx, page = open_page(browser, port, s); T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(800)
            page.evaluate("setTimeout(() => openAddressModal(null), 0)"); page.wait_for_timeout(300)
            check(page.evaluate("document.getElementById('addr-contact').hidden") and 'Người nhận' not in page.evaluate(ROW), 'máy chủ cũ: ẩn mục người nhận (không nhập mà không lưu được)')
            ctx.close()
            # PM: bảng + cửa sổ biên lai + Excel
            s = Mock(); r1 = reg(4, 'Đã khai nộp - chờ đối soát', 1000000); r1.update(address='Số 5 Lê Lợi, Hải Phòng', receiverName='Trần Thị Bình', receiverPhone='0912345678', receipt='https://drive.google.com/file/d/x/view'); s.pm_regs = [r1]
            ctx, page = open_page(browser, port, s); T.login(page, T.PM); page.evaluate('loadPMDashboardData()'); page.wait_for_timeout(2500)
            check('Người nhận: Trần Thị Bình · 0912345678' in page.inner_text('#pm-reg-tbody'), 'PM: bảng đơn hiện người nhận')
            page.evaluate("openPMReceiptModal(pmRegistrations[0].id)"); page.wait_for_timeout(500)
            check(page.evaluate("!document.getElementById('modal-receiver-row').hidden") and page.inner_text('#modal-receiver') == 'Trần Thị Bình · 0912345678', 'PM: cửa sổ biên lai hiện người nhận')
            xl = page.evaluate("(() => { let got = null; const o = window.downloadTableFile; window.downloadTableFile = (rows, n, opt) => { got = [rows[0], rows[1], opt.moneyCols]; }; try { exportRegistrationsCSV(); } finally { window.downloadTableFile = o; } return got; })()")
            check(xl and xl[0][13:15] == ['Người nhận hàng', 'SĐT người nhận'] and xl[1][13:15] == ['Trần Thị Bình', '0912345678'] and xl[0][xl[2][1]] == 'Số tiền đã nộp', f'Excel: 2 cột người nhận cạnh địa chỉ, cột tiền vẫn đúng ({xl and xl[0][12:16]}, {xl and xl[2]})')
            ctx.close()
            # v2.12.1: SĐT trong Sheet mất số 0 đầu (ô số) → web tự thêm lại, lưu không bị chặn
            s = RecvV12(my_status=None); s.prof.update(address='Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng', phone='912345678')
            ctx, page = open_page(browser, port, s, no_addr=True); T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(1000)
            check('0912345678 (bạn)' in page.evaluate(ROW), 'tab 2: SĐT thiếu 0 hiện đủ "0912345678"')
            page.evaluate("setTimeout(() => openAddressModal(null), 0)"); page.wait_for_timeout(300)
            check(page.input_value('#addr-my-phone') == '0912345678', 'cửa sổ: ô SĐT của bạn điền sẵn "0912345678"')
            page.click('#addr-save-btn'); page.wait_for_timeout(1200)
            u = calls(s, 'update_my_address')[-1] if calls(s, 'update_my_address') else {}
            check(u.get('phone') == '0912345678' and page.evaluate("document.getElementById('addr-error').hidden"), f"lưu được, gửi SĐT đủ 0 ({u.get('phone')})")
            ctx.close()
            # v2.12.2: HR không có SĐT — đã có địa chỉ nhưng chưa có SĐT → giữ chỗ phải hỏi SĐT trước
            s = RecvV12(my_status=None); s.prof.update(address='Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng', phone='')
            ctx, page = open_page(browser, port, s, no_addr=True); T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(1200)
            check('Chưa có số điện thoại' in page.evaluate(ROW), 'tab 2: nhắc "Chưa có số điện thoại — bấm Sửa để thêm"')
            aya = page.evaluate("currentProducts.find(p => p.kho === 'AYA' && p.status === 'Available').uniqueCode")
            page.evaluate(f"setTimeout(() => handleRegisterProduct('{aya}'), 0)"); page.wait_for_timeout(800)
            st = page.evaluate("[document.getElementById('addr-modal').classList.contains('active'), document.getElementById('addr-error').hidden, document.getElementById('addr-error').textContent, document.activeElement && document.activeElement.id]")
            check(st[0] and not st[1] and 'để PM liên hệ giao hàng' in st[2] and st[3] == 'addr-my-phone' and not calls(s, 'register_product'), f'giữ chỗ khi chưa có SĐT → mở cửa sổ, nhắc nhập SĐT, con trỏ ở ô SĐT, chưa gửi giữ chỗ ({st})')
            page.fill('#addr-my-phone', '0977 111 222'); page.click('#addr-save-btn'); page.wait_for_timeout(2500)
            rp = calls(s, 'register_product')[-1] if calls(s, 'register_product') else {}
            check(rp.get('phone') == '0977111222' and s.prof['phone'] == '0977111222', f"nhập SĐT → lưu lên Sheet + giữ chỗ kèm SĐT ({rp.get('phone')})")
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            # EN + iPhone
            s = RecvV12(my_status=None); s.prof['address'] = 'Số 1 Lê Lợi, phường Ngô Quyền, Hải Phòng'
            ctx, page = open_page(browser, port, s, device=ip13, no_addr=True, extra_init="localStorage.setItem('lg_lang','en');"); T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(800)
            page.evaluate("setTimeout(() => openAddressModal(null), 0)"); page.wait_for_timeout(300); page.uncheck('#addr-self'); page.wait_for_timeout(100)
            en = page.evaluate("[document.querySelector('label[for=addr-my-phone]').textContent, document.querySelector('.addr-self span').textContent, document.querySelector('label[for=addr-recv-name]').textContent, document.getElementById('addr-recv-name').placeholder]")
            check(en == ['Your phone number *', 'I will receive the item', "Recipient's name *", 'e.g. Tran Thi Binh'], f'EN: {en}')
            r = page.evaluate("(() => { const c = document.querySelector('#addr-modal .modal-card'); const b = c.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), innerWidth, document.documentElement.scrollWidth <= innerWidth + 1, c.scrollHeight > c.clientHeight ? getComputedStyle(c).overflowY : 'fits']; })()")
            check(r[0] >= 0 and r[1] <= r[2] and r[3] and r[4] in ('auto', 'scroll', 'fits'), f'iPhone 13: cửa sổ vừa màn hình, cuộn được khi dài ({r})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('28. v2.13 thứ tự tab của nhân viên: Danh mục → Nộp tiền → Chi tiết → Thông báo (vào thẳng Danh mục)')
            VIS = """() => [...document.querySelectorAll('#main-nav-tabs .tab-btn')].filter(b => b.offsetParent)
                .map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left), b.id, b.innerText.replace(/\\s+/g, ' ').trim()]; })
                .sort((a, b) => a[0] - b[0] || a[1] - b[1])"""
            for dev_name, dev, lang in (('máy tính', None, ''), ('iPhone 13', ip13, ''), ('máy tính EN', None, 'en')):
                s = Mock(my_status=T.NEW)
                ctx, page = open_page(browser, port, s, device=dev, extra_init=("localStorage.setItem('lg_lang','en');" if lang else ''))
                T.login(page, T.ME)
                v = page.evaluate(VIS); ids = [x[2] for x in v]
                check(ids == ['tab2-btn', 'tab3-btn', 'tab4-btn', 'tab1-btn'], f'{dev_name}: thứ tự hiển thị {ids}')
                labels = [x[3].split(' ')[0] for x in v]
                check(labels == ['1.', '2.', '3.', '4.'], f'{dev_name}: đánh số 1–4 theo thứ tự ({[x[3][:28] for x in v]})')
                check(page.evaluate("document.querySelector('.tab-content.active').id") == 'tab2' and page.evaluate("document.getElementById('tab2-btn').classList.contains('active')"), f'{dev_name}: đăng nhập xong mở thẳng Danh mục')
                if lang:
                    check([x[3][:21] for x in v] == ['1. Catalog & Register', '2. Confirm & Pay 1 or', '3. Product Details Ex', '4. Notice & Rules Rul'] or all(l.startswith(n) for l, n in zip([x[3] for x in v], ['1. Catalog', '2. Confirm', '3. Product', '4. Notice'])), f'EN: nhãn {[x[3][:22] for x in v]}')
                if dev:
                    rows = sorted(set(x[0] for x in v))
                    check(len(rows) == 2 and [x[2] for x in v if x[0] == rows[0]] == ['tab2-btn', 'tab3-btn'], f'iPhone: lưới 2×2, hàng đầu = Danh mục + Nộp tiền ({v})')
                check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
                ctx.close()
            # điều hướng giữa các tab vẫn đúng (trước có code chọn nút theo vị trí [1], [2])
            s = Mock(my_status=T.NEW); ctx, page = open_page(browser, port, s); T.login(page, T.ME)
            page.evaluate("switchTab('tab1', document.getElementById('tab1-btn'))"); page.wait_for_timeout(300)
            page.evaluate("goToPortal()"); page.wait_for_timeout(500)
            check(page.evaluate("[document.querySelector('.tab-content.active').id, document.querySelector('.tab-btn.active').id]") == ['tab2', 'tab2-btn'], 'goToPortal → Danh mục, đúng nút sáng')
            page.evaluate("switchTab('tab1', document.getElementById('tab1-btn'))"); page.wait_for_timeout(300)
            hero = page.evaluate("[...document.querySelectorAll('#tab1 button')].find(b => /Tab 1/.test(b.textContent))")
            check(page.evaluate("!![...document.querySelectorAll('#tab1 button')].find(b => /Khám Phá Danh Mục & Mua Hàng Ngay \\(Tab 1\\)/.test(b.textContent))"), 'tab Thông báo: nút "Khám Phá Danh Mục… (Tab 1)"')
            check(page.evaluate("TOURS.employee[0].tabId === 'tab2' && TOURS.employee[3].tabId === 'tab2'"), 'hướng dẫn nhanh: bước 1 và 4 ở lại Danh mục')
            order = page.evaluate("(() => { const out = []; document.getElementById('tab2-btn').focus(); for (let i = 0; i < 3; i++) { const b = [...document.querySelectorAll('#main-nav-tabs .tab-btn')].filter(x => x.offsetParent); const k = b.indexOf(document.activeElement); b[k + 1].focus(); out.push(document.activeElement.id); } return out; })()")
            dom = page.evaluate("[...document.querySelectorAll('#main-nav-tabs .tab-btn')].filter(x => x.offsetParent).map(x => x.id)")
            check(dom == ['tab2-btn', 'tab3-btn', 'tab4-btn', 'tab1-btn'], f'thứ tự trong HTML (phím Tab / trình đọc màn hình) khớp thứ tự hiển thị ({dom})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            # PM: không đổi (1. Bảng điều khiển PM, 2. Bảng chi tiết)
            s = Mock(); ctx, page = open_page(browser, port, s); T.login(page, T.PM)
            v = page.evaluate(VIS)
            check([x[2] for x in v] == ['tab-pm-btn', 'tab4-btn'] and v[0][3].startswith('1. Bảng Điều Khiển PM') and v[1][3].startswith('2. Bảng Chi Tiết'), f'PM: giữ nguyên ({[x[3][:24] for x in v]})')
            check(page.evaluate("document.querySelector('.tab-content.active').id") == 'tab-pm', 'PM: vẫn mở Bảng điều khiển PM')
            ctx.close()

            print('29. v2.13.1 bộ lọc "Kho" trên điện thoại: lưới 2 cột (trước: 4 dòng trong khung bo 999 px = hình bầu dục); máy tính giữ nguyên')
            KHO = """() => { const k = document.querySelector('#tab2 .kho-filter-pills'), r = k.getBoundingClientRect(), cs = getComputedStyle(k);
                const bs = [...k.querySelectorAll('button')].map(b => { const x = b.getBoundingClientRect(); return [Math.round(x.top), Math.round(x.height), b.scrollWidth <= b.clientWidth + 1]; });
                return { disp: cs.display, radius: parseFloat(cs.borderRadius), w: Math.round(r.width), rows: new Set(bs.map(b => b[0])).size, minH: Math.min(...bs.map(b => b[1])),
                         fit: bs.every(b => b[2]), n: bs.length, noScroll: document.documentElement.scrollWidth <= innerWidth + 1 }; }"""
            for dev_name, dev, lang in (('iPhone SE 320', dict(p.devices['iPhone SE']), 'en'), ('iPhone 13', ip13, ''), ('máy tính 1440', None, '')):
                s = Mock(my_status=T.NEW)
                for i, p_ in enumerate(s.products): p_['kho'] = ['AYA', 'AYB', 'AYC'][i % 3]
                ctx, page = open_page(browser, port, s, device=dev, extra_init=("localStorage.setItem('lg_lang','en');" if lang else ''))
                T.login(page, T.ME); page.wait_for_timeout(600)
                k = page.evaluate(KHO)
                if dev:
                    check(k['n'] == 4 and k['disp'] == 'grid' and k['radius'] <= 24 and k['rows'] == 2 and k['minH'] >= 44 and k['fit'] and k['noScroll'],
                          f'{dev_name}: lưới 2 cột, 2 hàng nút, bo ≤ 24 px, nút ≥ 44 px, chữ không bị cắt, không tràn ngang ({k})')
                else:
                    check(k['disp'] == 'flex' and k['radius'] >= 999 and k['rows'] == 1, f'{dev_name}: giữ nguyên thanh 1 hàng bo tròn ({k})')
                page.evaluate("[...document.querySelectorAll('#tab2 .kho-filter-pills button')][2].click()"); page.wait_for_timeout(600)
                f = page.evaluate("[unifiedCatalogKho, [...document.querySelectorAll('#tab2 .lg-product-card')].length]")
                check(f[0] == 'AYB' and f[1] == sum(1 for p_ in s.products if p_['kho'] == 'AYB'), f'{dev_name}: bấm Kho AYB → chỉ hiện sản phẩm kho AYB ({f})')
                check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
                ctx.close()

            print('16. Máy tính 1440 px: mô tả hiện đủ, không có nút "Xem đủ"; bảng vẫn là bảng; cửa sổ nộp tiền như cũ')
            s = Mock(my_status=T.NEW)
            s.products[0]['description'] = 'Màn hình có 2 điểm chết góc trái, thùng rách, thiếu Magic Remote, viền trầy nặng, panel có vệt sáng mờ khi nền tối, cổng HDMI 2 lỏng, thiếu sách hướng dẫn, chân đế cong nhẹ'
            ctx, page = open_page(browser, port, s)
            T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(1500)
            d = page.evaluate("""() => { const c = document.querySelector('.lg-product-card'), d = c.querySelector('.lg-card-desc');
              return [c.querySelector('.lg-desc-more').hidden, d.scrollHeight <= d.clientHeight + 1, getComputedStyle(document.querySelector('.btn-view-mode')).display !== 'none'] }""")
            check(d == [True, True, True], f'nút Xem đủ ẩn, mô tả đủ, nút Dạng Thẻ/Bảng còn ({d})')
            page.evaluate("switchTab('tab4', document.getElementById('tab4-btn'))"); page.wait_for_timeout(1200)
            check(page.evaluate("getComputedStyle(document.querySelector('#tab4 .slot-table thead')).display !== 'none' && getComputedStyle(document.querySelector('#tab4 .slot-table td')).display === 'table-cell'"), 'tab 4: vẫn dạng bảng')
            page.evaluate(f"openQuickPaymentModalForReg('{T.PID}-AYA-003')"); page.wait_for_timeout(1200)
            w = page.evaluate("Math.round(document.querySelector('#quick-payment-modal .modal-card').getBoundingClientRect().width)")
            check(w <= 680, f'cửa sổ nộp tiền rộng {w} px (≤ 680 như cũ)')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('11. Máy tính 1440 px: nút ☰ không hiện, đầu trang như cũ')
            ctx, page = open_page(browser, port, Mock())
            T.login(page, T.ME)
            st = page.evaluate("[getComputedStyle(document.querySelector('.btn-header-menu')).display, getComputedStyle(document.querySelector('#user-bar .btn-logout')).display]")
            check(st[0] == 'none' and st[1] != 'none', f'☰ ẩn, Đổi MK hiện ({st})')
            ctx.close()
            browser.close()
    finally:
        srv.shutdown()
        try: os.remove(os.path.join(ROOT, PROD))
        except OSError: pass
    print(f'\n{sum(results)}/{len(results)} checks passed')
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main()
