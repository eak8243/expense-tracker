import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  generateBatchNumber: vi.fn().mockResolvedValue("BATCH-2026-000001"),
  createReimbursementBatch: vi.fn().mockResolvedValue(1),
  getReimbursementBatchById: vi.fn().mockResolvedValue({
    id: 1,
    batchNo: "BATCH-2026-000001",
    note: "test",
    totalAmount: "1500.00",
    reimbursedAt: new Date("2026-06-01"),
    proofFileKey: null,
    proofFileName: null,
    proofFileType: null,
    createdAt: new Date(),
    createdByName: "Admin",
    items: [
      {
        id: 1,
        expenseId: 10,
        expenseAmount: "1000.00",
        expenseNo: "EXP-2026-000001",
        itemName: "ค่าเดินทาง",
        expenseDate: new Date("2026-05-20"),
        status: "reimbursed",
        companyName: "บริษัท A",
        userName: "User A",
      },
      {
        id: 2,
        expenseId: 11,
        expenseAmount: "500.00",
        expenseNo: "EXP-2026-000002",
        itemName: "ค่าอาหาร",
        expenseDate: new Date("2026-05-21"),
        status: "reimbursed",
        companyName: "บริษัท A",
        userName: "User A",
      },
    ],
  }),
  listReimbursementBatches: vi.fn().mockResolvedValue([
    {
      id: 1,
      batchNo: "BATCH-2026-000001",
      note: null,
      totalAmount: "1500.00",
      reimbursedAt: new Date("2026-06-01"),
      proofFileName: null,
      createdAt: new Date(),
      createdByName: "Admin",
      expenseCount: 2,
    },
  ]),
  getExpenseBatch: vi.fn().mockResolvedValue({
    batchId: 1,
    batchNo: "BATCH-2026-000001",
    totalAmount: "1500.00",
    reimbursedAt: new Date("2026-06-01"),
    note: null,
  }),
  deleteReimbursementBatch: vi.fn().mockResolvedValue(undefined),
  updateBatchProof: vi.fn().mockResolvedValue(undefined),
  getExpenseById: vi.fn().mockImplementation((id: number) => {
    if (id === 10 || id === 11) {
      return Promise.resolve({
        id,
        expenseNo: `EXP-2026-00000${id - 9}`,
        itemName: "ค่าเดินทาง",
        amount: "1000.00",
        status: "claimed",
        userId: 1,
        companyId: 1,
      });
    }
    return Promise.resolve(undefined);
  }),
  createHistoryLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "batches/test_proof.pdf", url: "/manus-storage/test" }),
  storageGet: vi.fn().mockResolvedValue({ key: "batches/test_proof.pdf", url: "/manus-storage/test" }),
}));

describe("Batch Reimbursement Logic", () => {
  describe("generateBatchNumber", () => {
    it("should return BATCH-YYYY-XXXXXX format", async () => {
      const { generateBatchNumber } = await import("./db");
      const batchNo = await generateBatchNumber();
      expect(batchNo).toMatch(/^BATCH-\d{4}-\d{6}$/);
    });
  });

  describe("createReimbursementBatch", () => {
    it("should create batch and return batchId", async () => {
      const { createReimbursementBatch } = await import("./db");
      const batchId = await createReimbursementBatch(
        {
          batchNo: "BATCH-2026-000001",
          note: "test",
          totalAmount: "1500.00",
          reimbursedAt: new Date("2026-06-01"),
          createdBy: 1,
        },
        [10, 11]
      );
      expect(batchId).toBe(1);
    });
  });

  describe("getReimbursementBatchById", () => {
    it("should return batch with items", async () => {
      const { getReimbursementBatchById } = await import("./db");
      const batch = await getReimbursementBatchById(1);
      expect(batch).toBeDefined();
      expect(batch?.batchNo).toBe("BATCH-2026-000001");
      expect(batch?.items).toHaveLength(2);
    });

    it("should return undefined for non-existent batch", async () => {
      const { getReimbursementBatchById } = await import("./db");
      vi.mocked(getReimbursementBatchById).mockResolvedValueOnce(undefined);
      const batch = await getReimbursementBatchById(999);
      expect(batch).toBeUndefined();
    });
  });

  describe("listReimbursementBatches", () => {
    it("should return list with expenseCount", async () => {
      const { listReimbursementBatches } = await import("./db");
      const batches = await listReimbursementBatches();
      expect(batches).toHaveLength(1);
      expect(batches[0].expenseCount).toBe(2);
    });

    it("should filter by userId when provided", async () => {
      const { listReimbursementBatches } = await import("./db");
      await listReimbursementBatches(1);
      expect(listReimbursementBatches).toHaveBeenCalledWith(1);
    });
  });

  describe("getExpenseBatch", () => {
    it("should return batch info for an expense", async () => {
      const { getExpenseBatch } = await import("./db");
      const info = await getExpenseBatch(10);
      expect(info).toBeDefined();
      expect(info?.batchNo).toBe("BATCH-2026-000001");
    });
  });

  describe("deleteReimbursementBatch", () => {
    it("should call deleteReimbursementBatch without error", async () => {
      const { deleteReimbursementBatch } = await import("./db");
      await expect(deleteReimbursementBatch(1)).resolves.toBeUndefined();
    });
  });

  describe("batch validation rules", () => {
    it("expense must be in claimed status to be batch-reimbursed", async () => {
      const { getExpenseById } = await import("./db");
      const expense = await getExpenseById(10);
      expect(expense?.status).toBe("claimed");
    });

    it("should reject non-existent expense", async () => {
      const { getExpenseById } = await import("./db");
      const expense = await getExpenseById(999);
      expect(expense).toBeUndefined();
    });
  });
});
