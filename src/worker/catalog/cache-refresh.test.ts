import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CacheExtra,
  catalogCache,
  inProgress,
  listItems,
  lists,
  logEntries,
  mediaItems,
  sourceTokens,
  users,
} from "../../db/schema";
import type {
  ExternalReference,
  FilmMetadata,
  MediaItem,
  MediaType,
  SeriesEpisode,
  SeriesStatus,
} from "../../shared/api";
import { userLog } from "../log/log-entries";
import { openTestDatabase, type TestDatabase } from "../test-database";
import { dueForRefresh, refreshCache } from "./cache-refresh";
import { addFromSearch, catalogMediaItems } from "./media-items";
import { sourceOf } from "./registry";
import { SourceUnavailable } from "./source";
import { storeToken } from "./source-tokens";
import { igdbFake, igdbFakeToken } from "./sources/igdb-fake";
import {
  musicBrainzFake,
  musicBrainzFakeCalls,
  musicBrainzFakeFailing,
} from "./sources/musicbrainz-fake";
import { openLibraryFake } from "./sources/open-library-fake";
import { tmdbFake } from "./sources/tmdb-fake";

const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-20T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * day);
}

let database: TestDatabase;
let db: DrizzleD1Database;
let userId: number;
// A List of each Media Type.
let listIds: Record<MediaType, number>;

beforeAll(async () => {
  database = await openTestDatabase();
  db = database.db;
}, 30_000);

afterAll(() => database.dispose());

beforeEach(async () => {
  await db.batch([
    db.delete(catalogCache),
    db.delete(mediaItems),
    db.delete(lists),
    db.delete(users),
    db.run(sql`delete from sqlite_sequence`),
  ]);
  const [user] = await db
    .insert(users)
    .values({
      username: "olena",
      passwordHash: "x",
      passwordSalt: "x",
      passwordIterations: 1,
      createdAt: now,
    })
    .returning();
  if (!user) throw new Error("no user");
  userId = user.id;
  const [films, books, series, games, albums, songs] = await db
    .insert(lists)
    .values([
      { userId, kind: "list", mediaType: "film", name: "F", nameKey: "f", createdAt: now },
      { userId, kind: "list", mediaType: "book", name: "B", nameKey: "b", createdAt: now },
      { userId, kind: "list", mediaType: "series", name: "S", nameKey: "s", createdAt: now },
      { userId, kind: "list", mediaType: "game", name: "G", nameKey: "g", createdAt: now },
      { userId, kind: "list", mediaType: "album", name: "A", nameKey: "a", createdAt: now },
      { userId, kind: "list", mediaType: "song", name: "M", nameKey: "m", createdAt: now },
    ])
    .returning();
  if (!films || !books || !series || !games || !albums || !songs) throw new Error("no lists");
  listIds = {
    film: films.id,
    book: books.id,
    series: series.id,
    game: games.id,
    album: albums.id,
    song: songs.id,
  };
});

interface Work {
  // Where the work is referenced from, if anywhere.
  in?: "log" | "list" | "inProgress";
  // Its cache entry: when it was last filled, whether by a details call, and for a film whether it
  // has an English Localized Title and a backdrop path. None when omitted.
  cached?: { updated: Date; detailed?: boolean; english?: boolean; backdrop?: string };
}

// Adds a catalog-backed Media Item, with a cache entry titled `title` if it is cached.
async function work(
  { source, mediaType, id }: ExternalReference,
  title: string,
  extra: CacheExtra,
  { in: where, cached }: Work,
): Promise<void> {
  const [item] = await db
    .insert(mediaItems)
    .values({ mediaType, externalSource: source, externalId: id, createdAt: now })
    .returning();
  if (!item) throw new Error("no media item");
  if (where === "log") {
    await db.insert(logEntries).values({ userId, mediaItemId: item.id, rating: 8, createdAt: now });
  }
  if (where === "inProgress") {
    await db.insert(inProgress).values({ userId, mediaItemId: item.id, createdAt: now });
  }
  if (where === "list") {
    await db.insert(listItems).values({
      listId: listIds[mediaType],
      mediaItemId: item.id,
      position: item.id,
      createdAt: now,
    });
  }
  if (cached) {
    await db.insert(catalogCache).values({
      externalSource: source,
      mediaType,
      externalId: id,
      englishTitle: cached.english === false ? null : title,
      originalTitle: title,
      extra,
      updatedAt: cached.updated,
      detailedAt: cached.detailed === false ? null : cached.updated,
    });
  }
}

// Adds a catalog-backed film with TMDB id `id`.
async function film(id: string, options: Work = {}): Promise<void> {
  const extra = { backdropPath: options.cached?.backdrop ?? null, runtime: null, genres: null };
  await work({ source: "tmdb", mediaType: "film", id }, `Film ${id}`, extra, options);
}

// Adds a catalog-backed book with Open Library work ID `id`.
async function book(id: string, options: Work = {}): Promise<void> {
  await work(
    { source: "openlibrary", mediaType: "book", id },
    `Book ${id}`,
    { authors: [] },
    options,
  );
}

// Adds a catalog-backed series with TMDB id `id`, its status and last aired episode unknown
// unless given.
async function series(
  id: string,
  options: Work & { status?: SeriesStatus | null; lastAiredEpisode?: SeriesEpisode } = {},
): Promise<void> {
  const extra = {
    backdropPath: null,
    firstAirYear: null,
    lastAirYear: null,
    status: options.status ?? null,
    seasons: [],
    lastAiredEpisode: options.lastAiredEpisode ?? null,
    nextAirDate: null,
    overview: { en: null, uk: null },
    tagline: { en: null, uk: null },
    creators: [],
    cast: [],
  };
  await work({ source: "tmdb", mediaType: "series", id }, `Series ${id}`, extra, options);
}

// Adds a catalog-backed game with IGDB id `id`.
async function game(id: string, options: Work = {}): Promise<void> {
  const extra = sourceOf("game").emptyExtra;
  await work({ source: "igdb", mediaType: "game", id }, `Game ${id}`, extra, options);
}

