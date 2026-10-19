CREATE TABLE `invite_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`issuer_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`issuer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invite_codes_issuer_id_idx` ON `invite_codes` (`issuer_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `invited_by` integer REFERENCES users(id) ON DELETE set null;