/* POC lớp dịch chồng (overlay) — chế độ VI: KHÔNG chạy gì (DOM giữ nguyên 100%). Chế độ EN: dịch chữ hiển thị, không đụng value / dữ liệu. */
(function () {
  var q = new URLSearchParams(location.search).get('lang');
  var LANG = q === 'en' || q === 'vi' ? q : (function () { try { return localStorage.getItem('lg_lang') || 'vi'; } catch (e) { return 'vi'; } })();
  window.LG_LANG = LANG;
  window.setLang = function (l) { try { localStorage.setItem('lg_lang', l); } catch (e) {} var u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString(); };
  if (LANG !== 'en') return;
  var D = {
    'CỔNG BÁN HÀNG NỘI BỘ': 'INTERNAL SALES PORTAL', 'Mã nhân viên (Employee ID)': 'Employee ID', 'Mật khẩu (Password)': 'Password', 'Đăng nhập': 'Sign in',
    'Đăng ký mua hàng nội bộ · LGEVH': 'Internal purchase registration · LGEVH', 'Nhân viên': 'Employee', 'Đổi MK': 'Change password', 'Đăng xuất': 'Sign out',
    'Hướng dẫn nhanh': 'Quick guide', 'In / Xuất PDF': 'Print / PDF', 'Đêm / Sáng': 'Dark / Light', 'Đang Mở Bán': 'Open for sale',
    '1. Thư Thông Báo & Quy Định': '1. Notice & Rules', '2. Danh Mục & Đăng Ký Mua Hàng': '2. Catalog & Register', '3. Xác Nhận Mua & Nộp Tiền': '3. Confirm & Pay',
    '4. Bảng Chi Tiết Sản Phẩm': '4. Product Details', 'Thể Lệ & Chuyển Khoản': 'Rules & Bank Transfer', 'Ngân hàng': 'Bank', 'Số tài khoản': 'Account number',
    'Chủ thụ hưởng': 'Account holder', 'Cú pháp CK': 'Transfer note', 'Xem thể lệ chi tiết →': 'See full rules →', 'Tiến Độ Kho Hàng & Thanh Toán': 'Stock & Payment Progress',
    'Đơn Hàng Của Bạn': 'Your Order', 'Giá ưu đãi nội bộ:': 'Staff price:', 'Kho bàn giao:': 'Pickup warehouse:', 'Đăng Ký Giữ Chỗ Ngay': 'Reserve now',
    'ƯU ĐÃI NỘI BỘ': 'STAFF DEAL', '● Còn slot': '● Available', 'Giá niêm yết:': 'List price:', 'Giá Nhân Viên:': 'Staff price:', 'Xem trên LG.com ↗': 'View on LG.com ↗',
    'Dạng Thẻ': 'Cards', 'Dạng Bảng': 'Table', 'Kho:': 'Warehouse:', 'Rules': 'Rules', 'Catalog Live': 'Live catalog', 'Excel View': 'Excel view'
  };
  var P = [[/^(\d+) Đơn$/, '$1 orders'], [/^Đăng ký: (.+)$/, 'Registered: $1'], [/^Kho (\w+) · Slot:$/, 'Warehouse $1 · Slot:'], [/^Còn (\d+)\/(\d+) slot$/, '$1/$2 slots left']];
  function tr(s) { var k = s.trim(); if (!k) return s; if (D[k]) return s.replace(k, D[k]); for (var i = 0; i < P.length; i++) if (P[i][0].test(k)) return s.replace(k, k.replace(P[i][0], P[i][1])); return s; }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1 };
  function walk(root) {
    if (root.nodeType === 3) { var t = tr(root.nodeValue); if (t !== root.nodeValue) root.nodeValue = t; return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName] || (root.closest && root.closest('[data-no-i18n]'))) return;
    ['placeholder', 'title', 'aria-label'].forEach(function (a) { if (root.hasAttribute && root.hasAttribute(a)) { var v = tr(root.getAttribute(a)); if (v !== root.getAttribute(a)) root.setAttribute(a, v); } });
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function start() {
    document.documentElement.lang = 'en'; walk(document.body);
    new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === 'characterData') walk(m.target); else m.addedNodes.forEach(walk); }); })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
    var a = window.alert; window.alert = function (s) { return a.call(window, tr(String(s))); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
