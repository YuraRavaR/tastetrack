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
import type { MediaItem, MediaType } from "../../shared/api";
import type { MessageId } from "../i18n/t";
import { type Found, foundMediaType } from "./found";

export type CoverShape = "2:3";

// A new Media Type doesn't compile until it has a cover shape.
const coverShapes: Record<MediaType, CoverShape> = { film: "2:3" };

export function coverShape(mediaType: MediaType): CoverShape {
  return coverShapes[mediaType];
}

export interface Cover {
  url: string | null;
  // Null for a TMDB search result, which names no Media Item.
  mediaItemId: number | null;
  mediaType: MediaType;
}

export function coverOf(subject: MediaItem | Found): Cover {
  if (!("kind" in subject)) {
    return {
      url: subject.metadata?.posterUrl ?? null,
      mediaItemId: subject.id,
      mediaType: subject.mediaType,
    };
  }
  if (subject.kind === "manual") return coverOf(subject.mediaItem);
  return { url: subject.posterUrl, mediaItemId: null, mediaType: foundMediaType(subject) };
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
