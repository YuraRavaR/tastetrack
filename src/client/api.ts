// Calls to the Worker's API. The session travels in an HttpOnly cookie, so nothing here holds it.
import type {
  CatalogSearchResponse,
  CatalogSearchResult,
  ErrorResponse,
  InviteCode,
  InviteCodeResponse,
  InviteCodesResponse,
  LogEntry,
  LogEntryResponse,
  LogResponse,
  MediaItem,
  MediaItemResponse,
  NewLogEntryRequest,
  RegisterRequest,
  User,
  UserResponse,
} from "../shared/api";
import type { LogDateProblem } from "../shared/log";

// The logged-in User, or null without a live session.
export async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch("/api/auth/me");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Loading the current User failed: ${response.status}`);
  return ((await response.json()) as UserResponse).user;
}

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; error: "invalid_credentials" | "unavailable" };

export async function logIn(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) return { ok: true, user: ((await response.json()) as UserResponse).user };
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
  | { ok: true; results: CatalogSearchResult[] }
  | { ok: false; error: "aborted" | "unavailable" };

export async function searchCatalog(
  query: string,
  signal: AbortSignal,
): Promise<CatalogSearchOutcome> {
  const params = new URLSearchParams({ mediaType: "film", query });
  try {
    const response = await fetch(`/api/catalog/search?${params}`, { signal });
    if (!response.ok) return { ok: false, error: "unavailable" };
    return { ok: true, results: ((await response.json()) as CatalogSearchResponse).results };
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

export type LogEntryError = LogDateProblem | "unavailable";

export type CreateLogEntryResult =
  | { ok: true; logEntry: LogEntry }
  | { ok: false; error: LogEntryError };

const logEntryErrors = new Set<string>(["invalid_date", "date_too_early", "date_in_future"]);

export async function createLogEntry(request: NewLogEntryRequest): Promise<CreateLogEntryResult> {
  try {
    const response = await fetch("/api/log-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.ok) {
      return { ok: true, logEntry: ((await response.json()) as LogEntryResponse).logEntry };
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

export async function fetchLog(): Promise<LogEntry[]> {
  const response = await fetch("/api/log-entries");
  if (!response.ok) throw new Error(`Loading the Log failed: ${response.status}`);
  return ((await response.json()) as LogResponse).logEntries;
}
