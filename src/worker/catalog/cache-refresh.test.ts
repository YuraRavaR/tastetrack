import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listItems, lists, logEntries, mediaItems, tmdbCache, users } from "../../db/schema";
import { userLog } from "../log/log-entries";
import { openTestDatabase, type TestDatabase } from "../test-database";
import { dueForRefresh, refreshCache } from "./cache-refresh";
import { addFromSearch, catalogMediaItems } from "./media-items";
import { tmdbFake } from "./tmdb-fake";

const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-20T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * day);
}

let database: TestDatabase;
let db: DrizzleD1Database;
let userId: number;
let listId: number;

beforeAll(async () => {
  database = await openTestDatabase();
  db = database.db;
}, 30_000);

afterAll(() => database.dispose());

beforeEach(async () => {
  await db.batch([
    db.delete(tmdbCache),
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
  const [list] = await db
    .insert(lists)
    .values({ userId, kind: "list", mediaType: "film", name: "L", nameKey: "l", createdAt: now })
    .returning();
  if (!list) throw new Error("no list");
  listId = list.id;
});

interface Film {
  // Where the film is referenced from, if anywhere.
  in?: "log" | "list";
  // Its cache entry: when it was last filled, whether by a details call, and whether it has an
  // English Localized Title and a backdrop path. None when omitted.
  cached?: { updated: Date; detailed?: boolean; english?: boolean; backdrop?: string };
}

// Adds a catalog-backed film with TMDB id `id`.
async function film(id: string, { in: where, cached }: Film = {}): Promise<void> {
  const [item] = await db
    .insert(mediaItems)
    .values({ mediaType: "film", externalSource: "tmdb", externalId: id, createdAt: now })
    .returning();
  if (!item) throw new Error("no media item");
  if (where === "log") {
    await db.insert(logEntries).values({ userId, mediaItemId: item.id, rating: 8, createdAt: now });
  }
  if (where === "list") {
    await db
      .insert(listItems)
      .values({ listId, mediaItemId: item.id, position: item.id, createdAt: now });
  }
  if (cached) {
    await db.insert(tmdbCache).values({
      mediaType: "film",
      externalId: id,
      englishTitle: cached.english === false ? null : `Film ${id}`,
      originalTitle: `Film ${id}`,
      backdropPath: cached.backdrop,
      updatedAt: cached.updated,
      detailedAt: cached.detailed === false ? null : cached.updated,
    });
  }
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

// TMDB is the fake the `local` Worker searches, reached through fetch.
const tmdb = { baseUrl: "http://tmdb.test/3", accessToken: "fake-tmdb-token" };

// The metadata titles the User's Log shows, in Log Order.
async function loggedTitles(): Promise<(string | null)[]> {
  return (await userLog(db, userId, now)).map((entry) => entry.mediaItem.metadata?.title ?? null);
}

// Points fetch at the TMDB fake for each test in the enclosing describe.
function useTmdbFake(): void {
  beforeEach(() => {
    // Each failed details call is logged; the tests say which fail.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      tmdbFake.request(input instanceof Request ? input.url : String(input), init),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

describe("a cron run", () => {
  useTmdbFake();

  it("refreshes the entries due with TMDB's details", async () => {
    await film("348", { in: "log", cached: { updated: daysAgo(30) } });
    await film("679", { in: "log", cached: { updated: daysAgo(2) } });

    expect(await refreshCache(db, tmdb, now)).toEqual({ refreshed: 1, failed: 0, deleted: 0 });
    expect(await loggedTitles()).toEqual(["Alien", "Film 679"]);
    expect((await userLog(db, userId, now))[0]?.mediaItem.metadata).toEqual({
      title: "Alien",
      originalTitle: "Alien",
      ukrainianTitle: "Чужий",
      year: 1979,
      posterUrl: "https://image.tmdb.org/t/p/w92/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg",
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

    await refreshCache(db, tmdb, now);
    expect((await userLog(db, userId, now))[0]?.mediaItem.metadata?.backdropUrls).toBeNull();
  });

  it("keeps an entry TMDB doesn't answer for, to try again next run", async () => {
    // The fake fails the details call for this one, the way TMDB does when it is down.
    await film("999000001", { in: "log", cached: { updated: daysAgo(30) } });

    expect(await refreshCache(db, tmdb, now)).toEqual({ refreshed: 0, failed: 1, deleted: 0 });
    expect(await loggedTitles()).toEqual(["Film 999000001"]);
    expect(await due()).toEqual(["999000001"]);
  });

  it("gets past a full batch of entries TMDB never answers for", async () => {
    // Films the fake doesn't know, so their details call is a 404 every time.
    for (let id = 1; id <= 40; id++) {
      await film(`404${id}`, { in: "log", cached: { updated: daysAgo(60) } });
    }
    await film("348", { in: "log", cached: { updated: daysAgo(30) } });

    expect(await refreshCache(db, tmdb, now)).toEqual({ refreshed: 0, failed: 40, deleted: 0 });
    const nextRun = new Date(now.getTime() + 15 * 60 * 1000);
    expect(await refreshCache(db, tmdb, nextRun)).toEqual({
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

    expect(await refreshCache(db, tmdb, now)).toEqual({ refreshed: 0, failed: 40, deleted: 0 });
    const nextRun = new Date(now.getTime() + 15 * 60 * 1000);
    expect((await refreshCache(db, tmdb, nextRun)).refreshed).toBe(1);
    expect((await loggedTitles()).filter((title) => title === "Alien")).toHaveLength(1);
  });

  it("deletes entries past the 90-day hard expiry that it couldn't refresh", async () => {
    await film("999000001", { in: "log", cached: { updated: daysAgo(91) } });
    await film("404404", { in: "log", cached: { updated: daysAgo(89) } });

    expect(await refreshCache(db, tmdb, now)).toEqual({ refreshed: 0, failed: 2, deleted: 1 });
    expect(await loggedTitles()).toEqual([null, "Film 404404"]);
  });

  it("deletes entries nothing has referenced for a day", async () => {
    await film("348", { cached: { updated: daysAgo(2) } });
    // Just added from search, and about to be logged or planned.
    await film("679", { cached: { updated: daysAgo(0) } });

    expect(await refreshCache(db, tmdb, now)).toEqual({ refreshed: 0, failed: 0, deleted: 1 });
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
  useTmdbFake();

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

    const [item] = await catalogMediaItems(db, tmdb, [1], now);
    expect(item?.metadata?.backdropUrls?.small).toMatch(/\/w780\/\w+\.jpg$/);
    const [logged] = await userLog(db, userId, now);
    expect(logged?.mediaItem.metadata?.backdropUrls).toEqual(item?.metadata?.backdropUrls);
  });

  it("refetches an expired entry from TMDB, as for one that is missing", async () => {
    await film("348", { in: "log", cached: { updated: daysAgo(91) } });

    const [item] = await catalogMediaItems(db, tmdb, [1], now);
    expect(item?.metadata?.title).toBe("Alien");
    expect(await loggedTitles()).toEqual(["Alien"]);
    expect(await due()).toEqual([]);
  });

  it("refetches an expired entry when its film is added from search again", async () => {
    await film("348", { cached: { updated: daysAgo(91) } });

    const added = await addFromSearch(db, tmdb, alienFromSearch, now);
    expect(added.mediaItem.metadata?.title).toBe("Alien");
    expect(added.mediaItem.metadata?.runtime).toBe(117);
    expect(added.mediaItem.metadata?.backdropUrls).not.toBeNull();
  });

  it("shows the search result in place of an expired entry when TMDB is down", async () => {
    await film("999000001", { in: "log", cached: { updated: daysAgo(91) } });

    const added = await addFromSearch(db, tmdb, failingFilmFromSearch, now);
    expect(added.mediaItem.metadata?.title).toBe("Failing film from search");
    expect(added.mediaItem.metadata?.backdropUrls).toBeNull();
    expect(await loggedTitles()).toEqual(["Failing film from search"]);
    // Filled from a search result alone, so the cron refreshes it first.
    expect(await due()).toEqual(["999000001"]);
  });

  it("puts an entry refilled from a search result first, though the cron failed on it", async () => {
    // 89 days old when the cron fails on it, expired by the time it is added again.
    await film("999000001", { in: "log", cached: { updated: daysAgo(91) } });
    expect(await refreshCache(db, tmdb, daysAgo(2))).toMatchObject({ failed: 1, deleted: 0 });
    await film("348", { in: "log", cached: { updated: daysAgo(30) } });

    await addFromSearch(db, tmdb, failingFilmFromSearch, now);
    expect(await due()).toEqual(["999000001", "348"]);
  });
});
