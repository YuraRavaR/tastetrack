// A Library's two tabs, in their default orders: the Backlog by Date added, and every Media Item
// the User experienced, once each, by Last watched. The UI calls a film's "Watchlist" and
// "Watched", and so do their addresses.
import type { LibraryItem, MediaType } from "../../shared/api";
import { inLogOrder } from "../../shared/log";

export type LibraryTab = "backlog" | "experienced";

export const libraryTabs: readonly LibraryTab[] = ["backlog", "experienced"];

// The Media Items in the Backlog, the latest added first.
export function backlogItems(items: readonly LibraryItem[]): LibraryItem[] {
  return items
    .flatMap((item) => (item.backlog ? [{ item, addedAt: item.backlog.addedAt }] : []))
    .toSorted((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0))
    .map(({ item }) => item);
}

// The Media Items with Log Entries, the last experienced first: by each one's last Log Entry, in
// reverse Log Order.
export function experiencedItems(items: readonly LibraryItem[]): LibraryItem[] {
  const logged = items.flatMap((item) => {
    if (!item.log) return [];
    const { date, createdAt } = item.log.lastLogEntry;
    return [{ item, date, createdAt: new Date(createdAt) }];
  });
  return inLogOrder(logged)
    .toReversed()
    .map(({ item }) => item);
}

// Both tabs' Media Items, in their orders.
export function libraryTabItems(items: readonly LibraryItem[]): Record<LibraryTab, LibraryItem[]> {
  return { backlog: backlogItems(items), experienced: experiencedItems(items) };
}

// Each tab's word in Saved's addresses, and each Media Type's.
const tabSlugs: Record<LibraryTab, string> = { backlog: "watchlist", experienced: "watched" };
// A new Media Type doesn't compile until it has one.
const typeSlugs: Record<MediaType, string> = { film: "films" };

function bySlug<Key extends string>(slugs: Record<Key, string>, slug: string | undefined) {
  const found = Object.entries(slugs).find(([, each]) => each === slug);
  return found ? (found[0] as Key) : null;
}

export function libraryTabOfSlug(slug: string | undefined): LibraryTab | null {
  return bySlug(tabSlugs, slug);
}

export function mediaTypeOfSlug(slug: string | undefined): MediaType | null {
  return bySlug(typeSlugs, slug);
}

// The address of a Media Type's tab in Saved: "/saved/films/watchlist".
export function libraryPath(mediaType: MediaType, tab: LibraryTab): string {
  return `/saved/${typeSlugs[mediaType]}/${tabSlugs[tab]}`;
}
