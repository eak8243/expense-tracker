// Reimbursement Batches Router
// Handles batch reimbursement: multiple expenses reimbursed together in one transfer

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { storagePut, storageGet } from "../storage";
import multer from "multer";
import type { Request, Response, NextFunction } from "express";

export const batchesRouter = router({
  // ─── List batches ────────────────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({ all: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Admin/viewer can see all batches; regular users see only their own
      const userId =
        ctx.user.role === "user" ? ctx.user.id : input?.all ? undefined : ctx.user.id;
      return db.listReimbursementBatches(userId);
    }),

  // ─── Get batch by ID ─────────────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const batch = await db.getReimbursementBatchById(input.id);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
      return batch;
    }),

  // ─── Create batch ─────────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        expenseIds: z.array(z.number()).min(1, "ต้องเลือกอย่างน้อย 1 รายการ"),
        reimbursedAt: z.date(),
        note: z.string().optional(),
        totalAmount: z.string(), // decimal string
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate all expenses exist, belong to user (or admin), and are in "claimed" status
      const expenseRows = await Promise.all(
        input.expenseIds.map((id) => db.getExpenseById(id))
      );

      for (const expense of expenseRows) {
        if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบรายการค่าใช้จ่าย" });
        if (ctx.user.role === "user" && expense.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์เข้าถึงรายการนี้" });
        }
        if (expense.status !== "claimed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `รายการ ${expense.expenseNo} ต้องอยู่ในสถานะ "ทำเบิกแล้ว" ก่อนเบิกรวม`,
          });
        }
      }

      const batchNo = await db.generateBatchNumber();

      const batchId = await db.createReimbursementBatch(
        {
          batchNo,
          note: input.note ?? null,
          totalAmount: input.totalAmount,
          reimbursedAt: input.reimbursedAt,
          createdBy: ctx.user.id,
        },
        input.expenseIds
      );

      // Log history for each expense
      for (const expense of expenseRows) {
        if (!expense) continue;
        await db.createHistoryLog({
          expenseId: expense.id,
          actionType: "status_changed",
          oldStatus: "claimed",
          newStatus: "reimbursed",
          note: `เบิกรวมในกลุ่ม ${batchNo}`,
          performedBy: ctx.user.id,
        });
      }

      return { batchId, batchNo };
    }),

  // ─── Upload proof for batch ───────────────────────────────────────────────────
  uploadProof: protectedProcedure
    .input(
      z.object({
        batchId: z.number(),
        fileBase64: z.string(),
        fileName: z.string(),
        fileType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const batch = await db.getReimbursementBatchById(input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND" });

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
      if (!allowedTypes.includes(input.fileType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ประเภทไฟล์ไม่รองรับ (รองรับ PDF, JPG, PNG)" });
      }

      // Decode base64 and upload
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไฟล์ขนาดเกิน 10MB" });
      }

      const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "bin";
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storageKey = `batches/${batch.batchNo}_proof_${Date.now()}.${ext}`;

      const { key } = await storagePut(storageKey, buffer, input.fileType);
      await db.updateBatchProof(input.batchId, key, input.fileName, input.fileType);

      return { success: true };
    }),

  // ─── Get proof download URL ───────────────────────────────────────────────────
  getProofUrl: protectedProcedure
    .input(z.object({ batchId: z.number() }))
    .query(async ({ ctx, input }) => {
      const batch = await db.getReimbursementBatchById(input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
      if (!batch.proofFileKey) throw new TRPCError({ code: "NOT_FOUND", message: "ยังไม่มีไฟล์หลักฐาน" });

      const { url } = await storageGet(batch.proofFileKey);
      return { url, fileName: batch.proofFileName, fileType: batch.proofFileType };
    }),

  // ─── Delete batch (admin only) ────────────────────────────────────────────────
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const batch = await db.getReimbursementBatchById(input.id);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
      await db.deleteReimbursementBatch(input.id);
      return { success: true };
    }),

  // ─── Get batch info for an expense ───────────────────────────────────────────
  getByExpenseId: protectedProcedure
    .input(z.object({ expenseId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Return null gracefully if expense doesn't exist (avoids "data is undefined" client error)
      const expense = await db.getExpenseById(input.expenseId);
      if (!expense) return null;
      if (ctx.user.role === "user" && expense.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getExpenseBatch(input.expenseId);
    }),
});
