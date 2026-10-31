// Manual Media Items: works the External Source doesn't have, which a User adds by hand and alone
// can see. Route handlers only translate HTTP to these calls; the rules for the values are the
// domain core's (src/shared/catalog.ts).
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { listItems, lists, logEntries, mediaItems, tmdbCache, users } from "../../db/schema";
import type {
  ManualMediaItemEditRequest,
  ManualMediaItemResponse,
  ManualSearchResult,
  MediaItem,
  MediaType,
  NewManualMediaItem,
} from "../../shared/api";
import { latestFilmYear, maxManualMediaItems, maxManualSearchResults } from "../../shared/catalog";
import { textKey } from "../../shared/text";
import { mediaItemColumns, noCacheEntry, toMediaItem } from "./media-items";

// The columns of media_items that `fields` sets, with each title's key beside it. An empty
// Original Title counts as none.
function manualColumns(fields: ManualMediaItemEditRequest) {
  const { title, originalTitle } = fields;
  return {
    ...(title !== undefined && { title, titleKey: textKey(title) }),
    ...(originalTitle !== undefined && {
      originalTitle: originalTitle || null,
      originalTitleKey: originalTitle ? textKey(originalTitle) : null,
    }),
    year: fields.year,
    runtime: fields.runtime,
    genres: fields.genres,
  };
}

// A year the Worker refuses because it is more than five years from now.
function tooLate(year: number | null | undefined, now: Date): boolean {
  return year != null && year > latestFilmYear(now);
}

// Another of the User's Manual Media Items with the same title and year as `fields`, compared as
// a User reads them; a missing year is the same as another missing one.
function sameTitleAndYear(userId: number, fields: { title: string; year: number | null }) {
  return sql`exists (
    select 1 from ${mediaItems} as other
    where other.owner_id = ${userId} and other.title_key = ${textKey(fields.title)}
      and other.year is ${fields.year}
  )`;
}

export type CreatedManualMediaItem =
  | { ok: true; mediaItem: MediaItem }
  | {
      ok: false;
      error: "invalid_request" | "possible_duplicate" | "too_many_manual_media_items";
    };

// The number of the User's Manual Media Items.
function ownCount(userId: number) {
  return sql<number>`(select count(*) from ${mediaItems} where owner_id = ${userId})`;
}

// Makes a Manual Media Item of the User's, with no External Reference, unless they have one with
// the same title and year and `allowDuplicate` isn't set. A User holds at most
// `maxManualMediaItems`.
export async function createManualMediaItem(
  db: DrizzleD1Database,
  userId: number,
  request: NewManualMediaItem,
  now: Date,
): Promise<CreatedManualMediaItem> {
  if (tooLate(request.year, now)) return { ok: false, error: "invalid_request" };
  const columns = manualColumns(request);
  // The item is inserted only while the User has room, and no other of theirs has its title and
  // year, if that matters.
  const unique = request.allowDuplicate ? sql`1` : sql`not ${sameTitleAndYear(userId, request)}`;
  const [created] = await db
    .insert(mediaItems)
    .select(
      // Insert-select lists every column in schema order; a null id takes the next one.
      db
        .select({
          id: sql<number>`null`.as("id"),
          mediaType: sql<MediaType>`${request.mediaType}`.as("media_type"),
          externalSource: sql<null>`null`.as("external_source"),
          externalId: sql<null>`null`.as("external_id"),
          ownerId: users.id,
          title: sql<string>`${columns.title}`.as("title"),
          titleKey: sql<string>`${columns.titleKey}`.as("title_key"),
          originalTitle: sql<string | null>`${columns.originalTitle}`.as("original_title"),
          originalTitleKey: sql<string | null>`${columns.originalTitleKey}`.as(
            "original_title_key",
          ),
          year: sql<number | null>`${request.year}`.as("year"),
          runtime: sql<number | null>`${request.runtime}`.as("runtime"),
          genres: sql<string>`${JSON.stringify(request.genres)}`.as("genres"),
          createdAt: sql<number>`${now.getTime()}`.as("created_at"),
        })
        .from(users)
        .where(
          and(eq(users.id, userId), sql`${ownCount(userId)} < ${maxManualMediaItems}`, unique),
        ),
    )
    .returning();
  if (!created) {
    const [held] = await db
      .select({ count: count() })
      .from(mediaItems)
      .where(eq(mediaItems.ownerId, userId));
    const full = (held?.count ?? 0) >= maxManualMediaItems;
    return { ok: false, error: full ? "too_many_manual_media_items" : "possible_duplicate" };
  }
  return {
    ok: true,
    mediaItem: toMediaItem({ ...created, mediaItemId: created.id, manual: created, cache: null }),
  };
}

// One of the User's own Manual Media Items: another User's, or a catalog-backed one, is as unknown
// as one that doesn't exist.
function ownManual(userId: number, mediaItemId: number) {
  return and(eq(mediaItems.id, mediaItemId), eq(mediaItems.ownerId, userId));
}

