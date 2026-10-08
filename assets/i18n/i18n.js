/*
 * LG Internal Sales Portal — lớp dịch tiếng Anh (VI/EN). design/I18N_EN_FEASIBILITY.md
 *
 * Nguyên tắc (chủ dự án duyệt 08/10/2026):
 *  - Mặc định TIẾNG VIỆT. Ở chế độ VI lớp này KHÔNG đổi gì trên trang (chỉ cung cấp nút chuyển ngôn ngữ).
 *  - Ở chế độ EN: chỉ dịch CHỮ HIỂN THỊ (text, placeholder, title, aria-label, hộp thoại, thông báo).
 *    KHÔNG dịch: giá trị ô nhập / value của option / dữ liệu gửi máy chủ / trạng thái lưu trong Sheet /
 *    nội dung PM nhập (vùng có [data-no-i18n] hoặc nằm trong NO_I18N bên dưới). Máy chủ, email, Excel giữ tiếng Việt.
 *  - Lệnh của nút gắn bằng onclick / id, không phụ thuộc chữ → dịch chữ không đổi chức năng.
 *  - Tắt toàn bộ: đặt `var I18N_ENABLED = false;` trong trang (nút ẩn, trang chạy đúng như bản tiếng Việt).
 *
 * Từ điển: assets/i18n/en.js (window.LG_I18N_EN = { dict: {...}, patterns: [[regex, thay thế], ...] }).
 * Gỡ lỗi: thêm ?i18n=debug → window.__i18nMiss chứa các câu tiếng Việt chưa có bản dịch.
 */
