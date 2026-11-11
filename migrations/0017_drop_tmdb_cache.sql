-- The contract half of the shared catalog cache (ADR-0009): catalog_cache replaced tmdb_cache in
-- migration 0013, and the release before this one no longer reads it. No foreign key references
-- it, so dropping it cascades nothing.
DROP TABLE `tmdb_cache`;
