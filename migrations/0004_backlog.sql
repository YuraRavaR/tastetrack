CREATE TABLE `list_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list_id` integer NOT NULL,
	`media_item_id` integer NOT NULL,
	`position` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `list_items_list_media_item_unique` ON `list_items` (`list_id`,`media_item_id`);--> statement-breakpoint
CREATE INDEX `list_items_media_item_id_idx` ON `list_items` (`media_item_id`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`media_type` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lists_user_id_idx` ON `lists` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lists_backlog_unique` ON `lists` (`user_id`,`media_type`) WHERE "lists"."kind" = 'backlog';--> statement-breakpoint
-- Users who registered before the Backlog existed get theirs now, as if made with their account.
INSERT INTO `lists` (`user_id`, `kind`, `media_type`, `created_at`) SELECT `id`, 'backlog', 'film', `created_at` FROM `users`;
