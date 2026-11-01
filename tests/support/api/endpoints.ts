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
    mediaItemLists: (mediaItemId: number) => `/api/catalog/items/${mediaItemId}/lists`,
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
  me: {
    displayName: "/api/me/display-name",
    password: "/api/me/password",
    newPassword: "/api/me/new-password",
  },
  // Exists only where test hooks are on (local and staging).
  testHooks: {
    backlog: (username: string) => `/api/test/users/${username}/backlog`,
    listItems: (listId: number) => `/api/test/lists/${listId}/items`,
    passwordReset: (username: string) => `/api/test/users/${username}/password-reset`,
    passwordIterations: (username: string) => `/api/test/users/${username}/password-iterations`,
    invitedBy: (username: string) => `/api/test/users/${username}/invited-by`,
  },
} as const;
