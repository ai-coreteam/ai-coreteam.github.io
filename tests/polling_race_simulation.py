"""
Polling-interval risk simulation for the FCFS flash sale (Monte Carlo, stdlib only).

Question it answers: if the catalog refreshes every P seconds, how often does an employee click a
slot that someone else already took, how much time does that cost them, and how much load does it put
on Apps Script (owner account limit: 30 simultaneous executions, per Google's published quotas)?

What it does NOT answer: whether two people can get the same slot. They cannot: register_product_
re-reads the slot status inside LockService and rejects the second request (Code.gs L756-790).
Polling only changes what people SEE, not who WINS.

Every number below marked ASSUMPTION is a model input, not a measurement. Change them and re-run.

Run: python3 tests/polling_race_simulation.py
"""
import heapq
import math
import random
import statistics

# ---- ASSUMPTIONS (model inputs) -------------------------------------------------------------
USERS = 300                 # target load in PROJECT_PLANNING.md
SLOTS = 90                  # current catalog (data/LG_Internal_Sales_Database.xlsx)
POPULARITY_SKEW = 0.8       # Zipf exponent: a few cheap/hot items are wanted by many people
ARRIVAL_WINDOW_S = 90       # people open the page within ~90 s of 10:00
FIRST_THINK_S = (10, 40)    # time to browse before the first click
RETHINK_S = (3, 8)          # time to pick another item after "đã có người đăng ký"
NET_ONE_WAY_S = 0.5         # browser <-> Apps Script one way
LOCK_SERVICE_S = 0.3        # time one registration holds the lock (serial section)
PAGE_LOAD_S = 2.0           # first products load after login
SERVER_CACHE_S = 5          # proposed cache on the "taken" endpoint
RUNS = 200
# ---------------------------------------------------------------------------------------------


def preference_order(weights, rng):
    # Plackett-Luce sample via the Gumbel trick: popular items tend to be ranked first.
    keys = [(math.log(w) - math.log(-math.log(rng.random())), i) for i, w in enumerate(weights)]
    return [i for _, i in sorted(keys, reverse=True)]


def simulate(poll_s, refresh_on_fail, rng):
    weights = [1 / (r + 1) ** POPULARITY_SKEW for r in range(SLOTS)]
    taken_at = {}                      # slot -> server time it was taken
    events = []                        # (time, seq, kind, user)
    seq = 0
    users = []
    for u in range(USERS):
        arrive = rng.uniform(0, ARRIVAL_WINDOW_S)
        users.append({'prefs': preference_order(weights, rng), 'view_t': arrive + PAGE_LOAD_S,
                      'fails': 0, 'tried': set(), 'first_click': None, 'won_at': None, 'won_rank': None, 'gave_up': False})
        heapq.heappush(events, (arrive + PAGE_LOAD_S + rng.uniform(*FIRST_THINK_S), seq, 'click', u)); seq += 1

    lock_free_at = 0.0
    polls = 0
    while events:
        t, _, kind, u = heapq.heappop(events)
        st = users[u]
        if kind == 'click':
            # Bring the view up to date with any polls that happened since the last refresh.
            if poll_s:
                n = math.floor((t - st['view_t']) / poll_s)
                if n > 0:
                    polls += n
                    st['view_t'] += n * poll_s
            snapshot = st['view_t'] - (SERVER_CACHE_S if poll_s else 0)
            # A person remembers the items they were just told are taken, even if the screen still shows them free.
            choice = next((s for s in st['prefs']
                           if s not in st['tried'] and not (s in taken_at and taken_at[s] <= snapshot)), None)
            if choice is None:
                st['gave_up'] = True
                continue
            if st['first_click'] is None:
                st['first_click'] = t
            arrive_srv = t + NET_ONE_WAY_S
            start = max(arrive_srv, lock_free_at)
            lock_free_at = start + LOCK_SERVICE_S
            respond = lock_free_at + NET_ONE_WAY_S
            if choice not in taken_at:
                taken_at[choice] = lock_free_at
                st['won_at'] = respond
                st['won_rank'] = st['prefs'].index(choice) + 1
            else:
                st['fails'] += 1
                st['tried'].add(choice)
                if refresh_on_fail:
                    st['view_t'] = respond + SERVER_CACHE_S  # fresh server state returned with the error
                heapq.heappush(events, (respond + rng.uniform(*RETHINK_S), seq, 'click', u)); seq += 1

    winners = [x for x in users if x['won_at'] is not None]
    clicked = [x for x in users if x['first_click'] is not None]
    return {
        'fails_per_user': sum(x['fails'] for x in users) / USERS,
        'pct_users_with_fail': 100 * sum(1 for x in clicked if x['fails']) / max(1, len(clicked)),
        'max_fails': max(x['fails'] for x in users),
        'p95_wait_winner': sorted(x['won_at'] - x['first_click'] for x in winners)[int(0.95 * (len(winners) - 1))],
        'winners': len(winners),
        'sold_out_at': max(taken_at.values()),
    }


def main():
    scenarios = [
        ('Hiện tại: không bao giờ cập nhật', None, False),
        ('Polling 30 s', 30, False),
        ('Polling 15 s', 15, False),
        ('Polling 10 s', 10, False),
        ('Polling 7 s (thiết kế đã duyệt)', 7, False),
        ('Polling 3 s', 3, False),
        ('15 s + làm mới ngay khi bị từ chối', 15, True),
        ('10 s + làm mới ngay khi bị từ chối', 10, True),
        ('7 s + làm mới ngay khi bị từ chối', 7, True),
        ('Không polling + làm mới khi bị từ chối', None, True),
    ]
    print(f'{USERS} người, {SLOTS} slot, {RUNS} lần mô phỏng mỗi kịch bản (giá trị trung vị)\n')
    hdr = f"{'Kịch bản':40s} {'click hụt/người':>15s} {'% người bị hụt':>15s} {'hụt tối đa':>11s} {'p95 chờ (s)':>12s} {'người mua được':>15s}"
    print(hdr)
    print('-' * len(hdr))
    for name, poll, rof in scenarios:
        rng = random.Random(42)
        rs = [simulate(poll, rof, rng) for _ in range(RUNS)]
        med = lambda k: statistics.median(r[k] for r in rs)
        print(f"{name:40s} {med('fails_per_user'):15.2f} {med('pct_users_with_fail'):14.0f}% {med('max_fails'):11.0f} "
              f"{med('p95_wait_winner'):12.1f} {med('winners'):15.0f}")

    print('\nTải polling lên Apps Script (định luật Little: số chạy đồng thời = tốc độ yêu cầu x thời gian 1 lần chạy)')
    print('Giới hạn chính thức: 30 lần chạy đồng thời / tài khoản chủ. Thời gian 1 lần doGet là ASSUMPTION 0.3–1.0 s (chưa đo).')
    for p in (3, 7, 10, 15, 30):
        rate = USERS / p
        print(f'  Polling {p:>2d} s: {rate:5.1f} yêu cầu/s  ->  {rate*0.3:5.1f} – {rate*1.0:5.1f} lần chạy đồng thời')


if __name__ == '__main__':
    main()
