// The addresses of the sections, and of one Collection. A Media Type's tab in Saved is
// `libraryPath` in library/library-tabs. The UI calls a List a "Collection", and so do its
// addresses.

// Saved's tiles. Until they ship, "/" opens the films' Watchlist.
export const savedPath = "/";

export const collectionsPath = "/collections";

export function collectionPath(listId: number | string): string {
  return `${collectionsPath}/${listId}`;
}

// The film search; with `?q=` it opens on that query's results.
export const searchPath = "/search";