// Adds a catalog-backed album with release-group MBID `id`.
async function album(id: string, options: Work = {}): Promise<void> {
  const extra = sourceOf("album").emptyExtra;
  await work({ source: "musicbrainz", mediaType: "album", id }, `Album ${id}`, extra, options);
}

// Adds a catalog-backed song with recording MBID `id`.
async function song(id: string, options: Work = {}): Promise<void> {
  const extra = sourceOf("song").emptyExtra;
  await work({ source: "musicbrainz", mediaType: "song", id }, `Song ${id}`, extra, options);
}

// Recordings the MusicBrainz fake has, each a Media Item.
const songIds = [
  "d8d55f18-0c4b-4036-a16d-e273ac8953fc",
  "22ea4f0b-0db2-4e24-a0d0-b60fa92f340b",
  "f4100990-432c-47c3-adc4-29a868a2439b",
  "09aeabc9-988d-46d5-9e7a-1ab44a543b3b",
  "37f5dc8e-3b15-4953-a768-215d5ff651d3",
  "b3a54e3b-dadd-41f7-8efe-3f5c07e3259c",
  "47fd3d33-f944-4e87-b9cc-808ff7ce64a9",
];

// Release groups the MusicBrainz fake has, each a Media Item.
const albumIds = [
  "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
  "c70b84d2-1538-44c5-a7f0-71ed32508e92",
  "c0b2899c-41ab-4907-abf0-ff1962477ff2",
  "004a4e79-ac6c-448a-9d7f-b1b1714aa22a",
  "42ef6001-3113-440c-ae7c-3667c7351e35",
  "9162580e-5df4-32de-80cc-f45a8d8a9b1d",
  "eabb68b3-d57c-359a-8215-91f38d365da5",
  "b7f51377-4088-43bc-beb7-58705d9af90e",
  "68b61f05-aa49-4dda-9cdc-1104e4541aed",
  "d9e73c6c-2fd9-4652-b1b1-87031957d705",
  "4513c7b9-854e-457f-81d6-3dbeb001beb8",
  "67210625-2acc-4689-8b76-a43181af8a10",
];

// A film's metadata, of a Media Item that should be one.
function filmMetadata(mediaItem: MediaItem | undefined): FilmMetadata | null {
  if (mediaItem?.mediaType !== "film") throw new Error("not a film");
  return mediaItem.metadata;
}

async function due(limit?: number): Promise<string[]> {
  return (await dueForRefresh(db, now, limit)).map((key) => key.externalId);
}

