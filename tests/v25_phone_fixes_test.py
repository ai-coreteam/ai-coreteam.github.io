"""v2.5 (11/10/2026) — kiểm từng lỗi đã sửa + bố cục điện thoại. Chạy trang thật với máy chủ giả (không đụng máy chủ thật).
    python3 tests/v25_phone_fixes_test.py                     # bản nguồn hiện tại
    git show v2.4.1:Mau_Dang_Ky_Internal_Sales_3009.html > .v241_baseline.html
    PAGE=.v241_baseline.html python3 tests/v25_phone_fixes_test.py   # chạy trên bản cũ để thấy lỗi (tái hiện); xong thì xoá file tạm
    BROWSER=webkit python3 tests/v25_phone_fixes_test.py      # engine Safari (không có iPhone thật)
Mỗi kịch bản = 1 mục đã duyệt: token program_update, R1, R2, R3, B1–B4, C3, A1–A4, Q1, R4, R8 (v2.5.0);
12 = chờ máy chủ khi đổi trạng thái chương trình, 13 = thẻ sản phẩm gọn (v2.6.0).
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
                                          'startDate': '', 'endDate': '', 'description': '', 'maxPerEmployee': 1} for p in self.programs]}

    update_delay_s = 0      # v2.6: máy chủ chậm (khởi động nguội)
    update_fail = False     # v2.6: mất mạng → yêu cầu program_update bị hủy

    def handle(self, route):
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


def open_page(browser, port, server, page_name=None, device=None, extra_init='', query=''):
    opts = dict(device) if device else {'viewport': {'width': 1440, 'height': 900}}
    ctx = browser.new_context(**opts)
    ctx.add_init_script("localStorage.setItem('lg_tour_completed_employee','true'); localStorage.setItem('lg_tour_completed_pm','true');"
                        f"localStorage.setItem('LGE_PORTAL_API_URL', '{T.API}');" + extra_init)
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
            s.products[0]['description'] = 'Màn hình có 2 điểm chết góc trái, thùng rách, thiếu Magic Remote, viền trầy nặng, chân đế cong nhẹ'
            ctx, page = open_page(browser, port, s, device=ip13)
            T.login(page, T.ME)
            page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(1500)
            c = page.evaluate("""() => { const card = document.querySelector('.lg-product-card'); const q = s => card.querySelector(s).getBoundingClientRect();
              const desc = card.querySelector('.lg-card-desc');
              return { h: Math.round(card.getBoundingClientRect().height), vis: q('.lg-card-visual'), model: q('.lg-card-model'), btn: q('.lg-btn-buy'), cardW: card.clientWidth,
                       descFull: desc.scrollHeight <= desc.clientHeight + 1 && getComputedStyle(desc).webkitLineClamp === 'none', descText: desc.innerText }; }""")
            check(c['h'] <= 320, f"thẻ cao {c['h']} px (v2.5.0: 515 px)")
            check(c['vis']['width'] <= 64 and c['vis']['right'] <= c['model']['left'], f"biểu tượng 64 px nằm bên trái model ({round(c['vis']['width'])} px)")
            check(c['descFull'] and 'chân đế cong nhẹ' in c['descText'], 'mô tả tình trạng hiện ĐỦ, không bị cắt')
            check(c['btn']['height'] >= 44 and c['btn']['width'] >= c['cardW'] - 30, f"nút giữ chỗ cao {round(c['btn']['height'])} px, rộng gần hết thẻ")
            page.click('.lg-product-card >> nth=0 >> .lg-btn-buy'); page.wait_for_timeout(2500)
            regs = [x[1] for x in s.calls if x[0] == 'register_product']
            check(regs and regs[-1].get('uniqueCode') == f'{T.PID}-AYA-001', f"bấm nút trên thẻ → gửi giữ chỗ đúng slot ({regs[-1].get('uniqueCode') if regs else 'không gửi'})")
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
