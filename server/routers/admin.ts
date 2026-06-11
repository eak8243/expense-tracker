import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

// ─── Admin guard middleware ───────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "เฉพาะผู้ดูแลระบบเท่านั้น" });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // ─── Users ─────────────────────────────────────────────────────────────────
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "viewer") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return db.getAllUsers();
  }),

  createUser: adminProcedure
    .input(
      z.object({
        username: z.string().min(3).max(64),
        name: z.string().min(1).max(255),
        email: z.string().email().optional(),
        password: z.string().min(8),
        role: z.enum(["user", "admin", "viewer"]).default("user"),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await db.getUserByUsername(input.username);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "ชื่อผู้ใช้นี้มีอยู่แล้ว" });
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      await db.createUser({
        username: input.username,
        name: input.name,
        email: input.email ?? null,
        passwordHash,
        role: input.role,
        isActive: true,
        loginMethod: "password",
      });
      return { success: true };
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().nullable().optional(),
        role: z.enum(["user", "admin", "viewer"]).optional(),
        isActive: z.boolean().optional(),
        password: z.string().min(8).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, password, ...fields } = input;
      const updateData: Record<string, unknown> = { ...fields };
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }
      await db.updateUser(id, updateData);
      return { success: true };
    }),

  // ─── Companies ─────────────────────────────────────────────────────────────
  listCompanies: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "viewer") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return db.getAllCompanies();
  }),

  createCompany: adminProcedure
    .input(
      z.object({
        companyCode: z.string().min(1).max(32),
        companyName: z.string().min(1).max(255),
        companyLegalName: z.string().optional(),
        taxId: z.string().optional(),
        branchName: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.createCompany({
        companyCode: input.companyCode,
        companyName: input.companyName,
        companyLegalName: input.companyLegalName ?? null,
        taxId: input.taxId ?? null,
        branchName: input.branchName ?? null,
        address: input.address ?? null,
        isActive: true,
      });
      return { success: true };
    }),

  updateCompany: adminProcedure
    .input(
      z.object({
        id: z.number(),
        companyCode: z.string().min(1).max(32).optional(),
        companyName: z.string().min(1).max(255).optional(),
        companyLegalName: z.string().nullable().optional(),
        taxId: z.string().nullable().optional(),
        branchName: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      await db.updateCompany(id, fields);
      return { success: true };
    }),

  // ─── Categories ────────────────────────────────────────────────────────────
  listCategories: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "viewer") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return db.getAllCategories();
  }),

  createCategory: adminProcedure
    .input(
      z.object({
        categoryName: z.string().min(1).max(128),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.createCategory({
        categoryName: input.categoryName,
        description: input.description ?? null,
        isActive: true,
      });
      return { success: true };
    }),

  updateCategory: adminProcedure
    .input(
      z.object({
        id: z.number(),
        categoryName: z.string().min(1).max(128).optional(),
        description: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      await db.updateCategory(id, fields);
      return { success: true };
    }),

  // ─── Payment Methods ───────────────────────────────────────────────────────
  listPaymentMethods: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "viewer") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return db.getAllPaymentMethods();
  }),

  createPaymentMethod: adminProcedure
    .input(
      z.object({
        methodName: z.string().min(1).max(128),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.createPaymentMethod({
        methodName: input.methodName,
        description: input.description ?? null,
        isActive: true,
      });
      return { success: true };
    }),

  updatePaymentMethod: adminProcedure
    .input(
      z.object({
        id: z.number(),
        methodName: z.string().min(1).max(128).optional(),
        description: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      await db.updatePaymentMethod(id, fields);
      return { success: true };
    }),
});
