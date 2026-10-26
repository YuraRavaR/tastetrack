// Keeping the disposable TMDB cache (ADR-0004) fresh from a Cron Trigger that runs every 15
// minutes: it refreshes a batch of the oldest entries in use and deletes the rest once they expire
// or nothing uses them. There is no refresh on read; a page fills only entries that are missing.
import { and, asc, eq, exists, isNull, lt, not, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { listItems, logEntries, mediaItems, tmdbCache } from "../../db/schema";
import { cacheLifetime, fetchDetails, storeDetails } from "./media-items";
import type { TmdbConfig } from "./tmdb";

export interface CacheKey {
  mediaType: "film";
  externalId: string;
}

// Workers Free allows 50 external subrequests per invocation, cron runs included (ADR-0004), so
// one run refreshes at most this many entries, with room to spare.
export const refreshBatchSize = 40;

const day = 24 * 60 * 60 * 1000;

// An entry is refreshed once it is this old, so a small deployment doesn't fetch the same films
// from TMDB every 15 minutes.
const refreshAge = 7 * day;

// An entry nothing references is kept this long, so one just added from search survives until
// the User logs or plans it.
const unreferencedLifetime = day;

function before(now: Date, age: number): Date {
  return new Date(now.getTime() - age);
}

// The cache entry's Media Item, when a Log Entry or List Item references it.
function referenced(db: DrizzleD1Database) {
  return exists(
    db
      .select({ id: mediaItems.id })
      .from(mediaItems)
      .where(
        and(
          eq(mediaItems.externalSource, "tmdb"),
          eq(mediaItems.mediaType, tmdbCache.mediaType),
          eq(mediaItems.externalId, tmdbCache.externalId),
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
          ),
        ),
      ),
  );
}

// The cache entries the cron refreshes next, at most `limit`: those a Log Entry or List Item
// references and that are a week old, or were filled from a search result alone, at any age. Those
// come first, then the oldest. A referenced Media Item with no entry isn't due: the first page to
// show it fills it. Nothing reads an unreferenced entry, so it is never refreshed.
export async function dueForRefresh(
  db: DrizzleD1Database,
  now: Date,
  limit = refreshBatchSize,
): Promise<CacheKey[]> {
  return db
    .select({ mediaType: tmdbCache.mediaType, externalId: tmdbCache.externalId })
    .from(tmdbCache)
    .where(
      and(
        referenced(db),
        or(isNull(tmdbCache.detailedAt), lt(tmdbCache.updatedAt, before(now, refreshAge))),
      ),
    )
    .orderBy(sql`${tmdbCache.detailedAt} is not null`, asc(tmdbCache.updatedAt))
    .limit(limit);
}

export interface CacheRefresh {
  refreshed: number;
  failed: number;
  deleted: number;
}

// One cron run: refetches the entries due from TMDB, one details call each, and writes them back
// in one query. An entry TMDB doesn't answer for is left as it is, to be tried again next run.
// Then it deletes the entries past the hard expiry, which there is no refresh on read to renew,
// and those nothing has referenced for a day.
export async function refreshCache(
  db: DrizzleD1Database,
  tmdb: TmdbConfig,
  now: Date,
): Promise<CacheRefresh> {
  const due = await dueForRefresh(db, now);
  const fetched = await fetchDetails(tmdb, due);
  await storeDetails(db, fetched, now);
  const deleted = await db
    .delete(tmdbCache)
    .where(
      or(
        lt(tmdbCache.updatedAt, before(now, cacheLifetime)),
        and(lt(tmdbCache.updatedAt, before(now, unreferencedLifetime)), not(referenced(db))),
      ),
    )
    .returning({ externalId: tmdbCache.externalId });
  return {
    refreshed: fetched.length,
    failed: due.length - fetched.length,
    deleted: deleted.length,
  };
}
