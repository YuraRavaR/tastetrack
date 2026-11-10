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
// Books in a section that hasn't built them yet.
const booksSoon: MediaTypeChoice = {
  status: "comingSoon",
  name: "mediaType.book.tab",
  icon: mediaTypeIcons.book,
};
// Series come after books. Music and Games stay out until each has an ADR choosing its External
// Source.
const seriesSoon: MediaTypeChoice = {
  status: "comingSoon",
  name: "mediaType.series.tab",
  icon: Tv,
};

// The Media Types each section offers, in the one order they all keep. Search has books;
// Collections and Saved get them as each builds its part.
export const searchMediaTypes: readonly MediaTypeChoice[] = [films, books, seriesSoon];
export const listsMediaTypes: readonly MediaTypeChoice[] = [films, booksSoon, seriesSoon];
export const savedMediaTypes: readonly MediaTypeChoice[] = [films, booksSoon];

// Whether a User can keep Media Items of the type yet: plan and log them, put them in Collections
// and add them by hand. A book can only be found and opened so far.
const kept: Record<MediaType, boolean> = { film: true, book: false };

export function canKeep(mediaType: MediaType): boolean {
  return kept[mediaType];
}
