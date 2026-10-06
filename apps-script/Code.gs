/**
 * LG Internal Sales Portal -> Google Sheet "LG Internal Sales Database"
 * Nhận đơn đăng ký (Tab 2), khai nộp tiền (Tab 3) và tra cứu đơn từ index.html.
 *
 * Nguyên tắc:
 *  - Chỉ THÊM dữ liệu. Không xoá dòng, không ghi đè ô đã có dữ liệu.
 *  - Không tự gửi email.
 *  - Mọi thao tác ghi đều ghi thêm 1 dòng vào sheet ActivityLog.
 *  - Trạng thái do máy chủ đặt, không tin trạng thái trình duyệt gửi lên.
 *
 * v7.3 (chịu tải): chỉ khoá (lock) đúng đoạn kiểm tra trùng + ghi dòng; đọc Config/Slots
 * qua bộ nhớ đệm; chờ khoá tối đa 30 giây; trả busy:true để trang tự gửi lại.
 *
 * Cách cài: xem docs/01-setup-and-deployment/SETUP_APPS_SCRIPT.md
 */

// ID của Google Sheet "LG Internal Sales Database"
// - Nếu gắn script này trực tiếp vào Sheet (Container-bound): có thể để trống, script tự nhận Sheet hiện tại.
// - Nếu là standalone script: Hãy chạy hàm setupNewDatabase() bên dưới để tự tạo Sheet trên Drive của bạn,
//   sau đó dán ID được tạo vào biến bên dưới:
var SPREADSHEET_ID = '15LzI6KYp2liuCeGmTcm5IaSXN6UapWfihk4EOVQFu8A'; // <- Google Sheet ID của bạn

var SHEET_REG = 'Registrations';
var SHEET_SLOTS = 'Slots';
var SHEET_CONFIG = 'Config';
var SHEET_LOG = 'ActivityLog';
var SHEET_USERS = 'Users';
var SHEET_PROGRAMS = 'Programs';
var SHEET_PRODUCTS = 'Products';
var SHEET_AUTO_EMAIL = 'AutoEmail';
var RECEIPT_FOLDER_NAME = 'Bien lai nop tien';
var MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
var LOCK_WAIT_MS = 30000;              // chờ tối đa 30 giây
var CACHE_CONFIG_SEC = 300;            // Config đổi thì sau tối đa 5 phút script mới thấy
var CACHE_SLOTS_SEC = 600;

var STATUS_WAIT_GATE = 'Đã đăng ký - Chờ mở thanh toán';
var STATUS_NEW = 'Chờ nộp tiền';
var STATUS_PAID = 'Đã khai nộp - chờ đối soát';
var STATUS_USER_CANCEL = 'Đã hủy bởi nhân viên';
var STATUS_FREE = ['Hủy', 'Từ chối', 'Hết hạn giữ chỗ', STATUS_USER_CANCEL]; // đơn ở trạng thái này không giữ slot

// Cột trong Registrations (1-based)
var C = {
  TS: 1, CAMPAIGN: 2, DIVISION: 3, EMP_CODE: 4, EMP_NAME: 5, KHO: 6, MODEL: 7, SLOT: 8,
  PHONE: 9, ADDRESS: 10, AGREE: 11, STATUS: 12, PAYER_NAME: 13, PAYER_CODE: 14,
  AMOUNT: 15, BANK_TXN: 16, PAY_TIME: 17, RECEIPT: 18, PM_BY: 19, PM_DATE: 20, NOTE: 21, UA: 22,
  SERIAL: 23 // 06/10/2026: Serial Number của máy đã đăng ký (bản chụp lúc đăng ký) — cột W, thêm vào CUỐI để 22 cột cũ không đổi
};

// Số cột ghi được vào Registrations: 23 nếu sheet đủ cột (mặc định 26), nếu không thì 22 như cũ — không bao giờ làm hỏng lượt đăng ký
function regWidth_(sheet) { return sheet.getMaxColumns() >= C.SERIAL ? C.SERIAL : C.UA; }

/* ---------- Mở sheet (1 lần mỗi lượt chạy) ---------- */
var _book = null;
function book_() {
  if (_book) return _book;
  try { var a = SpreadsheetApp.getActiveSpreadsheet(); if (a) return (_book = a); } catch (e) {}
  // v1-hardening: Script Property SPREADSHEET_ID (nếu có) được ưu tiên, để bản STAGING dùng chung Code.gs mà không sửa code
  var propId = '';
  try { propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || ''; } catch (e) {}
  var id = propId || SPREADSHEET_ID;
  if (id && id.trim() !== '' && id !== 'YOUR_SPREADSHEET_ID_HERE') {
    return (_book = SpreadsheetApp.openById(id));
  }
  throw new Error('Chưa cấu hình SPREADSHEET_ID! Hãy chạy hàm setupNewDatabase() trong trình soạn thảo Apps Script để tự động tạo cơ sở dữ liệu trên Drive của bạn.');
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'taken') return json_(taken_(p));
  return json_({ ok: true, service: 'LG Internal Sales API', version: '8.3-v1-hardening', time: new Date().toISOString() });
}

// v1-hardening (V1-04): danh sách slot đã có người giữ của 1 chương trình, cho polling kho phía nhân viên.
// Dùng lại products_() — cache 'prod_<ID>' của nó bị xoá mỗi khi đăng ký / hủy / từ chối / hết hạn, nên luôn mới.
function taken_(p) {
  var programId = str_(p.programId);
  if (!programId) return { ok: false, message: 'Thiếu programId.', taken: [] };
  var res = products_({ programId: programId });
  if (!res.ok) return { ok: false, message: res.message, taken: [] };
  var taken = [];
  for (var i = 0; i < res.products.length; i++) {
    if (res.products[i].status !== 'Available') taken.push(res.products[i].uniqueCode);
  }
  return { ok: true, programId: programId, taken: taken, time: new Date().toISOString() };
}

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.action === 'auth') return json_(auth_(data));
    if (data.action === 'change_password') return json_(change_password_(data));
    if (data.action === 'programs') return json_(programs_(data));
    if (data.action === 'program_create') return json_(program_create_(data));
    if (data.action === 'program_update') return json_(program_update_(data));
    if (data.action === 'program_delete') return json_(program_delete_(data));
    if (data.action === 'products') return json_(products_(data));
    if (data.action === 'product_upload' || data.action === 'products_bulk_import') return json_(product_upload_(data));
    if (data.action === 'register_product') return json_(register_product_(data));
    if (data.action === 'pm_dashboard') return json_(pm_dashboard_(data));
    if (data.action === 'pm_approve_payment') return json_(pm_approve_payment_(data));
    if (data.action === 'pm_batch_approve_payment' || data.action === 'pm_batch_approve_payments') return json_(pm_batch_approve_payment_(data));
    if (data.action === 'pm_reject_payment') return json_(pm_reject_payment_(data));
    if (data.action === 'pm_allow_payment') return json_(pm_allow_payment_(data));
    if (data.action === 'check_expired_slots') return json_(check_expired_slots_(data));
    if (data.action === 'register') return json_(register_(data));
    if (data.action === 'payment' || data.action === 'submit_payment') return json_(payment_(data));
    if (data.action === 'lookup') return json_(lookup_(data));
    if (data.action === 'user_cancel_registration') return json_(user_cancel_registration_(data));
    if (data.action === 'email_setting') return json_(email_setting_(data));
    return json_({ ok: false, message: 'Yêu cầu không hợp lệ.' });
  } catch (err) {
    try { log_('ERROR', '', '', '', String(err)); } catch (e2) {}
    return json_({ ok: false, message: 'Lỗi máy chủ: ' + err });
  }
}


/* ---------- P5: Concurrency & Caching Helpers ---------- */
var CACHE_TTL_SEC = 60; // 60s cache on Apps Script server

function getCachedJson_(key) {
  try {
    var c = CacheService.getScriptCache().get(key);
    if (c) return JSON.parse(c);
  } catch (e) {}
  return null;
}

function putCachedJson_(key, obj, ttlSec) {
  try {
    var str = JSON.stringify(obj);
    if (str.length < 95000) { // under 100KB limit of CacheService
      CacheService.getScriptCache().put(key, str, ttlSec || CACHE_TTL_SEC);
    }
  } catch (e) {}
}

function invalidateCache_(key) {
  try {
    CacheService.getScriptCache().remove(key);
  } catch (e) {}
}

/* ---------- P6: Password Security & Hashing ---------- */
var PASSWORD_SALT = 'LG_VN_INTERNAL_SALES_2026_SALT_';

function hashPassword_(pw) {
  if (!pw) return '';
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, PASSWORD_SALT + pw, Utilities.Charset.UTF_8);
  var hash = '';
  for (var i = 0; i < raw.length; i++) {
    var b = raw[i];
    if (b < 0) b += 256;
    var byteString = b.toString(16);
    if (byteString.length === 1) byteString = '0' + byteString;
    hash += byteString;
  }
  return 'sha256:' + hash;
}

function verifyPassword_(inputPw, storedPw) {
  if (!inputPw || !storedPw) return false;
  // If stored password is in SHA-256 hashed format
  if (storedPw.indexOf('sha256:') === 0) {
    return hashPassword_(inputPw) === storedPw;
  }
  // Fallback for legacy plaintext password in Google Sheet
  return storedPw === inputPw;
}

/* ---------- P6.1: Zero-Trust HMAC-SHA256 Tokenization (SEC-01) ---------- */
// v1-hardening (V1-06): khóa bí mật ngẫu nhiên, không suy ra từ SPREADSHEET_ID (ID này đã công khai trên GitHub).
// Không có fallback cố định: nếu không đọc được Script Properties thì báo lỗi thay vì dùng khóa đoán được.
function getServerSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SESSION_SECRET_KEY');
  if (!secret) {
    secret = newRandomSecret_();
    props.setProperty('SESSION_SECRET_KEY', secret);
  }
  return secret;
}

function newRandomSecret_() {
  return Utilities.getUuid() + '-' + Utilities.getUuid() + '-' + new Date().getTime();
}

/**
 * ADMIN chạy tay 1 lần trước go-live (và bất cứ khi nào nghi ngờ lộ khóa):
 * thay khóa ký phiên đăng nhập → mọi phiên cũ hết hiệu lực, mọi người đăng nhập lại 1 lần.
 * Xem docs/04-v1-hardening/V1_RELEASE_RUNBOOK.md
 */
function rotateSessionSecret() {
  PropertiesService.getScriptProperties().setProperty('SESSION_SECRET_KEY', newRandomSecret_());
  try { log_('ROTATE_SESSION_SECRET', 'ADMIN', '', '', 'Đã thay khóa ký phiên; mọi phiên cũ hết hiệu lực'); } catch (e) {}
  Logger.log('Đã thay khóa ký phiên đăng nhập. Mọi người cần đăng nhập lại 1 lần.');
  return { ok: true };
}

// Chữ ký demo chỉ được chấp nhận khi Config có ALLOW_DEMO_TOKENS = true (dùng cho STAGING). Mặc định: tắt.
function demoTokensAllowed_() {
  try { return String(config_()['ALLOW_DEMO_TOKENS'] || '').toLowerCase() === 'true'; } catch (e) { return false; }
}

function generateSessionToken_(user) {
  var exp = new Date().getTime() + (24 * 60 * 60 * 1000); // 24 hours expiry
  var payloadObj = {
    uid: String(user.id || '').toUpperCase(),
    role: String(user.role || 'USER').toUpperCase(),
    name: String(user.name || ''),
    exp: exp
  };
  var payloadStr = Utilities.base64EncodeWebSafe(JSON.stringify(payloadObj));
  var secret = getServerSecret_();
  var sigBytes = Utilities.computeHmacSha256Signature(payloadStr, secret);
  var sigStr = Utilities.base64EncodeWebSafe(sigBytes);
  return payloadStr + '.' + sigStr;
}

function verifySessionToken_(tokenStr, requiredRole) {
  if (!tokenStr || typeof tokenStr !== 'string') {
    return { valid: false, message: 'Thiếu Token phiên làm việc (Chưa đăng nhập hoặc phiên đã kết thúc).' };
  }
  var parts = tokenStr.split('.');
  if (parts.length !== 2) {
    return { valid: false, message: 'Token phiên làm việc có định dạng không hợp lệ.' };
  }
  
  var payloadStr = parts[0];
  var clientSig = parts[1];
  var secret = getServerSecret_();
  var expectedSigBytes = Utilities.computeHmacSha256Signature(payloadStr, secret);
  var expectedSig = Utilities.base64EncodeWebSafe(expectedSigBytes);
  
  if (clientSig !== expectedSig) {
    // v1-hardening (V1-05): chữ ký demo KHÔNG còn được chấp nhận mặc định, và nếu được bật thì vẫn
    // phải qua kiểm tra hạn dùng + quyền như token thật (không còn bỏ qua requiredRole).
    if (!(clientSig === 'demo_local_signature' && demoTokensAllowed_())) {
      return { valid: false, message: 'Chữ ký phiên làm việc không hợp lệ (Phát hiện can thiệp dữ liệu).' };
    }
  }
  
  try {
    var jsonStr = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadStr)).getDataAsString();
    var payload = JSON.parse(jsonStr);
    var now = new Date().getTime();
    if (payload.exp && payload.exp < now) {
      return { valid: false, message: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.' };
    }
    // v1-hardening (ADMIN): ADMIN có toàn bộ quyền PM; quyền 'ADMIN' (cài đặt hệ thống) chỉ ADMIN có
    if (requiredRole) {
      var have = String(payload.role).toUpperCase(), need = String(requiredRole).toUpperCase();
      if (!(have === need || (need === 'PM' && have === 'ADMIN'))) {
        return { valid: false, message: 'Bạn không có quyền ' + requiredRole + ' để thực hiện thao tác này.' };
      }
    }
    return { valid: true, payload: payload };
  } catch (e) {
    return { valid: false, message: 'Không thể giải mã dữ liệu token: ' + e };
  }
}

// v1-hardening (ADMIN): role ADMIN trong sheet Users (hoặc mã NV 'ADMIN' như trước) = quản trị toàn hệ thống:
// làm mọi việc của PM trên MỌI chương trình + cài đặt hệ thống (vd. công tắc email).
function isAdminPayload_(payload) {
  return !!payload && (String(payload.role || '').toUpperCase() === 'ADMIN' || String(payload.uid || '').toUpperCase() === 'ADMIN');
}

function verifyToken_(tokenStr, requiredRole) {
  return verifySessionToken_(tokenStr, requiredRole);
}

/* ---------- P7: Automated Email System ---------- */
function findUserEmail_(empCode) {
  if (!empCode) return '';
  var sheet = book_().getSheetByName(SHEET_USERS);
  if (!sheet) return '';
  var n = sheet.getLastRow() - 1;
  if (n <= 0) return '';
  var users = sheet.getRange(2, 1, n, 6).getValues();
  for (var i = 0; i < n; i++) {
    if (String(users[i][0]).trim().toUpperCase() === empCode.toUpperCase()) {
      return String(users[i][5]).trim(); // Column F = Email
    }
  }
  return '';
}

