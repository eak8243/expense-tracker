import { and, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  auditLogs,
  companies,
  expenseAttachments,
  expenseCategories,
  expenseHistoryLogs,
  expenseNumberSeq,
  expenses,
  paymentMethods,
  users,
  type InsertAuditLog,
  type InsertExpense,
  type InsertExpenseAttachment,
  type InsertExpenseHistoryLog,
  type InsertUser,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User Helpers ─────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const updateSet: Record<string, unknown> = {};
  if (user.name !== undefined) updateSet.name = user.name;
  if (user.email !== undefined) updateSet.email = user.email;
  if (user.loginMethod !== undefined) updateSet.loginMethod = user.loginMethod;
  if (user.lastSignedIn !== undefined) updateSet.lastSignedIn = user.lastSignedIn;
  if (user.role !== undefined) updateSet.role = user.role;
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(user).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(users.name);
}

export async function createUser(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(users).values(data);
  return result[0];
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set(data).where(eq(users.id, id));
}

// ─── Expense Number Generator ─────────────────────────────────────────────────

export async function generateExpenseNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const year = new Date().getFullYear();

  // Upsert sequence row for this year
  await db
    .insert(expenseNumberSeq)
    .values({ year, lastSeq: 1 })
    .onDuplicateKeyUpdate({ set: { lastSeq: sql`${expenseNumberSeq.lastSeq} + 1` } });

  const row = await db
    .select()
    .from(expenseNumberSeq)
    .where(eq(expenseNumberSeq.year, year))
    .limit(1);

  const seq = row[0]?.lastSeq ?? 1;
  return `EXP-${year}-${String(seq).padStart(6, "0")}`;
}

// ─── Company Helpers ──────────────────────────────────────────────────────────

export async function getActiveCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).where(eq(companies.isActive, true)).orderBy(companies.companyName);
}

export async function getAllCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).orderBy(companies.companyName);
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}

export async function createCompany(data: typeof companies.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(companies).values(data);
}

export async function updateCompany(id: number, data: Partial<typeof companies.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(companies).set(data).where(eq(companies.id, id));
}

// ─── Category Helpers ─────────────────────────────────────────────────────────

export async function getActiveCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenseCategories).where(eq(expenseCategories.isActive, true)).orderBy(expenseCategories.categoryName);
}

export async function getAllCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenseCategories).orderBy(expenseCategories.categoryName);
}

export async function createCategory(data: typeof expenseCategories.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(expenseCategories).values(data);
}

export async function updateCategory(id: number, data: Partial<typeof expenseCategories.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(expenseCategories).set(data).where(eq(expenseCategories.id, id));
}

// ─── Payment Method Helpers ───────────────────────────────────────────────────

export async function getActivePaymentMethods() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true)).orderBy(paymentMethods.methodName);
}

export async function getAllPaymentMethods() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paymentMethods).orderBy(paymentMethods.methodName);
}

export async function createPaymentMethod(data: typeof paymentMethods.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(paymentMethods).values(data);
}

export async function updatePaymentMethod(id: number, data: Partial<typeof paymentMethods.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(paymentMethods).set(data).where(eq(paymentMethods.id, id));
}

// ─── Expense Helpers ──────────────────────────────────────────────────────────

export interface ExpenseFilters {
  userId?: number;
  companyId?: number;
  categoryId?: number;
  status?: string;
  expenseType?: string;
  paymentMethodId?: number;
  iouNumber?: string;
  keyword?: string;
  amountMin?: number;
  amountMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
}