describe("which cache entries the cron refreshes", () => {
  it("picks entries a Log Entry or List Item references, oldest first", async () => {
    await film("1", { in: "log", cached: { updated: daysAgo(30) } });
    await film("2", { in: "list", cached: { updated: daysAgo(60) } });
    await film("3", { in: "log", cached: { updated: daysAgo(45) } });

    expect(await due()).toEqual(["2", "3", "1"]);
  });

  it("picks entries an In Progress references, as one a Log Entry does", async () => {
    await book("OL1W", { in: "inProgress", cached: { updated: daysAgo(30) } });
    await book("OL2W", { cached: { updated: daysAgo(30) } });

    expect(await due()).toEqual(["OL1W"]);
  });

  it("leaves out entries nothing references, however old", async () => {
    await film("1", { cached: { updated: daysAgo(80) } });
    await film("2", { in: "list", cached: { updated: daysAgo(30) } });

    expect(await due()).toEqual(["2"]);
  });

  it("picks at most a batch, 40 unless told otherwise", async () => {
    for (let id = 1; id <= 45; id++) {
      await film(String(id), { in: "log", cached: { updated: daysAgo(10 + id) } });
    }

    const batch = await due();
    expect(batch).toHaveLength(40);
    expect(batch[0]).toBe("45");
    expect(batch).not.toContain("5");
    expect(await due(2)).toEqual(["45", "44"]);
  });

  it("counts a batch in subrequests: 40, whatever each entry's source costs", async () => {
    for (let id = 1; id <= 45; id++) {
      await film(String(id), { in: "log", cached: { updated: daysAgo(10 + id) } });
    }
    // As if films cost two subrequests an entry.
    const twoEach = () => 2;

    const batch = (await dueForRefresh(db, now, undefined, twoEach)).map((key) => key.externalId);
    expect(batch).toEqual(Array.from({ length: 20 }, (_, index) => String(45 - index)));
    const odd = await dueForRefresh(db, now, 5, twoEach);
    expect(odd.map((key) => key.externalId)).toEqual(["45", "44"]);
  });

  it("counts a film as one subrequest and a book as three, and never spends more than 40", async () => {
    // From the oldest: a book, a film, a book, a film and so on, four subrequests a pair.
    for (let n = 1; n <= 20; n++) {
      await book(`OL${n}W`, { in: "log", cached: { updated: daysAgo(100 - 2 * n) } });
      await film(String(n), { in: "log", cached: { updated: daysAgo(99 - 2 * n) } });
    }
    const pairs = (count: number) => {
      return Array.from({ length: count }, (_, index) => [`OL${index + 1}W`, String(index + 1)]);
    };

    // Ten pairs cost 40.
    expect((await dueForRefresh(db, now)).map((key) => key.externalId)).toEqual(pairs(10).flat());
    // Of 38, nine pairs leave 2, so the next book doesn't fit, and the film after it doesn't jump it.
    expect((await dueForRefresh(db, now, 38)).map((key) => key.externalId)).toEqual(
      pairs(9).flat(),
    );
  });

  it("leaves entries refreshed within the last week until they are a week old", async () => {
    await film("1", { in: "log", cached: { updated: daysAgo(6) } });
    await film("2", { in: "log", cached: { updated: daysAgo(8) } });

    expect(await due()).toEqual(["2"]);
  });

  it("picks entries filled from a search result alone first, however new", async () => {
    await film("1", { in: "log", cached: { updated: daysAgo(80) } });
    await film("2", { in: "list", cached: { updated: daysAgo(0), detailed: false } });
    await film("3", { in: "list", cached: { updated: daysAgo(2), detailed: false } });

    expect(await due()).toEqual(["3", "2", "1"]);
  });

  it("picks a running series some User has In Progress once a day old, before week-old ones", async () => {
    await film("1", { in: "log", cached: { updated: daysAgo(30) } });
    await series("2", { in: "inProgress", status: "returning", cached: { updated: daysAgo(1.1) } });
    await series("3", { in: "inProgress", status: "returning", cached: { updated: daysAgo(0.9) } });
    await series("4", { in: "inProgress", cached: { updated: daysAgo(2) } });

    expect(await due()).toEqual(["4", "2", "1"]);
  });

  it("leaves ended and cancelled series, and those nobody has In Progress, until a week old", async () => {
    await series("1", { in: "inProgress", status: "ended", cached: { updated: daysAgo(2) } });
    await series("2", { in: "inProgress", status: "canceled", cached: { updated: daysAgo(2) } });
    await series("3", { in: "log", status: "returning", cached: { updated: daysAgo(2) } });
    await series("4", { in: "list", status: "returning", cached: { updated: daysAgo(2) } });
    await series("5", { in: "inProgress", status: "ended", cached: { updated: daysAgo(9) } });
    await series("6", { in: "log", status: "returning", cached: { updated: daysAgo(8) } });

    expect(await due()).toEqual(["5", "6"]);
  });

  it("leaves half the batch to week-old entries when many running series are due", async () => {
    for (let n = 1; n <= 45; n++) {
      const updated = daysAgo(2 + n / 100);
      await series(`S${n}`, { in: "inProgress", status: "returning", cached: { updated } });
      await film(`F${n}`, { in: "log", cached: { updated: daysAgo(30 + n) } });
    }

    const batch = await due();
    expect(batch).toEqual([
      ...Array.from({ length: 20 }, (_, index) => `S${45 - index}`),
      ...Array.from({ length: 20 }, (_, index) => `F${45 - index}`),
    ]);
  });

  it("gives running series what week-old entries leave of the batch", async () => {
    for (let n = 1; n <= 45; n++) {
      const updated = daysAgo(2 + n / 100);
      await series(`S${n}`, { in: "inProgress", status: "returning", cached: { updated } });
    }
    await film("F1", { in: "log", cached: { updated: daysAgo(30) } });

    expect(await due()).toEqual([
      ...Array.from({ length: 20 }, (_, index) => `S${45 - index}`),
      "F1",
      ...Array.from({ length: 19 }, (_, index) => `S${25 - index}`),
    ]);
  });

  it("still picks entries filled from a search result alone before running series", async () => {
    for (let n = 1; n <= 10; n++) {
      await film(`N${n}`, { in: "list", cached: { updated: daysAgo(n / 100), detailed: false } });
    }
    for (let n = 1; n <= 45; n++) {
      const updated = daysAgo(2 + n / 100);
      await series(`S${n}`, { in: "inProgress", status: "returning", cached: { updated } });
      await film(`F${n}`, { in: "log", cached: { updated: daysAgo(30 + n) } });
    }

    // Ten from search; then half of the thirty left for series, and the rest for week-old films.
    expect(await due()).toEqual([
      ...Array.from({ length: 10 }, (_, index) => `N${10 - index}`),
      ...Array.from({ length: 15 }, (_, index) => `S${45 - index}`),
      ...Array.from({ length: 15 }, (_, index) => `F${45 - index}`),
    ]);
  });

  it("picks a running series that is also a week old once", async () => {
    await series("1", { in: "inProgress", status: "returning", cached: { updated: daysAgo(10) } });

    expect(await due()).toEqual(["1"]);
  });

  it("leaves out referenced films with no cache entry: a page fills those", async () => {
    await film("1", { in: "log" });
    await film("2", { in: "log", cached: { updated: daysAgo(10) } });

    expect(await due()).toEqual(["2"]);
  });
});

// The sources' configuration: each is the fake the `local` Worker searches, reached through fetch,
// and the database where IGDB's token is kept.
const env = {
  TMDB_BASE_URL: "http://tmdb.test/3",
  TMDB_ACCESS_TOKEN: "fake-tmdb-token",
  OPEN_LIBRARY_BASE_URL: "http://openlibrary.test",
  OPEN_LIBRARY_CONTACT: "operator@tastetrack.invalid",
  IGDB_BASE_URL: "http://igdb.test/v4",
  TWITCH_TOKEN_URL: "http://igdb.test/oauth2/token",
  TWITCH_CLIENT_ID: "fake-twitch-client-id",
  TWITCH_CLIENT_SECRET: "fake-twitch-client-secret",
  MUSICBRAINZ_BASE_URL: "http://musicbrainz.test/ws/2",
  COVER_ART_ARCHIVE_BASE_URL: "http://coverartarchive.test",
  MUSICBRAINZ_INTERVAL_MS: "20",
  get DB() {
    return database.binding;
  },
};

// The calls made to MusicBrainz, each from when it was made to when it was answered, and the most
// that were under way at once.
let musicBrainzCalls: { start: number; end: number }[] = [];
let musicBrainzAtOnce = 0;

// The metadata titles the User's Log shows, in Log Order.
async function loggedTitles(): Promise<(string | null)[]> {
  return (await userLog(db, userId, now)).map((entry) => entry.mediaItem.metadata?.title ?? null);
}

// How many subrequests the test has made to the sources.
let subrequests = 0;

