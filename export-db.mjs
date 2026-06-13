import mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';
import { createWriteStream } from 'fs';
import { writeFile } from 'fs/promises';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(dbUrl);

const [rows] = await conn.execute(`
  SELECT 
    e.expenseNo AS expense_no,
    u.name AS user_name,
    c.companyName AS company_name,
    CASE e.expenseType 
      WHEN 'normal_expense' THEN 'ค่าใช้จ่ายทั่วไป'
      WHEN 'iou_advance' THEN 'เงินทดรองจ่าย'
      ELSE e.expenseType
    END AS expense_type,
    e.itemName AS item_name,
    e.expenseDate AS expense_date,
    cat.categoryName AS category_name,
    e.description,
    e.amount,
    e.foreignCurrency AS foreign_currency,
    e.foreignAmount AS foreign_amount,
    pm.methodName AS payment_method,
    e.vendorName AS vendor_name,
    e.iouNumber AS iou_number,
    e.iouDate AS iou_date,
    e.iouAmount AS iou_amount,
    e.iouNote AS iou_note,
    CASE e.status
      WHEN 'draft' THEN 'ร่าง'
      WHEN 'claimed' THEN 'ทำเบิกแล้ว'
      WHEN 'reimbursed' THEN 'ได้เงินแล้ว'
      ELSE e.status
    END AS status,
    e.claimDate AS claim_date,
    e.reimbursedDate AS reimbursed_date,
    e.reimbursedAmount AS reimbursed_amount,
    e.note,
    e.createdAt AS created_at,
    e.updatedAt AS updated_at
  FROM expenses e
  LEFT JOIN users u ON e.userId = u.id
  LEFT JOIN companies c ON e.companyId = c.id
  LEFT JOIN expense_categories cat ON e.categoryId = cat.id
  LEFT JOIN payment_methods pm ON e.paymentMethodId = pm.id
  ORDER BY e.createdAt DESC
`);

await conn.end();

console.log(`Found ${rows.length} expense records`);

// ---- Excel ----
const workbook = new ExcelJS.Workbook();
workbook.creator = 'Expense Tracker';
workbook.created = new Date();

const sheet = workbook.addWorksheet('รายการค่าใช้จ่าย', {
  views: [{ state: 'frozen', ySplit: 1 }],
});

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

sheet.columns = [
  { header: 'เลขที่ค่าใช้จ่าย', key: 'expense_no', width: 18 },
  { header: 'ผู้บันทึก', key: 'user_name', width: 20 },
  { header: 'บริษัท', key: 'company_name', width: 20 },
  { header: 'ประเภท', key: 'expense_type', width: 18 },
  { header: 'รายการ', key: 'item_name', width: 30 },
  { header: 'วันที่', key: 'expense_date', width: 14 },
  { header: 'หมวดหมู่', key: 'category_name', width: 18 },
  { header: 'รายละเอียด', key: 'description', width: 30 },
  { header: 'จำนวนเงิน (THB)', key: 'amount', width: 16 },
  { header: 'สกุลเงินต่างประเทศ', key: 'foreign_currency', width: 18 },
  { header: 'จำนวนเงินต่างประเทศ', key: 'foreign_amount', width: 20 },
  { header: 'วิธีชำระ', key: 'payment_method', width: 16 },
  { header: 'ผู้รับเงิน', key: 'vendor_name', width: 20 },
  { header: 'เลข IOU', key: 'iou_number', width: 16 },
  { header: 'วันที่ IOU', key: 'iou_date', width: 14 },
  { header: 'จำนวนเงิน IOU', key: 'iou_amount', width: 14 },
  { header: 'หมายเหตุ IOU', key: 'iou_note', width: 24 },
  { header: 'สถานะ', key: 'status', width: 14 },
  { header: 'วันที่เบิก', key: 'claim_date', width: 14 },
  { header: 'วันที่ได้รับเงิน', key: 'reimbursed_date', width: 16 },
  { header: 'จำนวนเงินที่ได้รับ', key: 'reimbursed_amount', width: 18 },
  { header: 'หมายเหตุ', key: 'note', width: 24 },
  { header: 'วันที่สร้าง', key: 'created_at', width: 18 },
  { header: 'วันที่แก้ไข', key: 'updated_at', width: 18 },
];

// Style header
const headerRow = sheet.getRow(1);
headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
headerRow.height = 30;

rows.forEach((r, idx) => {
  const row = sheet.addRow({
    expense_no: r.expense_no,
    user_name: r.user_name ?? '',
    company_name: r.company_name ?? '',
    expense_type: r.expense_type,
    item_name: r.item_name,
    expense_date: fmtDate(r.expense_date),
    category_name: r.category_name ?? '',
    description: r.description ?? '',
    amount: r.amount ? Number(r.amount) : '',
    foreign_currency: r.foreign_currency ?? '',
    foreign_amount: r.foreign_amount ? Number(r.foreign_amount) : '',
    payment_method: r.payment_method ?? '',
    vendor_name: r.vendor_name ?? '',
    iou_number: r.iou_number ?? '',
    iou_date: fmtDate(r.iou_date),
    iou_amount: r.iou_amount ? Number(r.iou_amount) : '',
    iou_note: r.iou_note ?? '',
    status: r.status,
    claim_date: fmtDate(r.claim_date),
    reimbursed_date: fmtDate(r.reimbursed_date),
    reimbursed_amount: r.reimbursed_amount ? Number(r.reimbursed_amount) : '',
    note: r.note ?? '',
    created_at: fmtDate(r.created_at),
    updated_at: fmtDate(r.updated_at),
  });

  if (idx % 2 === 0) {
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FF' } };
  }
  row.getCell('amount').numFmt = '#,##0.00';
  row.getCell('foreign_amount').numFmt = '#,##0.00';
  row.getCell('iou_amount').numFmt = '#,##0.00';
  row.getCell('reimbursed_amount').numFmt = '#,##0.00';
  row.alignment = { vertical: 'middle' };
});

sheet.autoFilter = {
  from: { row: 1, column: 1 },
  to: { row: 1, column: sheet.columns.length },
};

const today = new Date().toISOString().slice(0, 10);
const xlsxPath = `/home/ubuntu/expenses_export_${today}.xlsx`;
await workbook.xlsx.writeFile(xlsxPath);
console.log(`Excel saved: ${xlsxPath}`);

// ---- CSV with BOM ----
const escape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const headers = sheet.columns.map(c => c.header);
const csvLines = [headers.map(escape).join(',')];
rows.forEach(r => {
  csvLines.push([
    r.expense_no, r.user_name ?? '', r.company_name ?? '', r.expense_type,
    r.item_name, fmtDate(r.expense_date), r.category_name ?? '', r.description ?? '',
    r.amount ?? '', r.foreign_currency ?? '', r.foreign_amount ?? '',
    r.payment_method ?? '', r.vendor_name ?? '', r.iou_number ?? '',
    fmtDate(r.iou_date), r.iou_amount ?? '', r.iou_note ?? '', r.status,
    fmtDate(r.claim_date), fmtDate(r.reimbursed_date), r.reimbursed_amount ?? '',
    r.note ?? '', fmtDate(r.created_at), fmtDate(r.updated_at),
  ].map(escape).join(','));
});

const csvPath = `/home/ubuntu/expenses_export_${today}.csv`;
await writeFile(csvPath, '\uFEFF' + csvLines.join('\n'), 'utf-8');
console.log(`CSV saved: ${csvPath}`);