export async function getExpenses(filters: ExpenseFilters) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const conditions = [];
  if (filters.userId) conditions.push(eq(expenses.userId, filters.userId));
  if (filters.companyId) conditions.push(eq(expenses.companyId, filters.companyId));
  if (filters.categoryId) conditions.push(eq(expenses.categoryId, filters.categoryId));
  if (filters.status) conditions.push(eq(expenses.status, filters.status as "draft" | "claimed" | "reimbursed"));
  if (filters.expenseType) conditions.push(eq(expenses.expenseType, filters.expenseType as "normal_expense" | "iou_advance"));
  if (filters.paymentMethodId) conditions.push(eq(expenses.paymentMethodId, filters.paymentMethodId));
  if (filters.iouNumber) conditions.push(like(expenses.iouNumber, `%${filters.iouNumber}%`));
  if (filters.keyword) {
    conditions.push(
      or(
        like(expenses.itemName, `%${filters.keyword}%`),
        like(expenses.description, `%${filters.keyword}%`),
        like(expenses.vendorName, `%${filters.keyword}%`),
        like(expenses.expenseNo, `%${filters.keyword}%`)
      )!
    );
  }
  if (filters.amountMin !== undefined) conditions.push(gte(expenses.amount, String(filters.amountMin)));
  if (filters.amountMax !== undefined) conditions.push(lte(expenses.amount, String(filters.amountMax)));
  if (filters.dateFrom) conditions.push(gte(expenses.expenseDate, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(expenses.expenseDate, filters.dateTo));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: expenses.id,
        expenseNo: expenses.expenseNo,
        userId: expenses.userId,
        userName: users.name,
        companyId: expenses.companyId,
        companyName: companies.companyName,
        expenseType: expenses.expenseType,
        itemName: expenses.itemName,
        expenseDate: expenses.expenseDate,
        categoryId: expenses.categoryId,
        categoryName: expenseCategories.categoryName,
        amount: expenses.amount,
        currency: expenses.currency,
        status: expenses.status,
        claimDate: expenses.claimDate,
        reimbursedDate: expenses.reimbursedDate,
        reimbursedAmount: expenses.reimbursedAmount,
        iouNumber: expenses.iouNumber,
        vendorName: expenses.vendorName,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
      })
      .from(expenses)
      .leftJoin(users, eq(expenses.userId, users.id))
      .leftJoin(companies, eq(expenses.companyId, companies.id))
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(where)
      .orderBy(desc(expenses.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(expenses).where(where),
  ]);

  return { data, total: Number(countResult[0]?.count ?? 0) };
}

export async function getExpenseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      id: expenses.id,
      expenseNo: expenses.expenseNo,
      userId: expenses.userId,
      userName: users.name,
      companyId: expenses.companyId,
      companyName: companies.companyName,
      companyCode: companies.companyCode,
      expenseType: expenses.expenseType,
      itemName: expenses.itemName,
      expenseDate: expenses.expenseDate,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.categoryName,
      description: expenses.description,
      amount: expenses.amount,
      currency: expenses.currency,
      paymentMethodId: expenses.paymentMethodId,
      paymentMethodName: paymentMethods.methodName,
      vendorName: expenses.vendorName,
      iouNumber: expenses.iouNumber,
      iouDate: expenses.iouDate,
      iouAmount: expenses.iouAmount,
      iouNote: expenses.iouNote,
      status: expenses.status,
      claimDate: expenses.claimDate,
      reimbursedDate: expenses.reimbursedDate,
      reimbursedAmount: expenses.reimbursedAmount,
      note: expenses.note,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .leftJoin(users, eq(expenses.userId, users.id))
    .leftJoin(companies, eq(expenses.companyId, companies.id))
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .leftJoin(paymentMethods, eq(expenses.paymentMethodId, paymentMethods.id))
    .where(eq(expenses.id, id))
    .limit(1);
  return result[0];
}

export async function createExpense(data: InsertExpense) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(expenses).values(data);
  return result[0];
}

export async function updateExpense(id: number, data: Partial<InsertExpense>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(expenses).set(data).where(eq(expenses.id, id));
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(expenses).where(eq(expenses.id, id));
}

// ─── Attachment Helpers ───────────────────────────────────────────────────────

export async function getAttachmentsByExpenseId(expenseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(expenseAttachments)
    .where(eq(expenseAttachments.expenseId, expenseId))
    .orderBy(expenseAttachments.uploadedAt);
}

export async function getAttachmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(expenseAttachments).where(eq(expenseAttachments.id, id)).limit(1);
  return result[0];
}

export async function createAttachment(data: InsertExpenseAttachment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(expenseAttachments).values(data);
  return result[0];
}

export async function deleteAttachment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(expenseAttachments).where(eq(expenseAttachments.id, id));
}

export async function countAttachmentsByType(expenseId: number, attachmentType: string) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(expenseAttachments)
    .where(
      and(
        eq(expenseAttachments.expenseId, expenseId),
        eq(expenseAttachments.attachmentType, attachmentType as "expense_proof" | "reimbursement_proof" | "iou_document")
      )
    );
  return Number(result[0]?.count ?? 0);
}

// ─── History Log Helpers ──────────────────────────────────────────────────────

export async function getHistoryByExpenseId(expenseId: number, order: "asc" | "desc" = "desc") {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: expenseHistoryLogs.id,
      expenseId: expenseHistoryLogs.expenseId,
      actionType: expenseHistoryLogs.actionType,
      fieldName: expenseHistoryLogs.fieldName,
      oldValue: expenseHistoryLogs.oldValue,
      newValue: expenseHistoryLogs.newValue,
      attachmentId: expenseHistoryLogs.attachmentId,
      attachmentFileNameOriginal: expenseHistoryLogs.attachmentFileNameOriginal,
      attachmentType: expenseHistoryLogs.attachmentType,
      oldStatus: expenseHistoryLogs.oldStatus,
      newStatus: expenseHistoryLogs.newStatus,
      performedBy: expenseHistoryLogs.performedBy,
      performedByName: users.name,
      performedAt: expenseHistoryLogs.performedAt,
      note: expenseHistoryLogs.note,
    })
    .from(expenseHistoryLogs)
    .leftJoin(users, eq(expenseHistoryLogs.performedBy, users.id))
    .where(eq(expenseHistoryLogs.expenseId, expenseId))
    .orderBy(order === "desc" ? desc(expenseHistoryLogs.performedAt) : expenseHistoryLogs.performedAt);
  return rows;
}

