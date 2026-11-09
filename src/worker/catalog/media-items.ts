// Media Items as Users see them: catalog-backed ones with their metadata in the disposable catalog
// cache (ADR-0004), where only the External Reference is User-facing data and everything read
// from the cache may be missing, and Manual Media Items with their own.
import { and, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { catalogCache, mediaItems } from "../../db/schema";
import type {
  AddCatalogItemRequest,
  ExternalReference,
  FilmMetadata,
  MediaItem,
  MediaType,
} from "../../shared/api";
import { maxMetadataFills } from "../../shared/catalog";
import {
  backdropUrls,
  type FilmDetails,
  filmDetails,
  posterPathOf,
  posterUrls,
  type TmdbConfig,
  TmdbUnavailable,
} from "./tmdb";

type CacheEntry = typeof catalogCache.$inferSelect;

// TMDB allows caching for 6 months; we keep an entry 90 days from when it was last filled. Past
// that no read shows it, whether or not the cron has deleted it yet.
const cacheLifetime = 90 * 24 * 60 * 60 * 1000;

// The oldest an entry may be and still be shown; an older one has expired.
export function oldestShown(now: Date): Date {
  return new Date(now.getTime() - cacheLifetime);
}

// Joins a Media Item to its cache entry, if any and not past the hard expiry:
// `.leftJoin(catalogCache, cacheOfMediaItem(now))`. An expired entry reads as a miss, which the
// page fills like any other. A Manual Media Item has no External Reference, so it joins nothing.
export function cacheOfMediaItem(now: Date) {
  return and(
    eq(catalogCache.externalSource, mediaItems.externalSource),
    eq(catalogCache.mediaType, mediaItems.mediaType),
    eq(catalogCache.externalId, mediaItems.externalId),
    gte(catalogCache.updatedAt, oldestShown(now)),
  );
}

// For a query of Manual Media Items alone, which have no cache entry, in place of
// `cacheOfMediaItem`: it joins nothing, but gives `mediaItemColumns` the table they name.
export const noCacheEntry = sql`false`;

// The Media Items the User may see: every catalog-backed one, and their own Manual Media Items.
// Another User's is as unknown as one that doesn't exist.
export function visibleTo(userId: number) {
  return or(isNull(mediaItems.ownerId), eq(mediaItems.ownerId, userId));
}

// The columns `toMediaItem` needs, from media_items left-joined with catalog_cache.
export const mediaItemColumns = {
  mediaItemId: mediaItems.id,
  mediaType: mediaItems.mediaType,
  externalSource: mediaItems.externalSource,
  externalId: mediaItems.externalId,
  manual: {
    title: mediaItems.title,
    originalTitle: mediaItems.originalTitle,
    year: mediaItems.year,
    runtime: mediaItems.runtime,
    genres: mediaItems.genres,
  },
  // Drizzle reads a left join's columns as no entry when the first of them is null, so they lead
  // with one that never is.
  cache: {
    originalTitle: catalogCache.originalTitle,
    englishTitle: catalogCache.englishTitle,
    ukrainianTitle: catalogCache.ukrainianTitle,
    year: catalogCache.year,
    coverRef: catalogCache.coverRef,
    extra: catalogCache.extra,
  },
};

type CachedMetadata = Pick<CacheEntry, keyof (typeof mediaItemColumns)["cache"]>;

type ManualMetadata = Pick<
  typeof mediaItems.$inferSelect,
  keyof (typeof mediaItemColumns)["manual"]
>;

interface MediaItemRow {
  mediaItemId: number;
  mediaType: "film";
  externalSource: "tmdb" | null;
  externalId: string | null;
  // All null for a catalog-backed item.
  manual: ManualMetadata;
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
    posterUrls: posterUrls(cached.coverRef),
    backdropUrls: backdropUrls(cached.extra.backdropPath),
    runtime: cached.extra.runtime,
    genres: cached.extra.genres ?? [],
  };
}

// A film's details as its cache entry holds them.
function fromDetails(details: FilmDetails): CachedMetadata {
  const { posterPath, backdropPath, runtime, genres, ...titlesAndYear } = details;
  return { ...titlesAndYear, coverRef: posterPath, extra: { backdropPath, runtime, genres } };
}

