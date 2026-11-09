// What every catalog source module gives (ADR-0005): one module per External Source, and the only
// code that knows that source's API. Shared code reaches a source through the registry alone.
import type { CacheExtra } from "../../db/schema";
import type {
  CatalogSearchResult,
  CoverUrls,
  ExternalSource,
  MediaItem,
  MediaType,
} from "../../shared/api";

// The Worker configuration the sources read, base URLs and credentials, as Env has it. Spelt out,
// since the operator scripts compile this without Env.
export interface CatalogEnv {
  TMDB_BASE_URL: string;
  TMDB_ACCESS_TOKEN?: string | undefined;
}

// A search result before what the app holds about it, its Media Item and the User's Log, Backlog
// and Lists, is added to it.
export type CatalogSearchMatch = Omit<
  CatalogSearchResult,
  "mediaItemId" | "inLog" | "inBacklog" | "currentRating" | "logEntryCount" | "lists"
>;

// What the cache keeps about one External Reference: the columns every Media Type has, and in
// `extra` what only its own has. A title is null when the source has none in that language.
export interface CatalogEntry {
  englishTitle: string | null;
  ukrainianTitle: string | null;
  originalTitle: string;
  year: number | null;
  // The source's own reference to the cover image, such as TMDB's poster path.
  coverRef: string | null;
  extra: CacheExtra;
}

// Why a source didn't answer: the work is gone from it, the source refuses us, or anything else,
// which is worth trying again.
export type SourceFailure = "gone" | "access" | "temporary";

// The source didn't answer, or answered with anything but a usable response.
export class SourceUnavailable extends Error {
  constructor(
    message: string,
    readonly failure: SourceFailure,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

type MetadataOf<M extends MediaType> = NonNullable<
  Extract<MediaItem, { mediaType: M }>["metadata"]
>;

export interface CatalogSource<M extends MediaType = MediaType> {
  externalSource: ExternalSource;
  mediaType: M;
  // How many subrequests refreshing one entry makes, for the cron's budget.
  refreshCost: number;
  // How long an entry may be kept from when it was last filled, in milliseconds; null for no
  // limit. Past it no read shows the entry, whether or not the cron has deleted it yet.
  maxEntryAge: number | null;
  // The first page of the source's matches, in its order. Throws SourceUnavailable.
  search(env: CatalogEnv, query: string): Promise<CatalogSearchMatch[]>;
  // One External Reference's details, as its cache entry holds them. Throws SourceUnavailable.
  details(env: CatalogEnv, externalId: string): Promise<CatalogEntry>;
  // What a search result alone says, for when the details call fails: its cover reference back
  // out of the cover URL search gave, or null for any other URL, so a client can't make the app
  // show images from elsewhere, and an empty `extra`.
  coverRefOf(searchCoverUrl: string | null): string | null;
  emptyExtra: CacheExtra;
  // The cover in the sizes the app shows it, from its reference.
  coverUrls(coverRef: string | null): CoverUrls | null;
  // How a failed response counts, by its HTTP status.
  classifyFailure(status: number): SourceFailure;
  // A cache entry as the API shows it.
  metadataOf(entry: CatalogEntry): MetadataOf<M>;
}

// The titles a cache entry shows under, by ADR-0004's rules for every Media Type: the English
// Localized Title leads, falling back to the Original Title; the Ukrainian one is worth showing
// only when it differs from that.
export function shownTitles(entry: CatalogEntry) {
  const title = entry.englishTitle ?? entry.originalTitle;
  return {
    title,
    originalTitle: entry.originalTitle,
    ukrainianTitle:
      entry.ukrainianTitle && entry.ukrainianTitle !== title ? entry.ukrainianTitle : null,
  };
}
