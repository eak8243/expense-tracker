import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  getExpenses: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getExpenseById: vi.fn().mockResolvedValue(null),
  createExpense: vi.fn().mockResolvedValue(1),
  updateExpense: vi.fn().mockResolvedValue(undefined),
  deleteExpense: vi.fn().mockResolvedValue(undefined),
  generateExpenseNumber: vi.fn().mockResolvedValue("EXP-2024-000001"),
  getCompanyById: vi.fn().mockResolvedValue({ id: 1, companyName: "Test Co", isActive: true }),
  getActiveCompanies: vi.fn().mockResolvedValue([]),
  getActiveCategories: vi.fn().mockResolvedValue([]),
  getActivePaymentMethods: vi.fn().mockResolvedValue([]),
  countAttachmentsByType: vi.fn().mockResolvedValue(0),
  getHistoryByExpenseId: vi.fn().mockResolvedValue([]),
}));

function createUserContext(role: "user" | "admin" | "viewer" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      username: "testuser",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "password",
      role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

describe("expenses.masterData", () => {
  it("returns companies, categories, and paymentMethods", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.expenses.masterData();
    expect(result).toHaveProperty("companies");
    expect(result).toHaveProperty("categories");
    expect(result).toHaveProperty("paymentMethods");
  });
});

describe("expenses.list", () => {
  it("returns paginated list for authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.expenses.list({ page: 1, pageSize: 10 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.data)).toBe(true);
  });
});

describe("expenses.create", () => {
  it("creates expense and returns expenseNo", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.expenses.create({
      companyId: 1,
      expenseType: "normal_expense",
      itemName: "Test Expense",
      expenseDate: new Date(),
      amount: 1000,
      currency: "THB",
    });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("expenseNo");
  });

  it("throws error for iou_advance without iouNumber", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.expenses.create({
        companyId: 1,
        expenseType: "iou_advance",
        itemName: "IOU Test",
        expenseDate: new Date(),
        amount: 500,
        currency: "THB",
      })
    ).rejects.toThrow();
  });
});

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect((result as any)?.role).toBe("user");
  });

  it("returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});
