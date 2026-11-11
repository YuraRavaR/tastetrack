import type { PrimitiveType } from "intl-messageformat";
import type { MediaType } from "../../shared/api";
import { t } from "./t";

// The UI words that differ per Media Type (ADR-0005): the Experienced verb, for the first time and
// for a Revisit, the action of marking it, a Rating with how many Log Entries it follows, the
// Planned action, the Backlog's name, the search label, the plural tab label, the row prefix, the
// Item History's name, how many Log Entries it holds, a Revisit's name and hint, what it says while
// empty, the labels of its first date and of a Log Entry's date field, the mark of a planned Media
// Item already experienced, the action that opens search, what Saved's tabs say while empty, the
// label over a shared Collection, the sort by the last Log Entry, what Saved says when its filters
// match nothing, the counts on Saved's tile, the sort by year, what a full Backlog says, how many a
// Collection holds, Search's placeholder, its hint, the heading over its External Source's results
// and what it says when it finds nothing, what stands in for a title while its metadata is
// unavailable or loading, the name of a missing cover, and the words for one the User adds by hand:
// the dialog's title and descriptions, its possible-duplicate warning and invalid-details error, and
// what its page says of it, with its edit and delete buttons; and a Collection's words: what a new
// one is for and its name's placeholder, the button and dialog that add to it, what it says of one
// already in it and when it is full, its reordering and hint, the hint of the dialog that puts one
// on Collections, and what a shared one says while empty.
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
  | "experiencedCount"
  | "revisit"
  | "revisitHint"
  | "historyEmpty"
  | "historyEmptyHint"
  | "firstExperienced"
  | "dateExperienced"
  | "experiencedBefore"
  | "find"
  | "backlogEmpty"
  | "experiencedEmpty"
  | "collection"
  | "lastExperienced"
  | "noMatch"
  | "tileCounts"
  | "sortYear"
  | "backlogFull"
  | "count"
  | "searchPlaceholder"
  | "searchHint"
  | "searchSource"
  | "searchNoMatch"
  | "unknown"
  | "loading"
  | "noCover"
  | "manualNew"
  | "manualNewDescription"
  | "manualEditDescription"
  | "manualDuplicate"
  | "manualInvalid"
  | "manualAddedByYou"
  | "manualEdit"
  | "manualDelete"
  | "collectionNew"
  | "collectionNamePlaceholder"
  | "collectionAdd"
  | "collectionAddTitle"
  | "collectionAddDescription"
  | "collectionAlreadyIn"
  | "collectionFull"
  | "collectionReorder"
  | "collectionReorderHint"
  | "collectionTick"
  | "sharedEmpty";

// What a page with no Media Item of its own reads its words by, until it offers more Media Types
// than films.
export const pageMediaType: MediaType = "film";

// A new Media Type doesn't compile until the catalogue has all its words.
export function mediaWord(
  mediaType: MediaType,
  word: MediaWord,
  values?: Record<string, PrimitiveType>,
): string {
  return t(`mediaType.${mediaType}.${word}`, values);
}
