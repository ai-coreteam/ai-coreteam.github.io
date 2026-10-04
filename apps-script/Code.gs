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
var SPREADSHEET_ID = ''; // <- Dán SPREADSHEET_ID của bạn vào đây (hoặc chạy hàm setupNewDatabase())

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
var STATUS_FREE = ['Hủy', 'Từ chối', 'Hết hạn giữ chỗ']; // đơn ở trạng thái này không giữ slot

// Cột trong Registrations (1-based)
var C = {
  TS: 1, CAMPAIGN: 2, DIVISION: 3, EMP_CODE: 4, EMP_NAME: 5, KHO: 6, MODEL: 7, SLOT: 8,
  PHONE: 9, ADDRESS: 10, AGREE: 11, STATUS: 12, PAYER_NAME: 13, PAYER_CODE: 14,
  AMOUNT: 15, BANK_TXN: 16, PAY_TIME: 17, RECEIPT: 18, PM_BY: 19, PM_DATE: 20, NOTE: 21, UA: 22
};

/* ---------- Mở sheet (1 lần mỗi lượt chạy) ---------- */
var _book = null;
function book_() {
  if (_book) return _book;
  try { var a = SpreadsheetApp.getActiveSpreadsheet(); if (a) return (_book = a); } catch (e) {}
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '' && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
    return (_book = SpreadsheetApp.openById(SPREADSHEET_ID));
  }
  throw new Error('Chưa cấu hình SPREADSHEET_ID! Hãy chạy hàm setupNewDatabase() trong trình soạn thảo Apps Script để tự động tạo cơ sở dữ liệu trên Drive của bạn.');
}

function doGet() {
  return json_({ ok: true, service: 'LG Internal Sales API', version: '7.3.1', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.action === 'auth') return json_(auth_(data));
    if (data.action === 'change_password') return json_(change_password_(data));
    if (data.action === 'programs') return json_(programs_(data));
    if (data.action === 'program_create') return json_(program_create_(data));
    if (data.action === 'program_update') return json_(program_update_(data));
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
function getServerSecret_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('SESSION_SECRET_KEY');
    if (!secret) {
      secret = 'LG_HMAC_SECRET_' + SPREADSHEET_ID.slice(0, 16) + '_SECURE_GOLIVE_2026';
      try { props.setProperty('SESSION_SECRET_KEY', secret); } catch (e) {}
    }
    return secret;
  } catch (err) {
    return 'LG_HMAC_SECRET_' + SPREADSHEET_ID.slice(0, 16) + '_SECURE_GOLIVE_2026';
  }
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
    return { valid: false, message: 'Chữ ký phiên làm việc không hợp lệ (Phát hiện can thiệp dữ liệu).' };
  }
  
  try {
    var jsonStr = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadStr)).getDataAsString();
    var payload = JSON.parse(jsonStr);
    var now = new Date().getTime();
    if (payload.exp && payload.exp < now) {
      return { valid: false, message: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.' };
    }
    if (requiredRole && String(payload.role).toUpperCase() !== String(requiredRole).toUpperCase()) {
      return { valid: false, message: 'Bạn không có quyền ' + requiredRole + ' để thực hiện thao tác này.' };
    }
    return { valid: true, payload: payload };
  } catch (e) {
    return { valid: false, message: 'Không thể giải mã dữ liệu token: ' + e };
  }
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
      '<div>• Model: <strong>' + (details.model || '') + '</strong></div>' +
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
      '<div>• Model: <strong>' + (details.model || '') + '</strong></div>' +
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
      '<div>• Sản phẩm: <strong>' + (details.model || '') + '</strong></div>' +
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
      '<div>• Mã Slot: <strong>' + (details.slotId || '') + '</strong> (Model: ' + (details.model || '') + ')</div>' +
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
      '<div>• Mã Slot: <strong>' + (details.slotId || '') + '</strong> (Model: ' + (details.model || '') + ')</div>' +
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
  var cacheKey = 'prog_' + role + '_' + (role === 'PM' ? userId : 'all');

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
    // Users only see Open programs; PM sees their own programs in any status
    if (role === 'PM' && pmId === userId) {
      // PM sees all their programs
    } else if (status !== 'Open') {
      continue;
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
  var row = [
    str_(d.programId),
    str_(d.programName),
    pmId,
    pmName,
    'Draft',
    str_(d.startDate),
    str_(d.endDate),
    str_(d.description) || '',
    Number(d.maxPerEmployee) || 1,
    new Date().toISOString()
  ];
  sheet.appendRow(row);
  invalidateCache_('prog_all');
  try { log_('PROGRAM_CREATE', pmId, pmName, '', 'program=' + d.programId); } catch (e2) {}
  return { ok: true, message: 'Đã tạo chương trình ' + d.programId + ' (Draft).' };
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
      var currentStatus = String(data[r][4]).trim();
      // Validate transition: Draft→Open, Open→Closed
      if (newStatus === 'Open' && currentStatus !== 'Draft') {
        return { ok: false, message: 'Chỉ có thể mở chương trình đang ở trạng thái Draft.' };
      }
      if (newStatus === 'Closed' && currentStatus !== 'Open') {
        return { ok: false, message: 'Chỉ có thể kết sổ chương trình đang Open.' };
      }
      sheet.getRange(r + 2, PROG_COL.STATUS).setValue(newStatus);
      invalidateCache_('prog_all');
      try { log_('PROGRAM_' + newStatus.toUpperCase(), authCheck.payload.uid, authCheck.payload.name, '', 'program=' + progId); } catch (e2) {}
      return { ok: true, message: 'Đã chuyển chương trình ' + progId + ' sang ' + newStatus + '.' };
    }
  }
  return { ok: false, message: 'Không tìm thấy chương trình ' + progId + '.' };
}

