// The rules of Lists and the Backlog. Pure functions and plain values with no I/O, shared by the
// Worker, which enforces them, and the client, which keeps input within them.

// Who may see a List, from least to most: each level includes the ones before it. Every List
// starts private.
export const visibilities = ["private", "friends", "link", "public"] as const;

export type Visibility = (typeof visibilities)[number];

// A List, the Backlog included, holds at most this many items.
export const maxListItems = 1_000;

// Notes longer than this are refused.
export const maxNoteLength = 1_000;

// The order of `items` once `item` is moved to place `index`, counted from 0; past the end is last.
// An item that isn't there changes nothing.
export function moved<T>(items: readonly T[], item: T, index: number): T[] {
  if (!items.includes(item)) return [...items];
  const others = items.filter((each) => each !== item);
  return others.toSpliced(Math.min(index, others.length), 0, item);
}

// A User holds at most this many Lists of their own; the Backlog doesn't count.
export const maxLists = 100;

// List names longer than this are refused, and so are descriptions longer than the other.
export const maxListNameLength = 100;
export const maxListDescriptionLength = 1_000;

// What makes two List names the same name: they match once trimmed, in one Unicode form and
// regardless of case, in any alphabet. Going through capitals first folds letters with more than
// one small form, or a capital of several letters, such as ß. A User's Lists all have different
// keys.
export function listNameKey(name: string): string {
  return name.trim().normalize("NFC").toUpperCase().toLowerCase();
}

export function sameListName(name: string, other: string): boolean {
  return listNameKey(name) === listNameKey(other);
}

// Names a List can't have, so that it can't be mistaken for a Backlog: the UI's name for the
// Backlog of each Media Type.
const reservedListNames = ["Watchlist"].map(listNameKey);

export function isReservedListName(name: string): boolean {
  return reservedListNames.includes(listNameKey(name));
}
