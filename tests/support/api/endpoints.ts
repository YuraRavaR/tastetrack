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
  },
  inviteCodes: "/api/invite-codes",
  listItems: {
    byId: (listItemId: number) => `/api/list-items/${listItemId}`,
  },
  lists: {
    collection: "/api/lists",
    byId: (listId: number) => `/api/lists/${listId}`,
    items: (listId: number) => `/api/lists/${listId}/items`,
  },
  logEntries: {
    collection: "/api/log-entries",
    byId: (logEntryId: number) => `/api/log-entries/${logEntryId}`,
  },
  // Exists only where test hooks are on (local and staging).
  testHooks: {
    passwordIterations: (username: string) => `/api/test/users/${username}/password-iterations`,
    invitedBy: (username: string) => `/api/test/users/${username}/invited-by`,
  },
} as const;