// Not a db.batch with the statements that change it: D1 returns batched rows keyed by column name,
// and media_items and tmdb_cache share some.
async function ownManualMediaItem(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
): Promise<MediaItem | null> {
  const [row] = await db
    .select(mediaItemColumns)
    .from(mediaItems)
    .leftJoin(tmdbCache, noCacheEntry)
    .where(ownManual(userId, mediaItemId));
  return row ? toMediaItem(row) : null;
}

export type EditedManualMediaItem =
  | { ok: true; mediaItem: MediaItem }
  | { ok: false; error: "invalid_request" | "unknown_media_item" };

// Changes the fields `edit` gives of one of the User's Manual Media Items, by the same rules as a
// new one. A changed title or year is never refused as a possible duplicate: the User saw the
// warning when they made it.
export async function editManualMediaItem(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
  edit: ManualMediaItemEditRequest,
  now: Date,
): Promise<EditedManualMediaItem> {
  if (tooLate(edit.year, now)) return { ok: false, error: "invalid_request" };
  const changes = manualColumns(edit);
  if (Object.values(changes).some((value) => value !== undefined)) {
    await db.update(mediaItems).set(changes).where(ownManual(userId, mediaItemId));
  }
  const mediaItem = await ownManualMediaItem(db, userId, mediaItemId);
  return mediaItem ? { ok: true, mediaItem } : { ok: false, error: "unknown_media_item" };
}

// One of the User's Manual Media Items, and what deleting it would delete with it: their Log
// Entries for it, and its List Items, the Backlog's included. Only the owner can have either. Null
// when the User has no such item.
export async function manualMediaItemUsage(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
): Promise<ManualMediaItemResponse | null> {
  const [row] = await db
    .select({
      ...mediaItemColumns,
      logEntries: sql<number>`(
        select count(*) from ${logEntries} where ${logEntries.mediaItemId} = ${mediaItems.id}
      )`,
      listItems: sql<number>`(
        select count(*) from ${listItems} where ${listItems.mediaItemId} = ${mediaItems.id}
      )`,
    })
    .from(mediaItems)
    .leftJoin(tmdbCache, noCacheEntry)
    .where(ownManual(userId, mediaItemId));
  if (!row) return null;
  return {
    mediaItem: toMediaItem(row),
    usage: { logEntries: row.logEntries, listItems: row.listItems },
  };
}

// Deletes one of the User's Manual Media Items, and with it every Log Entry and List Item it has.
// False when the User has no such item.
export async function deleteManualMediaItem(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
): Promise<boolean> {
  const deleted = await db
    .delete(mediaItems)
    .where(ownManual(userId, mediaItemId))
    .returning({ id: mediaItems.id });
  return deleted.length > 0;
}

// The User's own Manual Media Items of the Media Type whose title or Original Title contains the
// query, compared as a User reads them, in title order, each marked when it is in their Backlog.
// One query, however many match.
export async function manualSearch(
  db: DrizzleD1Database,
  userId: number,
  mediaType: MediaType,
  query: string,
): Promise<Pick<ManualSearchResult, "mediaItem" | "inBacklog">[]> {
  const key = textKey(query);
  // The outer column is written out, since Drizzle leaves it unqualified in a query without joins,
  // where it would mean the inner tables'.
  const rows = await db
    .select({
      ...mediaItemColumns,
      inBacklog: sql<number>`exists (
        select 1 from ${listItems} inner join ${lists} on ${lists.id} = ${listItems.listId}
        where ${lists.userId} = ${userId} and ${lists.kind} = 'backlog'
          and ${listItems.mediaItemId} = media_items.id
      )`,
    })
    .from(mediaItems)
    .leftJoin(tmdbCache, noCacheEntry)
    .where(
      and(
        eq(mediaItems.ownerId, userId),
        eq(mediaItems.mediaType, mediaType),
        sql`(instr(${mediaItems.titleKey}, ${key}) > 0
          or instr(coalesce(${mediaItems.originalTitleKey}, ''), ${key}) > 0)`,
      ),
    )
    .orderBy(asc(mediaItems.titleKey), asc(mediaItems.id))
    .limit(maxManualSearchResults);
  return rows.map((row) => ({
    mediaItem: toMediaItem(row),
    inBacklog: Boolean(row.inBacklog),
  }));
}

// For the test hooks only: adds `count` placeholder Manual Media Items, "Placeholder 1" and on
// with no year, for the User with the Username, so a test can reach the limit without making that
// many one by one. False for an unknown Username.
export async function fillManualMediaItems(
  db: DrizzleD1Database,
  username: string,
  count: number,
  now: Date,
): Promise<boolean> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`);
  if (!user) return false;
  await db.run(sql`
    insert into media_items (media_type, owner_id, title, title_key, genres, created_at)
    with recursive n(i) as (select 1 union all select i + 1 from n where i < ${count})
    select 'film', ${user.id}, 'Placeholder ' || i, 'placeholder ' || i, '[]', ${now.getTime()}
    from n`);
  return true;
}
