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
    ap.add_argument('--admin', default='', help='MãNV:mậtkhẩu tài khoản role ADMIN trên staging (kiểm thử công tắc email)')
    ap.add_argument('--pm', default='', help='MãNV:mậtkhẩu tài khoản role PM trên staging (phải bị chặn đổi công tắc email)')
    ap.add_argument('--load-rps', type=float, default=0, help='yêu cầu polling / giây cho bài tải (0 = bỏ qua)')
    ap.add_argument('--load-seconds', type=int, default=30)
    a = ap.parse_args()
    if 'script.google.com/macros/s/' not in a.url:
        sys.exit('URL không phải Web App Apps Script')
    failures = []

    print('1) Thời gian phản hồi (giây)')
    for label, params in (('doGet (ping)', {}), ('doGet?action=taken', {'action': 'taken', 'programId': a.program})):
        times, errs, err_samples = [], 0, []
        for _ in range(a.samples):
            dt, data, err = call(a.url, params=params)
            if err or not (data and data.get('ok')):
                errs += 1
                err_samples.append(f'{dt:.1f}s {err or json.dumps(data, ensure_ascii=False)[:100]}')
            else:
                times.append(dt)
        print(f'   {label:22s} n={len(times)} lỗi={errs}  p50={pct(times, 50):.2f}  p95={pct(times, 95):.2f}  max={max(times or [0]):.2f}')
        for e in err_samples[:3]:
            print('     lỗi:', e)
    print('   (Thời gian phản hồi gồm cả mạng + chuyển hướng của Google, KHÔNG phải thời gian script chạy.'
          ' Nhịp polling chốt theo bài tải ở mục 4 — đo 05/10/2026: 60 yêu cầu/giây, 0% lỗi.)')

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

    if a.admin or a.pm:
        print('2b) Role ADMIN: công tắc email chỉ ADMIN dùng được')
        for label, cred, expect_ok in (('ADMIN', a.admin, True), ('PM', a.pm, False)):
            if not cred:
                continue
            uid, pw = cred.split(':', 1)
            _, au, err = call(a.url, {'action': 'auth', 'id': uid, 'password': pw})
            if not (au and au.get('ok')):
                print(f"   FAIL không đăng nhập được {uid}: {(au or {}).get('message', err)}")
                failures.append(f'đăng nhập {label}')
                continue
            _, data, err = call(a.url, {'action': 'email_setting', 'token': au['token']})  # chỉ đọc, không đổi cài đặt
            ok = bool(data) and bool(data.get('ok')) == expect_ok
            detail = f"enabled={data.get('enabled')} · còn {data.get('remainingDailyQuota')} email hôm nay" if data and data.get('ok') else (data or {}).get('message', err)
            print(f"   {'PASS' if ok else 'FAIL'} {label} {uid} (role máy chủ: {au['user'].get('role')}) đọc cài đặt email → {detail}")
            if not ok:
                failures.append(f'công tắc email với {label}')
            if label == 'ADMIN':
                _, dash, err = call(a.url, {'action': 'pm_dashboard', 'token': au['token'], 'programId': a.program})
                ok2 = bool(dash and dash.get('ok'))
                print(f"   {'PASS' if ok2 else 'FAIL'} ADMIN xem Dashboard chương trình {a.program} (của PM khác): {(dash or {}).get('message', 'OK')}")
                if not ok2:
                    failures.append('ADMIN không vào được Dashboard')

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
        # Thắng = máy chủ xác nhận đăng ký mới. Phản hồi lạ (vd. JSON của doGet do chuyển hướng lỗi) KHÔNG được tính là thắng.
        is_win = lambda r: bool(r[1]) and r[1].get('ok') is True and not r[1].get('repeat') and 'Đăng ký thành công' in str(r[1].get('message', ''))
        wins = [(t, r) for t, r in zip(tokens, res) if is_win(r)]
        odd = [(t[0], r) for t, r in zip(tokens, res) if not is_win(r) and not (r[1] and r[1].get('ok') is False)]
        busy = [r for r in res if r[1] and r[1].get('busy')]
        losers = [r for r in res if r[1] and r[1].get('slotTaken')]
        print(f'   thắng={len(wins)}  bị từ chối={len(res) - len(wins) - len(busy)}  bận={len(busy)}  '
              f'p95 thời gian={pct([r[0] for r in res], 95):.2f}s')
        for (uid, _, _), r in zip(tokens, res):
            print(f"     {uid}: {r[0]:.2f}s · {(r[1] or {}).get('message', r[2])}")
        for uid, r in odd:
            print(f"   ⚠ phản hồi bất thường của {uid} ({r[0]:.1f}s): {json.dumps(r[1], ensure_ascii=False)[:160] if r[1] else r[2]}"
                  " → kiểm tra lại bằng lookup trước khi kết luận")
        if len(wins) != 1:
            failures.append(f'FCFS: {len(wins)} người thắng (phải là 1)')
        if losers and not all(a.slot in (r[1].get('taken') or []) for r in losers):
            failures.append('phản hồi từ chối không kèm danh sách slot đã hết')
        elif losers:
            print('   PASS người thua nhận kèm danh sách slot đã hết (màn hình cập nhật ngay)')

        if len(tokens) >= 2:
            (uid_a, name_a, tok_a), (uid_b, _, _) = tokens[0], tokens[1]
            _, data, err = call(a.url, {'action': 'register_product', 'token': tok_a, 'uniqueCode': a.slot,
                                        'programId': a.program, 'empCode': uid_b, 'empName': name_a})
            spoof_ok = bool(data) and data.get('ok') is False and data.get('authError')
            print(f"   {'PASS' if spoof_ok else 'FAIL'} giữ chỗ hộ người khác bị chặn: {(data or {}).get('message', err)}")
            if not spoof_ok:
                failures.append('giữ chỗ hộ người khác không bị chặn')

        if len(wins) == 1:  # dọn dẹp bằng route hủy giữ chỗ mới — đồng thời kiểm thử route này trên máy chủ thật
            (uid_w, _, tok_w), _ = wins[0]
            _, data, err = call(a.url, {'action': 'user_cancel_registration', 'token': tok_w, 'userId': uid_w, 'slotId': a.slot})
            _, tk, _ = call(a.url, params={'action': 'taken', 'programId': a.program})
            freed = bool(data and data.get('ok')) and tk and a.slot not in tk.get('taken', [])
            print(f"   {'PASS' if freed else 'FAIL'} người thắng tự hủy → slot trả về kho: {(data or {}).get('message', err)}")
            if not freed:
                failures.append('hủy giữ chỗ không trả slot về kho')
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
        print(f'   (Cận trên lý thuyết {a.load_rps} × p50 = {a.load_rps * pct(times, 50):.1f} lượt đồng thời — thường cao hơn thực tế;'
              ' căn cứ quyết định là tỷ lệ lỗi đo được ở trên)')
        if errs:
            print('   Lỗi mẫu:', errs[0][2] or json.dumps(errs[0][1])[:120])
        if rate > 0.5:
            failures.append(f'tải polling: lỗi {rate:.1f}% > 0,5%')

    print('\nKẾT QUẢ: ' + ('ĐẠT' if not failures else 'CHƯA ĐẠT — ' + '; '.join(failures)))
    sys.exit(0 if not failures else 1)


if __name__ == '__main__':
    main()
