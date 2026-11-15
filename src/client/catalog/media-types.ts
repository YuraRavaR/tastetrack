import { BookOpen, Clapperboard, type LucideIcon, Tv } from "lucide-react";
import type { MediaType } from "../../shared/api";

// A new Media Type doesn't compile until it has an icon.
const mediaTypeIcons: Record<MediaType, LucideIcon> = {
  film: Clapperboard,
  book: BookOpen,
  series: Tv,
};

export function mediaTypeIcon(mediaType: MediaType): LucideIcon {
  return mediaTypeIcons[mediaType];
}

// The Media Types each section offers, in the one order they all keep. Music and Games stay out
// until each has an ADR choosing its External Source.
export const searchMediaTypes: readonly MediaType[] = ["film", "book", "series"];
export const listsMediaTypes: readonly MediaType[] = ["film", "book", "series"];
export const savedMediaTypes: readonly MediaType[] = ["film", "book", "series"];

// What a User does to keep a Media Item: marks it Planned, logs it, puts it in Collections, or
// adds one by hand.
export type Keeping = "plan" | "log" | "collect" | "addByHand";

// What a User can do with Media Items of each type so far.
const keepings: Record<MediaType, readonly Keeping[]> = {
  film: ["plan", "log", "collect", "addByHand"],
  book: ["plan", "log", "collect", "addByHand"],
  series: ["plan", "log", "collect", "addByHand"],
};

export function can(mediaType: MediaType, keeping: Keeping): boolean {
  return keepings[mediaType].includes(keeping);
}

// Whether a new Log Entry for a Media Item the User has logged before starts as a Revisit. A film
// or a book logged again is most often seen again from the start; a series most often goes on
// with a new season, which is no Revisit (ADR-0005).
const revisitsByDefault: Record<MediaType, boolean> = { film: true, book: true, series: false };

export function startsAsRevisit(mediaType: MediaType): boolean {
  return revisitsByDefault[mediaType];
}

// Which Media Types have In Progress is the Worker's rule too. A new one doesn't compile until the
// catalogue has its In Progress words (progressWord).
export { canProgress, type ProgressMediaType } from "../../shared/catalog";
