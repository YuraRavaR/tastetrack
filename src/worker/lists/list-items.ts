// List Items: a Media Item's place in one of the User's Lists, with an optional Note. Route
// handlers only translate HTTP to these calls; the ordering rule is the domain core's
// (src/shared/lists.ts).
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { listItems, lists, mediaItems, tmdbCache } from "../../db/schema";
import type { ListItem, ListItemEditRequest } from "../../shared/api";
import { maxListItems, moved } from "../../shared/lists";
import { cacheOfMediaItem, mediaItemColumns, toMediaItem } from "../catalog/media-items";

const listItemColumns = {
  id: listItems.id,
  position: listItems.position,
  note: listItems.note,
  ...mediaItemColumns,
};

// List Items joined to their List, Media Item and its cache entry, for `.where` on any of them.
export function selectListItems(db: DrizzleD1Database) {
  return db
    .select(listItemColumns)
    .from(listItems)
    .innerJoin(lists, eq(listItems.listId, lists.id))
    .innerJoin(mediaItems, eq(listItems.mediaItemId, mediaItems.id))
    .leftJoin(tmdbCache, cacheOfMediaItem);
}

type ListItemRow = Awaited<ReturnType<typeof selectListItems>>[number];

// List Items are in position order, with the id breaking ties, so a gap a removed item leaves
// changes nothing.
export const listOrder = [asc(listItems.position), asc(listItems.id)];

// `index` is the item's place in its List, counted from 0.
export function toListItem(row: ListItemRow, index: number): ListItem {
  return { id: row.id, mediaItem: toMediaItem(row), position: index, note: row.note };
}

// A List Item's place in its List, counted from 0: how many items come before it. The outer
// columns are written out, since Drizzle leaves them unqualified in a query without joins, where
// they would mean the inner table's.
export const listIndex = sql<number>`(
  select count(*) from list_items as earlier
  where earlier.list_id = list_items.list_id
    and (earlier.position < list_items.position
      or (earlier.position = list_items.position and earlier.id < list_items.id))
)`;

// One of the User's own List Items with its place in its List, or null when the User has no
// such item: another User's is as unknown as one that doesn't exist.
export async function ownListItem(
  db: DrizzleD1Database,
  userId: number,
  listItemId: number,
): Promise<ListItem | null> {
  const [row] = await db
    .select({ ...listItemColumns, index: listIndex })
    .from(listItems)
    .innerJoin(lists, eq(listItems.listId, lists.id))
    .innerJoin(mediaItems, eq(listItems.mediaItemId, mediaItems.id))
    .leftJoin(tmdbCache, cacheOfMediaItem)
    .where(and(eq(listItems.id, listItemId), eq(lists.userId, userId)));
  return row ? toListItem(row, row.index) : null;
}

