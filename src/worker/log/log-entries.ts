// Log Entries: the Experienced action and the Log. Route handlers only translate HTTP to these
// calls; the rules themselves are the domain core's (src/shared/log.ts).
import { and, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { logEntries, mediaItems, tmdbCache } from "../../db/schema";
import type {
  ItemHistoryResponse,
  LogEntry,
  LogEntryEditRequest,
  MediaType,
  NewLogEntryRequest,
  RemovedListItem,
} from "../../shared/api";
import {
  currentRating,
  inLogOrder,
  type LogDateProblem,
  logDateProblem,
  storedRating,
  toStars,
} from "../../shared/log";
import { cacheOfMediaItem, mediaItemColumns, toMediaItem } from "../catalog/media-items";
import { takeOffBacklog } from "../lists/backlog";

const logEntryColumns = {
  id: logEntries.id,
  rating: logEntries.rating,
  date: logEntries.date,
  review: logEntries.review,
  revisit: logEntries.revisit,
  createdAt: logEntries.createdAt,
  ...mediaItemColumns,
};

function selectLog(db: DrizzleD1Database) {
  return db
    .select(logEntryColumns)
    .from(logEntries)
    .innerJoin(mediaItems, eq(logEntries.mediaItemId, mediaItems.id))
    .leftJoin(tmdbCache, cacheOfMediaItem);
}

type LogEntryRow = Awaited<ReturnType<typeof selectLog>>[number];

function toLogEntry(row: LogEntryRow): LogEntry {
  return {
    id: row.id,
    mediaItem: toMediaItem(row),
    rating: toStars(row.rating),
    date: row.date,
    review: row.review,
    revisit: row.revisit,
    createdAt: row.createdAt.toISOString(),
  };
}

export type NewLogEntry = Required<Omit<NewLogEntryRequest, "timeZone">> &
  Pick<NewLogEntryRequest, "timeZone">;

export type LogEntryProblem = LogDateProblem | "invalid_rating" | "unknown_media_item";

export type CreatedLogEntry =
  | { ok: true; logEntry: LogEntry; removedFromBacklog: RemovedListItem | null }
  | { ok: false; error: LogEntryProblem };

// Records that the User experienced the Media Item, and takes it off their Backlog in the same
// batch; `removedFromBacklog` says where it was, so the client can offer to undo that. A first
// entry may be a Revisit, and an empty Review counts as none. Every Media Item is catalog-backed
// and so open to every User for now; Manual Media Items will need an owner check here.
export async function createLogEntry(
  db: DrizzleD1Database,
  userId: number,
  request: NewLogEntry,
  now: Date,
): Promise<CreatedLogEntry> {
  const rating = storedRating(request.rating);
  if (rating === null) return { ok: false, error: "invalid_rating" };
  const dateProblem = request.date && logDateProblem(request.date, now, request.timeZone);
  if (dateProblem) return { ok: false, error: dateProblem };

  const batch = await db
    .batch([
      db
        .insert(logEntries)
        .values({
          userId,
          mediaItemId: request.mediaItemId,
          rating,
          date: request.date,
          review: request.review?.trim() || null,
          revisit: request.revisit,
          createdAt: now,
        })
        .returning({ id: logEntries.id }),
      ...takeOffBacklog(db, userId, request.mediaItemId),
    ])
    .catch((error: unknown) => {
      if (isForeignKeyViolation(error)) return null;
      throw error;
    });
  if (!batch) return { ok: false, error: "unknown_media_item" };
  const [[inserted], [removed]] = batch;
  if (!inserted) throw new Error(`Logging ${request.mediaItemId} inserted nothing`);
  const [row] = await selectLog(db).where(eq(logEntries.id, inserted.id));
  if (!row) throw new Error(`Log Entry ${inserted.id} vanished`);
  return { ok: true, logEntry: toLogEntry(row), removedFromBacklog: removed ?? null };
}

// One of the User's own Log Entries: another User's is as unknown as one that doesn't exist.
function ownLogEntry(userId: number, logEntryId: number) {
  return and(eq(logEntries.id, logEntryId), eq(logEntries.userId, userId));
}

export type LogEntryEditProblem = LogDateProblem | "invalid_rating" | "unknown_log_entry";

export type EditedLogEntry =
  | { ok: true; logEntry: LogEntry }
  | { ok: false; error: LogEntryEditProblem };

// Changes the fields `edit` gives of one of the User's Log Entries, by the same rules as a new
// one. Its creation time stays, so it keeps its place among same-day entries.
export async function editLogEntry(
  db: DrizzleD1Database,
  userId: number,
  logEntryId: number,
  edit: LogEntryEditRequest,
  now: Date,
): Promise<EditedLogEntry> {
  const rating = edit.rating === undefined ? undefined : storedRating(edit.rating);
  if (rating === null) return { ok: false, error: "invalid_rating" };
  const dateProblem = edit.date && logDateProblem(edit.date, now, edit.timeZone);
  if (dateProblem) return { ok: false, error: dateProblem };

  const changes = {
    rating,
    date: edit.date,
    review: edit.review === undefined ? undefined : edit.review?.trim() || null,
    revisit: edit.revisit,
  };
  const own = ownLogEntry(userId, logEntryId);
  if (Object.values(changes).some((value) => value !== undefined)) {
    await db.update(logEntries).set(changes).where(own);
  }
  const [row] = await selectLog(db).where(own);
  if (!row) return { ok: false, error: "unknown_log_entry" };
  return { ok: true, logEntry: toLogEntry(row) };
}

// Deletes one of the User's Log Entries, and nothing else: a Media Item left with no entries just
// counts as not experienced. False when the User has no such entry.
export async function deleteLogEntry(
  db: DrizzleD1Database,
  userId: number,
  logEntryId: number,
): Promise<boolean> {
  const deleted = await db
    .delete(logEntries)
    .where(ownLogEntry(userId, logEntryId))
    .returning({ id: logEntries.id });
  return deleted.length > 0;
}

// D1 reports a broken foreign key as an error whose message, possibly on a wrapped cause, says so.
function isForeignKeyViolation(error: unknown): boolean {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if (cause.message.includes("FOREIGN KEY constraint failed")) return true;
  }
  return false;
}