export async function createHistoryLog(data: InsertExpenseHistoryLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(expenseHistoryLogs).values(data);
}

// ─── Audit Log Helpers ────────────────────────────────────────────────────────

export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

// ─── Dashboard Helpers ────────────────────────────────────────────────────────

export async function getUserDashboardSummary(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [summary] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      draftAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.status} = 'draft' THEN ${expenses.amount} ELSE 0 END), 0)`,
      claimedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.status} = 'claimed' THEN ${expenses.amount} ELSE 0 END), 0)`,
      reimbursedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.status} = 'reimbursed' THEN ${expenses.amount} ELSE 0 END), 0)`,
      draftCount: sql<number>`SUM(CASE WHEN ${expenses.status} = 'draft' THEN 1 ELSE 0 END)`,
      claimedCount: sql<number>`SUM(CASE WHEN ${expenses.status} = 'claimed' THEN 1 ELSE 0 END)`,
      reimbursedCount: sql<number>`SUM(CASE WHEN ${expenses.status} = 'reimbursed' THEN 1 ELSE 0 END)`,
      iouTotalAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.expenseType} = 'iou_advance' THEN ${expenses.amount} ELSE 0 END), 0)`,
      iouClaimedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.expenseType} = 'iou_advance' AND ${expenses.status} = 'claimed' THEN ${expenses.amount} ELSE 0 END), 0)`,
      iouReimbursedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.expenseType} = 'iou_advance' AND ${expenses.status} = 'reimbursed' THEN ${expenses.amount} ELSE 0 END), 0)`,
    })
    .from(expenses)
    .where(eq(expenses.userId, userId));

  return summary;
}

export async function getAdminDashboardSummary() {
  const db = await getDb();
  if (!db) return null;

  const [summary] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      draftAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.status} = 'draft' THEN ${expenses.amount} ELSE 0 END), 0)`,
      claimedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.status} = 'claimed' THEN ${expenses.amount} ELSE 0 END), 0)`,
      reimbursedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.status} = 'reimbursed' THEN ${expenses.amount} ELSE 0 END), 0)`,
      totalCount: sql<number>`COUNT(*)`,
      iouTotalAmount: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.expenseType} = 'iou_advance' THEN ${expenses.amount} ELSE 0 END), 0)`,
    })
    .from(expenses);

  return summary;
}

export async function getMonthlyTrend(userId?: number, months = 12) {
  const db = await getDb();
  if (!db) return [];

  // Use raw SQL to avoid ONLY_FULL_GROUP_BY issues with Drizzle's sql template
  const conn = (db as any).session?.client ?? (db as any)._client;
  if (userId) {
    const [rows] = await (db as any).execute(
      sql`SELECT DATE_FORMAT(expenseDate, '%Y-%m') AS month, SUM(amount) AS totalAmount, COUNT(*) AS count FROM expenses WHERE userId = ${userId} GROUP BY month ORDER BY month LIMIT ${months}`
    );
    return rows as { month: string; totalAmount: string; count: number }[];
  } else {
    const [rows] = await (db as any).execute(
      sql`SELECT DATE_FORMAT(expenseDate, '%Y-%m') AS month, SUM(amount) AS totalAmount, COUNT(*) AS count FROM expenses GROUP BY month ORDER BY month LIMIT ${months}`
    );
    return rows as { month: string; totalAmount: string; count: number }[];
  }
}

