// How a Library tab is shown: its sort, and the filters on genre, decade and, on the experienced
// tab, the Current Rating. They live in the tab's address; the sort is also remembered per Media
// Type and tab in the browser.
import type { LibraryItem, MediaType } from "../../shared/api";
import type { LibraryTab } from "./library-tabs";

// Date added and Last watched are the tabs' own orders: by when a Media Item joined the Backlog,
// and by its last Log Entry in Log Order.
export type LibrarySort = "added" | "experienced" | "rating" | "title" | "year";

export interface LibraryView {
  sort: LibrarySort;
  genre: string | null;
  decade: number | null;
  minRating: number | null;
}

// Each tab's sorts, its default first.
export const librarySorts: Record<LibraryTab, readonly [LibrarySort, ...LibrarySort[]]> = {
  backlog: ["added", "title", "year"],
  experienced: ["experienced", "rating", "title", "year"],
};

// The Current Ratings the experienced tab filters from: "4★ and up", "4.5★ and up", "5★ only".
export const ratingFloors = [4, 4.5, 5] as const;

// The names of the address's query parameters.
const queryKeys = { sort: "sort", genre: "genre", decade: "decade", minRating: "rating" } as const;

// Each sort's word in the address and in the browser's memory: the UI's, as for the tabs.
const sortSlugs: Record<LibrarySort, string> = {
  added: "added",
  experienced: "watched",
  rating: "rating",
  title: "title",
  year: "year",
};

// The view the tab's address asks for. The address's sort wins, then the one remembered in the
// browser, then the tab's default; whatever this tab can't show is left out.
export function libraryView(
  tab: LibraryTab,
  params: URLSearchParams,
  rememberedSort: string | null,
): LibraryView {
  const sorts = librarySorts[tab];
  const sortOf = (slug: string | null) => sorts.find((sort) => sortSlugs[sort] === slug);
  const decade = params.get(queryKeys.decade);
  const minRating = Number(params.get(queryKeys.minRating));
  return {
    sort: sortOf(params.get(queryKeys.sort)) ?? sortOf(rememberedSort) ?? sorts[0],
    genre: params.get(queryKeys.genre) || null,
    decade: decade && /^\d{3}0$/.test(decade) ? Number(decade) : null,
    minRating:
      tab === "experienced" && ratingFloors.some((floor) => floor === minRating) ? minRating : null,
  };
}

const titleOrder = new Intl.Collator("en", { sensitivity: "base", numeric: true });

// Compares two films so that one without a value goes after one with it, and equals stay put.
function by<Value>(
  valueIn: (item: LibraryItem) => Value | null | undefined,
  compare: (a: Value, b: Value) => number,
) {
  return (a: LibraryItem, b: LibraryItem) => {
    const first = valueIn(a);
    const second = valueIn(b);
    if (first == null || second == null) return (first == null ? 1 : 0) - (second == null ? 1 : 0);
    return compare(first, second);
  };
}

// The sorts that change the tab's own order.
const comparators: Partial<Record<LibrarySort, (a: LibraryItem, b: LibraryItem) => number>> = {
  title: by((item) => item.mediaItem.metadata?.title, titleOrder.compare),
  year: by(
    (item) => item.mediaItem.metadata?.year,
    (a, b) => b - a,
  ),
  rating: by(
    (item) => item.log?.currentRating,
    (a, b) => b - a,
  ),
};

// A film's genres; a book has none, since Open Library's subjects aren't kept.
function genresOf({ mediaItem }: LibraryItem): string[] {
  return mediaItem.mediaType === "film" ? (mediaItem.metadata?.genres ?? []) : [];
}

function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

// Whether a film passes the view's filters. One with no year or genres is kept unless that filter
// is set.
function matches(item: LibraryItem, { genre, decade, minRating }: LibraryView): boolean {
  const metadata = item.mediaItem.metadata;
  if (genre !== null && !genresOf(item).includes(genre)) return false;
  if (decade !== null && (metadata?.year == null || decadeOf(metadata.year) !== decade)) {
    return false;
  }
  if (minRating !== null && (item.log?.currentRating ?? 0) < minRating) return false;
  return true;
}

// The tab's films, given in its own order, as the view shows them.
export function showLibrary(items: readonly LibraryItem[], view: LibraryView): LibraryItem[] {
  const shown = items.filter((item) => matches(item, view));
  const compare = comparators[view.sort];
  return compare ? shown.toSorted(compare) : shown;
}

// The tab's address after a change to its view: each choice named is set, or removed when null,
// and the rest stay as they were.
export function changeView(params: URLSearchParams, change: Partial<LibraryView>): URLSearchParams {
  const changed = new URLSearchParams(params);
  for (const [name, value] of Object.entries(change)) {
    const key = queryKeys[name as keyof LibraryView];
    if (value === null || value === undefined) changed.delete(key);
    else changed.set(key, name === "sort" ? sortSlugs[value as LibrarySort] : String(value));
  }
  return changed;
}

// The address's filters, as they are, without its sort: what goes along to the other tab, where
// a filter it can't show waits, as Rating does on the Watchlist.
export function filtersOf(params: URLSearchParams): URLSearchParams {
  const filters = new URLSearchParams(params);
  filters.delete(queryKeys.sort);
  return filters;
}

// The genres the tab's films have, from A to Z, and the chosen one, so that its menu checks it.
export function genreChoices(items: readonly LibraryItem[], chosen: string | null): string[] {
  const genres = new Set(items.flatMap(genresOf));
  if (chosen !== null) genres.add(chosen);
  return [...genres].toSorted(titleOrder.compare);
}

// The decades the tab's films are from, the newest first, and the chosen one.
export function decadeChoices(items: readonly LibraryItem[], chosen: number | null): number[] {
  const decades = new Set(
    items.flatMap((item) => {
      const year = item.mediaItem.metadata?.year;
      return year == null ? [] : [decadeOf(year)];
    }),
  );
  if (chosen !== null) decades.add(chosen);
  return [...decades].toSorted((a, b) => b - a);
}

// Where the browser keeps the sort the User last chose for a Media Type's tab.
const sortKey = (mediaType: MediaType, tab: LibraryTab) => `tastetrack.sort.${mediaType}.${tab}`;

// The sort last chosen for the tab in this browser, or null where storage is empty or blocked.
export function rememberedSort(mediaType: MediaType, tab: LibraryTab): string | null {
  try {
    return localStorage.getItem(sortKey(mediaType, tab));
  } catch {
    return null;
  }
}

// Best-effort: a browser that blocks storage just forgets.
export function rememberSort(mediaType: MediaType, tab: LibraryTab, sort: LibrarySort): void {
  try {
    localStorage.setItem(sortKey(mediaType, tab), sortSlugs[sort]);
  } catch {
    // Nothing to do: the address still holds the sort.
  }
}
