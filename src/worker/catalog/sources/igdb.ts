// The IGDB catalog source of games (ADR-0012): a game is the work across all its platforms, and
// a search or a game's details are one IGDB request each, an Apicalypse query POSTed to /games.
// Everything IGDB- and Twitch-shaped stays in this file, the access token among it.
import { z } from "zod";
import type { GameCacheExtra } from "../../../db/schema";
import type { CoverUrls, GameMetadata } from "../../../shared/api";
import {
  type CatalogEntry,
  type CatalogEnv,
  type CatalogSearchMatch,
  type CatalogSource,
  type SourceFailure,
  SourceUnavailable,
  shownTitles,
} from "../source";
import { type SourceToken, storedToken, storeToken } from "../source-tokens";

const imageBaseUrl = "https://images.igdb.com/igdb/image/upload";

function imageUrl(size: string, imageId: string): string {
  return `${imageBaseUrl}/t_${size}/${imageId}.jpg`;
}

// Covers as a thumbnail, 264 pixels wide, and twice that for a grid or the game's page. Search
// results come in the thumbnail size only.
function coverUrls(imageId: string | null): CoverUrls | null {
  if (!imageId) return null;
  return { small: imageUrl("cover_big", imageId), large: imageUrl("cover_big_2x", imageId) };
}

// The cover's image ID back out of a thumbnail URL this module made, or null for any other URL.
function coverIdOf(url: string | null): string | null {
  const match =
    url && /^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_cover_big\/(\w+)\.jpg$/.exec(url);
  return match ? (match[1] ?? null) : null;
}

// The banner, from the game's art, for a phone's screen and for a larger screen's.
function backdropUrls(imageId: string | null): GameMetadata["backdropUrls"] {
  if (!imageId) return null;
  return { small: imageUrl("720p", imageId), large: imageUrl("1080p", imageId) };
}

// Only the fields we use, so IGDB adding or dropping others doesn't break us. Every expanded
// field comes as an object with the subfields asked for.
const IgdbImage = z.object({ image_id: z.string() });

const IgdbPlatform = z.object({ abbreviation: z.string().optional(), name: z.string() });

const IgdbGame = z.object({
  id: z.number(),
  name: z.string(),
  // Seconds since the epoch.
  first_release_date: z.number().optional(),
  cover: IgdbImage.optional(),
  platforms: z.array(IgdbPlatform).optional(),
});

type IgdbGame = z.infer<typeof IgdbGame>;

const IgdbGameDetails = IgdbGame.extend({
  involved_companies: z
    .array(z.object({ developer: z.boolean(), company: z.object({ name: z.string() }) }))
    .optional(),
  genres: z.array(z.object({ name: z.string() })).optional(),
  summary: z.string().optional(),
  url: z.url().optional(),
  artworks: z.array(IgdbImage).optional(),
  screenshots: z.array(IgdbImage).optional(),
});

function yearOf(game: IgdbGame): number | null {
  if (game.first_release_date === undefined) return null;
  return new Date(game.first_release_date * 1000).getUTCFullYear();
}

// A platform by its abbreviation, "PS4", or its name when it has none.
function platformsOf(game: IgdbGame): string[] {
  return game.platforms?.map((platform) => platform.abbreviation || platform.name) ?? [];
}

// The Media Item filter (ADR-0012): a main game, a remake, a remaster or a standalone expansion,
// by their game_type IDs, that is no edition of another and wasn't cancelled. Unreleased games
// mostly have no game_status, which `!=` alone would leave out.
const mediaItemsOnly =
  "game_type = (0,4,8,9) & version_parent = null & (game_status = null | game_status != 6)";

const searchFields = [
  "name",
  "first_release_date",
  "cover.image_id",
  "platforms.abbreviation",
  "platforms.name",
].join(",");

const detailsFields = [
  searchFields,
  "involved_companies.developer",
  "involved_companies.company.name",
  "genres.name",
  "summary",
  "url",
  "artworks.image_id",
  "screenshots.image_id",
].join(",");

