// The Library: every Media Item of one Media Type that a User has in their Backlog, has In Progress
// or has at least one Log Entry for. Route handlers only translate HTTP to these calls; Log Order
// and the Current Rating are the domain core's (src/shared/log.ts).
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  catalogCache,
  inProgress,
  listItems,
  lists,
  logEntries,
  mediaItems,
} from "../../db/schema";
import type { LibraryItem, MediaType } from "../../shared/api";
import { inLogOrder, toStars } from "../../shared/log";
import { cacheOfMediaItem, mediaItemColumns, toMediaItem } from "../catalog/media-items";
import { ownInProgress, toInProgress } from "../log/log-entries";

// The User's Library of the Media Type, each Media Item once, in two queries however large it is:
// one for the Media Items, with when each was added to the Backlog and started, and one for the Log
// Entries.
export async function userLibrary(
  db: DrizzleD1Database,
  userId: number,
  mediaType: MediaType,
  now: Date,
): Promise<LibraryItem[]> {
  const backlog = db
    .select({ id: lists.id })
    .from(lists)
    .where(
      and(eq(lists.userId, userId), eq(lists.kind, "backlog"), eq(lists.mediaType, mediaType)),
    );
  // The Media Items in the Backlog, In Progress or logged, found through their indexes rather than
  // by reading every Media Item of the type.
  const inLibrary = sql`(
    select ${listItems.mediaItemId} from ${listItems} where ${inArray(listItems.listId, backlog)}
    union
    select ${inProgress.mediaItemId} from ${inProgress} where ${eq(inProgress.userId, userId)}
    union
    select ${logEntries.mediaItemId} from ${logEntries} where ${eq(logEntries.userId, userId)}
  )`;
  const [rows, entries] = await Promise.all([
    db
      .select({
        ...mediaItemColumns,
        addedAt: listItems.createdAt,
        startDate: inProgress.startDate,
        startedAt: inProgress.createdAt,
      })
      .from(mediaItems)
      .leftJoin(catalogCache, cacheOfMediaItem(now))
      .leftJoin(
        listItems,
        and(eq(listItems.mediaItemId, mediaItems.id), inArray(listItems.listId, backlog)),
      )
      .leftJoin(inProgress, ownInProgress(userId, mediaItems.id))
      .where(and(eq(mediaItems.mediaType, mediaType), sql`${mediaItems.id} in ${inLibrary}`))
      .orderBy(mediaItems.id),
    db
      .select({
        mediaItemId: logEntries.mediaItemId,
        rating: logEntries.rating,
        date: logEntries.date,
        createdAt: logEntries.createdAt,
      })
      .from(logEntries)
      .innerJoin(mediaItems, eq(logEntries.mediaItemId, mediaItems.id))
      .where(and(eq(logEntries.userId, userId), eq(mediaItems.mediaType, mediaType)))
      .orderBy(logEntries.id),
  ]);

  // Each Media Item's last Log Entry in Log Order, which holds its Current Rating.
  const lastEntries = new Map<number, (typeof entries)[number]>();
  for (const entry of inLogOrder(entries)) lastEntries.set(entry.mediaItemId, entry);

  return rows.map((row) => {
    const last = lastEntries.get(row.mediaItemId);
    return {
      mediaItem: toMediaItem(row),
      backlog: row.addedAt === null ? null : { addedAt: row.addedAt.toISOString() },
      inProgress:
        row.startedAt === null
          ? null
          : toInProgress({ startDate: row.startDate, createdAt: row.startedAt }),
      log: last
        ? {
            currentRating: toStars(last.rating),
            lastLogEntry: { date: last.date, createdAt: last.createdAt.toISOString() },
          }
        : null,
    };
  });
}
