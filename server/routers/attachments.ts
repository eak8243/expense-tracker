import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut, storageGet } from "../storage";
import { createHistoryLog } from "../db";
import path from "path";
import crypto from "crypto";

// ─── File name sanitizer (ASCII-only for storage key) ────────────────────────
function sanitizeItemName(name: string): string {
  // NFC normalize first
  const normalized = name.normalize("NFC");
  // Keep only ASCII letters, numbers, hyphen, underscore — strip Thai and all non-ASCII
  const cleaned = normalized
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9\-_]/g, "")  // ASCII only, no Thai
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  // If result is empty (e.g. all-Thai name), fall back to "item"
  return (cleaned.substring(0, 40) || "item");
}

function generateStoredFileName(
  expenseNo: string,
  itemName: string,
  attachmentType: string,
  originalExt: string
): string {
  const itemNameSafe = sanitizeItemName(itemName);
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .replace(/\..+/, "")
    .substring(0, 14);
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  const ext = originalExt.toLowerCase().replace(/[^a-z0-9]/g, "");
  const name = `${expenseNo}_${itemNameSafe}_${attachmentType}_${timestamp}_${random}.${ext}`;
  // Limit total length to 180
  if (name.length > 180) {
    const truncatedItem = itemNameSafe.substring(0, Math.max(1, 40 - (name.length - 180)));
    return `${expenseNo}_${truncatedItem}_${attachmentType}_${timestamp}_${random}.${ext}`;
  }
  return name;
}

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const attachmentsRouter = router({
  // ─── Upload (base64 encoded) ───────────────────────────────────────────────
  upload: protectedProcedure
    .input(
      z.object({
        expenseId: z.number(),
        attachmentType: z.enum(["expense_proof", "reimbursement_proof", "iou_document"]),
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        fileData: z.string(), // base64
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get expense and check ownership
      const expense = await db.getExpenseById(input.expenseId);
      if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบรายการค่าใช้จ่าย" });
      if (ctx.user.role === "user" && expense.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Validate status rules for attachment type
      if (input.attachmentType === "expense_proof" && expense.status === "reimbursed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไม่สามารถอัปโหลดใบเสร็จในสถานะได้เงินแล้ว" });
      }
      if (input.attachmentType === "reimbursement_proof" && expense.status !== "claimed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "สามารถอัปโหลดหลักฐานการรับเงินคืนได้เฉพาะในสถานะทำเบิกแล้ว" });
      }
      if (input.attachmentType === "iou_document" && expense.status === "reimbursed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไม่สามารถอัปโหลดเอกสาร IOU ในสถานะได้เงินแล้ว" });
      }

      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(input.fileType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ประเภทไฟล์ไม่ถูกต้อง อนุญาตเฉพาะ PDF, JPG, JPEG, PNG" });
      }
      const ext = path.extname(input.fileName).replace(".", "").toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "นามสกุลไฟล์ไม่ถูกต้อง" });
      }
      if (input.fileSize > MAX_FILE_SIZE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ขนาดไฟล์เกิน 10 MB" });
      }

      // Generate stored file name
      const fileNameStored = generateStoredFileName(
        expense.expenseNo,
        expense.itemName,
        input.attachmentType,
        ext
      );

      // Build storage key
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const storageKey = `expenses/${yyyy}/${mm}/${expense.expenseNo}/${fileNameStored}`;

      // Decode base64 and upload to S3-compatible storage
      const fileBuffer = Buffer.from(input.fileData, "base64");
      const { key, url } = await storagePut(storageKey, fileBuffer, input.fileType);

      // Save to DB
      await db.createAttachment({
        expenseId: input.expenseId,
        uploadedBy: ctx.user.id,
        attachmentType: input.attachmentType,
        fileNameOriginal: input.fileName,
        fileNameStored: fileNameStored,
        filePath: url,
        fileStorageKey: key,
        fileType: input.fileType,
        fileSize: input.fileSize,
      });

      // Get the attachment we just created
      const attachments = await db.getAttachmentsByExpenseId(input.expenseId);
      const newAttachment = attachments[attachments.length - 1];

      // Log history
      const actionType =
        input.attachmentType === "reimbursement_proof"
          ? "reimbursement_proof_uploaded"
          : input.attachmentType === "iou_document"
          ? "iou_document_uploaded"
          : "attachment_uploaded";

      await createHistoryLog({
        expenseId: input.expenseId,
        actionType,
        attachmentId: newAttachment?.id ?? null,
        attachmentFileNameOriginal: input.fileName,
        attachmentFileNameStored: fileNameStored,
        attachmentType: input.attachmentType,
        performedBy: ctx.user.id,
      });

      return { success: true, attachment: newAttachment };
    }),

  // ─── Delete ────────────────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const attachment = await db.getAttachmentById(input.id);
      if (!attachment) throw new TRPCError({ code: "NOT_FOUND" });

      const expense = await db.getExpenseById(attachment.expenseId);
      if (!expense) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.user.role === "user" && expense.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (expense.status === "reimbursed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไม่สามารถลบไฟล์ในสถานะได้เงินแล้ว" });
      }

      await db.deleteAttachment(input.id);

      await createHistoryLog({
        expenseId: attachment.expenseId,
        actionType: "attachment_deleted",
        attachmentId: input.id,
        attachmentFileNameOriginal: attachment.fileNameOriginal,
        attachmentFileNameStored: attachment.fileNameStored,
        attachmentType: attachment.attachmentType,
        performedBy: ctx.user.id,
      });

      return { success: true };
    }),

  // ─── Get download URL ──────────────────────────────────────────────────────
  getDownloadUrl: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const attachment = await db.getAttachmentById(input.id);
      if (!attachment) throw new TRPCError({ code: "NOT_FOUND" });

      const expense = await db.getExpenseById(attachment.expenseId);
      if (!expense) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.user.role === "user" && expense.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Return the stored URL (already a signed/proxied URL from storagePut)
      const { url } = await storageGet(attachment.fileStorageKey || attachment.filePath);

      return {
        url,
        fileName: attachment.fileNameOriginal,
        fileType: attachment.fileType,
      };
    }),

  // ─── List by expense ───────────────────────────────────────────────────────
  listByExpense: protectedProcedure
    .input(z.object({ expenseId: z.number() }))
    .query(async ({ input, ctx }) => {
      const expense = await db.getExpenseById(input.expenseId);
      if (!expense) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role === "user" && expense.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getAttachmentsByExpenseId(input.expenseId);
    }),
});
