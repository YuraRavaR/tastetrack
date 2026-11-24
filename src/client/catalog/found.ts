import type {
  CatalogSearchResult,
  ManualSearchResult,
  MediaItem,
  MediaType,
} from "../../shared/api";
import * as api from "../api";
import { mediaWord } from "../i18n/media-words";
import { artistYearAndType } from "./album-label";
import { authorsAndYear } from "./book-label";
import { filmLabel, filmName, filmYearAndRuntime } from "./film-label";
import { yearAndPlatforms } from "./game-label";
import { artistYearAndAlbum, disambiguationOf } from "./song-label";

// A work that search found: one of the User's own Manual Media Items, or an External Source's
// result, which joins the catalog once a User acts on it, if none has yet.
export type Found =
  | ({ kind: "manual" } & ManualSearchResult)
  | ({ kind: "catalog" } & CatalogSearchResult);

// A search's answer as one list, the User's own Manual Media Items first.
export function foundIn(
  manualResults: readonly ManualSearchResult[],
  results: readonly CatalogSearchResult[],
): Found[] {
  return [
    ...manualResults.map((result) => ({ kind: "manual" as const, ...result })),
    ...results.map((result) => ({ kind: "catalog" as const, ...result })),
  ];
}

// The film as a Manual Media Item the User just made: in neither their Log, their Backlog nor their
// Lists.
export function foundManual(mediaItem: MediaItem): Found {
  return {
    kind: "manual",
    mediaItem,
    inLog: false,
    inBacklog: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  };
}

// A key that names the same film whether it is a search result or a Media Item already made.
export function mediaItemKey(mediaItem: MediaItem): string {
  const reference = mediaItem.externalReference;
  return reference ? `${reference.source}:${reference.id}` : `manual:${mediaItem.id}`;
}

export function foundKey(found: Found): string {
  if (found.kind === "manual") return mediaItemKey(found.mediaItem);
  return `${found.externalReference.source}:${found.externalReference.id}`;
}

export function foundMediaType(found: Found): MediaType {
  return found.kind === "manual" ? found.mediaItem.mediaType : found.externalReference.mediaType;
}

// The film's Media Item's id, null for a source's result not in the catalog yet.
export function foundMediaItemId(found: Found): number | null {
  return found.kind === "manual" ? found.mediaItem.id : found.mediaItemId;
}

// "Alien (1979)", as filmLabel writes it.
export function foundLabel(found: Found): string {
  if (found.kind === "catalog") return filmLabel(found);
  const { metadata, mediaType } = found.mediaItem;
  return metadata ? filmLabel(metadata) : mediaWord(mediaType, "unknown");
}

// "Alien", as filmName writes it.
export function foundName(found: Found): string {
  if (found.kind === "catalog") return filmName(found);
  const { metadata, mediaType } = found.mediaItem;
  return metadata ? filmName(metadata) : mediaWord(mediaType, "unknown");
}

// "2001 · 122 min" as far as it is known. A source's result has no runtime until it joins the
// catalog, and a book has none at all.
export function foundYearAndRuntime(found: Found): string | null {
  if (found.kind === "catalog") return filmYearAndRuntime({ year: found.year, runtime: null });
  return mediaItemYearAndRuntime(found.mediaItem);
}

export function mediaItemYearAndRuntime(mediaItem: MediaItem): string | null {
  const { metadata } = mediaItem;
  if (!metadata) return null;
  const runtime = mediaItem.mediaType === "film" ? mediaItem.metadata?.runtime : null;
  return filmYearAndRuntime({ year: metadata.year, runtime: runtime ?? null });
}

// What a result's row says under its title: a book's authors and year, "Іван Багряний · 1946", as
// authorsAndYear writes it, a game's year and platforms, "2015 · PC, PS4, PS5 +4", as
// yearAndPlatforms does, an album's artist, year and type, "The Beatles · 2012 · Remix", as
// artistYearAndType does, and a song's artist, year and album, "Океан Ельзи · 2013 · from Земля",
// as artistYearAndAlbum does. Null for a film or a series, whose year is in its title.
export function foundSubtitle(found: Found): string | null {
  if (found.kind === "catalog") {
    switch (found.externalReference.mediaType) {
      case "book":
        return authorsAndYear(found);
      case "game":
        return yearAndPlatforms({ year: found.year, platforms: found.platforms ?? [] });
      case "album":
        return artistYearAndType({
          year: found.year,
          artistCredit: found.artistCredit ?? null,
          primaryType: found.primaryType ?? null,
          secondaryTypes: found.secondaryTypes ?? [],
        });
      case "song":
        return artistYearAndAlbum({
          year: found.year,
          artistCredit: found.artistCredit ?? null,
          album: found.album ?? null,
        });
      default:
        return null;
    }
  }
  const { mediaItem } = found;
  if (!mediaItem.metadata) return null;
  switch (mediaItem.mediaType) {
    case "book":
      return authorsAndYear(mediaItem.metadata);
    case "game":
      return yearAndPlatforms(mediaItem.metadata);
    case "album":
      return artistYearAndType(mediaItem.metadata);
    case "song":
      return artistYearAndAlbum(mediaItem.metadata);
    default:
      return null;
  }
}

// A song's disambiguation, as disambiguationOf says it.
export function foundDisambiguation(found: Found): string | null {
  return found.kind === "catalog"
    ? (found.disambiguation ?? null)
    : disambiguationOf(found.mediaItem);
}

// Whether a Media Type's rows name a result without its year, which follows on the next line. A
// new Media Type doesn't compile until it says.
const namedWithoutYear: Record<MediaType, boolean> = {
  film: false,
  book: true,
  series: false,
  game: true,
  album: true,
  song: true,
  artist: true,
};

// What a result's row is titled: a film or a series by its label, "Alien (1979)", and a book, a
// game or an album by its name alone, since its year is on the next line.
export function foundRowTitle(found: Found): string {
  return namedWithoutYear[foundMediaType(found)] ? foundName(found) : foundLabel(found);
}

// The film's Media Item, adding a source's result to the catalog first; null when that fails.
export async function mediaItemOf(found: Found): Promise<MediaItem | null> {
  return found.kind === "manual" ? found.mediaItem : api.addToCatalog(found);
}
