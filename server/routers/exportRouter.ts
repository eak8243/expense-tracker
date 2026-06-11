import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

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
});
