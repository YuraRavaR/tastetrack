ALTER TABLE `lists` ADD `name` text;--> statement-breakpoint
ALTER TABLE `lists` ADD `name_key` text;--> statement-breakpoint
ALTER TABLE `lists` ADD `description` text;--> statement-breakpoint
ALTER TABLE `lists` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `lists_name_unique` ON `lists` (`user_id`,`name_key`);