// Points fetch at the sources' fakes for each test in the enclosing describe, and counts the calls.
function useSourceFakes(): void {
  beforeEach(async () => {
    subrequests = 0;
    // A token the IGDB fake takes, as the Worker keeps one between runs, so that only a test that
    // says so asks Twitch for one.
    await storeToken(database.binding, "igdb", {
      accessToken: igdbFakeToken(),
      expiresAt: new Date(Date.now() + 50 * day),
    });
    // Each failed details call is logged; the tests say which fail.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    musicBrainzCalls = [];
    musicBrainzAtOnce = 0;
    let underWay = 0;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      subrequests += 1;
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith("http://musicbrainz.test")) {
        const call = { start: Date.now(), end: 0 };
        underWay += 1;
        musicBrainzAtOnce = Math.max(musicBrainzAtOnce, underWay);
        const path = url.slice("http://musicbrainz.test".length);
        const response = await musicBrainzFake.request(path, init, env);
        underWay -= 1;
        call.end = Date.now();
        musicBrainzCalls.push(call);
        return response;
      }
      const fakes = [
        [env.OPEN_LIBRARY_BASE_URL, openLibraryFake],
        ["http://igdb.test", igdbFake],
      ] as const;
      const fake = fakes.find(([base]) => url.startsWith(base))?.[1] ?? tmdbFake;
      return fake.request(url, init);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

describe("a cron run", () => {
  useSourceFakes();

  it("refreshes the entries due with TMDB's details", async () => {
    await film("348", { in: "log", cached: { updated: daysAgo(30) } });
    await film("679", { in: "log", cached: { updated: daysAgo(2) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 1, failed: 0, deleted: 0 });
    expect(await loggedTitles()).toEqual(["Alien", "Film 679"]);
    expect((await userLog(db, userId, now))[0]?.mediaItem.metadata).toEqual({
      title: "Alien",
      originalTitle: "Alien",
      ukrainianTitle: "Чужий",
      year: 1979,
      posterUrls: {
        small: "https://image.tmdb.org/t/p/w92/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg",
        large: "https://image.tmdb.org/t/p/w500/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg",
      },
      backdropUrls: {
        small: "https://image.tmdb.org/t/p/w780/AmR3JG1VQVxU8TfAvljUhfSFUOx.jpg",
        large: "https://image.tmdb.org/t/p/w1280/AmR3JG1VQVxU8TfAvljUhfSFUOx.jpg",
      },
      runtime: 117,
      genres: ["Horror", "Science Fiction"],
    });
    expect(await due()).toEqual([]);
  });

  it("clears a cached backdrop TMDB no longer has", async () => {
    // The fake has no backdrop for this film.
    await film("679", { in: "log", cached: { updated: daysAgo(30), backdrop: "/gone.jpg" } });

    await refreshCache(db, env, now);
    expect(filmMetadata((await userLog(db, userId, now))[0]?.mediaItem)?.backdropUrls).toBeNull();
  });

  it("keeps an entry TMDB doesn't answer for, to try again next run", async () => {
    // The fake fails the details call for this one, the way TMDB does when it is down.
    await film("999000001", { in: "log", cached: { updated: daysAgo(30) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 0, failed: 1, deleted: 0 });
    expect(await loggedTitles()).toEqual(["Film 999000001"]);
    expect(await due()).toEqual(["999000001"]);
  });

  it("gets past a full batch of entries TMDB never answers for", async () => {
    // Films the fake doesn't know, so their details call is a 404 every time.
    for (let id = 1; id <= 40; id++) {
      await film(`404${id}`, { in: "log", cached: { updated: daysAgo(60) } });
    }
    await film("348", { in: "log", cached: { updated: daysAgo(30) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 0, failed: 40, deleted: 0 });
    const nextRun = new Date(now.getTime() + 15 * 60 * 1000);
    expect(await refreshCache(db, env, nextRun)).toEqual({
      refreshed: 1,
      failed: 39,
      deleted: 0,
    });
    expect((await loggedTitles()).filter((title) => title === "Alien")).toHaveLength(1);
  });

  it("gets past a full batch of search-result entries TMDB never answers for", async () => {
    for (let id = 1; id <= 40; id++) {
      await film(`404${id}`, { in: "log", cached: { updated: daysAgo(2), detailed: false } });
    }
    await film("348", { in: "log", cached: { updated: daysAgo(1), detailed: false } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 0, failed: 40, deleted: 0 });
    const nextRun = new Date(now.getTime() + 15 * 60 * 1000);
    expect((await refreshCache(db, env, nextRun)).refreshed).toBe(1);
    expect((await loggedTitles()).filter((title) => title === "Alien")).toHaveLength(1);
  });

  it("refreshes films and books in one run, within 40 subrequests", async () => {
    // The two oldest are works the fakes know; neither fake knows the rest, which come a film
    // and then a book, on and on.
    await film("348", { in: "log", cached: { updated: daysAgo(89) } });
    await book("OL2094429W", { in: "log", cached: { updated: daysAgo(88) } });
    for (let n = 1; n <= 20; n++) {
      await film(`404${n}`, { in: "list", cached: { updated: daysAgo(80 - n) } });
      await book(`OL404${n}W`, { in: "list", cached: { updated: daysAgo(79.5 - n) } });
    }

    // Four for the two, then nine films and nine books, four a pair. A book Open Library doesn't
    // have makes two of its three: its search, then its record's 404.
    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 2, failed: 18, deleted: 0 });
    expect(subrequests).toBe(4 + 9 * (1 + 2));
    const [alien, tyhrolovy] = await userLog(db, userId, now);
    expect(alien?.mediaItem.metadata?.title).toBe("Alien");
    expect(tyhrolovy?.mediaItem.metadata).toEqual({
      title: "Тигролови",
      originalTitle: "Тигролови",
      ukrainianTitle: null,
      year: 1946,
      coverUrls: {
        small: "https://covers.openlibrary.org/b/id/12648826-M.jpg",
        large: "https://covers.openlibrary.org/b/id/12648826-L.jpg",
      },
      authors: ["Іван Багряний"],
    });
  });

  it("refreshes series beside films and books, one subrequest each, within 40", async () => {
    // The three oldest are works the fakes know; the rest, which no fake knows, come a series and
    // then a book, on and on.
    await series("87108", { in: "list", cached: { updated: daysAgo(89) } });
    await film("348", { in: "log", cached: { updated: daysAgo(88.5) } });
    await book("OL2094429W", { in: "log", cached: { updated: daysAgo(88) } });
    for (let n = 1; n <= 20; n++) {
      await series(`404${n}`, { in: "list", cached: { updated: daysAgo(80 - n) } });
      await book(`OL404${n}W`, { in: "list", cached: { updated: daysAgo(79.5 - n) } });
    }

    // Five for the three, then eight series and eight books, four a pair, and one more series: the
    // ninth book doesn't fit. A book Open Library doesn't have makes two of its three.
    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 3, failed: 17, deleted: 0 });
    expect(subrequests).toBe(5 + 9 + 8 * 2);
    const [chernobyl] = await catalogMediaItems(db, env, [1], now);
    expect(chernobyl?.metadata).toMatchObject({
      title: "Chernobyl",
      ukrainianTitle: "Чорнобиль",
      status: "ended",
      seasons: [{ season: 1, episodeCount: 5 }],
      lastAiredEpisode: { season: 1, episode: 5 },
    });
  });

  it("refreshes a running series some User has In Progress daily, so its new episode shows", async () => {
    // Cached when the eighth episode of season 2 had aired; TMDB has the ninth now.
    await series("247718", {
      in: "inProgress",
      status: "returning",
      lastAiredEpisode: { season: 2, episode: 8 },
      cached: { updated: daysAgo(0.9) },
    });
    const lastAired = async (at: Date) => {
      const [mobland] = await catalogMediaItems(db, env, [1], at);
      return mobland?.mediaType === "series" ? mobland.metadata?.lastAiredEpisode : undefined;
    };

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 0, failed: 0, deleted: 0 });
    expect(await lastAired(now)).toEqual({ season: 2, episode: 8 });
    const nextDay = new Date(now.getTime() + 0.2 * day);
    expect(await refreshCache(db, env, nextDay)).toEqual({ refreshed: 1, failed: 0, deleted: 0 });
    expect(await lastAired(nextDay)).toEqual({ season: 2, episode: 9 });
    expect(subrequests).toBe(1);
  });

  it("refreshes running series, films and books in one run within 40, serving each queue", async () => {
    // Running series some User has In Progress, over a day old, which no fake knows but the oldest.
    await series("247718", {
      in: "inProgress",
      status: "returning",
      cached: { updated: daysAgo(3) },
    });
    for (let n = 1; n <= 30; n++) {
      await series(`404${n}`, {
        in: "inProgress",
        status: "returning",
        cached: { updated: daysAgo(2 - n / 100) },
      });
    }
    // Week-old films and books, which no fake knows but the oldest of each.
    await film("348", { in: "log", cached: { updated: daysAgo(60) } });
    await book("OL2094429W", { in: "log", cached: { updated: daysAgo(59) } });
    for (let n = 1; n <= 20; n++) {
      await film(`404${n}`, { in: "list", cached: { updated: daysAgo(50 - n) } });
      await book(`OL404${n}W`, { in: "list", cached: { updated: daysAgo(49.5 - n) } });
    }

    // Twenty series, then four for Alien and Tigrolovy, then four films and four books, four a
    // pair, which spend the 40: the series behind them wait for the next run. A book Open Library
    // doesn't have makes two of its three.
    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 3, failed: 27, deleted: 0 });
    expect(subrequests).toBe(20 + 4 + 4 + 4 * 2);
    expect(await loggedTitles()).toEqual(expect.arrayContaining(["Alien", "Тигролови"]));
  });

  it("refreshes a game past its 21 days with IGDB's details, for one subrequest", async () => {
    await game("1942", { in: "list", cached: { updated: daysAgo(22) } });
    await game("320", { in: "log", cached: { updated: daysAgo(20) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 2, failed: 0, deleted: 0 });
    expect(subrequests).toBe(2);
    const [witcher, stalker] = await catalogMediaItems(db, env, [1, 2], now);
    expect(subrequests).toBe(2);
    expect(witcher?.metadata).toEqual({
      title: "The Witcher 3: Wild Hunt",
      originalTitle: "The Witcher 3: Wild Hunt",
      ukrainianTitle: null,
      year: 2015,
      coverUrls: {
        small: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaarl.jpg",
        large: "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaarl.jpg",
      },
      backdropUrls: {
        small: "https://images.igdb.com/igdb/image/upload/t_720p/ar6ijr.jpg",
        large: "https://images.igdb.com/igdb/image/upload/t_1080p/ar6ijr.jpg",
      },
      developer: "CD Projekt RED",
      platforms: ["Series X|S", "PS4", "Switch 2", "PC", "PS5", "XONE", "Switch"],
      genres: ["Role-playing (RPG)", "Adventure"],
      url: "https://www.igdb.com/games/the-witcher-3-wild-hunt",
    });
    expect(stalker?.metadata).toMatchObject({ developer: "GSC Game World", year: 2007 });
  });

  it("takes a game IGDB answers with no game as gone, and one it fails on as worth trying again", async () => {
    // IGDB has no game 404404, and the fake fails on 999000001 the way IGDB does when it is down.
    await game("404404", { in: "log", cached: { updated: daysAgo(10) } });
    await game("999000001", { in: "log", cached: { updated: daysAgo(9) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 0, failed: 2, deleted: 0 });
    expect(subrequests).toBe(2);
    // What the cron logs of each: only the empty answer counts toward unavailability.
    const failures = vi
      .mocked(console.error)
      .mock.calls.flat()
      .filter((logged) => logged instanceof SourceUnavailable)
      .map(({ message, failure }) => ({ message, failure }));
    expect(failures).toHaveLength(2);
    expect(failures).toEqual(
      expect.arrayContaining([
        { message: "IGDB has no game 404404", failure: "gone" },
        { message: "IGDB /games answered 500", failure: "temporary" },
      ]),
    );
    expect(await loggedTitles()).toEqual(["Game 404404", "Game 999000001"]);
    const nextRun = new Date(now.getTime() + 15 * 60 * 1000);
    expect(await dueForRefresh(db, nextRun)).toEqual([
      expect.objectContaining({ externalId: "404404" }),
      expect.objectContaining({ externalId: "999000001" }),
    ]);
  });

  it("deletes a game's entry past its 21 days that it couldn't refresh", async () => {
    await game("404404", { in: "log", cached: { updated: daysAgo(22) } });
    await game("404405", { in: "log", cached: { updated: daysAgo(20) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 0, failed: 2, deleted: 1 });
    expect(await loggedTitles()).toEqual([null, "Game 404405"]);
  });

  it("asks Twitch for a token once the one it keeps has fewer than 7 days left, and keeps it", async () => {
    await game("1942", { in: "list", cached: { updated: daysAgo(10) } });
    await game("320", { in: "list", cached: { updated: daysAgo(9) } });
    const [before] = await db.select().from(sourceTokens);
    // 44 days on, the token kept has 6 left.
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 44 * day });

    try {
      expect(await refreshCache(db, env, now)).toMatchObject({ refreshed: 2 });
      expect(subrequests).toBe(1 + 2);
      const [kept] = await db.select().from(sourceTokens);
      expect(kept?.accessToken).not.toBe(before?.accessToken);
      expect(kept?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * day);
      await refreshCache(db, env, new Date(now.getTime() + 8 * day));
      expect(subrequests).toBe(1 + 2 + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes at most 10 albums a run, one call at a time and the interval apart, and the film behind them", async () => {
    // The albums are older than the film, so they come first in the queue.
    for (const [index, id] of albumIds.entries()) {
      await album(id, { in: "log", cached: { updated: daysAgo(20 - index) } });
    }
    await film("348", { in: "log", cached: { updated: daysAgo(8) } });
    const refused = musicBrainzFakeCalls.rateLimited();

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 11, failed: 0, deleted: 0 });
    expect(musicBrainzCalls).toHaveLength(10);
    expect(musicBrainzAtOnce).toBe(1);
    for (const [index, call] of musicBrainzCalls.slice(1).entries()) {
      expect(call.start - (musicBrainzCalls[index]?.end ?? 0)).toBeGreaterThanOrEqual(20);
    }
    expect(musicBrainzFakeCalls.rateLimited()).toBe(refused);
    expect(subrequests).toBe(11);
    const titles = await loggedTitles();
    expect(titles).toEqual(expect.arrayContaining(["Земля", "Abbey Road", "1944", "Alien"]));
    expect(titles.filter((title) => title?.startsWith("Album "))).toHaveLength(2);
  });

  // A timer can end before its time by Date.now(), as one did by a millisecond in CI (#286). Here
  // each ends 5 ms early, more than the work between calls hides: the queue still keeps the whole
  // interval, and MusicBrainz's limit refuses no call.
  it("keeps MusicBrainz calls the interval apart when a timer ends early", async () => {
    for (const [index, id] of albumIds.entries()) {
      await album(id, { in: "log", cached: { updated: daysAgo(20 - index) } });
    }
    const refused = musicBrainzFakeCalls.rateLimited();
    const onTime = globalThis.setTimeout;
    vi.stubGlobal("setTimeout", (handler: () => void, ms = 0) =>
      onTime(handler, Math.max(0, ms - 5)),
    );

    try {
      await refreshCache(db, env, now);
    } finally {
      vi.stubGlobal("setTimeout", onTime);
    }

    expect(musicBrainzCalls).toHaveLength(10);
    for (const [index, call] of musicBrainzCalls.slice(1).entries()) {
      expect(call.start - (musicBrainzCalls[index]?.end ?? 0)).toBeGreaterThanOrEqual(20);
    }
    expect(musicBrainzFakeCalls.rateLimited()).toBe(refused);
  });

  it("refreshes at most 10 albums and songs together a run, and the film behind them", async () => {
    // Albums and songs take turns, older than the film, so they come first in the queue.
    for (const [index, id] of songIds.entries()) {
      await album(albumIds[index] ?? "", {
        in: "log",
        cached: { updated: daysAgo(30 - 2 * index) },
      });
      await song(id, { in: "list", cached: { updated: daysAgo(29 - 2 * index) } });
    }
    await film("348", { in: "log", cached: { updated: daysAgo(8) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 11, failed: 0, deleted: 0 });
    expect(musicBrainzCalls).toHaveLength(10);
    expect(musicBrainzAtOnce).toBe(1);
    expect(subrequests).toBe(11);
    const refreshed = await db.select().from(catalogCache);
    const stillPlaceholders = refreshed.filter(
      (entry) =>
        entry.originalTitle.startsWith("Album ") || entry.originalTitle.startsWith("Song "),
    );
    // The newest two albums and two songs wait for the next run.
    expect(stillPlaceholders.map((entry) => entry.mediaType).sort()).toEqual([
      "album",
      "album",
      "song",
      "song",
    ]);
  });

  it("refreshes a song with MusicBrainz's details, its album and cover from its studio Album", async () => {
    await song("d8d55f18-0c4b-4036-a16d-e273ac8953fc", {
      in: "list",
      cached: { updated: daysAgo(8) },
    });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 1, failed: 0, deleted: 0 });
    expect(musicBrainzCalls).toHaveLength(1);
    const [entry] = await db.select().from(catalogCache);
    expect(entry).toMatchObject({
      englishTitle: null,
      ukrainianTitle: null,
      originalTitle: "Обійми",
      year: 2013,
      coverRef: "http://coverartarchive.test/release-group/080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
      extra: {
        artistCredit: "Океан Ельзи",
        artists: [{ name: "Океан Ельзи", mbid: "87a417d3-f118-43e0-bece-3de1bd90fce0" }],
        album: { title: "Земля", mbid: "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8" },
        coverMbid: "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
        disambiguation: null,
        url: "https://musicbrainz.org/recording/d8d55f18-0c4b-4036-a16d-e273ac8953fc",
      },
    });
  });

  it("refreshes a merged song through MusicBrainz's redirect, for two calls, under its own MBID", async () => {
    const merged = "fcde0790-ab0d-4f3f-b984-211b2b330af9";
    await song(merged, { in: "list", cached: { updated: daysAgo(8) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 1, failed: 0, deleted: 0 });
    expect(musicBrainzCalls).toHaveLength(2);
    const [entry] = await db.select().from(catalogCache);
    expect(entry).toMatchObject({
      externalId: merged,
      originalTitle: "Running up That Hill (A Deal With God) (2012 remix)",
      year: 2012,
      extra: {
        album: {
          title:
            "A Symphony of British Music: Music for the Closing Ceremony of the London 2012 Olympic Games",
        },
        url: "https://musicbrainz.org/recording/7a0aecf5-0538-42d6-a468-78e0d3a9dead",
      },
    });
  });

  it("refreshes an album with MusicBrainz's details, keeping what it holds in the cache", async () => {
    await album("67210625-2acc-4689-8b76-a43181af8a10", {
      in: "list",
      cached: { updated: daysAgo(8) },
    });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 1, failed: 0, deleted: 0 });
    const [entry] = await db.select().from(catalogCache);
    expect(entry).toMatchObject({
      englishTitle: null,
      ukrainianTitle: null,
      originalTitle: "The Bedouin Reworks Of Dakhabrakha",
      year: 2022,
      coverRef: "http://coverartarchive.test/release-group/67210625-2acc-4689-8b76-a43181af8a10",
      extra: {
        artistCredit: "Bedouin, DakhaBrakha",
        artists: [
          { name: "Bedouin", mbid: "c9b34ac9-83ab-44f4-8358-348d8ea8d6c2" },
          { name: "DakhaBrakha", mbid: "208334a1-abf0-4791-9705-b45838244b29" },
        ],
        primaryType: "EP",
        secondaryTypes: [],
        url: "https://musicbrainz.org/release-group/67210625-2acc-4689-8b76-a43181af8a10",
      },
    });
  });

  it("refreshes a merged album through MusicBrainz's redirect, for two calls, under its own MBID", async () => {
    const merged = "a51b25f4-2dc1-4787-b779-51abcdb170ff";
    await album(merged, { in: "log", cached: { updated: daysAgo(8) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 1, failed: 0, deleted: 0 });
    expect(musicBrainzCalls).toHaveLength(2);
    const [entry] = await db.select().from(catalogCache);
    expect(entry).toMatchObject({
      externalId: merged,
      originalTitle: "Bye Bye Birdie",
      year: 1963,
      extra: {
        artistCredit: "Charles Strouse",
        secondaryTypes: ["Soundtrack"],
        url: "https://musicbrainz.org/release-group/9cd2811d-a999-326e-8945-a8b6b44b9e92",
      },
    });
  });

  it("takes an album MusicBrainz answers 404 for as gone, and a 503 or a 500 as worth trying again", async () => {
    await album("00000000-0000-4000-8000-000000000404", {
      in: "log",
      cached: { updated: daysAgo(10) },
    });
    await album(musicBrainzFakeFailing.busy, { in: "log", cached: { updated: daysAgo(9) } });
    await album(musicBrainzFakeFailing.serverError, { in: "log", cached: { updated: daysAgo(8) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 0, failed: 3, deleted: 0 });
    // The 503 is asked again once.
    expect(subrequests).toBe(4);
    const failures = vi
      .mocked(console.error)
      .mock.calls.flat()
      .filter((logged) => logged instanceof SourceUnavailable)
      .map(({ message, failure }) => ({ message, failure }));
    expect(failures).toHaveLength(3);
    expect(failures).toEqual(
      expect.arrayContaining([
        {
          message: "MusicBrainz /release-group/00000000-0000-4000-8000-000000000404 answered 404",
          failure: "gone",
        },
        {
          message: `MusicBrainz /release-group/${musicBrainzFakeFailing.busy} answered 503 twice`,
          failure: "temporary",
        },
        {
          message: `MusicBrainz /release-group/${musicBrainzFakeFailing.serverError} answered 500`,
          failure: "temporary",
        },
      ]),
    );
  });

  it("keeps a book's entry it couldn't refresh, however old: only TMDB's entries expire", async () => {
    // Neither fake knows these.
    await book("OL404404W", { in: "log", cached: { updated: daysAgo(400) } });
    await film("404404", { in: "log", cached: { updated: daysAgo(91) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 0, failed: 2, deleted: 1 });
    expect(await loggedTitles()).toEqual(["Book OL404404W", null]);
  });

  it("deletes entries past the 90-day hard expiry that it couldn't refresh", async () => {
    await film("999000001", { in: "log", cached: { updated: daysAgo(91) } });
    await film("404404", { in: "log", cached: { updated: daysAgo(89) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 0, failed: 2, deleted: 1 });
    expect(await loggedTitles()).toEqual([null, "Film 404404"]);
  });

  it("keeps an entry only an In Progress references", async () => {
    await book("404404404", { in: "inProgress", cached: { updated: daysAgo(2) } });

    expect((await refreshCache(db, env, now)).deleted).toBe(0);
  });

  it("deletes entries nothing has referenced for a day", async () => {
    await film("348", { cached: { updated: daysAgo(2) } });
    // Just added from search, and about to be logged or planned.
    await film("679", { cached: { updated: daysAgo(0) } });

    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 0, failed: 0, deleted: 1 });
    await db.insert(logEntries).values([
      { userId, mediaItemId: 1, rating: 8, createdAt: now },
      { userId, mediaItemId: 2, rating: 8, createdAt: now },
    ]);
    expect(await loggedTitles()).toEqual([null, "Film 679"]);
  });
});

