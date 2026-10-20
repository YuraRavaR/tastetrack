-- drizzle-kit leaves ON DELETE out of an added column's reference; the cascade is the schema's.
ALTER TABLE `media_items` ADD `owner_id` integer REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `media_items` ADD `title` text;--> statement-breakpoint
ALTER TABLE `media_items` ADD `title_key` text;--> statement-breakpoint
ALTER TABLE `media_items` ADD `original_title` text;--> statement-breakpoint
ALTER TABLE `media_items` ADD `original_title_key` text;--> statement-breakpoint
ALTER TABLE `media_items` ADD `year` integer;--> statement-breakpoint
ALTER TABLE `media_items` ADD `runtime` integer;--> statement-breakpoint
ALTER TABLE `media_items` ADD `genres` text;--> statement-breakpoint
CREATE INDEX `media_items_owner_id_idx` ON `media_items` (`owner_id`);