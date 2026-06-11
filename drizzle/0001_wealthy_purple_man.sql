CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(128) NOT NULL,
	`entityType` varchar(64),
	`entityId` int,
	`oldValue` text,
	`newValue` text,
	`ipAddress` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyCode` varchar(32) NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`companyLegalName` varchar(255),
	`taxId` varchar(32),
	`branchName` varchar(128),
	`address` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_companyCode_unique` UNIQUE(`companyCode`)
);
--> statement-breakpoint
CREATE TABLE `expense_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`attachmentType` enum('expense_proof','reimbursement_proof','iou_document') NOT NULL,
	`fileNameOriginal` varchar(512) NOT NULL,
	`fileNameStored` varchar(512) NOT NULL,
	`filePath` varchar(1024) NOT NULL,
	`fileStorageKey` varchar(1024),
	`fileType` varchar(64) NOT NULL,
	`fileSize` bigint NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expense_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryName` varchar(128) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expense_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expense_history_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int NOT NULL,
	`actionType` enum('created','updated','status_changed','attachment_uploaded','attachment_deleted','reimbursement_proof_uploaded','iou_document_uploaded','reverted_status','admin_corrected') NOT NULL,
	`fieldName` varchar(128),
	`oldValue` text,
	`newValue` text,
	`attachmentId` int,
	`attachmentFileNameOriginal` varchar(512),
	`attachmentFileNameStored` varchar(512),
	`attachmentType` varchar(64),
	`oldStatus` varchar(32),
	`newStatus` varchar(32),
	`performedBy` int NOT NULL,
	`performedAt` timestamp NOT NULL DEFAULT (now()),
	`note` text,
	`ipAddress` varchar(64),
	`userAgent` text,
	CONSTRAINT `expense_history_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expense_number_seq` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`lastSeq` int NOT NULL DEFAULT 0,
	CONSTRAINT `expense_number_seq_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseNo` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`companyId` int NOT NULL,
	`expenseType` enum('normal_expense','iou_advance') NOT NULL DEFAULT 'normal_expense',
	`itemName` varchar(255) NOT NULL,
	`expenseDate` timestamp NOT NULL,
	`categoryId` int,
	`description` text,
	`amount` decimal(15,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'THB',
	`paymentMethodId` int,
	`vendorName` varchar(255),
	`iouNumber` varchar(64),
	`iouDate` timestamp,
	`iouAmount` decimal(15,2),
	`iouNote` text,
	`status` enum('draft','claimed','reimbursed') NOT NULL DEFAULT 'draft',
	`claimDate` timestamp,
	`reimbursedDate` timestamp,
	`reimbursedAmount` decimal(15,2),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `expenses_expenseNo_unique` UNIQUE(`expenseNo`)
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`methodName` varchar(128) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `loginMethod` varchar(64) DEFAULT 'password';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','viewer') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_attachments` ADD CONSTRAINT `expense_attachments_expenseId_expenses_id_fk` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_attachments` ADD CONSTRAINT `expense_attachments_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_history_logs` ADD CONSTRAINT `expense_history_logs_expenseId_expenses_id_fk` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_history_logs` ADD CONSTRAINT `expense_history_logs_performedBy_users_id_fk` FOREIGN KEY (`performedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_categoryId_expense_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `expense_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_paymentMethodId_payment_methods_id_fk` FOREIGN KEY (`paymentMethodId`) REFERENCES `payment_methods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_userId` ON `audit_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_audit_createdAt` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_attachments_expenseId` ON `expense_attachments` (`expenseId`);--> statement-breakpoint
CREATE INDEX `idx_attachments_type` ON `expense_attachments` (`attachmentType`);--> statement-breakpoint
CREATE INDEX `idx_history_expenseId` ON `expense_history_logs` (`expenseId`);--> statement-breakpoint
CREATE INDEX `idx_history_performedAt` ON `expense_history_logs` (`performedAt`);--> statement-breakpoint
CREATE INDEX `idx_expenses_userId` ON `expenses` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_expenses_status` ON `expenses` (`status`);--> statement-breakpoint
CREATE INDEX `idx_expenses_companyId` ON `expenses` (`companyId`);--> statement-breakpoint
CREATE INDEX `idx_expenses_expenseDate` ON `expenses` (`expenseDate`);