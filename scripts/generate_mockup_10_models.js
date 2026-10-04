/**
 * Generator script for Mockup_10_Models_Internal_Sales_Template.xlsx
 * Adheres strictly to the warehouse inspection Excel structure (matching PM internal promotion template.xlsx)
 * with the 10 yellow columns: A(No), B(CAT), E(W/H), F(Model), G(Serial), H(NOTE), Y(Grade), AA(MRP), AB(D/C), AC(Selling price).
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('../data/xlsx.mini.min.js');

const rows = [
  // Row 0: Top Header
  ['No', 'Product/CAT', 'Date', 'Checker', 'W/H', 'Model', 'Serial', 'NOTE', 'Operation', 'Box, packing', '', 'Appearance', '', 'Defect', '', 'Accessory', '', '', '', '', '', 'Using time', '', 'Total', 'Grade', 'Judge', 'MRP', 'D/C', 'Selling price', 'Remark'],
  // Row 1: Sub Header 1
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Disc', '', 'Turn table', '', 'Shelf', '', '', '', 'Score', '', '', '(+VAT)', '(%)', '(+VAT)', ''],
  // Row 2: Sub Header 2
  ['', '', '', '', '', '', '', '', '', 'Status', 'Score', 'Status', 'Score', 'Status', 'Score', 'Status', 'Score', 'Status', 'Score', 'Status', 'Score', 'Time', 'Score', '', '', '', '', '', '', ''],
  
  // Model 1: TV OLED
  [1, 'TV', '10/05/26', 'Nguyễn Thị Quỳnh Như', 'AYA', 'OLED65C4PSA.ATV', '408TAZ019284', 'Hàng trưng bày showroom, viền kim loại xước dăm cực nhẹ, đầy đủ remote Magic & phụ kiện', 'Yes', 'old', 5, 'light', 30, 'no', 20, 'yes', 10, 'yes', 5, 'yes', 5, 'not used', 10, 85, 'A', 'Resale', 52900000, 0.55, 23805000, 'Smart Tivi OLED evo 4K 65 inch C4 Gallery'],
  
  // Model 2: TV QNED
  [2, 'TV', '10/05/26', 'Văn Tiến', 'AYA', '75QNED86TSA.ATV', '409TAMK82910', 'Thùng carton ngoài rách góc, máy nguyên seal màn hình chưa kích hoạt', 'Yes', 'old', 5, 'light', 30, 'no', 20, 'yes', 10, 'yes', 5, 'yes', 5, 'not used', 10, 85, 'A', 'Resale', 38900000, 0.52, 18672000, 'Tivi QNED MiniLED 4K 75 inch 120Hz Quantum Dot'],
  
  // Model 3: Tủ lạnh InstaView
  [3, 'REF', '10/05/26', 'Nguyễn Thanh Phương', 'AYB', 'GR-X257BG.AMCPLVN', '405TABH92817', 'Cấn nhẹ cạnh hông phải 1mm do vận chuyển, mặt kính gõ 2 lần sáng đèn hoàn hảo', 'Yes', 'old', 5, 'light', 25, 'no', 20, 'yes', 10, 'yes', 5, 'yes', 5, 'over-18t', 5, 75, 'B', 'Resale', 48990000, 0.58, 20575800, 'Tủ lạnh InstaView Door-in-Door 635L Inverter'],
  
  // Model 4: Tủ lạnh 4 cánh
  [4, 'REF', '10/05/26', 'Văn Tiến', 'AYB', 'GR-B256BL.APZPLVN', '406TAKN48192', 'Hộp xốp cũ, khay kính cường lực đầy đủ nguyên bản 100%', 'Yes', 'old', 5, 'light', 30, 'no', 20, 'yes', 10, 'yes', 5, 'yes', 5, 'not used', 10, 85, 'A', 'Resale', 24500000, 0.50, 12250000, 'Tủ lạnh Side by Side Inverter 519L Multi Air Flow'],
  
  // Model 5: Máy giặt sấy WashTower
  [5, 'WM', '10/05/26', 'Nguyễn Thị Quỳnh Như', 'AYC', 'WT1410NHEG.ABWPLVN', '407TASW73910', 'Hàng mẫu nội bộ, bảng điều khiển trung tâm Center Control bóng đẹp không vết xước', 'Yes', 'old', 5, 'light', 30, 'no', 20, 'yes', 10, 'yes', 5, 'yes', 5, 'not used', 10, 85, 'A', 'Resale', 42990000, 0.56, 18915600, 'Tháp giặt sấy WashTower Giặt 14kg - Sấy 10kg'],
  
  // Model 6: Máy giặt lồng ngang AI DD
  [6, 'WM', '10/05/26', 'Văn Tiến', 'AYC', 'FV1412S3BA.ABKPLVN', '408TAZZ18293', 'Mất sách hướng dẫn in giấy, xước nhẹ nắp trên, động cơ DirectDrive bảo hành 10 năm', 'Yes', 'old', 5, 'light', 25, 'no', 20, 'yes', 10, 'yes', 5, 'yes', 5, 'not used', 5, 75, 'B', 'Resale', 17490000, 0.53, 8220300, 'Máy giặt lồng ngang AI DD Inverter 12kg TurboWash'],
  
  // Model 7: Máy rửa bát QuadWash
  [7, 'Kitchen', '10/05/26', 'Nguyễn Thanh Phương', 'AYC', 'LDT14BGA.ABMPLVN', '410TAGH93812', 'Thùng carton xấu, mặt trước đen mờ Matte Black mới 99% chưa qua sử dụng', 'Yes', 'old', 5, 'light', 30, 'no', 20, 'yes', 10, 'yes', 5, 'yes', 5, 'not used', 10, 85, 'A', 'Resale', 26900000, 0.57, 11567000, 'Máy rửa bát TrueSteam QuadWash 14 bộ sấy hé cửa'],
  
  // Model 8: Lò vi sóng nướng
  [8, 'Kitchen', '10/05/26', 'Văn Tiến', 'AYC', 'MH6535GIS.BSEPLVN', '411TAKL02938', 'Xước dăm tay nắm, đĩa xoay và vỉ nướng inox đầy đủ nguyên túi', 'Yes', 'old', 5, 'light', 20, 'no', 20, 'yes', 10, 'yes', 5, 'yes', 5, 'over-18t', 0, 65, 'B', 'Resale', 4890000, 0.65, 1711500, 'Lò vi sóng nướng Inverter 25L NeoChef Smart Inverter'],
  
  // Model 9: Điều hòa DualCool
  [9, 'RAC', '10/05/26', 'Văn Tiến', 'AYA', 'V10APIUV.ATV', '403TAPP48192', 'Dàn nóng trầy sơn vỏ ngoài nhẹ, dàn lạnh mới 100% nguyên tem năng lượng', 'Yes', 'old', 5, 'light', 25, 'no', 20, 'yes', 10, 'yes', 5, 'yes', 5, 'not used', 10, 80, 'B', 'Resale', 14290000, 0.54, 6573400, 'Điều hòa Inverter 1.0 HP UVnano lọc khí thanh lọc bụi'],
  
  // Model 10: Laptop LG Gram 16
  [10, 'PC', '10/05/26', 'Nguyễn Thị Quỳnh Như', 'AYA', '16Z90R-G.AH78A5', '404TAGM83910', 'Máy lưu kho nội bộ IT, pin sạc 1 lần test xuất xưởng, bàn phím tiếng Anh - Hàn', 'Yes', 'old', 5, 'light', 30, 'no', 20, 'yes', 10, 'yes', 5, 'yes', 5, 'not used', 10, 85, 'A', 'Resale', 45990000, 0.60, 18396000, 'Laptop siêu nhẹ LG Gram 16 inch Core i7 16GB 512GB']
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);

// Set column widths
ws['!cols'] = [
  { wch: 6 },  // A: No
  { wch: 14 }, // B: Cat
  { wch: 12 }, // C: Date
  { wch: 24 }, // D: Checker
  { wch: 8 },  // E: W/H
  { wch: 22 }, // F: Model
  { wch: 18 }, // G: Serial
  { wch: 75 }, // H: NOTE
  { wch: 10 }, // I: Operation
  { wch: 12 }, // J: Box
  { wch: 8 },  // K: Score
  { wch: 14 }, // L: Appearance
  { wch: 8 },  // M: Score
  { wch: 10 }, // N: Defect
  { wch: 8 },  // O: Score
  { wch: 12 }, // P: Disc
  { wch: 8 },  // Q: Score
  { wch: 12 }, // R: Turntable
  { wch: 8 },  // S: Score
  { wch: 10 }, // T: Shelf
  { wch: 8 },  // U: Score
  { wch: 12 }, // V: Time
  { wch: 8 },  // W: Score
  { wch: 8 },  // X: Total
  { wch: 8 },  // Y: Grade
  { wch: 10 }, // Z: Judge
  { wch: 15 }, // AA: MRP
  { wch: 10 }, // AB: D/C
  { wch: 15 }, // AC: Selling price
  { wch: 45 }  // AD: Remark
];

XLSX.utils.book_append_sheet(wb, ws, 'PM template');

const outputPath = path.join(__dirname, '../data/Mockup_10_Models_Internal_Sales_Template.xlsx');
const outBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(outputPath, outBuf);

console.log(`✅ Successfully generated ${outputPath} (${outBuf.length} bytes) with 10 models!`);
