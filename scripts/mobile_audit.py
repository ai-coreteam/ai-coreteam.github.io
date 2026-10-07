"""Giả lập điện thoại (v3): chụp các màn hình chính (Nhân viên + PM) và đo số liệu UX — xem design/UI_V3_MOBILE_AUDIT.md.
Dùng máy chủ giả + file data/Mau_Test_50_Slot_TV_Internal_Sales.xlsx (không đụng máy chủ thật).
    python3 scripts/mobile_audit.py "iPhone 13"     # hoặc "Galaxy S8"  → design/v3/mobile_audit/<máy>_*.png + _metrics.json
"""
import sys, os, json, functools, http.server, socketserver, threading, copy, openpyxl
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tests')); os.chdir(ROOT)
import cloud_mode_regression as T
from playwright.sync_api import sync_playwright
OUT = os.path.join(ROOT, 'design/v3/mobile_audit'); DEV = sys.argv[1] if len(sys.argv) > 1 else 'iPhone 13'
TAG = {'iPhone 13': 'ip13', 'Galaxy S8': 's8'}[DEV]

# 50 slot TV từ file mẫu → danh mục máy chủ giả
ws = openpyxl.load_workbook('data/Mau_Test_50_Slot_TV_Internal_Sales.xlsx').active
seq, PRODUCTS = {}, []
for r in ws.iter_rows(min_row=2, values_only=True):
    kho, _, model, sn, cat, price, rrp, desc = r[:8]
    seq[kho] = seq.get(kho, 0) + 1
    PRODUCTS.append({'programId': T.PID, 'uniqueCode': f'{T.PID}-{kho}-{seq[kho]:03d}', 'kho': kho, 'category': cat, 'model': model,
                     'description': desc, 'rrp': rrp, 'internalPrice': price, 'qty': 1, 'status': 'Available', 'empCode': '', 'timestamp': '', 'serial': sn})
MY = next(p for p in PRODUCTS if p['uniqueCode'] == f'{T.PID}-AYA-003')
MY.update(status='Registered', empCode=T.ME)
for p in PRODUCTS[5:14:2]: p.update(status='Registered', empCode='VH70002')

class Mock(T.MockServer):
    def __init__(self):
        super().__init__(my_status=T.NEW); self.products = copy.deepcopy(PRODUCTS)
        self.pm_regs = [{'id': f'REG-{i}', 'programId': T.PID, 'slotId': p['uniqueCode'], 'kho': p['kho'], 'model': p['model'], 'serial': p['serial'],
                         'empCode': p['empCode'] or T.ME, 'empName': 'Nguyen Van ' + str(i), 'division': 'Channel Development', 'phone': '0900001234',
                         'status': ['Đã khai nộp - chờ đối soát', 'Chờ nộp tiền', 'Đã đăng ký - Chờ mở thanh toán'][i % 3],
                         'internalPrice': p['internalPrice'], 'amount': p['internalPrice'], 'bankTxn': 'VCB FT2410' + str(i) if i % 3 == 0 else '',
                         'payTime': '07/10/2026 10:1' + str(i % 10) + ':00' if i % 3 == 0 else '', 'receipt': 'https://drive.google.com/file/d/x/view' if i % 3 == 0 else '',
                         'timestamp': '2026-10-07T0' + str(i % 9) + ':15:00.000Z'} for i, p in enumerate([p for p in PRODUCTS if p['status'] == 'Registered'])]
    def do_lookup(self, d):
        return {'ok': True, 'orders': [{'programId': T.PID, 'slot': MY['uniqueCode'], 'model': MY['model'], 'serial': MY['serial'], 'kho': 'AYA',
                'status': T.NEW, 'amount': MY['internalPrice'], 'price': MY['internalPrice'], 'empCode': T.ME, 'empName': 'Nhan Vien That',
                'time': '07/10/2026 09:00:00', 'paid': False, 'receipt': False}]}