function sendEmailNotification_(type, empName, empCode, email, details) {
  if (!email || !empCode) return false;
  var cfg = config_();
  var enabled = String(cfg['ENABLE_AUTO_EMAIL'] || '').toLowerCase() === 'true';
  var nowStr = fmt_(new Date());

  var subject = '';
  var bodyHtml = '';
  details = details || {};
  if (!details.serial && details.slotId) details.serial = prodSerials_()[details.slotId] || '';
  var snHtml = details.serial ? ' <span style="color:#716F6A; font-size:12px;">· S/N ' + details.serial + '</span>' : '';

  var brandHeader = '<div style="background:#A50034; color:#FFFFFF; padding:18px 24px; border-radius:8px 8px 0 0; font-family:Arial,sans-serif;">' +
    '<h2 style="margin:0; font-size:18px; letter-spacing:0.02em;">LG ELECTRONICS VIETNAM — CỔNG BÁN HÀNG NỘI BỘ</h2>' +
    '<div style="font-size:12px; opacity:0.9; margin-top:4px;">Chính trực · Minh bạch (Jeong-Do Management)</div>' +
    '</div>';

  var brandFooter = '<div style="background:#F0ECE4; color:#716F6A; padding:14px 24px; border-radius:0 0 8px 8px; font-size:11px; line-height:1.5; font-family:Arial,sans-serif; border-top:1px solid #CBC8C2;">' +
    '<div>Đây là email tự động từ Hệ thống Bán hàng Nội bộ LG Electronics Việt Nam.</div>' +
    '<div>Mọi thắc mắc vui lòng liên hệ PM phụ trách hoặc bộ phận Audit & Jeong-Do Management.</div>' +
    '</div>';

  if (type === 'REGISTRATION_CONFIRM') {
    subject = '[LG Internal Sales] Xác nhận giữ chỗ đơn hàng ' + (details.slotId || '') + ' - ' + (details.model || '');
    bodyHtml = '<div style="max-width:600px; margin:0 auto; border:1px solid #CBC8C2; border-radius:8px; font-family:Arial,sans-serif; color:#262626;">' +
      brandHeader +
      '<div style="padding:24px; line-height:1.6; font-size:13.5px;">' +
      '<p>Xin chào <strong>' + empName + '</strong> (Mã NV: <strong>' + empCode + '</strong>),</p>' +
      '<p>Bạn đã đăng ký giữ chỗ thành công sản phẩm trong chương trình bán hàng nội bộ:</p>' +
      '<div style="background:#F6F3EB; padding:14px 18px; border-radius:6px; border-left:4px solid #A50034; margin:16px 0;">' +
      '<div>• Mã Slot: <strong style="color:#A50034;">' + (details.slotId || '') + '</strong> (Kho: ' + (details.kho || '') + ')</div>' +
      '<div>• Model: <strong>' + (details.model || '') + '</strong>' + snHtml + '</div>' +
      '<div>• Số tiền thanh toán: <strong style="color:#A50034; font-size:15px;">' + (details.priceText || '') + '</strong></div>' +
      '<div>• Trạng thái: <strong style="color:#B7950B;">Đã đăng ký (Chờ PM duyệt mở cổng thanh toán)</strong></div>' +
      '</div>' +
      '<div style="font-size:12.5px; background:#FFF9E6; border:1px solid #FFE082; padding:12px; border-radius:6px; margin:14px 0;">' +
      'ℹ️ <strong>Quy trình kiểm soát:</strong> Để đảm bảo tính minh bạch và tránh chuyển khoản trùng, PM sẽ rà soát danh sách trước khi mở cổng thanh toán. Ngay khi PM mở cổng, bạn sẽ nhận được email hướng dẫn chuyển khoản và thời hạn nộp tiền 24 giờ sẽ chính thức bắt đầu.' +
      '</div>' +
      '</div>' +
      brandFooter +
      '</div>';
  } else if (type === 'PAYMENT_GATE_OPENED') {
    subject = '[LG Internal Sales] Cổng thanh toán đã mở cho đơn hàng ' + (details.slotId || '') + ' - ' + (details.model || '');
    bodyHtml = '<div style="max-width:600px; margin:0 auto; border:1px solid #CBC8C2; border-radius:8px; font-family:Arial,sans-serif; color:#262626;">' +
      brandHeader +
      '<div style="padding:24px; line-height:1.6; font-size:13.5px;">' +
      '<p>Xin chào <strong>' + empName + '</strong> (Mã NV: <strong>' + empCode + '</strong>),</p>' +
      '<p style="color:#0E6251; font-weight:bold; font-size:15px;">✓ Đơn hàng ' + (details.slotId || '') + ' đã được PM kiểm duyệt và CHÍNH THỨC MỞ CỔNG THANH TOÁN!</p>' +
      '<div style="background:#E8F8F5; padding:14px 18px; border-radius:6px; border-left:4px solid #117A65; margin:16px 0;">' +
      '<div>• Mã Slot: <strong style="color:#A50034;">' + (details.slotId || '') + '</strong> (Kho: ' + (details.kho || '') + ')</div>' +
      '<div>• Model: <strong>' + (details.model || '') + '</strong>' + snHtml + '</div>' +
      '<div>• Thời hạn nộp tiền: <strong>24 giờ</strong> kể từ thời điểm mở cổng (' + (details.openTime || '') + ').</div>' +
      '</div>' +
      '<p><strong>Hướng dẫn chuyển khoản VietQR:</strong></p>' +
      '<div style="font-size:12.5px; background:#FFFFFF; border:1px dashed #CBC8C2; padding:12px; border-radius:6px;">' +
      '<div>• Ngân hàng: <strong>Vietcombank - Chi nhánh Tây Hồ</strong></div>' +
      '<div>• Số tài khoản: <strong>0991000012525</strong></div>' +
      '<div>• Chủ tài khoản: <strong>CÔNG TY TNHH LG ELECTRONICS VIỆT NAM HẢI PHÒNG</strong></div>' +
      '<div>• Cú pháp bắt buộc: <code style="background:#E6E1D6; padding:2px 6px; font-weight:bold;">' + empCode + ' ' + (details.slotId || '') + '</code></div>' +
      '</div>' +
      '<p style="margin-top:16px;">Vui lòng vào lại hệ thống, nộp tiền và tải ảnh biên lai để PM đối soát xuất hàng.</p>' +
      '</div>' +
      brandFooter +
      '</div>';
  } else if (type === 'PAYMENT_APPROVED') {
    subject = '[LG Internal Sales] Đơn hàng ' + (details.slotId || '') + ' đã được phê duyệt thanh toán';
    bodyHtml = '<div style="max-width:600px; margin:0 auto; border:1px solid #CBC8C2; border-radius:8px; font-family:Arial,sans-serif; color:#262626;">' +
      brandHeader +
      '<div style="padding:24px; line-height:1.6; font-size:13.5px;">' +
      '<p>Xin chào <strong>' + empName + '</strong>,</p>' +
      '<p style="color:#1B5E20; font-weight:bold; font-size:15px;">✓ Đơn hàng ' + (details.slotId || '') + ' của bạn đã được PM kiểm tra và PHÊ DUYỆT hoàn tất!</p>' +
      '<div style="background:#E8F5E9; padding:14px 18px; border-radius:6px; border:1px solid #A5D6A7; margin:16px 0;">' +
      '<div>• Sản phẩm: <strong>' + (details.model || '') + '</strong>' + snHtml + '</div>' +
      '<div>• Địa điểm nhận hàng: <strong>' + (details.kho || '') + '</strong></div>' +
      '<div>• Người phê duyệt: <strong>' + (details.pmName || 'PM Quản trị') + '</strong> (' + nowStr + ')</div>' +
      '</div>' +
      '<p>Bạn có thể mang thẻ nhân viên LG đến kho ' + (details.kho || '') + ' để làm thủ tục nhận sản phẩm theo lịch thông báo của PM.</p>' +
      '</div>' +
      brandFooter +
      '</div>';
  } else if (type === 'PAYMENT_REJECTED') {
    subject = '[LG Internal Sales] Cảnh báo: Đơn hàng ' + (details.slotId || '') + ' bị từ chối';
    bodyHtml = '<div style="max-width:600px; margin:0 auto; border:1px solid #CBC8C2; border-radius:8px; font-family:Arial,sans-serif; color:#262626;">' +
      brandHeader +
      '<div style="padding:24px; line-height:1.6; font-size:13.5px;">' +
      '<p>Xin chào <strong>' + empName + '</strong>,</p>' +
      '<p style="color:#C62828; font-weight:bold;">Đơn hàng ' + (details.slotId || '') + ' của bạn đã bị PM từ chối duyệt chứng từ.</p>' +
      '<div style="background:#FFEBEE; padding:14px 18px; border-radius:6px; border:1px solid #FFCDD2; margin:16px 0;">' +
      '<div>• Lý do từ chối: <strong style="color:#B71C1C;">' + (details.reason || 'Chứng từ không hợp lệ hoặc sai số tiền') + '</strong></div>' +
      '<div>• Trạng thái slot: Đã hoàn lại kho khả dụng.</div>' +
      '</div>' +
      '<p>Nếu có thắc mắc, vui lòng liên hệ ngay với PM phụ trách để được hỗ trợ.</p>' +
      '</div>' +
      brandFooter +
      '</div>';
  } else if (type === 'EXPIRATION_WARNING') {
    subject = '[LG Internal Sales] Nhắc nhở: Đơn hàng ' + (details.slotId || '') + ' sắp hết hạn nộp tiền (còn 2 giờ)';
    bodyHtml = '<div style="max-width:600px; margin:0 auto; border:1px solid #CBC8C2; border-radius:8px; font-family:Arial,sans-serif; color:#262626;">' +
      brandHeader +
      '<div style="padding:24px; line-height:1.6; font-size:13.5px;">' +
      '<p>Xin chào <strong>' + empName + '</strong> (Mã NV: <strong>' + empCode + '</strong>),</p>' +
      '<p style="color:#D35400; font-weight:bold;">⚠️ Cảnh báo thời hạn nộp tiền giữ chỗ:</p>' +
      '<div style="background:#FEF9E7; padding:14px 18px; border-radius:6px; border-left:4px solid #F39C12; margin:16px 0;">' +
      '<div>• Mã Slot: <strong>' + (details.slotId || '') + '</strong> (Model: ' + (details.model || '') + ')' + snHtml + '</div>' +
      '<div>• Thời gian đăng ký: <strong>' + (details.regTime || '') + '</strong></div>' +
      '<div>• Thời hạn còn lại: <strong style="color:#C0392B;">Khoảng 2 giờ</strong> trước khi slot bị tự động giải phóng.</div>' +
      '</div>' +
      '<p>Nếu bạn đã nộp tiền qua VietQR, vui lòng truy cập ngay hệ thống và tải lên ảnh biên lai để PM đối soát.</p>' +
      '</div>' +
      brandFooter +
      '</div>';
  } else if (type === 'EXPIRATION_ALERT') {
    subject = '[LG Internal Sales] Thông báo: Slot ' + (details.slotId || '') + ' đã bị giải phóng do quá hạn 24 giờ';
    bodyHtml = '<div style="max-width:600px; margin:0 auto; border:1px solid #CBC8C2; border-radius:8px; font-family:Arial,sans-serif; color:#262626;">' +
      brandHeader +
      '<div style="padding:24px; line-height:1.6; font-size:13.5px;">' +
      '<p>Xin chào <strong>' + empName + '</strong> (Mã NV: <strong>' + empCode + '</strong>),</p>' +
      '<p style="color:#78281F; font-weight:bold;">Đơn hàng ' + (details.slotId || '') + ' đã hết thời hạn nộp tiền (24 giờ):</p>' +
      '<div style="background:#F2D7D5; padding:14px 18px; border-radius:6px; border-left:4px solid #922B21; margin:16px 0;">' +
      '<div>• Mã Slot: <strong>' + (details.slotId || '') + '</strong> (Model: ' + (details.model || '') + ')' + snHtml + '</div>' +
      '<div>• Trạng thái hiện tại: <strong style="color:#922B21;">Đã hủy giữ chỗ & mở lại kho công khai.</strong></div>' +
      '</div>' +
      '<p>Theo chính sách FCFS của chương trình bán hàng nội bộ, các suất chưa nộp tiền sau 24h được tự động mở lại cho các nhân viên khác.</p>' +
      '</div>' +
      brandFooter +
      '</div>';
  }

  // 1. Log to AutoEmail sheet
  try {
    var emailSheet = book_().getSheetByName(SHEET_AUTO_EMAIL);
    if (emailSheet) {
      emailSheet.appendRow([
        empName,
        empCode,
        email,
        type + (enabled ? ' [SENT]' : ' [SIMULATED]'),
        nowStr
      ]);
    }
  } catch (eLog) {
    Logger.log('AutoEmail sheet append error: ' + eLog);
  }

  // 2. Send actual email via MailApp if enabled
  if (enabled && subject && bodyHtml) {
    // T3.2 Circuit Breaker Check: Don't call MailApp if daily quota is exhausted
    try {
      var circuitOpen = CacheService.getScriptCache().get('MAIL_CIRCUIT_OPEN');
      if (circuitOpen === 'true') {
        try { log_('AUTO_EMAIL_CIRCUIT_OPEN', empCode, empName, '', 'MailApp quota circuit breaker active. Email deferred: ' + type); } catch (e) {}
        return false;
      }
    } catch (eCb) {}

    try {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: bodyHtml
      });
      try { log_('AUTO_EMAIL_SENT', empCode, empName, '', type + ' to ' + email); } catch (e) {}
      return true;
    } catch (eSend) {
      var errStr = String(eSend);
      if (errStr.indexOf('too many times') >= 0 || errStr.indexOf('quota') >= 0 || errStr.indexOf('limit') >= 0) {
        // Quota exceeded: open circuit breaker for 1 hour to prevent blocking transactions
        try {
          CacheService.getScriptCache().put('MAIL_CIRCUIT_OPEN', 'true', 3600);
          log_('MAIL_QUOTA_EXCEEDED', empCode, empName, '', 'Circuit breaker tripped: ' + errStr);
        } catch (eQuota) {}
      } else {
        try { log_('AUTO_EMAIL_FAIL', empCode, empName, '', errStr); } catch (e2) {}
      }
      return false;
    }
  }
  return true;
}

/* ---------- P1: Multi-Program ---------- */
var PROG_COL = { ID: 1, NAME: 2, PM_ID: 3, PM_NAME: 4, STATUS: 5, START: 6, END: 7, DESC: 8, MAX_PER: 9, CREATED: 10 };

// List programs — users see Open only, PM sees all their programs (with P5 Caching)
function programs_(d) {
  var role = str_(d.role) || 'USER';
  var userId = str_(d.userId).toUpperCase();
  var cacheKey = 'prog_' + role + '_' + (role === 'PM' ? userId : 'all'); // ADMIN → 'prog_ADMIN_all'

  var cached = getCachedJson_(cacheKey);
  if (cached) return { ok: true, programs: cached, cached: true };

  var sheet = book_().getSheetByName(SHEET_PROGRAMS);
  if (!sheet) return { ok: true, programs: [] };
  var n = sheet.getLastRow() - 1;
  if (n <= 0) return { ok: true, programs: [] };
  var data = sheet.getRange(2, 1, n, 10).getValues();
  var result = [];
  for (var r = 0; r < n; r++) {
    var status = String(data[r][PROG_COL.STATUS - 1]).trim();
    var pmId = String(data[r][PROG_COL.PM_ID - 1]).trim().toUpperCase();
    // Multi-PM Isolation & Role-Based Access Control (RBAC):
    if (role === 'PM' || role === 'ADMIN') {
      // SuperAdmin (role ADMIN hoặc mã 'ADMIN') sees all; each PM sees ONLY their own programs
      if (role !== 'ADMIN' && userId !== 'ADMIN' && pmId !== userId) {
        continue;
      }
    } else {
      // Normal employees (USER) see all Open programs across all PMs
      if (status !== 'Open') {
        continue;
      }
    }
    result.push({
      id: String(data[r][0]).trim(),
      name: String(data[r][1]).trim(),
      pmId: pmId,
      pmName: String(data[r][3]).trim(),
      status: status,
      startDate: String(data[r][5]).trim(),
      endDate: String(data[r][6]).trim(),
      description: String(data[r][7]).trim(),
      maxPerEmployee: Number(data[r][8]) || 1
    });
  }
  putCachedJson_(cacheKey, result, 60);
  return { ok: true, programs: result };
}

// Khóa cache do programs_() tạo: 'prog_USER_all' (nhân viên) và 'prog_PM_<ID>' (từng PM, kể cả ADMIN)
function invalidateProgramCaches_(ownerPmId) {
  invalidateCache_('prog_USER_all');
  invalidateCache_('prog_PM_ADMIN');
  invalidateCache_('prog_ADMIN_all');
  if (ownerPmId) invalidateCache_('prog_PM_' + String(ownerPmId).toUpperCase());
}

