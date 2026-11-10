import { LibraryResponse } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { expect, test } from "../support/fixtures";
import { alien, aliens, amelie } from "../support/scenarios/films";
import { createUser } from "../support/scenarios/users";

async function theLibrary(api: ApiClient) {
  const library = api.library.getLibrary({ mediaType: "film" });
  return (await expectBody(library, 200, LibraryResponse)).items;
}

async function plan(api: ApiClient, mediaItemId: number, time = minutesAgo(60)) {
  await expectBody(api.backlog.addBacklogItem({ mediaItemId }, at(time)), 201);
}

async function logFilm(api: ApiClient, mediaItemId: number, rating: number, date: string | null) {
  const { logEntry } = await expectBody(api.log.createLogEntry({ mediaItemId, rating, date }), 201);
  return logEntry;
}

test("a new User's Library is empty", async ({ loggedInApi }) => {
  const library = loggedInApi.library.getLibrary({ mediaType: "film" });

  expect(await expectBody(library, 200, LibraryResponse)).toEqual({ items: [] });
});

test("a film only planned is in the Library with when it was added, and no Log", async ({
  loggedInApi,
}) => {
  const mediaItem = await alien(loggedInApi);

  const addedAt = minutesAgo(30);

  await plan(loggedInApi, mediaItem.id, addedAt);

  const library = await expectBody(
    loggedInApi.library.getLibrary({ mediaType: "film" }),
    200,
    LibraryResponse,
  );
  expect(library.items).toEqual([{ mediaItem, backlog: { addedAt }, log: null }]);
});

test("a film only logged is in the Library with its Current Rating and last Log Entry", async ({
  loggedInApi,
}) => {
  const mediaItem = await alien(loggedInApi);

  const logEntry = await logFilm(loggedInApi, mediaItem.id, 4, "2026-10-01");

  expect(await theLibrary(loggedInApi)).toEqual([
    {
      mediaItem,
      backlog: null,
      log: {
        currentRating: 4,
        lastLogEntry: { date: "2026-10-01", createdAt: logEntry.createdAt },
      },
    },
  ]);
});

test("a film logged and planned again for a rewatch is in the Library once, with both", async ({
  loggedInApi,
}) => {
  const mediaItem = await alien(loggedInApi);
  const logEntry = await logFilm(loggedInApi, mediaItem.id, 3.5, null);

  const addedAt = minutesAgo(5);

  await plan(loggedInApi, mediaItem.id, addedAt);

  expect(await theLibrary(loggedInApi)).toEqual([
    {
      mediaItem,
      backlog: { addedAt },
      log: { currentRating: 3.5, lastLogEntry: { date: null, createdAt: logEntry.createdAt } },
    },
  ]);
});

test("a film logged twice is in the Library once, with the last entry in Log Order", async ({
  loggedInApi,
}) => {
  const mediaItem = await alien(loggedInApi);
  const latest = await logFilm(loggedInApi, mediaItem.id, 5, "2026-10-10");

  // Logged later but backdated: it comes earlier in Log Order, so it sets neither the Current
  // Rating nor the last date.
  await logFilm(loggedInApi, mediaItem.id, 2, "2026-09-01");

  expect(await theLibrary(loggedInApi)).toEqual([
    {
      mediaItem,
      backlog: null,
      log: { currentRating: 5, lastLogEntry: { date: "2026-10-10", createdAt: latest.createdAt } },
    },
  ]);
});

test("the Library holds every planned and every logged film, each once", async ({
  loggedInApi,
}) => {
  const planned = await alien(loggedInApi);
  const logged = await aliens(loggedInApi);
  const both = await amelie(loggedInApi);
  await plan(loggedInApi, planned.id);
  await logFilm(loggedInApi, logged.id, 4, null);
  await logFilm(loggedInApi, both.id, 4.5, null);
  await logFilm(loggedInApi, both.id, 5, null);
  await plan(loggedInApi, both.id);

  const items = await theLibrary(loggedInApi);

  const summary = items.map((item) => ({
    id: item.mediaItem.id,
    planned: item.backlog !== null,
    rating: item.log?.currentRating ?? null,
  }));
  expect(summary.toSorted((a, b) => a.id - b.id)).toEqual(
    [
      { id: planned.id, planned: true, rating: null },
      { id: logged.id, planned: false, rating: 4 },
      { id: both.id, planned: true, rating: 5 },
    ].toSorted((a, b) => a.id - b.id),
  );
});

test("a film taken off the Backlog and with no Log Entries leaves the Library", async ({
  loggedInApi,
}) => {
  const planned = await alien(loggedInApi);
  const logged = await aliens(loggedInApi);
  await plan(loggedInApi, planned.id);
  const logEntry = await logFilm(loggedInApi, logged.id, 4, null);

  expect((await loggedInApi.backlog.deleteBacklogItem(planned.id)).status()).toBe(204);
  expect((await loggedInApi.log.deleteLogEntry(logEntry.id)).status()).toBe(204);

  expect(await theLibrary(loggedInApi)).toEqual([]);
});

test("another User's Backlog and Log never appear in the Library", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const mine = await alien(loggedInApi);
  const theirs = await aliens(otherUserClient);
  await plan(loggedInApi, mine.id);
  await plan(otherUserClient, theirs.id);
  await logFilm(otherUserClient, theirs.id, 2, null);
  // The same film in both Libraries: each User sees only their own marks on it.
  await logFilm(otherUserClient, mine.id, 1, null);

  expect(await theLibrary(loggedInApi)).toEqual([
    { mediaItem: mine, backlog: { addedAt: expect.any(String) }, log: null },
  ]);
});

test("a List Item outside the Backlog doesn't put a film in the Library", async ({
  loggedInApi,
}) => {
  const mediaItem = await alien(loggedInApi);
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Horror", mediaType: "film" }),
    201,
  );

  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: mediaItem.id }), 201);

  expect(await theLibrary(loggedInApi)).toEqual([]);
});

test("the Library of an unknown Media Type is a 400", async ({ loggedInApi }) => {
  const refused = loggedInApi.library.getLibrary({ mediaType: "series" as never });

  expect(await expectBody(refused, 400)).toEqual({ error: "invalid_request" });
});

test("without a session, the Library is a 401", async ({ api }) => {
  expect((await api.library.getLibrary({ mediaType: "film" })).status()).toBe(401);
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("the Library loads in the same number of queries for 1 film as for 1,000", async ({
  api,
  createApiClient,
}) => {
  const queriesForLibraryOf = async (client: ApiClient, films: number) => {
    const user = await createUser();
    await expectBody(client.auth.login(user));
    expect((await client.testHooks.fillBacklog(user.username, films)).status()).toBe(204);
    await logFilm(client, (await alien(client)).id, 4, null);
    const response = await client.library.getLibrary({ mediaType: "film" });
    expect(await response.json()).toMatchObject({ items: { length: films + 1 } });
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForLibraryOf(api, 1);
  const thousand = await queriesForLibraryOf(await createApiClient(), 1000);

  expect(one).toMatch(/^\d+$/);
  expect(thousand).toBe(one);
});
