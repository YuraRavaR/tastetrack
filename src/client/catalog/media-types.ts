import { BookOpen, Clapperboard, type LucideIcon } from "lucide-react";
import type { MediaType } from "../../shared/api";
import type { MessageId } from "../i18n/t";

// A Media Type as a section offers it: one the app has built, or one still to come, shown disabled
// and labelled "Coming soon". One still to come isn't a MediaType yet, so it carries its own name
// and icon.
export type MediaTypeChoice =
  | { status: "built"; mediaType: MediaType }
  | { status: "comingSoon"; name: MessageId; icon: LucideIcon };

// The Media Types every section offers, in order. Music and Games stay out until each has an ADR
// choosing its External Source.
export const mediaTypeChoices: readonly MediaTypeChoice[] = [
  { status: "built", mediaType: "film" },
  { status: "comingSoon", name: "mediaType.book.tab", icon: BookOpen },
];

// A new Media Type doesn't compile until it has an icon.
const mediaTypeIcons: Record<MediaType, LucideIcon> = { film: Clapperboard };

export function mediaTypeIcon(mediaType: MediaType): LucideIcon {
  return mediaTypeIcons[mediaType];
}
