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
import type { Found } from "./found";

export type CoverShape = "2:3";

// A new Media Type doesn't compile until it has a cover shape.
const coverShapes: Record<MediaType, CoverShape> = { film: "2:3" };

export function coverShape(mediaType: MediaType): CoverShape {
  return coverShapes[mediaType];
}

export interface Cover {
  url: string | null;
  // Null for a search result not yet in the catalog.
  mediaItemId: number | null;
  mediaType: MediaType;
}

export function coverOf(item: MediaItem | Found): Cover {
  if (!("kind" in item)) {
    return {
      url: item.metadata?.posterUrl ?? null,
      mediaItemId: item.id,
      mediaType: item.mediaType,
    };
  }
  if (item.kind === "manual") return coverOf(item.mediaItem);
  return {
    url: item.posterUrl,
    mediaItemId: null,
    mediaType: item.externalReference.mediaType,
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

// One of the placeholders, the same for a film every time, by its Media Item's id. A search result
// not yet in the catalog has no id, so it gets the film icon.
export function placeholderFor(mediaItemId: number | null): Placeholder {
  if (mediaItemId === null) return filmPlaceholder;
  return placeholders[mediaItemId % placeholders.length] ?? filmPlaceholder;
}
