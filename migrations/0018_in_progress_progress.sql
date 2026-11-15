-- A User's Progress on what they have In Progress, as JSON in its Media Type's shape. Expand only
-- (ADR-0009): null for every row before it, and the release before never reads it.
ALTER TABLE `in_progress` ADD `progress` text;
