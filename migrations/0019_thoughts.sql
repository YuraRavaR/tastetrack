-- Thoughts: a User's dated notes and quotes on a Media Item. Expand only (ADR-0009): a new table
-- that the release before never reads.

CREATE TABLE `thoughts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`media_item_id` integer NOT NULL,
	`text` text NOT NULL,
	`date` text NOT NULL,
	`quote` integer DEFAULT false NOT NULL,
	`progress` text,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `thoughts_user_media_item_idx` ON `thoughts` (`user_id`,`media_item_id`);