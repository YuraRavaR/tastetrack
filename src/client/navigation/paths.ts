// The addresses of the sections, of one List and of one Media Item. A Media Type's tab in Saved is
// `libraryPath` in library/library-tabs. Code says List, as GLOSSARY does; the UI calls one a
// "Collection", and so do its addresses.

// Saved's tiles, one per Media Type.
export const savedPath = "/";

export const listsPath = "/collections";

export function listPath(listId: number | string): string {
  return `${listsPath}/${listId}`;
}

// A Media Item's page: its film, and the User's Viewings of it.
export function itemPath(mediaItemId: number | string): string {
  return `/items/${mediaItemId}`;
}

// The film search; with `?q=` it opens on that query's results.
export const searchPath = "/search";