// Adds a Media Item at the end of a List with its Note, an empty one counting as none, unless it
// is there already or the List holds `maxListItems`. `created` is the new item; `existing` is the
// one already there, so neither means the List is full.
export async function appendListItem(
  db: DrizzleD1Database,
  listId: number,
  mediaItemId: number,
  note: string | null | undefined,
  now: Date,
): Promise<{ created?: { id: number }; existing?: { id: number } }> {
  // The item is inserted only while the List has room, and only once.
  const itemCount = sql`(select count(*) from ${listItems} where list_id = ${listId})`;
  const nextPosition = sql`(
    select coalesce(max(position), -1) + 1 from ${listItems} where list_id = ${listId}
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
            mediaItemId: sql<number>`${mediaItemId}`.as("media_item_id"),
            position: sql<number>`${nextPosition}`.as("position"),
            note: sql<string | null>`${note?.trim() || null}`.as("note"),
            createdAt: sql<number>`${now.getTime()}`.as("created_at"),
          })
          .from(lists)
          .where(and(eq(lists.id, listId), sql`${itemCount} < ${maxListItems}`)),
      )
      .onConflictDoNothing()
      .returning({ id: listItems.id }),
    db
      .select({ id: listItems.id })
      .from(listItems)
      .where(and(eq(listItems.listId, listId), eq(listItems.mediaItemId, mediaItemId))),
  ]);
  const [created] = inserted;
  return created ? { created } : { existing };
}

// Numbers the List's items afresh from 0 in the order `ids` gives. An item added since `ids` was
// read keeps its position, so it sorts by it among the others.
async function renumber(db: DrizzleD1Database, listId: number, ids: number[]): Promise<void> {
  const order = JSON.stringify(ids);
  await db
    .update(listItems)
    .set({ position: sql`(select key from json_each(${order}) where value = ${listItems.id})` })
    .where(
      and(
        eq(listItems.listId, listId),
        sql`${listItems.id} in (select value from json_each(${order}))`,
      ),
    );
}

// Changes the fields `edit` gives of one of the User's List Items: moves it to `position` in its
// List, counted from 0, with past the end meaning last, and sets its Note, an empty one counting
// as none. Null when the User has no such item.
export async function editListItem(
  db: DrizzleD1Database,
  userId: number,
  listItemId: number,
  edit: ListItemEditRequest,
): Promise<ListItem | null> {
  const [own] = await db
    .select({ listId: listItems.listId })
    .from(listItems)
    .innerJoin(lists, eq(listItems.listId, lists.id))
    .where(and(eq(listItems.id, listItemId), eq(lists.userId, userId)));
  if (!own) return null;
  if (edit.note !== undefined) {
    await db
      .update(listItems)
      .set({ note: edit.note?.trim() || null })
      .where(eq(listItems.id, listItemId));
  }
  if (edit.position !== undefined) await move(db, own.listId, listItemId, edit.position);
  return ownListItem(db, userId, listItemId);
}

// Moves a List Item to place `index` in its List, counted from 0; past the end is last.
export async function move(
  db: DrizzleD1Database,
  listId: number,
  listItemId: number,
  index: number,
): Promise<void> {
  const order = await db
    .select({ id: listItems.id })
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(...listOrder);
  const ids = order.map((row) => row.id);
  await renumber(db, listId, moved(ids, listItemId, index));
}

// Removes one of the User's List Items, and nothing else: its Media Item and any Log Entries for
// it stay. False when the User has no such item.
export async function removeListItem(
  db: DrizzleD1Database,
  userId: number,
  listItemId: number,
): Promise<boolean> {
  const removed = await db
    .delete(listItems)
    .where(
      and(
        eq(listItems.id, listItemId),
        inArray(
          listItems.listId,
          db.select({ id: lists.id }).from(lists).where(eq(lists.userId, userId)),
        ),
      ),
    )
    .returning({ id: listItems.id });
  return removed.length > 0;
}

// For the test hooks only: adds `count` placeholder films, which have no metadata, at the end of
// the List, so a test can reach the limit without adding that many films. False for an unknown
// List.
export async function fillList(
  db: DrizzleD1Database,
  listId: number,
  count: number,
  now: Date,
): Promise<boolean> {
  const [list] = await db.select({ id: lists.id }).from(lists).where(eq(lists.id, listId));
  if (!list) return false;
  // The placeholders' ids share a prefix, so the index on External References finds them.
  const prefix = `test-fill-${crypto.randomUUID()}-`;
  await db.run(sql`
    insert into media_items (media_type, external_source, external_id, created_at)
    with recursive n(i) as (select 1 union all select i + 1 from n where i < ${count})
    select 'film', 'tmdb', ${prefix} || i, ${now.getTime()} from n`);
  await db.run(sql`
    insert into list_items (list_id, media_item_id, position, note, created_at)
    select ${listId}, id,
      (select coalesce(max(position), -1) from list_items where list_id = ${listId})
        + row_number() over (order by id),
      null, ${now.getTime()}
    from media_items
    where external_source = 'tmdb' and media_type = 'film'
      and external_id > ${prefix} and external_id < ${`${prefix}~`}`);
  return true;
}
