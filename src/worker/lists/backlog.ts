// The Backlog: the system List of the Media Items a User plans to experience, one per Media Type,
// made with the account. Route handlers only translate HTTP to these calls.
import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { listItems, lists, mediaItems, users } from "../../db/schema";

import type { Backlog, ListItem, MediaType, PlanRequest } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import { listIndex, listOrder, move, ownListItem, selectListItems, toListItem } from "./list-items";

// Makes the film Backlog of the User that `user` picks out, for the batch that creates the User,
// so no User ever exists without one. A Backlog the User already has is left as it is.
export function createBacklog(db: DrizzleD1Database, user: SQL) {
  return db
    .insert(lists)
    .select(
      // Insert-select lists every column in table order; a null id takes the next one.
      db
        .select({
          id: sql<number>`null`.as("id"),
          userId: users.id,
          kind: sql<"backlog">`'backlog'`.as("kind"),
          mediaType: sql<"film">`'film'`.as("media_type"),
          createdAt: users.createdAt,
        })
        .from(users)
        .where(user),
    )
    .onConflictDoNothing();
}

function backlogOf(userId: number, mediaType: MediaType) {
  return and(eq(lists.userId, userId), eq(lists.kind, "backlog"), eq(lists.mediaType, mediaType));
}

// The User's Backlog of the Media Type, in order, in two queries however long it is.
export async function userBacklog(
  db: DrizzleD1Database,
  userId: number,
  mediaType: MediaType,
): Promise<Backlog> {
  const own = backlogOf(userId, mediaType);
  const [[backlog], rows] = await Promise.all([
    db.select({ id: lists.id }).from(lists).where(own),
    selectListItems(db)
      .where(own)
      .orderBy(...listOrder),
  ]);
  if (!backlog) throw new Error(`User ${userId} has no ${mediaType} Backlog`);
  return { id: backlog.id, mediaType, items: rows.map(toListItem) };
}

export type Planned =
  | { ok: true; listItem: ListItem; created: boolean }
  | { ok: false; error: "unknown_media_item" | "backlog_full" };

// Marks a Media Item Planned: adds it to the User's Backlog of its Media Type, at `position` when
// given and at the end otherwise, with its Note. A Media Item already there keeps its place and
// Note; `created` is false then. Planning a Media Item back where logging took it from, with its
// Note, undoes that. A Backlog holds at most `maxListItems`.
export async function plan(
  db: DrizzleD1Database,
  userId: number,
  request: PlanRequest,
  now: Date,
): Promise<Planned> {
  const [found] = await db
    .select({ backlogId: lists.id })
    .from(mediaItems)
    .leftJoin(
      lists,
      and(
        eq(lists.userId, userId),
        eq(lists.kind, "backlog"),
        eq(lists.mediaType, mediaItems.mediaType),
      ),
    )
    .where(eq(mediaItems.id, request.mediaItemId));
  if (!found) return { ok: false, error: "unknown_media_item" };
  const { backlogId } = found;
  if (backlogId === null)
    throw new Error(`User ${userId} has no Backlog for ${request.mediaItemId}`);

  // The item is inserted only while the Backlog has room, and only once.
  const itemCount = sql`(select count(*) from ${listItems} where list_id = ${backlogId})`;
  const nextPosition = sql`(
    select coalesce(max(position), -1) + 1 from ${listItems} where list_id = ${backlogId}
  )`;
  const [inserted, [existing]] = await db.batch([
    db
      .insert(listItems)
      .select(
        // Insert-select lists every column in table order; a null id takes the next one.
        db
          .select({
            id: sql<number>`null`.as("id"),
            listId: lists.id,
            mediaItemId: sql<number>`${request.mediaItemId}`.as("media_item_id"),
            position: sql<number>`${nextPosition}`.as("position"),
            note: sql<string | null>`${request.note?.trim() || null}`.as("note"),
            createdAt: sql<number>`${now.getTime()}`.as("created_at"),
          })
          .from(lists)
          .where(and(eq(lists.id, backlogId), sql`${itemCount} < ${maxListItems}`)),
      )
      .onConflictDoNothing()
      .returning({ id: listItems.id }),
    db
      .select({ id: listItems.id })
      .from(listItems)
      .where(and(eq(listItems.listId, backlogId), eq(listItems.mediaItemId, request.mediaItemId))),
  ]);
  const [created] = inserted;
  if (!created && !existing) return { ok: false, error: "backlog_full" };
  if (created && request.position !== undefined) {
    await move(db, backlogId, created.id, request.position);
  }
  const id = created?.id ?? existing?.id;
  const listItem = id === undefined ? null : await ownListItem(db, userId, id);
  if (!listItem) throw new Error(`Planning ${request.mediaItemId} inserted nothing`);
  return { ok: true, listItem, created: created !== undefined };
}

