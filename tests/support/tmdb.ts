import { readFileSync } from "node:fs";

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
