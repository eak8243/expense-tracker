import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

// ─── Helper: check expense ownership ─────────────────────────────────────────
async function requireExpenseOwner(expenseId: number, userId: number, role: string) {
  const expense = await db.getExpenseById(expenseId);
  if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบรายการค่าใช้จ่าย" });
  if (role !== "admin" && expense.userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์เข้าถึงรายการนี้" });
  }
  return expense;
}

// ─── Helper: log history ──────────────────────────────────────────────────────
async function logHistory(data: {
  expenseId: number;
  actionType: "created" | "updated" | "status_changed" | "attachment_uploaded" | "attachment_deleted" | "reimbursement_proof_uploaded" | "iou_document_uploaded" | "reverted_status" | "admin_corrected";
  performedBy: number;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  oldStatus?: string;
  newStatus?: string;
  note?: string;
  ipAddress?: string;
}) {
  await db.createHistoryLog({
    expenseId: data.expenseId,
    actionType: data.actionType,
    fieldName: data.fieldName ?? null,
    oldValue: data.oldValue ?? null,
    newValue: data.newValue ?? null,
    oldStatus: data.oldStatus ?? null,
    newStatus: data.newStatus ?? null,
    performedBy: data.performedBy,
    note: data.note ?? null,
    ipAddress: data.ipAddress ?? null,
  });
}

