-- In Progress: what a User has started and not finished. Expand only (ADR-0009): a new table that
-- the release before never reads.

CREATE TABLE `in_progress` (
	`user_id` integer NOT NULL,
	`media_item_id` integer NOT NULL,
	`start_date` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `media_item_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `in_progress_media_item_id_idx` ON `in_progress` (`media_item_id`);