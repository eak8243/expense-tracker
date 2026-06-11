import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import ExcelJS from "exceljs";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function escapeCsv(val: unknown): string {
  const s = val === null || val === undefined ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  normal_expense: "ค่าใช้จ่ายทั่วไป",
  iou_advance: "เงินทดรองจ่าย",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "ร่าง",
  claimed: "ทำเบิกแล้ว",
  reimbursed: "ได้เงินแล้ว",
};

export const exportRouter = router({
  csv: protectedProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        status: z.string().optional(),
        expenseType: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId =
        ctx.user.role === "admin" || ctx.user.role === "viewer" ? undefined : ctx.user.id;

      const rows = await db.getExpensesForExport({ ...input, userId });

      const headers = [
        "เลขที่ค่าใช้จ่าย",
        "ผู้บันทึก",
        "บริษัท",
        "ประเภท",
        "รายการ",
        "วันที่",
        "หมวดหมู่",
        "รายละเอียด",
        "จำนวนเงิน",
        "สกุลเงิน",
        "วิธีชำระ",
        "ผู้รับเงิน",
        "เลข IOU",
        "วันที่ IOU",
        "จำนวนเงิน IOU",
        "หมายเหตุ IOU",
        "สถานะ",
        "วันที่เบิก",
        "วันที่ได้รับเงิน",
        "จำนวนเงินที่ได้รับ",
        "หมายเหตุ",
        "มีใบเสร็จ",
        "มีเอกสาร IOU",
        "มีหลักฐานรับเงิน",
        "วันที่สร้าง",
        "วันที่แก้ไข",
      ];

      const csvRows = rows.map((r) => [
        r.expenseNo,
        r.userName,
        r.companyName,
        EXPENSE_TYPE_LABELS[r.expenseType] ?? r.expenseType,
        r.itemName,
        formatDate(r.expenseDate),
        r.categoryName ?? "",
        r.description ?? "",
        r.amount,
        r.currency,
        r.paymentMethodName ?? "",
        r.vendorName ?? "",
        r.iouNumber ?? "",
        formatDate(r.iouDate),
        r.iouAmount ?? "",
        r.iouNote ?? "",
        STATUS_LABELS[r.status] ?? r.status,
        formatDate(r.claimDate),
        formatDate(r.reimbursedDate),
        r.reimbursedAmount ?? "",
        r.note ?? "",
        r.hasExpenseProof ? "ใช่" : "ไม่",
        r.hasIouDocument ? "ใช่" : "ไม่",
        r.hasReimbursementProof ? "ใช่" : "ไม่",
        formatDate(r.createdAt),
        formatDate(r.updatedAt),
      ]);

      // BOM for Thai UTF-8
      const bom = "\uFEFF";
      const csvContent =
        bom +
        [headers, ...csvRows]
          .map((row) => row.map(escapeCsv).join(","))
          .join("\n");

      return {
        content: Buffer.from(csvContent, "utf-8").toString("base64"),
        filename: `expenses_${new Date().toISOString().slice(0, 10)}.csv`,
        mimeType: "text/csv;charset=utf-8",
      };
    }),

  excel: protectedProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        status: z.string().optional(),
        expenseType: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId =
        ctx.user.role === "admin" || ctx.user.role === "viewer" ? undefined : ctx.user.id;

      const rows = await db.getExpensesForExport({ ...input, userId });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Expense Tracker";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("รายการค่าใช้จ่าย", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      // Define columns with Thai headers
      sheet.columns = [
        { header: "เลขที่ค่าใช้จ่าย", key: "expenseNo", width: 18 },
        { header: "ผู้บันทึก", key: "userName", width: 20 },
        { header: "บริษัท", key: "companyName", width: 20 },
        { header: "ประเภท", key: "expenseType", width: 18 },
        { header: "รายการ", key: "itemName", width: 30 },
        { header: "วันที่", key: "expenseDate", width: 14 },
        { header: "หมวดหมู่", key: "categoryName", width: 18 },
        { header: "รายละเอียด", key: "description", width: 30 },
        { header: "จำนวนเงิน", key: "amount", width: 14 },
        { header: "สกุลเงิน", key: "currency", width: 10 },
        { header: "วิธีชำระ", key: "paymentMethodName", width: 16 },
        { header: "ผู้รับเงิน", key: "vendorName", width: 20 },
        { header: "เลข IOU", key: "iouNumber", width: 16 },
        { header: "วันที่ IOU", key: "iouDate", width: 14 },
        { header: "จำนวนเงิน IOU", key: "iouAmount", width: 14 },
        { header: "หมายเหตุ IOU", key: "iouNote", width: 24 },
        { header: "สถานะ", key: "status", width: 14 },
        { header: "วันที่เบิก", key: "claimDate", width: 14 },
        { header: "วันที่ได้รับเงิน", key: "reimbursedDate", width: 16 },
        { header: "จำนวนเงินที่ได้รับ", key: "reimbursedAmount", width: 18 },
        { header: "หมายเหตุ", key: "note", width: 24 },
        { header: "มีใบเสร็จ", key: "hasExpenseProof", width: 12 },
        { header: "มีเอกสาร IOU", key: "hasIouDocument", width: 14 },
        { header: "มีหลักฐานรับเงิน", key: "hasReimbursementProof", width: 18 },
        { header: "วันที่สร้าง", key: "createdAt", width: 14 },
        { header: "วันที่แก้ไข", key: "updatedAt", width: 14 },
      ];

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      headerRow.height = 30;

      // Add data rows
      rows.forEach((r, idx) => {
        const row = sheet.addRow({
          expenseNo: r.expenseNo,
          userName: r.userName,
          companyName: r.companyName,
          expenseType: EXPENSE_TYPE_LABELS[r.expenseType] ?? r.expenseType,
          itemName: r.itemName,
          expenseDate: formatDate(r.expenseDate),
          categoryName: r.categoryName ?? "",
          description: r.description ?? "",
          amount: Number(r.amount),
          currency: r.currency,
          paymentMethodName: r.paymentMethodName ?? "",
          vendorName: r.vendorName ?? "",
          iouNumber: r.iouNumber ?? "",
          iouDate: formatDate(r.iouDate),
          iouAmount: r.iouAmount ? Number(r.iouAmount) : "",
          iouNote: r.iouNote ?? "",
          status: STATUS_LABELS[r.status] ?? r.status,
          claimDate: formatDate(r.claimDate),
          reimbursedDate: formatDate(r.reimbursedDate),
          reimbursedAmount: r.reimbursedAmount ? Number(r.reimbursedAmount) : "",
          note: r.note ?? "",
          hasExpenseProof: r.hasExpenseProof ? "ใช่" : "ไม่",
          hasIouDocument: r.hasIouDocument ? "ใช่" : "ไม่",
          hasReimbursementProof: r.hasReimbursementProof ? "ใช่" : "ไม่",
          createdAt: formatDate(r.createdAt),
          updatedAt: formatDate(r.updatedAt),
        });

        // Alternate row colors
        if (idx % 2 === 0) {
          row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F8FF" } };
        }

        // Format amount columns
        row.getCell("amount").numFmt = "#,##0.00";
        row.getCell("iouAmount").numFmt = "#,##0.00";
        row.getCell("reimbursedAmount").numFmt = "#,##0.00";
        row.alignment = { vertical: "middle" };
      });

      // Auto-filter on header
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columns.length },
      };

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      return {
        content: base64,
        filename: `expenses_${new Date().toISOString().slice(0, 10)}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }),
});