export const expensesRouter = router({
  // ─── List ──────────────────────────────────────────────────────────────────
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        categoryId: z.number().optional(),
        status: z.string().optional(),
        expenseType: z.string().optional(),
        paymentMethodId: z.number().optional(),
        iouNumber: z.string().optional(),
        keyword: z.string().optional(),
        amountMin: z.number().optional(),
        amountMax: z.number().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
        sortBy: z.enum(["expenseDate", "claimDate", "createdAt", "amount"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.role === "admin" || ctx.user.role === "viewer" ? undefined : ctx.user.id;
      return db.getExpenses({ ...input, userId });
    }),

  // ─── Get by ID ─────────────────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const expense = await db.getExpenseById(input.id);
      if (!expense) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role === "user" && expense.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Attach attachments
      const attachments = await db.getAttachmentsByExpenseId(input.id);
      return { ...expense, attachments };
    }),

  // ─── Create ────────────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        expenseType: z.enum(["normal_expense", "iou_advance"]).default("normal_expense"),
        itemName: z.string().min(1).max(255),
        expenseDate: z.date(),
        categoryId: z.number().nullable().optional(),
        description: z.string().nullable().optional(),
        amount: z.number().nonnegative(), // 0 allowed when foreignCurrency is set (THB unknown yet)
        currency: z.string().default("THB"),
        paymentMethodId: z.number().nullable().optional(),
        vendorName: z.string().optional(),
        iouNumber: z.string().optional(),
        iouDate: z.date().optional(),
        iouAmount: z.number().optional(),
        iouNote: z.string().optional(),
        note: z.string().optional(),
        // Foreign currency (USD)
        foreignCurrency: z.literal("USD").optional(),
        foreignAmount: z.number().positive().optional(),
        exchangeRate: z.number().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Validate: if foreignCurrency=USD, foreignAmount required; amount can be 0
      if (input.foreignCurrency === "USD" && !input.foreignAmount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาระบุจำนวน USD" });
      }
      if (!input.foreignCurrency && input.amount <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาระบุจำนวนเงิน" });
      }
      // Validate IOU
      if (input.expenseType === "iou_advance" && !input.iouNumber) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาระบุเลข IOU สำหรับประเภทเงินทดรองจ่าย" });
      }

      // Validate company
      const company = await db.getCompanyById(input.companyId);
      if (!company || !company.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "บริษัทที่เลือกไม่ถูกต้องหรือไม่ได้ใช้งาน" });
      }

      const expenseNo = await db.generateExpenseNumber();

      const expenseId = await db.createExpense({
        expenseNo,
        userId: ctx.user.id,
        companyId: input.companyId,
        expenseType: input.expenseType,
        itemName: input.itemName,
        expenseDate: input.expenseDate,
        categoryId: input.categoryId ?? null,
        description: input.description ?? null,
        amount: String(input.amount),
        currency: input.currency,
        paymentMethodId: input.paymentMethodId ?? null,
        vendorName: input.vendorName ?? null,
        iouNumber: input.iouNumber ?? null,
        iouDate: input.iouDate ?? null,
        iouAmount: input.iouAmount ? String(input.iouAmount) : null,
        iouNote: input.iouNote ?? null,
        note: input.note ?? null,
        foreignCurrency: input.foreignCurrency ?? null,
        foreignAmount: input.foreignAmount ? String(input.foreignAmount) : null,
        exchangeRate: input.exchangeRate ? String(input.exchangeRate) : null,
        status: "draft",
      });

      // Get the created expense id from the sequence
      const created = await db.getExpenses({ userId: ctx.user.id, keyword: expenseNo, pageSize: 1 });
      const newExpense = created.data[0];

      if (newExpense) {
        await logHistory({
          expenseId: newExpense.id,
          actionType: "created",
          performedBy: ctx.user.id,
          newValue: expenseNo,
        });
      }

      return { success: true, expenseNo, id: newExpense?.id ?? expenseId };
    }),

  // ─── Update ────────────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        companyId: z.number().optional(),
        expenseType: z.enum(["normal_expense", "iou_advance"]).optional(),
        itemName: z.string().min(1).max(255).optional(),
        expenseDate: z.date().optional(),
        categoryId: z.number().nullable().optional(),
        description: z.string().nullable().optional(),
        amount: z.number().nonnegative().optional(), // 0 allowed when foreignCurrency=USD (THB unknown yet)
        currency: z.string().optional(),
        paymentMethodId: z.number().nullable().optional(),
        vendorName: z.string().nullable().optional(),
        iouNumber: z.string().nullable().optional(),
        iouDate: z.date().nullable().optional(),
        iouAmount: z.number().nullable().optional(),
        iouNote: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
        // Foreign currency
        foreignCurrency: z.literal("USD").nullable().optional(),
        foreignAmount: z.number().positive().nullable().optional(),
        exchangeRate: z.number().positive().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input;
      const expense = await requireExpenseOwner(id, ctx.user.id, ctx.user.role);

      if (expense.status === "reimbursed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไม่สามารถแก้ไขรายการที่ได้รับเงินคืนแล้ว" });
      }

      if (fields.expenseType === "iou_advance" && !fields.iouNumber && !expense.iouNumber) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาระบุเลข IOU สำหรับประเภทเงินทดรองจ่าย" });
      }

      // Track changed fields
      // Use UNSET sentinel to distinguish "field not sent" from "field explicitly set to null"
      const UNSET = Symbol("UNSET");
      const changedFields: Array<{ field: string; old: string; new: string }> = [];
      const updateData: Record<string, unknown> = {};

      const normalise = (v: unknown): string => {
        if (v === null || v === undefined) return "";
        return String(v);
      };

      const trackChange = (field: string, oldVal: unknown, newVal: unknown) => {
        if (newVal === UNSET) return; // field was not included in the request — skip
        if (normalise(oldVal) !== normalise(newVal)) {
          changedFields.push({ field, old: normalise(oldVal), new: normalise(newVal) });
          updateData[field] = newVal; // preserve null so DB clears the column
        }
      };

      trackChange("itemName", expense.itemName, fields.itemName ?? UNSET);
      trackChange("companyId", expense.companyId, fields.companyId ?? UNSET);
      trackChange("expenseType", expense.expenseType, fields.expenseType ?? UNSET);
      trackChange("expenseDate", expense.expenseDate, fields.expenseDate ?? UNSET);
      // categoryId and paymentMethodId can be explicitly set to null ("ไม่ระบุ")
      trackChange("categoryId", expense.categoryId, "categoryId" in fields ? (fields.categoryId ?? null) : UNSET);
      trackChange("description", expense.description, "description" in fields ? (fields.description ?? null) : UNSET);
      trackChange("amount", expense.amount, fields.amount !== undefined ? String(fields.amount) : UNSET);
      trackChange("currency", expense.currency, fields.currency ?? UNSET);
      trackChange("paymentMethodId", expense.paymentMethodId, "paymentMethodId" in fields ? (fields.paymentMethodId ?? null) : UNSET);
      trackChange("vendorName", expense.vendorName, "vendorName" in fields ? (fields.vendorName ?? null) : UNSET);
      trackChange("iouNumber", expense.iouNumber, "iouNumber" in fields ? (fields.iouNumber ?? null) : UNSET);
      trackChange("iouDate", expense.iouDate, "iouDate" in fields ? (fields.iouDate ?? null) : UNSET);
      trackChange("iouAmount", expense.iouAmount, fields.iouAmount !== undefined ? (fields.iouAmount !== null ? String(fields.iouAmount) : null) : UNSET);
      trackChange("iouNote", expense.iouNote, "iouNote" in fields ? (fields.iouNote ?? null) : UNSET);
      trackChange("note", expense.note, "note" in fields ? (fields.note ?? null) : UNSET);
      trackChange("foreignCurrency", expense.foreignCurrency, "foreignCurrency" in fields ? (fields.foreignCurrency ?? null) : UNSET);
      trackChange("foreignAmount", expense.foreignAmount, fields.foreignAmount !== undefined ? (fields.foreignAmount !== null ? String(fields.foreignAmount) : null) : UNSET);
      trackChange("exchangeRate", expense.exchangeRate, fields.exchangeRate !== undefined ? (fields.exchangeRate !== null ? String(fields.exchangeRate) : null) : UNSET);

      if (Object.keys(updateData).length === 0) return { success: true };

      // Convert amount fields to string for DB
      if (updateData.amount !== undefined) updateData.amount = String(updateData.amount);
      if (updateData.iouAmount !== undefined && updateData.iouAmount !== null) updateData.iouAmount = String(updateData.iouAmount);
      if (updateData.foreignAmount !== undefined && updateData.foreignAmount !== null) updateData.foreignAmount = String(updateData.foreignAmount);
      if (updateData.exchangeRate !== undefined && updateData.exchangeRate !== null) updateData.exchangeRate = String(updateData.exchangeRate);

      await db.updateExpense(id, updateData as Parameters<typeof db.updateExpense>[1]);

      // Log each changed field
      for (const change of changedFields) {
        await logHistory({
          expenseId: id,
          actionType: "updated",
          performedBy: ctx.user.id,
          fieldName: change.field,
          oldValue: change.old,
          newValue: change.new,
        });
      }

      return { success: true };
    }),

  // ─── Delete ────────────────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const expense = await requireExpenseOwner(input.id, ctx.user.id, ctx.user.role);
      if (expense.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "สามารถลบได้เฉพาะรายการที่อยู่ในสถานะร่างเท่านั้น" });
      }
      await db.deleteExpense(input.id);
      return { success: true };
    }),

  // ─── Mark Claimed ──────────────────────────────────────────────────────────
  markClaimed: protectedProcedure
    .input(z.object({
      id: z.number(),
      claimDate: z.date().optional(), // วันที่ทำเบิก — ถ้าไม่ระบุใช้วันปัจจุบัน
    }))
    .mutation(async ({ input, ctx }) => {
      const expense = await requireExpenseOwner(input.id, ctx.user.id, ctx.user.role);

      if (expense.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "สามารถเปลี่ยนเป็นทำเบิกแล้วได้เฉพาะรายการที่อยู่ในสถานะร่างเท่านั้น" });
      }

      // IOU validation
      if (expense.expenseType === "iou_advance") {
        if (!expense.iouNumber) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาระบุเลข IOU และแนบเอกสาร IOU ก่อนทำเบิก" });
        }
        const iouDocCount = await db.countAttachmentsByType(input.id, "iou_document");
        if (iouDocCount === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาระบุเลข IOU และแนบเอกสาร IOU ก่อนทำเบิก" });
        }
      }

      const effectiveClaimDate = input.claimDate ?? new Date();
      await db.updateExpense(input.id, { status: "claimed", claimDate: effectiveClaimDate });
      await logHistory({
        expenseId: input.id,
        actionType: "status_changed",
        performedBy: ctx.user.id,
        oldStatus: "draft",
        newStatus: "claimed",
      });

      return { success: true };
    }),

  // ─── Mark Reimbursed ───────────────────────────────────────────────────────
  markReimbursed: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        reimbursedAmount: z.number().optional(),
        reimbursedDate: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const expense = await requireExpenseOwner(input.id, ctx.user.id, ctx.user.role);

      if (expense.status !== "claimed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "สามารถเปลี่ยนเป็นได้เงินแล้วได้เฉพาะรายการที่อยู่ในสถานะทำเบิกแล้วเท่านั้น" });
      }

      const proofCount = await db.countAttachmentsByType(input.id, "reimbursement_proof");
      if (proofCount === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาแนบหลักฐานการรับเงินคืนก่อนเปลี่ยนสถานะเป็นได้เงินแล้ว" });
      }

      await db.updateExpense(input.id, {
        status: "reimbursed",
        reimbursedDate: input.reimbursedDate ?? new Date(),
        reimbursedAmount: input.reimbursedAmount ? String(input.reimbursedAmount) : undefined,
      });

      await logHistory({
        expenseId: input.id,
        actionType: "status_changed",
        performedBy: ctx.user.id,
        oldStatus: "claimed",
        newStatus: "reimbursed",
      });

      return { success: true };
    }),

  // ─── Revert to Draft ───────────────────────────────────────────────────────
  revertToDraft: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const expense = await requireExpenseOwner(input.id, ctx.user.id, ctx.user.role);

      if (expense.status !== "claimed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "สามารถย้อนสถานะเป็นร่างได้เฉพาะรายการที่อยู่ในสถานะทำเบิกแล้วเท่านั้น" });
      }

      await db.updateExpense(input.id, { status: "draft", claimDate: null });
      await logHistory({
        expenseId: input.id,
        actionType: "reverted_status",
        performedBy: ctx.user.id,
        oldStatus: "claimed",
        newStatus: "draft",
      });

      return { success: true };
    }),

  // ─── Revert to Claimed ─────────────────────────────────────────────────────
  revertToClaimed: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const expense = await requireExpenseOwner(input.id, ctx.user.id, ctx.user.role);

      if (expense.status !== "reimbursed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "สามารถย้อนสถานะเป็นทำเบิกแล้วได้เฉพาะรายการที่อยู่ในสถานะได้เงินแล้วเท่านั้น" });
      }

      await db.updateExpense(input.id, { status: "claimed", reimbursedDate: null });
      await logHistory({
        expenseId: input.id,
        actionType: "reverted_status",
        performedBy: ctx.user.id,
        oldStatus: "reimbursed",
        newStatus: "claimed",
      });

      return { success: true };
    }),

  // ─── History ───────────────────────────────────────────────────────────────
  history: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        order: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input, ctx }) => {
      const expense = await db.getExpenseById(input.id);
      if (!expense) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role === "user" && expense.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getHistoryByExpenseId(input.id, input.order);
    }),

  // ─── Master Data ───────────────────────────────────────────────────────────
  masterData: protectedProcedure.query(async () => {
    const [companies, categories, paymentMethods] = await Promise.all([
      db.getActiveCompanies(),
      db.getActiveCategories(),
      db.getActivePaymentMethods(),
    ]);
    return { companies, categories, paymentMethods };
  }),

  // ─── Autocomplete suggestions ──────────────────────────────────────────────
  suggestions: protectedProcedure
    .input(
      z.object({
        field: z.enum(["vendorName", "itemName"]),
        keyword: z.string().min(1).max(100),
        limit: z.number().min(1).max(20).default(8),
      })
    )
    .query(async ({ input, ctx }) => {
      // Admin/viewer sees all; regular user sees only their own history
      const userId = ctx.user.role === "admin" || ctx.user.role === "viewer" ? undefined : ctx.user.id;
      return db.getFieldSuggestions(input.field, input.keyword, input.limit, userId);
    }),
});