// Search results as the client sends them to add their film.
const alienFromSearch = {
  externalReference: { source: "tmdb", mediaType: "film", id: "348" },
  title: "Alien",
  originalTitle: "Alien",
  year: 1979,
  posterUrl: null,
  titleLanguage: "en",
} as const;

const failingFilmFromSearch = {
  ...alienFromSearch,
  externalReference: { ...alienFromSearch.externalReference, id: "999000001" },
  title: "Failing film from search",
  originalTitle: "TMDB Fake Details Failure",
} as const;

describe("a read", () => {
  useSourceFakes();

  it("ignores entries past the 90-day hard expiry, whether or not the cron has run", async () => {
    await film("999000001", { in: "log", cached: { updated: daysAgo(91) } });
    await film("404404", { in: "log", cached: { updated: daysAgo(89) } });

    expect(await loggedTitles()).toEqual([null, "Film 404404"]);
  });

  it("shows an entry with no English Localized Title under its Original Title", async () => {
    await film("404404", { in: "log", cached: { updated: daysAgo(1), english: false } });

    expect(await loggedTitles()).toEqual(["Film 404404"]);
  });

  it("fills a missing entry's backdrop, and keeps it for the next read", async () => {
    await film("348", { in: "log" });

    const [item] = await catalogMediaItems(db, env, [1], now);
    const backdropUrls = filmMetadata(item)?.backdropUrls;
    expect(backdropUrls?.small).toMatch(/\/w780\/\w+\.jpg$/);
    const [logged] = await userLog(db, userId, now);
    expect(filmMetadata(logged?.mediaItem)?.backdropUrls).toEqual(backdropUrls);
  });

  it("refetches an expired entry from TMDB, as for one that is missing", async () => {
    await film("348", { in: "log", cached: { updated: daysAgo(91) } });

    const [item] = await catalogMediaItems(db, env, [1], now);
    expect(item?.metadata?.title).toBe("Alien");
    expect(await loggedTitles()).toEqual(["Alien"]);
    expect(await due()).toEqual([]);
  });

  it("adds a series from search with one subrequest, its details holding its seasons", async () => {
    const added = await addFromSearch(
      db,
      env,
      {
        externalReference: { source: "tmdb", mediaType: "series", id: "1396" },
        title: "Breaking Bad",
        originalTitle: "Breaking Bad",
        year: 2008,
        posterUrl: null,
        titleLanguage: "en",
      },
      now,
    );

    expect(subrequests).toBe(1);
    expect(added.mediaItem.metadata).toMatchObject({
      title: "Breaking Bad",
      seasons: [
        { season: 1, episodeCount: 7 },
        { season: 2, episodeCount: 13 },
        { season: 3, episodeCount: 13 },
        { season: 4, episodeCount: 13 },
        { season: 5, episodeCount: 16 },
      ],
    });
  });

  it("adds a game from search with one subrequest, its details holding its banner and developer", async () => {
    const added = await addFromSearch(
      db,
      env,
      {
        externalReference: { source: "igdb", mediaType: "game", id: "320" },
        title: "S.T.A.L.K.E.R.: Shadow of Chernobyl",
        originalTitle: "S.T.A.L.K.E.R.: Shadow of Chernobyl",
        year: 2007,
        posterUrl: null,
        titleLanguage: "en",
      },
      now,
    );

    expect(subrequests).toBe(1);
    expect(added.mediaItem.metadata).toMatchObject({
      developer: "GSC Game World",
      platforms: ["PS4", "PC", "XONE", "Switch"],
      coverUrls: { small: "https://images.igdb.com/igdb/image/upload/t_cover_big/coa4s4.jpg" },
      backdropUrls: { large: "https://images.igdb.com/igdb/image/upload/t_1080p/ar3uc9.jpg" },
    });
  });

  it("adds an album from search with one subrequest, its details holding its artists and types", async () => {
    const added = await addFromSearch(
      db,
      env,
      {
        externalReference: {
          source: "musicbrainz",
          mediaType: "album",
          id: "eabb68b3-d57c-359a-8215-91f38d365da5",
        },
        title: "The Beatles at the Hollywood Bowl",
        originalTitle: "The Beatles at the Hollywood Bowl",
        year: 1977,
        posterUrl: null,
        titleLanguage: "en",
      },
      now,
    );

    expect(subrequests).toBe(1);
    expect(added.mediaItem.metadata).toEqual({
      title: "The Beatles at the Hollywood Bowl",
      originalTitle: "The Beatles at the Hollywood Bowl",
      ukrainianTitle: null,
      year: 1977,
      coverUrls: {
        small:
          "http://coverartarchive.test/release-group/eabb68b3-d57c-359a-8215-91f38d365da5/front-250",
        large:
          "http://coverartarchive.test/release-group/eabb68b3-d57c-359a-8215-91f38d365da5/front-500",
      },
      artistCredit: "The Beatles",
      artists: ["The Beatles"],
      primaryType: "Album",
      secondaryTypes: ["Live"],
      url: "https://musicbrainz.org/release-group/eabb68b3-d57c-359a-8215-91f38d365da5",
    });
  });

  it("refetches an expired entry when its film is added from search again", async () => {
    await film("348", { cached: { updated: daysAgo(91) } });

    const added = await addFromSearch(db, env, alienFromSearch, now);
    expect(added.mediaItem.metadata?.title).toBe("Alien");
    expect(filmMetadata(added.mediaItem)?.runtime).toBe(117);
    expect(filmMetadata(added.mediaItem)?.backdropUrls).not.toBeNull();
  });

  it("shows the search result in place of an expired entry when TMDB is down", async () => {
    await film("999000001", { in: "log", cached: { updated: daysAgo(91) } });

    const added = await addFromSearch(db, env, failingFilmFromSearch, now);
    expect(added.mediaItem.metadata?.title).toBe("Failing film from search");
    expect(filmMetadata(added.mediaItem)?.backdropUrls).toBeNull();
    expect(await loggedTitles()).toEqual(["Failing film from search"]);
    // Filled from a search result alone, so the cron refreshes it first.
    expect(await due()).toEqual(["999000001"]);
  });

  it("puts an entry refilled from a search result first, though the cron failed on it", async () => {
    // 89 days old when the cron fails on it, expired by the time it is added again.
    await film("999000001", { in: "log", cached: { updated: daysAgo(91) } });
    expect(await refreshCache(db, env, daysAgo(2))).toMatchObject({ failed: 1, deleted: 0 });
    await film("348", { in: "log", cached: { updated: daysAgo(30) } });

    await addFromSearch(db, env, failingFilmFromSearch, now);
    expect(await due()).toEqual(["999000001", "348"]);
  });
});
