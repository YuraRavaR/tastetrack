-- A manual book's authors, as JSON. Expand only (ADR-0009): null for every film, and for books
-- added before it.
ALTER TABLE `media_items` ADD `authors` text;
