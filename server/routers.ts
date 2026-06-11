import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { expensesRouter } from "./routers/expenses";
import { attachmentsRouter } from "./routers/attachments";
import { dashboardRouter } from "./routers/dashboard";
import { adminRouter } from "./routers/admin";
import { exportRouter } from "./routers/exportRouter";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  expenses: expensesRouter,
  attachments: attachmentsRouter,
  dashboard: dashboardRouter,
  admin: adminRouter,
  export: exportRouter,
});

export type AppRouter = typeof appRouter;
