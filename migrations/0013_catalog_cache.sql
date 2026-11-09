-- The shared catalog cache, filled with every TMDB cache row, whose backdrop, runtime and genres
-- go in extra. tmdb_cache is left as it is, for rolling back one release (ADR-0009).
CREATE TABLE `catalog_cache` (
	`external_source` text NOT NULL,
	`media_type` text NOT NULL,
	`external_id` text NOT NULL,
	`english_title` text,
	`ukrainian_title` text,
	`original_title` text NOT NULL,
	`year` integer,
	`cover_ref` text,
	`extra` text NOT NULL,
	`updated_at` integer NOT NULL,
	`detailed_at` integer,
	`checked_at` integer,
	PRIMARY KEY(`external_source`, `media_type`, `external_id`)
);
--> statement-breakpoint
INSERT INTO `catalog_cache` (`external_source`, `media_type`, `external_id`, `english_title`,
	`ukrainian_title`, `original_title`, `year`, `cover_ref`, `extra`, `updated_at`, `detailed_at`,
	`checked_at`)
SELECT 'tmdb', `media_type`, `external_id`, `english_title`, `ukrainian_title`, `original_title`,
	`year`, `poster_path`,
	json_object('backdropPath', `backdrop_path`, 'runtime', `runtime`, 'genres', json(`genres`)),
	`updated_at`, `detailed_at`, `checked_at`
FROM `tmdb_cache`;
