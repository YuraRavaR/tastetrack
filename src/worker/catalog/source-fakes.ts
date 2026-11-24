// The fakes of the External Sources, mounted among the test hooks so that the `local` Worker
// searches them instead of the real sources (wrangler.jsonc). They come before the test hooks'
// secret check because the Worker's own calls to them don't carry the secret, so each exists only
// for a Worker that searches it: staging, which searches the real sources, has none.
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { igdbFake, igdbFakeTokens } from "./sources/igdb-fake";
import {
  coverArtArchiveFake,
  musicBrainzFake,
  musicBrainzFakeCalls,
} from "./sources/musicbrainz-fake";
import { openLibraryFake } from "./sources/open-library-fake";
import { tmdbFake } from "./sources/tmdb-fake";
import { wikimediaFake } from "./sources/wikimedia-fake";

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

// Whether the Worker calls the IGDB fake, which answers Twitch's token calls too.
export function callsIgdbFake(env: Pick<Env, "IGDB_BASE_URL">): boolean {
  return env.IGDB_BASE_URL.includes("/api/test/igdb/");
}

sourceFakes.use("/igdb/*", async (c, next) => {
  if (!callsIgdbFake(c.env)) return c.notFound();
  await next();
});
sourceFakes.route("/igdb", igdbFake);

// Whether the Worker calls the MusicBrainz fake, which also answers the calls a test makes busy
// under /busy/ (X-Test-MusicBrainz-Busy).
export function callsMusicBrainzFake(env: Pick<Env, "MUSICBRAINZ_BASE_URL">): boolean {
  return env.MUSICBRAINZ_BASE_URL.includes("/api/test/musicbrainz/");
}

sourceFakes.use("/musicbrainz/*", async (c, next) => {
  if (!callsMusicBrainzFake(c.env)) return c.notFound();
  await next();
});
sourceFakes.route("/musicbrainz", musicBrainzFake);

sourceFakes.use("/coverartarchive/*", async (c, next) => {
  if (!c.env.COVER_ART_ARCHIVE_BASE_URL.includes("/api/test/coverartarchive")) return c.notFound();
  await next();
});
sourceFakes.route("/coverartarchive", coverArtArchiveFake);

sourceFakes.use("/wikimedia/*", async (c, next) => {
  if (!c.env.WIKIDATA_BASE_URL.includes("/api/test/wikimedia/")) return c.notFound();
  await next();
});
sourceFakes.route("/wikimedia", wikimediaFake);

// What a test can see and change of the IGDB fake's tokens, and see of the MusicBrainz fake's
// calls, through the test hooks.
export { igdbFakeTokens, musicBrainzFakeCalls };
