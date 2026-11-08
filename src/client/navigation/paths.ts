// The addresses of the sections, and of one List. A Media Type's tab in Saved is `libraryPath` in
// library/library-tabs. Code says List, as GLOSSARY does; the UI calls one a "Collection", and so
// do its addresses.

// Saved's tiles, one per Media Type.
export const savedPath = "/";

export const listsPath = "/collections";

export function listPath(listId: number | string): string {
  return `${listsPath}/${listId}`;
}

// The film search; with `?q=` it opens on that query's results.
export const searchPath = "/search";
