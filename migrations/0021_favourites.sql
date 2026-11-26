-- Favourites: a second kind of system List, of the Media Items a User Likes, at most one per User
-- per Media Type (ADR-0005). Expand only (ADR-0009): the kind is new text in an existing column,
-- which the release before reads only as 'backlog' or 'list'.

CREATE UNIQUE INDEX `lists_favourites_unique` ON `lists` (`user_id`,`media_type`) WHERE "lists"."kind" = 'favourites';
