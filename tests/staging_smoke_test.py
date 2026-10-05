#!/usr/bin/env python3
"""
STAGING smoke + load test — chạy vào Apps Script STAGING thật (KHÔNG chạy vào bản chính thức).

Đo những thứ máy tính cục bộ không đo được:
  1. Thời gian phản hồi thật của doGet / doGet?action=taken  → chốt nhịp polling (docs/04-v1-hardening §4.4)
  2. 5 loại token giả đều bị từ chối                           → Gói B trên máy chủ thật
  3. N người cùng bấm 1 slot → đúng 1 người thắng               → FCFS dưới tải thật (cần N tài khoản test)
  4. Tải polling R yêu cầu/giây trong T giây → tỷ lệ lỗi        → giới hạn 30 lượt chạy đồng thời của Google

Chỉ dùng thư viện chuẩn Python. Ví dụ:
  python3 tests/staging_smoke_test.py --url https://script.google.com/macros/s/STAGING_ID/exec \
      --program IS-2026Q4-TV-01 --users VH90001:pw1,VH90002:pw2,VH90003:pw3 --slot IS-2026Q4-TV-01-AYA-001 \
      --load-rps 20 --load-seconds 30

Hướng dẫn chuẩn bị staging: docs/04-v1-hardening/V1_RELEASE_RUNBOOK.md (mục Staging)
"""
import argparse
import base64
import json
import statistics
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

TIMEOUT = 60


def call(url, payload=None, params=None):
    """POST JSON (như trình duyệt, text/plain để tránh preflight) hoặc GET. Trả (giây, dict|None, lỗi)."""
    t0 = time.perf_counter()
    try:
        if payload is None:
            q = '?' + urllib.parse.urlencode(params or {}) if params else ''
            req = urllib.request.Request(url + q)
        else:
            req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type': 'text/plain;charset=utf-8'})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            body = r.read().decode('utf-8', 'replace')
        dt = time.perf_counter() - t0
        try:
            return dt, json.loads(body), None
        except json.JSONDecodeError:
            return dt, None, 'non-JSON (thường là trang lỗi Google: quá tải / quá nhiều script chạy đồng thời)'
    except Exception as e:  # noqa: BLE001 — báo mọi lỗi mạng như một kết quả đo
        return time.perf_counter() - t0, None, str(e)[:120]


def pct(values, p):
    s = sorted(values)
    return s[min(len(s) - 1, int(round(p / 100 * (len(s) - 1))))] if s else float('nan')