// PM creates a new program
function program_create_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };
  var req = ['programId', 'programName', 'startDate', 'endDate'];
  for (var i = 0; i < req.length; i++) {
    if (!str_(d[req[i]])) return { ok: false, message: 'Thiếu: ' + req[i] };
  }
  var sheet = book_().getSheetByName(SHEET_PROGRAMS);
  if (!sheet) return { ok: false, message: 'Sheet Programs chưa tồn tại.' };

  // Check duplicate ProgramID
  var n = sheet.getLastRow() - 1;
  if (n > 0) {
    var ids = sheet.getRange(2, 1, n, 1).getValues();
    for (var r = 0; r < n; r++) {
      if (String(ids[r][0]).trim().toUpperCase() === str_(d.programId).toUpperCase()) {
        return { ok: false, message: 'Mã chương trình đã tồn tại: ' + d.programId };
      }
    }
  }

  var pmId = authCheck.payload.uid || str_(d.userId);
  var pmName = authCheck.payload.name || str_(d.userName);
  var initStatus = str_(d.status) || 'Open';
  var row = [
    str_(d.programId),
    str_(d.programName),
    pmId,
    pmName,
    initStatus,
    str_(d.startDate),
    str_(d.endDate),
    str_(d.description) || '',
    Number(d.maxPerEmployee) || 1,
    new Date().toISOString()
  ];
  sheet.appendRow(row);
  invalidateProgramCaches_(pmId); // v1-hardening (V1-13): đúng khóa cache mà programs_() tạo
  try { log_('PROGRAM_CREATE', pmId, pmName, '', 'program=' + d.programId + ' status=' + initStatus); } catch (e2) {}
  return { ok: true, message: 'Đã tạo chương trình ' + d.programId + ' (' + initStatus + ').' };
}

// PM updates program status (Draft→Open, Open→Closed)
function program_update_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };
  var progId = str_(d.programId);
  var newStatus = str_(d.newStatus);
  if (!progId || !newStatus) return { ok: false, message: 'Thiếu programId hoặc newStatus.' };
  if (['Open', 'Closed'].indexOf(newStatus) < 0) return { ok: false, message: 'Trạng thái không hợp lệ. Chỉ chấp nhận: Open, Closed.' };

  var sheet = book_().getSheetByName(SHEET_PROGRAMS);
  if (!sheet) return { ok: false, message: 'Sheet Programs chưa tồn tại.' };
  var n = sheet.getLastRow() - 1;
  if (n <= 0) return { ok: false, message: 'Không tìm thấy chương trình.' };

  var data = sheet.getRange(2, 1, n, 5).getValues();
  for (var r = 0; r < n; r++) {
    if (String(data[r][0]).trim().toUpperCase() === progId.toUpperCase()) {
      var pmOwnerId = String(data[r][PROG_COL.PM_ID - 1]).trim().toUpperCase();
      if (!isAdminPayload_(authCheck.payload) && pmOwnerId !== authCheck.payload.uid) {
        return { ok: false, message: 'Từ chối thẩm quyền: Bạn không có quyền kết sổ hoặc cập nhật trạng thái chương trình của PM khác (' + pmOwnerId + ').' };
      }
      var currentStatus = String(data[r][4]).trim();
      // Validate transition: Draft→Open, Open→Closed
      if (newStatus === 'Open' && currentStatus !== 'Draft') {
        return { ok: false, message: 'Chỉ có thể mở chương trình đang ở trạng thái Draft.' };
      }
      if (newStatus === 'Closed' && currentStatus !== 'Open') {
        return { ok: false, message: 'Chỉ có thể kết sổ chương trình đang Open.' };
      }
      sheet.getRange(r + 2, PROG_COL.STATUS).setValue(newStatus);
      invalidateProgramCaches_(pmOwnerId); // v1-hardening (V1-13)
      try { log_('PROGRAM_' + newStatus.toUpperCase(), authCheck.payload.uid, authCheck.payload.name, '', 'program=' + progId); } catch (e2) {}
      return { ok: true, message: 'Đã chuyển chương trình ' + progId + ' sang ' + newStatus + '.' };
    }
  }
  return { ok: false, message: 'Không tìm thấy chương trình ' + progId + '.' };
}

// PM deletes an empty / draft program (Jeong-Do compliant: 0 registrations only)
function program_delete_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };

  var programId = str_(d.programId);
  if (!programId) return { ok: false, message: 'Thiếu mã chương trình cần xóa.' };

  var callerId = String(authCheck.payload.uid || '').toUpperCase();
  var progSheet = book_().getSheetByName(SHEET_PROGRAMS);
  if (!progSheet) return { ok: false, message: 'Sheet Programs không tồn tại.' };

  var pn = progSheet.getLastRow() - 1;
  if (pn <= 0) return { ok: false, message: 'Không tìm thấy chương trình.' };

  var pData = progSheet.getRange(2, 1, pn, 3).getValues();
  var targetRow = -1;
  var ownerId = '';

  for (var r = 0; r < pn; r++) {
    if (String(pData[r][0]).trim().toUpperCase() === programId.toUpperCase()) {
      targetRow = r + 2;
      ownerId = String(pData[r][2]).trim().toUpperCase();
      break;
    }
  }

  if (targetRow === -1) return { ok: false, message: 'Không tìm thấy chương trình: ' + programId };

  // Ownership check: Only the PM who created it or ADMIN can delete
  if (!isAdminPayload_(authCheck.payload) && ownerId !== callerId) {
    return { ok: false, message: 'Bạn không có quyền xóa chương trình này vì thuộc sở hữu của PM khác (' + ownerId + ').' };
  }

  // Jeong-Do Audit Protection: Check if any registrations exist
  var regSheet = book_().getSheetByName(SHEET_REG);
  if (regSheet) {
    var rn = regSheet.getLastRow() - 1;
    if (rn > 0) {
      var regCampaigns = regSheet.getRange(2, C.CAMPAIGN, rn, 1).getValues();
      var orderCount = 0;
      for (var ri = 0; ri < rn; ri++) {
        if (String(regCampaigns[ri][0]).trim().toUpperCase() === programId.toUpperCase()) {
          orderCount++;
        }
      }
      if (orderCount > 0) {
        return {
          ok: false,
          message: 'Không thể xóa đợt bán "' + programId + '" vì đã có ' + orderCount + ' đơn đăng ký. Theo quy chuẩn kiểm toán Jeong-Do của LG, bạn chỉ có thể chọn "Kết sổ chương trình" để bảo toàn lịch sử giao dịch.'
        };
      }
    }
  }

  // Safe to delete: Delete from Programs sheet
  progSheet.deleteRow(targetRow);

  // Also clean up products in Products / Slots sheet
  var prodSheet = book_().getSheetByName(SHEET_PRODUCTS);
  if (prodSheet) {
    var prn = prodSheet.getLastRow() - 1;
    if (prn > 0) {
      for (var pi = prn; pi >= 1; pi--) {
        var pProgId = String(prodSheet.getRange(pi + 1, PROD_COL.PROG).getValue()).trim().toUpperCase();
        if (pProgId === programId.toUpperCase()) {
          prodSheet.deleteRow(pi + 1);
        }
      }
    }
  }

  // Invalidate caches
  invalidateCache_('prog_PM_' + callerId);
  invalidateCache_('prog_USER_all');
  invalidateCache_('prog_PM_all');
  invalidateCache_('prod_' + programId.toUpperCase());

  try { log_('PROGRAM_DELETE', callerId, programId, d.userAgent, 'Xóa an toàn chương trình 0 đơn'); } catch (e) {}
  return { ok: true, message: 'Đã xóa thành công chương trình ' + programId + '!' };
}

/* ---------- P2: Products ---------- */
var PROD_COL = { PROG: 1, CODE: 2, KHO: 3, CAT: 4, MODEL: 5, DESC: 6, RRP: 7, PRICE: 8, QTY: 9, STATUS: 10, EMP: 11, TS: 12, SERIAL: 13 };

// 06/10/2026: Serial Number (số định danh từng máy do LG cấp) ở cột M của Products — thêm vào CUỐI nên mọi chỗ đọc 12 cột cũ
// không đổi. Sheet cũ chưa có cột M → serial rỗng, web ẩn đi. Registrations không thêm cột: serial lấy theo Mã Slot.
var _prodSerials = null;
function prodSerials_() {
  if (_prodSerials) return _prodSerials;
  _prodSerials = {};
  try {
    var sh = book_().getSheetByName(SHEET_PRODUCTS);
    if (sh && sh.getLastRow() > 1 && sh.getLastColumn() >= PROD_COL.SERIAL) {
      var v = sh.getRange(2, PROD_COL.CODE, sh.getLastRow() - 1, PROD_COL.SERIAL - PROD_COL.CODE + 1).getValues();
      for (var i = 0; i < v.length; i++) {
        var code = String(v[i][0]).trim(), sn = String(v[i][PROD_COL.SERIAL - PROD_COL.CODE]).trim();
        if (code && sn) _prodSerials[code] = sn;
      }
    }
  } catch (e) {}
  return _prodSerials;
}

// List products for a program (with P5 Caching)
function products_(d) {
  var programId = str_(d.programId);
  if (!programId) return { ok: false, message: 'Thiếu programId.' };

  var cacheKey = 'prod_' + programId.toUpperCase();
  var cached = getCachedJson_(cacheKey);
  if (cached) return { ok: true, products: cached, cached: true };

  var sheet = book_().getSheetByName(SHEET_PRODUCTS);
  if (!sheet) return { ok: true, products: [] };
  var n = sheet.getLastRow() - 1;
  if (n <= 0) return { ok: true, products: [] };

  var w = sheet.getLastColumn() >= PROD_COL.SERIAL ? PROD_COL.SERIAL : 12;
  var data = sheet.getRange(2, 1, n, w).getValues();
  var result = [];
  for (var r = 0; r < n; r++) {
    var pId = String(data[r][0]).trim();
    if (pId.toUpperCase() !== programId.toUpperCase()) continue;
    result.push({
      programId: pId,
      uniqueCode: String(data[r][1]).trim(),
      kho: String(data[r][2]).trim(),
      category: String(data[r][3]).trim(),
      model: String(data[r][4]).trim(),
      description: String(data[r][5]).trim(),
      rrp: Number(data[r][6]) || 0,
      internalPrice: Number(data[r][7]) || 0,
      qty: Number(data[r][8]) || 1,
      status: String(data[r][9]).trim() || 'Available',
      empCode: String(data[r][10]).trim(),
      timestamp: String(data[r][11]).trim(),
      serial: w >= PROD_COL.SERIAL ? String(data[r][PROD_COL.SERIAL - 1]).trim() : ''
    });
  }
  putCachedJson_(cacheKey, result, 45);
  return { ok: true, products: result };
}

// PM uploads products (batch)
function product_upload_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };
  var programId = str_(d.programId);
  if (!programId) return { ok: false, message: 'Thiếu programId.' };
  if (!isAdminPayload_(authCheck.payload) && !isProgramOwnedByPM_(programId, authCheck.payload.uid)) {
    return { ok: false, message: 'Từ chối thẩm quyền: Bạn không có quyền nạp sản phẩm vào chương trình của PM khác.' };
  }
  var items = d.items || d.products; // array of {kho, category, model, description, rrp, internalPrice, qty, serial}
  if (!items || !items.length) return { ok: false, message: 'Danh sách sản phẩm trống.' };

  var sheet = book_().getSheetByName(SHEET_PRODUCTS);
  if (!sheet) return { ok: false, message: 'Sheet Products chưa tồn tại.' };

  // Count existing products per kho for this program (to generate seq)
  var n = sheet.getLastRow() - 1;
  var khoSeq = {};
  if (n > 0) {
    var existing = sheet.getRange(2, 1, n, 3).getValues();
    for (var r = 0; r < n; r++) {
      if (String(existing[r][0]).trim().toUpperCase() === programId.toUpperCase()) {
        var k = String(existing[r][2]).trim().toUpperCase();
        khoSeq[k] = (khoSeq[k] || 0) + 1;
      }
    }
  }

  var rows = [];
  var ts = new Date().toISOString();
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var kho = str_(it.kho).toUpperCase();
    if (!kho) continue;
    khoSeq[kho] = (khoSeq[kho] || 0) + 1;
    var seq = ('000' + khoSeq[kho]).slice(-3);
    var uniqueCode = programId.toUpperCase() + '-' + kho + '-' + seq;
    rows.push([
      programId, uniqueCode, kho,
      str_(it.category), str_(it.model), str_(it.description),
      Number(it.rrp) || 0, Number(it.internalPrice) || 0,
      Number(it.qty) || 1, 'Available', '', ts,
      asText_(it.serial) // chữ: "0123…" không mất số 0 đầu, số dài không bị đổi thành 1,2E+12
    ]);
  }

  if (rows.length > 0) {
    if (sheet.getMaxColumns() < PROD_COL.SERIAL) sheet.insertColumnsAfter(sheet.getMaxColumns(), PROD_COL.SERIAL - sheet.getMaxColumns());
    if (!str_(sheet.getRange(1, PROD_COL.SERIAL).getValue())) sheet.getRange(1, PROD_COL.SERIAL).setValue('Serial');
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, PROD_COL.SERIAL).setValues(rows);
    SpreadsheetApp.flush();
  }

  invalidateCache_('prod_' + programId.toUpperCase());
  _prodSerials = null;
  try { log_('PRODUCT_UPLOAD', authCheck.payload.uid, authCheck.payload.name, '', 'program=' + programId + ' count=' + rows.length); } catch (e2) {}
  return { ok: true, message: 'Đã upload ' + rows.length + ' sản phẩm vào chương trình ' + programId + '.' };
}

/* ---------- v1-hardening helpers ---------- */
// Token hợp lệ VÀ mã NV trong token trùng mã NV của thao tác (không thao tác hộ người khác).
function requireSelf_(token, empCode) {
  var auth = verifySessionToken_(token);
  if (!auth.valid) return { ok: false, authError: true, message: auth.message };
  if (String(auth.payload.uid || '').toUpperCase() !== String(empCode || '').toUpperCase()) {
    return { ok: false, authError: true, message: 'Phiên đăng nhập không khớp mã nhân viên của thao tác này. Vui lòng đăng nhập lại.' };
  }
  return { ok: true, payload: auth.payload };
}

// Mã các slot không còn Available của 1 chương trình, từ mảng Products đã đọc sẵn (12 cột)
function takenCodesFrom_(prodData, programId) {
  var out = [];
  var pid = String(programId || '').toUpperCase();
  for (var r = 0; r < prodData.length; r++) {
    if (String(prodData[r][PROD_COL.PROG - 1]).trim().toUpperCase() !== pid) continue;
    if (String(prodData[r][PROD_COL.STATUS - 1]).trim() !== 'Available') out.push(String(prodData[r][PROD_COL.CODE - 1]).trim());
  }
  return out;
}

// Đọc sheet Programs 1 lần: các chương trình PM này sở hữu (ADMIN: tất cả).
// Dùng thay isProgramOwnedByPM_() trong vòng lặp để không đọc sheet nhiều lần khi đang giữ khóa.
function ownedPrograms_(pmId, isAdmin) {
  var uid = String(pmId || '').toUpperCase();
  var out = { all: uid === 'ADMIN' || !!isAdmin, ids: {} };
  var sh = book_().getSheetByName(SHEET_PROGRAMS);
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][2]).trim().toUpperCase() === uid) out.ids[String(v[i][0]).trim().toUpperCase()] = true;
  }
  return out;
}

function ownsProgram_(owned, programId) {
  return owned.all || !!owned.ids[String(programId || '').trim().toUpperCase()];
}

