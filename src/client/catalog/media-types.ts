import { BookOpen, Clapperboard, type LucideIcon, Tv } from "lucide-react";
import type { MediaType } from "../../shared/api";
import type { MessageId } from "../i18n/t";

// A Media Type as a section offers it: one the section has built, or one still to come, shown
// disabled and labelled "Coming soon". One still to come carries its own name and icon, since it
// may not be a MediaType yet.
export type MediaTypeChoice =
  | { status: "built"; mediaType: MediaType }
  | { status: "comingSoon"; name: MessageId; icon: LucideIcon };

// A new Media Type doesn't compile until it has an icon.
const mediaTypeIcons: Record<MediaType, LucideIcon> = { film: Clapperboard, book: BookOpen };

export function mediaTypeIcon(mediaType: MediaType): LucideIcon {
  return mediaTypeIcons[mediaType];
}

const films: MediaTypeChoice = { status: "built", mediaType: "film" };
const books: MediaTypeChoice = { status: "built", mediaType: "book" };
// Series come after books. Music and Games stay out until each has an ADR choosing its External
// Source.
const seriesSoon: MediaTypeChoice = {
  status: "comingSoon",
  name: "mediaType.series.tab",
  icon: Tv,
};

// The Media Types each section offers, in the one order they all keep.
export const searchMediaTypes: readonly MediaTypeChoice[] = [films, books, seriesSoon];
export const listsMediaTypes: readonly MediaTypeChoice[] = [films, books, seriesSoon];
export const savedMediaTypes: readonly MediaTypeChoice[] = [films, books];

// What a User does to keep a Media Item: marks it Planned, logs it, puts it in Collections, or
// adds one by hand.
export type Keeping = "plan" | "log" | "collect" | "addByHand";

// What a User can do with Media Items of each type so far.
const keepings: Record<MediaType, readonly Keeping[]> = {
  film: ["plan", "log", "collect", "addByHand"],
  book: ["plan", "log", "collect", "addByHand"],
};

export function can(mediaType: MediaType, keeping: Keeping): boolean {
  return keepings[mediaType].includes(keeping);
}
