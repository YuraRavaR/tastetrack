// What every catalog source module gives (ADR-0005): one module per External Source in
// ./sources/, and the only code that knows that source's API. Shared code reaches a source
// through the registry alone.
import type { AnyD1Database } from "drizzle-orm/d1";
import type { CacheExtras } from "../../db/schema";
import type {
  About,
  CatalogSearchMatch,
  CoverUrls,
  ExternalSource,
  MediaItem,
  MediaType,
} from "../../shared/api";

// The Worker configuration the sources read, base URLs and credentials, as Env has it, and its
// database. Spelt out, since the operator scripts compile this without Env.
export interface CatalogEnv {
  TMDB_BASE_URL: string;
  TMDB_ACCESS_TOKEN?: string | undefined;
  OPEN_LIBRARY_BASE_URL: string;
  // How Open Library can reach the Operator, which every request to it carries (ADR-0011).
  OPEN_LIBRARY_CONTACT?: string | undefined;
  IGDB_BASE_URL: string;
  // Where IGDB's access tokens come from, and the Twitch application they are for (ADR-0012).
  TWITCH_TOKEN_URL: string;
  TWITCH_CLIENT_ID?: string | undefined;
  TWITCH_CLIENT_SECRET?: string | undefined;
  // Where albums and their covers come from, and how many milliseconds apart MusicBrainz is
  // called, 1100 when unset (ADR-0013). MusicBrainz is told who is asking with the Operator
  // contact Open Library has.
  MUSICBRAINZ_BASE_URL: string;
  COVER_ART_ARCHIVE_BASE_URL: string;
  MUSICBRAINZ_INTERVAL_MS?: string | undefined;
  // Where artists' photos and their credits come from (ADR-0013, Artists): Wikidata's and
  // Wikimedia Commons' APIs, which take no key.
  WIKIDATA_BASE_URL: string;
  COMMONS_BASE_URL: string;
  // Where a source keeps the access token it was given (source_tokens).
  DB: AnyD1Database;
}

export type { CatalogSearchMatch };

// What the cache keeps about one External Reference: the columns every Media Type has, and in
// `extra` what only its own has. A title is null when the source has none in that language.
export interface CatalogEntry<M extends MediaType = MediaType> {
  englishTitle: string | null;
  ukrainianTitle: string | null;
  originalTitle: string;
  year: number | null;
  // The source's own reference to the cover image, such as TMDB's poster path.
  coverRef: string | null;
  extra: CacheExtras[M];
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

// The source said it is too busy to answer now, even when asked again: worth trying again in a
// moment, which a search tells the User (ADR-0013).
export class SourceBusy extends SourceUnavailable {
  constructor(message: string) {
    super(message, "temporary");
  }
}

// The metadata a Media Item of this Media Type has.
type MetadataOf<M extends MediaType> = NonNullable<
  Extract<MediaItem, { mediaType: M }>["metadata"]
>;

// What a Media Item of this Media Type shows in its About block. A Media Type that shows none yet
// has none, so its source answers null.
export type AboutOf<M extends MediaType> = Extract<About, { mediaType: M }>;

// One External Source's catalog of one Media Type: how to search it, fetch an entry's details and
// show its covers, and the rules its cache entries keep.
export interface CatalogSource<M extends MediaType> {
  externalSource: ExternalSource;
  mediaType: M;
  // How many subrequests refreshing one entry makes, for the cron's budget.
  refreshCost: number;
  // How many of those are its External Source's, which its share counts, when not all of them: an
  // artist's Wikimedia calls count toward the budget but not toward MusicBrainz's share.
  refreshShareCost?: number;
  // For a source that must be called slowly, the most of a cron run's budget its External Source's
  // entries may take, whichever of its Media Types they are, so each of them gives the same; the
  // rest is left to the other sources (ADR-0013). Without it, its entries take what they need.
  refreshShare?: number;
  // How long an entry may be kept from when it was last filled, in milliseconds; null for no
  // limit. Past it no read shows the entry, whether or not the cron has deleted it yet.
  maxEntryAge: number | null;
  // The first page of the source's matches, in its order. Throws SourceUnavailable. A Media Type
  // the browser searches itself, as songs are (ADR-0013), has none.
  search?(env: CatalogEnv, query: string): Promise<CatalogSearchMatch[]>;
  // One External Reference's details, as its cache entry holds them, read at `now`. A source that
  // refreshes from the entry it replaces gets it as `previous` from the cron. Throws
  // SourceUnavailable.
  details(
    env: CatalogEnv,
    externalId: string,
    now: Date,
    previous?: CatalogEntry<M>,
  ): Promise<CatalogEntry<M>>;
  // Whether the cron passes `details` the entry it refreshes: an artist keeps a photo it read
  // before when Wikimedia fails (ADR-0013, Artists).
  refreshesFromPrevious?: boolean;
  // What a search result alone says, for when the details call fails: its cover reference back
  // out of the cover URL search gave, or null for any other URL, so a client can't make the app
  // show images from elsewhere, and an empty `extra`.
  coverRefOf(searchCoverUrl: string | null, env: CatalogEnv): string | null;
  emptyExtra: CacheExtras[M];
  // The cover in the sizes the app shows it, from its reference.
  coverUrls(coverRef: string | null): CoverUrls | null;
  // For a source whose add refuses to run without its credentials, whether the Worker has them:
  // without them, add answers 502, as search does, rather than keep a search result it can never
  // fill in, so a missing secret is easy to spot (ADR-0012). A source without it adds from the
  // search result whatever the reason its details call failed.
  configured?(env: CatalogEnv): boolean;
  // How a failed response counts, by its HTTP status.
  classifyFailure(status: number): SourceFailure;
  // A cache entry as the API shows it.
  metadataOf(entry: CatalogEntry<M>): MetadataOf<M>;
  // What a cache entry says the work is about, for its page alone, or null when nothing.
  aboutOf(entry: CatalogEntry<M>): AboutOf<M> | null;
}

// The source of any one Media Type, for code that works with whichever a Media Item has.
export type AnyCatalogSource = { [M in MediaType]: CatalogSource<M> }[MediaType];

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
