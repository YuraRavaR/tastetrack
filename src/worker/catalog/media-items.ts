// Catalog-backed Media Items and their metadata in the disposable TMDB cache (ADR-0004). Only the
// External Reference is User-facing data; everything read from the cache may be missing.
import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { mediaItems, tmdbCache } from "../../db/schema";
import type {
  AddCatalogItemRequest,
  ExternalReference,
  FilmMetadata,
  MediaItem,
} from "../../shared/api";
import { filmDetails, posterPathOf, posterUrl, type TmdbConfig, TmdbUnavailable } from "./tmdb";

type CacheEntry = typeof tmdbCache.$inferSelect;

// Joins a Media Item to its cache entry, if any: `.leftJoin(tmdbCache, cacheOfMediaItem)`.
export const cacheOfMediaItem = and(
  eq(mediaItems.externalSource, "tmdb"),
  eq(tmdbCache.mediaType, mediaItems.mediaType),
  eq(tmdbCache.externalId, mediaItems.externalId),
);

// The columns `toMediaItem` needs, from media_items left-joined with tmdb_cache.
export const mediaItemColumns = {
  mediaItemId: mediaItems.id,
  mediaType: mediaItems.mediaType,
  externalSource: mediaItems.externalSource,
  externalId: mediaItems.externalId,
  cache: {
    englishTitle: tmdbCache.englishTitle,
    ukrainianTitle: tmdbCache.ukrainianTitle,
    originalTitle: tmdbCache.originalTitle,
    year: tmdbCache.year,
    posterPath: tmdbCache.posterPath,
    runtime: tmdbCache.runtime,
    genres: tmdbCache.genres,
  },
};

type CachedMetadata = Pick<CacheEntry, keyof (typeof mediaItemColumns)["cache"]>;

interface MediaItemRow {
  mediaItemId: number;
  mediaType: "film";
  externalSource: "tmdb" | null;
  externalId: string | null;
  // Null when the cache has no entry for the item.
  cache: CachedMetadata | null;
}

// The English Localized Title leads, falling back to the Original Title; the Ukrainian one is
// worth showing only when it differs from that.
function toMetadata(cached: CachedMetadata): FilmMetadata {
  const title = cached.englishTitle ?? cached.originalTitle;
  return {
    title,
    originalTitle: cached.originalTitle,
    ukrainianTitle:
      cached.ukrainianTitle && cached.ukrainianTitle !== title ? cached.ukrainianTitle : null,
    year: cached.year,
    posterUrl: posterUrl(cached.posterPath),
    runtime: cached.runtime,
    genres: cached.genres ?? [],
  };
}

export function toMediaItem(row: MediaItemRow): MediaItem {
  if (row.externalSource === null || row.externalId === null) {
    throw new Error(`Media Item ${row.mediaItemId} has no External Reference`);
  }
  return {
    id: row.mediaItemId,
    mediaType: row.mediaType,
    externalReference: { source: row.externalSource, mediaType: row.mediaType, id: row.externalId },
    metadata: row.cache && toMetadata(row.cache),
  };
}

function byExternalReference({ source, mediaType, id }: ExternalReference) {
  return and(
    eq(mediaItems.externalSource, source),
    eq(mediaItems.mediaType, mediaType),
    eq(mediaItems.externalId, id),
  );
}

// What a search result alone says about a film: its title in the language the search ran in,
// unless that is just TMDB falling back to the Original Title. No runtime or genres.
function fromSearchResult(result: AddCatalogItemRequest): CachedMetadata {
  const translated = result.title !== result.originalTitle ? result.title : null;
  return {
    englishTitle: result.titleLanguage === "en" ? translated : null,
    ukrainianTitle: result.titleLanguage === "uk" ? translated : null,
    originalTitle: result.originalTitle,
    year: result.year,
    posterPath: posterPathOf(result.posterUrl),
    runtime: null,
    genres: null,
  };
}

export interface AddedMediaItem {
  mediaItem: MediaItem;
  // False when the Media Item already existed.
  created: boolean;
}

// Creates the search result's catalog-backed Media Item, or finds it if it exists, and fills its
// cache entry with one details call unless an earlier one already did. If that call fails, adding
// still succeeds: the search result fills a missing entry instead, and a later add or the cron
// fills in the rest. A search result never overwrites an entry, since it is only what the client
// says TMDB said.
export async function addFromSearch(
  db: DrizzleD1Database,
  tmdb: TmdbConfig,
  result: AddCatalogItemRequest,
  now: Date,
): Promise<AddedMediaItem> {
  const reference = result.externalReference;
  const cacheKey = and(
    eq(tmdbCache.mediaType, reference.mediaType),
    eq(tmdbCache.externalId, reference.id),
  );
  const [inserted, [item], [cached]] = await db.batch([
    db
      .insert(mediaItems)
      .values({
        mediaType: reference.mediaType,
        externalSource: reference.source,
        externalId: reference.id,
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: mediaItems.id }),
    db.select({ id: mediaItems.id }).from(mediaItems).where(byExternalReference(reference)),
    db.select().from(tmdbCache).where(cacheKey),
  ]);
  if (!item) throw new Error(`Media Item for TMDB ${reference.id} neither inserted nor found`);

  let metadata: CachedMetadata | undefined = cached;
  if (!cached?.detailedAt) {
    try {
      const details: CachedMetadata = await filmDetails(tmdb, reference.id);
      const columns = { ...details, updatedAt: now, detailedAt: now };
      await db
        .insert(tmdbCache)
        .values({ mediaType: reference.mediaType, externalId: reference.id, ...columns })
        .onConflictDoUpdate({ target: [tmdbCache.mediaType, tmdbCache.externalId], set: columns });
      metadata = details;
    } catch (error) {
      if (!(error instanceof TmdbUnavailable)) throw error;
      console.error(error);
      if (!cached) {
        metadata = fromSearchResult(result);
        await db
          .insert(tmdbCache)
          .values({
            mediaType: reference.mediaType,
            externalId: reference.id,
            ...metadata,
            updatedAt: now,
          })
          .onConflictDoNothing();
      }
    }
  }

  return {
    mediaItem: {
      id: item.id,
      mediaType: reference.mediaType,
      externalReference: reference,
      metadata: metadata ? toMetadata(metadata) : null,
    },
    created: inserted.length > 0,
  };
}
