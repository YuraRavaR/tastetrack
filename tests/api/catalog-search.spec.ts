import { type APIRequestContext, expect, test } from "@playwright/test";
import { alien, amelie, newFilm, searchResult } from "../support/films";
import { createList } from "../support/lists";
import { callsRealTmdb } from "../support/tmdb";
import { logInNewUser } from "../support/users";

// Locally the Worker searches a TMDB fake with fixed data; on staging, the real TMDB. So these
// tests look only for well-known films, and check that they are among the results.

// Adds a Log Entry for a Media Item.
async function logEntry(request: APIRequestContext, data: object) {
  const response = await request.post("/api/log-entries", { data });
  expect(response.status(), await response.text()).toBe(201);
}

async function addToList(request: APIRequestContext, listId: number, mediaItemId: number) {
  const response = await request.post(`/api/lists/${listId}/items`, { data: { mediaItemId } });
  expect(response.status(), await response.text()).toBe(201);
}

async function search(request: APIRequestContext, query: string) {
  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).results;
}

test("an English query finds the film with its title, Original Title, year and poster", async ({
  request,
}) => {
  await logInNewUser(request);

  const results = await search(request, "alien");

  expect(results).toContainEqual(
    expect.objectContaining({
      externalReference: { source: "tmdb", mediaType: "film", id: "348" },
      title: "Alien",
      originalTitle: "Alien",
      year: 1979,
      posterUrl: expect.stringMatching(/^https:\/\/image\.tmdb\.org\/t\/p\/w92\/\w+\.jpg$/),
      titleLanguage: "en",
      inLog: false,
      inBacklog: false,
      currentRating: null,
      logEntryCount: 0,
      lists: [],
    }),
  );
});

test("a result carries the Current Rating and how many Log Entries the User has", async ({
  request,
}) => {
  await logInNewUser(request);
  const { id: mediaItemId } = await alien(request);

  await logEntry(request, { mediaItemId, rating: 4.5, date: "2026-03-02" });
  // Backdated, so it doesn't override the later opinion.
  await logEntry(request, { mediaItemId, rating: 2, date: "2026-03-01" });

  expect(await searchResult(request, "alien", "348")).toMatchObject({
    inLog: true,
    currentRating: 4.5,
    logEntryCount: 2,
  });
  expect((await searchResult(request, "чужий", "348")).inLog).toBe(true);
  expect((await searchResult(request, "aliens", "679")).inLog).toBe(false);
});

test("a result shows the User's own Lists holding the film, oldest first, and not the Backlog", async ({
  request,
}) => {
  await logInNewUser(request);
  const { id: mediaItemId } = await alien(request);
  const older = await createList(request, { name: "Older" });
  const newer = await createList(request, { name: "Newer" });
  await createList(request, { name: "Without it" });

  await addToList(request, newer.id, mediaItemId);
  await addToList(request, older.id, mediaItemId);
  await request.post("/api/backlog/items", { data: { mediaItemId } });

  const result = await searchResult(request, "alien", "348");
  expect(result.lists).toEqual([
    { id: older.id, name: "Older" },
    { id: newer.id, name: "Newer" },
  ]);
  expect(result.inBacklog).toBe(true);
});

test("another User's Log Entries and Lists never show on a result", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const { id: mediaItemId } = await alien(request);
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  await logEntry(other, { mediaItemId, rating: 1 });
  await addToList(other, (await createList(other, { name: "Theirs" })).id, mediaItemId);
  await other.dispose();

  expect(await searchResult(request, "alien", "348")).toMatchObject({
    inLog: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  });
});

test("a User's Manual Media Item carries its Current Rating, Log Entries and Lists too", async ({
  request,
}) => {
  await logInNewUser(request);
  const title = `Manual ${Math.floor(Math.random() * 1e12)}`;
  const added = await request.post("/api/catalog/manual-items", {
    data: { mediaType: "film", title },
  });
  expect(added.status(), await added.text()).toBe(201);
  const { mediaItem } = await added.json();
  const list = await createList(request, { name: "Hand-made" });

  await logEntry(request, { mediaItemId: mediaItem.id, rating: 3 });
  await addToList(request, list.id, mediaItem.id);

  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query: title },
  });
  expect((await response.json()).manualResults).toEqual([
    {
      mediaItem,
      inLog: true,
      inBacklog: false,
      currentRating: 3,
      logEntryCount: 1,
      lists: [{ id: list.id, name: "Hand-made" }],
    },
  ]);
});

