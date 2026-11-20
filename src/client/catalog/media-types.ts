import { BookOpen, Clapperboard, Gamepad2, type LucideIcon, Tv } from "lucide-react";
import type { MediaType } from "../../shared/api";
import type { ProgressMediaType as WorkerProgressMediaType } from "../../shared/catalog";
import type { Progress } from "../../shared/progress";

// A new Media Type doesn't compile until it has an icon.
const mediaTypeIcons: Record<MediaType, LucideIcon> = {
  film: Clapperboard,
  book: BookOpen,
  series: Tv,
  game: Gamepad2,
};

export function mediaTypeIcon(mediaType: MediaType): LucideIcon {
  return mediaTypeIcons[mediaType];
}

// The Media Types each section offers, in the one order they all keep. Music stays out until an
// ADR chooses its External Source.
export const searchMediaTypes: readonly MediaType[] = ["film", "book", "series", "game"];
export const listsMediaTypes: readonly MediaType[] = ["film", "book", "series", "game"];
export const savedMediaTypes: readonly MediaType[] = ["film", "book", "series", "game"];

// What a User does to keep a Media Item: marks it Planned, logs it, puts it in Collections, or
// adds one by hand.
export type Keeping = "plan" | "log" | "collect" | "addByHand";

// What a User can do with Media Items of each type so far.
const keepings: Record<MediaType, readonly Keeping[]> = {
  film: ["plan", "log", "collect", "addByHand"],
  book: ["plan", "log", "collect", "addByHand"],
  series: ["plan", "log", "collect", "addByHand"],
  game: ["plan", "log", "collect", "addByHand"],
};

export function can(mediaType: MediaType, keeping: Keeping): boolean {
  return keepings[mediaType].includes(keeping);
}

// Whether a new Log Entry for a Media Item the User has logged before starts as a Revisit. A film,
// a book or a game logged again is most often experienced again from the start; a series most
// often goes on with a new season, which is no Revisit (ADR-0005).
const revisitsByDefault: Record<MediaType, boolean> = {
  film: true,
  book: true,
  series: false,
  game: true,
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
export type ProgressKind = Progress["mediaType"];

const progressKinds: readonly ProgressKind[] = ["book", "series"];

export function hasProgress(mediaType: MediaType): mediaType is ProgressKind {
  return (progressKinds as readonly MediaType[]).includes(mediaType);
}