(function () {
  'use strict';
  var KEY = 'lg_lang';
  var enabled = typeof window.I18N_ENABLED === 'undefined' ? true : !!window.I18N_ENABLED;
  var params = new URLSearchParams(location.search);
  var q = params.get('lang');
  var lang = 'vi';
  if (enabled) {
    if (q === 'en' || q === 'vi') lang = q;
    else { try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'vi'; } catch (e) {} }
  }
  window.LG_LANG = lang;

  window.lgSetLang = function (l) {
    try { localStorage.setItem(KEY, l === 'en' ? 'en' : 'vi'); } catch (e) {}
    var u = new URL(location.href);
    u.searchParams.delete('lang');
    location.href = u.toString();
  };
  window.lgToggleLang = function () { window.lgSetLang(lang === 'en' ? 'vi' : 'en'); };

  // Nút VI/EN: chữ trên nút = ngôn ngữ sẽ chuyển sang. Ẩn khi tắt chức năng.
  function setupToggles() {
    document.querySelectorAll('[data-lang-toggle]').forEach(function (b) {
      if (!enabled) { b.style.display = 'none'; return; }
      b.textContent = lang === 'en' ? 'VI' : 'EN';
      b.title = lang === 'en' ? 'Chuyển sang Tiếng Việt' : 'Switch to English';
      b.setAttribute('aria-label', b.title);
      b.setAttribute('data-no-i18n', '');
    });
  }

  if (lang !== 'en') {
    // Chế độ VI: không dịch, không theo dõi trang. T() và lgI18nText() trả về đúng như cũ.
    window.T = function (s) { return s; };
    window.lgI18nText = function (el) { return el.innerText; };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupToggles); else setupToggles();
    return;
  }

  // ===================== Chế độ EN =====================
  document.documentElement.lang = 'en';
  document.documentElement.classList.add('lang-en');
  var DEBUG = params.get('i18n') === 'debug';
  var MISS = window.__i18nMiss = new Set();
  var VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;
  var SRC = window.LG_I18N_EN || { dict: {}, patterns: [] };
  var D = SRC.dict || {};
  var P = (SRC.patterns || []).map(function (p) { return [new RegExp(p[0]), p[1]]; });
  // Vùng dữ liệu do PM / người dùng nhập: không dịch (mô tả sản phẩm, tên đợt bán, ghi chú, tình trạng…)
  var NO_I18N = '[data-no-i18n], .lg-card-desc, .pk-cond, .ps-sub-cond, td.cond, .lgm-data, #grap-program-title, .program-tab-name';

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  // Có chữ tiếng Việt cần dịch? Bỏ qua ký hiệu tiền "đ" sau số (1.875.000 đ) — giữ cách ghi tiền (Q-I3)
  // + từ tiếng Việt không dấu hay gặp trên trang: "Kho"/"kho", "Tivi", "SP" (sản phẩm), "NV" (nhân viên)
  var VI_WORD = /\b(Kho|kho|Tivi|SP|NV)\b/;
  function hasVI(s) { s = String(s).replace(/\d[\d.,]*\s*đ/g, ''); return VI.test(s) || VI_WORD.test(s); }
  function one(k) {
    if (Object.prototype.hasOwnProperty.call(D, k)) return D[k];
    // Mẫu câu: $1 = giữ nguyên phần bắt được; $T1 = dịch tiếp phần đó (vd. lời nhắn máy chủ sau "Không thể xóa: ")
    for (var i = 0; i < P.length; i++) {
      var m = k.match(P[i][0]);
      if (m) return P[i][1].replace(/\$(T?)(\d)/g, function (x, t, g) { var c = m[+g] || ''; return t ? (one(norm(c)) || c) : c; });
    }
    return null;
  }
  // Dịch 1 chuỗi hiển thị. Không có tiếng Việt → giữ nguyên. Không có bản dịch → giữ nguyên (ghi lại khi gỡ lỗi).
  function tr(s) {
    if (s == null) return s;
    var str = String(s);
    if (!hasVI(str)) return str;
    var k = norm(str);
    var v = one(k);
    if (v == null && str.indexOf('\n') >= 0) {           // hộp thoại nhiều dòng: dịch từng dòng
      return str.split('\n').map(function (line) { return hasVI(line) ? (one(norm(line)) != null ? line.replace(norm(line), one(norm(line))) : (MISS.add(norm(line)), line)) : line; }).join('\n');
    }
    if (v == null) { MISS.add(k); return str; }
    var lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0];
    return lead + v + trail;
  }
  window.T = tr;

  var ORIG = new WeakMap();      // nút chữ đã dịch → chữ tiếng Việt gốc (để xuất file giữ tiếng Việt)
  var DONE = new WeakMap();      // nút chữ → bản dịch vừa ghi (không dịch lại chính bản dịch của mình)
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };   // <code> vẫn dịch: có mẫu cú pháp tiếng Việt; mã/số không có chữ Việt nên giữ nguyên
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  function noI18n(el) { return el.closest && el.closest(NO_I18N); }
  function doText(n) {
    var p = n.parentElement;
    if (!p || SKIP[p.nodeName] || noI18n(p)) return;
    var v = n.nodeValue;
    if (DONE.get(n) === v || !hasVI(v)) return;
    var t = tr(v);
    if (t !== v) { ORIG.set(n, v); DONE.set(n, t); n.nodeValue = t; }
    else if (DEBUG) { var c = window.__i18nCtx || (window.__i18nCtx = {}); var k = norm(v); if (!c[k]) c[k] = norm(p.innerText || p.textContent || '').slice(0, 400); }
  }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var v = el.getAttribute(a);
      if (hasVI(v)) { var t = tr(v); if (t !== v) el.setAttribute(a, t); }
    }
    if (el.nodeName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && hasVI(el.value)) el.value = tr(el.value);
  }
  function walk(node) {
    if (node.nodeType === 3) { doText(node); return; }
    if (node.nodeType !== 1 || SKIP[node.nodeName] || noI18n(node)) return;
    doAttrs(node);
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  var obs = new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') { if (m.target.nodeType === 1 && !noI18n(m.target)) doAttrs(m.target); }
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
  });
  // Bắt đầu theo dõi ngay (kể cả lúc trình duyệt đang dựng trang) → không thấy chữ tiếng Việt chớp lên
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  // Hộp thoại của trình duyệt: chỉ dịch chữ; kết quả Đồng ý / Huỷ không đổi
  var _alert = window.alert, _confirm = window.confirm, _prompt = window.prompt;
  window.alert = function (m) { return _alert.call(window, tr(m)); };
  window.confirm = function (m) { return _confirm.call(window, tr(m)); };
  window.prompt = function (m, d) { return _prompt.call(window, tr(m), d); };

  // Chữ gốc tiếng Việt của một vùng (dùng khi xuất file: file luôn giữ tiếng Việt — Q-I8)
  // Cách làm: tạm đặt lại chữ gốc → đọc innerText đúng như bản tiếng Việt → trả lại bản dịch (cùng 1 lượt chạy, màn hình không kịp vẽ).
  window.lgI18nText = function (el) {
    var swapped = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) if (ORIG.has(n)) { swapped.push([n, n.nodeValue]); n.nodeValue = ORIG.get(n); }
    var text = el.innerText;
    swapped.forEach(function (x) { x[0].nodeValue = x[1]; });
    return text;
  };

  function start() {
    document.title = tr(document.title);
    walk(document.body);
    setupToggles();
    // Thông báo nhỏ / màn chờ do trang tự định nghĩa: dịch chữ trước khi hiện
    if (typeof window.showToast === 'function') {
      var _t = window.showToast;
      window.showToast = function (m) { var a = [].slice.call(arguments); a[0] = tr(m); return _t.apply(this, a); };
    }
    if (typeof window.showWait === 'function') {
      var _w = window.showWait;
      window.showWait = function (a1, a2) { return _w.call(this, tr(a1), tr(a2)); };
    }
    if (DEBUG) console.info('[i18n] chưa dịch:', MISS.size, Array.from(MISS));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
