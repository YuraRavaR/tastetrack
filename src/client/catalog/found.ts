import type {
  CatalogSearchResult,
  ManualSearchResult,
  MediaItem,
  MediaType,
} from "../../shared/api";
import * as api from "../api";
import { t } from "../i18n/t";
import { filmLabel, filmName, filmYearAndRuntime } from "./film-label";

// A film that search found: one of the User's own Manual Media Items, or a TMDB result, which
// joins the catalog once a User acts on it, if none has yet.
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

// The film's Media Item's id, null for a TMDB result not in the catalog yet.
export function foundMediaItemId(found: Found): number | null {
  return found.kind === "manual" ? found.mediaItem.id : found.mediaItemId;
}

// "Alien (1979)", as filmLabel writes it.
export function foundLabel(found: Found): string {
  if (found.kind === "catalog") return filmLabel(found);
  const metadata = found.mediaItem.metadata;
  return metadata ? filmLabel(metadata) : t("film.unknown");
}

// "Alien", as filmName writes it.
export function foundName(found: Found): string {
  if (found.kind === "catalog") return filmName(found);
  const metadata = found.mediaItem.metadata;
  return metadata ? filmName(metadata) : t("film.unknown");
}

// "2001 · 122 min" as far as it is known. A TMDB result has no runtime until it joins the catalog.
export function foundYearAndRuntime(found: Found): string | null {
  if (found.kind === "catalog") return filmYearAndRuntime({ year: found.year, runtime: null });
  const metadata = found.mediaItem.metadata;
  return metadata && filmYearAndRuntime(metadata);
}

// The film's Media Item, adding a TMDB result to the catalog first; null when that fails.
export async function mediaItemOf(found: Found): Promise<MediaItem | null> {
  return found.kind === "manual" ? found.mediaItem : api.addToCatalog(found);
}
