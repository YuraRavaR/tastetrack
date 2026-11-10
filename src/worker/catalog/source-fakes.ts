// The fakes of the External Sources, mounted among the test hooks so that the `local` Worker
// searches them instead of the real sources (wrangler.jsonc). They come before the test hooks'
// secret check because the Worker's own calls to them don't carry the secret, so each exists only
// for a Worker that searches it: staging, which searches the real sources, has none.
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { openLibraryFake } from "./sources/open-library-fake";
import { tmdbFake } from "./sources/tmdb-fake";

export const sourceFakes = new Hono<AppEnv>();

sourceFakes.use("/tmdb/*", async (c, next) => {
  if (!c.env.TMDB_BASE_URL.includes("/api/test/tmdb/")) return c.notFound();
  await next();
});
sourceFakes.route("/tmdb", tmdbFake);

sourceFakes.use("/openlibrary/*", async (c, next) => {
  if (!c.env.OPEN_LIBRARY_BASE_URL.includes("/api/test/openlibrary")) return c.notFound();
  await next();
});
sourceFakes.route("/openlibrary", openLibraryFake);
