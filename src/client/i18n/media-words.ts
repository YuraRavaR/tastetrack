import type { PrimitiveType } from "intl-messageformat";
import type { MediaType } from "../../shared/api";
import { t } from "./t";

// The UI words that differ per Media Type (ADR-0005): the Experienced verb, for the first time and
// for a Revisit, the action of marking it, a Rating with how many Log Entries it follows, the
// Planned action, the Backlog's name, the search label, the plural tab label, the row prefix, the
// Item History's name, what it says while empty, and the labels of its first date and of a Log
// Entry's date field.
type MediaWord =
  | "experienced"
  | "experiencedAgain"
  | "markExperienced"
  | "ratingAndCount"
  | "planned"
  | "backlog"
  | "search"
  | "tab"
  | "rowPrefix"
  | "history"
  | "historyEmpty"
  | "historyEmptyHint"
  | "firstExperienced"
  | "dateExperienced";

// What a page with no Media Item of its own reads its words by, and the only Media Type built.
export const pageMediaType: MediaType = "film";

// A new Media Type doesn't compile until the catalogue has all its words.
export function mediaWord(
  mediaType: MediaType,
  word: MediaWord,
  values?: Record<string, PrimitiveType>,
): string {
  return t(`mediaType.${mediaType}.${word}`, values);
}
