import type {
  CatalogSearchResult,
  ManualSearchResult,
  MediaItem,
  MediaType,
} from "../../shared/api";
import * as api from "../api";
import { mediaWord } from "../i18n/media-words";
import { authorsAndYear } from "./book-label";
import { filmLabel, filmName, filmYearAndRuntime } from "./film-label";

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

// "Іван Багряний · 1946", as authorsAndYear writes it: what a book's row says under its title.
// Null for a film, whose year is in its title.
export function foundAuthorsAndYear(found: Found): string | null {
  if (foundMediaType(found) !== "book") return null;
  if (found.kind === "catalog") return authorsAndYear(found);
  const { mediaItem } = found;
  return mediaItem.mediaType === "book" && mediaItem.metadata
    ? authorsAndYear(mediaItem.metadata)
    : null;
}

// What a result's row is titled: a film by its label, "Alien (1979)", and a book by its name
// alone, since its year follows its authors on the next line.
export function foundRowTitle(found: Found): string {
  return foundMediaType(found) === "book" ? foundName(found) : foundLabel(found);
}

// The film's Media Item, adding a source's result to the catalog first; null when that fails.
export async function mediaItemOf(found: Found): Promise<MediaItem | null> {
  return found.kind === "manual" ? found.mediaItem : api.addToCatalog(found);
}
