import {
  Cat,
  Clapperboard,
  Film,
  Ghost,
  Glasses,
  Lightbulb,
  type LucideIcon,
  MoonStar,
  Popcorn,
  SearchX,
  Send,
} from "lucide-react";
import type { CoverUrls, MediaItem, MediaType } from "../../shared/api";
import type { MessageId } from "../i18n/t";
import { authorName } from "./book-label";
import { type Found, foundMediaType } from "./found";

export type CoverShape = "2:3";

// A new Media Type doesn't compile until it has a cover shape. A book's cover is cropped to a
// poster's, whatever shape its image has.
const coverShapes: Record<MediaType, CoverShape> = { film: "2:3", book: "2:3" };

export function coverShape(mediaType: MediaType): CoverShape {
  return coverShapes[mediaType];
}

// A thumbnail takes the small image; anything larger, such as a poster grid's cell, the large one.
export type CoverImageSize = "small" | "large";

export interface Cover {
  url: string | null;
  // Null for an External Source's search result not in the catalog yet, which has no Media Item.
  mediaItemId: number | null;
  mediaType: MediaType;
}

// What each Media Type calls its cover: a film's poster, a book's cover.
function coverUrlsOf(mediaItem: MediaItem): CoverUrls | null {
  switch (mediaItem.mediaType) {
    case "film":
      return mediaItem.metadata?.posterUrls ?? null;
    case "book":
      return mediaItem.metadata?.coverUrls ?? null;
  }
}

// A search result comes with a small image only, whatever size is asked for.
export function coverOf(subject: MediaItem | Found, imageSize: CoverImageSize): Cover {
  if (!("kind" in subject)) {
    return {
      url: coverUrlsOf(subject)?.[imageSize] ?? null,
      mediaItemId: subject.id,
      mediaType: subject.mediaType,
    };
  }
  if (subject.kind === "manual") return coverOf(subject.mediaItem, imageSize);
  return {
    url: subject.posterUrl,
    mediaItemId: subject.mediaItemId,
    mediaType: foundMediaType(subject),
  };
}

export interface Placeholder {
  icon: LucideIcon;
  caption: MessageId;
}

const filmPlaceholder: Placeholder = { icon: Film, caption: "poster.caption.projector" };

const placeholders: readonly Placeholder[] = [
  { icon: Popcorn, caption: "poster.caption.popcorn" },
  { icon: Ghost, caption: "poster.caption.ghost" },
  { icon: Clapperboard, caption: "poster.caption.makeup" },
  filmPlaceholder,
  { icon: SearchX, caption: "poster.caption.notFound" },
  { icon: MoonStar, caption: "poster.caption.napping" },
  { icon: Cat, caption: "poster.caption.cat" },
  { icon: Send, caption: "poster.caption.cannes" },
  { icon: Lightbulb, caption: "poster.caption.imagine" },
  { icon: Glasses, caption: "poster.caption.incognito" },
];

// One of the placeholders, the same for a Media Item every time, by its id. A search result that
// names no Media Item gets the film icon.
export function placeholderFor(mediaItemId: number | null): Placeholder {
  if (mediaItemId === null) return filmPlaceholder;
  return placeholders[mediaItemId % placeholders.length] ?? filmPlaceholder;
}

// What a cover set in type says where a book has no image: its title, and its first author as
// shown. Null where unknown.
export interface TypesetCover {
  title: string | null;
  author: string | null;
}

export function typesetCoverOf(subject: MediaItem | Found): TypesetCover {
  if ("kind" in subject && subject.kind === "catalog") {
    return { title: subject.title, author: firstAuthor(subject.authors) };
  }
  const mediaItem = "kind" in subject ? subject.mediaItem : subject;
  return {
    title: mediaItem.metadata?.title ?? null,
    author: mediaItem.mediaType === "book" ? firstAuthor(mediaItem.metadata?.authors) : null,
  };
}

function firstAuthor(authors: readonly string[] | undefined): string | null {
  const [first] = authors ?? [];
  return first === undefined ? null : authorName(first);
}
