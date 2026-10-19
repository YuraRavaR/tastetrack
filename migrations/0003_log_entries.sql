CREATE TABLE `log_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`media_item_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`date` text,
	`review` text,
	`revisit` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "log_entries_rating_range" CHECK("log_entries"."rating" between 1 and 10)
);
--> statement-breakpoint
CREATE INDEX `log_entries_user_media_item_idx` ON `log_entries` (`user_id`,`media_item_id`);--> statement-breakpoint
CREATE TABLE `media_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_type` text NOT NULL,
	`external_source` text,
	`external_id` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "media_items_external_reference_whole" CHECK(("media_items"."external_source" is null) = ("media_items"."external_id" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_items_external_reference_unique` ON `media_items` (`external_source`,`media_type`,`external_id`);--> statement-breakpoint
CREATE TABLE `tmdb_cache` (
	`media_type` text NOT NULL,
	`external_id` text NOT NULL,
	`english_title` text,
	`ukrainian_title` text,
	`original_title` text NOT NULL,
	`year` integer,
	`poster_path` text,
	`runtime` integer,
	`genres` text,
	`updated_at` integer NOT NULL,
	`detailed_at` integer,
	PRIMARY KEY(`media_type`, `external_id`)
);
