// "In your Saved" on Search: the User's own films of one Media Type, from their Library and their
// Lists, matched against the query as they type. Pure functions with no I/O.
import type { HoldingList, LibraryItem, ListedMediaItem, MediaItem } from "../../shared/api";
import { textKey } from "../../shared/text";
import { type Found, foundMediaItemId } from "./found";

// One film the User has saved: what Search's status line needs of it.
export interface SavedFilm {
  mediaItem: MediaItem;
  inBacklog: boolean;
  // Null until the User has a Log Entry for it.
  currentRating: number | null;
  // The User's own Lists holding it, oldest first. The Backlog isn't one.
  lists: HoldingList[];
}

// The films in the Library and on the User's Lists, each once, by title.
export function savedFilms(
  library: readonly LibraryItem[],
  listed: readonly ListedMediaItem[],
): SavedFilm[] {
  const films = new Map<number, SavedFilm>();
  for (const item of library) {
    films.set(item.mediaItem.id, {
      mediaItem: item.mediaItem,
      inBacklog: item.backlog !== null,
      currentRating: item.log?.currentRating ?? null,
      lists: [],
    });
  }
  for (const { mediaItem, lists } of listed) {
    const film = films.get(mediaItem.id);
    if (film) film.lists = lists;
    else films.set(mediaItem.id, { mediaItem, inBacklog: false, currentRating: null, lists });
  }
  const titleKey = (film: SavedFilm) => textKey(film.mediaItem.metadata?.title ?? "");
  return [...films.values()].toSorted((a, b) => titleKey(a).localeCompare(titleKey(b)));
}

// The one status line under a saved film's cover, the first that applies: its Current Rating, and
// whether it is planned again; that it is in the Backlog; the oldest List holding it.
export type SavedStatus =
  | { kind: "rated"; rating: number; inBacklog: boolean }
  | { kind: "backlog" }
  | { kind: "list"; name: string };

export function savedStatus(film: SavedFilm): SavedStatus | null {
  if (film.currentRating !== null) {
    return { kind: "rated", rating: film.currentRating, inBacklog: film.inBacklog };
  }
  if (film.inBacklog) return { kind: "backlog" };
  const [oldest] = film.lists;
  return oldest ? { kind: "list", name: oldest.name } : null;
}

// Every title a film is known by: its English Localized Title, its Original Title and its
// Ukrainian one.
function titlesOf(mediaItem: MediaItem): string[] {
  const metadata = mediaItem.metadata;
  if (!metadata) return [];
  return [metadata.title, metadata.originalTitle, metadata.ukrainianTitle ?? ""];
}

// The search results that aren't saved films, so no film shows twice, not even while TMDB's
// results for the last query wait for the next. A TMDB result not in the catalog yet can't be
// saved, so it always stays.
export function withoutSaved(results: readonly Found[], films: readonly SavedFilm[]): Found[] {
  const savedIds = new Set(films.map((film) => film.mediaItem.id));
  return results.filter((found) => {
    const mediaItemId = foundMediaItemId(found);
    return mediaItemId === null || !savedIds.has(mediaItemId);
  });
}

// The saved films with the query in one of their titles, regardless of case; none for a blank
// query.
export function matchSaved(films: readonly SavedFilm[], query: string): SavedFilm[] {
  const key = textKey(query);
  if (!key) return [];
  return films.filter((film) =>
    titlesOf(film.mediaItem).some((title) => textKey(title).includes(key)),
  );
}
