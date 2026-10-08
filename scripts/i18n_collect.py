#!/usr/bin/env python3
"""
Thu thập chữ tiếng Việt CÒN HIỆN ở chế độ tiếng Anh (?lang=en) — dùng để dịch & nghiệm thu (design/I18N_EN_FEASIBILITY.md).

Chạy trang thật với máy chủ giả (không đụng máy chủ thật), đi qua đăng nhập, mọi trạng thái đơn của nhân viên, các tab,
các cửa sổ, hướng dẫn từng bước, các thao tác có hộp thoại, và màn hình PM / ADMIN. Ghi:
    design/i18n/missing_en.json   — {câu tiếng Việt: [các màn hình gặp]}
    python3 scripts/i18n_collect.py            # in số câu còn thiếu (mục tiêu: 0)
"""
import json, os, sys, functools, http.server, socketserver, threading
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tests')); os.chdir(ROOT)
import cloud_mode_regression as T
from playwright.sync_api import sync_playwright

PAID, OK, REJ = 'Đã khai nộp - chờ đối soát', 'Đã duyệt thanh toán', 'Từ chối'
import re
miss = {}
# Giống i18n.js: bỏ ký hiệu tiền "đ" sau số; tên người (dữ liệu, giữ nguyên) không tính là thiếu
VI = re.compile('[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]|\\b(Kho|kho|Tivi)\\b', re.I)
VI_ABBR = re.compile(r'\b(SP|NV)\b')   # viết tắt không dấu: sản phẩm, nhân viên (phân biệt hoa thường)
NAME = re.compile(r'^·\s+(Nguyễn Thị Quỳnh Như|Trần Văn Nam)$')
def has_vi(s): s = re.sub(r'\d[\d.,]*\s*đ', '', s); return bool(VI.search(s) or VI_ABBR.search(s))
CTX = {}
def note(screen, items):
    for k in items:
        if not NAME.match(k): miss.setdefault(k, set()).add(screen)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/{T.PAGE}?lang=en&i18n=debug'

def pm_regs():
    st = [T.WAIT_GATE, T.NEW, PAID, OK, REJ, 'Hết hạn giữ chỗ', 'Đã hủy bởi nhân viên']
    return [{'id': f'REG-{i}', 'programId': T.PID, 'slotId': f'{T.PID}-AYA-00{i}', 'kho': 'AYA', 'model': 'OLED55C5PSA', 'serial': '505INNG01013',
             'empCode': T.ME, 'empName': 'Nguyen Van A', 'division': 'QA', 'phone': '0900001234', 'address': 'Hai Phong', 'status': s,
             'internalPrice': 5000000, 'amount': 5000000, 'bankTxn': 'FT1' if s in (PAID, OK) else '', 'payTime': '07/10/2026 10:00:00' if s in (PAID, OK) else '',
             'receipt': 'https://drive.google.com/file/d/x/view' if s in (PAID, OK) else '', 'pmBy': 'PM' if s in (OK, REJ) else '', 'pmDate': '', 'note': '',
             'timestamp': '2026-10-07T02:00:00.000Z'} for i, s in enumerate(st, 1)]

