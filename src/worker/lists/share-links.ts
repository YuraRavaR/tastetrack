// Share Links: a User shares any of their Lists, the Backlog included, under an unguessable URL
// that anyone can open without logging in, and can regenerate or revoke it at any time. Route
// handlers only translate HTTP to these calls; the Visibility rules are the domain core's
// (src/shared/lists.ts).
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { lists, shareLinks, users } from "../../db/schema";
import type { MediaType, SharedList, ShareLink } from "../../shared/api";
import { sharedListTitle, sharedVisibilities, unsharedVisibilities } from "../../shared/lists";
import { toMediaItem } from "../catalog/media-items";
import { randomToken } from "../random-token";
import { listOrder, selectListItems } from "./list-items";

// 128 random bits: 22 URL-safe characters.
const tokenBytes = 16;

// Where a Share Link is opened, at the origin the Worker was reached at.
export function shareLinkOf(token: string, origin: string): ShareLink {
  return { token, url: new URL(`/s/${token}`, origin).href };
}

// Any one of the User's Lists, the Backlog included: each can be shared.
function ownListOrBacklog(userId: number, listId: number) {
  return and(eq(lists.id, listId), eq(lists.userId, userId));
}

function ownShareLink(db: DrizzleD1Database, userId: number, listId: number) {
  return inArray(
    shareLinks.listId,
    db.select({ id: lists.id }).from(lists).where(ownListOrBacklog(userId, listId)),
  );
}

export interface CreatedShareLink {
  shareLink: ShareLink;
  // False when the List already had a Share Link, which it keeps.
  created: boolean;
}

// Shares one of the User's Lists: gives it a Share Link and raises its Visibility to link. A List
// has at most one, so a List that has one keeps it. Null when the User has no such List.
export async function createShareLink(
  db: DrizzleD1Database,
  userId: number,
  listId: number,
  origin: string,
  now: Date,
): Promise<CreatedShareLink | null> {
  const own = ownListOrBacklog(userId, listId);
  const [inserted, , [found]] = await db.batch([
    db
      .insert(shareLinks)
      .select(
        db
          .select({
            token: sql<string>`${randomToken(tokenBytes)}`.as("token"),
            listId: lists.id,
            createdAt: sql<number>`${now.getTime()}`.as("created_at"),
          })
          .from(lists)
          .where(own),
      )
      .onConflictDoNothing()
      .returning({ token: shareLinks.token }),
    db
      .update(lists)
      .set({ visibility: "link" })
      .where(and(own, inArray(lists.visibility, unsharedVisibilities))),
    db
      .select({ token: shareLinks.token })
      .from(shareLinks)
      .where(ownShareLink(db, userId, listId)),
  ]);
  if (!found) return null;
  return { shareLink: shareLinkOf(found.token, origin), created: inserted.length > 0 };
}

// Gives one of the User's shared Lists a new Share Link in place of its old one, which stops
// working. Null when the User has no such List or it isn't shared.
export async function regenerateShareLink(
  db: DrizzleD1Database,
  userId: number,
  listId: number,
  origin: string,
  now: Date,
): Promise<ShareLink | null> {
  const [updated] = await db
    .update(shareLinks)
    .set({ token: randomToken(tokenBytes), createdAt: now })
    .where(ownShareLink(db, userId, listId))
    .returning({ token: shareLinks.token });
  return updated ? shareLinkOf(updated.token, origin) : null;
}

// Revokes the Share Link of one of the User's Lists, so it stops working, and makes the List
// private again. False when the User has no such List or it isn't shared.
export async function revokeShareLink(
  db: DrizzleD1Database,
  userId: number,
  listId: number,
): Promise<boolean> {
  const [deleted] = await db.batch([
    db
      .delete(shareLinks)
      .where(ownShareLink(db, userId, listId))
      .returning({ listId: shareLinks.listId }),
    db
      .update(lists)
      .set({ visibility: "private" })
      .where(and(ownListOrBacklog(userId, listId), inArray(lists.visibility, sharedVisibilities))),
  ]);
  return deleted.length > 0;
}

export interface SharedListHead {
  title: string;
  description: string | null;
  mediaType: MediaType;
  ownerDisplayName: string;
}

function sharedBy(token: string) {
  return eq(shareLinks.token, token);
}

// The List behind a Share Link and its owner. Until Users can set a Display Name, it is their
// Username, its default.
function selectHead(db: DrizzleD1Database, token: string) {
  return db
    .select({
      name: lists.name,
      description: lists.description,
      mediaType: lists.mediaType,
      ownerDisplayName: users.username,
    })
    .from(shareLinks)
    .innerJoin(lists, eq(shareLinks.listId, lists.id))
    .innerJoin(users, eq(lists.userId, users.id))
    .where(sharedBy(token));
}

type HeadRow = Awaited<ReturnType<typeof selectHead>>[number];

function toHead({ name, ownerDisplayName, ...rest }: HeadRow): SharedListHead {
  return {
    title: sharedListTitle(name, rest.mediaType, ownerDisplayName),
    ownerDisplayName,
    ...rest,
  };
}

// What a shared page's <head> says about the List behind a Share Link, in one query; null for a
// token that is unknown, revoked or replaced.
export async function sharedListHead(
  db: DrizzleD1Database,
  token: string,
): Promise<SharedListHead | null> {
  const [row] = await selectHead(db, token);
  return row ? toHead(row) : null;
}

// The List behind a Share Link as anyone may see it, in two queries however long it is: its
// title, description, owner's Display Name and items with their Notes, and nothing of the owner's
// Log. Null for a token that is unknown, revoked or replaced.
export async function sharedList(db: DrizzleD1Database, token: string): Promise<SharedList | null> {
  const [[row], rows] = await Promise.all([
    selectHead(db, token),
    selectListItems(db)
      .where(
        inArray(
          lists.id,
          db.select({ id: shareLinks.listId }).from(shareLinks).where(sharedBy(token)),
        ),
      )
      .orderBy(...listOrder),
  ]);
  if (!row) return null;
  const { title, description, mediaType, ownerDisplayName } = toHead(row);
  return {
    title,
    description,
    mediaType,
    owner: { displayName: ownerDisplayName },
    items: rows.map((item, index) => {
      return { mediaItem: toMediaItem(item), position: index, note: item.note };
    }),
  };
}
