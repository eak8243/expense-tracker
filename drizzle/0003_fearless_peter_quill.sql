CREATE TABLE `expense_batch_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`expenseId` int NOT NULL,
	`expenseAmount` decimal(15,2) NOT NULL,
	CONSTRAINT `expense_batch_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reimbursement_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchNo` varchar(32) NOT NULL,
	`note` text,
	`totalAmount` decimal(15,2) NOT NULL,
	`reimbursedAt` timestamp NOT NULL,
	`proofFileKey` varchar(1024),
	`proofFileName` varchar(512),
	`proofFileType` varchar(64),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reimbursement_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `reimbursement_batches_batchNo_unique` UNIQUE(`batchNo`)
);
--> statement-breakpoint
ALTER TABLE `expense_batch_items` ADD CONSTRAINT `expense_batch_items_batchId_reimbursement_batches_id_fk` FOREIGN KEY (`batchId`) REFERENCES `reimbursement_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_batch_items` ADD CONSTRAINT `expense_batch_items_expenseId_expenses_id_fk` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reimbursement_batches` ADD CONSTRAINT `reimbursement_batches_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_batch_items_batchId` ON `expense_batch_items` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_batch_items_expenseId` ON `expense_batch_items` (`expenseId`);--> statement-breakpoint
CREATE INDEX `idx_batches_createdBy` ON `reimbursement_batches` (`createdBy`);--> statement-breakpoint
CREATE INDEX `idx_batches_reimbursedAt` ON `reimbursement_batches` (`reimbursedAt`);