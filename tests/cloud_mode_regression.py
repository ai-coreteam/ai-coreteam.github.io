"""
Cloud-mode regression test — runs the REAL portal page against a MOCKED Apps Script.

Why this exists: tests/run_e2e_tests.js checks strings and copied logic; every browser test before
v1-hardening logged in with DEMO accounts, which never call the server. This test logs in as NON-demo
accounts, so it exercises the code path real employees and PMs use on go-live day.

No real Google Sheet / Apps Script is contacted: every request to script.google.com is answered by an
in-memory mock that follows the contract of apps-script/Code.gs (see tests/backend_gas_harness.js for
the real backend logic).

Run:   python3 tests/cloud_mode_regression.py
Needs: pip install playwright && python3 -m playwright install chromium
Exit:  0 = all checks pass, 1 = at least one check failed
"""
import copy
import functools
import http.server
import json
import os
import socketserver
import subprocess
import sys
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 'Mau_Dang_Ky_Internal_Sales_3009.html'
PROD_PAGE = '.portal_regression_test.html'   # temporary production build, deleted at the end
API = 'https://script.google.com/macros/s/MOCK/exec'
PID = 'IS-2026Q4-TV-01'
ME, PM, ADMIN = 'VH70001', 'VH70000', 'VH70009'   # deliberately NOT in DEMO_USERS
WAIT_GATE, NEW = 'Đã đăng ký - Chờ mở thanh toán', 'Chờ nộp tiền'


def product(seq, model, status, emp=''):
    return {'programId': PID, 'uniqueCode': f'{PID}-AYA-00{seq}', 'kho': 'AYA', 'category': 'TV',
            'model': model, 'description': model, 'rrp': 10000000, 'internalPrice': 5000000,
            'qty': 1, 'status': status, 'empCode': emp, 'timestamp': ''}


BASE_PRODUCTS = [
    product(1, 'MODEL-FREE', 'Available'),
    product(2, 'MODEL-TAKEN-BY-OTHER', 'Registered', 'VH70002'),
    product(3, 'MODEL-TAKEN-BY-ME', 'Registered', ME),
]