/* ---------- P3: Product Registration (Liberated Lock < 250ms, FCFS peak safe) ---------- */
function register_product_(d) {
  // Validate required fields
  var uniqueCode = str_(d.uniqueCode);
  var empCode = str_(d.empCode).toUpperCase();
  var empName = str_(d.empName);
  var programId = str_(d.programId);
  if (!uniqueCode || !empCode || !empName || !programId) {
    return { ok: false, message: 'Thiếu thông tin đăng ký.' };
  }
  // v1-hardening (V1-07): chỉ chính người đã đăng nhập mới giữ chỗ được cho mình
  var regAuth = requireSelf_(d.token, empCode);
  if (!regAuth.ok) return regAuth;

  // Pre-check program status and quota from Programs sheet before acquiring lock
  var progSheet = book_().getSheetByName(SHEET_PROGRAMS);
  var maxPer = 1;
  if (progSheet) {
    var pn = progSheet.getLastRow() - 1;
    if (pn > 0) {
      var pData = progSheet.getRange(2, 1, pn, 10).getValues();
      for (var pi = 0; pi < pn; pi++) {
        var pId = String(pData[pi][PROG_COL.ID - 1]).trim().toUpperCase();
        if (pId === programId.toUpperCase()) {
          maxPer = Number(pData[pi][PROG_COL.MAX_PER - 1]) || 1;
          var pStatus = String(pData[pi][PROG_COL.STATUS - 1]).trim();
          if (pStatus !== 'Open') {
            return { ok: false, message: 'Chương trình ' + programId + ' đã kết sổ, không thể đăng ký.' };
          }
          break;
        }
      }
    }
  }

  // Lock for atomic read-modify-write
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    return { ok: false, busy: true, message: 'Hệ thống đang bận phục vụ nhiều lượt đăng ký, vui lòng thử lại sau ít giây.' };
  }

  var targetRow = -1;
  var prodDataTarget = null;
  var ts = new Date().toISOString();

  try {
    var prodSheet = book_().getSheetByName(SHEET_PRODUCTS);
    if (!prodSheet) return { ok: false, message: 'Sheet Products không tồn tại.' };
    var n = prodSheet.getLastRow() - 1;
    if (n <= 0) return { ok: false, message: 'Không tìm thấy sản phẩm.' };

    var data = prodSheet.getRange(2, 1, n, prodSheet.getLastColumn() >= PROD_COL.SERIAL ? PROD_COL.SERIAL : 12).getValues();
    var empCount = 0;

    for (var r = 0; r < n; r++) {
      var pId = String(data[r][0]).trim().toUpperCase();
      if (pId !== programId.toUpperCase()) continue;

      var code = String(data[r][1]).trim();
      var status = String(data[r][9]).trim();
      var emp = String(data[r][10]).trim().toUpperCase();

      // Found target product
      if (code === uniqueCode) {
        if (status !== 'Available') {
          if (emp === empCode) {
            return { ok: true, message: 'Bạn đã đăng ký sản phẩm này rồi.', repeat: true };
          }
          // v1-hardening (C6): trả kèm danh sách slot đã hết để màn hình cập nhật ngay, không tốn thêm request
          return { ok: false, slotTaken: true, taken: takenCodesFrom_(data, programId),
                   message: 'Sản phẩm ' + uniqueCode + ' đã có người đăng ký trước. Vui lòng chọn sản phẩm khác.' };
        }
        targetRow = r;
      }

      // Count employee quota
      if (status === 'Registered' && emp === empCode) {
        empCount++;
      }
    }

    if (targetRow < 0) return { ok: false, message: 'Không tìm thấy sản phẩm ' + uniqueCode + '.' };
    if (empCount >= maxPer) {
      return { ok: false, message: 'Bạn đã đăng ký ' + empCount + ' sản phẩm, vượt hạn mức ' + maxPer + ' SP/nhân viên.' };
    }

    // 1 Batch write for Status, Emp, and Ts (Columns 10, 11, 12)
    var sheetRow = targetRow + 2;
    prodSheet.getRange(sheetRow, PROD_COL.STATUS, 1, 3).setValues([['Registered', empCode, ts]]);

    // Write to Registrations sheet
    var regSheet = book_().getSheetByName(SHEET_REG);
    if (regSheet) {
      prodDataTarget = data[targetRow];
      var rw = regWidth_(regSheet);
      var regRow = new Array(rw).fill('');
      regRow[0] = ts;                          // Timestamp
      regRow[1] = programId;                   // Campaign/Program
      regRow[2] = str_(d.division);            // Division
      regRow[3] = empCode;                     // Emp Code
      regRow[4] = empName;                     // Emp Name
      regRow[5] = String(prodDataTarget[2]).trim();   // Kho
      regRow[6] = String(prodDataTarget[4]).trim();   // Model
      regRow[7] = uniqueCode;                  // Slot/UniqueCode
      regRow[8] = str_(d.phone);               // Phone
      regRow[9] = str_(d.address);             // Address
      regRow[10] = 'Đồng ý';                    // Agree
      regRow[11] = STATUS_WAIT_GATE;           // Status: 'Đã đăng ký - Chờ mở thanh toán'
      regRow[C.AMOUNT - 1] = Number(prodDataTarget[PROD_COL.PRICE - 1]) || 0; // Amount
      if (rw >= C.SERIAL) regRow[C.SERIAL - 1] = asText_(prodDataTarget[PROD_COL.SERIAL - 1]); // Serial (rỗng nếu SP chưa có)
      regSheet.getRange(regSheet.getLastRow() + 1, 1, 1, rw).setValues([regRow]);
    }

    SpreadsheetApp.flush();
  } finally {
    // LIBERATE LOCK IMMEDIATELY: Under 250ms hold time!
    lock.releaseLock();
  }

  // POST-LOCK EXECUTION: Invalidation and Email run outside the critical section
  invalidateCache_('prod_' + programId.toUpperCase());

  if (prodDataTarget) {
    try {
      var empEmail = str_(d.email) || findUserEmail_(empCode);
      var priceVal = Number(prodDataTarget[PROD_COL.PRICE - 1] || 0);
      var priceStr = priceVal > 0 ? (priceVal.toLocaleString('vi-VN') + ' đ') : '';
      sendEmailNotification_('REGISTRATION_CONFIRM', empName, empCode, empEmail, {
        slotId: uniqueCode,
        kho: String(prodDataTarget[PROD_COL.KHO - 1]).trim(),
        model: String(prodDataTarget[PROD_COL.MODEL - 1]).trim(),
        priceText: priceStr
      });
    } catch (eEmail) {
      Logger.log('Email send error outside lock: ' + eEmail);
    }
  }

  try { log_('REGISTER_PRODUCT', empCode, empName, '', 'program=' + programId + ' product=' + uniqueCode + ' (Chờ mở thanh toán)'); } catch (e2) {}
  return { ok: true, message: 'Đăng ký thành công sản phẩm ' + uniqueCode + '! Đơn đang ở trạng thái chờ PM mở cổng thanh toán.' };
}

/* ---------- P4: PM Dashboard & Payment Approval (Zero-Trust SEC-01 & Batch CONC-02) ---------- */
function isProgramOwnedByPM_(programId, pmId) {
  if (!programId || !pmId) return false;
  if (String(pmId).toUpperCase() === 'ADMIN') return true;
  var progSheet = book_().getSheetByName(SHEET_PROGRAMS);
  if (!progSheet) return false;
  var pn = progSheet.getLastRow() - 1;
  if (pn <= 0) return false;
  var pData = progSheet.getRange(2, 1, pn, 3).getValues();
  for (var pi = 0; pi < pn; pi++) {
    if (String(pData[pi][0]).trim().toUpperCase() === String(programId).trim().toUpperCase()) {
      var owner = String(pData[pi][2]).trim().toUpperCase();
      return owner === String(pmId).trim().toUpperCase();
    }
  }
  return false;
}

function pm_dashboard_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };

  var programId = str_(d.programId);
  var callerId = String(authCheck.payload.uid || '').toUpperCase();

  // Multi-PM Isolation Check: PM can only view dashboard of their own program
  if (programId && !isAdminPayload_(authCheck.payload)) {
    if (!isProgramOwnedByPM_(programId, callerId)) {
      return { ok: false, message: 'Từ chối truy cập: Chương trình này thuộc quyền quản lý của PM khác.' };
    }
  }

  // v1-hardening (V1-16): PM gọi không kèm mã chương trình → chỉ trả đơn của chương trình PM đó phụ trách
  // (trước đây trả đơn của MỌI chương trình). ADMIN vẫn xem được tất cả.
  var owned = (!programId && !isAdminPayload_(authCheck.payload)) ? ownedPrograms_(callerId, false) : null;

  var regSheet = book_().getSheetByName(SHEET_REG);
  var out = [];

  // Lookup product prices to guarantee accurate revenue and price metrics
  var prodPrices = {};
  try {
    var prodSheet = book_().getSheetByName(SHEET_PRODUCTS);
    if (prodSheet && prodSheet.getLastRow() > 1) {
      var pData = prodSheet.getRange(2, 1, prodSheet.getLastRow() - 1, PROD_COL.PRICE).getValues();
      for (var pi = 0; pi < pData.length; pi++) {
        var sCode = String(pData[pi][PROD_COL.CODE - 1]).trim();
        var sPrice = Number(pData[pi][PROD_COL.PRICE - 1]) || 0;
        if (sCode && sPrice > 0) prodPrices[sCode] = sPrice;
      }
    }
  } catch (eProd) {}

  if (regSheet) {
    var n = regSheet.getLastRow() - 1;
    if (n > 0) {
      var vw = regSheet.getLastColumn() >= C.SERIAL ? C.SERIAL : 22;
      var v = regSheet.getRange(2, 1, n, vw).getValues();
      for (var r = 0; r < n; r++) {
        var pId = String(v[r][C.CAMPAIGN - 1]).trim();
        if (programId && pId.toUpperCase() !== programId.toUpperCase()) continue;
        if (owned && !ownsProgram_(owned, pId)) continue;

        var curSlot = str_(v[r][C.SLOT - 1]);
        var curAmt = Number(v[r][C.AMOUNT - 1]) || prodPrices[curSlot] || 0;

        out.push({
          id: 'REG-' + (r + 1),
          programId: pId,
          division: str_(v[r][C.DIVISION - 1]),
          empCode: str_(v[r][C.EMP_CODE - 1]),
          empName: str_(v[r][C.EMP_NAME - 1]),
          kho: str_(v[r][C.KHO - 1]),
          model: str_(v[r][C.MODEL - 1]),
          slotId: curSlot,
          phone: str_(v[r][C.PHONE - 1]),
          address: str_(v[r][C.ADDRESS - 1]),
          status: str_(v[r][C.STATUS - 1]) || 'Chờ nộp tiền',
          payerName: str_(v[r][C.PAYER_NAME - 1]),
          payerCode: str_(v[r][C.PAYER_CODE - 1]),
          amount: curAmt,
          internalPrice: curAmt,
          bankTxn: str_(v[r][C.BANK_TXN - 1]),
          payTime: str_(v[r][C.PAY_TIME - 1]),
          receipt: str_(v[r][C.RECEIPT - 1]),
          pmBy: str_(v[r][C.PM_BY - 1]),
          pmDate: str_(v[r][C.PM_DATE - 1]),
          note: str_(v[r][C.NOTE - 1]),
          serial: (vw >= C.SERIAL ? str_(v[r][C.SERIAL - 1]) : '') || prodSerials_()[curSlot] || '',
          timestamp: v[r][0] instanceof Date ? fmt_(v[r][0]) : str_(v[r][0])
        });
      }
    }
  }

  return { ok: true, registrations: out };
}

// v1-hardening (V1-10): mọi thao tác đọc-sửa-ghi sheet Registrations của PM / watchdog chạy trong cùng
// LockService với đăng ký & nộp tiền, để không ghi đè lẫn nhau. Email và nhật ký chạy SAU khi nhả khóa.
function pm_approve_payment_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };

  var slotId = str_(d.slotId);
  var regId = str_(d.regId);
  if (!slotId && !regId) return { ok: false, message: 'Thiếu slotId hoặc regId.' };

  var regSheet = book_().getSheetByName(SHEET_REG);
  if (!regSheet) return { ok: false, message: 'Sheet Registrations không tồn tại.' };

  var owned = ownedPrograms_(authCheck.payload.uid, isAdminPayload_(authCheck.payload));
  var pmName = authCheck.payload.name || str_(d.userName) || 'PM';
  var nowStr = fmt_(new Date());
  var hit = null;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return { ok: false, busy: true, message: 'Hệ thống đang bận, vui lòng thử lại sau ít giây.' };
  try {
    var n = regSheet.getLastRow() - 1;
    if (n <= 0) return { ok: false, message: 'Không tìm thấy đơn đăng ký.' };
    var data = regSheet.getRange(2, 1, n, 22).getValues();
    for (var r = 0; r < n; r++) {
      var curSlot = String(data[r][C.SLOT - 1]).trim();
      var curId = 'REG-' + (r + 1);
      if ((slotId && curSlot === slotId) || (regId && curId === regId)) {
        var pId = String(data[r][C.CAMPAIGN - 1]).trim();
        if (!ownsProgram_(owned, pId)) {
          return { ok: false, message: 'Từ chối: Bạn không có quyền phê duyệt đơn hàng thuộc chương trình của PM khác.' };
        }
        var rowNum = r + 2;
        regSheet.getRange(rowNum, C.STATUS).setValue('Đã duyệt thanh toán');
        regSheet.getRange(rowNum, C.PM_BY).setValue(pmName);
        regSheet.getRange(rowNum, C.PM_DATE).setValue(asText_(nowStr));
        SpreadsheetApp.flush();
        hit = {
          slot: curSlot,
          empCode: String(data[r][C.EMP_CODE - 1]).trim(),
          empName: String(data[r][C.EMP_NAME - 1]).trim(),
          model: String(data[r][C.MODEL - 1]).trim(),
          kho: String(data[r][C.KHO - 1]).trim()
        };
        break;
      }
    }
  } finally {
    lock.releaseLock();
  }
  if (!hit) return { ok: false, message: 'Không tìm thấy đơn đăng ký cần duyệt.' };

  // Trigger P7 Email Notification: PAYMENT_APPROVED
  try {
    sendEmailNotification_('PAYMENT_APPROVED', hit.empName, hit.empCode, findUserEmail_(hit.empCode), {
      slotId: hit.slot, model: hit.model, kho: hit.kho, pmName: pmName
    });
  } catch (eEmail) {}
  try { log_('PM_PAYMENT_APPROVE', authCheck.payload.uid, hit.slot, '', 'pm=' + pmName); } catch (e) {}
  return { ok: true, message: 'Đã phê duyệt thanh toán cho đơn ' + hit.slot + '.' };
}

// PM Batch Approve Payments (CONC-02 Single Range Batch Update)
function pm_batch_approve_payment_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };

  var regSheet = book_().getSheetByName(SHEET_REG);
  if (!regSheet) return { ok: false, message: 'Sheet Registrations không tồn tại.' };

  var regIds = d.regIds || []; // array of 'REG-X' or slotIds
  var programId = str_(d.programId);
  var pmName = authCheck.payload.name || str_(d.userName) || 'PM Quản trị';
  var nowStr = fmt_(new Date());
  var owned = ownedPrograms_(authCheck.payload.uid, isAdminPayload_(authCheck.payload));
  var updated = 0;
  var rowsToEmail = [];

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return { ok: false, busy: true, message: 'Hệ thống đang bận, vui lòng thử lại sau ít giây.' };
  try {
    var n = regSheet.getLastRow() - 1;
    if (n <= 0) return { ok: true, count: 0, message: 'Không có đơn nào cần duyệt.' };
    var data = regSheet.getRange(2, 1, n, 22).getValues();

    for (var r = 0; r < n; r++) {
      var pId = String(data[r][C.CAMPAIGN - 1]).trim();
      if (programId && pId.toUpperCase() !== programId.toUpperCase()) continue;
      if (!ownsProgram_(owned, pId)) continue;

      var curSlot = String(data[r][C.SLOT - 1]).trim();
      var curId = 'REG-' + (r + 1);
      if (regIds.length > 0 && regIds.indexOf(curId) === -1 && regIds.indexOf(curSlot) === -1) continue;

      var curStatus = String(data[r][C.STATUS - 1]).trim();
      if (curStatus === STATUS_PAID || curStatus === 'Đã khai nộp - chờ đối soát') {
        data[r][C.STATUS - 1] = 'Đã duyệt thanh toán';
        data[r][C.PM_BY - 1] = pmName;
        data[r][C.PM_DATE - 1] = asText_(nowStr);
        updated++;
        rowsToEmail.push({
          empCode: String(data[r][C.EMP_CODE - 1]).trim(),
          empName: String(data[r][C.EMP_NAME - 1]).trim(),
          slotId: curSlot,
          model: String(data[r][C.MODEL - 1]).trim(),
          kho: String(data[r][C.KHO - 1]).trim()
        });
      }
    }
    if (updated > 0) {
      regSheet.getRange(2, 1, n, 22).setValues(data); // ghi 1 lần, trong khóa
      SpreadsheetApp.flush();
    }
  } finally {
    lock.releaseLock();
  }

  for (var i = 0; i < rowsToEmail.length; i++) {
    var it = rowsToEmail[i];
    try {
      sendEmailNotification_('PAYMENT_APPROVED', it.empName, it.empCode, findUserEmail_(it.empCode), {
        slotId: it.slotId, model: it.model, kho: it.kho, pmName: pmName
      });
    } catch (eEmail) {}
  }
  if (updated > 0) { try { log_('PM_BATCH_APPROVE', authCheck.payload.uid, '', '', 'count=' + updated + ' pm=' + pmName); } catch (e) {} }

  return { ok: true, count: updated, message: 'Đã duyệt thanh toán hàng loạt thành công cho ' + updated + ' đơn hàng.' };
}