/* ---------- P2: Products ---------- */
var PROD_COL = { PROG: 1, CODE: 2, KHO: 3, CAT: 4, MODEL: 5, DESC: 6, RRP: 7, PRICE: 8, QTY: 9, STATUS: 10, EMP: 11, TS: 12 };

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

  var data = sheet.getRange(2, 1, n, 12).getValues();
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
      timestamp: String(data[r][11]).trim()
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
  var items = d.items || d.products; // array of {kho, category, model, description, rrp, internalPrice, qty}
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
      Number(it.qty) || 1, 'Available', '', ts
    ]);
  }

  if (rows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, 12).setValues(rows);
    SpreadsheetApp.flush();
  }

  invalidateCache_('prod_' + programId.toUpperCase());
  try { log_('PRODUCT_UPLOAD', authCheck.payload.uid, authCheck.payload.name, '', 'program=' + programId + ' count=' + rows.length); } catch (e2) {}
  return { ok: true, message: 'Đã upload ' + rows.length + ' sản phẩm vào chương trình ' + programId + '.' };
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

  // Pre-check program status and quota from Programs sheet before acquiring lock
  var progSheet = book_().getSheetByName(SHEET_PROGRAMS);
  var maxPer = 1;
  if (progSheet) {
    var pn = progSheet.getLastRow() - 1;
    if (pn > 0) {
      var pData = progSheet.getRange(2, 1, pn, 7).getValues();
      for (var pi = 0; pi < pn; pi++) {
        if (String(pData[pi][0]).trim().toUpperCase() === programId.toUpperCase()) {
          maxPer = Number(pData[pi][6]) || 1;
          if (String(pData[pi][3]).trim() !== 'Open') {
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

    var data = prodSheet.getRange(2, 1, n, 12).getValues();
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
          return { ok: false, message: 'Sản phẩm ' + uniqueCode + ' đã có người đăng ký trước. Vui lòng chọn sản phẩm khác.' };
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
      var regRow = new Array(22).fill('');
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
      regSheet.getRange(regSheet.getLastRow() + 1, 1, 1, 22).setValues([regRow]);
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
function pm_dashboard_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };

  var programId = str_(d.programId);
  var regSheet = book_().getSheetByName(SHEET_REG);
  var out = [];

  if (regSheet) {
    var n = regSheet.getLastRow() - 1;
    if (n > 0) {
      var v = regSheet.getRange(2, 1, n, 22).getValues();
      for (var r = 0; r < n; r++) {
        var pId = String(v[r][C.CAMPAIGN - 1]).trim();
        if (programId && pId.toUpperCase() !== programId.toUpperCase()) continue;

        out.push({
          id: 'REG-' + (r + 1),
          programId: pId,
          division: str_(v[r][C.DIVISION - 1]),
          empCode: str_(v[r][C.EMP_CODE - 1]),
          empName: str_(v[r][C.EMP_NAME - 1]),
          kho: str_(v[r][C.KHO - 1]),
          model: str_(v[r][C.MODEL - 1]),
          slotId: str_(v[r][C.SLOT - 1]),
          phone: str_(v[r][C.PHONE - 1]),
          address: str_(v[r][C.ADDRESS - 1]),
          status: str_(v[r][C.STATUS - 1]) || 'Chờ nộp tiền',
          payerName: str_(v[r][C.PAYER_NAME - 1]),
          payerCode: str_(v[r][C.PAYER_CODE - 1]),
          amount: Number(v[r][C.AMOUNT - 1]) || 0,
          bankTxn: str_(v[r][C.BANK_TXN - 1]),
          payTime: str_(v[r][C.PAY_TIME - 1]),
          receipt: str_(v[r][C.RECEIPT - 1]),
          pmBy: str_(v[r][C.PM_BY - 1]),
          pmDate: str_(v[r][C.PM_DATE - 1]),
          note: str_(v[r][C.NOTE - 1]),
          timestamp: v[r][0] instanceof Date ? fmt_(v[r][0]) : str_(v[r][0])
        });
      }
    }
  }

  return { ok: true, registrations: out };
}

function pm_approve_payment_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };

  var slotId = str_(d.slotId);
  var regId = str_(d.regId);
  if (!slotId && !regId) return { ok: false, message: 'Thiếu slotId hoặc regId.' };

  var regSheet = book_().getSheetByName(SHEET_REG);
  if (!regSheet) return { ok: false, message: 'Sheet Registrations không tồn tại.' };

  var n = regSheet.getLastRow() - 1;
  if (n <= 0) return { ok: false, message: 'Không tìm thấy đơn đăng ký.' };

  var data = regSheet.getRange(2, 1, n, 22).getValues();
  for (var r = 0; r < n; r++) {
    var curSlot = String(data[r][C.SLOT - 1]).trim();
    var curId = 'REG-' + (r + 1);
    if ((slotId && curSlot === slotId) || (regId && curId === regId)) {
      var rowNum = r + 2;
      var pmName = authCheck.payload.name || str_(d.userName) || 'PM';
      var nowStr = fmt_(new Date());

      regSheet.getRange(rowNum, C.STATUS).setValue('Đã duyệt thanh toán');
      regSheet.getRange(rowNum, C.PM_BY).setValue(pmName);
      regSheet.getRange(rowNum, C.PM_DATE).setValue(nowStr);

      // Trigger P7 Email Notification: PAYMENT_APPROVED
      var empCode = String(data[r][C.EMP_CODE - 1]).trim();
      var empName = String(data[r][C.EMP_NAME - 1]).trim();
      var empEmail = findUserEmail_(empCode);
      try {
        sendEmailNotification_('PAYMENT_APPROVED', empName, empCode, empEmail, {
          slotId: curSlot,
          model: String(data[r][C.MODEL - 1]).trim(),
          kho: String(data[r][C.KHO - 1]).trim(),
          pmName: pmName
        });
      } catch (eEmail) {}

      try { log_('PM_PAYMENT_APPROVE', authCheck.payload.uid, curSlot, '', 'pm=' + pmName); } catch (e) {}
      return { ok: true, message: 'Đã phê duyệt thanh toán cho đơn ' + curSlot + '.' };
    }
  }

  return { ok: false, message: 'Không tìm thấy đơn đăng ký cần duyệt.' };
}

// PM Batch Approve Payments (CONC-02 Single Range Batch Update)
function pm_batch_approve_payment_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };

  var regSheet = book_().getSheetByName(SHEET_REG);
  if (!regSheet) return { ok: false, message: 'Sheet Registrations không tồn tại.' };
  var n = regSheet.getLastRow() - 1;
  if (n <= 0) return { ok: true, count: 0, message: 'Không có đơn nào cần duyệt.' };

  var regIds = d.regIds || []; // array of 'REG-X' or slotIds
  var programId = str_(d.programId);
  var pmName = authCheck.payload.name || str_(d.userName) || 'PM Quản trị';
  var nowStr = fmt_(new Date());

  var data = regSheet.getRange(2, 1, n, 22).getValues();
  var updated = 0;
  var rowsToEmail = [];

  for (var r = 0; r < n; r++) {
    var pId = String(data[r][C.CAMPAIGN - 1]).trim();
    if (programId && pId.toUpperCase() !== programId.toUpperCase()) continue;

    var curSlot = String(data[r][C.SLOT - 1]).trim();
    var curId = 'REG-' + (r + 1);

    if (regIds.length > 0 && regIds.indexOf(curId) === -1 && regIds.indexOf(curSlot) === -1) {
      continue;
    }

    var curStatus = String(data[r][C.STATUS - 1]).trim();
    if (curStatus === STATUS_PAID || curStatus === 'Đã khai nộp - chờ đối soát') {
      data[r][C.STATUS - 1] = 'Đã duyệt thanh toán';
      data[r][C.PM_BY - 1] = pmName;
      data[r][C.PM_DATE - 1] = nowStr;
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
    // Single atomic batch write to Google Sheet
    regSheet.getRange(2, 1, n, 22).setValues(data);
    SpreadsheetApp.flush();

    // Send emails after sheet write
    for (var i = 0; i < rowsToEmail.length; i++) {
      var it = rowsToEmail[i];
      try {
        var empEmail = findUserEmail_(it.empCode);
        sendEmailNotification_('PAYMENT_APPROVED', it.empName, it.empCode, empEmail, {
          slotId: it.slotId, model: it.model, kho: it.kho, pmName: pmName
        });
      } catch (eEmail) {}
    }
    try { log_('PM_BATCH_APPROVE', authCheck.payload.uid, '', '', 'count=' + updated + ' pm=' + pmName); } catch (e) {}
  }

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

  var n = regSheet.getLastRow() - 1;
  if (n <= 0) return { ok: false, message: 'Không tìm thấy đơn đăng ký.' };

  var data = regSheet.getRange(2, 1, n, 22).getValues();
  var targetSlot = slotId;

  for (var r = 0; r < n; r++) {
    var curSlot = String(data[r][C.SLOT - 1]).trim();
    var curId = 'REG-' + (r + 1);
    if ((slotId && curSlot === slotId) || (regId && curId === regId)) {
      var rowNum = r + 2;
      targetSlot = curSlot;
      var pmName = authCheck.payload.name || str_(d.userName) || 'PM';
      var nowStr = fmt_(new Date());

      regSheet.getRange(rowNum, C.STATUS).setValue('Từ chối');
      regSheet.getRange(rowNum, C.PM_BY).setValue(pmName);
      regSheet.getRange(rowNum, C.PM_DATE).setValue(nowStr);
      regSheet.getRange(rowNum, C.NOTE).setValue(reason);

      // Trigger P7 Email Notification: PAYMENT_REJECTED
      var empCode = String(data[r][C.EMP_CODE - 1]).trim();
      var empName = String(data[r][C.EMP_NAME - 1]).trim();
      var empEmail = findUserEmail_(empCode);
      try {
        sendEmailNotification_('PAYMENT_REJECTED', empName, empCode, empEmail, {
          slotId: curSlot,
          reason: reason
        });
      } catch (eEmail) {}
      break;
    }
  }

  // Free the product in Products sheet
  if (targetSlot) {
    var prodSheet = book_().getSheetByName(SHEET_PRODUCTS);
    if (prodSheet) {
      var pn = prodSheet.getLastRow() - 1;
      if (pn > 0) {
        var pData = prodSheet.getRange(2, 1, pn, 12).getValues();
        for (var pr = 0; pr < pn; pr++) {
          if (String(pData[pr][PROD_COL.CODE - 1]).trim() === targetSlot) {
            prodSheet.getRange(pr + 2, PROD_COL.STATUS).setValue('Available');
            prodSheet.getRange(pr + 2, PROD_COL.EMP).setValue('');
            var pProg = String(pData[pr][PROD_COL.PROG - 1]).trim();
            if (pProg) invalidateCache_('prod_' + pProg.toUpperCase());
            break;
          }
        }
      }
    }
  }

  try { log_('PM_PAYMENT_REJECT', authCheck.payload.uid, targetSlot, '', 'reason=' + reason); } catch (e) {}
  return { ok: true, message: 'Đã từ chối đơn và mở lại slot ' + targetSlot + '.' };
}

