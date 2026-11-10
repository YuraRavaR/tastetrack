// The registry of catalog sources (ADR-0005): each Media Type's External Source. Shared code finds
// a source here and never imports one, which `pnpm lint` enforces (biome.json).
import { and, eq, gte, lt, or, type SQL, sql } from "drizzle-orm";
import { catalogCache } from "../../db/schema";
import type { MediaItem, MediaType } from "../../shared/api";
import type { AnyCatalogSource, CatalogEntry, CatalogSource } from "./source";
import { openLibraryBooks } from "./sources/open-library";
import { tmdbFilms } from "./sources/tmdb";

// A new Media Type doesn't compile until it has a source.
const sources: { [M in MediaType]: CatalogSource<M> } = {
  film: tmdbFilms,
  book: openLibraryBooks,
};

// The source of a Media Type's catalog-backed Media Items.
export function sourceOf(mediaType: MediaType): AnyCatalogSource {
  return sources[mediaType];
}

// A cache entry as the API shows it, by its Media Type's source. The entry is that Media Type's,
// since the cache is keyed by it, which the types can't say of a row.
export function metadataOf(mediaType: MediaType, entry: CatalogEntry): MediaItem["metadata"] {
  const source = sources[mediaType] as CatalogSource<MediaType>;
  return source.metadataOf(entry);
}

// Every source, for what applies to each of them in turn.
const catalogSources: readonly AnyCatalogSource[] = Object.values(sources);

// The source of a cache entry or External Reference, if it names one the registry has.
export function sourceNamed(
  externalSource: string,
  mediaType: string,
): AnyCatalogSource | undefined {
  return catalogSources.find(
    (source) => source.externalSource === externalSource && source.mediaType === mediaType,
  );
}

// The oldest a source's entry may be and still be shown, or null when its entries never expire.
export function oldestShown(source: AnyCatalogSource, now: Date): Date | null {
  return source.maxEntryAge === null ? null : new Date(now.getTime() - source.maxEntryAge);
}

// Whether a cache entry may still be shown, by its source's maximum entry age.
export function isShown(
  entry: { externalSource: string; mediaType: string; updatedAt: Date },
  now: Date,
): boolean {
  const source = sourceNamed(entry.externalSource, entry.mediaType);
  const oldest = source && oldestShown(source, now);
  return !oldest || entry.updatedAt >= oldest;
}

// The cache entries of one source.
function ofSource(source: AnyCatalogSource): SQL | undefined {
  return and(
    eq(catalogCache.externalSource, source.externalSource),
    eq(catalogCache.mediaType, source.mediaType),
  );
}

// The cache entries past their source's maximum entry age, which no read shows.
export function expiredEntries(now: Date): SQL {
  const expired = catalogSources.flatMap((source) => {
    const oldest = oldestShown(source, now);
    return oldest ? [and(ofSource(source), lt(catalogCache.updatedAt, oldest))] : [];
  });
  return or(...expired) ?? sql`false`;
}

// The cache entries a read may show: those of a source with no maximum entry age, and the rest
// while they are younger than theirs.
export function shownEntries(now: Date): SQL {
  const shown = catalogSources.map((source) => {
    const oldest = oldestShown(source, now);
    return oldest ? and(ofSource(source), gte(catalogCache.updatedAt, oldest)) : ofSource(source);
  });
  return or(...shown) ?? sql`false`;
}
