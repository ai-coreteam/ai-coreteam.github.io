/**
 * Backend harness — runs the REAL apps-script/Code.gs in Node against an in-memory Google Sheet.
 *
 * Why: tests/run_e2e_tests.js checks strings and copied logic. This file executes Code.gs itself
 * (doPost / doGet routes) with mocked Apps Script services, so security and data rules are tested on
 * the code that will be deployed. It also records every write to Registrations / Products and flags
 * any write made while LockService is NOT held (the lost-update risk V1-10).
 *
 * Limits (be honest): single-threaded — proves the lock is HELD during writes, not real contention;
 * Google quotas, latency and MailApp delivery are not modelled. Those need the STAGING run.
 *
 * Run:  node tests/backend_gas_harness.js      Exit 0 = all pass, 1 = failures
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

// ---------------------------------------------------------------- mocks
const signed = buf => Array.from(buf).map(b => (b > 127 ? b - 256 : b));
const unsigned = arr => Buffer.from(arr.map(b => b & 255));
const toBuf = v => (typeof v === 'string' ? Buffer.from(v, 'utf8') : unsigned(v));

const state = { lockHeld: false, unlockedWrites: [], mails: [], logs: [] };
const LOCK_CHECKED = new Set(['Registrations', 'Products']);

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = this.sheet.rows[this.r - 1 + i] || [];
      const vals = [];
      for (let j = 0; j < this.nc; j++) { const v = row[this.c - 1 + j]; vals.push(v === undefined ? '' : v); }
      out.push(vals);
    }
    return out;
  }
  getValue() { return this.getValues()[0][0]; }
  setValues(vals) {
    this.sheet.noteWrite(`setValues r${this.r} ${this.nr}x${this.nc}`);
    for (let i = 0; i < vals.length; i++) {
      const idx = this.r - 1 + i;
      while (this.sheet.rows.length <= idx) this.sheet.rows.push([]);
      for (let j = 0; j < vals[i].length; j++) this.sheet.rows[idx][this.c - 1 + j] = vals[i][j];
    }
    return this;
  }
  setValue(v) { return this.setValues([[v]]); }
  setBackground() { return this; } setFontColor() { return this; } setFontWeight() { return this; }
  setFontFamily() { return this; } setFontSize() { return this; }
}

class Sheet {
  constructor(name, rows) { this.name = name; this.rows = rows || []; }
  noteWrite(what) {
    if (LOCK_CHECKED.has(this.name) && !state.lockHeld) state.unlockedWrites.push(`${this.name}: ${what} (${state.currentAction})`);
  }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
  getMaxColumns() { return this.maxCols || 26; }
  insertColumnsAfter(after, n) { this.maxCols = this.getMaxColumns() + n; this.insertedCols = (this.insertedCols || 0) + n; return this; }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  appendRow(arr) { this.noteWrite('appendRow'); this.rows.push(arr.slice()); }
  deleteRow(i) { this.noteWrite('deleteRow'); this.rows.splice(i - 1, 1); }
  clear() { this.noteWrite('clear'); this.rows = []; }
  setFrozenRows() {} autoResizeColumn() {}
}

class Book {
  constructor(sheets) { this.sheets = {}; for (const [n, rows] of Object.entries(sheets)) this.sheets[n] = new Sheet(n, rows); }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new Sheet(n, [])); }
  getSheets() { return Object.values(this.sheets); }
  deleteSheet(s) { delete this.sheets[s.name]; }
  getId() { return 'MOCK_BOOK'; } getUrl() { return 'https://mock'; } getName() { return 'Mock'; }
}

// Drive giả lập: thư mục / file có cha, đủ cho lưu biên lai và chia thư mục theo chương trình
function makeDrive() {
  const folders = {}, files = {}; let seq = 0;
  const iter = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  const fileApi = id => ({ getId: () => id, getName: () => files[id].name, getUrl: () => `https://drive.google.com/file/d/${id}/view?usp=drivesdk`,
    moveTo: f => { files[id].parentId = f.getId(); return fileApi(id); } });
  const api = id => ({ getId: () => id, getName: () => folders[id].name, setName: n => { folders[id].name = n; }, isTrashed: () => !!folders[id].trashed,
    createFolder: n => mk(n, id),
    createFile: b => { const fid = 'FILE' + (++seq) + 'abcdefghijklmnopqrstuvwxyz0123'; files[fid] = { id: fid, name: b.getName(), parentId: id }; return fileApi(fid); },
    getFolders: () => iter(Object.values(folders).filter(f => f.parentId === id).map(f => api(f.id))),
    getFiles: () => iter(Object.values(files).filter(f => f.parentId === id).map(f => fileApi(f.id))) });
  const mk = (name, parentId) => { const id = 'FOLDER' + (++seq) + 'abcdefghijklmnopqrstuvwxyz01'; folders[id] = { id, name, parentId }; return api(id); };
  const root = mk('Bien lai nop tien', null);
  return { folders, files, root, DriveApp: { getFolderById: id => { if (!folders[id]) throw new Error('no folder ' + id); return api(id); } } };
}

function makeServices(book, props, cache) {
  state.drive = makeDrive();
  return {
    SpreadsheetApp: { getActiveSpreadsheet: () => book, openById: () => book, create: () => book, flush() {} },
    LockService: {
      getScriptLock: () => ({
        tryLock() { if (state.lockHeld) throw new Error('nested lock'); state.lockHeld = true; return true; },
        releaseLock() { state.lockHeld = false; }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: k => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, v),
        remove: k => cache.delete(k), removeAll: ks => ks.forEach(k => cache.delete(k))
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => signed(crypto.createHash('sha256').update(s, 'utf8').digest()),
      computeHmacSha256Signature: (v, k) => signed(crypto.createHmac('sha256', toBuf(k)).update(toBuf(v)).digest()),
      base64EncodeWebSafe: v => toBuf(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: s => signed(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      base64Decode: s => signed(Buffer.from(s, 'base64')),
      newBlob: (bytes, mime, name) => ({ getDataAsString: () => unsigned(bytes).toString('utf8'), getName: () => name }),
      getUuid: () => crypto.randomUUID(),
      formatDate: d => d.toISOString().replace('T', ' ').slice(0, 19)
    },
    MailApp: { sendEmail: m => state.mails.push({ ...m, duringLock: state.lockHeld }), getRemainingDailyQuota: () => 100 },
    Logger: { log: m => state.logs.push(String(m)) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ content: s, setMimeType() { return this; } }) },
    DriveApp: state.drive.DriveApp
  };
}

// ---------------------------------------------------------------- fixture
const PID = 'IS-2026Q4-TV-01';
function freshBook() {
  const now = new Date().toISOString();
  return new Book({
    Registrations: [['Timestamp', 'Campaign', 'Division', 'Employee Code', 'Employee Name', 'Warehouse', 'Model', 'Slot ID', 'Phone', 'Address', 'Agree', 'Status', 'Payer Name', 'Payer Code', 'Amount', 'Bank Txn', 'Pay Time', 'Receipt', 'PM By', 'PM Date', 'Note', 'UA']],
    Slots: [['WH', 'No', 'Slot ID', 'Model']],
    Config: [['Key', 'Value', 'Description'], ['MAX_PER_EMPLOYEE', '1', ''], ['ENABLE_AUTO_EMAIL', true, '']],
    ActivityLog: [['Timestamp', 'Action', 'Emp', 'Slot', 'UA', 'Details']],
    Users: [['ID', 'Password', 'Name', 'Dept', 'Phone', 'Email', 'Role', 'Status'],
      ['VH12345', 'test123', 'PM Owner', 'HS PM', '0912345678', 'pm@x.com', 'PM', 'Active'],
      ['VH70001', 'pw1', 'Nhan Vien 1', 'QA', '0900001111', 'a@x.com', 'USER', 'Active'],
      ['VH70002', 'pw2', 'Nhan Vien 2', 'QA', '0900002222', 'b@x.com', 'USER', 'Active'],
      ['VH80000', 'pw3', 'PM Khac', 'HE PM', '0900003333', 'c@x.com', 'PM', 'Active'],
      ['VH77777', 'pwA', 'Admin He Thong', 'Audit', '0900007777', 'adm@x.com', 'ADMIN', 'Active']],
    Programs: [['ProgramID', 'Name', 'PM_ID', 'PM_Name', 'Status', 'Start', 'End', 'Desc', 'Max', 'Created'],
      [PID, 'Dot test', 'VH12345', 'PM Owner', 'Open', '', '', '', 1, now],
      ['IS-DRAFT-01', 'Dot nhap', 'VH80000', 'PM Khac', 'Draft', '', '', '', 1, now]],
    Products: [['ProgramID', 'UniqueCode', 'Kho', 'Category', 'Model', 'Description', 'RRP', 'InternalPrice', 'Qty', 'Status', 'EmpCode', 'Timestamp'],
      [PID, PID + '-AYA-001', 'AYA', 'TV', 'M1', 'd', 10000000, 5000000, 1, 'Available', '', now],
      [PID, PID + '-AYA-002', 'AYA', 'TV', 'M2', 'd', 10000000, 5000000, 1, 'Available', '', now],
      [PID, PID + '-AYA-003', 'AYA', 'TV', 'M3', 'd', 10000000, 5000000, 1, 'Available', '', now]],
    AutoEmail: [['EmpName', 'EmpCode', 'Email', 'Type', 'Timestamp']]
  });
}

function load(book) {
  const props = {}, cache = new Map();
  const ctx = vm.createContext({ ...makeServices(book, props, cache), console, Date, JSON, Math, String, Number, Array, Object, RegExp, isNaN, Error });
  vm.runInContext(fs.readFileSync(process.env.CODE_GS || path.join(__dirname, '../apps-script/Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  const post = data => {
    state.currentAction = data.action;
    return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(data) } }).content);
  };
  const get = params => JSON.parse(ctx.doGet({ parameter: params }).content);
  return { ctx, post, get, props, cache };
}

const forgeDemoToken = payload =>
  Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.demo_local_signature';

// ---------------------------------------------------------------- tests
let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) { pass++; console.log('  PASS ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };
const regRows = b => b.getSheetByName('Registrations').rows.slice(1);
const prodStatus = (b, code) => b.getSheetByName('Products').rows.find(r => r[1] === code)[9];

console.log('--- B: Ổ khóa (xác thực) ---');
{
  const book = freshBook(); const { post } = load(book);
  const exp = Date.now() + 3600e3;
  for (const [label, p] of [['demo PM VH12345', { uid: 'VH12345', role: 'PM', name: 'x', exp }],
                            ['demo ADMIN', { uid: 'ADMIN', role: 'PM', name: 'x', exp }]]) {
    const r = post({ action: 'pm_allow_payment', token: forgeDemoToken(p), programId: PID });
    check(r.ok === false, `token giả "${label}" bị từ chối khi mở cổng (${r.message})`);
  }
  const tampered = forgeDemoToken({ uid: 'ADMIN', role: 'PM', exp }).replace('.demo_local_signature', '.abc');
  check(post({ action: 'pm_dashboard', token: tampered }).ok === false, 'token chữ ký sai bị từ chối');
  check(post({ action: 'pm_dashboard' }).ok === false, 'thiếu token bị từ chối');

  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  check(pm.ok && !!pm.token, 'đăng nhập thật cấp token');
  check(post({ action: 'pm_dashboard', token: pm.token, programId: PID }).ok === true, 'token thật của PM vào được Dashboard (hồi quy)');
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  check(post({ action: 'pm_dashboard', token: u1.token }).ok === false, 'nhân viên dùng token thật không vào được API của PM');
}
{
  const book = freshBook();
  book.getSheetByName('Config').rows.push(['ALLOW_DEMO_TOKENS', 'true', '']);
  const { post } = load(book);
  const userAsPm = post({ action: 'pm_dashboard', token: forgeDemoToken({ uid: 'VH70001', role: 'USER', exp: Date.now() + 3600e3 }) });
  check(userAsPm.ok === false, 'ALLOW_DEMO_TOKENS=true (staging): token demo vai USER vẫn KHÔNG vào được API PM');
  const expired = post({ action: 'pm_dashboard', token: forgeDemoToken({ uid: 'VH12345', role: 'PM', exp: Date.now() - 1 }) });
  check(expired.ok === false, 'ALLOW_DEMO_TOKENS=true: token demo hết hạn bị từ chối');
}
{
  const { props, ctx } = load(freshBook());
  const s1 = ctx.getServerSecret_();
  check(!/LG_HMAC_SECRET_/.test(s1) && s1.length > 60, 'khóa bí mật là chuỗi ngẫu nhiên, không suy ra từ SPREADSHEET_ID');
  ctx.rotateSessionSecret();
  check(props.SESSION_SECRET_KEY !== s1, 'rotateSessionSecret() thay khóa mới');
}

console.log('--- B3 / C6: Giữ chỗ chỉ cho chính mình + danh sách slot đã hết ---');
{
  const book = freshBook(); const { post, get } = load(book);
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  const u2 = post({ action: 'auth', id: 'VH70002', password: 'pw2' });
  const code1 = PID + '-AYA-001';
  const spoof = post({ action: 'register_product', token: u1.token, uniqueCode: code1, programId: PID, empCode: 'VH70002', empName: 'x' });
  check(spoof.ok === false, 'giữ chỗ dưới tên người khác bị từ chối');
  check(post({ action: 'register_product', uniqueCode: code1, programId: PID, empCode: 'VH70001', empName: 'x' }).ok === false, 'giữ chỗ không token bị từ chối');
  const a = post({ action: 'register_product', token: u1.token, uniqueCode: code1, programId: PID, empCode: 'VH70001', empName: 'Nhan Vien 1' });
  check(a.ok === true, 'A giữ chỗ thành công');
  const b = post({ action: 'register_product', token: u2.token, uniqueCode: code1, programId: PID, empCode: 'VH70002', empName: 'Nhan Vien 2' });
  check(b.ok === false && b.slotTaken === true, 'B bấm cùng slot → bị từ chối (không thể trùng)');
  check(Array.isArray(b.taken) && b.taken.includes(code1), 'phản hồi từ chối kèm danh sách slot đã hết');
  check(regRows(book).length === 1, 'Registrations chỉ có 1 đơn cho slot đó');
  const t = get({ action: 'taken', programId: PID });
  check(t.ok && t.taken.length === 1 && t.taken[0] === code1, `doGet?action=taken trả đúng slot đã hết (${JSON.stringify(t.taken)})`);
  check(get({}).ok === true && get({}).service, 'doGet không tham số vẫn trả thông tin dịch vụ (ping cấu hình API)');
  const lk = post({ action: 'lookup', token: u1.token, empCode: 'VH70001' });
  check(lk.ok && lk.orders[0].programId === PID, 'lookup trả programId cho ô "03 Đơn hàng của bạn"');
}

console.log('--- C2: Hủy giữ chỗ (quy tắc đã duyệt: chỉ trước khi khai nộp) ---');
{
  const book = freshBook(); const { post, get } = load(book);
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  const u2 = post({ action: 'auth', id: 'VH70002', password: 'pw2' });
  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  const c1 = PID + '-AYA-001', c2 = PID + '-AYA-002';
  post({ action: 'register_product', token: u1.token, uniqueCode: c1, programId: PID, empCode: 'VH70001', empName: 'NV1' });
  check(post({ action: 'user_cancel_registration', token: u2.token, userId: 'VH70001', slotId: c1 }).ok === false, 'không hủy được đơn của người khác');
  const ok = post({ action: 'user_cancel_registration', token: u1.token, userId: 'VH70001', slotId: c1 });
  check(ok.ok === true, 'hủy khi "Chờ mở thanh toán" → thành công');
  check(prodStatus(book, c1) === 'Available' && regRows(book)[0][11] === 'Đã hủy bởi nhân viên', 'slot trả về kho, đơn ghi "Đã hủy bởi nhân viên"');
  check(get({ action: 'taken', programId: PID }).taken.length === 0, 'polling thấy slot trống ngay sau khi hủy');
  check(post({ action: 'register_product', token: u2.token, uniqueCode: c1, programId: PID, empCode: 'VH70002', empName: 'NV2' }).ok === true, 'đồng nghiệp giữ được slot vừa hủy');

  post({ action: 'register_product', token: u1.token, uniqueCode: c2, programId: PID, empCode: 'VH70001', empName: 'NV1' });
  post({ action: 'pm_allow_payment', token: pm.token, programId: PID });
  const pay = post({ action: 'payment', token: u1.token, slotId: c2, empCode: 'VH70001', payerName: 'NV1', bankTxn: 'FT123', amount: 1 });
  check(pay.ok === true && pay.amount === 5000000, 'khai nộp tiền có token → OK, máy chủ áp giá chuẩn (hồi quy DATA-01)');
  check(post({ action: 'payment', slotId: c2, empCode: 'VH70001', payerName: 'x', bankTxn: 'FT9' }).ok === false, 'khai nộp không token bị từ chối');
  const late = post({ action: 'user_cancel_registration', token: u1.token, userId: 'VH70001', slotId: c2 });
  check(late.ok === false && /khai nộp/.test(late.message), 'đã khai nộp tiền → KHÔNG tự hủy được, hướng dẫn liên hệ PM');
}

console.log('--- Ngày giờ ghi dạng CHỮ (06/10/2026: Google Sheet tự đổi "06/10/2026" thành 10/06 theo kiểu tháng/ngày) ---');
{
  const book = freshBook(); const { post } = load(book);
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  const u2 = post({ action: 'auth', id: 'VH70002', password: 'pw2' });
  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  const c1 = PID + '-AYA-001', c2 = PID + '-AYA-002';
  post({ action: 'register_product', token: u1.token, uniqueCode: c1, programId: PID, empCode: 'VH70001', empName: 'NV1' });
  post({ action: 'register_product', token: u2.token, uniqueCode: c2, programId: PID, empCode: 'VH70002', empName: 'NV2' });
  post({ action: 'pm_allow_payment', token: pm.token, programId: PID });
  post({ action: 'payment', token: u1.token, slotId: c1, empCode: 'VH70001', payerName: 'NV1', bankTxn: 'FT1', payTime: '06/10/2026 15:00:00' });
  post({ action: 'payment', token: u2.token, slotId: c2, empCode: 'VH70002', payerName: 'NV2', bankTxn: 'FT2' });
  const rowOf = slot => regRows(book).find(r => String(r[7]).replace(/^'/, '') === slot);
  // Dấu ' đầu = Sheet giữ nguyên chữ (mock formatDate trả yyyy-MM-dd; máy chủ thật trả dd/MM/yyyy)
  const asText = v => typeof v === 'string' && v.length > 1 && v[0] === "'";
  check(rowOf(c1)[16] === "'06/10/2026 15:00:00", 'Thời gian nộp người dùng khai được ghi dạng chữ, giữ đúng ngày/tháng');
  check(asText(rowOf(c2)[16]), 'không khai giờ → giờ máy chủ cũng ghi dạng chữ');
  check(post({ action: 'pm_approve_payment', token: pm.token, slotId: c1 }).ok === true && asText(rowOf(c1)[19]), 'PM duyệt từng đơn → Ngày PM duyệt dạng chữ');
  check(post({ action: 'pm_reject_payment', token: pm.token, slotId: c2, reason: 'test' }).ok === true && asText(rowOf(c2)[19]), 'PM từ chối → Ngày PM duyệt dạng chữ');
  const dash = post({ action: 'pm_dashboard', token: pm.token, programId: PID });
  const r1 = (dash.registrations || []).find(r => r.slotId === c1) || {};
  check(r1.payTime !== undefined && /^'?06\/10\/2026 15:00:00$/.test(r1.payTime), 'Dashboard PM đọc lại đúng Thời gian nộp (Sheet thật bỏ dấu \' khi đọc)');
}
{
  const book = freshBook(); const { post } = load(book);
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  const c1 = PID + '-AYA-001';
  post({ action: 'register_product', token: u1.token, uniqueCode: c1, programId: PID, empCode: 'VH70001', empName: 'NV1' });
  post({ action: 'pm_allow_payment', token: pm.token, programId: PID });
  post({ action: 'payment', token: u1.token, slotId: c1, empCode: 'VH70001', payerName: 'NV1', bankTxn: 'FT1', payTime: '06/10/2026 15:00:00' });
  const b = post({ action: 'pm_batch_approve_payment', token: pm.token, programId: PID, regIds: [c1] });
  const row = regRows(book)[0];
  check(b.ok === true && typeof row[19] === 'string' && row[19].length > 1 && row[19][0] === "'", 'PM duyệt hàng loạt → Ngày PM duyệt dạng chữ');
}

console.log('--- Serial Number (06/10/2026): cột M Products, lấy theo Mã Slot, sheet cũ 12 cột vẫn chạy ---');
{
  const book = freshBook(); const { post, get } = load(book);
  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  const old = post({ action: 'products', programId: PID });
  check(old.ok && old.products.length === 3 && old.products.every(p => p.serial === ''), 'sheet cũ 12 cột: danh mục vẫn đọc được, serial rỗng (web ẩn đi)');
  const prod = book.getSheetByName('Products'); prod.maxCols = 12;
  const up = post({ action: 'product_upload', token: pm.token, programId: PID, items: [
    { kho: 'AYB', category: 'TV', model: 'OLED65G3PSA', description: 'x', rrp: 1, internalPrice: 1, serial: '0123123178943' },
    { kho: 'AYB', category: 'TV', model: 'OLED65G3PSA', description: 'y', rrp: 1, internalPrice: 1 }] });
  check(up.ok && prod.insertedCols === 1 && prod.rows[0][12] === 'Serial', 'nạp SP vào sheet 12 cột → tự thêm cột M "Serial"');
  const r1 = prod.rows.find(r => r[1] === PID + '-AYB-001'), r2 = prod.rows.find(r => r[1] === PID + '-AYB-002');
  check(r1[12] === "'0123123178943" && r2[12] === '', 'serial ghi dạng chữ (giữ số 0 đầu); dòng không có serial để trống');
  check(r1.length === 13 && r1[9] === 'Available' && r1[7] === 1, '12 cột cũ giữ nguyên vị trí (Trạng thái cột J, Giá cột H)');
  const list = post({ action: 'products', programId: PID }).products;
  const sn = c => String((list.find(p => p.uniqueCode === c) || {}).serial || '').replace(/^'/, '');
  check(sn(PID + '-AYB-001') === '0123123178943' && sn(PID + '-AYA-001') === '', 'danh mục trả serial đúng từng slot (2 máy cùng model, khác serial)');
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  state.mails.length = 0;
  const reg = post({ action: 'register_product', token: u1.token, uniqueCode: PID + '-AYB-001', programId: PID, empCode: 'VH70001', empName: 'NV1' });
  check(reg.ok === true, 'đăng ký slot có serial → OK (luồng đăng ký không đổi)');
  const mail = state.mails.find(m => /giữ chỗ/.test(m.subject || '')) || {};
  check(/S\/N '?0123123178943/.test(mail.htmlBody || ''), 'email xác nhận giữ chỗ có S/N cạnh Model');
  const dash = post({ action: 'pm_dashboard', token: pm.token, programId: PID });
  const dr = (dash.registrations || []).find(r => r.slotId === PID + '-AYB-001') || {};
  check(/^'?0123123178943$/.test(dr.serial || ''), 'Dashboard PM (file giao hàng) có serial theo Mã Slot');
  const lk = post({ action: 'lookup', token: u1.token, empCode: 'VH70001' });
  check(/^'?0123123178943$/.test(((lk.orders || [])[0] || {}).serial || ''), 'Tra cứu đơn (Tab 3, ô 03) có serial');
  check(get({ action: 'taken', programId: PID }).taken.includes(PID + '-AYB-001'), 'polling slot đã giữ vẫn đúng');
}

console.log('--- Serial trong Registrations (cột W) + Slots: bên giao hàng mở sheet là thấy serial ---');
{
  const book = freshBook(); const { post, ctx } = load(book);
  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  const u2 = post({ action: 'auth', id: 'VH70002', password: 'pw2' });
  post({ action: 'product_upload', token: pm.token, programId: PID, items: [
    { kho: 'AYB', category: 'TV', model: 'OLED65G3PSA', description: 'x', rrp: 1, internalPrice: 1, serial: '0123123178943' }] });
  const reg = book.getSheetByName('Registrations');
  check(post({ action: 'register_product', token: u1.token, uniqueCode: PID + '-AYB-001', programId: PID, empCode: 'VH70001', empName: 'NV1' }).ok, 'đăng ký slot có serial → OK');
  const r1 = reg.rows[reg.rows.length - 1];
  check(r1.length === 23 && r1[22] === "'0123123178943" && r1[6] === 'OLED65G3PSA' && r1[11] === 'Đã đăng ký - Chờ mở thanh toán',
        'Registrations cột W = serial (dạng chữ); Model cột G, Trạng thái cột L không đổi');
  check(post({ action: 'register_product', token: u2.token, uniqueCode: PID + '-AYA-001', programId: PID, empCode: 'VH70002', empName: 'NV2' }).ok, 'đăng ký slot CHƯA có serial → vẫn OK');
  const r2 = reg.rows[reg.rows.length - 1];
  check(r2[22] === '', 'slot chưa có serial → cột W trống (không bịa)');
  const dash = post({ action: 'pm_dashboard', token: pm.token, programId: PID });
  check(((dash.registrations || []).find(r => r.slotId === PID + '-AYB-001') || {}).serial === "'0123123178943", 'Dashboard PM đọc serial từ cột W');
  const prod = book.getSheetByName('Products');
  const pr = prod.rows.find(r => r[1] === PID + '-AYA-001'); while (pr.length < 13) pr.push(''); pr[12] = "'5550001112223";
  reg.rows[reg.rows.length - 1 - 0][22] = '';
  r1[22] = "'GIU-NGUYEN";
  const sync = ctx.syncSerialsToRegistrations();
  check(sync.ok && sync.filled === 1 && r2[22] === "'5550001112223" && r1[22] === "'GIU-NGUYEN", 'syncSerialsToRegistrations: điền ô trống theo Mã Slot, KHÔNG ghi đè ô đã có');
}
{
  const book = freshBook(); const { post } = load(book);
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  book.getSheetByName('Registrations').maxCols = 22;
  check(post({ action: 'register_product', token: u1.token, uniqueCode: PID + '-AYA-001', programId: PID, empCode: 'VH70001', empName: 'NV1' }).ok
        && regRows(book)[0].length === 22, 'Registrations chỉ có 22 cột → đăng ký vẫn thành công (không ghi serial, không lỗi)');
}

console.log('--- Biên lai chia thư mục theo chương trình (06/10/2026) ---');
{
  const book = freshBook(); const { post, ctx, props } = load(book);
  const D = state.drive; props.RECEIPT_FOLDER_ID = D.root.getId();
  const subOf = id => Object.values(D.folders).filter(f => f.parentId === id);
  const filesIn = id => Object.values(D.files).filter(f => f.parentId === id);
  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  const u2 = post({ action: 'auth', id: 'VH70002', password: 'pw2' });
  const c1 = PID + '-AYA-001', c2 = PID + '-AYA-002', IMG = 'data:image/png;base64,iVBORw0KGgo=';
  post({ action: 'register_product', token: u1.token, uniqueCode: c1, programId: PID, empCode: 'VH70001', empName: 'NV1' });
  post({ action: 'register_product', token: u2.token, uniqueCode: c2, programId: PID, empCode: 'VH70002', empName: 'NV2' });
  post({ action: 'pm_allow_payment', token: pm.token, programId: PID });
  const p1 = post({ action: 'payment', token: u1.token, slotId: c1, empCode: 'VH70001', payerName: 'NV1', bankTxn: 'FT1', fileBase64: IMG, fileName: 'a.png' });
  const sub = subOf(D.root.getId());
  check(p1.ok && p1.receipt && sub.length === 1 && sub[0].name === PID + ' - Dot test', `nộp tiền lần đầu → tạo thư mục "${PID} - Dot test" trong "Bien lai nop tien" (${sub.map(f => f.name)})`);
  check(filesIn(sub[0].id).length === 1 && filesIn(D.root.getId()).length === 0, 'biên lai nằm trong thư mục chương trình, không nằm ở thư mục gốc');
  const row1 = regRows(book).find(r => r[7] === c1);
  check(/drive\.google\.com\/file\/d\/FILE/.test(row1[17]), 'cột Receipt Link vẫn là link Drive của file (web mở được như cũ)');
  sub[0].name = PID + ' - doi ten bang tay'; props['RECEIPT_FOLDER_' + PID] = undefined; delete props['RECEIPT_FOLDER_' + PID]; ctx.CacheService.getScriptCache().remove('RECEIPT_FOLDER_' + PID);
  const p2 = post({ action: 'payment', token: u2.token, slotId: c2, empCode: 'VH70002', payerName: 'NV2', bankTxn: 'FT2', fileBase64: IMG, fileName: 'b.jpg' });
  check(p2.ok && subOf(D.root.getId()).length === 1 && filesIn(sub[0].id).length === 2, 'đơn thứ 2 cùng chương trình → dùng lại đúng thư mục (kể cả khi thư mục bị đổi tên, tìm theo Mã chương trình)');
  const loose = D.root.createFile({ getName: () => 'BL_cu.png' }); const stray = D.root.createFile({ getName: () => 'khong_khop.png' });
  book.getSheetByName('Registrations').rows[1][17] = loose.getUrl();
  const org = ctx.organizeReceiptsByProgram();
  check(org.moved === 1 && D.files[loose.getId()].parentId === sub[0].id && D.files[stray.getId()].parentId === D.root.getId(),
        'organizeReceiptsByProgram: chuyển file cũ theo Receipt Link của đơn; file không khớp đơn nào giữ nguyên');
  check(loose.getUrl() === book.getSheetByName('Registrations').rows[1][17], 'chuyển thư mục KHÔNG đổi link file');
  const orphan = ctx.saveReceipt_(IMG, 'x.png', 'X-1', 'VH70001', '');
  check(D.files[/FILE\w+/.exec(orphan)[0]].parentId === D.root.getId(), 'không xác định được chương trình → lưu ở thư mục gốc như cũ');
  check(!state.unlockedWrites.some(w => /payment/.test(w)), 'không phát sinh lệnh ghi Registrations ngoài khóa');
}

console.log('--- B4 / C1: Từ chối, mở cổng, watchdog ---');
{
  const book = freshBook(); const { post, ctx } = load(book);
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  const u2 = post({ action: 'auth', id: 'VH70002', password: 'pw2' });
  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  const other = post({ action: 'auth', id: 'VH80000', password: 'pw3' });
  const c1 = PID + '-AYA-001', c3 = PID + '-AYA-003';
  post({ action: 'register_product', token: u1.token, uniqueCode: c1, programId: PID, empCode: 'VH70001', empName: 'NV1' });
  check(post({ action: 'pm_reject_payment', token: other.token, regId: 'REG-1' }).ok === false, 'PM khác chương trình không từ chối được');
  check(post({ action: 'pm_reject_payment', token: pm.token, slotId: 'KHONG-TON-TAI' }).ok === false, 'từ chối mã không khớp đơn nào → báo lỗi, không mở slot nào');
  check(post({ action: 'pm_reject_payment', token: pm.token, regId: 'REG-1', reason: 'test' }).ok === true, 'PM chủ chương trình từ chối được');
  check(prodStatus(book, c1) === 'Available', 'slot của đơn bị từ chối trả về kho');
  post({ action: 'register_product', token: u2.token, uniqueCode: c1, programId: PID, empCode: 'VH70002', empName: 'NV2' });
  post({ action: 'pm_reject_payment', token: pm.token, regId: 'REG-1', reason: 'bấm lại đơn cũ' });
  check(prodStatus(book, c1) === 'Registered', 'từ chối lại ĐƠN CŨ không mở nhầm slot đang thuộc người khác (V1-11)');

  post({ action: 'register_product', token: u1.token, uniqueCode: c3, programId: PID, empCode: 'VH70001', empName: 'NV1' });
  const gate = post({ action: 'pm_allow_payment', token: pm.token, programId: PID });
  check(gate.ok && gate.count === 2, `mở cổng chuyển 2 đơn sang "Chờ nộp tiền" (${gate.count})`);
  const rows = regRows(book);
  const old = new Date(Date.now() - 25 * 3600e3).toISOString();
  rows.forEach(r => { if (r[11] === 'Chờ nộp tiền') r[20] = 'GATE_OPEN:' + old; });
  const paid = rows.find(r => r[7] === c3); paid[11] = 'Đã khai nộp - chờ đối soát'; paid[15] = 'FT1';
  const mailsBefore = state.mails.length;
  const wd = ctx.runExpirationWatchdog();
  check(wd.releasedCount === 1, `watchdog chỉ giải phóng đơn quá 24h chưa nộp (${wd.releasedCount})`);
  check(prodStatus(book, c3) === 'Registered', 'đơn đã khai nộp KHÔNG bị watchdog hủy');
  check(prodStatus(book, c1) === 'Available', 'slot của đơn hết hạn trả về kho');
  const wdMails = state.mails.slice(mailsBefore);
  check(state.lockHeld === false, 'khóa đã nhả sau watchdog');
  check(wdMails.length >= 1 && wdMails.every(m => !m.duringLock), `email hết hạn được gửi SAU khi nhả khóa (${wdMails.length} email)`);
  check(state.mails.every(m => !m.duringLock), 'không email nào gửi trong lúc giữ khóa (toàn bộ test)');
}

console.log('--- K2: Công tắc email (chỉ ADMIN) ---');
{
  const book = freshBook(); const { post, cache } = load(book);
  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  const adm = post({ action: 'auth', id: 'VH77777', password: 'pwA' });
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  check(post({ action: 'email_setting', token: u1.token, enabled: false }).ok === false, 'nhân viên không đổi được công tắc email');
  check(post({ action: 'email_setting', token: pm.token, enabled: false }).ok === false, 'PM KHÔNG đổi được công tắc email (chỉ ADMIN)');
  check(post({ action: 'email_setting', token: pm.token }).ok === false, 'PM cũng không đọc được cài đặt email');
  const r0 = post({ action: 'email_setting', token: adm.token });
  check(r0.ok && r0.enabled === true && r0.remainingDailyQuota === 100, 'ADMIN đọc trạng thái + hạn mức email còn lại');
  post({ action: 'auth', id: 'VH70001', password: 'pw1' }); // làm ấm cache cfg
  const off = post({ action: 'email_setting', token: adm.token, enabled: false });
  check(off.ok && off.enabled === false && !cache.has('cfg'), 'ADMIN TẮT email → ghi Config, xóa cache để có hiệu lực ngay');
  const mailsBefore = state.mails.length;
  post({ action: 'register_product', token: u1.token, uniqueCode: PID + '-AYA-002', programId: PID, empCode: 'VH70001', empName: 'NV1' });
  check(state.mails.length === mailsBefore, 'khi TẮT: đăng ký không gửi email thật');
  const ae = book.getSheetByName('AutoEmail').rows;
  check(/SIMULATED/.test(ae[ae.length - 1][3]), 'khi TẮT: vẫn ghi nhật ký AutoEmail [SIMULATED]');
  check(post({ action: 'email_setting', token: adm.token, enabled: true }).enabled === true, 'ADMIN BẬT lại được');
  check(book.getSheetByName('ActivityLog').rows.some(r => r[1] === 'EMAIL_SETTING'), 'mọi lần đổi công tắc ghi ActivityLog');
}

console.log('--- ADMIN: toàn quyền PM trên mọi chương trình, PM thường vẫn bị giới hạn ---');
{
  const book = freshBook(); const { post } = load(book);
  const adm = post({ action: 'auth', id: 'VH77777', password: 'pwA' });
  const other = post({ action: 'auth', id: 'VH80000', password: 'pw3' });
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  check(adm.ok && adm.user.role === 'ADMIN', 'đăng nhập trả role ADMIN từ sheet Users');
  check(post({ action: 'pm_dashboard', token: adm.token, programId: PID }).ok === true, 'ADMIN xem Dashboard chương trình của PM khác');
  check(post({ action: 'pm_dashboard', token: other.token, programId: PID }).ok === false, 'PM khác vẫn KHÔNG xem được (cô lập đa PM giữ nguyên)');
  post({ action: 'register_product', token: u1.token, uniqueCode: PID + '-AYA-001', programId: PID, empCode: 'VH70001', empName: 'NV1' });
  const g = post({ action: 'pm_allow_payment', token: adm.token, programId: PID });
  check(g.ok && g.count === 1, 'ADMIN mở cổng thanh toán chương trình của PM khác');
  check(post({ action: 'pm_allow_payment', token: other.token, programId: PID }).count === 0, 'PM khác không mở cổng được (0 đơn)');
  const list = post({ action: 'programs', role: 'ADMIN', userId: 'VH77777' });
  check(list.ok && list.programs.length === 2, `ADMIN thấy mọi chương trình kể cả Draft (${list.programs.length})`);
  const pmList = post({ action: 'programs', role: 'PM', userId: 'VH80000' });
  check(pmList.programs.length === 1 && pmList.programs[0].id === 'IS-DRAFT-01', 'PM thường chỉ thấy chương trình của mình');
  const upd = post({ action: 'program_update', token: adm.token, programId: 'IS-DRAFT-01', newStatus: 'Open' });
  check(upd.ok === true, 'ADMIN đổi trạng thái chương trình của PM khác');
  check(post({ action: 'pm_dashboard', token: u1.token }).ok === false, 'nhân viên vẫn không vào API PM');
}

console.log('--- V1-16: Dashboard PM không kèm mã chương trình chỉ trả đơn của PM đó ---');
{
  const book = freshBook(); const { post } = load(book);
  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  const other = post({ action: 'auth', id: 'VH80000', password: 'pw3' });
  const adm = post({ action: 'auth', id: 'VH77777', password: 'pwA' });
  const u1 = post({ action: 'auth', id: 'VH70001', password: 'pw1' });
  post({ action: 'register_product', token: u1.token, uniqueCode: PID + '-AYA-001', programId: PID, empCode: 'VH70001', empName: 'NV1' });
  const foreign = new Array(22).fill(''); foreign[0] = new Date(); foreign[1] = 'IS-DRAFT-01'; foreign[3] = 'VH70002'; foreign[7] = 'X-1'; foreign[11] = 'Chờ nộp tiền';
  book.getSheetByName('Registrations').rows.push(foreign);
  const progs = r => (r.registrations || []).map(x => x.programId);
  const mine = post({ action: 'pm_dashboard', token: pm.token });
  check(mine.ok && progs(mine).length === 1 && progs(mine).every(id => id === PID), `PM không chọn chương trình → chỉ đơn của mình (${progs(mine).join(',')})`);
  const theirs = post({ action: 'pm_dashboard', token: other.token, programId: '' });
  check(theirs.ok && progs(theirs).length === 1 && progs(theirs)[0] === 'IS-DRAFT-01', 'PM khác không chọn chương trình → chỉ đơn của PM đó');
  const all = post({ action: 'pm_dashboard', token: adm.token });
  check(all.ok && progs(all).length === 2, 'ADMIN không chọn chương trình → vẫn thấy mọi chương trình');
  const one = post({ action: 'pm_dashboard', token: pm.token, programId: PID });
  check(one.ok && progs(one).length === 1, 'PM chọn chương trình của mình → không đổi (hồi quy)');
}

console.log('--- C3 / C4 / C5: Cài đặt an toàn & cache ---');
{
  const book = freshBook(); const { ctx, post, cache } = load(book);
  const usersBefore = JSON.stringify(book.getSheetByName('Users').rows);
  const res = ctx.setupNewDatabase();
  check(res.ok === false && JSON.stringify(book.getSheetByName('Users').rows) === usersBefore, 'setupNewDatabase() từ chối chạy đè Sheet có dữ liệu, dữ liệu còn nguyên');
  post({ action: 'programs', role: 'USER' });
  check(cache.has('prog_USER_all'), 'danh sách chương trình được cache');
  const pm = post({ action: 'auth', id: 'VH12345', password: 'test123' });
  post({ action: 'program_update', token: pm.token, programId: PID, newStatus: 'Closed' });
  check(!cache.has('prog_USER_all'), 'kết sổ chương trình xóa đúng cache → nhân viên thấy ngay (V1-13)');
  const src = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
  check(/\['ENABLE_AUTO_EMAIL', 'false'/.test(src), 'CSDL mới tạo: email tự động mặc định TẮT (khớp tài liệu)');
}

console.log('--- V1-10: Mọi lệnh ghi Registrations / Products của luồng nghiệp vụ nằm trong khóa ---');
{
  const allowed = /program_delete|product_upload|setup/; // ngoài phạm vi đợt này (thêm dòng mới / xóa chương trình 0 đơn)
  const bad = state.unlockedWrites.filter(w => !allowed.test(w));
  check(bad.length === 0, `không có lệnh ghi ngoài khóa${bad.length ? ': ' + bad.slice(0, 5).join(' ; ') : ''}`);
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