// Which of these External Source ids of one Media Type are in the User's Backlog.
export async function plannedExternalIds(
  db: DrizzleD1Database,
  userId: number,
  source: "tmdb",
  mediaType: MediaType,
  externalIds: string[],
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await db
    .select({ externalId: mediaItems.externalId })
    .from(listItems)
    .innerJoin(lists, eq(listItems.listId, lists.id))
    .innerJoin(mediaItems, eq(listItems.mediaItemId, mediaItems.id))
    .where(
      and(
        backlogOf(userId, mediaType),
        eq(mediaItems.externalSource, source),
        inArray(mediaItems.externalId, externalIds),
      ),
    );
  return new Set(rows.flatMap((row) => (row.externalId === null ? [] : [row.externalId])));
}

function userBacklogs(db: DrizzleD1Database, userId: number) {
  return db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.userId, userId), eq(lists.kind, "backlog")));
}

// Takes a Media Item off the User's Backlog, for the batch that logs it: the first statement reads
// where it was and its Note, so that planning it back there can undo this; the second removes it.
export function takeOffBacklog(db: DrizzleD1Database, userId: number, mediaItemId: number) {
  const inBacklog = and(
    inArray(listItems.listId, userBacklogs(db, userId)),
    eq(listItems.mediaItemId, mediaItemId),
  );
  return [
    db.select({ position: listIndex, note: listItems.note }).from(listItems).where(inBacklog),
    db.delete(listItems).where(inBacklog),
  ] as const;
}

// For the test hooks only: plans `count` placeholder films, which have no metadata, for the User
// with the Username, so a test can reach the limit without adding that many films. False for an
// unknown Username.
export async function fillBacklog(
  db: DrizzleD1Database,
  username: string,
  count: number,
  now: Date,
): Promise<boolean> {
  const [backlog] = await db
    .select({ id: lists.id })
    .from(lists)
    .innerJoin(users, eq(lists.userId, users.id))
    .where(
      and(
        sql`lower(${users.username}) = lower(${username})`,
        eq(lists.kind, "backlog"),
        eq(lists.mediaType, "film"),
      ),
    );
  if (!backlog) return false;
  // The placeholders' ids share a prefix, so the index on External References finds them.
  const prefix = `test-fill-${crypto.randomUUID()}-`;
  await db.run(sql`
    insert into media_items (media_type, external_source, external_id, created_at)
    with recursive n(i) as (select 1 union all select i + 1 from n where i < ${count})
    select 'film', 'tmdb', ${prefix} || i, ${now.getTime()} from n`);
  await db.run(sql`
    insert into list_items (list_id, media_item_id, position, note, created_at)
    select ${backlog.id}, id,
      (select coalesce(max(position), -1) from list_items where list_id = ${backlog.id})
        + row_number() over (order by id),
      null, ${now.getTime()}
    from media_items
    where external_source = 'tmdb' and media_type = 'film'
      and external_id > ${prefix} and external_id < ${`${prefix}~`}`);
  return true;
}