class MockServer:
    """Follows the request/response contract of Code.gs for the actions the page uses."""

    def __init__(self, products_delay_ms=0, my_status=WAIT_GATE, stale_products=None):
        self.products = copy.deepcopy(BASE_PRODUCTS)
        self.my_status = my_status
        self.products_delay_ms = products_delay_ms
        self.stale_products = stale_products   # what the products list SHOWS (may lag the real state)
        self.email_enabled = True
        self.calls = []
        self.products_calls = 0

    def taken(self):
        return [p['uniqueCode'] for p in self.products if p['status'] != 'Available']

    def handle(self, route):
        req = route.request
        if req.method == 'GET':
            if 'action=taken' in req.url:
                self.calls.append(('GET taken', {}))
                body = {'ok': True, 'programId': PID, 'taken': self.taken()}
            else:
                body = {'ok': True, 'service': 'mock'}
            return route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
        d = json.loads(req.post_data or '{}')
        a = d.get('action')
        self.calls.append((a, d))
        body = getattr(self, 'do_' + str(a), lambda d: {'ok': False, 'message': 'mock: unhandled ' + str(a)})(d)
        route.fulfill(status=200, content_type='application/json', body=json.dumps(body))

    def do_auth(self, d):
        users = {ME: ('Nhan Vien That', 'USER'), PM: ('PM That', 'PM'), ADMIN: ('Admin That', 'ADMIN')}
        if d.get('id') not in users:
            return {'ok': False, 'message': 'Mã nhân viên không tồn tại.'}
        name, role = users[d['id']]
        token = 'mock.admin' if role == 'ADMIN' else 'mock.sig'
        return {'ok': True, 'token': token, 'user': {'id': d['id'], 'name': name, 'dept': 'QA',
                'phone': '0900001234', 'email': 'x@example.com', 'role': role}}

    def do_programs(self, d):
        return {'ok': True, 'programs': [{'id': PID, 'name': 'Dot test', 'pmId': PM, 'pmName': 'PM That', 'status': 'Open',
                                          'startDate': '', 'endDate': '', 'description': '', 'maxPerEmployee': 1}]}

    def do_products(self, d):
        self.products_calls += 1
        if self.products_delay_ms and self.products_calls == 1:
            time.sleep(self.products_delay_ms / 1000)   # first call only: Apps Script cold start
        return {'ok': True, 'products': copy.deepcopy(self.stale_products or self.products)}

    def do_lookup(self, d):
        orders = []
        if self.my_status:
            orders.append({'programId': PID, 'slot': f'{PID}-AYA-003', 'model': 'MODEL-TAKEN-BY-ME', 'kho': 'AYA',
                           'status': self.my_status, 'amount': 5000000, 'price': 5000000, 'empCode': ME,
                           'empName': 'Nhan Vien That', 'time': '05/10/2026 09:00:00', 'paid': False, 'receipt': False})
        return {'ok': True, 'orders': orders}

    def do_register_product(self, d):
        p = next((x for x in self.products if x['uniqueCode'] == d.get('uniqueCode')), None)
        if not d.get('token'):
            return {'ok': False, 'authError': True, 'message': 'Thiếu token'}
        if p is None or p['status'] != 'Available':
            return {'ok': False, 'slotTaken': True, 'taken': self.taken(),
                    'message': f"Sản phẩm {d.get('uniqueCode')} đã có người đăng ký trước. Vui lòng chọn sản phẩm khác."}
        p['status'], p['empCode'] = 'Registered', d.get('empCode')
        return {'ok': True, 'message': 'Đăng ký thành công'}

    def do_user_cancel_registration(self, d):
        if d.get('token') != 'mock.sig':
            return {'ok': False, 'authError': True, 'message': 'Thiếu token'}
        if self.my_status not in (WAIT_GATE, NEW):
            return {'ok': False, 'message': 'Không thể tự hủy'}
        self.my_status = None
        for p in self.products:
            if p['uniqueCode'] == d.get('slotId'):
                p['status'], p['empCode'] = 'Available', ''
        return {'ok': True, 'message': f"Đã hủy giữ chỗ {d.get('slotId')}. Slot đã được trả về kho cho đồng nghiệp khác."}

    def do_email_setting(self, d):
        if d.get('token') != 'mock.admin':   # máy chủ thật: verifySessionToken_(token, 'ADMIN')
            return {'ok': False, 'message': 'Bạn không có quyền ADMIN để thực hiện thao tác này.'}
        if 'enabled' in d and d['enabled'] is not None:
            self.email_enabled = bool(d['enabled'])
            return {'ok': True, 'enabled': self.email_enabled, 'remainingDailyQuota': 97,
                    'message': 'Đã BẬT gửi email tự động.' if self.email_enabled else 'Đã TẮT gửi email tự động.'}
        return {'ok': True, 'enabled': self.email_enabled, 'remainingDailyQuota': 97}

    def do_pm_dashboard(self, d):
        return {'ok': True, 'registrations': []}


STATE_JS = """() => ({
  ui: (currentProducts || []).map(p => ({ code: p.uniqueCode, status: p.status })),
  card3: (document.getElementById('grap-brief-dashboard') || {}).innerText || '',
  loggedIn: !!currentUser
})"""


def open_page(browser, port, server, page_name=PAGE, set_api=True, extra_init=''):
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    init = "localStorage.setItem('lg_tour_completed_employee','true'); localStorage.setItem('lg_tour_completed_pm','true');" + extra_init
    if set_api:
        init += f"localStorage.setItem('LGE_PORTAL_API_URL', '{API}');"
    ctx.add_init_script(init)
    if server:
        ctx.route(API + '**', server.handle)
    page = ctx.new_page()
    page.errors = []
    page.on('pageerror', lambda e: page.errors.append(str(e)[:200]))
    page.on('dialog', lambda dlg: dlg.accept())
    page.goto(f'http://127.0.0.1:{port}/{page_name}' + os.environ.get('UI_QUERY', ''))   # UI_QUERY='?ui=v2' → chạy toàn bộ kịch bản với giao diện v2
    return ctx, page