// A Manual Media Item shows the title its User gave, in any language, unchanged, with the title
// standing in for an Original Title it doesn't have, as TMDB's does.
function fromManual(id: number, manual: ManualMetadata): FilmMetadata {
  if (manual.title === null) {
    throw new Error(`Media Item ${id} has neither an External Reference nor a title`);
  }
  return {
    title: manual.title,
    originalTitle: manual.originalTitle ?? manual.title,
    ukrainianTitle: null,
    year: manual.year,
    posterUrls: null,
    backdropUrls: null,
    runtime: manual.runtime,
    genres: manual.genres ?? [],
  };
}

export function toMediaItem(row: MediaItemRow): MediaItem {
  if (row.externalSource === null || row.externalId === null) {
    return {
      id: row.mediaItemId,
      mediaType: row.mediaType,
      externalReference: null,
      metadata: fromManual(row.mediaItemId, row.manual),
    };
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
// unless that is just TMDB falling back to the Original Title. No backdrop, runtime or genres.
function fromSearchResult(result: AddCatalogItemRequest): CachedMetadata {
  const translated = result.title !== result.originalTitle ? result.title : null;
  return {
    englishTitle: result.titleLanguage === "en" ? translated : null,
    ukrainianTitle: result.titleLanguage === "uk" ? translated : null,
    originalTitle: result.originalTitle,
    year: result.year,
    coverRef: posterPathOf(result.posterUrl),
    extra: { backdropPath: null, runtime: null, genres: null },
  };
}

// A cache entry's key: the External Reference it holds the metadata of.
export interface CacheKey {
  externalSource: "tmdb";
  mediaType: "film";
  externalId: string;
}

export interface FetchedDetails extends CacheKey {
  entry: CachedMetadata;
}

// One TMDB details call for each film, all at once. A film TMDB doesn't answer for is left out.
export async function fetchDetails(tmdb: TmdbConfig, films: CacheKey[]): Promise<FetchedDetails[]> {
  const fetched = await Promise.all(
    films.map(async (key) => {
      try {
        return { ...key, entry: fromDetails(await filmDetails(tmdb, key.externalId)) };
      } catch (error) {
        if (!(error instanceof TmdbUnavailable)) throw error;
        console.error(error);
        return null;
      }
    }),
  );
  return fetched.filter((film) => film !== null);
}

// Writes the details fetched for any number of entries into the cache, in one query:
// the rows travel as one JSON parameter, since D1 allows only 100 bound parameters a query.
export async function storeDetails(
  db: DrizzleD1Database,
  fetched: FetchedDetails[],
  now: Date,
): Promise<void> {
  if (fetched.length === 0) return;
  const rows = JSON.stringify(fetched.map(({ entry, ...key }) => ({ ...key, ...entry })));
  const at = now.getTime();
  // An upsert from a select needs a where clause, or SQLite reads "on" as a join's.
  await db.run(sql`
    insert into ${catalogCache} (external_source, media_type, external_id, english_title,
      ukrainian_title, original_title, year, cover_ref, extra, updated_at, detailed_at, checked_at)
    select value ->> 'externalSource', value ->> 'mediaType', value ->> 'externalId',
      value ->> 'englishTitle', value ->> 'ukrainianTitle', value ->> 'originalTitle',
      value ->> 'year', value ->> 'coverRef', value -> 'extra', ${at}, ${at}, null
    from json_each(${rows}) where true
    on conflict (external_source, media_type, external_id) do update set
      english_title = excluded.english_title, ukrainian_title = excluded.ukrainian_title,
      original_title = excluded.original_title, year = excluded.year,
      cover_ref = excluded.cover_ref, extra = excluded.extra, updated_at = excluded.updated_at,
      detailed_at = excluded.detailed_at, checked_at = excluded.checked_at`);
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
// says TMDB said, unless the entry has expired: that counts as none.
export async function addFromSearch(
  db: DrizzleD1Database,
  tmdb: TmdbConfig,
  result: AddCatalogItemRequest,
  now: Date,
): Promise<AddedMediaItem> {
  const reference = result.externalReference;
  const key = {
    externalSource: reference.source,
    mediaType: reference.mediaType,
    externalId: reference.id,
  };
  const cacheKey = and(
    eq(catalogCache.externalSource, key.externalSource),
    eq(catalogCache.mediaType, key.mediaType),
    eq(catalogCache.externalId, key.externalId),
  );
  const cacheTarget = [
    catalogCache.externalSource,
    catalogCache.mediaType,
    catalogCache.externalId,
  ];
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
    db.select().from(catalogCache).where(cacheKey),
  ]);
  if (!item) throw new Error(`Media Item for TMDB ${reference.id} neither inserted nor found`);

  const shown = cached && cached.updatedAt >= oldestShown(now) ? cached : undefined;
  let metadata: CachedMetadata | undefined = shown;
  if (!shown?.detailedAt) {
    try {
      const details = fromDetails(await filmDetails(tmdb, reference.id));
      const columns = { ...details, updatedAt: now, detailedAt: now, checkedAt: null };
      await db
        .insert(catalogCache)
        .values({ ...key, ...columns })
        .onConflictDoUpdate({ target: cacheTarget, set: columns });
      metadata = details;
    } catch (error) {
      if (!(error instanceof TmdbUnavailable)) throw error;
      console.error(error);
      if (!shown) {
        metadata = fromSearchResult(result);
        const columns = { ...metadata, updatedAt: now, detailedAt: null, checkedAt: null };
        await db
          .insert(catalogCache)
          .values({ ...key, ...columns })
          .onConflictDoUpdate({
            target: cacheTarget,
            set: columns,
            setWhere: lt(catalogCache.updatedAt, oldestShown(now)),
          });
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

function cacheKeyOf({ source, mediaType, id }: ExternalReference): CacheKey {
  return { externalSource: source, mediaType, externalId: id };
}

export function keyString({ externalSource, mediaType, externalId }: CacheKey): string {
  return `${externalSource}/${mediaType}/${externalId}`;
}

// Fills in place the metadata of the first `maxMetadataFills` catalog-backed Media Items, in the
// order given, that came without it because the cache has no entry for them: one TMDB details call
// each, all at once, and one query to write them all to the cache. The rest stay null for the
// client to load by id, so a page's time and queries don't grow with how much the cache misses.
export async function fillMissingMetadata(
  db: DrizzleD1Database,
  tmdb: TmdbConfig,
  items: MediaItem[],
  now: Date,
): Promise<void> {
  const missing = new Map<string, CacheKey>();
  for (const { externalReference, metadata } of items) {
    if (missing.size === maxMetadataFills) break;
    if (externalReference && !metadata) {
      const key = cacheKeyOf(externalReference);
      missing.set(keyString(key), key);
    }
  }
  if (missing.size === 0) return;
  const fetched = await fetchDetails(tmdb, [...missing.values()]);
  await storeDetails(db, fetched, now);
  const entries = new Map(fetched.map(({ entry, ...key }) => [keyString(key), entry]));
  for (const item of items) {
    const filled =
      item.externalReference && entries.get(keyString(cacheKeyOf(item.externalReference)));
    if (filled) item.metadata = toMetadata(filled);
  }
}

// The ids of the catalog-backed Media Items for these External Source ids of one Media Type, by
// External Source id. A work not in the catalog yet has no entry.
export async function mediaItemIdsByExternalId(
  db: DrizzleD1Database,
  source: "tmdb",
  mediaType: MediaType,
  externalIds: string[],
): Promise<Map<string, number>> {
  if (externalIds.length === 0) return new Map();
  const rows = await db
    .select({ id: mediaItems.id, externalId: mediaItems.externalId })
    .from(mediaItems)
    .where(
      and(
        eq(mediaItems.externalSource, source),
        eq(mediaItems.mediaType, mediaType),
        inArray(mediaItems.externalId, externalIds),
      ),
    );
  return new Map(
    rows.flatMap((row) => (row.externalId === null ? [] : [[row.externalId, row.id]])),
  );
}

// The catalog-backed Media Items with these ids, in the order given, with their metadata filled
// where the cache misses it. Anyone may see these, so Manual Media Items are left out, as are ids
// that match nothing.
export async function catalogMediaItems(
  db: DrizzleD1Database,
  tmdb: TmdbConfig,
  ids: number[],
  now: Date,
): Promise<MediaItem[]> {
  const rows = await db
    .select(mediaItemColumns)
    .from(mediaItems)
    .leftJoin(catalogCache, cacheOfMediaItem(now))
    .where(and(inArray(mediaItems.id, ids), isNotNull(mediaItems.externalId)));
  const byId = new Map(rows.map((row) => [row.mediaItemId, toMediaItem(row)]));
  const items = [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
  await fillMissingMetadata(db, tmdb, items, now);
  return items;
}
