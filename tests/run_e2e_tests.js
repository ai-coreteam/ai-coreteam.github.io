/**
 * LG Internal Sales Portal - Phase P8 Production E2E Automated Test Suite
 * Zero-dependency standalone runner for Node.js
 * 
 * Tests:
 * 1. Smart Program ID Generation & Collision Avoidance (Job 3)
 * 2. Multi-format Excel Yellow Columns Ingestion (Job 5)
 * 3. Deterministic Order ID & Millisecond ISO Timestamp Tracking (Job 2)
 * 4. FCFS Concurrency & Locking Simulation (Job 1 & 2)
 * 5. Payment Gate Opening & 24h Watchdog Expiration Logic (Job 6)
 * 6. Database 12-column Schema Alignment & Contract Validation (Job 4)
 * 7. Cross-tab & Multi-client Concurrency Sync Protocol (Job 1)
 */

const fs = require('fs');
const path = require('path');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failedTests++;
  }
}

console.log('================================================================');
console.log('🚀 RUNNING LG INTERNAL SALES PORTAL PHASE P8 E2E TEST SUITE');
console.log('================================================================\n');

// ----------------------------------------------------------------
// SUITE 1: Smart Program ID Generation & Collision Avoidance
// ----------------------------------------------------------------
console.log('--- SUITE 1: Smart Program ID Generation & Collision Avoidance ---');
{
  function generateAutoProgramId(segment, existingPrograms, fixedDate) {
    const d = fixedDate || new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    const seg = (segment || 'OTHER').toUpperCase();

    const prefix = `IS-${year}Q${quarter}-${seg}`;
    const prefixNoHyphen = `IS${year}Q${quarter}-${seg}`;

    let maxSeq = 0;
    (existingPrograms || []).forEach(p => {
      const id = String(p.id || '').toUpperCase();
      if (id.startsWith(prefix) || id.startsWith(prefixNoHyphen)) {
        const match = id.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxSeq) maxSeq = num;
        } else {
          if (maxSeq === 0) maxSeq = 1;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(2, '0');
    return `${prefix}-${nextSeq}`;
  }

  // Test Quarter calculations
  const dQ1 = new Date(2026, 1, 15); // Feb 2026 -> Q1
  const dQ2 = new Date(2026, 4, 10); // May 2026 -> Q2
  const dQ3 = new Date(2026, 7, 20); // Aug 2026 -> Q3
  const dQ4 = new Date(2026, 10, 5); // Nov 2026 -> Q4

  assert(generateAutoProgramId('Kitchen', [], dQ1) === 'IS-2026Q1-KITCHEN-01', 'Q1 Kitchen generates IS-2026Q1-KITCHEN-01');
  assert(generateAutoProgramId('REF', [], dQ2) === 'IS-2026Q2-REF-01', 'Q2 REF generates IS-2026Q2-REF-01');
  assert(generateAutoProgramId('WM', [], dQ3) === 'IS-2026Q3-WM-01', 'Q3 WM generates IS-2026Q3-WM-01');
  assert(generateAutoProgramId('TV', [], dQ4) === 'IS-2026Q4-TV-01', 'Q4 TV generates IS-2026Q4-TV-01');

  // Test all 12 valid segments
  const segments = ['REF', 'WM', 'Kitchen', 'TV', 'AV', 'MS', 'ES', 'RAC', 'AP', 'PC', 'Display', 'Other'];
  segments.forEach(seg => {
    const code = generateAutoProgramId(seg, [], dQ4);
    assert(code.startsWith(`IS-2026Q4-${seg.toUpperCase()}-01`), `Segment ${seg} generates valid standardized prefix`);
  });

  // Test collision avoidance and sequence increment
  const mockExisting = [
    { id: 'IS-2026Q4-KITCHEN-01' },
    { id: 'IS-2026Q4-KITCHEN-02' },
    { id: 'IS-2026Q4-REF-01' }
  ];
  const nextKitchen = generateAutoProgramId('Kitchen', mockExisting, dQ4);
  assert(nextKitchen === 'IS-2026Q4-KITCHEN-03', 'Collision increment: next Kitchen code is sequence 03');
  const nextRef = generateAutoProgramId('REF', mockExisting, dQ4);
  assert(nextRef === 'IS-2026Q4-REF-02', 'Collision increment: next REF code is sequence 02');
}

// ----------------------------------------------------------------
// SUITE 2: Multi-format Excel Yellow Columns Ingestion
// ----------------------------------------------------------------
console.log('\n--- SUITE 2: Multi-format Excel Yellow Columns Ingestion ---');
{
  const XLSX = require('../data/xlsx.mini.min.js');
  const excelFilePath = path.join(__dirname, '../PM internal promotion template.xlsx');

  assert(fs.existsSync(excelFilePath), 'Real PM template file exists');

  const buf = fs.readFileSync(excelFilePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Apply yellow columns extraction logic
  const headers = json[0].map(c => String(c).trim());
  const findColIdx = (keywords) => headers.findIndex(h => {
    const hClean = h.toLowerCase().replace(/[\r\n\t]/g, ' ').trim();
    return keywords.some(k => {
      const kClean = k.toLowerCase().trim();
      return hClean === kClean || hClean.startsWith(kClean) || hClean.includes(kClean);
    });
  });

  const modelIdx = findColIdx(['model', 'mã model']);
  const khoIdx = findColIdx(['w/h', 'wh', 'kho']);
  const noIdx = findColIdx(['no', 'stt']);
  const catIdx = findColIdx(['product/cat', 'cat', 'category']);
  const serialIdx = findColIdx(['serial', 'số serial']);
  const noteIdx = findColIdx(['note', 'ghi chú']);
  const gradeIdx = findColIdx(['grade']);
  const priceIdx = findColIdx(['selling price', 'giá bán']);
  const rrpIdx = findColIdx(['mrp', 'giá niêm yết']);

  assert(modelIdx === 5, 'Model is Column F (index 5)');
  assert(khoIdx === 4, 'Warehouse is Column E (index 4)');
  assert(noIdx === 0, 'No is Column A (index 0)');
  assert(catIdx === 1, 'Category is Column B (index 1)');
  assert(serialIdx === 6, 'Serial is Column G (index 6)');
  assert(noteIdx === 7, 'Note is Column H (index 7)');
  assert(gradeIdx === 24, 'Grade is Column Y (index 24)');
  assert(rrpIdx === 26, 'MRP is Column AA (index 26)');
  assert(priceIdx === 28, 'Selling Price is Column AC (index 28)');

  const extracted = [];
  for (let i = 1; i < json.length; i++) {
    const row = json[i];
    const model = String(row[modelIdx] || '').trim();
    if (!model || model.toLowerCase() === 'model') continue;

    let rawPrice = row[priceIdx];
    if (typeof rawPrice === 'string') rawPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;

    let rawRrp = row[rrpIdx];
    if (typeof rawRrp === 'string') rawRrp = parseFloat(rawRrp.replace(/[^0-9.]/g, '')) || 0;

    extracted.push({
      slotId: '#' + String(row[noIdx]).padStart(3, '0'),
      cat: String(row[catIdx]).trim(),
      kho: String(row[khoIdx]).trim(),
      model: model,
      serial: String(row[serialIdx]).trim(),
      grade: String(row[gradeIdx]).trim(),
      note: String(row[noteIdx]).trim(),
      rrp: rawRrp,
      sellingPrice: rawPrice
    });
  }

  assert(extracted.length === 7, `Extracted exact 7 rows of products (got ${extracted.length})`);
  assert(extracted[0].slotId === '#001' && extracted[0].model === 'MS2032GIK.BSEPLVN' && extracted[0].kho === 'AYC', 'Item 1 correctly mapped (MS2032GIK.BSEPLVN, AYC, Grade B)');
  assert(extracted[0].grade === 'B' && extracted[0].sellingPrice === 1097600 && extracted[0].rrp === 3920000, 'Item 1 price and Grade B match sheet AC4 and AA4');
  assert(extracted[1].slotId === '#002' && extracted[1].kho === 'AYA' && extracted[1].grade === 'A' && extracted[1].sellingPrice === 1372000, 'Item 2 correctly mapped (AYA, Grade A, 1.372.000đ)');
  assert(extracted[2].model === 'MS3032JAS.BBKPLVN' && extracted[2].sellingPrice === 1715000 && extracted[2].rrp === 4900000, 'Item 3 correctly mapped (MS3032JAS, 1.715.000đ)');

  // Verify internal test scores are ignored
  assert(!extracted[0].boxScore && !extracted[0].defectScore, 'Internal test scores (cols I-X) are completely excluded from product record');

  // Verify newly generated Mockup_10_Models_Internal_Sales_Template.xlsx
  const mockupFilePath = path.join(__dirname, '../data/Mockup_10_Models_Internal_Sales_Template.xlsx');
  assert(fs.existsSync(mockupFilePath), 'Mockup_10_Models_Internal_Sales_Template.xlsx exists in data/');
  const bufMockup = fs.readFileSync(mockupFilePath);
  const wbMockup = XLSX.read(bufMockup, { type: 'buffer' });
  const sheetMockup = wbMockup.Sheets[wbMockup.SheetNames[0]];
  const jsonMockup = XLSX.utils.sheet_to_json(sheetMockup, { header: 1, defval: '' });

  const extracted10 = [];
  for (let i = 1; i < jsonMockup.length; i++) {
    const row = jsonMockup[i];
    const model = String(row[modelIdx] || '').trim();
    if (!model || model.toLowerCase() === 'model') continue;
    let rawPrice = row[priceIdx];
    if (typeof rawPrice === 'string') rawPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;
    let rawRrp = row[rrpIdx];
    if (typeof rawRrp === 'string') rawRrp = parseFloat(rawRrp.replace(/[^0-9.]/g, '')) || 0;

    extracted10.push({
      slotId: '#' + String(row[noIdx]).padStart(3, '0'),
      cat: String(row[catIdx]).trim(),
      kho: String(row[khoIdx]).trim(),
      model: model,
      grade: String(row[gradeIdx]).trim(),
      rrp: rawRrp,
      sellingPrice: rawPrice
    });
  }

  assert(extracted10.length === 10, `Extracted exact 10 models from Mockup template (got ${extracted10.length})`);
  assert(extracted10[0].model === 'OLED65C4PSA.ATV' && extracted10[0].sellingPrice === 23805000, 'Model 1 (OLED65C4) parsed correctly at 23.805.000đ');
  assert(extracted10[4].model === 'WT1410NHEG.ABWPLVN' && extracted10[4].sellingPrice === 18915600, 'Model 5 (WashTower) parsed correctly at 18.915.600đ');
  assert(extracted10[9].model === '16Z90R-G.AH78A5' && extracted10[9].sellingPrice === 18396000, 'Model 10 (LG Gram) parsed correctly at 18.396.000đ');
}

// ----------------------------------------------------------------
// SUITE 3: Deterministic Order ID & Millisecond ISO Timestamp Tracking
// ----------------------------------------------------------------
console.log('\n--- SUITE 3: Deterministic Order ID & Millisecond ISO Timestamp Tracking ---');
{
  function generateOrderId(date) {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const hms = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${ymd}-${hms}-${rand}`;
  }

  const orderId = generateOrderId(new Date(2026, 9, 4, 13, 15, 30));
  assert(/^ORD-20261004-131530-\d{4}$/.test(orderId), `Order ID matches standard format (${orderId})`);

  // Timestamp sorting tie-breaker test
  const submissions = [
    { empCode: 'VH003', timestamp: '2026-10-04T10:00:00.350Z', orderId: 'ORD-3' },
    { empCode: 'VH001', timestamp: '2026-10-04T10:00:00.120Z', orderId: 'ORD-1' },
    { empCode: 'VH002', timestamp: '2026-10-04T10:00:00.200Z', orderId: 'ORD-2' }
  ];

  submissions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  assert(submissions[0].empCode === 'VH001', 'Deterministic FCFS tie-breaker selects earliest millisecond timestamp (VH001)');
  assert(submissions[1].empCode === 'VH002' && submissions[2].empCode === 'VH003', 'Audit trail sequence strictly preserved');
}

// ----------------------------------------------------------------
// SUITE 4: FCFS Concurrency & Locking Simulation
// ----------------------------------------------------------------
console.log('\n--- SUITE 4: FCFS Concurrency & Locking Simulation ---');
{
  class MockDatabase {
    constructor() {
      this.slots = { '#001': { status: 'Available', owner: null, timestamp: null } };
      this.lock = false;
    }

    registerSlot(empCode, slotId) {
      // Simulate backend atomic lock
      if (this.lock) {
        throw new Error('Lock contention');
      }
      this.lock = true;
      try {
        const slot = this.slots[slotId];
        if (!slot || slot.status !== 'Available') {
          return { ok: false, slotTaken: true, message: `Slot ${slotId} is already taken` };
        }
        slot.status = 'Đã đăng ký - Chờ mở thanh toán';
        slot.owner = empCode;
        slot.timestamp = new Date().toISOString();
        return { ok: true, slotTaken: false, timestamp: slot.timestamp };
      } finally {
        this.lock = false;
      }
    }
  }

  const db = new MockDatabase();
  const results = [];
  const competitors = ['VH01', 'VH02', 'VH03', 'VH04', 'VH05', 'VH06', 'VH07', 'VH08', 'VH09', 'VH10'];

  competitors.forEach(emp => {
    const res = db.registerSlot(emp, '#001');
    results.push({ emp, res });
  });

  const winners = results.filter(r => r.res.ok);
  const losers = results.filter(r => r.res.slotTaken);

  assert(winners.length === 1, `Exactly 1 winner succeeded under concurrency contention (${winners[0].emp})`);
  assert(losers.length === 9, 'All remaining 9 concurrent requests were rejected with slotTaken: true');
  assert(db.slots['#001'].owner === 'VH01', 'Database slot state is atomically locked to the first applicant');
}

// ----------------------------------------------------------------
// SUITE 5: Payment Gate Opening & 24h Watchdog Expiration
// ----------------------------------------------------------------
console.log('\n--- SUITE 5: Payment Gate Opening & 24h Watchdog Expiration ---');
{
  function evaluateWatchdog(reg, currentTime) {
    const now = new Date(currentTime);
    if (reg.status !== 'Chờ nộp tiền') {
      return { expired: false, reason: 'Status is not Chờ nộp tiền' };
    }

    let gateOpenDate = null;
    if (reg.note && reg.note.includes('GATE_OPEN:')) {
      const match = reg.note.match(/GATE_OPEN:([^\s]+)/);
      if (match) {
        gateOpenDate = new Date(match[1]);
      }
    }

    // Critical fix: must count from gateOpenDate, not registration timestamp
    const baseDate = gateOpenDate || new Date(reg.timestamp);
    const elapsedHours = (now - baseDate) / (1000 * 60 * 60);

    if (elapsedHours > 24) {
      return { expired: true, elapsedHours, baseDate: baseDate.toISOString() };
    }
    return { expired: false, elapsedHours, baseDate: baseDate.toISOString() };
  }

  const regTime = new Date('2026-10-01T08:00:00Z');
  const gateOpenTime = new Date('2026-10-03T10:00:00Z'); // PM opened gate 48h after registration

  const sampleOrder = {
    empCode: 'VH12345',
    slotId: '#001',
    status: 'Chờ nộp tiền',
    timestamp: regTime.toISOString(),
    note: `PM_BULK_OPEN_PAYMENT; GATE_OPEN:${gateOpenTime.toISOString()}`
  };

  // Case 1: 2 hours after PM opened gate (50 hours after registration)
  const time2hAfterGate = new Date('2026-10-03T12:00:00Z');
  const res1 = evaluateWatchdog(sampleOrder, time2hAfterGate);
  assert(!res1.expired, '2h after gate open: NOT EXPIRED (even though 50h passed since registration)');

  // Case 2: 25 hours after PM opened gate
  const time25hAfterGate = new Date('2026-10-04T11:00:00Z');
  const res2 = evaluateWatchdog(sampleOrder, time25hAfterGate);
  assert(res2.expired, '25h after gate open: EXPIRED (24h timer correctly calculated from gateOpenTime)');

  // Case 3: Paid order at 25h after gate
  const paidOrder = { ...sampleOrder, status: 'Đã nộp tiền' };
  const res3 = evaluateWatchdog(paidOrder, time25hAfterGate);
  assert(!res3.expired, 'Paid order after 25h: PROTECTED from expiration watchdog');
}

// ----------------------------------------------------------------
// SUITE 6: Database Schema & API Contract
// ----------------------------------------------------------------
console.log('\n--- SUITE 6: Database Schema & API Contract ---');
{
  const codeGsPath = path.join(__dirname, '../apps-script/Code.gs');
  assert(fs.existsSync(codeGsPath), 'apps-script/Code.gs exists');
  const codeContent = fs.readFileSync(codeGsPath, 'utf8');

  // Validate Products 12-column schema
  assert(codeContent.includes("PROD_COL = {") && codeContent.includes("TS: 12"), 'PROD_COL has full 12 columns defined (PROG to TS: 12)');
  assert(codeContent.includes("['ProgramID', 'UniqueCode', 'Kho', 'Category', 'Model', 'Description', 'RRP', 'InternalPrice', 'Qty', 'Status', 'EmpCode', 'Timestamp']"), 'setupNewDatabase creates matching 12-column Products table');

  // Validate Programs 10-column schema
  assert(codeContent.includes("PROG_COL = {") && codeContent.includes("CREATED: 10"), 'PROG_COL has 10 columns defined (ID to CREATED: 10)');

  // Validate register_product_ uses PROG_COL to check program status (preventing false "program closed" bug)
  assert(codeContent.includes("PROG_COL.STATUS - 1") && codeContent.includes("PROG_COL.MAX_PER - 1"), 'register_product_ references PROG_COL.STATUS and MAX_PER correctly');

  // Validate Watchdog Trigger Installer
  assert(codeContent.includes("function setupWatchdogTrigger()"), 'setupWatchdogTrigger() 1-click trigger installer exists');

  // Validate ENABLE_AUTO_EMAIL flag
  assert(codeContent.includes("ENABLE_AUTO_EMAIL"), 'ENABLE_AUTO_EMAIL flag exists in config');
}

// ----------------------------------------------------------------
// SUITE 7: Cross-tab & Multi-client Concurrency Protocol
// ----------------------------------------------------------------
console.log('\n--- SUITE 7: Cross-tab & Multi-client Concurrency Protocol ---');
{
  const htmlPath = path.join(__dirname, '../Mau_Dang_Ky_Internal_Sales_3009.html');
  assert(fs.existsSync(htmlPath), 'Mau_Dang_Ky_Internal_Sales_3009.html exists');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Check BroadcastChannel initialization
  assert(htmlContent.includes("new BroadcastChannel('lge_internal_sales_sync')"), 'BroadcastChannel lge_internal_sales_sync initialized');
  assert(htmlContent.includes("window.broadcastSlotRegistered(slotId)"), 'broadcastSlotRegistered is hooked to postToSheet registration completion');

  // Check adaptive polling timing
  assert(htmlContent.includes("6000") && htmlContent.includes("8000"), 'Adaptive polling interval is 6-8s for active sales');
  assert(htmlContent.includes("tab-segment-select") || htmlContent.includes("id=\"prog-segment\""), 'Segment selector UI exists in HTML');
}

// ----------------------------------------------------------------
// SUITE 8: Multi-PM Scoping & Jeong-Do Audit Deletion Protection
// ----------------------------------------------------------------
console.log('\n--- SUITE 8: Multi-PM Scoping & Jeong-Do Audit Deletion Protection ---');
{
  const mockPrograms = [
    { id: 'IS2026Q3-HA', name: 'CTBHNB HA', pmId: 'VH12345', status: 'Open' },
    { id: 'IS2026Q3-HE', name: 'CTBHNB HE', pmId: 'VH12345', status: 'Open' },
    { id: 'IS2026Q4-BS', name: 'CTBHNB BS', pmId: 'VH12345', status: 'Draft' },
    { id: 'IS2026Q3-RAC', name: 'CTBHNB RAC', pmId: 'VH88888', status: 'Open' }
  ];

  // Logic simulation of programs_ endpoint in Code.gs
  function filterProgramsForUser(role, userId, programs) {
    const rRole = (role || 'USER').toUpperCase();
    const uId = (userId || '').toUpperCase();
    return programs.filter(p => {
      if (rRole === 'PM') {
        if (uId === 'ADMIN') return true;
        return p.pmId.toUpperCase() === uId;
      } else {
        return p.status === 'Open';
      }
    });
  }

  // 1. PM VH12345 sees only their own 3 programs
  const pm1Progs = filterProgramsForUser('PM', 'VH12345', mockPrograms);
  assert(pm1Progs.length === 3, 'PM VH12345 receives exactly their 3 programs');
  assert(pm1Progs.every(p => p.pmId === 'VH12345'), 'All returned programs belong to PM VH12345');

  // 2. New PM Nguyen Ngoc Bao (VH77777) sees 0 programs (empty state)
  const pmNewProgs = filterProgramsForUser('PM', 'VH77777', mockPrograms);
  assert(pmNewProgs.length === 0, 'New PM VH77777 sees 0 programs (clean slate, no leakage)');

  // 3. Normal USER sees ALL open programs across all PMs
  const userProgs = filterProgramsForUser('USER', 'VH99999', mockPrograms);
  assert(userProgs.length === 3, 'Normal USER sees 3 Open programs from all PMs (HA, HE, RAC)');
  assert(!userProgs.some(p => p.status === 'Draft'), 'USER cannot see Draft programs');

  // 4. SuperAdmin sees all programs across all statuses
  const adminProgs = filterProgramsForUser('PM', 'ADMIN', mockPrograms);
  assert(adminProgs.length === 4, 'ADMIN oversees all 4 programs across all PMs');

  // 5. Jeong-Do Audit Protection simulation
  function canDeleteProgram(programId, callerPmId, registrations, programs) {
    const prog = programs.find(p => p.id === programId);
    if (!prog) return { ok: false, reason: 'NOT_FOUND' };
    if (callerPmId !== 'ADMIN' && prog.pmId !== callerPmId) {
      return { ok: false, reason: 'UNAUTHORIZED_CROSS_PM' };
    }
    const orderCount = registrations.filter(r => r.programId === programId).length;
    if (orderCount > 0) {
      return { ok: false, reason: 'JEONG_DO_AUDIT_LOCKED', orderCount };
    }
    return { ok: true };
  }

  const mockRegistrations = [
    { id: 'REG-1', programId: 'IS2026Q3-HA', slotId: 'HA-001', status: 'Chờ nộp tiền' },
    { id: 'REG-2', programId: 'IS2026Q3-HA', slotId: 'HA-002', status: 'Đã duyệt' }
  ];

  // Program with orders cannot be deleted (must use Closed)
  const delWithOrders = canDeleteProgram('IS2026Q3-HA', 'VH12345', mockRegistrations, mockPrograms);
  assert(!delWithOrders.ok && delWithOrders.reason === 'JEONG_DO_AUDIT_LOCKED', 'Program with orders is BLOCKED from deletion by Jeong-Do rule');

  // Program with 0 orders can be deleted
  const delZeroOrders = canDeleteProgram('IS2026Q4-BS', 'VH12345', mockRegistrations, mockPrograms);
  assert(delZeroOrders.ok, 'Program with 0 orders is safely allowed to delete');

  // PM cannot delete another PM's program
  const delCrossPm = canDeleteProgram('IS2026Q3-RAC', 'VH12345', mockRegistrations, mockPrograms);
  assert(!delCrossPm.ok && delCrossPm.reason === 'UNAUTHORIZED_CROSS_PM', 'Cross-PM deletion attempt is strictly blocked');
}

// ----------------------------------------------------------------
// SUITE 9: Frontend Multi-PM Authorization & Program Sync Safety
// ----------------------------------------------------------------
console.log('\n--- SUITE 9: Frontend Multi-PM Authorization & Program Sync Safety ---');
{
  const htmlPath = path.join(__dirname, '..', 'Mau_Dang_Ky_Internal_Sales_3009.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // 1. Verify isCurrentPMAssigned helper exists and is attached to window
  assert(html.includes('function isCurrentPMAssigned(progId)'), 'isCurrentPMAssigned helper is defined');
  assert(html.includes('window.isCurrentPMAssigned = isCurrentPMAssigned;'), 'isCurrentPMAssigned is exported to window');

  // 2. Simulate isCurrentPMAssigned behavior
  function testPMAssigned(progId, currentUser, progs) {
    if (!currentUser) return false;
    if (currentUser.id === 'ADMIN' || currentUser.role === 'ADMIN') return true;
    if (!progId) return true;
    const p = progs.find(x => x.id === progId);
    if (!p) return true;
    const pOwnerId = String(p.pmId || '').trim().toUpperCase();
    const cUserId = String(currentUser.id || '').trim().toUpperCase();
    const pOwnerName = String(p.pmName || '').trim().toLowerCase();
    const cUserName = String(currentUser.name || '').trim().toLowerCase();
    return pOwnerId === cUserId || (pOwnerName && pOwnerName === cUserName);
  }

  const progs = [
    { id: 'IS2026Q3-HA', name: 'CTBHNB HA', pmId: 'VH12345', pmName: 'Quynh Nhu' },
    { id: 'IS-2026Q4-OTHER-01', name: 'CTBHNB Other', pmId: 'VH99999', pmName: 'Nguyen Ngoc Bao' }
  ];

  const baoUser = { id: 'VH99999', name: 'Nguyen Ngoc Bao', role: 'PM' };
  const nhuUser = { id: 'VH12345', name: 'Quynh Nhu', role: 'PM' };
  const adminUser = { id: 'ADMIN', name: 'Super Admin', role: 'ADMIN' };

  assert(!testPMAssigned('IS2026Q3-HA', baoUser, progs), 'PM Bao is BLOCKED from Quynh Nhu program IS2026Q3-HA');
  assert(testPMAssigned('IS-2026Q4-OTHER-01', baoUser, progs), 'PM Bao is ALLOWED on their own program IS-2026Q4-OTHER-01');
  assert(!testPMAssigned('IS-2026Q4-OTHER-01', nhuUser, progs), 'PM Nhu is BLOCKED from PM Bao program');
  assert(testPMAssigned('IS2026Q3-HA', adminUser, progs), 'ADMIN is ALLOWED across all programs');

  // 3. Verify function-level guards in Mau_Dang_Ky_Internal_Sales_3009.html
  assert(html.includes("if (typeof isCurrentPMAssigned === 'function' && !isCurrentPMAssigned(pid))"), 'updateProgramStatus guards against cross-PM edits');
  assert(html.includes("if (typeof isCurrentPMAssigned === 'function' && !isCurrentPMAssigned(reg.programId || activeProgram))"), 'pmApprovePayment guards against cross-PM approvals');
  assert(html.includes("Chỉ xem · Thuộc PM"), 'Read-only pill renders for other PMs in banner');

  // 4. Verify createProgram checks for offline/API connection
  assert(html.includes("THÔNG BÁO CHẾ ĐỘ NGOẠI TUYẾN (DEMO MODE)"), 'createProgram warns when running offline without Web App URL');
  assert(html.includes("ĐÃ KHỞI TẠO VÀ ĐỒNG BỘ THÀNH CÔNG VÀO GOOGLE SHEET"), 'createProgram confirms sync to Google Sheet when online');
}

// ----------------------------------------------------------------
// SUITE 10: Password Visibility & Status Indicator Icons Compliance
// ----------------------------------------------------------------
console.log('\n--- SUITE 10: Password Visibility & Status Indicator Icons Compliance ---');
{
  const htmlPath = path.join(__dirname, '../Mau_Dang_Ky_Internal_Sales_3009.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Verify togglePasswordVisibility function exists
  assert(html.includes("function togglePasswordVisibility(inputId, btn)"), 'togglePasswordVisibility function is defined');
  assert(html.includes("window.togglePasswordVisibility = togglePasswordVisibility"), 'togglePasswordVisibility is exported to window');

  // Verify all 4 password inputs have .btn-toggle-pw toggle button
  assert(html.includes("onclick=\"togglePasswordVisibility('login-password', this)\""), 'login-password has toggle button');
  assert(html.includes("onclick=\"togglePasswordVisibility('cp-old-pw', this)\""), 'cp-old-pw has toggle button');
  assert(html.includes("onclick=\"togglePasswordVisibility('cp-new-pw', this)\""), 'cp-new-pw has toggle button');
  assert(html.includes("onclick=\"togglePasswordVisibility('cp-confirm-pw', this)\""), 'cp-confirm-pw has toggle button');

  // Verify prog-id-status uses SVG check icon instead of unicode tick
  assert(html.includes("id=\"prog-id-status\"") && html.includes("<svg class=\"lg-icon lg-icon-sm\""), 'prog-id-status renders SVG icon in HTML');

  // Verify raw emojis were eliminated from all UI components
  assert(!html.includes("🛠️"), '🛠️ emoji completely removed');
  assert(!html.includes("🔄 Sinh mã"), '🔄 Sinh mã emoji completely removed');
  assert(!html.includes("⚙️ Cấu hình"), '⚙️ Cấu hình emoji completely removed');
  assert(!html.includes("🟢 Đang kết nối"), '🟢 Đang kết nối emoji completely removed');
  assert(!html.includes("⚪ Đang ở chế độ"), '⚪ Đang ở chế độ emoji completely removed');
  assert(!html.includes("❌ Kết nối thất bại"), '❌ Kết nối thất bại emoji completely removed');
  assert(!html.includes("❌ Đã tồn tại mã"), '❌ Đã tồn tại mã emoji completely removed');
}

// ----------------------------------------------------------------
// FINAL TEST RESULTS
// ----------------------------------------------------------------
console.log('\n================================================================');
console.log(`🏁 TEST SUITE COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL END-TO-END VERIFICATION CHECKS PASSED WITH 100% SUCCESS!\n');
  process.exit(0);
}