function pm_reject_payment_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };

  var slotId = str_(d.slotId);
  var regId = str_(d.regId);
  var reason = str_(d.reason) || 'PM từ chối';
  if (!slotId && !regId) return { ok: false, message: 'Thiếu slotId hoặc regId.' };

  var regSheet = book_().getSheetByName(SHEET_REG);
  if (!regSheet) return { ok: false, message: 'Sheet Registrations không tồn tại.' };

  var owned = ownedPrograms_(authCheck.payload.uid, isAdminPayload_(authCheck.payload));
  var pmName = authCheck.payload.name || str_(d.userName) || 'PM';
  var nowStr = fmt_(new Date());
  var hit = null;
  var denied = false;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return { ok: false, busy: true, message: 'Hệ thống đang bận, vui lòng thử lại sau ít giây.' };
  try {
    var n = regSheet.getLastRow() - 1;
    if (n <= 0) return { ok: false, message: 'Không tìm thấy đơn đăng ký.' };
    var data = regSheet.getRange(2, 1, n, 22).getValues();

    for (var r = 0; r < n; r++) {
      var curSlot = String(data[r][C.SLOT - 1]).trim();
      var curId = 'REG-' + (r + 1);
      if ((slotId && curSlot === slotId) || (regId && curId === regId)) {
        var pId = String(data[r][C.CAMPAIGN - 1]).trim();
        if (!ownsProgram_(owned, pId)) { denied = true; break; }
        var rowNum = r + 2;
        regSheet.getRange(rowNum, C.STATUS).setValue('Từ chối');
        regSheet.getRange(rowNum, C.PM_BY).setValue(pmName);
        regSheet.getRange(rowNum, C.PM_DATE).setValue(asText_(nowStr));
        regSheet.getRange(rowNum, C.NOTE).setValue(reason);
        hit = {
          slot: curSlot,
          programId: pId,
          empCode: String(data[r][C.EMP_CODE - 1]).trim(),
          empName: String(data[r][C.EMP_NAME - 1]).trim()
        };
        break;
      }
    }

    // v1-hardening (V1-11): chỉ mở lại slot của ĐÚNG đơn vừa từ chối (cùng chương trình, cùng người giữ)
    if (hit) {
      var prodSheet = book_().getSheetByName(SHEET_PRODUCTS);
      if (prodSheet && prodSheet.getLastRow() > 1) {
        var pData = prodSheet.getRange(2, 1, prodSheet.getLastRow() - 1, 12).getValues();
        for (var pr = 0; pr < pData.length; pr++) {
          var pCode = String(pData[pr][PROD_COL.CODE - 1]).trim();
          var pProg = String(pData[pr][PROD_COL.PROG - 1]).trim().toUpperCase();
          var pEmp = String(pData[pr][PROD_COL.EMP - 1]).trim().toUpperCase();
          if (pCode === hit.slot && pProg === hit.programId.toUpperCase() && pEmp === hit.empCode.toUpperCase()) {
            prodSheet.getRange(pr + 2, PROD_COL.STATUS).setValue('Available');
            prodSheet.getRange(pr + 2, PROD_COL.EMP).setValue('');
            break;
          }
        }
      }
      SpreadsheetApp.flush();
    }
  } finally {
    lock.releaseLock();
  }

  if (denied) return { ok: false, message: 'Từ chối: Bạn không có quyền từ chối đơn hàng thuộc chương trình của PM khác.' };
  if (!hit) return { ok: false, message: 'Không tìm thấy đơn đăng ký cần từ chối.' };

  invalidateCache_('prod_' + hit.programId.toUpperCase());
  // Trigger P7 Email Notification: PAYMENT_REJECTED
  try {
    sendEmailNotification_('PAYMENT_REJECTED', hit.empName, hit.empCode, findUserEmail_(hit.empCode), {
      slotId: hit.slot,
      reason: reason
    });
  } catch (eEmail) {}
  try { log_('PM_PAYMENT_REJECT', authCheck.payload.uid, hit.slot, '', 'reason=' + reason); } catch (e) {}
  return { ok: true, message: 'Đã từ chối đơn và mở lại slot ' + hit.slot + '.' };
}

/* ---------- PM: Allow Payment (Batch Range Update CONC-02) ---------- */
function pm_allow_payment_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };

  var programId = str_(d.programId);
  var regId = str_(d.regId); // optional single order ID or slotId
  var regSheet = book_().getSheetByName(SHEET_REG);
  if (!regSheet) return { ok: false, message: 'Sheet Registrations không tồn tại.' };

  var owned = ownedPrograms_(authCheck.payload.uid, isAdminPayload_(authCheck.payload));
  var pmName = authCheck.payload.name || str_(d.userName) || 'PM Quản trị';
  var nowStr = fmt_(new Date());
  var count = 0;
  var allowedOrders = [];

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return { ok: false, busy: true, message: 'Hệ thống đang bận, vui lòng thử lại sau ít giây.' };
  try {
    var n = regSheet.getLastRow() - 1;
    if (n <= 0) return { ok: true, count: 0, message: 'Không có đơn đăng ký nào.' };
    var data = regSheet.getRange(2, 1, n, 22).getValues();
    var gateOpenIso = new Date().toISOString();

    for (var r = 0; r < n; r++) {
      var pId = String(data[r][C.CAMPAIGN - 1]).trim();
      if (programId && pId.toUpperCase() !== programId.toUpperCase()) continue;
      if (!ownsProgram_(owned, pId)) continue;

      var curSlot = String(data[r][C.SLOT - 1]).trim();
      var curRegId = 'REG-' + (r + 1);
      if (regId && curRegId !== regId && curSlot !== regId) continue;

      var curStatus = String(data[r][C.STATUS - 1]).trim();
      // Match orders awaiting payment gate
      if (curStatus === STATUS_WAIT_GATE || curStatus === 'Đã đăng ký - Chờ mở thanh toán' || curStatus === 'Mới đăng ký') {
        data[r][C.STATUS - 1] = STATUS_NEW; // 'Chờ nộp tiền'
        var oldNote = String(data[r][C.NOTE - 1]).trim();
        data[r][C.NOTE - 1] = (oldNote ? oldNote + ' | ' : '') + 'GATE_OPEN:' + gateOpenIso + ' (PM ' + pmName + ' mở cổng thanh toán lúc ' + nowStr + ')';
        allowedOrders.push({
          slotId: curSlot,
          empCode: String(data[r][C.EMP_CODE - 1]).trim(),
          empName: String(data[r][C.EMP_NAME - 1]).trim(),
          model: String(data[r][C.MODEL - 1]).trim(),
          kho: String(data[r][C.KHO - 1]).trim()
        });
        count++;
      }
    }

    // Single batch range write back to sheet (trong khóa)
    if (count > 0) {
      regSheet.getRange(2, 1, n, 22).setValues(data);
      SpreadsheetApp.flush();
    }
  } finally {
    lock.releaseLock();
  }

  // Send PAYMENT_GATE_OPENED email to each employee outside the lock
  for (var i = 0; i < allowedOrders.length; i++) {
    var ord = allowedOrders[i];
    try {
      sendEmailNotification_('PAYMENT_GATE_OPENED', ord.empName, ord.empCode, findUserEmail_(ord.empCode), {
        slotId: ord.slotId,
        model: ord.model,
        kho: ord.kho,
        openTime: nowStr,
        pmName: pmName
      });
    } catch (eEmail) {}
  }

  try { log_('PM_ALLOW_PAYMENT', authCheck.payload.uid, programId || 'ALL', '', 'Mở cổng cho ' + count + ' đơn hàng'); } catch (e) {}
  return {
    ok: true,
    count: count,
    message: count > 0
      ? 'Đã mở cổng thanh toán thành công cho ' + count + ' đơn hàng đợt này!'
      : 'Không có đơn hàng nào đang ở trạng thái chờ mở cổng thanh toán.'
  };
}