def login(page, uid, pw='any-password', settle_ms=6000):
    page.fill('#login-id', uid)
    page.fill('#login-password', pw)
    page.click('#login-btn')
    page.wait_for_timeout(settle_ms)


def main():
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    results = []

    def check(ok, msg):
        results.append(bool(ok))
        print(('  PASS ' if ok else '  FAIL ') + msg)

    server_status = {x['uniqueCode']: x['status'] for x in BASE_PRODUCTS}
    my_code = f'{PID}-AYA-003'

    # Production build used by scenario 5
    build = subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'build_production.py'),
                            '--api-url', API, '--out', os.path.join(ROOT, PROD_PAGE)], capture_output=True, text=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()

            print('Scenario 1: nhân viên thật, máy chủ phản hồi nhanh')
            s = MockServer()
            ctx, page = open_page(browser, port, s)
            login(page, ME)
            st = page.evaluate(STATE_JS)
            ui = {x['code']: x['status'] for x in st['ui']}
            check(set(ui) == set(server_status), f'danh mục đúng các sản phẩm máy chủ ({len(ui)}/{len(server_status)})')
            for code, val in server_status.items():
                check(ui.get(code) == val, f'{code[-7:]}: giao diện "{ui.get(code)}" == máy chủ "{val}"')
            check('MODEL-TAKEN-BY-ME' in st['card3'], 'ô "03 Đơn Hàng Của Bạn" hiện đơn của tôi từ máy chủ')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('Scenario 2: lần tải sản phẩm đầu tiên mất 3,5 giây (Apps Script khởi động nguội)')
            s = MockServer(products_delay_ms=3500)
            ctx, page = open_page(browser, port, s)
            login(page, ME, settle_ms=15000)
            codes = {x['code'] for x in page.evaluate(STATE_JS)['ui']}
            check(codes == set(server_status), f'danh mục tự phục hồi về đúng sản phẩm máy chủ, không rỗng/không demo ({len(codes)})')
            ctx.close()

            print('Scenario 3: bấm vào slot màn hình còn ghi trống nhưng vừa có người giữ')
            stale = copy.deepcopy(BASE_PRODUCTS)
            stale[0]['status'] = 'Available'
            s = MockServer(stale_products=stale)
            s.products[0]['status'], s.products[0]['empCode'] = 'Registered', 'VH79999'
            ctx, page = open_page(browser, port, s)
            login(page, ME)
            # nhân viên này đã có 1 đơn → hủy trước để không bị chặn hạn mức 1 SP/NV ở phía giao diện
            s.my_status = None
            page.evaluate("myServerOrders = []")
            page.evaluate(f"takenProgramId = ''; currentProducts.forEach(p => {{ if (p.uniqueCode === '{PID}-AYA-001') p.status = 'Available'; }})")
            page.evaluate(f"handleRegisterProduct('{PID}-AYA-001')")
            page.wait_for_timeout(2500)
            ui = {x['code']: x['status'] for x in page.evaluate(STATE_JS)['ui']}
            check(ui.get(f'{PID}-AYA-001') == 'Registered', 'bị từ chối → slot chuyển "Registered" NGAY, không chờ polling')
            reg_calls = [c for c in s.calls if c[0] == 'register_product']
            check(reg_calls and reg_calls[-1][1].get('token') == 'mock.sig', 'yêu cầu giữ chỗ có gửi token')
            ctx.close()

            print('Scenario 4: nhân viên tự hủy giữ chỗ (quy tắc: trước khi khai nộp)')
            s = MockServer(my_status=WAIT_GATE)
            ctx, page = open_page(browser, port, s)
            login(page, ME)
            check('Hủy giữ chỗ' in page.evaluate(STATE_JS)['card3'], 'ô 03 có nút "Hủy giữ chỗ"')
            page.evaluate(f"cancelUserRegistration('{my_code}')")
            page.wait_for_timeout(5000)
            cancel_calls = [c for c in s.calls if c[0] == 'user_cancel_registration']
            check(cancel_calls and cancel_calls[-1][1].get('token') == 'mock.sig', 'yêu cầu hủy tới máy chủ, có token')
            st = page.evaluate(STATE_JS)
            check('chưa đăng ký' in st['card3'], 'sau khi máy chủ xác nhận, ô 03 về "chưa đăng ký"')
            check({x['code']: x['status'] for x in st['ui']}.get(my_code) == 'Available', 'slot vừa hủy hiện "Available"')
            ctx.close()

            print('Scenario 5: bản production (portal.html) do scripts/build_production.py sinh ra')
            check(build.returncode == 0, f'build production thành công ({build.stdout.strip().splitlines()[0] if build.stdout else build.stdout + build.stderr})')
            s = MockServer()
            ctx, page = open_page(browser, port, s, page_name=PROD_PAGE, set_api=False)
            check(page.locator('.demo-accounts').count() == 0, 'không có khối nút đăng nhập demo')
            check(page.evaluate("SHEET_API_URL") == API, 'tự nối máy chủ, không cần cấu hình API trên trình duyệt')
            login(page, 'VH12345', 'test123', settle_ms=3000)
            check(not page.evaluate("!!currentUser"), 'tài khoản demo VH12345/test123 KHÔNG đăng nhập được')
            login(page, ME)
            st = page.evaluate(STATE_JS)
            check(st['loggedIn'] and len(st['ui']) == 3, 'nhân viên thật đăng nhập và thấy danh mục máy chủ')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('Scenario 6: công tắc email — chỉ ADMIN thấy & đổi được')
            s = MockServer()
            ctx, page = open_page(browser, port, s)
            login(page, PM)
            check(page.locator('#tab-pm-btn').is_visible(), 'PM vào được Bảng điều khiển PM (hồi quy)')
            check(not page.locator('#btn-email-switch').is_visible(), 'PM KHÔNG thấy công tắc email')
            check(not any(c[0] == 'email_setting' for c in s.calls), 'PM không gọi API email_setting')
            ctx.close()
            s = MockServer()
            ctx, page = open_page(browser, port, s)
            login(page, ADMIN)
            check(page.locator('#tab-pm-btn').is_visible(), 'ADMIN có toàn bộ giao diện PM')
            check('Admin hệ thống' in page.inner_text('#user-bar'), 'thanh người dùng ghi "Admin hệ thống"')
            check(page.locator('#btn-email-switch').is_visible(), 'ADMIN thấy công tắc email')
            check(page.inner_text('#email-switch-state').strip() == 'BẬT', 'công tắc hiển thị trạng thái máy chủ: BẬT')
            page.click('#btn-email-switch')
            page.wait_for_timeout(2500)
            check(page.inner_text('#email-switch-state').strip() == 'TẮT', 'bấm → TẮT, theo xác nhận của máy chủ')
            sets = [c for c in s.calls if c[0] == 'email_setting' and c[1].get('enabled') is not None]
            check(sets and sets[-1][1].get('enabled') is False and sets[-1][1].get('token') == 'mock.admin', 'gửi enabled=false kèm token ADMIN')
            progs = [c for c in s.calls if c[0] == 'programs']
            check(progs and progs[-1][1].get('role') == 'ADMIN', 'ADMIN yêu cầu danh sách MỌI chương trình (role ADMIN)')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('Scenario 7: hồi quy chế độ Demo (không nối máy chủ)')
            ctx, page = open_page(browser, port, None, set_api=False)
            login(page, 'VH88921', 'test123', settle_ms=4000)
            st = page.evaluate(STATE_JS)
            check(st['loggedIn'] and len(st['ui']) > 0, f'tài khoản demo vẫn đăng nhập và thấy danh mục demo ({len(st["ui"])} SP)')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('Scenario 8: trình duyệt còn dữ liệu bản demo (cùng tên miền) mở portal.html — CURRENT_STATE mục 14')
            past = '2026-01-01T08:00'
            timer = {'enabled': True, 'datetime': past, 'executed': False}
            leftovers = (
                "localStorage.setItem('lg_demo_registrations', " + json.dumps(json.dumps([{
                    'id': 'REG-PHANTOM', 'programId': PID, 'slotId': PID + '-AYA-009', 'empCode': ME,
                    'empName': 'Demo', 'model': 'PHANTOM-DEMO', 'status': 'Đã duyệt thanh toán'}])) + ");"
                "localStorage.setItem('lg_program_timers_v1', " + json.dumps(json.dumps({PID: {
                    'open': timer, 'close': timer, 'payment': timer}})) + ");")
            s = MockServer(my_status=None)   # máy chủ: nhân viên CHƯA có đơn nào
            ctx, page = open_page(browser, port, s, page_name=PROD_PAGE, set_api=False, extra_init=leftovers)
            login(page, ME)
            page.wait_for_timeout(11000)       # qua 1 nhịp đồng bộ 10 giây
            check(page.evaluate("DEMO_REGISTRATIONS.length") == 0, 'portal.html không nạp đơn demo còn trong trình duyệt')
            page.evaluate("handleLookup()")
            page.wait_for_timeout(2500)
            check('PHANTOM-DEMO' not in page.inner_text('#lookup-result'), 'tra cứu Tab 3 KHÔNG hiện đơn ảo của bản demo')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            s = MockServer()
            ctx, page = open_page(browser, port, s, page_name=PROD_PAGE, set_api=False, extra_init=leftovers)
            login(page, PM)
            page.wait_for_timeout(4000)
            reads = {'auth', 'programs', 'products', 'lookup', 'pm_dashboard', 'email_setting', 'GET taken'}
            writes = sorted({c[0] for c in s.calls if c[0] not in reads})
            check(not writes, f'hẹn giờ cũ của bản demo KHÔNG chạy thao tác thật trên máy chủ ({writes})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('Scenario 9: ô 02 khi danh mục đang tải / chương trình trống — CURRENT_STATE mục 21')
            badge = "(document.getElementById('grap-avail-badge') || {}).textContent || ''"
            s = MockServer()   # máy chủ nguội: GIỮ câu trả lời danh mục, chỉ trả khi test cho phép (không chặn luồng test)
            held = []
            plain = s.handle
            def slow_products(route):
                if route.request.method == 'POST' and json.loads(route.request.post_data or '{}').get('action') == 'products' and not held:
                    held.append(route)
                    return
                plain(route)
            ctx, page = open_page(browser, port, None)
            ctx.route(API + '**', slow_products)
            login(page, ME, settle_ms=3000)
            early = page.evaluate(badge)
            check(len(held) == 1 and 'Đang tải' in early and 'Hết hàng' not in early,
                  f'đang tải: ô 02 ghi "Đang tải…", không ghi "Hết hàng" ({early!r})')
            if held:
                plain(held[0])   # máy chủ trả danh mục
            page.wait_for_timeout(4000)
            late = page.evaluate(badge)
            check(late.startswith('Còn '), f'tải xong: ô 02 ghi số SP còn lại ({late!r})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            s = MockServer(); s.products = []
            ctx, page = open_page(browser, port, s)
            login(page, ME)
            empty = page.evaluate(badge)
            check(empty == 'Chưa có sản phẩm', f'chương trình không có sản phẩm: ô 02 ghi "Chưa có sản phẩm" ({empty!r})')
            ctx.close()

            print('Scenario 10: không có chương trình nào mở — ô 02 ghi "Chưa có đợt bán"')
            s = MockServer()
            s.do_programs = lambda d: {'ok': True, 'programs': []}
            ctx, page = open_page(browser, port, s)
            login(page, ME)
            none = page.evaluate(badge)
            check(none == 'Chưa có đợt bán', f'0 chương trình: ô 02 ghi "Chưa có đợt bán" ({none!r})')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('Scenario 11: cửa sổ biên lai PM chỉ hiện biên lai THẬT — CURRENT_STATE mục 24')
            drive = 'https://drive.google.com/file/d/REAL_RECEIPT_ID/view?usp=drivesdk'
            png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
            def reg(i, receipt, txn=''):
                return {'id': f'REG-{i}', 'programId': PID, 'slotId': f'{PID}-AYA-00{i}', 'empCode': 'VH5000' + str(i), 'empName': 'NV',
                        'model': 'M', 'kho': 'AYA', 'status': 'Đã khai nộp - chờ đối soát', 'amount': 5000000, 'internalPrice': 5000000,
                        'bankTxn': txn, 'payerName': 'NV', 'payerCode': 'VH5000' + str(i), 'receipt': receipt, 'timestamp': '05/10/2026 10:00:00'}
            s = MockServer()
            s.do_pm_dashboard = lambda d: {'ok': True, 'registrations': [reg(1, drive), reg(2, ''), dict(reg(3, ''), receiptUrl=png)]}
            ctx, page = open_page(browser, port, s)
            login(page, PM)
            view = '''() => { const i = document.getElementById('modal-receipt-img'), n = document.getElementById('modal-receipt-note'),
                       a = document.getElementById('modal-receipt-link');
                       return { src: decodeURIComponent(i.getAttribute('src') || ''), imgShown: i.style.display !== 'none',
                                note: n && n.style.display !== 'none' ? n.innerText : '', href: a ? a.getAttribute('href') : '' }; }'''
            def fake(v):
                return any(t in (v['src'] + v['note']) for t in ('Giao dịch thành công', 'FT24098912389', 'XÁC NHẬN CHUYỂN TIỀN'))
            page.evaluate("openPMReceiptModal('REG-1')"); v1 = page.evaluate(view)
            check(not fake(v1) and v1['href'] == drive and not v1['imgShown'], f'biên lai trên Drive → nút mở biên lai thật, không có hình giả ({v1["note"][:40]!r})')
            page.evaluate("closeReceiptModal(); openPMReceiptModal('REG-2')"); v2 = page.evaluate(view)
            check(not fake(v2) and 'Chưa có ảnh biên lai' in v2['note'] and not v2['href'], 'không có biên lai → "Chưa có ảnh biên lai", không có hình giả / mã GD bịa')
            page.evaluate("closeReceiptModal(); openPMReceiptModal('REG-3')"); v3 = page.evaluate(view)
            check(v3['imgShown'] and v3['src'] == png and not v3['note'], 'ảnh biên lai thật (vừa tải lên) → hiện đúng ảnh đó')
            check(page.evaluate("getComputedStyle(document.getElementById('modal-btn-approve')).display") != 'none', 'nút Duyệt giữ nguyên (không đổi quy trình duyệt)')
            page.evaluate("closeReceiptModal(); openReceiptModal('Biên Lai Nộp Tiền X', 'NV (VH1)', '5000000', '', '', 'NO-SUCH-SLOT')"); v4 = page.evaluate(view)
            check(not fake(v4) and 'Chưa có ảnh biên lai' in v4['note'], 'cửa sổ biên lai thứ hai (bảng xác nhận) cũng không vẽ hình giả')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('Scenario 12: Hướng dẫn tự mở lần đầu — khung đỏ bước 1 khớp thanh chương trình sau khi danh sách về')
            def tour_fit(role_id):
                s = MockServer()
                held = []
                plain = s.handle
                def slow_programs(route):
                    if route.request.method == 'POST' and json.loads(route.request.post_data or '{}').get('action') == 'programs' and not held:
                        held.append(route)
                        return
                    plain(route)
                first_time = "localStorage.removeItem('lg_tour_completed_employee'); localStorage.removeItem('lg_tour_completed_pm');"
                ctx, page = open_page(browser, port, None, extra_init=first_time)
                ctx.route(API + '**', slow_programs)
                login(page, role_id, settle_ms=3000)          # tour tự mở sau 0,8 giây, danh sách chương trình chưa về
                started = page.evaluate("isTourActive && currentTourStepIndex === 0")
                if held:
                    plain(held[0])                             # máy chủ trả danh sách chương trình
                page.wait_for_timeout(2500)
                gap = page.evaluate('''() => {
                    const step = TOURS[currentTourRole][0], t = findTourTargetElement(step.targetSelector), h = document.getElementById('lg-tour-hole');
                    if (!t || !h) return 999;
                    const a = t.getBoundingClientRect(), b = h.getBoundingClientRect();
                    return Math.max(Math.abs((a.top - 8) - b.top), Math.abs((a.height + 16) - b.height)); }''')
                errs = page.errors[:2]
                ctx.close()
                return started, len(held) == 1, gap, errs
            for label, uid in (('Nhân viên', ME), ('PM', PM), ('ADMIN', ADMIN)):
                started, held_ok, gap, errs = tour_fit(uid)
                check(started and held_ok and gap <= 2, f'{label}: khung đỏ bước 1 khớp thanh chương trình (lệch {gap:.0f}px)')
                check(not errs, f'{label}: không có lỗi JS ({errs})')

            print('Scenario 13: máy chủ khởi động nguội — đăng nhập chờ được tới 15 giây (CURRENT_STATE mục 30)')
            s = MockServer()
            held = []
            plain = s.handle
            def slow_auth(route):
                if route.request.method == 'POST' and json.loads(route.request.post_data or '{}').get('action') == 'auth' and not held:
                    held.append(route)
                    return
                plain(route)
            ctx, page = open_page(browser, port, None)
            ctx.route(API + '**', slow_auth)
            page.fill('#login-id', ME); page.fill('#login-password', 'any-password'); page.click('#login-btn')
            page.wait_for_timeout(13500)                     # quá mốc 12 giây cũ
            mid_err = page.evaluate("document.getElementById('login-error').classList.contains('show')")
            mid_btn = page.inner_text('#login-btn')
            check(not mid_err and 'khởi động' in mid_btn, f'sau 13,5 giây: chưa báo lỗi, nút báo đang chờ máy chủ ({mid_btn!r})')
            if held:
                try:
                    plain(held[0])                           # máy chủ trả lời ở giây ~14
                except Exception:
                    pass
            page.wait_for_timeout(4000)
            check(page.evaluate("!!currentUser"), 'máy chủ trả lời sau 14 giây → đăng nhập thành công')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()

            print('Scenario 14: UI v2 GĐ1 — công tắc, font LG EI, không tô đậm giả (design/UI_V2_DIRECTION_PROPOSAL.md)')
            RUNS = '''() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().width &&
                        [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))'''
            arial = RUNS + ".filter(e => getComputedStyle(e).fontFamily.startsWith('Arial')).length"
            faux = RUNS + ".filter(e => { const s = getComputedStyle(e); return s.fontFamily.includes('Headline') && +s.fontWeight > 600 && s.fontSynthesisWeight !== 'none'; }).length"
            for q, label in (('', 'mặc định'), ('?ui=v2', '?ui=v2'), ('?ui=v1', '?ui=v1')):
                ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
                ctx.add_init_script("localStorage.setItem('lg_tour_completed_employee','true');localStorage.setItem('lg_tour_completed_pm','true');")
                page = ctx.new_page(); page.errors = []; page.on('pageerror', lambda e: page.errors.append(str(e)[:200]))
                page.goto(f'http://127.0.0.1:{port}/{PAGE}{q}'); page.wait_for_timeout(800)
                on = page.evaluate("document.documentElement.classList.contains('ui-v2')")
                if q == '?ui=v2':
                    login(page, 'VH12345', 'test123', settle_ms=3000)
                    page.evaluate("document.getElementById('tab-pm-btn').click()"); page.wait_for_timeout(1000)
                    check(on, '?ui=v2 → bật lớp giao diện v2')
                    check(page.evaluate(arial) == 0, f'v2: không còn chữ Arial ({page.evaluate(arial)})')
                    check(page.evaluate(faux) == 0, f'v2: không tô đậm giả LG EI Headline ({page.evaluate(faux)})')
                    p2 = page.evaluate('''() => {
                        const bodyBg = getComputedStyle(document.body).backgroundColor, nav = document.querySelector('.nav-tabs'), bar = document.querySelector('#program-tab-bar');
                        const small = [...document.querySelectorAll('.top-header *, #program-tab-bar *, .nav-tabs *')].filter(e => e.getBoundingClientRect().width &&
                              [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 14).length;
                        return { trackVisible: getComputedStyle(bar).backgroundColor !== bodyBg, navHidden: nav.scrollWidth > nav.clientWidth + 1,
                                 barHidden: bar.scrollWidth > bar.clientWidth + 1, small }; }''')
                    check(p2['trackVisible'], 'v2 GĐ2: thanh chọn chương trình phân biệt được với nền trang')
                    check(not p2['navHidden'] and not p2['barHidden'], 'v2 GĐ2: desktop không giấu tab / chương trình nào')
                    check(p2['small'] == 0, f"v2 GĐ2: chữ header / thanh chọn ≥ 14 px ({p2['small']} chỗ nhỏ hơn)")
                    check(not page.errors, f'v2: không có lỗi JS ({page.errors[:2]})')
                else:
                    check(not on, f'{label} → giao diện v1.4 (không có class ui-v2)')
                ctx.close()

            print('Scenario 15: link xem tính năng model (v2) — LG.com nếu có, Google nếu không; không ảnh hưởng đăng ký')
            def links_view(q, view='cards'):
                s = MockServer()
                s.products = [product(1, '55QNED80ASA.ATV', 'Available'), product(2, 'DVH09B', 'Available')]
                ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
                ctx.add_init_script("localStorage.setItem('lg_tour_completed_employee','true');" + f"localStorage.setItem('LGE_PORTAL_API_URL', '{API}');")
                ctx.route(API + '**', s.handle)
                page = ctx.new_page(); page.errors = []; page.on('pageerror', lambda e: page.errors.append(str(e)[:200]))
                page.goto(f'http://127.0.0.1:{port}/{PAGE}{q}')
                login(page, ME)
                page.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); page.wait_for_timeout(1500)
                if view == 'table':
                    page.evaluate("setUnifiedViewMode('table')"); page.wait_for_timeout(600)
                links = page.evaluate('''() => [...document.querySelectorAll('.lg-card-info-link')].filter(a => a.getBoundingClientRect().width)
                                           .map(a => ({m: a.dataset.model, href: a.href, t: a.textContent.trim(), blank: a.target === '_blank', rel: a.rel}))''')
                note = page.evaluate("!!document.querySelector('.lg-ext-note')")
                return ctx, page, s, links, note
            ctx, page, s, links, note = links_view('?ui=v2')
            by = {l['m']: l for l in links}
            q = by.get('55QNED80ASA.ATV', {}); d = by.get('DVH09B', {})
            check(q.get('href') == 'https://www.lg.com/vn/tv-va-loa-thanh/qned/55qned80asa/' and q.get('t') == 'Xem trên LG.com ↗',
                  f"model có trên LG.com (bỏ hậu tố .ATV) → trang sản phẩm chính thức ({q.get('href')})")
            check(d.get('href', '').startswith('https://www.google.com/search?q=LG%20DVH09B') and d.get('t') == 'Tìm thông tin model ↗',
                  f"model không có trên LG.com → tìm Google ({d.get('href')})")
            check(all(l['blank'] and 'noopener' in l['rel'] for l in links) and len(links) == 2, 'link mở tab mới, rel=noopener')
            check(note, 'có dòng lưu ý: giá/quà tặng LG.com không áp dụng cho bán nội bộ')
            page.evaluate("document.querySelectorAll('.lg-card-info-link').forEach(a => a.addEventListener('click', e => e.preventDefault()))")
            page.click('.lg-card-info-link >> nth=0'); page.wait_for_timeout(800)
            check(not any(c[0] == 'register_product' for c in s.calls), 'bấm link KHÔNG gửi đăng ký giữ chỗ')
            check(not page.errors, f'không có lỗi JS ({page.errors[:2]})')
            ctx.close()
            ctx, page, s, links, note = links_view('?ui=v2', 'table')
            check(len(links) == 2, f'dạng Bảng cũng có link ({len(links)})')
            ctx.close()
            ctx, page, s, links, note = links_view('')
            check(not links and not note, 'tắt v2 → không có link / lưu ý (giữ nguyên v1.4)')
            ctx.close()

            browser.close()
    finally:
        srv.shutdown()
        try:
            os.remove(os.path.join(ROOT, PROD_PAGE))
        except OSError:
            pass

    passed = sum(results)
    print(f'\n{passed}/{len(results)} checks passed')
    sys.exit(0 if passed == len(results) else 1)


if __name__ == '__main__':
    main()
