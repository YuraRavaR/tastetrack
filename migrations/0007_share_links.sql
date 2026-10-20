CREATE TABLE `share_links` (
	`token` text PRIMARY KEY NOT NULL,
	`list_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_list_id_unique` ON `share_links` (`list_id`);