/* ---------- P7: 24h Expiration Auto-Release & Reminders ---------- */
function check_expired_slots_(d) {
  // If invoked via client HTTP API, require valid PM session token
  if (d && d.action === 'check_expired_slots') {
    var authCheck = verifySessionToken_(d.token, 'PM');
    if (!authCheck.valid) return { ok: false, message: authCheck.message };
  }

  var regSheet = book_().getSheetByName(SHEET_REG);
  if (!regSheet) return { ok: false, message: 'Sheet Registrations không tồn tại.' };

  var now = new Date().getTime();
  var TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  var TWENTY_TWO_HOURS_MS = 22 * 60 * 60 * 1000;

  var releasedCount = 0;
  var warnedCount = 0;
  var releasedSlots = [];
  var releasedKeys = {};      // 'PROG|SLOT|EMP' -> true: chỉ trả đúng slot của đơn hết hạn
  var affectedPrograms = {};
  var notices = [];           // email + nhật ký, gửi sau khi nhả khóa

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    return { ok: false, busy: true, message: 'Hệ thống đang bận, lượt quét sẽ chạy lại ở lần kích hoạt sau.' };
  }
  try {
    var n = regSheet.getLastRow() - 1;
    if (n <= 0) return { ok: true, releasedCount: 0, warnedCount: 0, message: 'Không có đơn đăng ký nào.' };
    // Đọc trong khóa: nếu nhân viên vừa khai nộp tiền, trạng thái đã đổi và đơn không bị hủy nhầm
    var data = regSheet.getRange(2, 1, n, 22).getValues();

    for (var r = 0; r < n; r++) {
      var status = String(data[r][C.STATUS - 1]).trim();
      // Only check orders where PM has opened payment gate (Chờ nộp tiền)
      if (status !== STATUS_NEW && status !== 'Chờ nộp tiền') continue;

      var rawTs = data[r][0];
      var regDate = rawTs instanceof Date ? rawTs : new Date(rawTs);
      var curNote = String(data[r][C.NOTE - 1]).trim();

      // SPRINT P8: Bắt buộc đếm 24h từ thời điểm PM mở cổng thanh toán (GATE_OPEN) thay vì lúc đăng ký ban đầu
      var gateMatch = curNote.match(/GATE_OPEN:([^\s|\)]+)/);
      var baseDate = regDate;
      if (gateMatch && gateMatch[1]) {
        var parsedGate = new Date(gateMatch[1]);
        if (!isNaN(parsedGate.getTime())) baseDate = parsedGate;
      } else {
        var vnMatch = curNote.match(/mở cổng thanh toán lúc (\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
        if (vnMatch) {
          var parsedVn = new Date(vnMatch[3] + '-' + vnMatch[2] + '-' + vnMatch[1] + 'T' + vnMatch[4] + ':' + vnMatch[5] + ':' + vnMatch[6]);
          if (!isNaN(parsedVn.getTime())) baseDate = parsedVn;
        }
      }
      if (isNaN(baseDate.getTime())) continue;

      var diffMs = now - baseDate.getTime();
      var curSlot = String(data[r][C.SLOT - 1]).trim();
      var empCode = String(data[r][C.EMP_CODE - 1]).trim();
      var empName = String(data[r][C.EMP_NAME - 1]).trim();
      var pProg = String(data[r][C.CAMPAIGN - 1]).trim();
      var model = String(data[r][C.MODEL - 1]).trim();
      var rowNum = r + 2;

      if (diffMs >= TWENTY_FOUR_HOURS_MS) {
        // 1. Release expired slot (>24h)
        regSheet.getRange(rowNum, C.STATUS).setValue('Hết hạn giữ chỗ');
        regSheet.getRange(rowNum, C.NOTE).setValue((curNote ? curNote + ' | ' : '') + 'Tự động giải phóng quá hạn 24h');
        releasedSlots.push(curSlot);
        releasedKeys[pProg.toUpperCase() + '|' + curSlot + '|' + empCode.toUpperCase()] = true;
        if (pProg) affectedPrograms[pProg.toUpperCase()] = true;
        releasedCount++;
        notices.push({ type: 'EXPIRATION_ALERT', empName: empName, empCode: empCode, slot: curSlot, model: model,
                       log: ['AUTO_RELEASE_EXPIRED', 'Quá hạn 24h (' + Math.round(diffMs / 3600000) + 'h)'] });
      } else if (diffMs >= TWENTY_TWO_HOURS_MS && curNote.indexOf('WARNED_22H') === -1) {
        // 2. Warn employee if 22h - 24h
        regSheet.getRange(rowNum, C.NOTE).setValue((curNote ? curNote + ' | ' : '') + 'WARNED_22H');
        warnedCount++;
        notices.push({ type: 'EXPIRATION_WARNING', empName: empName, empCode: empCode, slot: curSlot, model: model,
                       regTime: fmt_(regDate), log: ['WARN_EXPIRE_22H', 'Cảnh báo 22h (' + Math.round(diffMs / 3600000) + 'h)'] });
      }
    }

    // Release slots in Products sheet — chỉ dòng khớp cả chương trình, mã slot và người giữ
    if (releasedSlots.length > 0) {
      var prodSheet = book_().getSheetByName(SHEET_PRODUCTS);
      if (prodSheet && prodSheet.getLastRow() > 1) {
        var pData = prodSheet.getRange(2, 1, prodSheet.getLastRow() - 1, 12).getValues();
        for (var pr = 0; pr < pData.length; pr++) {
          var key = String(pData[pr][PROD_COL.PROG - 1]).trim().toUpperCase() + '|' +
                    String(pData[pr][PROD_COL.CODE - 1]).trim() + '|' +
                    String(pData[pr][PROD_COL.EMP - 1]).trim().toUpperCase();
          if (releasedKeys[key]) {
            prodSheet.getRange(pr + 2, PROD_COL.STATUS).setValue('Available');
            prodSheet.getRange(pr + 2, PROD_COL.EMP).setValue('');
          }
        }
      }
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // Invalidate caches for affected programs
  for (var progKey in affectedPrograms) {
    invalidateCache_('prod_' + progKey);
  }

  // Email + nhật ký sau khi nhả khóa
  for (var k = 0; k < notices.length; k++) {
    var nt = notices[k];
    try {
      var details = { slotId: nt.slot, model: nt.model };
      if (nt.regTime) details.regTime = nt.regTime;
      sendEmailNotification_(nt.type, nt.empName, nt.empCode, findUserEmail_(nt.empCode), details);
    } catch (eEmail) {}
    try { log_(nt.log[0], nt.empCode, nt.slot, '', nt.log[1]); } catch (e) {}
  }

  return {
    ok: true,
    releasedCount: releasedCount,
    warnedCount: warnedCount,
    releasedSlots: releasedSlots,
    message: 'Quét hoàn tất: Đã giải phóng ' + releasedCount + ' slot quá hạn 24h, nhắc nhở ' + warnedCount + ' slot sắp hết hạn.'
  };
}

/** Entry point for Google Apps Script Time-Driven Trigger (e.g. every hour) */
function runExpirationWatchdog() {
  var res = check_expired_slots_({});
  Logger.log(JSON.stringify(res));
  return res;
}

/** Tự động cài đặt Time-Driven Trigger chạy mỗi 1 giờ cho Watchdog 24h (1-Click Setup) */
function setupWatchdogTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runExpirationWatchdog') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('runExpirationWatchdog')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('Đã kích hoạt thành công Trigger tự động chạy mỗi 1 giờ cho Watchdog 24h!');
  return { ok: true, message: 'Đã kích hoạt thành công Trigger tự động chạy mỗi 1 giờ cho Watchdog 24h!' };
}

/* ---------- P0: Xác thực (auth) ---------- */
function auth_(d) {
  var id = str_(d.id).toUpperCase();
  var pw = str_(d.password);
  if (!id || !pw) return { ok: false, message: 'Vui l\u00f2ng nh\u1eadp M\u00e3 NV v\u00e0 m\u1eadt kh\u1ea9u.' };

  var sheet = book_().getSheetByName(SHEET_USERS);
  if (!sheet) return { ok: false, message: 'H\u1ec7 th\u1ed1ng ch\u01b0a c\u1ea5u h\u00ecnh danh s\u00e1ch nh\u00e2n vi\u00ean.' };

  var n = sheet.getLastRow() - 1;
  if (n <= 0) return { ok: false, message: 'Danh s\u00e1ch nh\u00e2n vi\u00ean tr\u1ed1ng.' };

  // Users sheet: A=ID, B=Password, C=Name, D=Dept, E=Phone, F=Email, G=Role, H=Status
  var data = sheet.getRange(2, 1, n, 8).getValues();
  for (var r = 0; r < n; r++) {
    var rowId = String(data[r][0]).trim().toUpperCase();
    if (rowId !== id) continue;

    // Check status
    var status = String(data[r][7]).trim();
    if (status && status.toLowerCase() !== 'active') {
      return { ok: false, message: 'T\u00e0i kho\u1ea3n \u0111\u00e3 b\u1ecb v\u00f4 hi\u1ec7u h\u00f3a. Li\u00ean h\u1ec7 PM Support.' };
    }

    // Check password (supports both sha256: and plaintext legacy - P6)
    var storedPw = String(data[r][1]).trim();
    if (!verifyPassword_(pw, storedPw)) {
      return { ok: false, message: 'M\u1eadt kh\u1ea9u kh\u00f4ng \u0111\u00fang.' };
    }

    // Success — return user profile and signed HMAC token
    var user = {
      id: rowId,
      name: String(data[r][2]).trim(),
      dept: String(data[r][3]).trim(),
      phone: String(data[r][4]).trim(),
      email: String(data[r][5]).trim(),
      role: String(data[r][6]).trim() || 'USER'
    };

    var token = generateSessionToken_(user);
    try { log_('AUTH_LOGIN', id, user.name, '', 'role=' + user.role); } catch (e2) {}
    return { ok: true, user: user, token: token };
  }

  return { ok: false, message: 'Mã nhân viên không tồn tại.' };
}

/* ---------- Đổi mật khẩu (change_password) ---------- */
function change_password_(d) {
  var id = str_(d.id).toUpperCase();
  var oldPw = str_(d.oldPassword);
  var newPw = str_(d.newPassword);

  if (!id || !oldPw || !newPw) {
    return { ok: false, message: 'Vui lòng điền đầy đủ Mã NV, Mật khẩu cũ và Mật khẩu mới.' };
  }
  if (newPw.length < 6) {
    return { ok: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' };
  }
  if (oldPw === newPw) {
    return { ok: false, message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.' };
  }

  var sheet = book_().getSheetByName(SHEET_USERS);
  if (!sheet) return { ok: false, message: 'Hệ thống chưa cấu hình danh sách nhân viên.' };

  var n = sheet.getLastRow() - 1;
  if (n <= 0) return { ok: false, message: 'Danh sách nhân viên trống.' };

  // Users sheet: A=ID, B=Password, C=Name, D=Dept, E=Phone, F=Email, G=Role, H=Status
  var data = sheet.getRange(2, 1, n, 8).getValues();
  for (var r = 0; r < n; r++) {
    var rowId = String(data[r][0]).trim().toUpperCase();
    if (rowId !== id) continue;

    var status = String(data[r][7]).trim();
    if (status && status.toLowerCase() !== 'active') {
      return { ok: false, message: 'Tài khoản đã bị vô hiệu hóa. Không thể đổi mật khẩu.' };
    }

    var storedPw = String(data[r][1]).trim();
    if (!verifyPassword_(oldPw, storedPw)) {
      return { ok: false, message: 'Mật khẩu hiện tại không chính xác.' };
    }

    // Update password in Column B (row r + 2, col 2) with SHA-256 hash (P6)
    sheet.getRange(r + 2, 2).setValue(hashPassword_(newPw));

    try { log_('CHANGE_PASSWORD', id, String(data[r][2]).trim(), '', 'Mật khẩu đã đổi thành công (SHA-256)'); } catch (e) {}
    return { ok: true, message: 'Đổi mật khẩu thành công!' };
  }

  return { ok: false, message: 'Mã nhân viên không tồn tại.' };
}

/* ---------- Đăng ký (Tab 2) ---------- */
function register_(d) {
  var req = ['division', 'empCode', 'empName', 'kho', 'model', 'slotId', 'phone', 'address'];
  for (var i = 0; i < req.length; i++) {
    if (!str_(d[req[i]])) return { ok: false, message: 'Thiếu thông tin: ' + req[i] };
  }
  if (d.agree !== true) return { ok: false, message: 'Chưa xác nhận cam kết Jeong-Do.' };

  var slotId = str_(d.slotId), empCode = str_(d.empCode).toUpperCase();
  // v1-hardening (V1-07): form đăng ký cũ cũng phải là chính người đăng nhập
  var legacyAuth = requireSelf_(d.token, empCode);
  if (!legacyAuth.ok) return legacyAuth;
  var cfg = config_();
  var warnings = [], notes = [];

  // Kiểm tra slot có trong danh sách và đúng kho (ngoài khoá, dùng bộ nhớ đệm)
  var slot = slots_()[slotId];
  if (!slot) warnings.push('Slot ' + slotId + ' không có trong danh sách.');
  else if (slot.kho !== str_(d.kho)) warnings.push('Slot ' + slotId + ' thuộc kho ' + slot.kho + ', không phải kho ' + d.kho + '.');

  var campaign = str_(cfg.CAMPAIGN_CODE);
  if (!campaign) notes.push('Config chưa có CAMPAIGN_CODE');
  var maxPer = Number(cfg.MAX_PER_EMPLOYEE) || 1;

  // ---- Đoạn cần khoá: kiểm tra trùng + ghi dòng ----
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    return { ok: false, busy: true, message: 'Hệ thống đang bận, vui lòng thử lại sau ít giây.' };
  }
  var rowNo, ts, rejected = false, byEmp = 0, sameRow = 0;
  try {
    var reg = book_().getSheetByName(SHEET_REG);
    var n = reg.getLastRow() - 1;
    // Chỉ đọc 9 cột D..L (Mã NV .. Trạng thái)
    var rows = n > 0 ? reg.getRange(2, C.EMP_CODE, n, C.STATUS - C.EMP_CODE + 1).getValues() : [];
    var iEmp = 0, iSlot = C.SLOT - C.EMP_CODE, iSt = C.STATUS - C.EMP_CODE;
    for (var r = 0; r < rows.length; r++) {
      if (STATUS_FREE.indexOf(String(rows[r][iSt])) >= 0) continue;
      if (String(rows[r][iSlot]) === slotId) {
        // Chính người này đã giữ slot (trang gửi lại do mạng chập chờn): coi như thành công, không ghi thêm
        if (String(rows[r][iEmp]).toUpperCase() === empCode) sameRow = r + 2; else rejected = true;
        break;
      }
      if (String(rows[r][iEmp]).toUpperCase() === empCode) byEmp++;
    }
    if (!rejected && !sameRow) {
      if (byEmp >= maxPer) warnings.push('Mã NV ' + empCode + ' đã đăng ký ' + byEmp + ' lần, vượt hạn mức ' + maxPer + ' sản phẩm/NV.');
      if (warnings.length) notes = notes.concat(warnings);
      ts = new Date();
      var rw = regWidth_(reg);
      var row = new Array(rw).fill('');
      row[C.TS - 1] = ts;
      row[C.CAMPAIGN - 1] = campaign;
      row[C.DIVISION - 1] = safe_(d.division);
      row[C.EMP_CODE - 1] = safe_(empCode);
      row[C.EMP_NAME - 1] = safe_(d.empName);
      row[C.KHO - 1] = safe_(d.kho);
      row[C.MODEL - 1] = safe_(d.model);
      row[C.SLOT - 1] = "'" + slotId.replace(/^'+/, '');
      row[C.PHONE - 1] = "'" + str_(d.phone);
      row[C.ADDRESS - 1] = safe_(d.address);
      row[C.AGREE - 1] = 'Đồng ý';
      row[C.STATUS - 1] = STATUS_WAIT_GATE;
      row[C.NOTE - 1] = safe_(notes.join(' | '));
      row[C.UA - 1] = safe_(str_(d.userAgent).slice(0, 300));
      if (rw >= C.SERIAL) row[C.SERIAL - 1] = asText_(prodSerials_()[slotId]);
      rowNo = n + 2;
      reg.getRange(rowNo, 1, 1, rw).setValues([row]);
      SpreadsheetApp.flush();
    }
  } finally {
    lock.releaseLock();
  }
  // ---- Hết đoạn khoá ----

  if (sameRow) {
    log_('REGISTER_REPEAT', empCode, slotId, d.userAgent, 'Gửi lại, đơn đã có ở dòng ' + sameRow + ', không ghi thêm');
    return { ok: true, row: sameRow, status: STATUS_WAIT_GATE, repeat: true, warnings: [] };
  }
  if (rejected) {
    log_('REGISTER_REJECTED_DUP_SLOT', empCode, slotId, d.userAgent, 'Slot đã có người đăng ký, không ghi đơn');
    return { ok: false, slotTaken: true, message: 'Slot ' + slotId + ' đã có người đăng ký trước. Vui lòng chọn slot khác.' };
  }
  log_('REGISTER', empCode, slotId, d.userAgent, 'Dòng ' + rowNo + (warnings.length ? ' | ' + warnings.join(' | ') : ''));
  return { ok: true, row: rowNo, status: STATUS_WAIT_GATE, timestamp: fmt_(ts), warnings: warnings };
}

/* ---------- Khai nộp tiền (Tab 3 & Quick Payment Modal - DATA-01 Price Enforcement) ---------- */
function payment_(d) {
  var slotId = str_(d.slotId || d.regId);
  var empCode = str_(d.empCode || d.userId).toUpperCase();
  var payerName = str_(d.payerName);
  var payerCode = str_(d.payerCode || empCode);
  var bankTxn = str_(d.bankTxn);
  var payTime = str_(d.payTime || fmt_(new Date()));
  var fileData = d.fileBase64 || d.receiptData || '';
  var fileName = d.fileName || (slotId + '_receipt.png');

  if (!slotId || !empCode || !payerName || !bankTxn) {
    return { ok: false, message: 'Thiếu thông tin nộp tiền bắt buộc (Mã Slot, Mã NV, Tên người nộp, Mã GD).' };
  }
  // v1-hardening (V1-07): chỉ chủ đơn (đã đăng nhập) mới khai nộp tiền cho đơn của mình
  var payAuth = requireSelf_(d.token, empCode);
  if (!payAuth.ok) return payAuth;

  var reg = book_().getSheetByName(SHEET_REG);
  if (!reg) return { ok: false, message: 'Sheet Registrations không tồn tại.' };

  // Kiểm tra trước (không khoá) để không lưu biên lai thừa
  var pre = findOrder_(reg, slotId, empCode);
  if (!pre) {
    log_('PAYMENT_NOT_FOUND', empCode, slotId, d.userAgent, 'Không tìm thấy đơn đăng ký');
    return { ok: false, message: 'Không tìm thấy đơn đăng ký với Slot ' + slotId + ' và Mã NV ' + empCode + '. Vui lòng đăng ký ở Tab 2 trước.' };
  }
  if (pre.status === STATUS_WAIT_GATE || pre.status === 'Đã đăng ký - Chờ mở thanh toán') {
    return {
      ok: false,
      message: 'Cổng thanh toán chưa được mở cho đơn hàng ' + slotId + '. PM đang kiểm duyệt danh sách đăng ký để chống trùng lặp. Vui lòng chờ thông báo mở cổng thanh toán từ PM.'
    };
  }
  if (pre.paid && pre.txn === bankTxn) return { ok: true, row: pre.rowNo, status: STATUS_PAID, repeat: true };
  if (pre.paid) return paidAlready_(d, empCode, slotId, pre.rowNo);

  // SERVER-SIDE PRICE ENFORCEMENT (DATA-01):
  // Never trust client amount blindly. Always lookup verified internal price from Products sheet.
  var finalAmount = Number(d.amount) || 0;
  var prodSheet = book_().getSheetByName(SHEET_PRODUCTS);
  if (prodSheet) {
    var pn = prodSheet.getLastRow() - 1;
    if (pn > 0) {
      var pVals = prodSheet.getRange(2, 1, pn, PROD_COL.PRICE).getValues();
      for (var pi = 0; pi < pn; pi++) {
        if (String(pVals[pi][PROD_COL.CODE - 1]).trim() === slotId) {
          var officialPrice = Number(pVals[pi][PROD_COL.PRICE - 1]) || 0;
          if (officialPrice > 0) {
            finalAmount = officialPrice; // Enforce official price on server
          }
          break;
        }
      }
    }
  }

  // Lưu biên lai (việc chậm) trước khi khoá — vào thư mục con của chương trình (06/10/2026)
  var link = '';
  if (fileData) {
    var payProgram = '';
    try { payProgram = str_(reg.getRange(pre.rowNo, C.CAMPAIGN).getValue()); } catch (eP) {}
    try { link = saveReceipt_(fileData, fileName, slotId, empCode, payProgram); }
    catch (err) { log_('RECEIPT_ERROR', empCode, slotId, d.userAgent, String(err)); return { ok: false, message: 'Không lưu được file biên lai: ' + err }; }
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    return { ok: false, busy: true, message: 'Hệ thống đang bận, vui lòng thử lại sau ít giây.' };
  }
  var found, dup = false;
  try {
    found = findOrder_(reg, slotId, empCode); // kiểm tra lại trong khoá
    if (found && found.paid) dup = true;
    else if (found) {
      reg.getRange(found.rowNo, C.PAYER_NAME, 1, 6).setValues([[
        safe_(payerName), safe_(str_(payerCode).toUpperCase()), "'" + finalAmount,
        safe_(bankTxn), asText_(payTime), link
      ]]);
      reg.getRange(found.rowNo, C.STATUS).setValue(STATUS_PAID);
      SpreadsheetApp.flush();
    }
  } finally {
    lock.releaseLock();
  }
  if (!found) return { ok: false, message: 'Không tìm thấy đơn đăng ký. Vui lòng thử lại.' };
  if (dup && found.txn === bankTxn) return { ok: true, row: found.rowNo, status: STATUS_PAID, repeat: true };
  if (dup) return paidAlready_(d, empCode, slotId, found.rowNo);

  log_('PAYMENT', empCode, slotId, d.userAgent, 'Dòng ' + found.rowNo + (link ? ' | có biên lai' : ' | chưa có file biên lai') + ' | Số tiền: ' + finalAmount);
  return { ok: true, row: found.rowNo, status: STATUS_PAID, receipt: !!link, amount: finalAmount };
}

function paidAlready_(d, empCode, slotId, rowNo) {
  log_('PAYMENT_DUPLICATE', empCode, slotId, d.userAgent, 'Dòng ' + rowNo + ' đã khai nộp trước đó. Mã GD mới: ' + str_(d.bankTxn));
  return { ok: false, message: 'Đơn này đã khai nộp tiền trước đó. Nếu cần sửa, vui lòng liên hệ PM phụ trách.' };
}

// Đơn gần nhất khớp Slot + Mã NV (đọc cột D..L)
function findOrder_(reg, slotId, empCode) {
  var n = reg.getLastRow() - 1;
  if (n < 1) return null;
  var v = reg.getRange(2, C.EMP_CODE, n, C.STATUS - C.EMP_CODE + 1).getValues();
  for (var r = v.length - 1; r >= 0; r--) {
    if (String(v[r][C.SLOT - C.EMP_CODE]) === slotId && String(v[r][0]).toUpperCase() === empCode) {
      var paid = !!(str_(v[r][C.PAYER_NAME - C.EMP_CODE]) || str_(v[r][C.BANK_TXN - C.EMP_CODE]));
      var curSt = String(v[r][C.STATUS - C.EMP_CODE]).trim();
      return { rowNo: r + 2, paid: paid, txn: str_(v[r][C.BANK_TXN - C.EMP_CODE]), status: curSt };
    }
  }
  return null;
}

/* ---------- Tra cứu đơn (Mã NV + 4 số cuối SĐT) ---------- */
function lookup_(d) {
  var empCode = str_(d.empCode || d.userId).toUpperCase();
  var last4 = str_(d.phoneLast4).replace(/\D/g, '');
  var token = str_(d.token);
  var auth = token ? verifySessionToken_(token) : null;
  var isAuthenticated = !!(auth && auth.valid && (String(auth.payload.uid).toUpperCase() === empCode || auth.payload.role === 'ADMIN' || auth.payload.role === 'PM'));

  if (!isAuthenticated && (!empCode || last4.length !== 4)) {
    return { ok: false, message: 'Vui lòng nhập Mã NV và đúng 4 số cuối điện thoại đã đăng ký.' };
  }

  var reg = book_().getSheetByName(SHEET_REG);
  var n = reg.getLastRow() - 1;
  var lw = reg.getLastColumn() >= C.SERIAL ? C.SERIAL : C.RECEIPT;
  var v = n > 0 ? reg.getRange(2, 1, n, lw).getValues() : [];
  var out = [];

  var prodPrices = {};
  try {
    var prodSheet = book_().getSheetByName(SHEET_PRODUCTS);
    if (prodSheet && prodSheet.getLastRow() > 1) {
      var pData = prodSheet.getRange(2, 1, prodSheet.getLastRow() - 1, PROD_COL.PRICE).getValues();
      for (var pi = 0; pi < pData.length; pi++) {
        var sCode = String(pData[pi][PROD_COL.CODE - 1]).trim();
        var sPrice = Number(pData[pi][PROD_COL.PRICE - 1]) || 0;
        if (sCode && sPrice > 0) prodPrices[sCode] = sPrice;
      }
    }
  } catch (eProd) {}

  for (var r = 0; r < v.length; r++) {
    if (String(v[r][C.EMP_CODE - 1]).toUpperCase() !== empCode) continue;
    if (!isAuthenticated) {
      var phone = String(v[r][C.PHONE - 1]).replace(/\D/g, '');
      if (phone.slice(-4) !== last4) continue;
    }
    var curSlot = str_(v[r][C.SLOT - 1]);
    var curAmt = Number(v[r][C.AMOUNT - 1]) || prodPrices[curSlot] || 0;
    var empName = str_(v[r][C.EMP_NAME - 1]);
    out.push({
      time: v[r][0] instanceof Date ? fmt_(v[r][0]) : str_(v[r][0]),
      programId: str_(v[r][C.CAMPAIGN - 1]), // v1-hardening (V1-02): ô "03 Đơn hàng của bạn" lọc theo chương trình
      slot: curSlot, kho: str_(v[r][C.KHO - 1]), model: str_(v[r][C.MODEL - 1]),
      serial: (lw >= C.SERIAL ? str_(v[r][C.SERIAL - 1]) : '') || prodSerials_()[curSlot] || '',
      empCode: empCode,
      empName: empName,
      name: empName,
      amount: curAmt, price: curAmt,
      status: str_(v[r][C.STATUS - 1]) || 'Chưa có trạng thái',
      paid: !!str_(v[r][C.BANK_TXN - 1]), receipt: !!str_(v[r][C.RECEIPT - 1])
    });
  }
  if (!out.length) {
    if (isAuthenticated) {
      return { ok: true, orders: [], message: 'Bạn chưa có đơn đăng ký mua hàng nào.' };
    }
    log_('LOOKUP_NOT_FOUND', empCode, '', d.userAgent, 'Tra cứu không khớp');
    return { ok: false, message: 'Không tìm thấy đơn khớp Mã NV và 4 số cuối điện thoại này.' };
  }
  return { ok: true, orders: out };
}

/* ---------- v1-hardening (V1-08): Nhân viên tự hủy giữ chỗ ----------
 * Quy tắc đã duyệt 05/10/2026: chỉ hủy được khi đơn đang "Đã đăng ký - Chờ mở thanh toán" hoặc
 * "Chờ nộp tiền" và CHƯA khai nộp tiền. Đã khai nộp → liên hệ PM (tránh phát sinh hoàn tiền).
 */
function user_cancel_registration_(d) {
  var auth = verifySessionToken_(d.token);
  if (!auth.valid) return { ok: false, authError: true, message: auth.message };
  var empCode = String(auth.payload.uid || '').toUpperCase();
  if (str_(d.userId) && str_(d.userId).toUpperCase() !== empCode) {
    return { ok: false, authError: true, message: 'Không thể hủy đơn của nhân viên khác.' };
  }
  var slotId = str_(d.slotId || d.regId);
  if (!slotId) return { ok: false, message: 'Thiếu mã slot cần hủy.' };

  var reg = book_().getSheetByName(SHEET_REG);
  if (!reg) return { ok: false, message: 'Sheet Registrations không tồn tại.' };

  var programId = '';
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return { ok: false, busy: true, message: 'Hệ thống đang bận, vui lòng thử lại sau ít giây.' };
  try {
    var found = findOrder_(reg, slotId, empCode);
    if (!found) return { ok: false, message: 'Không tìm thấy đơn giữ chỗ ' + slotId + ' của bạn.' };
    var cancellable = (found.status === STATUS_WAIT_GATE || found.status === STATUS_NEW) && !found.paid;
    if (!cancellable) {
      return { ok: false, message: 'Đơn ' + slotId + ' đang ở trạng thái "' + found.status + '" nên không thể tự hủy. Nếu bạn đã khai nộp tiền, vui lòng liên hệ PM phụ trách.' };
    }
    programId = str_(reg.getRange(found.rowNo, C.CAMPAIGN).getValue());
    var oldNote = str_(reg.getRange(found.rowNo, C.NOTE).getValue());
    reg.getRange(found.rowNo, C.STATUS).setValue(STATUS_USER_CANCEL);
    reg.getRange(found.rowNo, C.NOTE).setValue((oldNote ? oldNote + ' | ' : '') + 'Nhân viên tự hủy giữ chỗ lúc ' + fmt_(new Date()));

    // Trả slot về kho: đúng chương trình, đúng mã slot, đúng người đang giữ
    var prodSheet = book_().getSheetByName(SHEET_PRODUCTS);
    if (prodSheet && prodSheet.getLastRow() > 1) {
      var pData = prodSheet.getRange(2, 1, prodSheet.getLastRow() - 1, 12).getValues();
      for (var i = 0; i < pData.length; i++) {
        if (String(pData[i][PROD_COL.CODE - 1]).trim() === slotId &&
            String(pData[i][PROD_COL.PROG - 1]).trim().toUpperCase() === programId.toUpperCase() &&
            String(pData[i][PROD_COL.EMP - 1]).trim().toUpperCase() === empCode) {
          prodSheet.getRange(i + 2, PROD_COL.STATUS, 1, 3).setValues([['Available', '', new Date().toISOString()]]);
          break;
        }
      }
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  if (programId) invalidateCache_('prod_' + programId.toUpperCase());
  try { log_('USER_CANCEL', empCode, slotId, d.userAgent, 'program=' + programId); } catch (e) {}
  return { ok: true, message: 'Đã hủy giữ chỗ ' + slotId + '. Slot đã được trả về kho cho đồng nghiệp khác.' };
}

/* ---------- v1-hardening (K2): Công tắc bật/tắt email tự động ----------
 * Chỉ tài khoản role ADMIN xem / đổi Config!ENABLE_AUTO_EMAIL ngay trên web, không cần mở Sheet.
 * Gọi không kèm "enabled" = chỉ đọc. Mọi lần đổi đều ghi ActivityLog (ai, lúc nào, bật hay tắt).
 */
function email_setting_(d) {
  var auth = verifySessionToken_(d.token, 'ADMIN'); // chỉ ADMIN (yêu cầu 05/10/2026)
  if (!auth.valid) return { ok: false, authError: true, message: auth.message };

  var remaining = null;
  try { remaining = MailApp.getRemainingDailyQuota(); } catch (eQ) {}

  if (d.enabled === undefined || d.enabled === null || d.enabled === '') {
    var cur = String(config_()['ENABLE_AUTO_EMAIL'] || '').toLowerCase() === 'true';
    return { ok: true, enabled: cur, remainingDailyQuota: remaining };
  }

  var val = d.enabled === true || String(d.enabled).toLowerCase() === 'true';
  var sh = book_().getSheetByName(SHEET_CONFIG);
  if (!sh) return { ok: false, message: 'Sheet Config không tồn tại.' };
  var n = sh.getLastRow();
  var keys = n > 0 ? sh.getRange(1, 1, n, 1).getValues() : [];
  var row = -1;
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === 'ENABLE_AUTO_EMAIL') { row = i + 1; break; }
  }
  if (row > 0) sh.getRange(row, 2).setValue(val ? 'true' : 'false');
  else sh.appendRow(['ENABLE_AUTO_EMAIL', val ? 'true' : 'false', 'Bật/tắt gửi email tự động qua MailApp (true / false)']);
  try { CacheService.getScriptCache().remove('cfg'); } catch (eC) {} // có hiệu lực ngay, không chờ cache 5 phút

  try { log_('EMAIL_SETTING', auth.payload.uid, '', d.userAgent, 'ENABLE_AUTO_EMAIL=' + val + ' bởi ' + (auth.payload.name || auth.payload.uid)); } catch (e) {}
  return {
    ok: true, enabled: val, remainingDailyQuota: remaining,
    message: val ? 'Đã BẬT gửi email tự động.' : 'Đã TẮT gửi email tự động. Hệ thống chỉ ghi nhật ký vào sheet AutoEmail.'
  };
}

/* ---------- Bộ nhớ đệm Config / Slots ---------- */
function config_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('cfg');
  if (hit) return JSON.parse(hit);
  var sh = book_().getSheetByName(SHEET_CONFIG);
  var v = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getValues();
  var o = {};
  for (var i = 0; i < v.length; i++) if (v[i][0]) o[String(v[i][0])] = v[i][1] instanceof Date ? fmt_(v[i][1]) : v[i][1];
  cache.put('cfg', JSON.stringify(o), CACHE_CONFIG_SEC);
  return o;
}

function slots_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('slots');
  if (hit) return JSON.parse(hit);
  var sh = book_().getSheetByName(SHEET_SLOTS);
  var v = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 4).getValues();
  var o = {};
  for (var i = 0; i < v.length; i++) if (v[i][2]) o[String(v[i][2])] = { kho: String(v[i][0]), model: String(v[i][3]) };
  cache.put('slots', JSON.stringify(o), CACHE_SLOTS_SEC);
  return o;
}

