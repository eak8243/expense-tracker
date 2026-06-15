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
  createHistoryLog: vi.fn().mockResolvedValue(undefined),
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

describe("expenses.create USD", () => {
  beforeEach(async () => {
    const db = await import("./db");
    vi.mocked(db.createExpense).mockResolvedValue(42);
    vi.mocked(db.generateExpenseNumber).mockResolvedValue("EXP-2026-000001");
    vi.mocked(db.getCompanyById).mockResolvedValue({ id: 1, companyName: "Test Co", isActive: true });
  });

  it("creates USD expense with foreignAmount and no THB amount", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.expenses.create({
      companyId: 1,
      expenseType: "normal_expense",
      itemName: "Hotel USD",
      expenseDate: new Date(),
      amount: 0,
      currency: "THB",
      foreignCurrency: "USD",
      foreignAmount: 150.00,
    });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("expenseNo");
  });

  it("creates USD expense with foreignAmount, exchangeRate, and THB amount", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.expenses.create({
      companyId: 1,
      expenseType: "normal_expense",
      itemName: "Conference USD",
      expenseDate: new Date(),
      amount: 5475.00,
      currency: "THB",
      foreignCurrency: "USD",
      foreignAmount: 150.00,
      exchangeRate: 36.50,
    });
    expect(result).toHaveProperty("success", true);
  });
});

describe("expenses.update USD THB completion", () => {
  beforeEach(async () => {
    const db = await import("./db");
    vi.mocked(db.getExpenseById).mockResolvedValue({
      id: 42,
      userId: 1,
      status: "draft",
      expenseType: "normal_expense",
      itemName: "Hotel USD",
      amount: "0",
      currency: "THB",
      foreignCurrency: "USD",
      foreignAmount: "150.00",
      exchangeRate: null,
      iouNumber: null,
      companyId: 1,
      expenseDate: new Date(),
    });
    vi.mocked(db.updateExpense).mockResolvedValue(undefined);
  });

  it("updates THB amount for USD expense", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.expenses.update({
      id: 42,
      amount: 5475.00,
      exchangeRate: 36.50,
    });
    expect(result).toHaveProperty("success", true);
  });

  it("throws error when updating reimbursed USD expense", async () => {
    const db = await import("./db");
    vi.mocked(db.getExpenseById).mockResolvedValue({
      id: 42,
      userId: 1,
      status: "reimbursed",
      expenseType: "normal_expense",
      itemName: "Hotel USD",
      amount: "5475.00",
      currency: "THB",
      foreignCurrency: "USD",
      foreignAmount: "150.00",
      exchangeRate: "36.50",
      iouNumber: null,
      companyId: 1,
      expenseDate: new Date(),
    });
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.expenses.update({ id: 42, amount: 5500.00 })
    ).rejects.toThrow();
  });
});