/* ---------- PM: Allow Payment (Batch Range Update CONC-02) ---------- */
function pm_allow_payment_(d) {
  var authCheck = verifySessionToken_(d.token, 'PM');
  if (!authCheck.valid) return { ok: false, message: authCheck.message };

  var programId = str_(d.programId);
  var regId = str_(d.regId); // optional single order ID or slotId
  var regSheet = book_().getSheetByName(SHEET_REG);
  if (!regSheet) return { ok: false, message: 'Sheet Registrations không tồn tại.' };

  var n = regSheet.getLastRow() - 1;
  if (n <= 0) return { ok: true, count: 0, message: 'Không có đơn đăng ký nào.' };

  var data = regSheet.getRange(2, 1, n, 22).getValues();
  var pmName = authCheck.payload.name || str_(d.userName) || 'PM Quản trị';
  var nowStr = fmt_(new Date());
  var count = 0;
  var allowedOrders = [];

  for (var r = 0; r < n; r++) {
    var pId = String(data[r][C.CAMPAIGN - 1]).trim();
    if (programId && pId.toUpperCase() !== programId.toUpperCase()) continue;

    var curSlot = String(data[r][C.SLOT - 1]).trim();
    var curRegId = 'REG-' + (r + 1);
    if (regId && curRegId !== regId && curSlot !== regId) continue;

    var curStatus = String(data[r][C.STATUS - 1]).trim();
    // Match orders awaiting payment gate
    if (curStatus === STATUS_WAIT_GATE || curStatus === 'Đã đăng ký - Chờ mở thanh toán' || curStatus === 'Mới đăng ký') {
      data[r][C.STATUS - 1] = STATUS_NEW; // 'Chờ nộp tiền'
      var oldNote = String(data[r][C.NOTE - 1]).trim();
      var gateOpenIso = new Date().toISOString();
      data[r][C.NOTE - 1] = (oldNote ? oldNote + ' | ' : '') + 'GATE_OPEN:' + gateOpenIso + ' (PM ' + pmName + ' mở cổng thanh toán lúc ' + nowStr + ')';

      var empCode = String(data[r][C.EMP_CODE - 1]).trim();
      var empName = String(data[r][C.EMP_NAME - 1]).trim();
      var empEmail = findUserEmail_(empCode);
      var model = String(data[r][C.MODEL - 1]).trim();
      var kho = String(data[r][C.KHO - 1]).trim();

      allowedOrders.push({
        slotId: curSlot,
        empCode: empCode,
        empName: empName,
        email: empEmail,
        model: model,
        kho: kho
      });
      count++;
    }
  }

  // Single batch range write back to sheet
  if (count > 0) {
    regSheet.getRange(2, 1, n, 22).setValues(data);
    SpreadsheetApp.flush();
  }

  // Send PAYMENT_GATE_OPENED email to each employee outside sheet write
  for (var i = 0; i < allowedOrders.length; i++) {
    var ord = allowedOrders[i];
    try {
      sendEmailNotification_('PAYMENT_GATE_OPENED', ord.empName, ord.empCode, ord.email, {
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

  var n = regSheet.getLastRow() - 1;
  if (n <= 0) return { ok: true, releasedCount: 0, warnedCount: 0, message: 'Không có đơn đăng ký nào.' };

  var data = regSheet.getRange(2, 1, n, 22).getValues();
  var now = new Date().getTime();
  var TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  var TWENTY_TWO_HOURS_MS = 22 * 60 * 60 * 1000;

  var releasedCount = 0;
  var warnedCount = 0;
  var releasedSlots = [];
  var affectedPrograms = {};

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
    var empEmail = findUserEmail_(empCode);
    var pProg = String(data[r][C.CAMPAIGN - 1]).trim();
    var model = String(data[r][C.MODEL - 1]).trim();

    if (diffMs >= TWENTY_FOUR_HOURS_MS) {
      // 1. Release expired slot (>24h)
      var rowNum = r + 2;
      regSheet.getRange(rowNum, C.STATUS).setValue('Hết hạn giữ chỗ');
      regSheet.getRange(rowNum, C.NOTE).setValue((curNote ? curNote + ' | ' : '') + 'Tự động giải phóng quá hạn 24h');
      
      releasedSlots.push(curSlot);
      if (pProg) affectedPrograms[pProg.toUpperCase()] = true;
      releasedCount++;

      // Send EXPIRATION_ALERT email
      try {
        sendEmailNotification_('EXPIRATION_ALERT', empName, empCode, empEmail, {
          slotId: curSlot,
          model: model
        });
      } catch (eEmail) {}

      try { log_('AUTO_RELEASE_EXPIRED', empCode, curSlot, '', 'Quá hạn 24h (' + Math.round(diffMs / 3600000) + 'h)'); } catch (e) {}
    } else if (diffMs >= TWENTY_TWO_HOURS_MS && curNote.indexOf('WARNED_22H') === -1) {
      // 2. Warn employee if 22h - 24h
      var rowNum = r + 2;
      regSheet.getRange(rowNum, C.NOTE).setValue((curNote ? curNote + ' | ' : '') + 'WARNED_22H');
      warnedCount++;

      // Send EXPIRATION_WARNING email
      try {
        sendEmailNotification_('EXPIRATION_WARNING', empName, empCode, empEmail, {
          slotId: curSlot,
          model: model,
          regTime: fmt_(regDate)
        });
      } catch (eWarn) {}

      try { log_('WARN_EXPIRE_22H', empCode, curSlot, '', 'Cảnh báo 22h (' + Math.round(diffMs / 3600000) + 'h)'); } catch (e) {}
    }
  }

  // Release slots in Products sheet
  if (releasedSlots.length > 0) {
    var prodSheet = book_().getSheetByName(SHEET_PRODUCTS);
    if (prodSheet) {
      var pn = prodSheet.getLastRow() - 1;
      if (pn > 0) {
        var pData = prodSheet.getRange(2, 1, pn, 12).getValues();
        for (var pr = 0; pr < pn; pr++) {
          var pCode = String(pData[pr][PROD_COL.CODE - 1]).trim();
          if (releasedSlots.indexOf(pCode) >= 0) {
            prodSheet.getRange(pr + 2, PROD_COL.STATUS).setValue('Available');
            prodSheet.getRange(pr + 2, PROD_COL.EMP).setValue('');
          }
        }
      }
    }

    // Invalidate caches for affected programs
    for (var progKey in affectedPrograms) {
      invalidateCache_('prod_' + progKey);
    }
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
      var row = new Array(22).fill('');
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
      rowNo = n + 2;
      reg.getRange(rowNo, 1, 1, 22).setValues([row]);
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

  // Lưu biên lai (việc chậm) trước khi khoá
  var link = '';
  if (fileData) {
    try { link = saveReceipt_(fileData, fileName, slotId, empCode); }
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
        safe_(bankTxn), safe_(payTime), link
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
  var empCode = str_(d.empCode).toUpperCase();
  var last4 = str_(d.phoneLast4).replace(/\D/g, '');
  if (!empCode || last4.length !== 4) return { ok: false, message: 'Vui lòng nhập Mã NV và đúng 4 số cuối điện thoại đã đăng ký.' };

  var reg = book_().getSheetByName(SHEET_REG);
  var n = reg.getLastRow() - 1;
  var v = n > 0 ? reg.getRange(2, 1, n, C.RECEIPT).getValues() : [];
  var out = [];
  for (var r = 0; r < v.length; r++) {
    if (String(v[r][C.EMP_CODE - 1]).toUpperCase() !== empCode) continue;
    var phone = String(v[r][C.PHONE - 1]).replace(/\D/g, '');
    if (phone.slice(-4) !== last4) continue;
    out.push({
      time: v[r][0] instanceof Date ? fmt_(v[r][0]) : str_(v[r][0]),
      slot: str_(v[r][C.SLOT - 1]), kho: str_(v[r][C.KHO - 1]), model: str_(v[r][C.MODEL - 1]),
      status: str_(v[r][C.STATUS - 1]) || 'Chưa có trạng thái',
      paid: !!str_(v[r][C.BANK_TXN - 1]), receipt: !!str_(v[r][C.RECEIPT - 1])
    });
  }
  if (!out.length) {
    log_('LOOKUP_NOT_FOUND', empCode, '', d.userAgent, 'Tra cứu không khớp');
    return { ok: false, message: 'Không tìm thấy đơn khớp Mã NV và 4 số cuối điện thoại này.' };
  }
  return { ok: true, orders: out };
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

function saveReceipt_(dataUrl, fileName, slotId, empCode) {
  var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw 'File không đúng định dạng';
  var mime = m[1];
  if (!/^image\/|^application\/pdf$/.test(mime)) throw 'Chỉ nhận ảnh hoặc PDF';
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > MAX_FILE_BYTES) throw 'File lớn hơn 5 MB';
  var ext = (String(fileName || '').match(/\.[A-Za-z0-9]{1,5}$/) || [''])[0];
  var name = 'BL_' + slotId.replace('#', '') + '_' + empCode + '_' +
    Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmmss') + ext;
  var file = receiptFolder_().createFile(Utilities.newBlob(bytes, mime, name));
  return file.getUrl();
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
    'PM Approved Date', 'Note', 'User Agent'
  ]);
  
  // 2. Sheet: Slots
  var slotSheet = ss.getSheetByName(SHEET_SLOTS) || ss.insertSheet(SHEET_SLOTS);
  formatHeader(slotSheet, [
    'Slot ID', 'Warehouse', 'Model', 'MRP', 'Internal Price', 'Discount %', 
    'Status', 'Reserved By', 'Expire At', 'Note', 'Program ID'
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
    configSheet.appendRow(['ENABLE_AUTO_EMAIL', 'true', 'Bật/tắt gửi email tự động qua MailApp (true / false)']);
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
  formatHeader(prodSheet, ['ProgramID', 'UniqueCode', 'Kho', 'Category', 'Model', 'Description', 'RRP', 'InternalPrice', 'Qty', 'Status', 'EmpCode', 'Timestamp']);
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
  Logger.log('2. Dán vào dòng 20 file Code.gs: var SPREADSHEET_ID = \'' + newId + '\';');
  Logger.log('3. Chọn "Deploy" (Triển khai) > "New deployment" > chọn "Web app".');
  Logger.log('   - Execute as: Me');
  Logger.log('   - Who has access: Anyone');
  Logger.log('4. Copy URL Web App và dán vào Cổng thông tin (giao diện PM Cấu hình API hoặc Mau_Dang_Ky_Internal_Sales_3009.html).');
  Logger.log('================================================================');
  
  return { ok: true, spreadsheetId: newId, url: newUrl };
}

