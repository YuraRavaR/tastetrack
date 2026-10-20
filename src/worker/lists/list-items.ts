// List Items: a Media Item's place in one of the User's Lists, with an optional Note. Route
// handlers only translate HTTP to these calls; the ordering rule is the domain core's
// (src/shared/lists.ts).
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { listItems, lists, mediaItems, tmdbCache } from "../../db/schema";
import type { ListItem, ListItemEditRequest } from "../../shared/api";
import { moved } from "../../shared/lists";
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
