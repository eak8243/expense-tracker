ALTER TABLE `expenses` ADD `foreignCurrency` varchar(8);--> statement-breakpoint
ALTER TABLE `expenses` ADD `foreignAmount` decimal(15,2);--> statement-breakpoint
ALTER TABLE `expenses` ADD `exchangeRate` decimal(15,6);