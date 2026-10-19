// Log Entries: the Experienced action and the Log. Route handlers only translate HTTP to these
// calls; the rules themselves are the domain core's (src/shared/log.ts).
import { and, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { logEntries, mediaItems, tmdbCache } from "../../db/schema";
import type { LogEntry, MediaType, NewLogEntryRequest } from "../../shared/api";
import {
  inLogOrder,
  type LogDateProblem,
  logDateProblem,
  storedRating,
  toStars,
} from "../../shared/log";
import { cacheOfMediaItem, mediaItemColumns, toMediaItem } from "../catalog/media-items";

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
  | { ok: true; logEntry: LogEntry }
  | { ok: false; error: LogEntryProblem };

// Records that the User experienced the Media Item. A first entry may be a Revisit, and an empty
// Review counts as none. Every Media Item is catalog-backed and so open to every User for now;
// Manual Media Items will need an owner check here.
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

  const [inserted] = await db
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
    .returning({ id: logEntries.id })
    .catch((error: unknown) => {
      if (isForeignKeyViolation(error)) return [];
      throw error;
    });
  if (!inserted) return { ok: false, error: "unknown_media_item" };
  const [row] = await selectLog(db).where(eq(logEntries.id, inserted.id));
  if (!row) throw new Error(`Log Entry ${inserted.id} vanished`);
  return { ok: true, logEntry: toLogEntry(row) };
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