AUDIT = r"""() => {
  const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > 0.05; };
  const label = e => (e.innerText || e.value || e.getAttribute('aria-label') || e.title || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const inView = e => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const taps = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [onclick], [role=button], summary')].filter(vis);
  const small = taps.filter(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 44; });
  const leaf = [...document.querySelectorAll('body *')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  const tiny = leaf.filter(e => parseFloat(getComputedStyle(e).fontSize) < 14);
  const inputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea')].filter(vis);
  const zoomIn = inputs.filter(e => parseFloat(getComputedStyle(e).fontSize) < 16);
  const hscroll = [...document.querySelectorAll('body *')].filter(e => vis(e) && e.scrollWidth > e.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(e).overflowX));
  const fixed = [...document.querySelectorAll('body *')].filter(e => vis(e) && /fixed|sticky/.test(getComputedStyle(e).position));
  return { vw: innerWidth, vh: innerHeight, pageScreens: +(document.documentElement.scrollHeight / innerHeight).toFixed(1),
    pageHScroll: document.documentElement.scrollWidth > innerWidth + 1,
    tapTotal: taps.length, tapSmall: small.length, tapSmallInView: small.filter(inView).map(e => label(e) + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height)).slice(0, 12),
    textTiny: tiny.length, textTinySample: [...new Set(tiny.filter(inView).map(e => Math.round(parseFloat(getComputedStyle(e).fontSize)) + 'px ' + e.textContent.trim().slice(0, 28)))].slice(0, 8),
    inputsZoom: zoomIn.length + '/' + inputs.length, inputsZoomSample: zoomIn.slice(0, 5).map(e => (e.id || e.name || e.tagName) + ' ' + getComputedStyle(e).fontSize),
    hScrollBoxes: hscroll.map(e => (e.id ? '#' + e.id : e.className.toString().split(' ')[0] || e.tagName) + ' ' + e.scrollWidth + '>' + e.clientWidth).slice(0, 6),
    fixed: fixed.map(e => (e.id ? '#' + e.id : (e.className.toString().split(' ')[0] || e.tagName)) + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height)).slice(0, 6) };
}"""

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/{T.PAGE}'
report = {}

def shot(pg, name, full=False):
    pg.wait_for_timeout(500)
    f = f'{OUT}/{TAG}_{name}.png'; pg.screenshot(path=f, full_page=full)
    report[name] = pg.evaluate(AUDIT); report[name]['file'] = os.path.basename(f)
    print(name, json.dumps({k: report[name][k] for k in ('pageScreens', 'tapSmall', 'textTiny', 'inputsZoom', 'pageHScroll')}))

def scroll_to(pg, sel, offset=0):
    pg.evaluate(f"(() => {{ const e = document.querySelector({json.dumps(sel)}); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 8 + {offset}); }})()"); pg.wait_for_timeout(400)