describe("expenses.markClaimed — custom claimDate", () => {
  beforeEach(async () => {
    const db = await import("./db");
    vi.mocked(db.getExpenseById).mockResolvedValue({
      id: 20,
      userId: 1,
      status: "draft",
      expenseType: "normal_expense",
      itemName: "Office Supplies",
      amount: "500",
      currency: "THB",
      foreignCurrency: null,
      foreignAmount: null,
      exchangeRate: null,
      iouNumber: null,
      companyId: 1,
      expenseDate: new Date(),
      categoryId: null,
      paymentMethodId: null,
    });
    vi.mocked(db.updateExpense).mockClear();
    vi.mocked(db.updateExpense).mockResolvedValue(undefined);
    vi.mocked(db.createHistoryLog).mockResolvedValue(undefined);
  });

  it("ใช้วันที่ที่ระบุเมื่อส่ง claimDate", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const customDate = new Date("2026-06-01T00:00:00.000Z");
    const result = await caller.expenses.markClaimed({ id: 20, claimDate: customDate });
    expect(result).toHaveProperty("success", true);
    const db = await import("./db");
    expect(vi.mocked(db.updateExpense)).toHaveBeenCalledWith(
      20,
      expect.objectContaining({ status: "claimed", claimDate: customDate })
    );
  });

  it("ใช้วันปัจจุบันเมื่อไม่ระบุ claimDate", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const before = new Date();
    const result = await caller.expenses.markClaimed({ id: 20 });
    const after = new Date();
    expect(result).toHaveProperty("success", true);
    const db = await import("./db");
    const callArg = vi.mocked(db.updateExpense).mock.calls[0][1] as any;
    expect(callArg.status).toBe("claimed");
    expect(callArg.claimDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(callArg.claimDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("ไม่อนุญาตเปลี่ยนสถานะจาก claimed เป็น claimed", async () => {
    const db = await import("./db");
    vi.mocked(db.getExpenseById).mockResolvedValueOnce({
      id: 20,
      userId: 1,
      status: "claimed",
      expenseType: "normal_expense",
      itemName: "Office Supplies",
      amount: "500",
      currency: "THB",
      foreignCurrency: null,
      foreignAmount: null,
      exchangeRate: null,
      iouNumber: null,
      companyId: 1,
      expenseDate: new Date(),
    });
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.expenses.markClaimed({ id: 20, claimDate: new Date() })
    ).rejects.toThrow();
  });
});

describe("expenses.update — categoryId/paymentMethodId null handling", () => {
  beforeEach(async () => {
    const db = await import("./db");
    vi.mocked(db.getExpenseById).mockResolvedValue({
      id: 10,
      userId: 1,
      status: "claimed", // expense ที่ทำเบิกแล้ว
      expenseType: "normal_expense",
      itemName: "Office Supplies",
      amount: "500",
      currency: "THB",
      foreignCurrency: null,
      foreignAmount: null,
      exchangeRate: null,
      iouNumber: null,
      companyId: 1,
      expenseDate: new Date(),
      categoryId: 2,
      paymentMethodId: 3,
      description: "some desc",
      vendorName: null,
      iouDate: null,
      iouAmount: null,
      iouNote: null,
      note: null,
    });
    vi.mocked(db.updateExpense).mockResolvedValue(undefined);
    vi.mocked(db.createHistoryLog).mockResolvedValue(undefined);
  });

  it("เปลี่ยน categoryId จาก 2 เป็น 5 ใน expense ที่ claimed", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.expenses.update({ id: 10, categoryId: 5 });
    expect(result).toHaveProperty("success", true);
    const db = await import("./db");
    expect(vi.mocked(db.updateExpense)).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ categoryId: 5 })
    );
  });

  it("เปลี่ยน paymentMethodId เป็น null (ไม่ระบุ) ใน expense ที่ claimed", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.expenses.update({ id: 10, paymentMethodId: null });
    expect(result).toHaveProperty("success", true);
    const db = await import("./db");
    expect(vi.mocked(db.updateExpense)).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ paymentMethodId: null })
    );
  });

  it("ไม่อัปเดตเมื่อไม่มีการเปลี่ยนแปลง", async () => {
    const db = await import("./db");
    vi.mocked(db.updateExpense).mockClear(); // reset call count before this test
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.expenses.update({ id: 10, categoryId: 2, paymentMethodId: 3 });
    expect(result).toHaveProperty("success", true);
    // updateExpense ไม่ควรถูกเรียกเพราะไม่มีอะไรเปลี่ยน
    expect(vi.mocked(db.updateExpense)).not.toHaveBeenCalled();
  });

  it("ไม่อนุญาตแก้ไข expense ที่ reimbursed", async () => {
    const db = await import("./db");
    vi.mocked(db.getExpenseById).mockResolvedValueOnce({
      id: 10,
      userId: 1,
      status: "reimbursed",
      expenseType: "normal_expense",
      itemName: "Office Supplies",
      amount: "500",
      currency: "THB",
      foreignCurrency: null,
      foreignAmount: null,
      exchangeRate: null,
      iouNumber: null,
      companyId: 1,
      expenseDate: new Date(),
      categoryId: 2,
      paymentMethodId: 3,
    });
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.expenses.update({ id: 10, categoryId: 5 })
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
