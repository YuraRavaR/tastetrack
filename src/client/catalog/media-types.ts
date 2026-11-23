import { BookOpen, Clapperboard, Disc3, Gamepad2, type LucideIcon, Music, Tv } from "lucide-react";
import type { MediaType } from "../../shared/api";
import type { ProgressMediaType as WorkerProgressMediaType } from "../../shared/catalog";
import type { BacklogMediaType } from "../../shared/lists";
import type { Progress } from "../../shared/progress";

// A new Media Type doesn't compile until it has an icon.
const mediaTypeIcons: Record<MediaType, LucideIcon> = {
  film: Clapperboard,
  book: BookOpen,
  series: Tv,
  game: Gamepad2,
  album: Disc3,
  song: Music,
};

export function mediaTypeIcon(mediaType: MediaType): LucideIcon {
  return mediaTypeIcons[mediaType];
}

// The Media Types each section offers, in the one order they all keep (ADR-0005). Saved never
// offers a light one, a song, which has no Library.
export const searchMediaTypes: readonly MediaType[] = ["film", "book", "series", "game", "album"];
export const listsMediaTypes: readonly MediaType[] = ["film", "book", "series", "game", "album"];
export const savedMediaTypes: readonly BacklogMediaType[] = [
  "film",
  "book",
  "series",
  "game",
  "album",
];

// What a User does to keep a Media Item: marks it Planned, logs it, puts it in Collections, or
// adds one by hand.
export type Keeping = "plan" | "log" | "collect" | "addByHand";

// What a User can do with Media Items of each type so far.
const keepings: Record<MediaType, readonly Keeping[]> = {
  film: ["plan", "log", "collect", "addByHand"],
  book: ["plan", "log", "collect", "addByHand"],
  series: ["plan", "log", "collect", "addByHand"],
  game: ["plan", "log", "collect", "addByHand"],
  album: ["plan", "log", "collect", "addByHand"],
  // Nothing yet: the songs UI (#283) offers a song's Collections and adding one by hand.
  song: [],
};

export function can(mediaType: MediaType, keeping: Keeping): boolean {
  return keepings[mediaType].includes(keeping);
}

// Whether a new Log Entry for a Media Item the User has logged before starts as a Revisit. A film,
// a book, a game or an album logged again is most often experienced again from the start; a series
// most often goes on with a new season, which is no Revisit (ADR-0005).
const revisitsByDefault: Record<MediaType, boolean> = {
  film: true,
  book: true,
  series: false,
  game: true,
  album: true,
  // Never asked: a song has no Log Entries.
  song: false,
};

export function startsAsRevisit(mediaType: MediaType): boolean {
  return revisitsByDefault[mediaType];
}

// The Media Types the client lets a User start, among those the Worker gives In Progress
// (src/shared/catalog.ts). A new one doesn't compile until the catalogue has its In Progress words
// (progressWord).
const startableMediaTypes = [
  "book",
  "series",
  "game",
] as const satisfies readonly WorkerProgressMediaType[];

export type ProgressMediaType = (typeof startableMediaTypes)[number];

export function canProgress(mediaType: MediaType): mediaType is ProgressMediaType {
  return (startableMediaTypes as readonly MediaType[]).includes(mediaType);
}

// The Media Types whose In Progress holds Progress: a series' episode and a book's page. A game is
// played without one (ADR-0012).
export type MediaTypeWithProgress = Progress["mediaType"];

const mediaTypesWithProgress: Record<MediaTypeWithProgress, true> = { book: true, series: true };

// Whether a Media Type's In Progress holds Progress.
export function hasProgress(mediaType: MediaType): mediaType is MediaTypeWithProgress {
  return mediaType in mediaTypesWithProgress;
}
