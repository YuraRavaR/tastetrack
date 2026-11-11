import type { ExternalReference } from "@shared/api";
export const endpoints = {
  auth: {
    register: "/api/auth/register",
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    currentUser: "/api/auth/me",
  },
  backlog: {
    collection: "/api/backlog",
    items: "/api/backlog/items",
    itemByMediaItem: (mediaItemId: number) => `/api/backlog/items/${mediaItemId}`,
  },
  catalog: {
    search: "/api/catalog/search",
    items: "/api/catalog/items",
    manualItems: "/api/catalog/manual-items",
    manualItemById: (mediaItemId: number) => `/api/catalog/manual-items/${mediaItemId}`,
    mediaItemHistory: (mediaItemId: number) => `/api/catalog/items/${mediaItemId}/history`,
    mediaItemLists: (mediaItemId: number) => `/api/catalog/items/${mediaItemId}/lists`,
  },
  inProgress: {
    collection: "/api/in-progress",
    byMediaItem: (mediaItemId: number) => `/api/in-progress/${mediaItemId}`,
    finish: (mediaItemId: number) => `/api/in-progress/${mediaItemId}/finish`,
  },
  inviteCodes: "/api/invite-codes",
  library: "/api/library",
  listItems: {
    byId: (listItemId: number) => `/api/list-items/${listItemId}`,
  },
  lists: {
    collection: "/api/lists",
    mediaItems: "/api/lists/media-items",
    byId: (listId: number) => `/api/lists/${listId}`,
    items: (listId: number) => `/api/lists/${listId}/items`,
    shareLink: (listId: number) => `/api/lists/${listId}/share-link`,
    regenerateShareLink: (listId: number) => `/api/lists/${listId}/share-link/regenerate`,
  },
  logEntries: {
    collection: "/api/log-entries",
    byId: (logEntryId: number) => `/api/log-entries/${logEntryId}`,
  },
  me: {
    account: "/api/me",
    displayName: "/api/me/display-name",
    password: "/api/me/password",
    newPassword: "/api/me/new-password",
  },
  sharedLists: {
    byToken: (token: string) => `/api/shared-lists/${token}`,
    pageByToken: (token: string) => `/s/${token}`,
  },
  // Exists only where test hooks are on (local and staging).
  testHooks: {
    users: "/api/test/users",
    backlog: (username: string) => `/api/test/users/${username}/backlog`,
    listItems: (listId: number) => `/api/test/lists/${listId}/items`,
    manualItems: (username: string) => `/api/test/users/${username}/manual-items`,
    records: "/api/test/records",
    catalogCacheEntry: ({ source, mediaType, id }: ExternalReference) =>
      `/api/test/catalog-cache/${source}/${mediaType}/${id}`,
    tmdbFakeSearch: "/api/test/tmdb/3/search/movie?query=alien",
    openLibraryFakeSearch: "/api/test/openlibrary/search.json?q=alien",
    passwordReset: (username: string) => `/api/test/users/${username}/password-reset`,
    passwordIterations: (username: string) => `/api/test/users/${username}/password-iterations`,
    invitedBy: (username: string) => `/api/test/users/${username}/invited-by`,
  },
} as const;
