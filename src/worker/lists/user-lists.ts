// A User's own Lists, beside the Backlog: making, reading, renaming and deleting them, and adding
// Media Items to them. Route handlers only translate HTTP to these calls; the List rules are the
// domain core's (src/shared/lists.ts).
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { listItems, lists, mediaItems, shareLinks, users } from "../../db/schema";
import type {
  List,
  ListEditRequest,
  ListItem,
  ListSummary,
  MediaType,
  NewListItemRequest,
  NewListRequest,
} from "../../shared/api";
import { isReservedListName, listNameKey, maxLists } from "../../shared/lists";
import { visibleTo } from "../catalog/media-items";
import {
  appendListItem,
  listOrder,
  move,
  ownListItem,
  selectListItems,
  toListItem,
} from "./list-items";
import { shareLinkOf } from "./share-links";

const summaryColumns = {
  id: lists.id,
  name: lists.name,
  description: lists.description,
  mediaType: lists.mediaType,
  visibility: lists.visibility,
};

// The User's Lists with how many items each holds, for `.where` on lists.
function selectSummaries(db: DrizzleD1Database) {
  return db
    .select({ ...summaryColumns, itemCount: count(listItems.id) })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id));
}

type SummaryRow = Awaited<ReturnType<typeof selectSummaries>>[number];

function toSummary(row: SummaryRow): ListSummary {
  if (row.name === null) throw new Error(`List ${row.id} has no name`);
  return { ...row, name: row.name };
}

// One of the User's own Lists, never the Backlog: that is reached only as the Backlog.
function ownList(userId: number, listId: number) {
  return and(eq(lists.id, listId), eq(lists.userId, userId), eq(lists.kind, "list"));
}

// An empty description counts as none.
function descriptionOf(description: string | null | undefined): string | null {
  return description?.trim() || null;
}

export type CreatedList =
  | { ok: true; list: ListSummary }
  | { ok: false; error: "list_name_reserved" | "list_name_taken" | "too_many_lists" };

// Makes a private, empty List. Its name can't be reserved or one of the User's other Lists'
// names, and a User holds at most `maxLists`.
export async function createList(
  db: DrizzleD1Database,
  userId: number,
  request: NewListRequest,
  now: Date,
): Promise<CreatedList> {
  if (isReservedListName(request.name)) return { ok: false, error: "list_name_reserved" };
  const nameKey = listNameKey(request.name);
  // The List is inserted only while the User has room, and only under a name of its own.
  const listCount = sql`(
    select count(*) from ${lists} where user_id = ${userId} and kind = 'list'
  )`;
  const [inserted, [taken]] = await db.batch([
    db
      .insert(lists)
      .select(
        // Insert-select lists every column in table order; a null id takes the next one.
        db
          .select({
            id: sql<number>`null`.as("id"),
            userId: users.id,
            kind: sql<"list">`'list'`.as("kind"),
            mediaType: sql<MediaType>`${request.mediaType}`.as("media_type"),
            name: sql<string>`${request.name}`.as("name"),
            nameKey: sql<string>`${nameKey}`.as("name_key"),
            description: sql<string | null>`${descriptionOf(request.description)}`.as(
              "description",
            ),
            visibility: sql<"private">`'private'`.as("visibility"),
            createdAt: sql<number>`${now.getTime()}`.as("created_at"),
          })
          .from(users)
          .where(and(eq(users.id, userId), sql`${listCount} < ${maxLists}`)),
      )
      .onConflictDoNothing()
      .returning(summaryColumns),
    db
      .select({ id: lists.id })
      .from(lists)
      .where(and(eq(lists.userId, userId), eq(lists.nameKey, nameKey))),
  ]);
  const [created] = inserted;
  if (created) return { ok: true, list: toSummary({ ...created, itemCount: 0 }) };
  return { ok: false, error: taken ? "list_name_taken" : "too_many_lists" };
}

// The User's own Lists, oldest first, each with how many items it holds, in one query.
export async function userLists(db: DrizzleD1Database, userId: number): Promise<ListSummary[]> {
  const rows = await selectSummaries(db)
    .where(and(eq(lists.userId, userId), eq(lists.kind, "list")))
    .groupBy(lists.id)
    .orderBy(asc(lists.createdAt), asc(lists.id));
  return rows.map(toSummary);
}

export type EditedList =
  | { ok: true; list: ListSummary }
  | { ok: false; error: "unknown_list" | "list_name_reserved" | "list_name_taken" };

