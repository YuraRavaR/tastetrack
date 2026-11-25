// The rules of Lists and the Backlog. Pure functions and plain values with no I/O, shared by the
// Worker, which enforces them, and the client, which keeps input within them.
import type { BacklogMediaType, MediaType } from "./api";
import { type FavouritesMediaType, hasFavourites, isLight } from "./catalog";
import { textKey } from "./text";

// Who may see a List, from least to most: each level includes the ones before it. Every List
// starts private.
export const visibilities = ["private", "friends", "link", "public"] as const;

export type Visibility = (typeof visibilities)[number];

// A List has a Share Link exactly while its Visibility is at one of these levels: creating the
// link raises a List below them to link, and revoking it makes the List private again.
export const sharedVisibilities = visibilities.slice(visibilities.indexOf("link"));

export const unsharedVisibilities = visibilities.slice(0, visibilities.indexOf("link"));

// Whether a List at this Visibility has a Share Link.
export function isShared(visibility: Visibility): boolean {
  return sharedVisibilities.includes(visibility);
}

// A List, the Backlog included, holds at most this many items.
export const maxListItems = 1_000;

// Favourites hold at most this many items, so that they stay a top (ADR-0005).
export const maxFavourites = 100;

// Notes longer than this are refused.
export const maxNoteLength = 1_000;

// The order of `items` once `item` is moved to place `index`, counted from 0; past the end is last.
// An item that isn't there changes nothing.
export function moved<T>(items: readonly T[], item: T, index: number): T[] {
  if (!items.includes(item)) return [...items];
  const others = items.filter((each) => each !== item);
  return others.toSpliced(Math.min(index, others.length), 0, item);
}

// How many of a List's first Media Items the read of the User's Lists carries, for a collage.
export const listCoverCount = 4;

// A User holds at most this many Lists of their own; the Backlog doesn't count.
export const maxLists = 100;

// List names longer than this are refused, and so are descriptions longer than the other.
export const maxListNameLength = 100;
export const maxListDescriptionLength = 1_000;

// What makes two List names the same name (src/shared/text.ts). A User's Lists all have different
// keys.
export function listNameKey(name: string): string {
  return textKey(name);
}

export function sameListName(name: string, other: string): boolean {
  return listNameKey(name) === listNameKey(other);
}

// The UI's name for the Backlog of each Media Type that has one (ADR-0005).
const backlogNames: Record<BacklogMediaType, string> = {
  film: "Watchlist",
  book: "Reading list",
  series: "Watchlist",
  game: "Backlog",
  album: "Listening list",
};

// The UI's name for the Favourites of each Media Type that has them (ADR-0005).
const favouritesNames: Record<FavouritesMediaType, string> = {
  artist: "Favourite artists",
};

// Names a List can't have, so that it can't be mistaken for a Backlog: the UI's name for the
// Backlog of each Media Type.
const reservedListNames = Object.values(backlogNames).map(listNameKey);

export function isReservedListName(name: string): boolean {
  return reservedListNames.includes(listNameKey(name));
}

// The kinds of List: a User's own, and the system Lists, the Backlog and Favourites, which have
// no name.
export const listKinds = ["backlog", "list", "favourites"] as const;

export type ListKind = (typeof listKinds)[number];

// What a shared List is called: its name, or for a system List, which has none, whose it is in
// the UI's words for its Media Type: "Olena's Watchlist", "Olena's Favourite artists". The Worker
// puts it in the shared page's <head> too, so both say the same.
export function sharedListTitle(
  { kind, name, mediaType }: { kind: ListKind; name: string | null; mediaType: MediaType },
  ownerDisplayName: string,
): string {
  if (name !== null) return name;
  if (kind === "favourites") {
    if (!hasFavourites(mediaType)) throw new Error(`${mediaType} has no Favourites`);
    return `${ownerDisplayName}'s ${favouritesNames[mediaType]}`;
  }
  // Only a system List has no name, and a light Media Type has no Backlog.
  if (isLight(mediaType)) throw new Error(`A List of ${mediaType} has no name`);
  return `${ownerDisplayName}'s ${backlogNames[mediaType]}`;
}