def forge(payload, sig):
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=') + '.' + sig


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--url', required=True, help='URL Web App của bản STAGING')
    ap.add_argument('--program', required=True, help='Mã chương trình có sẵn trên staging')
    ap.add_argument('--users', default='', help='danh sách MãNV:mậtkhẩu tài khoản test trên staging, cách nhau dấu phẩy')
    ap.add_argument('--slot', default='', help='mã 1 slot đang Available để test tranh chấp')
    ap.add_argument('--samples', type=int, default=20)
    ap.add_argument('--load-rps', type=float, default=0, help='yêu cầu polling / giây cho bài tải (0 = bỏ qua)')
    ap.add_argument('--load-seconds', type=int, default=30)
    a = ap.parse_args()
    if 'script.google.com/macros/s/' not in a.url:
        sys.exit('URL không phải Web App Apps Script')
    failures = []

    print('1) Thời gian phản hồi (giây)')
    for label, params in (('doGet (ping)', {}), ('doGet?action=taken', {'action': 'taken', 'programId': a.program})):
        times, errs = [], 0
        for _ in range(a.samples):
            dt, data, err = call(a.url, params=params)
            if err or not (data and data.get('ok')):
                errs += 1
            else:
                times.append(dt)
        print(f'   {label:22s} n={len(times)} lỗi={errs}  p50={pct(times, 50):.2f}  p95={pct(times, 95):.2f}  max={max(times or [0]):.2f}')
        if label.startswith('doGet?action'):
            p95 = pct(times, 95)
            rec = 10 if p95 < 0.7 else 15
            print(f'   → Đề xuất polling: {rec} giây (quy tắc §4.4: p95 < 0,7 s → 10 s, ngược lại 15 s)')

    print('2) Token giả mạo phải bị từ chối')
    exp = int(time.time() * 1000) + 3600_000
    forged = {
        'chữ ký demo, PM': forge({'uid': 'VH12345', 'role': 'PM', 'name': 'x', 'exp': exp}, 'demo_local_signature'),
        'chữ ký demo, ADMIN': forge({'uid': 'ADMIN', 'role': 'PM', 'name': 'x', 'exp': exp}, 'demo_local_signature'),
        'chữ ký bịa': forge({'uid': 'ADMIN', 'role': 'PM', 'exp': exp}, 'AAAA'),
        'token hết hạn': forge({'uid': 'ADMIN', 'role': 'PM', 'exp': 1}, 'demo_local_signature'),
        'không có token': None,
    }
    for name, tok in forged.items():
        _, data, err = call(a.url, {'action': 'pm_dashboard', 'token': tok, 'programId': a.program})
        ok = bool(data) and data.get('ok') is False
        print(f"   {'PASS' if ok else 'FAIL'} {name}: {(data or {}).get('message', err)}")
        if not ok:
            failures.append('token: ' + name)

    users = [u.split(':', 1) for u in a.users.split(',') if ':' in u]
    if users and a.slot:
        print(f'3) {len(users)} người cùng bấm slot {a.slot}')
        tokens = []
        for uid, pw in users:
            _, data, err = call(a.url, {'action': 'auth', 'id': uid, 'password': pw})
            if data and data.get('ok'):
                tokens.append((data['user']['id'], data['user']['name'], data['token']))
            else:
                print(f"   không đăng nhập được {uid}: {(data or {}).get('message', err)}")
        with ThreadPoolExecutor(max_workers=len(tokens) or 1) as ex:
            res = list(ex.map(lambda t: call(a.url, {'action': 'register_product', 'token': t[2], 'uniqueCode': a.slot,
                                                      'programId': a.program, 'empCode': t[0], 'empName': t[1]}), tokens))
        wins = [r for r in res if r[1] and r[1].get('ok') and not r[1].get('repeat')]
        busy = [r for r in res if r[1] and r[1].get('busy')]
        print(f'   thắng={len(wins)}  bị từ chối={len(res) - len(wins) - len(busy)}  bận={len(busy)}  '
              f'p95 thời gian={pct([r[0] for r in res], 95):.2f}s')
        if len(wins) != 1:
            failures.append(f'FCFS: {len(wins)} người thắng (phải là 1)')
        print('   (Dọn dẹp: PM từ chối / người thắng hủy đơn test trên staging sau khi chạy)')
    else:
        print('3) Bỏ qua tranh chấp slot (cần --users và --slot)')

    if a.load_rps > 0:
        print(f'4) Tải polling {a.load_rps}/giây trong {a.load_seconds} giây')
        total = int(a.load_rps * a.load_seconds)
        start = time.perf_counter()

        def one(i):
            delay = start + i / a.load_rps - time.perf_counter()
            if delay > 0:
                time.sleep(delay)
            return call(a.url, params={'action': 'taken', 'programId': a.program})

        with ThreadPoolExecutor(max_workers=min(200, total)) as ex:
            res = list(ex.map(one, range(total)))
        errs = [r for r in res if r[2] or not (r[1] and r[1].get('ok'))]
        times = [r[0] for r in res if not r[2]]
        rate = 100 * len(errs) / max(1, total)
        print(f'   {total} yêu cầu · lỗi {len(errs)} ({rate:.1f}%) · p50={pct(times, 50):.2f}s p95={pct(times, 95):.2f}s')
        print(f'   Ước tính lượt chạy đồng thời = {a.load_rps} × p50 = {a.load_rps * pct(times, 50):.1f} (giới hạn Google: 30)')
        if errs:
            print('   Lỗi mẫu:', errs[0][2] or json.dumps(errs[0][1])[:120])
        if rate > 0.5:
            failures.append(f'tải polling: lỗi {rate:.1f}% > 0,5%')

    print('\nKẾT QUẢ: ' + ('ĐẠT' if not failures else 'CHƯA ĐẠT — ' + '; '.join(failures)))
    sys.exit(0 if not failures else 1)


if __name__ == '__main__':
    main()
