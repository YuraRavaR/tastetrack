-- Source tokens: the access token an External Source gives the Worker, IGDB's from Twitch (ADR-0012).
-- Expand only (ADR-0009): a new table that the release before never reads.

CREATE TABLE `source_tokens` (
	`source` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`expires_at` integer NOT NULL
);
