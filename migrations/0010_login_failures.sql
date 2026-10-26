CREATE TABLE `login_failures` (
	`username_key` text NOT NULL,
	`ip` text NOT NULL,
	`failures` integer NOT NULL,
	`last_failed_at` integer NOT NULL,
	PRIMARY KEY(`username_key`, `ip`)
);
--> statement-breakpoint
CREATE INDEX `login_failures_last_failed_at_idx` ON `login_failures` (`last_failed_at`);