// A query as an Apicalypse string.
function quoted(text: string): string {
  return `"${text.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
}

// IGDB takes a Twitch application's credentials, so a 401 or 403 means our token or application
// is refused. IGDB answers an ID it doesn't have with an empty list, never a 404, so nothing it
// answers with a status is gone; a 429 or a 5xx is worth trying again.
function classifyFailure(status: number): SourceFailure {
  if (status === 401 || status === 403) return "access";
  return "temporary";
}

function configured(env: CatalogEnv): boolean {
  return Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
}

// A token with fewer than this many days left is renewed, well before Twitch's 60 days run out.
const renewalMargin = 7 * 24 * 60 * 60 * 1000;

function usable(token: SourceToken | null, refused: string | null): token is SourceToken {
  return (
    token !== null &&
    token.accessToken !== refused &&
    token.expiresAt.getTime() - Date.now() > renewalMargin
  );
}

const TwitchToken = z.object({ access_token: z.string().min(1), expires_in: z.number() });

// A new access token from Twitch, for the client credentials, kept in D1 for every invocation to
// reuse. Twitch allows an application 25 at once, so two Workers asking at once do no harm.
async function requestToken(env: CatalogEnv): Promise<SourceToken> {
  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID ?? "",
    client_secret: env.TWITCH_CLIENT_SECRET ?? "",
    grant_type: "client_credentials",
  });
  let response: Response;
  try {
    response = await fetch(env.TWITCH_TOKEN_URL, { method: "POST", body });
  } catch (error) {
    throw new SourceUnavailable("Twitch's token call failed", "temporary", { cause: error });
  }
  if (!response.ok) {
    const failure = response.status === 400 || response.status === 403 ? "access" : "temporary";
    throw new SourceUnavailable(`Twitch's token call answered ${response.status}`, failure);
  }
  const granted = TwitchToken.safeParse(await response.json().catch(() => undefined));
  if (!granted.success) {
    throw new SourceUnavailable("Twitch's token call answered in an unknown shape", "temporary");
  }
  const token = {
    accessToken: granted.data.access_token,
    expiresAt: new Date(Date.now() + granted.data.expires_in * 1000),
  };
  await storeToken(env.DB, "igdb", token);
  return token;
}

// The token this isolate last used, and the lookup under way, so that the requests of one page
// wait for one token rather than each asking for its own.
let held: SourceToken | null = null;
let lookup: Promise<SourceToken> | null = null;

// A token to call IGDB with: the one held, else the one in D1, else a new one, but never
// `refused`, the token IGDB has just answered 401 to.
function accessToken(env: CatalogEnv, refused: string | null): Promise<SourceToken> {
  if (usable(held, refused)) return Promise.resolve(held);
  lookup ??= (async () => {
    const stored = await storedToken(env.DB, "igdb");
    held = usable(stored, refused) ? stored : await requestToken(env);
    return held;
  })().finally(() => {
    lookup = null;
  });
  return lookup;
}

async function call(env: CatalogEnv, token: SourceToken, query: string): Promise<Response> {
  try {
    return await fetch(`${env.IGDB_BASE_URL}/games`, {
      method: "POST",
      headers: {
        "Client-ID": env.TWITCH_CLIENT_ID ?? "",
        Authorization: `Bearer ${token.accessToken}`,
        Accept: "application/json",
      },
      body: query,
    });
  } catch (error) {
    throw new SourceUnavailable("IGDB /games failed", "temporary", { cause: error });
  }
}

// One query to IGDB's games, answered with the games it found, each as IGDB gave it. A 401 gets
// a new token and is tried once more.
async function games(env: CatalogEnv, query: string): Promise<unknown[]> {
  if (!configured(env)) {
    throw new SourceUnavailable("TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET is not set", "access");
  }
  const token = await accessToken(env, null);
  let response = await call(env, token, query);
  if (response.status === 401) {
    response = await call(env, await accessToken(env, token.accessToken), query);
  }
  if (!response.ok) {
    throw new SourceUnavailable(
      `IGDB /games answered ${response.status}`,
      classifyFailure(response.status),
    );
  }
  const body = z.array(z.unknown()).safeParse(await response.json().catch(() => undefined));
  if (!body.success) {
    throw new SourceUnavailable("IGDB /games answered in an unknown shape", "temporary");
  }
  return body.data;
}

