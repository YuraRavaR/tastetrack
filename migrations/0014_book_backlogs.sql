-- Every User gets a Backlog of books, as if made with their account, as 0004 did for films. Users
-- who register from now on get theirs with the account.
INSERT OR IGNORE INTO `lists` (`user_id`, `kind`, `media_type`, `visibility`, `created_at`)
SELECT `id`, 'backlog', 'book', 'private', `created_at` FROM `users`;
