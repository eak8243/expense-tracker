import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  bigint,
  index,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  name: text("name").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "admin", "viewer"]).default("user").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
  // Keep openId for Manus OAuth compatibility
  openId: varchar("openId", { length: 64 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }).default("password"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Companies ───────────────────────────────────────────────────────────────
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  companyCode: varchar("companyCode", { length: 32 }).notNull().unique(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  companyLegalName: varchar("companyLegalName", { length: 255 }),
  taxId: varchar("taxId", { length: 32 }),
  branchName: varchar("branchName", { length: 128 }),
  address: text("address"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─── Expense Categories ───────────────────────────────────────────────────────
export const expenseCategories = mysqlTable("expense_categories", {
  id: int("id").autoincrement().primaryKey(),
  categoryName: varchar("categoryName", { length: 128 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = typeof expenseCategories.$inferInsert;

// ─── Payment Methods ──────────────────────────────────────────────────────────
export const paymentMethods = mysqlTable("payment_methods", {
  id: int("id").autoincrement().primaryKey(),
  methodName: varchar("methodName", { length: 128 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

// ─── Expenses ─────────────────────────────────────────────────────────────────
export const expenses = mysqlTable(
  "expenses",
  {
    id: int("id").autoincrement().primaryKey(),
    expenseNo: varchar("expenseNo", { length: 32 }).notNull().unique(),
    userId: int("userId")
      .notNull()
      .references(() => users.id),
    companyId: int("companyId")
      .notNull()
      .references(() => companies.id),
    expenseType: mysqlEnum("expenseType", ["normal_expense", "iou_advance"])
      .default("normal_expense")
      .notNull(),
    itemName: varchar("itemName", { length: 255 }).notNull(),
    expenseDate: timestamp("expenseDate").notNull(),
    categoryId: int("categoryId").references(() => expenseCategories.id),
    description: text("description"),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).default("THB").notNull(),
    paymentMethodId: int("paymentMethodId").references(() => paymentMethods.id),
    vendorName: varchar("vendorName", { length: 255 }),
    // IOU fields
    iouNumber: varchar("iouNumber", { length: 64 }),
    iouDate: timestamp("iouDate"),
    iouAmount: decimal("iouAmount", { precision: 15, scale: 2 }),
    iouNote: text("iouNote"),
    // Status
    status: mysqlEnum("status", ["draft", "claimed", "reimbursed"])
      .default("draft")
      .notNull(),
    claimDate: timestamp("claimDate"),
    reimbursedDate: timestamp("reimbursedDate"),
    reimbursedAmount: decimal("reimbursedAmount", { precision: 15, scale: 2 }),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_expenses_userId").on(t.userId),
    index("idx_expenses_status").on(t.status),
    index("idx_expenses_companyId").on(t.companyId),
    index("idx_expenses_expenseDate").on(t.expenseDate),
  ]
);

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// ─── Expense Attachments ──────────────────────────────────────────────────────
export const expenseAttachments = mysqlTable(
  "expense_attachments",
  {
    id: int("id").autoincrement().primaryKey(),
    expenseId: int("expenseId")
      .notNull()
      .references(() => expenses.id),
    uploadedBy: int("uploadedBy")
      .notNull()
      .references(() => users.id),
    attachmentType: mysqlEnum("attachmentType", [
      "expense_proof",
      "reimbursement_proof",
      "iou_document",
    ]).notNull(),
    fileNameOriginal: varchar("fileNameOriginal", { length: 512 }).notNull(),
    fileNameStored: varchar("fileNameStored", { length: 512 }).notNull(),
    filePath: varchar("filePath", { length: 1024 }).notNull(),
    fileStorageKey: varchar("fileStorageKey", { length: 1024 }),
    fileType: varchar("fileType", { length: 64 }).notNull(),
    fileSize: bigint("fileSize", { mode: "number" }).notNull(),
    uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_attachments_expenseId").on(t.expenseId),
    index("idx_attachments_type").on(t.attachmentType),
  ]
);

export type ExpenseAttachment = typeof expenseAttachments.$inferSelect;
export type InsertExpenseAttachment = typeof expenseAttachments.$inferInsert;

// ─── Expense History Logs ─────────────────────────────────────────────────────
export const expenseHistoryLogs = mysqlTable(
  "expense_history_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    expenseId: int("expenseId")
      .notNull()
      .references(() => expenses.id),
    actionType: mysqlEnum("actionType", [
      "created",
      "updated",
      "status_changed",
      "attachment_uploaded",
      "attachment_deleted",
      "reimbursement_proof_uploaded",
      "iou_document_uploaded",
      "reverted_status",
      "admin_corrected",
    ]).notNull(),
    fieldName: varchar("fieldName", { length: 128 }),
    oldValue: text("oldValue"),
    newValue: text("newValue"),
    attachmentId: int("attachmentId"),
    attachmentFileNameOriginal: varchar("attachmentFileNameOriginal", { length: 512 }),
    attachmentFileNameStored: varchar("attachmentFileNameStored", { length: 512 }),
    attachmentType: varchar("attachmentType", { length: 64 }),
    oldStatus: varchar("oldStatus", { length: 32 }),
    newStatus: varchar("newStatus", { length: 32 }),
    performedBy: int("performedBy")
      .notNull()
      .references(() => users.id),
    performedAt: timestamp("performedAt").defaultNow().notNull(),
    note: text("note"),
    ipAddress: varchar("ipAddress", { length: 64 }),
    userAgent: text("userAgent"),
  },
  (t) => [
    index("idx_history_expenseId").on(t.expenseId),
    index("idx_history_performedAt").on(t.performedAt),
  ]
);

export type ExpenseHistoryLog = typeof expenseHistoryLogs.$inferSelect;
export type InsertExpenseHistoryLog = typeof expenseHistoryLogs.$inferInsert;

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entityType", { length: 64 }),
    entityId: int("entityId"),
    oldValue: text("oldValue"),
    newValue: text("newValue"),
    ipAddress: varchar("ipAddress", { length: 64 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_audit_userId").on(t.userId),
    index("idx_audit_createdAt").on(t.createdAt),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Expense Number Sequence ──────────────────────────────────────────────────
export const expenseNumberSeq = mysqlTable("expense_number_seq", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull(),
  lastSeq: int("lastSeq").default(0).notNull(),
});

// ─── System Settings (key-value store for app config) ────────────────────────
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 128 }).notNull().unique(),
  settingValue: text("settingValue"),
  isEncrypted: boolean("isEncrypted").default(false).notNull(),
  description: varchar("description", { length: 255 }),
  updatedBy: int("updatedBy").references(() => users.id),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;
