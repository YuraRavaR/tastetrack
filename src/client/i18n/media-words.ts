import type { MediaType } from "../../shared/api";
import { t } from "./t";

// The UI words that differ per Media Type (ADR-0005): the Experienced verb, the Backlog's name, the
// search label, the plural tab label, the row prefix, the Item History's name and the label of its
// first date.
type MediaWord =
  | "experienced"
  | "backlog"
  | "search"
  | "tab"
  | "rowPrefix"
  | "history"
  | "firstExperienced";

// What a page with no Media Item of its own reads its words by, and the only Media Type built.
export const pageMediaType: MediaType = "film";

// A new Media Type doesn't compile until the catalogue has all its words.
export function mediaWord(mediaType: MediaType, word: MediaWord): string {
  return t(`mediaType.${mediaType}.${word}`);
}
