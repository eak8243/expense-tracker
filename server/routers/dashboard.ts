import { z } from "zod";
import * as db from "../db";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { expenses, companies } from "../../drizzle/schema";

export const dashboardRouter = router({
  // ─── Companies with expense data (for dropdown filter) ──────────────────────────
  myCompanies: protectedProcedure.query(async ({ ctx }) => {
    const dbConn = await getDb();
    if (!dbConn) return [];
    const isAdminOrViewer = ctx.user.role === "admin" || ctx.user.role === "viewer";
    if (isAdminOrViewer) {
      // Admin/viewer: all companies that have expenses
      return dbConn
        .selectDistinct({ id: companies.id, companyName: companies.companyName })
        .from(expenses)
        .innerJoin(companies, eq(expenses.companyId, companies.id))
        .orderBy(companies.companyName);
    } else {
      // Regular user: only companies where this user has expenses
      return dbConn
        .selectDistinct({ id: companies.id, companyName: companies.companyName })
        .from(expenses)
        .innerJoin(companies, eq(expenses.companyId, companies.id))
        .where(eq(expenses.userId, ctx.user.id))
        .orderBy(companies.companyName);
    }
  }),

  // ─── User summary ──────────────────────────────────────────────────────────
  mySummary: protectedProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const companyId = input?.companyId;
      const [summary, byCompany, byCategory, byType, recent] = await Promise.all([
        db.getUserDashboardSummary(ctx.user.id, companyId),
        db.getExpenseByCompany(ctx.user.id, companyId),
        db.getExpenseByCategory(ctx.user.id, companyId),
        db.getExpenseByType(ctx.user.id, companyId),
        db.getRecentExpenses(ctx.user.id, 5, companyId),
      ]);
      return { summary, byCompany, byCategory, byType, recent };
    }),

  myMonthlyTrend: protectedProcedure
    .input(z.object({ months: z.number().default(12), companyId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      return db.getMonthlyTrend(ctx.user.id, input.months, input.companyId);
    }),

  // ─── Admin summary ─────────────────────────────────────────────────────────
  adminSummary: protectedProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "viewer") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const companyId = input?.companyId;
      const [summary, byCompany, byCategory, byType, byUser, recent] = await Promise.all([
        db.getAdminDashboardSummary(companyId),
        db.getExpenseByCompany(undefined, companyId),
        db.getExpenseByCategory(undefined, companyId),
        db.getExpenseByType(undefined, companyId),
        db.getExpenseByUser(),
        db.getRecentExpenses(undefined, 10, companyId),
      ]);
      return { summary, byCompany, byCategory, byType, byUser, recent };
    }),

  adminMonthlyTrend: protectedProcedure
    .input(z.object({ months: z.number().default(12), companyId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "viewer") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getMonthlyTrend(undefined, input.months, input.companyId);
    }),
});
