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
  users,
} from "../../db/schema";
import type { ExternalReference, FilmMetadata, MediaItem } from "../../shared/api";
import { userLog } from "../log/log-entries";
import { openTestDatabase, type TestDatabase } from "../test-database";
import { dueForRefresh, refreshCache } from "./cache-refresh";
import { addFromSearch, catalogMediaItems } from "./media-items";
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
let listIds: { film: number; book: number };

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
  const [films, books] = await db
    .insert(lists)
    .values([
      { userId, kind: "list", mediaType: "film", name: "F", nameKey: "f", createdAt: now },
      { userId, kind: "list", mediaType: "book", name: "B", nameKey: "b", createdAt: now },
    ])
    .returning();
  if (!films || !books) throw new Error("no lists");
  listIds = { film: films.id, book: books.id };
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
    // As if films cost two subrequests an entry, as books do.
    const twoEach = () => 2;

    const batch = (await dueForRefresh(db, now, undefined, twoEach)).map((key) => key.externalId);
    expect(batch).toEqual(Array.from({ length: 20 }, (_, index) => String(45 - index)));
    const odd = await dueForRefresh(db, now, 5, twoEach);
    expect(odd.map((key) => key.externalId)).toEqual(["45", "44"]);
  });

  it("counts a film as one subrequest and a book as two, and never spends more than 40", async () => {
    // From the oldest: a book, a film, a book, a film and so on, three subrequests a pair.
    for (let n = 1; n <= 20; n++) {
      await book(`OL${n}W`, { in: "log", cached: { updated: daysAgo(100 - 2 * n) } });
      await film(String(n), { in: "log", cached: { updated: daysAgo(99 - 2 * n) } });
    }

    const batch = await dueForRefresh(db, now);
    // Thirteen pairs cost 39, and the next book doesn't fit: the film after it doesn't jump it.
    expect(batch.map((key) => key.externalId)).toEqual(
      Array.from({ length: 13 }, (_, index) => [`OL${index + 1}W`, String(index + 1)]).flat(),
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

  it("leaves out referenced films with no cache entry: a page fills those", async () => {
    await film("1", { in: "log" });
    await film("2", { in: "log", cached: { updated: daysAgo(10) } });

    expect(await due()).toEqual(["2"]);
  });
});

// The sources' configuration: each is the fake the `local` Worker searches, reached through fetch.
const env = {
  TMDB_BASE_URL: "http://tmdb.test/3",
  TMDB_ACCESS_TOKEN: "fake-tmdb-token",
  OPEN_LIBRARY_BASE_URL: "http://openlibrary.test",
  OPEN_LIBRARY_CONTACT: "operator@tastetrack.invalid",
};

// The metadata titles the User's Log shows, in Log Order.
async function loggedTitles(): Promise<(string | null)[]> {
  return (await userLog(db, userId, now)).map((entry) => entry.mediaItem.metadata?.title ?? null);
}

// How many subrequests the test has made to the sources.
let subrequests = 0;

// Points fetch at the sources' fakes for each test in the enclosing describe, and counts the calls.
function useSourceFakes(): void {
  beforeEach(() => {
    subrequests = 0;
    // Each failed details call is logged; the tests say which fail.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      subrequests += 1;
      const url = input instanceof Request ? input.url : String(input);
      const fake = url.startsWith(env.OPEN_LIBRARY_BASE_URL) ? openLibraryFake : tmdbFake;
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

    // Three for the two, then thirteen films and twelve books: the thirteenth book doesn't fit.
    expect(await refreshCache(db, env, now)).toEqual({ refreshed: 2, failed: 25, deleted: 0 });
    expect(subrequests).toBe(40);
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

  it("keeps a book's entry it couldn't refresh, however old: only a film's expires", async () => {
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
