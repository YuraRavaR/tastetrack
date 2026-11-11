// Keeping the disposable catalog cache (ADR-0004) fresh from a Cron Trigger that runs every 15
// minutes: it refreshes a batch of the oldest entries in use and deletes the rest once they expire
// or nothing uses them. There is no refresh on read; a page fills only entries that are missing,
// which an expired one counts as.
import { and, asc, eq, exists, isNull, lt, not, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { catalogCache, inProgress, listItems, logEntries, mediaItems } from "../../db/schema";
import { type CacheKey, cacheKeyId, fetchDetails, storeDetails } from "./media-items";
import { expiredEntries, sourceOf } from "./registry";
import type { CatalogEnv } from "./source";

// Workers Free allows 50 external subrequests per invocation, cron runs included (ADR-0004), so
// one run makes at most this many across all sources, with room to spare (ADR-0011).
export const refreshBudget = 40;

// What refreshing an entry costs, in subrequests: its source says.
function sourceRefreshCost(key: CacheKey): number {
  return sourceOf(key.mediaType).refreshCost;
}

const day = 24 * 60 * 60 * 1000;

// An entry is refreshed once it is this old, so a small deployment doesn't fetch the same works
// from their source every 15 minutes.
const refreshAge = 7 * day;

// An entry nothing references is kept this long, so one just added from search survives until
// the User logs or plans it.
const unreferencedLifetime = day;

function before(now: Date, age: number): Date {
  return new Date(now.getTime() - age);
}

// The cache entry's Media Item, when a Log Entry, List Item or In Progress references it (ADR-0011).
function referenced(db: DrizzleD1Database) {
  return exists(
    db
      .select({ id: mediaItems.id })
      .from(mediaItems)
      .where(
        and(
          eq(mediaItems.externalSource, catalogCache.externalSource),
          eq(mediaItems.mediaType, catalogCache.mediaType),
          eq(mediaItems.externalId, catalogCache.externalId),
          or(
            exists(
              db
                .select({ id: logEntries.id })
                .from(logEntries)
                .where(eq(logEntries.mediaItemId, mediaItems.id)),
            ),
            exists(
              db
                .select({ id: listItems.id })
                .from(listItems)
                .where(eq(listItems.mediaItemId, mediaItems.id)),
            ),
            exists(
              db
                .select({ userId: inProgress.userId })
                .from(inProgress)
                .where(eq(inProgress.mediaItemId, mediaItems.id)),
            ),
          ),
        ),
      ),
  );
}

// The cache entries the cron refreshes next, as many as `budget` subrequests refresh: those a Log
// Entry, List Item or In Progress references and that are a week old, or were filled from a search result
// alone, at any age. Those the cron hasn't tried since come first, then the rest by when they were
// last filled or tried, so an entry its source never answers for goes to the back each run instead
// of taking the batch for good. The batch stops at the first entry that doesn't fit, so none jumps
// the order. A referenced Media Item with no entry isn't due: the first page to show it fills it.
// Nothing reads an unreferenced entry, so it is never refreshed.
export async function dueForRefresh(
  db: DrizzleD1Database,
  now: Date,
  budget = refreshBudget,
  refreshCost: (key: CacheKey) => number = sourceRefreshCost,
): Promise<CacheKey[]> {
  // Every entry costs at least one subrequest, so no more than `budget` can fit.
  const candidates = await db
    .select({
      externalSource: catalogCache.externalSource,
      mediaType: catalogCache.mediaType,
      externalId: catalogCache.externalId,
    })
    .from(catalogCache)
    .where(
      and(
        referenced(db),
        or(isNull(catalogCache.detailedAt), lt(catalogCache.updatedAt, before(now, refreshAge))),
      ),
    )
    .orderBy(
      sql`${catalogCache.detailedAt} is not null or ${catalogCache.checkedAt} is not null`,
      asc(sql`coalesce(${catalogCache.checkedAt}, ${catalogCache.updatedAt})`),
    )
    .limit(budget);
  const due: CacheKey[] = [];
  let spent = 0;
  for (const key of candidates) {
    spent += refreshCost(key);
    if (spent > budget) break;
    due.push(key);
  }
  return due;
}

// Records that their source didn't answer for these entries now, in one query, as storeDetails
// does.
async function markFailed(db: DrizzleD1Database, failed: CacheKey[], now: Date): Promise<void> {
  if (failed.length === 0) return;
  const rows = JSON.stringify(failed);
  await db.run(sql`
    update ${catalogCache} set checked_at = ${now.getTime()}
    where (external_source, media_type, external_id) in
      (select value ->> 'externalSource', value ->> 'mediaType', value ->> 'externalId'
        from json_each(${rows}))`);
}

export interface CacheRefresh {
  refreshed: number;
  failed: number;
  deleted: number;
}

// One cron run: refetches the entries due from their sources, one details fetch each, and writes
// them back in one query. An entry its source doesn't answer for keeps what it shows and is marked
// as tried, to be tried again behind the others. Then it deletes the entries past their source's
// maximum entry age, which there is no refresh on read to renew, and those nothing has referenced
// for a day.
export async function refreshCache(
  db: DrizzleD1Database,
  env: CatalogEnv,
  now: Date,
): Promise<CacheRefresh> {
  const due = await dueForRefresh(db, now);
  const fetched = await fetchDetails(env, due);
  const answered = new Set(fetched.map(cacheKeyId));
  await storeDetails(db, fetched, now);
  const failed = due.filter((key) => !answered.has(cacheKeyId(key)));
  await markFailed(db, failed, now);
  const deleted = await db
    .delete(catalogCache)
    .where(
      or(
        expiredEntries(now),
        and(lt(catalogCache.updatedAt, before(now, unreferencedLifetime)), not(referenced(db))),
      ),
    )
    .returning({ externalId: catalogCache.externalId });
  return {
    refreshed: fetched.length,
    failed: failed.length,
    deleted: deleted.length,
  };
}
