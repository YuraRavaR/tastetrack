import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

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

// Leaves every TMDB image loading for good, so a browser test sees the page before any image
// arrives and depends on neither TMDB nor the network.
export async function holdImages(page: Page): Promise<void> {
  await page.route("https://image.tmdb.org/**", () => {});
}
