// The rules of Lists and the Backlog. Pure functions and plain values with no I/O, shared by the
// Worker, which enforces them, and the client, which keeps input within them.

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
