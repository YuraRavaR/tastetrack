// Calls to the Worker's API. The session travels in an HttpOnly cookie, so nothing here holds it.
import type {
  Backlog,
  BacklogResponse,
  CatalogSearchResponse,
  CatalogSearchResult,
  ErrorResponse,
  InviteCode,
  InviteCodeResponse,
  InviteCodesResponse,
  ItemHistoryResponse,
  List,
  ListEditRequest,
  ListItem,
  ListItemEditRequest,
  ListItemResponse,
  ListResponse,
  ListSummary,
  ListSummaryResponse,
  ListsResponse,
  LogEntry,
  LogEntryEditRequest,
  LogEntryResponse,
  LoginResponse,
  LogResponse,
  ManualMediaItemEditRequest,
  ManualMediaItemResponse,
  ManualSearchResult,
  MediaItem,
  MediaItemResponse,
  MediaItemsResponse,
  NewListItemRequest,
  NewListRequest,
  NewLogEntryRequest,
  NewLogEntryResponse,
  NewManualMediaItemRequest,
  PasswordChangeRequest,
  PlanRequest,
  RegisterRequest,
  RemovedListItem,
  SharedList,
  SharedListResponse,
  ShareLink,
  ShareLinkResponse,
  User,
  UserResponse,
} from "../shared/api";
import type { LogDateProblem } from "../shared/log";

// The logged-in User, null without a live session, or "password_change_required" for a session
// from a Temporary Password, which can only set a new one.
export async function fetchCurrentUser(): Promise<User | null | "password_change_required"> {
  const response = await fetch("/api/auth/me");
  if (response.status === 401) return null;
  if (response.status === 403) {
    const body = (await response.json()) as ErrorResponse;
    if (body.error === "password_change_required") return body.error;
  }
  if (!response.ok) throw new Error(`Loading the current User failed: ${response.status}`);
  return ((await response.json()) as UserResponse).user;
}

export type LoginResult =
  | { ok: true; user: User; passwordChangeRequired: boolean }
  | { ok: false; error: "invalid_credentials" | "unavailable" }
  | { ok: false; error: "too_many_attempts"; retryAfterSeconds: number };