with sync_playwright() as p:
    b = p.chromium.launch(); dev = dict(p.devices[DEV]); dev['device_scale_factor'] = 2
    def ctx_for(server, first_visit=False):
        ctx = b.new_context(**dev)
        init = f"localStorage.setItem('LGE_PORTAL_API_URL', '{T.API}');"
        if not first_visit: init += "localStorage.setItem('lg_tour_completed_employee','true'); localStorage.setItem('lg_tour_completed_pm','true');"
        ctx.add_init_script(init); ctx.route(T.API + '**', server.handle)
        ctx.route('https://img.vietqr.io/**', lambda r: r.continue_())
        return ctx
    # ---------- NHÂN VIÊN ----------
    s = Mock(); ctx = ctx_for(s); pg = ctx.new_page(); pg.on('dialog', lambda d: d.accept())
    pg.goto(BASE); pg.wait_for_timeout(1200); shot(pg, 'u01_login')
    T.login(pg, T.ME); pg.evaluate('window.scrollTo(0,0)'); shot(pg, 'u02_after_login_top')
    scroll_to(pg, '.grap-section-header'); shot(pg, 'u03_dashboard_cards')
    scroll_to(pg, '#grap-card-context'); shot(pg, 'u04_card03_my_order')
    scroll_to(pg, '#main-nav-tabs'); shot(pg, 'u05_tabs_tab1')
    pg.evaluate("switchTab('tab2', document.getElementById('tab2-btn'))"); pg.wait_for_timeout(1500)
    scroll_to(pg, '#main-nav-tabs'); shot(pg, 'u06_tab2_top')
    scroll_to(pg, '.lg-product-card, .lg-card'); shot(pg, 'u07_tab2_product_cards')
    pg.screenshot(path=f'{OUT}/{TAG}_u08_tab2_fullpage.png', full_page=True); report['u08_tab2_fullpage'] = pg.evaluate(AUDIT)
    pg.evaluate("setUnifiedViewMode && setUnifiedViewMode('table')"); pg.wait_for_timeout(800); scroll_to(pg, '.product-table'); shot(pg, 'u09_tab2_table_view')
    pg.evaluate("setUnifiedViewMode && setUnifiedViewMode('cards')"); pg.wait_for_timeout(500)
    pg.evaluate(f"openQuickPaymentModalForReg('{MY['uniqueCode']}')"); pg.wait_for_timeout(1500); shot(pg, 'u10_quickpay_modal_top')
    pg.evaluate("document.querySelector('#quick-payment-modal .modal-card').scrollTop = 9999"); shot(pg, 'u11_quickpay_modal_bottom')
    pg.evaluate('closeQuickPaymentModal()')
    pg.evaluate("switchTab('tab3', document.getElementById('tab3-btn'))"); pg.wait_for_timeout(2500)
    scroll_to(pg, '#tab3'); shot(pg, 'u12_tab3_top')
    scroll_to(pg, '.btn-pay-open', -200); shot(pg, 'u13_tab3_lookup_table')
    pg.click('.btn-pay-open'); pg.wait_for_timeout(1800); scroll_to(pg, '#pay-unlocked-info'); shot(pg, 'u14_tab3_form_qr')
    scroll_to(pg, '#pay-amount', -60); shot(pg, 'u15_tab3_form_fields')
    pg.evaluate("switchTab('tab4', document.getElementById('tab4-btn'))"); pg.wait_for_timeout(1500)
    scroll_to(pg, '#tab4'); shot(pg, 'u16_tab4_table')
    ctx.close()
    # Tour lần đầu
    s = Mock(); ctx = ctx_for(s, first_visit=True); pg = ctx.new_page(); pg.on('dialog', lambda d: d.accept())
    pg.goto(BASE); pg.wait_for_timeout(800); T.login(pg, T.ME); pg.wait_for_timeout(1500); shot(pg, 'u17_first_visit_tour')
    ctx.close()
    # ---------- PM ----------
    s = Mock(); ctx = ctx_for(s); pg = ctx.new_page(); pg.on('dialog', lambda d: d.accept())
    pg.goto(BASE); pg.wait_for_timeout(800); T.login(pg, T.PM); pg.evaluate('loadPMDashboardData()'); pg.wait_for_timeout(2500)
    pg.evaluate('window.scrollTo(0,0)'); shot(pg, 'p01_pm_top')
    scroll_to(pg, '#tab-pm'); shot(pg, 'p02_pm_actions')
    scroll_to(pg, '.pm-kpi-grid, .pm-kpi-card'); shot(pg, 'p03_pm_kpis')
    scroll_to(pg, '#tab-pm table, .pm-table'); shot(pg, 'p04_pm_orders_table')
    pg.screenshot(path=f'{OUT}/{TAG}_p05_pm_fullpage.png', full_page=True); report['p05_pm_fullpage'] = pg.evaluate(AUDIT)
    ctx.close()
    b.close()
srv.shutdown()
json.dump(report, open(f'{OUT}/{TAG}_metrics.json', 'w'), ensure_ascii=False, indent=1)
print('xong', len(report), 'màn hình')
