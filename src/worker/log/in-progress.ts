// In Progress: a Media Item the User has started and not yet finished ("Reading" for books in the
// UI), a state of its own beside their Log Entries and Backlog (ADR-0005). Starting takes the Media
// Item off the Backlog, finishing records a Log Entry, and stopping leaves no trace. Route handlers
// only translate HTTP to these calls.
import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { inProgress, mediaItems } from "../../db/schema";
import type {
  FinishRequest,
  InProgress,
  InProgressEditRequest,
  NewInProgressRequest,
  RemovedListItem,
} from "../../shared/api";
import { type LogDateProblem, logDateProblem } from "../../shared/log";
import { visibleTo } from "../catalog/media-items";
import { takeOffBacklog } from "../lists/backlog";
import { type CreatedLogEntry, createLogEntry, ownInProgress } from "./log-entries";

const inProgressColumns = { startDate: inProgress.startDate, createdAt: inProgress.createdAt };

export function toInProgress(row: { startDate: string | null; createdAt: Date }): InProgress {
  return { startDate: row.startDate, createdAt: row.createdAt.toISOString() };
}

export type NewInProgress = Required<Omit<NewInProgressRequest, "timeZone">> &
  Pick<NewInProgressRequest, "timeZone">;

export type Started =
  | { ok: true; inProgress: InProgress; removedFromBacklog: RemovedListItem | null }
  | { ok: false; error: LogDateProblem | "unknown_media_item" | "already_in_progress" };

// Starts a Media Item for the User, and takes it off their Backlog in the same batch;
// `removedFromBacklog` says where it was, so the client can offer to undo that. The start date
// follows a Log Entry date's rules. A Media Item already In Progress is refused, its Backlog left as
// it is, and another User's Manual Media Item is as unknown as one that doesn't exist.
export async function start(
  db: DrizzleD1Database,
  userId: number,
  request: NewInProgress,
  now: Date,
): Promise<Started> {
  const { mediaItemId, startDate } = request;
  const dateProblem = startDate && logDateProblem(startDate, now, request.timeZone);
  if (dateProblem) return { ok: false, error: dateProblem };

  const [found] = await db
    .select({ startedAt: inProgress.createdAt })
    .from(mediaItems)
    .leftJoin(inProgress, ownInProgress(userId, mediaItems.id))
    .where(and(eq(mediaItems.id, mediaItemId), visibleTo(userId)));
  if (!found) return { ok: false, error: "unknown_media_item" };
  if (found.startedAt !== null) return { ok: false, error: "already_in_progress" };

  const [inserted, [removed]] = await db.batch([
    db
      .insert(inProgress)
      .values({ userId, mediaItemId, startDate, createdAt: now })
      .onConflictDoNothing()
      .returning(inProgressColumns),
    ...takeOffBacklog(db, userId, mediaItemId),
  ]);
  // Only a start racing this one gets here, and that one took the Media Item off the Backlog.
  const [row] = inserted;
  if (!row) return { ok: false, error: "already_in_progress" };
  return { ok: true, inProgress: toInProgress(row), removedFromBacklog: removed ?? null };
}

export type StartDateChange =
  | { ok: true; inProgress: InProgress }
  | { ok: false; error: LogDateProblem | "not_in_progress" };

// Sets or clears the start date of a Media Item the User has In Progress, by a Log Entry date's
// rules.
export async function changeStartDate(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
  edit: InProgressEditRequest,
  now: Date,
): Promise<StartDateChange> {
  const dateProblem = edit.startDate && logDateProblem(edit.startDate, now, edit.timeZone);
  if (dateProblem) return { ok: false, error: dateProblem };
  const [row] = await db
    .update(inProgress)
    .set({ startDate: edit.startDate })
    .where(ownInProgress(userId, mediaItemId))
    .returning(inProgressColumns);
  if (!row) return { ok: false, error: "not_in_progress" };
  return { ok: true, inProgress: toInProgress(row) };
}

// Ends a Media Item the User has In Progress without a Log Entry, leaving no trace of it. False when
// it isn't In Progress.
export async function stop(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
): Promise<boolean> {
  const deleted = await db
    .delete(inProgress)
    .where(ownInProgress(userId, mediaItemId))
    .returning({ mediaItemId: inProgress.mediaItemId });
  return deleted.length > 0;
}

// Finishes a Media Item the User has In Progress: records a Log Entry for it, as logging does, and
// ends In Progress in the same batch.
export function finish(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
  request: Required<Omit<FinishRequest, "timeZone">> & Pick<FinishRequest, "timeZone">,
  now: Date,
): Promise<CreatedLogEntry> {
  return createLogEntry(db, userId, { mediaItemId, ...request }, now, { finishing: true });
}
