// A Library's tabs, in lifecycle order and each in its default order: the Backlog by Date added,
// what is In Progress by when it was started, and every Media Item the User experienced, once
// each, by Last watched. The UI calls a film's "Watchlist" and "Watched" and a book's "Reading
// list", "Reading" and "Read", and so do their addresses.
import type { LibraryItem, MediaItem, MediaType } from "../../shared/api";
import { inLogOrder } from "../../shared/log";
import { can, canProgress, type ProgressMediaType } from "../catalog/media-types";

export type LibraryTab = "backlog" | "inProgress" | "experienced";

const libraryTabs: readonly LibraryTab[] = ["backlog", "inProgress", "experienced"];

// The tabs a Media Type's Library has: In Progress only for a type that has it, and the
// experienced one only once the type can be logged.
export function libraryTabsOf(mediaType: MediaType): readonly LibraryTab[] {
  return libraryTabs.filter((tab) => {
    if (tab === "inProgress") return canProgress(mediaType);
    return tab === "backlog" || can(mediaType, "log");
  });
}

// The Media Items in the Backlog, the latest added first.
export function backlogItems(items: readonly LibraryItem[]): LibraryItem[] {
  return items
    .flatMap((item) => (item.backlog ? [{ item, addedAt: item.backlog.addedAt }] : []))
    .toSorted((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0))
    .map(({ item }) => item);
}

// The day a Media Item In Progress was started: its start date, or without one the day it was
// marked, in UTC, which is near enough for an order.
function startedOn(inProgress: NonNullable<LibraryItem["inProgress"]>): string {
  return inProgress.startDate ?? inProgress.createdAt.slice(0, 10);
}

// The Media Items In Progress, the latest started first, and of those started the same day the
// one marked last.
export function inProgressItems(items: readonly LibraryItem[]): LibraryItem[] {
  return items
    .flatMap((item) => (item.inProgress ? [{ item, inProgress: item.inProgress }] : []))
    .toSorted((a, b) => {
      const byDay = startedOn(b.inProgress).localeCompare(startedOn(a.inProgress));
      return byDay || b.inProgress.createdAt.localeCompare(a.inProgress.createdAt);
    })
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

// Every tab's Media Items, in their orders. A Media Type without In Progress has none there.
export function libraryTabItems(items: readonly LibraryItem[]): Record<LibraryTab, LibraryItem[]> {
  return {
    backlog: backlogItems(items),
    inProgress: inProgressItems(items),
    experienced: experiencedItems(items),
  };
}

// What a Media Type's tile in Saved shows: how many Media Items each tab holds, whether all are
// empty, and the covers of the three added to the Backlog last, the latest first; and what is In
// Progress, which Saved lists under the tiles.
export interface LibraryTile {
  counts: Record<LibraryTab, number>;
  empty: boolean;
  covers: MediaItem[];
  inProgress: LibraryItem[];
}

const tileCoverCount = 3;

export function libraryTile(items: readonly LibraryItem[]): LibraryTile {
  const { backlog, inProgress, experienced } = libraryTabItems(items);
  return {
    counts: {
      backlog: backlog.length,
      inProgress: inProgress.length,
      experienced: experienced.length,
    },
    empty: items.length === 0,
    covers: backlog.slice(0, tileCoverCount).map(({ mediaItem }) => mediaItem),
    inProgress,
  };
}

// Each Media Type's word in Saved's addresses, and its tabs' words. A new Media Type doesn't
// compile until it has them; the In Progress tab's only if the type has one.
const typeSlugs: Record<MediaType, string> = { film: "films", book: "books" };
const tabSlugs: Record<MediaType, Record<Exclude<LibraryTab, "inProgress">, string>> &
  Record<ProgressMediaType, Record<LibraryTab, string>> = {
  film: { backlog: "watchlist", experienced: "watched" },
  book: { backlog: "reading-list", inProgress: "reading", experienced: "read" },
};

// A Media Type's tabs' words: none for a tab it doesn't have.
function tabSlugsOf(mediaType: MediaType): Partial<Record<LibraryTab, string>> {
  return tabSlugs[mediaType];
}

function bySlug<Key extends string>(slugs: Partial<Record<Key, string>>, slug: string | undefined) {
  const found = Object.entries(slugs).find(([, each]) => each === slug);
  return found ? (found[0] as Key) : null;
}

// The Media Type's tab an address names, or null when the Media Type has no such tab.
export function libraryTabOfSlug(
  mediaType: MediaType,
  slug: string | undefined,
): LibraryTab | null {
  const tab = bySlug(tabSlugsOf(mediaType), slug);
  return tab && libraryTabsOf(mediaType).includes(tab) ? tab : null;
}

export function mediaTypeOfSlug(slug: string | undefined): MediaType | null {
  return bySlug(typeSlugs, slug);
}

// A Media Type's word for one of its tabs, in addresses: "watched", "read". A tab the Media Type
// doesn't have is its Backlog's.
export function tabSlug(mediaType: MediaType, tab: LibraryTab): string {
  const slugs = tabSlugsOf(mediaType);
  return slugs[tab] ?? tabSlugs[mediaType].backlog;
}

// The address of a Media Type's tab in Saved: "/saved/films/watchlist", "/saved/books/reading-list".
export function libraryPath(mediaType: MediaType, tab: LibraryTab): string {
  return `/saved/${typeSlugs[mediaType]}/${tabSlug(mediaType, tab)}`;
}