// The first matches that are Media Items, in IGDB's order. IGDB has one title for a game, in
// English, so a Cyrillic query is sent as typed and matches only the Russian names some games
// have besides it. A game that isn't shaped as we read it is left out.
async function searchGames(env: CatalogEnv, query: string): Promise<CatalogSearchMatch[]> {
  const found = await games(
    env,
    `search ${quoted(query)}; fields ${searchFields}; where ${mediaItemsOnly}; limit 20;`,
  );
  return found.flatMap((each) => {
    const game = IgdbGame.safeParse(each);
    if (!game.success) return [];
    const { id, name, cover } = game.data;
    return {
      externalReference: { source: "igdb", mediaType: "game", id: String(id) },
      title: name,
      originalTitle: name,
      year: yearOf(game.data),
      posterUrl: coverUrls(cover?.image_id ?? null)?.small ?? null,
      titleLanguage: "en",
      authors: [],
      platforms: platformsOf(game.data),
    };
  });
}

// One request for everything a game's entry holds. IGDB answers an ID it doesn't have, or no
// longer has, with no game, which counts as gone. Its name is both its Original Title and its
// English Localized Title, and it has no Ukrainian one.
async function gameDetails(env: CatalogEnv, id: string): Promise<CatalogEntry<"game">> {
  if (!/^\d+$/.test(id)) throw new SourceUnavailable(`IGDB has no game ${id}`, "gone");
  const [found] = await games(env, `fields ${detailsFields}; where id = ${id};`);
  if (found === undefined) throw new SourceUnavailable(`IGDB has no game ${id}`, "gone");
  const details = IgdbGameDetails.safeParse(found);
  if (!details.success) {
    throw new SourceUnavailable("IGDB's game answered in an unknown shape", "temporary");
  }
  const game = details.data;
  const developer = game.involved_companies?.find((company) => company.developer);
  const banner = game.artworks?.[0] ?? game.screenshots?.[0];
  const extra: GameCacheExtra = {
    developer: developer?.company.name ?? null,
    platforms: platformsOf(game),
    genres: game.genres?.map((genre) => genre.name) ?? [],
    summary: game.summary?.trim() || null,
    url: game.url ?? null,
    bannerRef: banner?.image_id ?? null,
  };
  return {
    englishTitle: game.name,
    ukrainianTitle: null,
    originalTitle: game.name,
    year: yearOf(game),
    coverRef: game.cover?.image_id ?? null,
    extra,
  };
}

// IGDB's games, kept 21 days at most: IGDB keeps a removed image on its CDN for 30, so a cover or
// banner it replaces is refreshed before its old URL breaks. Each costs the cron one subrequest.
export const igdbGames: CatalogSource<"game"> = {
  externalSource: "igdb",
  mediaType: "game",
  refreshCost: 1,
  maxEntryAge: 21 * 24 * 60 * 60 * 1000,
  search: searchGames,
  details: gameDetails,
  coverRefOf: coverIdOf,
  emptyExtra: {
    developer: null,
    platforms: [],
    genres: [],
    summary: null,
    url: null,
    bannerRef: null,
  },
  coverUrls,
  configured,
  classifyFailure,
  metadataOf: (entry) => ({
    ...shownTitles(entry),
    ukrainianTitle: null,
    year: entry.year,
    coverUrls: coverUrls(entry.coverRef),
    backdropUrls: backdropUrls(entry.extra.bannerRef),
    developer: entry.extra.developer,
    platforms: entry.extra.platforms,
    genres: entry.extra.genres,
    url: entry.extra.url,
  }),
  // Nothing to show without a summary or a genre. A row filled from a search result alone has
  // neither.
  aboutOf: ({ extra: { summary, genres } }) =>
    summary || genres.length > 0 ? { mediaType: "game", summary, genres } : null,
};