with sync_playwright() as p:
    b = p.chromium.launch()
    def session(uid, status=T.NEW, tour=False, w=1440):
        s = T.MockServer(my_status=status); s.pm_regs = pm_regs()
        ctx = b.new_context(viewport={'width': w, 'height': 900})
        init = f"localStorage.setItem('LGE_PORTAL_API_URL','{T.API}');"
        if not tour: init += "localStorage.setItem('lg_tour_completed_employee','true');localStorage.setItem('lg_tour_completed_pm','true');"
        ctx.add_init_script(init); ctx.route(T.API + '**', s.handle)
        pg = ctx.new_page(); pg.dialogs = []
        pg.on('dialog', lambda d: (pg.dialogs.append(d.message), d.accept() if d.type != 'prompt' else d.accept('Lý do thử')))
        pg.goto(BASE); pg.wait_for_timeout(900)
        return ctx, pg, s
    def grab(pg, screen):
        pg.wait_for_timeout(350)
        note(screen, pg.evaluate("Array.from(window.__i18nMiss || [])"))
        CTX.update(pg.evaluate("window.__i18nCtx || {}"))
        pg.evaluate("window.__i18nMiss && window.__i18nMiss.clear()")
    def safe(pg, js):
        try: pg.evaluate(f"(() => {{ try {{ {js} }} catch (e) {{}} }})()"); pg.wait_for_timeout(500)
        except Exception: pass
    def close_modals(pg):
        safe(pg, "document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'))")

    # Đăng nhập: màn hình + sai mã NV
    ctx, pg, s = session(T.ME); grab(pg, 'login')
    pg.fill('#login-id', 'VH00000'); pg.fill('#login-password', 'x'); pg.click('#login-btn'); pg.wait_for_timeout(2500); grab(pg, 'login-error')
    ctx.close()

    # Nhân viên: từng trạng thái đơn
    for status in [T.WAIT_GATE, T.NEW, PAID, OK, None]:
        ctx, pg, s = session(T.ME, status); T.login(pg, T.ME); grab(pg, f'emp-dashboard[{status}]')
        for tab in ['tab1', 'tab2', 'tab3', 'tab4']:
            safe(pg, f"switchTab('{tab}', document.getElementById('{tab}-btn'))"); pg.wait_for_timeout(900); grab(pg, f'emp-{tab}[{status}]')
        if status == T.NEW:
            safe(pg, "document.querySelector('.btn-pay-open').click()"); grab(pg, 'tab3-pay-form')
            safe(pg, "document.querySelector('#payment-form button[type=submit]').click()"); grab(pg, 'tab3-submit-empty')
            safe(pg, "document.getElementById('status-filter').value='PENDING'; filterTable()"); grab(pg, 'tab3-filter')
            safe(pg, f"openQuickPaymentModalForReg('{T.PID}-AYA-003')"); grab(pg, 'quickpay')
            safe(pg, "document.getElementById('quick-submit-btn').click()"); grab(pg, 'quickpay-empty-submit'); close_modals(pg)
            safe(pg, "openTxnGuideModal()"); grab(pg, 'txn-guide'); close_modals(pg)
            safe(pg, "openFullLetterModal()"); grab(pg, 'letter'); close_modals(pg)
            safe(pg, "openChangePasswordModal()"); grab(pg, 'change-pw'); close_modals(pg)
            safe(pg, "openRegionalStatsModal('reg')"); grab(pg, 'regional-reg'); safe(pg, "openRegionalStatsModal('pay')"); grab(pg, 'regional-pay'); close_modals(pg)
            safe(pg, "openApiConfigModal()"); grab(pg, 'api-config'); close_modals(pg)
            safe(pg, "openSupportModal()"); grab(pg, 'support')
            safe(pg, "switchTab('tab2', document.getElementById('tab2-btn')); setUnifiedViewMode('table')"); grab(pg, 'tab2-table')
            safe(pg, "setUnifiedViewMode('cards')")
            safe(pg, "document.querySelector('.lg-card button:not([disabled]), .lg-product-card button:not([disabled])').click()"); pg.wait_for_timeout(1500); grab(pg, 'register-slot')
        if status in (T.WAIT_GATE, T.NEW):
            safe(pg, "document.querySelector('#grap-brief-dashboard [onclick*=\"cancel\" i], #grap-brief-dashboard [onclick*=\"Cancel\"]').click()"); pg.wait_for_timeout(1500); grab(pg, f'cancel[{status}]')
        note(f'dialogs[{status}]', [d for d in pg.dialogs if has_vi(d)])
        ctx.close()

    # Hướng dẫn lần đầu: nhân viên + PM, bấm qua từng bước
    for uid in [T.ME, T.PM]:
        ctx, pg, s = session(uid, tour=True); T.login(pg, uid); pg.wait_for_timeout(1500)
        for i in range(8):
            grab(pg, f'tour-{uid}-{i}')
            safe(pg, "const b=[...document.querySelectorAll('button')].find(x=>/Tiếp|Next|Hoàn tất|Finish|Done/i.test(x.textContent) && x.offsetParent); b && b.click()")
        ctx.close()

    # PM / ADMIN
    for uid in [T.PM, T.ADMIN]:
        ctx, pg, s = session(uid); T.login(pg, uid); safe(pg, 'loadPMDashboardData()'); pg.wait_for_timeout(1500); grab(pg, f'pm-dashboard[{uid}]')
        for mode in ['remaining', 'unpaid', 'all']:
            safe(pg, f"setPMViewMode && setPMViewMode('{mode}')"); safe(pg, f"switchPMView && switchPMView('{mode}')"); grab(pg, f'pm-{mode}')
        for fn in ['showCreateProgramModal()', 'openImportExcelModal()', 'openTimerSettingsModal()', "openPMReceiptModal('REG-3')", 'openApiConfigModal()', 'openChangePasswordModal()']:
            safe(pg, fn); grab(pg, f'pm-modal {fn}'); close_modals(pg)
        safe(pg, "switchTab('tab4', document.getElementById('tab4-btn'))"); grab(pg, 'pm-tab4'); safe(pg, "switchTab('tab-pm')")
        for btn in ['btn-allow-payment', 'btn-pm-batch-approve', 'btn-pm-expired-check']:
            safe(pg, f"const e=document.getElementById('{btn}'); e && e.click()"); pg.wait_for_timeout(1200); grab(pg, f'pm-action {btn}')
        safe(pg, "const e=[...document.querySelectorAll('#tab-pm button')].find(x=>/Duyệt|Approve/.test(x.textContent)&&x.offsetParent); e && e.click()"); pg.wait_for_timeout(1200); grab(pg, 'pm-approve')
        safe(pg, "const e=[...document.querySelectorAll('#tab-pm button')].find(x=>/Từ chối|Reject/.test(x.textContent)&&x.offsetParent); e && e.click()"); pg.wait_for_timeout(1200); grab(pg, 'pm-reject')
        safe(pg, "const e=[...document.querySelectorAll('button')].find(x=>/Kết sổ|Close program/.test(x.textContent)&&x.offsetParent); e && e.click()"); pg.wait_for_timeout(1200); grab(pg, 'pm-close')
        note(f'pm-dialogs[{uid}]', [d for d in pg.dialogs if has_vi(d)])
        ctx.close()
    b.close()
srv.shutdown()
out = {k: sorted(v) for k, v in sorted(miss.items())}
json.dump(out, open(os.path.join(ROOT, 'design/i18n/missing_en.json'), 'w'), ensure_ascii=False, indent=1)
json.dump({k: CTX.get(k, '') for k in out}, open(os.path.join(ROOT, 'design/i18n/missing_en_context.json'), 'w'), ensure_ascii=False, indent=1)
print('Câu tiếng Việt còn hiện ở chế độ EN:', len(out))
