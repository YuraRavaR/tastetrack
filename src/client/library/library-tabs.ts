// A Library's two tabs, in their default orders: the Watchlist (the Backlog) by Date added, and
// Watched (every logged Media Item, once) by Last watched.
import type { LibraryItem, MediaType } from "../../shared/api";
import { inLogOrder } from "../../shared/log";

export type LibraryTab = "watchlist" | "watched";

export const libraryTabs: readonly LibraryTab[] = ["watchlist", "watched"];

// The Media Items in the Backlog, the latest added first.
export function watchlist(items: readonly LibraryItem[]): LibraryItem[] {
  return items
    .flatMap((item) => (item.backlog ? [{ item, addedAt: item.backlog.addedAt }] : []))
    .toSorted((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0))
    .map(({ item }) => item);
}

// The Media Items with Log Entries, the last watched first: by each one's last Log Entry, in
// reverse Log Order.
export function watched(items: readonly LibraryItem[]): LibraryItem[] {
  const logged = items.flatMap((item) => {
    if (!item.log) return [];
    const { date, createdAt } = item.log.lastLogEntry;
    return [{ item, date, createdAt: new Date(createdAt) }];
  });
  return inLogOrder(logged)
    .toReversed()
    .map(({ item }) => item);
}

export function tabItems(tab: LibraryTab, items: readonly LibraryItem[]): LibraryItem[] {
  return tab === "watchlist" ? watchlist(items) : watched(items);
}

export function isLibraryTab(tab: string | undefined): tab is LibraryTab {
  return libraryTabs.includes(tab as LibraryTab);
}

// Each Media Type's word in Saved's addresses. A new Media Type doesn't compile until it has one.
const typeSlugs: Record<MediaType, string> = { film: "films" };

export function mediaTypeOfSlug(slug: string | undefined): MediaType | null {
  const found = Object.entries(typeSlugs).find(([, typeSlug]) => typeSlug === slug);
  return found ? (found[0] as MediaType) : null;
}

// The address of a Media Type's tab in Saved: "/saved/films/watchlist".
export function libraryPath(mediaType: MediaType, tab: LibraryTab): string {
  return `/saved/${typeSlugs[mediaType]}/${tab}`;
}
