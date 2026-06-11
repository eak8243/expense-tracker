import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const dashboardRouter = router({
  // ─── User summary ──────────────────────────────────────────────────────────
  mySummary: protectedProcedure.query(async ({ ctx }) => {
    const [summary, byCompany, byCategory, byType, recent] = await Promise.all([
      db.getUserDashboardSummary(ctx.user.id),
      db.getExpenseByCompany(ctx.user.id),
      db.getExpenseByCategory(ctx.user.id),
      db.getExpenseByType(ctx.user.id),
      db.getRecentExpenses(ctx.user.id, 5),
    ]);
    return { summary, byCompany, byCategory, byType, recent };
  }),

  myMonthlyTrend: protectedProcedure
    .input(z.object({ months: z.number().default(12) }))
    .query(async ({ input, ctx }) => {
      return db.getMonthlyTrend(ctx.user.id, input.months);
    }),

  // ─── Admin summary ─────────────────────────────────────────────────────────
  adminSummary: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "viewer") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const [summary, byCompany, byCategory, byType, byUser, recent] = await Promise.all([
      db.getAdminDashboardSummary(),
      db.getExpenseByCompany(),
      db.getExpenseByCategory(),
      db.getExpenseByType(),
      db.getExpenseByUser(),
      db.getRecentExpenses(undefined, 10),
    ]);
    return { summary, byCompany, byCategory, byType, byUser, recent };
  }),

  adminMonthlyTrend: protectedProcedure
    .input(z.object({ months: z.number().default(12) }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "viewer") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getMonthlyTrend(undefined, input.months);
    }),
});