test("a result names its Media Item once the film is in the catalog; until then it has none, and no Current Rating, Log Entries or Lists", async ({
  request,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  await logInNewUser(request);
  const { id, query } = newFilm();

  const before = await searchResult(request, query, id);
  expect(before).toMatchObject({
    mediaItemId: null,
    inLog: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  });

  const added = await request.post("/api/catalog/items", { data: before });
  expect(added.status(), await added.text()).toBe(201);
  const { mediaItem } = await added.json();

  expect((await searchResult(request, query, id)).mediaItemId).toBe(mediaItem.id);
});

// ADR-0009: a search takes a fixed number of D1 queries, however many results it brings and
// however many Lists hold them.
test("a search with 1 result and one with many take the same number of queries", async ({
  request,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a query with exactly 1 result");
  await logInNewUser(request);
  const [film] = await Promise.all([alien(request), amelie(request)]);
  await logEntry(request, { mediaItemId: film.id, rating: 4 });
  await logEntry(request, { mediaItemId: film.id, rating: 5 });
  for (const name of ["One", "Two", "Three", "Four"]) {
    await addToList(request, (await createList(request, { name })).id, film.id);
  }
  const queriesFor = async (query: string) => {
    const response = await request.get("/api/catalog/search", {
      params: { mediaType: "film", query },
    });
    const { results } = await response.json();
    return { results, queries: response.headers()["x-d1-query-count"] };
  };

  const one = await queriesFor("amelie");
  const many = await queriesFor("a");
  const notInCatalog = await queriesFor(newFilm().query);

  expect(one.results).toHaveLength(1);
  expect(many.results.length).toBeGreaterThan(1);
  expect(many.results.some(({ lists }: { lists: unknown[] }) => lists.length === 4)).toBe(true);
  expect(notInCatalog.results).toHaveLength(1);
  expect(one.queries).toMatch(/^\d+$/);
  expect(many.queries).toBe(one.queries);
  expect(notInCatalog.queries).toBe(one.queries);
});

test("a Ukrainian query is answered in Ukrainian, with the Original Title alongside", async ({
  request,
}) => {
  await logInNewUser(request);

  const results = await search(request, "чужий");

  expect(results).toContainEqual(
    expect.objectContaining({
      title: "Чужий",
      originalTitle: "Alien",
      year: 1979,
      titleLanguage: "uk",
    }),
  );
  expect(results).not.toContainEqual(expect.objectContaining({ title: "Alien" }));
});

test("searching by the Original Title finds the film, titled in English", async ({ request }) => {
  await logInNewUser(request);

  const results = await search(request, "Le Fabuleux Destin d'Amélie Poulain");

  expect(results).toContainEqual(
    expect.objectContaining({
      title: "Amélie",
      originalTitle: "Le Fabuleux Destin d'Amélie Poulain",
      year: 2001,
    }),
  );
});

test("an empty or overlong query, or an unknown Media Type, is a 400", async ({ request }) => {
  await logInNewUser(request);

  for (const params of <Record<string, string>[]>[
    { mediaType: "film", query: "   " },
    { mediaType: "film", query: "a".repeat(101) },
    { mediaType: "book", query: "alien" },
    { mediaType: "film" },
  ]) {
    const response = await request.get("/api/catalog/search", { params });
    expect(response.status(), JSON.stringify(params)).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
});

test("without a session, searching is a 401", async ({ request }) => {
  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query: "alien" },
  });

  expect(response.status()).toBe(401);
});

test("when TMDB fails, searching is a 502", async ({ request }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake can be made to fail");
  await logInNewUser(request);

  // The fake answers this query with a 503.
  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query: "tmdb fake failure" },
  });

  expect(response.status()).toBe(502);
  expect(await response.json()).toEqual({ error: "catalog_unavailable" });
});