export async function logIn(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) return { ok: true, ...((await response.json()) as LoginResponse) };
    if (response.status === 429) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After"));
      return { ok: false, error: "too_many_attempts", retryAfterSeconds };
    }
    const body = (await response.json()) as ErrorResponse;
    return {
      ok: false,
      error: body.error === "invalid_credentials" ? "invalid_credentials" : "unavailable",
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function logOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

// The User with their new Display Name, or null when it couldn't be saved. Null or empty puts
// the Username back in its place.
export async function setDisplayName(displayName: string | null): Promise<User | null> {
  try {
    const response = await fetch("/api/me/display-name", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    if (!response.ok) return null;
    return ((await response.json()) as UserResponse).user;
  } catch {
    return null;
  }
}

export type ChangePasswordError = "wrong_password" | "unavailable";

export type ChangePasswordResult = { ok: true } | { ok: false; error: ChangePasswordError };

// Changes the User's password; every other session of theirs ends, and this one stays.
export async function changePassword(
  request: PasswordChangeRequest,
): Promise<ChangePasswordResult> {
  try {
    const response = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.ok) return { ok: true };
    return { ok: false, error: response.status === 403 ? "wrong_password" : "unavailable" };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export type NewPasswordError = "temporary_password_reused" | "unavailable";

export type NewPasswordResult = { ok: true; user: User } | { ok: false; error: NewPasswordError };

// Sets the User's own password in place of the Temporary Password; every other session of theirs
// ends, and this one can then do everything.
export async function setNewPassword(newPassword: string): Promise<NewPasswordResult> {
  try {
    const response = await fetch("/api/me/new-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (response.ok) return { ok: true, user: ((await response.json()) as UserResponse).user };
    const body = (await response.json()) as ErrorResponse;
    return {
      ok: false,
      error:
        body.error === "temporary_password_reused" ? "temporary_password_reused" : "unavailable",
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export type RegisterError =
  | "invite_code_unknown"
  | "invite_code_used"
  | "invite_code_expired"
  | "username_taken"
  | "unavailable";

export type RegisterResult = { ok: true; user: User } | { ok: false; error: RegisterError };

const registerErrors = new Set<string>([
  "invite_code_unknown",
  "invite_code_used",
  "invite_code_expired",
  "username_taken",
]);

export async function register(request: RegisterRequest): Promise<RegisterResult> {
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.ok) return { ok: true, user: ((await response.json()) as UserResponse).user };
    const { error } = (await response.json()) as ErrorResponse;
    return {
      ok: false,
      error: registerErrors.has(error) ? (error as RegisterError) : "unavailable",
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function fetchInviteCodes(): Promise<InviteCode[]> {
  const response = await fetch("/api/invite-codes");
  if (!response.ok) throw new Error(`Loading Invite Codes failed: ${response.status}`);
  return ((await response.json()) as InviteCodesResponse).inviteCodes;
}

export type GenerateInviteCodeResult =
  | { ok: true; inviteCode: InviteCode }
  | { ok: false; error: "limit" | "unavailable" };

export async function generateInviteCode(): Promise<GenerateInviteCodeResult> {
  try {
    const response = await fetch("/api/invite-codes", { method: "POST" });
    if (response.ok) {
      return { ok: true, inviteCode: ((await response.json()) as InviteCodeResponse).inviteCode };
    }
    return { ok: false, error: response.status === 409 ? "limit" : "unavailable" };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export type CatalogSearchOutcome =
  | { ok: true; manualResults: ManualSearchResult[]; results: CatalogSearchResult[] }
  | { ok: false; error: "aborted" | "unavailable" };

export async function searchCatalog(
  query: string,
  signal: AbortSignal,
): Promise<CatalogSearchOutcome> {
  const params = new URLSearchParams({ mediaType: "film", query });
  try {
    const response = await fetch(`/api/catalog/search?${params}`, { signal });
    if (!response.ok) return { ok: false, error: "unavailable" };
    const { manualResults, results } = (await response.json()) as CatalogSearchResponse;
    return { ok: true, manualResults, results };
  } catch {
    return { ok: false, error: signal.aborted ? "aborted" : "unavailable" };
  }
}

// Adds a search result's film to the catalog, or finds it there.
export async function addToCatalog(result: CatalogSearchResult): Promise<MediaItem | null> {
  try {
    const response = await fetch("/api/catalog/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (!response.ok) return null;
    return ((await response.json()) as MediaItemResponse).mediaItem;
  } catch {
    return null;
  }
}

// Catalog-backed Media Items by id, filled with the metadata the cache was missing where TMDB
// answers; empty when they couldn't be loaded.
export async function fetchMediaItems(ids: number[]): Promise<Map<number, MediaItem>> {
  try {
    const response = await fetch(
      `/api/catalog/items?${new URLSearchParams({ ids: ids.join(",") })}`,
    );
    if (!response.ok) return new Map();
    const { mediaItems } = (await response.json()) as MediaItemsResponse;
    return new Map(mediaItems.map((mediaItem) => [mediaItem.id, mediaItem]));
  } catch {
    return new Map();
  }
}

export type ManualMediaItemError =
  | "possible_duplicate"
  | "too_many_manual_media_items"
  | "invalid_request"
  | "unavailable";

export type SaveManualMediaItemResult =
  | { ok: true; mediaItem: MediaItem }
  | { ok: false; error: ManualMediaItemError };

const manualMediaItemErrors = new Set<string>([
  "possible_duplicate",
  "too_many_manual_media_items",
  "invalid_request",
]);

// Sends a new or edited Manual Media Item, and reads back the item or the reason it was refused.
async function sendManualMediaItem(
  url: string,
  method: "POST" | "PATCH",
  request: NewManualMediaItemRequest | ManualMediaItemEditRequest,
): Promise<SaveManualMediaItemResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.ok) {
      return { ok: true, mediaItem: ((await response.json()) as MediaItemResponse).mediaItem };
    }
    const { error } = (await response.json()) as ErrorResponse;
    return {
      ok: false,
      error: manualMediaItemErrors.has(error) ? (error as ManualMediaItemError) : "unavailable",
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export function createManualMediaItem(
  request: NewManualMediaItemRequest,
): Promise<SaveManualMediaItemResult> {
  return sendManualMediaItem("/api/catalog/manual-items", "POST", request);
}

export function editManualMediaItem(
  mediaItemId: number,
  edit: ManualMediaItemEditRequest,
): Promise<SaveManualMediaItemResult> {
  return sendManualMediaItem(`/api/catalog/manual-items/${mediaItemId}`, "PATCH", edit);
}

// One of the User's Manual Media Items and what deleting it would delete, or null when they have
// no such item.
export async function fetchManualMediaItem(
  mediaItemId: number,
): Promise<ManualMediaItemResponse | null> {
  const response = await fetch(`/api/catalog/manual-items/${mediaItemId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Loading the Manual Media Item failed: ${response.status}`);
  return (await response.json()) as ManualMediaItemResponse;
}

// True once the Manual Media Item is gone, including when it already was.
export async function deleteManualMediaItem(mediaItemId: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/catalog/manual-items/${mediaItemId}`, {
      method: "DELETE",
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

export type LogEntryError = LogDateProblem | "unavailable";

// removedFromBacklog is where a new Log Entry's film was in the Backlog before logging took it
// off; an edit never does, so it is null then.
export interface SavedLogEntry {
  ok: true;
  logEntry: LogEntry;
  removedFromBacklog: RemovedListItem | null;
}

export type SaveLogEntryResult = SavedLogEntry | { ok: false; error: LogEntryError };

const logEntryErrors = new Set<string>(["invalid_date", "date_too_early", "date_in_future"]);

// Sends a new or edited Log Entry, and reads back the entry or the reason it was refused.
async function sendLogEntry(
  url: string,
  method: "POST" | "PATCH",
  request: NewLogEntryRequest | LogEntryEditRequest,
): Promise<SaveLogEntryResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.ok) {
      const body = (await response.json()) as LogEntryResponse & Partial<NewLogEntryResponse>;
      return {
        ok: true,
        logEntry: body.logEntry,
        removedFromBacklog: body.removedFromBacklog ?? null,
      };
    }
    const { error } = (await response.json()) as ErrorResponse;
    return {
      ok: false,
      error: logEntryErrors.has(error) ? (error as LogEntryError) : "unavailable",
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export function createLogEntry(request: NewLogEntryRequest): Promise<SaveLogEntryResult> {
  return sendLogEntry("/api/log-entries", "POST", request);
}

export function editLogEntry(
  logEntryId: number,
  edit: LogEntryEditRequest,
): Promise<SaveLogEntryResult> {
  return sendLogEntry(`/api/log-entries/${logEntryId}`, "PATCH", edit);
}

// True once the Log Entry is gone, including when it already was.
export async function deleteLogEntry(logEntryId: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/log-entries/${logEntryId}`, { method: "DELETE" });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

export async function fetchLog(): Promise<LogEntry[]> {
  const response = await fetch("/api/log-entries");
  if (!response.ok) throw new Error(`Loading the Log failed: ${response.status}`);
  return ((await response.json()) as LogResponse).logEntries;
}

// A Media Item's Item History, or null when there is no such Media Item.
export async function fetchItemHistory(mediaItemId: number): Promise<ItemHistoryResponse | null> {
  const response = await fetch(`/api/catalog/items/${mediaItemId}/history`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Loading the Item History failed: ${response.status}`);
  return (await response.json()) as ItemHistoryResponse;
}

export async function fetchBacklog(): Promise<Backlog> {
  const response = await fetch("/api/backlog?mediaType=film");
  if (!response.ok) throw new Error(`Loading the Backlog failed: ${response.status}`);
  return ((await response.json()) as BacklogResponse).backlog;
}

export type PlanResult =
  | { ok: true; listItem: ListItem }
  | { ok: false; error: "backlog_full" | "unavailable" };

// Marks a Media Item Planned, or puts it back where it was with its Note to undo taking it off.
export async function plan(request: PlanRequest): Promise<PlanResult> {
  try {
    const response = await fetch("/api/backlog/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.ok) {
      return { ok: true, listItem: ((await response.json()) as ListItemResponse).listItem };
    }
    return { ok: false, error: response.status === 409 ? "backlog_full" : "unavailable" };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

// The edited List Item, or null when it couldn't be saved.
export async function editListItem(
  listItemId: number,
  edit: ListItemEditRequest,
): Promise<ListItem | null> {
  try {
    const response = await fetch(`/api/list-items/${listItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    if (!response.ok) return null;
    return ((await response.json()) as ListItemResponse).listItem;
  } catch {
    return null;
  }
}

// True once the List Item is gone, including when it already was.
export async function removeListItem(listItemId: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/list-items/${listItemId}`, { method: "DELETE" });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

export async function fetchLists(): Promise<ListSummary[]> {
  const response = await fetch("/api/lists");
  if (!response.ok) throw new Error(`Loading the Lists failed: ${response.status}`);
  return ((await response.json()) as ListsResponse).lists;
}

// One of the User's Lists, or null when they have no such List.
export async function fetchList(listId: number): Promise<List | null> {
  const response = await fetch(`/api/lists/${listId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Loading the List failed: ${response.status}`);
  return ((await response.json()) as ListResponse).list;
}

export type ListError = "list_name_reserved" | "list_name_taken" | "too_many_lists" | "unavailable";

export type SaveListResult = { ok: true; list: ListSummary } | { ok: false; error: ListError };

const listErrors = new Set<string>(["list_name_reserved", "list_name_taken", "too_many_lists"]);

// Sends a new or edited List, and reads back the List or the reason it was refused.
async function sendList(
  url: string,
  method: "POST" | "PATCH",
  request: NewListRequest | ListEditRequest,
): Promise<SaveListResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.ok) {
      return { ok: true, list: ((await response.json()) as ListSummaryResponse).list };
    }
    const { error } = (await response.json()) as ErrorResponse;
    return { ok: false, error: listErrors.has(error) ? (error as ListError) : "unavailable" };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export function createList(request: NewListRequest): Promise<SaveListResult> {
  return sendList("/api/lists", "POST", request);
}

export function editList(listId: number, edit: ListEditRequest): Promise<SaveListResult> {
  return sendList(`/api/lists/${listId}`, "PATCH", edit);
}

// True once the List is gone, including when it already was.
export async function deleteList(listId: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

export type AddToListError = "already_in_list" | "list_full" | "unavailable";

export type AddToListResult =
  | { ok: true; listItem: ListItem }
  | { ok: false; error: AddToListError };

const addToListErrors = new Set<string>(["already_in_list", "list_full"]);

// Adds a Media Item to a List, or puts a removed one back where it was with its Note.
export async function addToList(
  listId: number,
  request: NewListItemRequest,
): Promise<AddToListResult> {
  try {
    const response = await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.ok) {
      return { ok: true, listItem: ((await response.json()) as ListItemResponse).listItem };
    }
    const { error } = (await response.json()) as ErrorResponse;
    return {
      ok: false,
      error: addToListErrors.has(error) ? (error as AddToListError) : "unavailable",
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

// Shares one of the User's Lists, the Backlog included, and reads back its Share Link: a new one,
// or the one it already had. Null when it couldn't be shared.
export async function createShareLink(listId: number): Promise<ShareLink | null> {
  return sendShareLink(`/api/lists/${listId}/share-link`);
}

// Replaces the Share Link of one of the User's shared Lists; the old one stops working. Null when
// it couldn't be replaced.
export async function regenerateShareLink(listId: number): Promise<ShareLink | null> {
  return sendShareLink(`/api/lists/${listId}/share-link/regenerate`);
}

async function sendShareLink(url: string): Promise<ShareLink | null> {
  try {
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) return null;
    return ((await response.json()) as ShareLinkResponse).shareLink;
  } catch {
    return null;
  }
}

// True once the List's Share Link is revoked, including when it already was.
export async function revokeShareLink(listId: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/lists/${listId}/share-link`, { method: "DELETE" });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

// The List behind a Share Link, as anyone may see it, or null when the link doesn't work.
export async function fetchSharedList(token: string): Promise<SharedList | null> {
  const response = await fetch(`/api/shared-lists/${encodeURIComponent(token)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Loading the shared List failed: ${response.status}`);
  return ((await response.json()) as SharedListResponse).sharedList;
}
