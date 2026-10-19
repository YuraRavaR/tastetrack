// Calls to the Worker's API. The session travels in an HttpOnly cookie, so nothing here holds it.
import type { ErrorResponse, User, UserResponse } from "../shared/api";

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