// The User's whole Log, in Log Order, in one query.
export async function userLog(db: DrizzleD1Database, userId: number): Promise<LogEntry[]> {
  const rows = await selectLog(db).where(eq(logEntries.userId, userId)).orderBy(logEntries.id);
  return inLogOrder(rows).map(toLogEntry);
}

// The User's Item History of a Media Item, or null when there is no such Media Item. Two queries,
// not a db.batch: D1 returns batched rows keyed by column name, so the join's two id columns would
// collide.
export async function itemHistory(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
): Promise<ItemHistoryResponse | null> {
  const [[item], rows] = await Promise.all([
    db
      .select(mediaItemColumns)
      .from(mediaItems)
      .leftJoin(tmdbCache, cacheOfMediaItem)
      .where(eq(mediaItems.id, mediaItemId)),
    selectLog(db)
      .where(and(eq(logEntries.userId, userId), eq(logEntries.mediaItemId, mediaItemId)))
      .orderBy(logEntries.id),
  ]);
  if (!item) return null;
  const current = currentRating(rows);
  return {
    mediaItem: toMediaItem(item),
    logEntries: inLogOrder(rows).map(toLogEntry),
    currentRating: current === null ? null : toStars(current),
  };
}

// Which of these External Source ids of one Media Type the User has a Log Entry for.
export async function loggedExternalIds(
  db: DrizzleD1Database,
  userId: number,
  source: "tmdb",
  mediaType: MediaType,
  externalIds: string[],
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ externalId: mediaItems.externalId })
    .from(logEntries)
    .innerJoin(mediaItems, eq(logEntries.mediaItemId, mediaItems.id))
    .where(
      and(
        eq(logEntries.userId, userId),
        eq(mediaItems.externalSource, source),
        eq(mediaItems.mediaType, mediaType),
        inArray(mediaItems.externalId, externalIds),
      ),
    );
  return new Set(rows.flatMap((row) => (row.externalId === null ? [] : [row.externalId])));
}