/** Chạy tay khi vừa sửa Config hoặc Slots để script thấy ngay. */
function clearCache() {
  CacheService.getScriptCache().removeAll(['cfg', 'slots']);
  Logger.log('Đã xoá bộ nhớ đệm Config và Slots.');
}

/* ---------- Tiện ích ---------- */
var _receiptFolderCached = null;

function saveReceipt_(dataUrl, fileName, slotId, empCode, programId) {
  var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw 'File không đúng định dạng';
  var mime = m[1];
  if (!/^image\/|^application\/pdf$/.test(mime)) throw 'Chỉ nhận ảnh hoặc PDF';
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > MAX_FILE_BYTES) throw 'File lớn hơn 5 MB';
  var ext = (String(fileName || '').match(/\.[A-Za-z0-9]{1,5}$/) || [''])[0];
  var name = 'BL_' + slotId.replace('#', '') + '_' + empCode + '_' +
    Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmmss') + ext;
  var file = receiptFolderFor_(programId).createFile(Utilities.newBlob(bytes, mime, name));
  return file.getUrl();
}

/* ---------- 06/10/2026: biên lai chia thư mục theo chương trình ----------
 * "Bien lai nop tien" / "<ProgramID> - <Tên chương trình>" / BL_…  → PM tải nguyên thư mục chương trình gửi kế toán.
 * Tìm thư mục con theo TIỀN TỐ ProgramID (đổi tên chương trình / đổi tên thư mục bằng tay vẫn khớp).
 * Thư mục con kế thừa quyền của thư mục gốc (đang Restricted). Không tìm được chương trình → lưu ở thư mục gốc như cũ.
 */
function receiptFolderFor_(programId) {
  var root = receiptFolder_();
  var pid = str_(programId);
  if (!pid) return root;
  var key = 'RECEIPT_FOLDER_' + pid.toUpperCase();
  try {
    var cachedId = CacheService.getScriptCache().get(key) || PropertiesService.getScriptProperties().getProperty(key);
    if (cachedId) {
      var f = DriveApp.getFolderById(cachedId);
      if (!f.isTrashed()) return f;
    }
  } catch (e) {}
  var found = findProgramFolder_(root, pid);
  if (!found) {
    // Lần đầu của chương trình: khoá ngắn để 2 người nộp cùng lúc không tạo 2 thư mục trùng
    var lock = LockService.getScriptLock();
    var locked = lock.tryLock(10000);
    try {
      found = findProgramFolder_(root, pid);
      if (!found) found = root.createFolder(programFolderName_(pid));
    } finally { if (locked) lock.releaseLock(); }
  }
  try {
    PropertiesService.getScriptProperties().setProperty(key, found.getId());
    CacheService.getScriptCache().put(key, found.getId(), 21600);
  } catch (e2) {}
  return found;
}

function findProgramFolder_(root, pid) {
  var up = pid.toUpperCase(), it = root.getFolders();
  while (it.hasNext()) {
    var f = it.next(), nm = String(f.getName()).toUpperCase();
    if (nm === up || nm.indexOf(up + ' - ') === 0) return f;
  }
  return null;
}