// Changes the fields `edit` gives of one of the User's Lists, by the same name rules as making
// one: a List may take its own name in another case.
export async function editList(
  db: DrizzleD1Database,
  userId: number,
  listId: number,
  edit: ListEditRequest,
): Promise<EditedList> {
  if (edit.name !== undefined && isReservedListName(edit.name)) {
    return { ok: false, error: "list_name_reserved" };
  }
  const own = ownList(userId, listId);
  const summary = selectSummaries(db).where(own).groupBy(lists.id);
  const changes = {
    ...(edit.name !== undefined && { name: edit.name, nameKey: listNameKey(edit.name) }),
    ...(edit.description !== undefined && { description: descriptionOf(edit.description) }),
  };
  if (Object.keys(changes).length === 0) {
    const [list] = await summary;
    return list ? { ok: true, list: toSummary(list) } : { ok: false, error: "unknown_list" };
  }
  // The name changes only while no other List of the User's has it.
  const sameName =
    changes.nameKey === undefined
      ? sql`0`
      : sql`exists (
          select 1 from ${lists} as other
          where other.user_id = ${userId} and other.name_key = ${changes.nameKey}
            and other.id <> ${listId}
        )`;
  const [updated, [list]] = await db.batch([
    db
      .update(lists)
      .set(changes)
      .where(and(own, sql`not ${sameName}`))
      .returning({ id: lists.id }),
    summary,
  ]);
  if (!list) return { ok: false, error: "unknown_list" };
  if (updated.length === 0) return { ok: false, error: "list_name_taken" };
  return { ok: true, list: toSummary(list) };
}

// Deletes one of the User's Lists with its List Items, and nothing else: their Media Items and
// any Log Entries for them stay. False when the User has no such List.
export async function deleteList(
  db: DrizzleD1Database,
  userId: number,
  listId: number,
): Promise<boolean> {
  const deleted = await db.delete(lists).where(ownList(userId, listId)).returning({ id: lists.id });
  return deleted.length > 0;
}

// One of the User's own Lists, its Share Link at `origin` while it has one, and its items in
// order, in two queries however long it is; null when the User has no such List.
export async function userList(
  db: DrizzleD1Database,
  userId: number,
  listId: number,
  origin: string,
): Promise<List | null> {
  const own = ownList(userId, listId);
  const [[found], rows] = await Promise.all([
    db
      .select({ ...summaryColumns, shareToken: shareLinks.token })
      .from(lists)
      .leftJoin(shareLinks, eq(shareLinks.listId, lists.id))
      .where(own),
    selectListItems(db)
      .where(own)
      .orderBy(...listOrder),
  ]);
  if (!found) return null;
  const { shareToken, ...list } = found;
  const { itemCount: _, ...summary } = toSummary({ ...list, itemCount: rows.length });
  return {
    ...summary,
    shareLink: shareToken === null ? null : shareLinkOf(shareToken, origin),
    items: rows.map(toListItem),
  };
}

export type AddedToList =
  | { ok: true; listItem: ListItem }
  | {
      ok: false;
      error:
        | "unknown_list"
        | "unknown_media_item"
        | "wrong_media_type"
        | "already_in_list"
        | "list_full";
    };

// Adds a Media Item to one of the User's Lists, at `position` when given and at the end
// otherwise, with its Note. A Media Item already there is refused, and so is one of another Media
// Type than the List's. A List holds at most `maxListItems`. Another User's Manual Media Item is
// as unknown as one that doesn't exist.
export async function addToList(
  db: DrizzleD1Database,
  userId: number,
  listId: number,
  request: NewListItemRequest,
  now: Date,
): Promise<AddedToList> {
  const [found] = await db
    .select({ listMediaType: lists.mediaType, mediaType: mediaItems.mediaType })
    .from(lists)
    .leftJoin(mediaItems, and(eq(mediaItems.id, request.mediaItemId), visibleTo(userId)))
    .where(ownList(userId, listId));
  if (!found) return { ok: false, error: "unknown_list" };
  if (found.mediaType === null) return { ok: false, error: "unknown_media_item" };
  if (found.mediaType !== found.listMediaType) return { ok: false, error: "wrong_media_type" };

  const { created, existing } = await appendListItem(
    db,
    listId,
    request.mediaItemId,
    request.note,
    now,
  );
  if (!created) return { ok: false, error: existing ? "already_in_list" : "list_full" };
  if (request.position !== undefined) await move(db, listId, created.id, request.position);
  const listItem = await ownListItem(db, userId, created.id);
  if (!listItem) throw new Error(`List Item ${created.id} vanished as it was added`);
  return { ok: true, listItem };
}
