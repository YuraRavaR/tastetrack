// The User's Media Items of one Media Type: those in their Library and those on their Lists, which
// Search shows first ("In your Saved"), matched against the query as they type. Pure functions
// with no I/O.
import type { HoldingList, LibraryItem, ListedMediaItem, MediaItem } from "../../shared/api";
import { textKey } from "../../shared/text";
import { type Found, foundMediaItemId } from "./found";

// A Media Item in the User's Library, on one of their Lists or in their Favourites: what Search's
// status line needs.
export interface UserMediaItem {
  mediaItem: MediaItem;
  inBacklog: boolean;
  inProgress: boolean;
  // Null until the User has a Log Entry for it.
  currentRating: number | null;
  // The User's own Lists holding it, oldest first. The Backlog isn't one.
  lists: HoldingList[];
  // Its place in the User's Favourites, counted from 0, or null.
  favouritePosition: number | null;
}

// The Media Items in the Library and on the User's Lists, each once, by title.
export function userMediaItems(
  library: readonly LibraryItem[],
  listed: readonly ListedMediaItem[],
): UserMediaItem[] {
  const items = new Map<number, UserMediaItem>();
  for (const item of library) {
    items.set(item.mediaItem.id, {
      mediaItem: item.mediaItem,
      inBacklog: item.backlog !== null,
      inProgress: item.inProgress !== null,
      currentRating: item.log?.currentRating ?? null,
      lists: [],
      favouritePosition: null,
    });
  }
  for (const { mediaItem, lists, favouritePosition } of listed) {
    const item = items.get(mediaItem.id);
    if (item) Object.assign(item, { lists, favouritePosition });
    else {
      items.set(mediaItem.id, {
        mediaItem,
        inBacklog: false,
        inProgress: false,
        currentRating: null,
        lists,
        favouritePosition,
      });
    }
  }
  const titleKey = (item: UserMediaItem) => textKey(item.mediaItem.metadata?.title ?? "");
  return [...items.values()].toSorted((a, b) => titleKey(a).localeCompare(titleKey(b)));
}

// The one status line under a User's Media Item's cover, the first that applies: its Current
// Rating, and whether it is planned again; that it is In Progress; that it is in the Backlog; its
// place in Favourites, counted from 1; the oldest List holding it.
export type UserMediaItemStatus =
  | { kind: "rated"; rating: number; inBacklog: boolean }
  | { kind: "inProgress" }
  | { kind: "backlog" }
  | { kind: "favourite"; place: number }
  | { kind: "list"; name: string };

export function userMediaItemStatus(item: UserMediaItem): UserMediaItemStatus | null {
  if (item.currentRating !== null) {
    return { kind: "rated", rating: item.currentRating, inBacklog: item.inBacklog };
  }
  if (item.inProgress) return { kind: "inProgress" };
  if (item.inBacklog) return { kind: "backlog" };
  if (item.favouritePosition !== null)
    return { kind: "favourite", place: item.favouritePosition + 1 };
  const [oldest] = item.lists;
  return oldest ? { kind: "list", name: oldest.name } : null;
}

// Every title a Media Item is known by: its English Localized Title, its Original Title and its
// Ukrainian one.
function titlesOf(mediaItem: MediaItem): string[] {
  const metadata = mediaItem.metadata;
  if (!metadata) return [];
  return [metadata.title, metadata.originalTitle, metadata.ukrainianTitle ?? ""];
}

// The search results that aren't the User's Media Items, so none shows twice, not even while the
// External Source's results for the last query wait for the next. A result not in the catalog yet
// can't be in the Library or on a List, so it always stays.
export function withoutUserMediaItems(
  results: readonly Found[],
  items: readonly UserMediaItem[],
): Found[] {
  const ids = new Set(items.map((item) => item.mediaItem.id));
  return results.filter((found) => {
    const mediaItemId = foundMediaItemId(found);
    return mediaItemId === null || !ids.has(mediaItemId);
  });
}

// The User's Media Items with the query in one of their titles, regardless of case; none for a
// blank query. An album or a song is searched by its title and artist together, "beatles abbey
// road", so it matches when each word of the query is in one of its titles or its artist credit.
export function matchUserMediaItems(
  items: readonly UserMediaItem[],
  query: string,
): UserMediaItem[] {
  const key = textKey(query);
  if (!key) return [];
  const words = key.split(/\s+/);
  return items.filter(({ mediaItem }) => {
    if (mediaItem.mediaType === "album" || mediaItem.mediaType === "song") {
      const text = [...titlesOf(mediaItem), mediaItem.metadata?.artistCredit ?? ""]
        .map(textKey)
        .join(" ");
      return words.every((word) => text.includes(word));
    }
    return titlesOf(mediaItem).some((title) => textKey(title).includes(key));
  });
}