function programFolderName_(pid) {
  var name = '';
  try {
    var sh = book_().getSheetByName(SHEET_PROGRAMS);
    if (sh && sh.getLastRow() > 1) {
      var v = sh.getRange(2, PROG_COL.ID, sh.getLastRow() - 1, 2).getValues();
      for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim().toUpperCase() === pid.toUpperCase()) { name = String(v[i][1]).trim(); break; }
    }
  } catch (e) {}
  return name ? pid + ' - ' + name.replace(/[\\/:*?"<>|]/g, ' ').trim() : pid;
}

/**
 * Chạy tay 1 lần (Run → organizeReceiptsByProgram): chuyển các file BL_… đang nằm thẳng trong "Bien lai nop tien"
 * vào thư mục chương trình. Chương trình lấy theo cột Receipt Link của Registrations (chính xác), không đoán theo tên file.
 * Di chuyển KHÔNG đổi ID / link của file → link trong sheet và nút "Xem biên lai" trên web vẫn mở đúng.
 */
function organizeReceiptsByProgram() {
  var reg = book_().getSheetByName(SHEET_REG);
  var byFileId = {};
  if (reg && reg.getLastRow() > 1) {
    var v = reg.getRange(2, 1, reg.getLastRow() - 1, C.RECEIPT).getValues();
    for (var r = 0; r < v.length; r++) {
      var m = /[-\w]{25,}/.exec(String(v[r][C.RECEIPT - 1]));
      if (m) byFileId[m[0]] = str_(v[r][C.CAMPAIGN - 1]);
    }
  }
  var root = receiptFolder_(), files = root.getFiles(), moved = 0, left = [];
  while (files.hasNext()) {
    var f = files.next(), pid = byFileId[f.getId()];
    if (pid) { f.moveTo(receiptFolderFor_(pid)); moved++; } else left.push(f.getName());
  }
  try { log_('RECEIPT_ORGANIZE', 'ADMIN', '', '', 'Chuyển ' + moved + ' file; giữ lại ' + left.length + ' file không khớp đơn nào'); } catch (e) {}
  Logger.log('organizeReceiptsByProgram: chuyển ' + moved + ' file. Giữ nguyên (không khớp đơn nào): ' + (left.join(', ') || 'không có'));
  return { ok: true, moved: moved, left: left };
}

// T3.1: Cached Drive Folder ID (PERF-01) - Slashes folder lookup from 2.5s to < 100ms
function receiptFolder_() {
  if (_receiptFolderCached) return _receiptFolderCached;

  // 1. Try script cache for folder ID (fastest)
  try {
    var cachedId = CacheService.getScriptCache().get('RECEIPT_FOLDER_ID');
    if (cachedId) {
      _receiptFolderCached = DriveApp.getFolderById(cachedId);
      return _receiptFolderCached;
    }
  } catch (e) {}

  // 2. Try ScriptProperties
  try {
    var props = PropertiesService.getScriptProperties();
    var propId = props.getProperty('RECEIPT_FOLDER_ID');
    if (propId) {
      _receiptFolderCached = DriveApp.getFolderById(propId);
      try { CacheService.getScriptCache().put('RECEIPT_FOLDER_ID', propId, 21600); } catch (e2) {}
      return _receiptFolderCached;
    }
  } catch (e) {}

  // 3. Fallback: resolve once and permanently cache
  var ssFile = DriveApp.getFileById(book_().getId());
  var parents = ssFile.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var it = parent.getFoldersByName(RECEIPT_FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : parent.createFolder(RECEIPT_FOLDER_NAME);
  var fId = folder.getId();

  try {
    PropertiesService.getScriptProperties().setProperty('RECEIPT_FOLDER_ID', fId);
    CacheService.getScriptCache().put('RECEIPT_FOLDER_ID', fId, 21600); // 6 hours
  } catch (e3) {}

  _receiptFolderCached = folder;
  return _receiptFolderCached;
}

function log_(action, empCode, slotId, ua, details) {
  var sh = book_().getSheetByName(SHEET_LOG);
  if (!sh) return;
  sh.appendRow([new Date(), action, safe_(empCode), slotId ? "'" + slotId : '', safe_(str_(ua).slice(0, 300)), safe_(details)]);
}

function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

// Chặn chèn công thức: giá trị bắt đầu bằng = + - @ sẽ được lưu dạng chữ
function safe_(v) {
  var s = str_(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function fmt_(d) { return Utilities.formatDate(d, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss'); }

// 06/10/2026 — chạy tay trong trình soạn thảo Apps Script (Run → syncSerialsToRegistrations) sau khi nhập / sửa serial ở
// cột M của Products: điền cột W "Serial" của Registrations cho các dòng đang TRỐNG, theo Mã Slot. Không ghi đè ô đã có.
function syncSerialsToRegistrations() {
  var reg = book_().getSheetByName(SHEET_REG);
  if (!reg || reg.getMaxColumns() < C.SERIAL) return { ok: false, message: 'Registrations chưa có cột W.' };
  _prodSerials = null;
  var map = prodSerials_(), n = reg.getLastRow() - 1, filled = 0;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return { ok: false, busy: true, message: 'Hệ thống đang bận, chạy lại sau ít giây.' };
  try {
    if (!str_(reg.getRange(1, C.SERIAL).getValue())) reg.getRange(1, C.SERIAL).setValue('Serial');
    if (n < 1) return { ok: true, filled: 0 };
    var slots = reg.getRange(2, C.SLOT, n, 1).getValues();
    var cur = reg.getRange(2, C.SERIAL, n, 1).getValues();
    for (var r = 0; r < n; r++) {
      var sn = map[str_(slots[r][0]).replace(/^'+/, '')];
      if (sn && !str_(cur[r][0])) { cur[r][0] = asText_(sn); filled++; }
    }
    if (filled) reg.getRange(2, C.SERIAL, n, 1).setValues(cur);
  } finally { lock.releaseLock(); }
  Logger.log('syncSerialsToRegistrations: điền ' + filled + ' dòng');
  return { ok: true, filled: filled };
}

// Ghi ngày giờ "dd/MM/yyyy HH:mm:ss" vào ô dạng CHỮ. Không có dấu ' đầu, Google Sheet tự đổi chuỗi thành ngày theo
// vùng của bảng tính (kiểu Mỹ: tháng/ngày) → "06/10/2026" thành 10/06/2026 (06/10/2026: "Thời gian nộp" ra tháng 6).
// Dấu ' không hiện trong ô và không có trong giá trị đọc ra; nó cũng chặn chèn công thức như safe_().
function asText_(v) {
  var s = str_(v).replace(/^'+/, '');
  return s ? "'" + s : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Chạy tay 1 lần trong trình soạn Apps Script để cấp quyền và kiểm tra. Không ghi gì vào sheet. */
function testSetup() {
  Logger.log('Slot #001: ' + JSON.stringify(slots_()['#001']));
  Logger.log('MAX_PER_EMPLOYEE: ' + config_().MAX_PER_EMPLOYEE);
  Logger.log('Thư mục biên lai: ' + receiptFolder_().getName());
}

/**
 * =========================================================================================
 * TỰ ĐỘNG KHỞI TẠO CƠ SỞ DỮ LIỆU TRÊN GOOGLE DRIVE CỦA BẠN (1-Click Database Provisioning)
 * =========================================================================================
 * 
 * Mục đích:
 * Khi bất kỳ Agent hoặc PIC nào tải dự án về, hàm này sẽ:
 * 1. Tự động tạo 1 file Google Sheet mới tên "LG Internal Sales Database" trên chính Drive của người đó.
 * 2. Tự động tạo đủ 8 Sheets tiêu chuẩn với 100% cột, định dạng màu LG Heritage Red (#A50034) và khóa dòng tiêu đề.
 * 3. Nạp sẵn dữ liệu mẫu (Chương trình, Danh mục sản phẩm, Tài khoản phân quyền SoD, Cấu hình).
 * 4. In ra mã SPREADSHEET_ID và hướng dẫn bước tiếp theo trên Execution log.
 * 
 * Cách thực thi:
 * Trong giao diện Google Apps Script (script.google.com):
 * - Chọn hàm "setupNewDatabase" trên thanh công cụ dropdown.
 * - Nhấn nút "Run" (Chạy).
 * - Cấp quyền Google Drive khi được yêu cầu.
 */
function setupNewDatabase() {
  Logger.log('================================================================');
  Logger.log('🚀 Bắt đầu tự động khởi tạo Cơ sở dữ liệu LG Internal Sales trên Google Drive của bạn...');
  
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {}
  
  var isNew = false;
  // v1-hardening (V1-12): KHÔNG BAO GIỜ chạy đè lên Sheet đang có dữ liệu (hàm formatHeader bên dưới gọi sheet.clear()).
  if (ss) {
    var guarded = [SHEET_REG, SHEET_USERS, SHEET_PROGRAMS, SHEET_PRODUCTS];
    for (var g = 0; g < guarded.length; g++) {
      var gs = ss.getSheetByName(guarded[g]);
      if (gs && gs.getLastRow() > 1) {
        var stopMsg = 'DỪNG: Sheet "' + guarded[g] + '" đã có dữ liệu. setupNewDatabase() chỉ dùng để tạo CSDL MỚI, ' +
          'chạy tiếp sẽ xóa sạch dữ liệu. Không có gì bị thay đổi. Xem docs/04-v1-hardening/V1_RELEASE_RUNBOOK.md';
        Logger.log(stopMsg);
        return { ok: false, message: stopMsg };
      }
    }
  }
  if (!ss) {
    var todayStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
    ss = SpreadsheetApp.create('LG Internal Sales Database - ' + todayStr);
    isNew = true;
  }
  
  var brandRed = '#A50034';
  var headerFontColor = '#FFFFFF';
  
  function formatHeader(sheet, headers) {
    sheet.clear();
    sheet.appendRow(headers);
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setBackground(brandRed);
    range.setFontColor(headerFontColor);
    range.setFontWeight('bold');
    range.setFontFamily('Roboto');
    range.setFontSize(11);
    sheet.setFrozenRows(1);
    for (var i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  
  // 1. Sheet: Registrations
  var regSheet = ss.getSheetByName(SHEET_REG) || ss.insertSheet(SHEET_REG);
  formatHeader(regSheet, [
    'Timestamp', 'Campaign', 'Division', 'Employee Code', 'Employee Name', 'Warehouse', 
    'Model', 'Slot ID', 'Phone', 'Address', 'Agree Jeong-Do', 'Status', 'Payer Name', 
    'Payer Code', 'Amount', 'Bank Txn', 'Pay Time', 'Receipt Link', 'PM Approved By', 
    'PM Approved Date', 'Note', 'User Agent', 'Serial'
  ]);
  
  // 2. Sheet: Slots
  var slotSheet = ss.getSheetByName(SHEET_SLOTS) || ss.insertSheet(SHEET_SLOTS);
  formatHeader(slotSheet, [
    'Slot ID', 'Warehouse', 'Model', 'MRP', 'Internal Price', 'Discount %', 
    'Status', 'Reserved By', 'Expire At', 'Note', 'Program ID', 'Serial'
  ]);
  if (slotSheet.getLastRow() <= 1) {
    slotSheet.appendRow(['#001', 'AYA', 'OLED65G3PSA', 68900000, 38900000, '44%', 'Available', '', '', 'GoodSet', 'IS2026Q3-HE']);
    slotSheet.appendRow(['#002', 'AYA', 'OLED55C3PSA', 39900000, 22900000, '43%', 'Available', '', '', 'GoodSet', 'IS2026Q3-HE']);
    slotSheet.appendRow(['#003', 'AYB', 'WT1410NHEG', 32900000, 18900000, '43%', 'Available', '', '', 'Loại A', 'IS2026Q3-HA']);
    slotSheet.appendRow(['#004', 'AYC', 'FB1209S6W', 14900000, 8500000, '43%', 'Available', '', '', 'GoodSet', 'IS2026Q3-HA']);
    slotSheet.appendRow(['#005', 'AYA', '34WP65C', 12500000, 7200000, '42%', 'Available', '', '', 'GoodSet', 'IS2026Q4-BS']);
  }
  
  // 3. Sheet: Config
  var configSheet = ss.getSheetByName(SHEET_CONFIG) || ss.insertSheet(SHEET_CONFIG);
  formatHeader(configSheet, ['Key', 'Value', 'Description']);
  if (configSheet.getLastRow() <= 1) {
    configSheet.appendRow(['MAX_PER_EMPLOYEE', '1', 'Hạn mức mua tối đa mỗi nhân viên']);
    configSheet.appendRow(['PAYMENT_DEADLINE_HOURS', '24', 'Thời gian giữ chỗ thanh toán (giờ)']);
    configSheet.appendRow(['BANK_NAME', 'VIETCOMBANK', 'Ngân hàng nhận chuyển khoản']);
    configSheet.appendRow(['BANK_ACC', '0991000012525', 'Số tài khoản công ty']);
    configSheet.appendRow(['BANK_HOLDER', 'CONG TY TNHH LG ELECTRONICS VIET NAM HAI PHONG', 'Tên chủ tài khoản']);
    configSheet.appendRow(['SYS_STATUS', 'OPEN', 'Trạng thái toàn hệ thống']);
    configSheet.appendRow(['ENABLE_AUTO_EMAIL', 'false', 'Bật/tắt gửi email tự động qua MailApp (true / false). Đổi nhanh bằng công tắc trên Bảng điều khiển PM']);
    configSheet.appendRow(['ALLOW_DEMO_TOKENS', 'false', 'Chỉ bật (true) trên bản STAGING để thử bằng tài khoản demo. Bản chính thức: false']);
  }
  
  // 4. Sheet: ActivityLog
  var logSheet = ss.getSheetByName(SHEET_LOG) || ss.insertSheet(SHEET_LOG);
  formatHeader(logSheet, ['Timestamp', 'Action', 'Employee Code', 'Slot ID', 'User Agent', 'Details']);
  
  // 5. Sheet: Users
  var usersSheet = ss.getSheetByName(SHEET_USERS) || ss.insertSheet(SHEET_USERS);
  formatHeader(usersSheet, ['ID', 'Password', 'Name', 'Department', 'Phone', 'Email', 'Role', 'Status']);
  if (usersSheet.getLastRow() <= 1) {
    usersSheet.appendRow(['VH12345', 'test123', 'Quản Trị Viên PM (Demo)', 'HS PM Support', '0912345678', 'pm.internalsales@lge.com', 'PM', 'Active']);
    usersSheet.appendRow(['VH88921', 'test123', 'Trần Văn Nam (Demo)', 'Audit & Jeong-Do', '0987654321', 'vannam@lge.com', 'USER', 'Active']);
    usersSheet.appendRow(['VH55432', 'test123', 'Lê Hoàng Anh (Demo)', 'HE Sales Division', '0933445566', 'hoanganh@lge.com', 'USER', 'Active']);
  }
  
  // 6. Sheet: Programs (Chuẩn 10 cột khớp 100% PROG_COL)
  var progSheet = ss.getSheetByName(SHEET_PROGRAMS) || ss.insertSheet(SHEET_PROGRAMS);
  formatHeader(progSheet, ['ProgramID', 'Name', 'PM_ID', 'PM_Name', 'Status', 'StartDate', 'EndDate', 'Description', 'MaxPerEmployee', 'CreatedAt']);
  if (progSheet.getLastRow() <= 1) {
    var nowIso = new Date().toISOString();
    progSheet.appendRow(['IS2026Q3-HA', 'CTBHNB HA Q3/2026', 'VH12345', 'Nguyễn Thị Quỳnh Như', 'Open', '2026-09-01 08:00', '2026-10-31 18:00', 'Ưu đãi nội bộ Thiết bị gia dụng cao cấp', 1, nowIso]);
    progSheet.appendRow(['IS2026Q3-HE', 'CTBHNB HE Q3/2026', 'VH12345', 'Nguyễn Thị Quỳnh Như', 'Open', '2026-09-01 08:00', '2026-10-31 18:00', 'Ưu đãi nội bộ Tivi OLED & Dàn âm thanh', 2, nowIso]);
    progSheet.appendRow(['IS2026Q4-BS', 'CTBHNB B2B/BS Q4/2026', 'VH12345', 'Nguyễn Thị Quỳnh Như', 'Draft', '2026-10-01 08:00', '2026-11-30 18:00', 'Ưu đãi Màn hình gram & Thiết bị văn phòng', 1, nowIso]);
  }
  
  // 7. Sheet: Products (Chuẩn 12 cột khớp 100% PROD_COL)
  var prodSheet = ss.getSheetByName(SHEET_PRODUCTS) || ss.insertSheet(SHEET_PRODUCTS);
  formatHeader(prodSheet, ['ProgramID', 'UniqueCode', 'Kho', 'Category', 'Model', 'Description', 'RRP', 'InternalPrice', 'Qty', 'Status', 'EmpCode', 'Timestamp', 'Serial']);
  if (prodSheet.getLastRow() <= 1) {
    var nowIso = new Date().toISOString();
    prodSheet.appendRow(['IS2026Q3-HE', 'HE-001', 'AYA', 'Tivi OLED', 'OLED65G3PSA', 'Smart Tivi OLED evo 4K 65 inch Gallery Edition', 68900000, 38900000, 1, 'Available', '', nowIso]);
    prodSheet.appendRow(['IS2026Q3-HA', 'HA-001', 'AYB', 'Máy giặt sấy', 'WT1410NHEG', 'Tháp giặt sấy thông minh LG WashTower', 32900000, 18900000, 1, 'Available', '', nowIso]);
    prodSheet.appendRow(['IS2026Q4-BS', 'BS-001', 'AYA', 'Màn hình', '34WP65C', 'Màn hình UltraWide cong 34 inch QHD 160Hz', 12500000, 7200000, 1, 'Available', '', nowIso]);
  }
  
  // 8. Sheet: AutoEmail (Nhật ký gửi email tự động)
  var emailSheet = ss.getSheetByName(SHEET_AUTO_EMAIL) || ss.insertSheet(SHEET_AUTO_EMAIL);
  formatHeader(emailSheet, ['EmpName', 'EmpCode', 'Email', 'Type', 'Timestamp']);
  if (emailSheet.getLastRow() <= 1) {
    emailSheet.appendRow(['Trần Văn Nam', 'VH88921', 'vannam@lge.com', 'REGISTRATION_CONFIRM [SYSTEM_INIT]', new Date().toISOString()]);
  }
  
  // Dọn dẹp Sheet1 rỗng mặc định
  var sheet1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính 1');
  if (sheet1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(sheet1); } catch (e) {}
  }
  
  var newId = ss.getId();
  var newUrl = ss.getUrl();
  
  Logger.log('================================================================');
  Logger.log('🎉 TẠO CƠ SỞ DỮ LIỆU THÀNH CÔNG TRÊN GOOGLE DRIVE CỦA BẠN!');
  Logger.log('----------------------------------------------------------------');
  Logger.log('📋 Tên Google Sheet : ' + ss.getName());
  Logger.log('🔑 SPREADSHEET_ID   : ' + newId);
  Logger.log('🔗 Link Google Sheet: ' + newUrl);
  Logger.log('----------------------------------------------------------------');
  Logger.log('👉 CÁC BƯỚC TIẾP THEO:');
  Logger.log('1. Copy mã SPREADSHEET_ID ở trên.');
  Logger.log('2. Project Settings > Script Properties: SPREADSHEET_ID = ' + newId + '  (hoặc dán vào dòng 21 file Code.gs)');
  Logger.log('3. Chọn "Deploy" (Triển khai) > "New deployment" > chọn "Web app".');
  Logger.log('   - Execute as: Me');
  Logger.log('   - Who has access: Anyone');
  Logger.log('4. Copy URL Web App và dán vào Cổng thông tin (giao diện PM Cấu hình API hoặc Mau_Dang_Ky_Internal_Sales_3009.html).');
  Logger.log('================================================================');
  
  return { ok: true, spreadsheetId: newId, url: newUrl };
}

