import { expectBody } from "../support/api/responses";
import { alien, amelie, newFilm, searchResult } from "../support/films";
import { expect, test } from "../support/fixtures";
import { callsRealTmdb } from "../support/tmdb";

// Locally the Worker searches a TMDB fake with fixed data; on staging, the real TMDB. So these
// tests look only for well-known films, and check that they are among the results.

test("an English query finds the film with its title, Original Title, year and poster", async ({
  loggedInApi,
}) => {
  const { results } = await expectBody(
    loggedInApi.catalog.searchCatalog({ mediaType: "film", query: "alien" }),
  );

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
  loggedInApi,
}) => {
  const { id: mediaItemId } = await alien(loggedInApi);

  await expectBody(
    loggedInApi.log.createLogEntry({ mediaItemId, rating: 4.5, date: "2026-03-02" }),
    201,
  );
  // Backdated, so it doesn't override the later opinion.
  await expectBody(
    loggedInApi.log.createLogEntry({ mediaItemId, rating: 2, date: "2026-03-01" }),
    201,
  );

  expect(await searchResult(loggedInApi, "alien", "348")).toMatchObject({
    inLog: true,
    currentRating: 4.5,
    logEntryCount: 2,
  });
  expect((await searchResult(loggedInApi, "чужий", "348")).inLog).toBe(true);
  expect((await searchResult(loggedInApi, "aliens", "679")).inLog).toBe(false);
});

test("a result shows the User's own Lists holding the film, oldest first, and not the Backlog", async ({
  loggedInApi,
}) => {
  const { id: mediaItemId } = await alien(loggedInApi);
  const { list: older } = await expectBody(
    loggedInApi.lists.createList({ name: "Older", mediaType: "film" }),
    201,
  );
  const { list: newer } = await expectBody(
    loggedInApi.lists.createList({ name: "Newer", mediaType: "film" }),
    201,
  );
  await expectBody(loggedInApi.lists.createList({ name: "Without it", mediaType: "film" }), 201);

  await expectBody(loggedInApi.lists.addListItem(newer.id, { mediaItemId }), 201);
  await expectBody(loggedInApi.lists.addListItem(older.id, { mediaItemId }), 201);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId }), 201);

  const result = await searchResult(loggedInApi, "alien", "348");
  expect(result.lists).toEqual([
    { id: older.id, name: "Older" },
    { id: newer.id, name: "Newer" },
  ]);
  expect(result.inBacklog).toBe(true);
});

test("another User's Log Entries and Lists never show on a result", async ({
  loggedInApi,
  otherUser,
}) => {
  const { id: mediaItemId } = await alien(loggedInApi);
  await expectBody(otherUser.log.createLogEntry({ mediaItemId, rating: 1 }), 201);
  const { list } = await expectBody(
    otherUser.lists.createList({ name: "Theirs", mediaType: "film" }),
    201,
  );
  await expectBody(otherUser.lists.addListItem(list.id, { mediaItemId }), 201);

  expect(await searchResult(loggedInApi, "alien", "348")).toMatchObject({
    inLog: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  });
});

test("a User's Manual Media Item carries its Current Rating, Log Entries and Lists too", async ({
  loggedInApi,
}) => {
  const title = `Manual ${Math.floor(Math.random() * 1e12)}`;
  const { mediaItem } = await expectBody(
    loggedInApi.catalog.addManualMediaItem({ mediaType: "film", title }),
    201,
  );
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Hand-made", mediaType: "film" }),
    201,
  );

  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: mediaItem.id, rating: 3 }), 201);
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: mediaItem.id }), 201);

  const { manualResults } = await expectBody(
    loggedInApi.catalog.searchCatalog({ mediaType: "film", query: title }),
  );
  expect(manualResults).toEqual([
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
  loggedInApi,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  const { id, query } = newFilm();

  const before = await searchResult(loggedInApi, query, id);
  expect(before).toMatchObject({
    mediaItemId: null,
    inLog: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  });

  const { mediaItem } = await expectBody(loggedInApi.catalog.addCatalogItem(before), 201);

  expect((await searchResult(loggedInApi, query, id)).mediaItemId).toBe(mediaItem.id);
});

// ADR-0009: a search takes a fixed number of D1 queries, however many results it brings and
// however many Lists hold them.
test("a search with 1 result and one with many take the same number of queries", async ({
  loggedInApi,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a query with exactly 1 result");
  const [film] = await Promise.all([alien(loggedInApi), amelie(loggedInApi)]);
  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: film.id, rating: 4 }), 201);
  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: film.id, rating: 5 }), 201);
  for (const name of ["One", "Two", "Three", "Four"]) {
    const { list } = await expectBody(
      loggedInApi.lists.createList({ name, mediaType: "film" }),
      201,
    );
    await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: film.id }), 201);
  }
  const queriesFor = async (query: string) => {
    const response = await loggedInApi.catalog.searchCatalog({ mediaType: "film", query });
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
  loggedInApi,
}) => {
  const { results } = await expectBody(
    loggedInApi.catalog.searchCatalog({ mediaType: "film", query: "чужий" }),
  );

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

test("searching by the Original Title finds the film, titled in English", async ({
  loggedInApi,
}) => {
  const { results } = await expectBody(
    loggedInApi.catalog.searchCatalog({
      mediaType: "film",
      query: "Le Fabuleux Destin d'Amélie Poulain",
    }),
  );

  expect(results).toContainEqual(
    expect.objectContaining({
      title: "Amélie",
      originalTitle: "Le Fabuleux Destin d'Amélie Poulain",
      year: 2001,
    }),
  );
});

test("an empty or overlong query, or an unknown Media Type, is a 400", async ({ loggedInApi }) => {
  for (const params of [
    { mediaType: "film", query: "   " },
    { mediaType: "film", query: "a".repeat(101) },
    { mediaType: "book", query: "alien" },
    { mediaType: "film" },
  ]) {
    const response = await loggedInApi.catalog.searchCatalog(params as never);
    expect(response.status(), JSON.stringify(params)).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
});

test("without a session, searching is a 401", async ({ api }) => {
  const response = await api.catalog.searchCatalog({ mediaType: "film", query: "alien" });

  expect(response.status()).toBe(401);
});

test("when TMDB fails, searching is a 502", async ({ loggedInApi }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake can be made to fail");

  // The fake answers this query with a 503.
  const failed = await expectBody(
    loggedInApi.catalog.searchCatalog({ mediaType: "film", query: "tmdb fake failure" }),
    502,
  );

  expect(failed).toEqual({ error: "catalog_unavailable" });
});
