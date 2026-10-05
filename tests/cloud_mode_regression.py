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


def open_page(browser, port, server, page_name=PAGE, set_api=True):
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    init = "localStorage.setItem('lg_tour_completed_employee','true'); localStorage.setItem('lg_tour_completed_pm','true');"
    if set_api:
        init += f"localStorage.setItem('LGE_PORTAL_API_URL', '{API}');"
    ctx.add_init_script(init)
    if server:
        ctx.route(API + '**', server.handle)
    page = ctx.new_page()
    page.errors = []
    page.on('pageerror', lambda e: page.errors.append(str(e)[:200]))
    page.on('dialog', lambda dlg: dlg.accept())
    page.goto(f'http://127.0.0.1:{port}/{page_name}')
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
