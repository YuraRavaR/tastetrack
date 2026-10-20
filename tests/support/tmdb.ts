import { readFileSync } from "node:fs";
import { type APIRequestContext, expect } from "@playwright/test";

// Real TMDB is called on staging, and locally when .dev.vars sets TMDB_BASE_URL. Only the TMDB
// fake can be made to fail.
export function callsRealTmdb(): boolean {
  if (process.env.BASE_URL) return true;
  try {
    return /^TMDB_BASE_URL=/m.test(readFileSync(".dev.vars", "utf8"));
  } catch {
    return false;
  }
}

// Takes a film out of the TMDB cache through the test-hook route, as the cron does once an entry
// expires, so a page meets it on a cold cache.
export async function evict(request: APIRequestContext, tmdbId: string): Promise<void> {
  const response = await request.delete(`/api/test/tmdb-cache/film/${tmdbId}`);
  expect(response.status(), await response.text()).toBe(204);
}
