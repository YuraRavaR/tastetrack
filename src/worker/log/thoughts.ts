// Thoughts: a User's own dated notes and quotes on a Media Item, for every Media Type (ADR-0005).
// Writing one never changes the Backlog, In Progress or the Library. Route handlers only translate
// HTTP to these calls.
import { and, eq, exists, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { inProgress, listItems, logEntries, mediaItems, thoughts, users } from "../../db/schema";
import type { NewThoughtRequest, Thought, ThoughtEditRequest } from "../../shared/api";
import { isLight } from "../../shared/catalog";
import { inLogOrder, type LogDateProblem, logDateProblem } from "../../shared/log";
import { type Progress, type ProgressProblem, progressProblem } from "../../shared/progress";
import { maxThoughtsPerMediaItem, type ThoughtState } from "../../shared/thoughts";
import { visibleTo } from "../catalog/media-items";
import { inBacklogOf } from "../lists/backlog";

const thoughtColumns = {
  id: thoughts.id,
  mediaItemId: thoughts.mediaItemId,
  text: thoughts.text,
  date: thoughts.date,
  quote: thoughts.quote,
  progress: thoughts.progress,
  state: thoughts.state,
  createdAt: thoughts.createdAt,
};

interface StoredThought {
  id: number;
  mediaItemId: number;
  text: string;
  date: string;
  quote: boolean;
  progress: Progress | null;
  state: ThoughtState;
  createdAt: Date;
}

function toThought(row: StoredThought): Thought {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

// One of the User's own Thoughts: another User's is as unknown as one that doesn't exist.
function ownThought(userId: number, thoughtId: number) {
  return and(eq(thoughts.id, thoughtId), eq(thoughts.userId, userId));
}

// The state the Media Item is in for the User now, as SQL: In Progress wins over Experienced, as on
// a second viewing, and Experienced over Planned.
function stateNow(db: DrizzleD1Database, userId: number, mediaItemId: number) {
  const started = db
    .select({ userId: inProgress.userId })
    .from(inProgress)
    .where(and(eq(inProgress.userId, userId), eq(inProgress.mediaItemId, mediaItemId)));
  const logged = db
    .select({ id: logEntries.id })
    .from(logEntries)
    .where(and(eq(logEntries.userId, userId), eq(logEntries.mediaItemId, mediaItemId)));
  const planned = db
    .select({ id: listItems.id })
    .from(listItems)
    .where(inBacklogOf(db, userId, mediaItemId));
  return sql<ThoughtState>`case
    when ${exists(started)} then 'in_progress'
    when ${exists(logged)} then 'experienced'
    when ${exists(planned)} then 'planned'
    else 'none' end`;
}

export type NewThought = Required<Omit<NewThoughtRequest, "timeZone">> &
  Pick<NewThoughtRequest, "timeZone">;

export type CreatedThought =
  | { ok: true; thought: Thought }
  | {
      ok: false;
      error:
        | LogDateProblem
        | ProgressProblem
        | "unknown_media_item"
        | "wrong_media_type"
        | "too_many_thoughts";
    };

// Keeps a new Thought of the User's on a Media Item they may see, in the state the Media Item is in
// for them now. Its date follows a Log Entry date's rules, its Progress must be of the Media Item's
// Media Type, and a Media Item holds at most `maxThoughtsPerMediaItem` of the User's. A Media Item
// of a light Media Type, a song or an artist, has no Thoughts. Another User's Manual Media Item is
// as unknown as one that doesn't exist.
export async function createThought(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
  request: NewThought,
  now: Date,
): Promise<CreatedThought> {
  const dateProblem = logDateProblem(request.date, now, request.timeZone);
  if (dateProblem) return { ok: false, error: dateProblem };
  const [found] = await db
    .select({ mediaType: mediaItems.mediaType })
    .from(mediaItems)
    .where(and(eq(mediaItems.id, mediaItemId), visibleTo(userId)));
  if (!found) return { ok: false, error: "unknown_media_item" };
  if (isLight(found.mediaType)) return { ok: false, error: "wrong_media_type" };
  const progressError = request.progress && progressProblem(request.progress, found.mediaType);
  if (progressError) return { ok: false, error: progressError };

  // The Thought is inserted only while the Media Item has room for it.
  const count = sql`(
    select count(*) from ${thoughts}
    where ${thoughts.userId} = ${userId} and ${thoughts.mediaItemId} = ${mediaItemId}
  )`;
  const [inserted] = await db
    .insert(thoughts)
    .select(
      // Insert-select lists every column in schema order; a null id takes the next one.
      db
        .select({
          id: sql<number>`null`.as("id"),
          userId: sql<number>`${userId}`.as("user_id"),
          mediaItemId: mediaItems.id,
          text: sql<string>`${request.text}`.as("text"),
          date: sql<string>`${request.date}`.as("date"),
          quote: sql<boolean>`${request.quote ? 1 : 0}`.as("quote"),
          progress: sql<string | null>`${request.progress && JSON.stringify(request.progress)}`.as(
            "progress",
          ),
          state: stateNow(db, userId, mediaItemId).as("state"),
          createdAt: sql<number>`${now.getTime()}`.as("created_at"),
        })
        .from(mediaItems)
        .where(
          and(
            eq(mediaItems.id, mediaItemId),
            visibleTo(userId),
            sql`${count} < ${maxThoughtsPerMediaItem}`,
          ),
        ),
    )
    .returning(thoughtColumns);
  if (!inserted) {
    // A Manual Media Item deleted in that moment leaves room, but no Media Item.
    const [still] = await db
      .select({ id: mediaItems.id })
      .from(mediaItems)
      .where(and(eq(mediaItems.id, mediaItemId), visibleTo(userId)));
    return { ok: false, error: still ? "too_many_thoughts" : "unknown_media_item" };
  }
  return { ok: true, thought: toThought(inserted) };
}

export type EditedThought =
  | { ok: true; thought: Thought }
  | { ok: false; error: LogDateProblem | ProgressProblem | "unknown_thought" };

// Changes the fields `edit` gives of one of the User's Thoughts, by the same rules as a new one. Its
// state and creation time stay.
export async function editThought(
  db: DrizzleD1Database,
  userId: number,
  thoughtId: number,
  edit: ThoughtEditRequest,
  now: Date,
): Promise<EditedThought> {
  const dateProblem = edit.date && logDateProblem(edit.date, now, edit.timeZone);
  if (dateProblem) return { ok: false, error: dateProblem };
  const own = ownThought(userId, thoughtId);
  const [found] = await db
    .select({ mediaType: mediaItems.mediaType })
    .from(thoughts)
    .innerJoin(mediaItems, eq(thoughts.mediaItemId, mediaItems.id))
    .where(own);
  if (!found) return { ok: false, error: "unknown_thought" };
  const progressError = edit.progress && progressProblem(edit.progress, found.mediaType);
  if (progressError) return { ok: false, error: progressError };

  const changes = { text: edit.text, date: edit.date, quote: edit.quote, progress: edit.progress };
  const [row] = Object.values(changes).some((value) => value !== undefined)
    ? await db.update(thoughts).set(changes).where(own).returning(thoughtColumns)
    : await db.select(thoughtColumns).from(thoughts).where(own);
  // Only a delete racing this one gets here.
  if (!row) return { ok: false, error: "unknown_thought" };
  return { ok: true, thought: toThought(row) };
}

// Deletes one of the User's Thoughts. False when the User has no such Thought.
export async function deleteThought(
  db: DrizzleD1Database,
  userId: number,
  thoughtId: number,
): Promise<boolean> {
  const deleted = await db
    .delete(thoughts)
    .where(ownThought(userId, thoughtId))
    .returning({ id: thoughts.id });
  return deleted.length > 0;
}

// The User's Thoughts on a Media Item, by date with creation time breaking ties, in one query.
export async function thoughtsOn(
  db: DrizzleD1Database,
  userId: number,
  mediaItemId: number,
): Promise<Thought[]> {
  const rows = await db
    .select(thoughtColumns)
    .from(thoughts)
    .where(and(eq(thoughts.userId, userId), eq(thoughts.mediaItemId, mediaItemId)))
    .orderBy(thoughts.id);
  return inLogOrder(rows).map(toThought);
}

// For the test hooks only: keeps `count` placeholder Thoughts, dated 2026-01-01, on the Media Item
// for the User with the Username, so a test can reach the limit without that many requests. False
// for an unknown Username.
export async function fillThoughts(
  db: DrizzleD1Database,
  username: string,
  mediaItemId: number,
  count: number,
  now: Date,
): Promise<boolean> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`);
  if (!user) return false;
  await db.run(sql`
    insert into thoughts (user_id, media_item_id, text, date, quote, state, created_at)
    with recursive n(i) as (select 1 union all select i + 1 from n where i < ${count})
    select ${user.id}, ${mediaItemId}, 'Thought ' || i, '2026-01-01', 0, 'none', ${now.getTime()}
    from n`);
  return true;
}