export async function getExpenseByCompany(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = userId ? [eq(expenses.userId, userId)] : [];
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db
    .select({
      companyId: expenses.companyId,
      companyName: companies.companyName,
      totalAmount: sql<string>`SUM(${expenses.amount})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(expenses)
    .leftJoin(companies, eq(expenses.companyId, companies.id))
    .where(where)
    .groupBy(expenses.companyId, companies.companyName)
    .orderBy(desc(sql`SUM(${expenses.amount})`));
}

export async function getExpenseByCategory(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = userId ? [eq(expenses.userId, userId)] : [];
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db
    .select({
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.categoryName,
      totalAmount: sql<string>`SUM(${expenses.amount})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(where)
    .groupBy(expenses.categoryId, expenseCategories.categoryName)
    .orderBy(desc(sql`SUM(${expenses.amount})`));
}

export async function getExpenseByType(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = userId ? [eq(expenses.userId, userId)] : [];
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db
    .select({
      expenseType: expenses.expenseType,
      totalAmount: sql<string>`SUM(${expenses.amount})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(expenses)
    .where(where)
    .groupBy(expenses.expenseType)
    .orderBy(desc(sql`SUM(${expenses.amount})`));
}

export async function getExpenseByUser() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      userId: expenses.userId,
      userName: users.name,
      totalAmount: sql<string>`SUM(${expenses.amount})`,
      count: sql<number>`COUNT(*)`,
      claimedAmount: sql<string>`SUM(CASE WHEN ${expenses.status} = 'claimed' THEN ${expenses.amount} ELSE 0 END)`,
    })
    .from(expenses)
    .leftJoin(users, eq(expenses.userId, users.id))
    .groupBy(expenses.userId, users.name)
    .orderBy(desc(sql`SUM(${expenses.amount})`));
}

// ─── Export Helpers ───────────────────────────────────────────────────────────

export async function getExpensesForExport(filters: ExpenseFilters) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters.userId) conditions.push(eq(expenses.userId, filters.userId));
  if (filters.companyId) conditions.push(eq(expenses.companyId, filters.companyId));
  if (filters.status) conditions.push(eq(expenses.status, filters.status as "draft" | "claimed" | "reimbursed"));
  if (filters.expenseType) conditions.push(eq(expenses.expenseType, filters.expenseType as "normal_expense" | "iou_advance"));
  if (filters.dateFrom) conditions.push(gte(expenses.expenseDate, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(expenses.expenseDate, filters.dateTo));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: expenses.id,
      expenseNo: expenses.expenseNo,
      userName: users.name,
      companyName: companies.companyName,
      expenseType: expenses.expenseType,
      itemName: expenses.itemName,
      expenseDate: expenses.expenseDate,
      categoryName: expenseCategories.categoryName,
      description: expenses.description,
      amount: expenses.amount,
      currency: expenses.currency,
      paymentMethodName: paymentMethods.methodName,
      vendorName: expenses.vendorName,
      iouNumber: expenses.iouNumber,
      iouDate: expenses.iouDate,
      iouAmount: expenses.iouAmount,
      iouNote: expenses.iouNote,
      status: expenses.status,
      claimDate: expenses.claimDate,
      reimbursedDate: expenses.reimbursedDate,
      reimbursedAmount: expenses.reimbursedAmount,
      note: expenses.note,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .leftJoin(users, eq(expenses.userId, users.id))
    .leftJoin(companies, eq(expenses.companyId, companies.id))
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .leftJoin(paymentMethods, eq(expenses.paymentMethodId, paymentMethods.id))
    .where(where)
    .orderBy(desc(expenses.createdAt));

  // Attach attachment flags
  const expenseIds = rows.map((r) => r.id);
  if (expenseIds.length === 0) return rows.map((r) => ({ ...r, hasExpenseProof: false, hasIouDocument: false, hasReimbursementProof: false }));

  const attachmentCounts = await db
    .select({
      expenseId: expenseAttachments.expenseId,
      attachmentType: expenseAttachments.attachmentType,
      count: sql<number>`count(*)`,
    })
    .from(expenseAttachments)
    .where(inArray(expenseAttachments.expenseId, expenseIds))
    .groupBy(expenseAttachments.expenseId, expenseAttachments.attachmentType);

  const attachmentMap = new Map<string, number>();
  for (const row of attachmentCounts) {
    attachmentMap.set(`${row.expenseId}:${row.attachmentType}`, Number(row.count));
  }

  return rows.map((r) => ({
    ...r,
    hasExpenseProof: (attachmentMap.get(`${r.id}:expense_proof`) ?? 0) > 0,
    hasIouDocument: (attachmentMap.get(`${r.id}:iou_document`) ?? 0) > 0,
    hasReimbursementProof: (attachmentMap.get(`${r.id}:reimbursement_proof`) ?? 0) > 0,
  }));
}

// ─── Recent Expenses ──────────────────────────────────────────────────────────

export async function getRecentExpenses(userId?: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const conditions = userId ? [eq(expenses.userId, userId)] : [];
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db
    .select({
      id: expenses.id,
      expenseNo: expenses.expenseNo,
      itemName: expenses.itemName,
      amount: expenses.amount,
      currency: expenses.currency,
      status: expenses.status,
      expenseDate: expenses.expenseDate,
      companyName: companies.companyName,
      userName: users.name,
    })
    .from(expenses)
    .leftJoin(companies, eq(expenses.companyId, companies.id))
    .leftJoin(users, eq(expenses.userId, users.id))
    .where(where)
    .orderBy(desc(expenses.createdAt))
    .limit(limit);
}
