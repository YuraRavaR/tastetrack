// Favourites: the system List of the Media Items a User Likes, one per Media Type that has them,
// made on their first Like (ADR-0005). Its order is the User's ranking, and its Notes, moves and
// Share Link are any List's. Route handlers only translate HTTP to these calls.
import { and, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { listItems, lists, mediaItems, shareLinks } from "../../db/schema";
import type {
  Favourites,
  FavouritesEditRequest,
  FavouritesMediaType,
  ListItem,
  MediaType,
} from "../../shared/api";
import { hasFavourites } from "../../shared/catalog";
import { maxFavourites } from "../../shared/lists";
import { visibleTo } from "../catalog/media-items";
import { appendListItem, listOrder, ownListItem, selectListItems, toListItem } from "./list-items";
import { shareLinkOf } from "./share-links";

function favouritesOf(userId: number, mediaType: MediaType) {
  return and(
    eq(lists.userId, userId),
    eq(lists.kind, "favourites"),
    eq(lists.mediaType, mediaType),
  );
}

// The User's Favourites of the Media Type, its Share Link at `origin` while it has one, and its
// items in order, in two queries however long it is; null before their first Like.
export async function userFavourites(
  db: DrizzleD1Database,
  userId: number,
  mediaType: FavouritesMediaType,
  origin: string,
  now: Date,
): Promise<Favourites | null> {
  const own = favouritesOf(userId, mediaType);
  const [[favourites], rows] = await Promise.all([
    db
      .select({
        id: lists.id,
        description: lists.description,
        visibility: lists.visibility,
        shareToken: shareLinks.token,
      })
      .from(lists)
      .leftJoin(shareLinks, eq(shareLinks.listId, lists.id))
      .where(own),
    selectListItems(db, now)
      .where(own)
      .orderBy(...listOrder),
  ]);
  if (!favourites) return null;
  const { shareToken, ...list } = favourites;
  return {
    ...list,
    mediaType,
    shareLink: shareToken === null ? null : shareLinkOf(shareToken, origin),
    items: rows.map(toListItem),
  };
}

export type Liked =
  | { ok: true; listItem: ListItem; created: boolean }
  | { ok: false; error: "unknown_media_item" | "wrong_media_type" | "favourites_full" };

// Likes a Media Item: puts it at the end of the User's Favourites of its Media Type, making the
// Favourites first on their first Like. A Media Item already there keeps its place; `created` is
// false then. Favourites hold at most `maxFavourites`, and only a Media Type that has them can be
// liked. Another User's Manual Media Item is as unknown as one that doesn't exist.
export async function like(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
  now: Date,
): Promise<Liked> {
  const find = async () => {
    const [found] = await db
      .select({ favouritesId: lists.id, mediaType: mediaItems.mediaType })
      .from(mediaItems)
      .leftJoin(
        lists,
        and(
          eq(lists.userId, userId),
          eq(lists.kind, "favourites"),
          eq(lists.mediaType, mediaItems.mediaType),
        ),
      )
      .where(and(eq(mediaItems.id, mediaItemId), visibleTo(userId)));
    return found;
  };
  let found = await find();
  if (!found) return { ok: false, error: "unknown_media_item" };
  if (!hasFavourites(found.mediaType)) return { ok: false, error: "wrong_media_type" };
  if (found.favouritesId === null) {
    // Two first Likes at once make one Favourites: the second insert does nothing.
    await db
      .insert(lists)
      .values({ userId, kind: "favourites", mediaType: found.mediaType, createdAt: now })
      .onConflictDoNothing();
    found = await find();
  }
  const favouritesId = found?.favouritesId;
  if (favouritesId === null || favouritesId === undefined) {
    throw new Error(`User ${userId} has no Favourites for ${mediaItemId}`);
  }

  const { created, existing } = await appendListItem(db, favouritesId, mediaItemId, null, now, {
    maxItems: maxFavourites,
  });
  if (!created && !existing) return { ok: false, error: "favourites_full" };
  const id = created?.id ?? existing?.id;
  const listItem = id === undefined ? null : await ownListItem(db, userId, id, now);
  if (!listItem) throw new Error(`Liking ${mediaItemId} inserted nothing`);
  return { ok: true, listItem, created: created !== undefined };
}

// Takes a Like back: removes the Media Item's List Item from the User's Favourites, and nothing
// else. False when it isn't there.
export async function unlike(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
): Promise<boolean> {
  const removed = await db
    .delete(listItems)
    .where(
      and(
        eq(listItems.mediaItemId, mediaItemId),
        inArray(
          listItems.listId,
          db
            .select({ id: lists.id })
            .from(lists)
            .where(and(eq(lists.userId, userId), eq(lists.kind, "favourites"))),
        ),
      ),
    )
    .returning({ id: listItems.id });
  return removed.length > 0;
}

// Changes the description of the User's Favourites of the Media Type, an empty one counting as
// none. False before their first Like.
export async function editFavourites(
  db: DrizzleD1Database,
  userId: number,
  mediaType: FavouritesMediaType,
  edit: FavouritesEditRequest,
): Promise<boolean> {
  const updated = await db
    .update(lists)
    .set({ description: edit.description?.trim() || null })
    .where(favouritesOf(userId, mediaType))
    .returning({ id: lists.id });
  return updated.length > 0;
}

// Which of these Media Items the User Likes, in one query even for none, so that a search takes
// the same number whatever it finds (ADR-0009).
export async function likedMediaItems(
  db: DrizzleD1Database,
  userId: number,
  mediaItemIds: number[],
): Promise<Set<number>> {
  const rows = await db
    .select({ mediaItemId: listItems.mediaItemId })
    .from(listItems)
    .innerJoin(lists, eq(listItems.listId, lists.id))
    .where(
      and(
        eq(lists.userId, userId),
        eq(lists.kind, "favourites"),
        inArray(listItems.mediaItemId, mediaItemIds),
      ),
    );
  return new Set(rows.map((row) => row.mediaItemId));
}
