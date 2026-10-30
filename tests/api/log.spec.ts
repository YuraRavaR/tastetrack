import { type APIRequestContext, expect, test } from "@playwright/test";
import { callsRealTmdb } from "../support/tmdb";
import { logInNewUser } from "../support/users";

// Locally the Worker calls a TMDB fake with fixed data; on staging, the real TMDB. So these tests
// use only well-known films, and check only what both answer alike.

async function searchResult(request: APIRequestContext, query: string, id: string) {
  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query },
  });
  expect(response.status()).toBe(200);
  const { results } = await response.json();
  const result = results.find((r: { externalReference: { id: string } }) => {
    return r.externalReference.id === id;
  });
  expect(result, `TMDB film ${id} among the results for "${query}"`).toBeDefined();
  return result;
}

// Marks a search result Experienced: its Media Item, created or reused.
async function add(request: APIRequestContext, result: unknown) {
  const response = await request.post("/api/catalog/items", { data: result });
  expect([200, 201]).toContain(response.status());
  return (await response.json()).mediaItem;
}

const alien = { source: "tmdb", mediaType: "film", id: "348" };

test("adding a search result makes a Media Item with both titles, runtime and genres", async ({
  request,
}) => {
  await logInNewUser(request);
  const result = await searchResult(request, "alien", "348");

  const response = await request.post("/api/catalog/items", { data: result });

  expect([200, 201]).toContain(response.status());
  const { mediaItem } = await response.json();
  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "film",
    externalReference: alien,
    metadata: {
      title: "Alien",
      originalTitle: "Alien",
      ukrainianTitle: "Чужий",
      year: 1979,
      posterUrl: expect.stringMatching(/^https:\/\/image\.tmdb\.org\/t\/p\/w92\/\w+\.jpg$/),
      backdropUrls: {
        small: expect.stringMatching(/^https:\/\/image\.tmdb\.org\/t\/p\/w780\/\w+\.jpg$/),
        large: expect.stringMatching(/^https:\/\/image\.tmdb\.org\/t\/p\/w1280\/\w+\.jpg$/),
      },
      runtime: 117,
      genres: expect.arrayContaining(["Horror", "Science Fiction"]),
    },
  });
});

test("a film TMDB has no backdrop for has none, whatever its poster", async ({ request }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film without a backdrop");
  await logInNewUser(request);
  const result = await searchResult(request, "aliens", "679");

  const response = await request.post("/api/catalog/items", { data: result });

  const { metadata } = (await response.json()).mediaItem;
  expect(metadata.posterUrl).not.toBeNull();
  expect(metadata.backdropUrls).toBeNull();
});

test("adding the same film again, from any search and by any User, reuses its Media Item", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const first = await add(request, await searchResult(request, "alien", "348"));
  const fromUkrainian = await add(request, await searchResult(request, "чужий", "348"));
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  const byOtherUser = await add(other, await searchResult(other, "alien", "348"));
  await other.dispose();

  expect(fromUkrainian.id).toBe(first.id);
  expect(byOtherUser.id).toBe(first.id);
  // Titled in English first, whichever language the search ran in.
  expect(fromUkrainian.metadata).toMatchObject({ title: "Alien", ukrainianTitle: "Чужий" });
});

test("when the details call fails, adding still succeeds, from the search result", async ({
  request,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake can be made to fail");
  await logInNewUser(request);
  // The fake fails the details call for this film.
  const result = await searchResult(request, "tmdb fake details failure", "999000001");

  const response = await request.post("/api/catalog/items", { data: result });

  expect([200, 201]).toContain(response.status());
  expect((await response.json()).mediaItem.metadata).toEqual({
    title: "TMDB Fake Details Failure",
    originalTitle: "TMDB Fake Details Failure",
    ukrainianTitle: null,
    year: 2020,
    posterUrl: null,
    backdropUrls: null,
    runtime: null,
    genres: [],
  });
});

test("a search result that isn't one is a 400", async ({ request }) => {
  await logInNewUser(request);
  const result = await searchResult(request, "alien", "348");

  for (const data of [
    {},
    { ...result, externalReference: { ...alien, id: "../348" } },
    { ...result, externalReference: { ...alien, source: "imdb" } },
    { ...result, title: "" },
    { ...result, titleLanguage: "fr" },
  ]) {
    const response = await request.post("/api/catalog/items", { data });
    expect(response.status(), JSON.stringify(data)).toBe(400);
  }
});

// With test hooks on, the Worker treats this header's time as now.
function at(time: string) {
  return { "X-Test-Now": new Date(time).toISOString() };
}

async function addAlien(request: APIRequestContext) {
  return add(request, await searchResult(request, "alien", "348"));
}

async function postLogEntry(request: APIRequestContext, data: object, headers?: object) {
  const response = await request.post("/api/log-entries", { data, headers: { ...headers } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).logEntry;
}

async function theLog(request: APIRequestContext) {
  const response = await request.get("/api/log-entries");
  expect(response.status()).toBe(200);
  return (await response.json()).logEntries;
}

test("a User logs a film with a Rating and sees it in their Log", async ({ request }) => {
  await logInNewUser(request);
  const mediaItem = await addAlien(request);

  const response = await request.post("/api/log-entries", {
    data: { mediaItemId: mediaItem.id, rating: 4.5 },
  });

  expect(response.status()).toBe(201);
  const { logEntry } = await response.json();
  expect(logEntry).toEqual({
    id: expect.any(Number),
    mediaItem,
    rating: 4.5,
    date: null,
    review: null,
    revisit: false,
    createdAt: expect.any(String),
  });
  expect(await theLog(request)).toEqual([logEntry]);
});

test("a Log Entry keeps its date, Review and Revisit flag, even as the first entry", async ({
  request,
}) => {
  await logInNewUser(request);
  const mediaItem = await addAlien(request);

  const logEntry = await postLogEntry(request, {
    mediaItemId: mediaItem.id,
    rating: 5,
    date: "1999-03-31",
    review: "  Still terrifying.  ",
    revisit: true,
  });

  expect(logEntry).toMatchObject({
    rating: 5,
    date: "1999-03-31",
    review: "Still terrifying.",
    revisit: true,
  });
  // An empty Review is none.
  const blank = await postLogEntry(request, { mediaItemId: mediaItem.id, rating: 1, review: "  " });
  expect(blank.review).toBeNull();
});

test("a Rating must be 0.5 to 5 stars in half-star steps", async ({ request }) => {
  await logInNewUser(request);
  const { id } = await addAlien(request);

  for (const rating of [0.5, 3, 5]) {
    expect((await postLogEntry(request, { mediaItemId: id, rating })).rating).toBe(rating);
  }
  for (const rating of [undefined, 0, 5.5, 0.25, 3.7, "4"]) {
    const response = await request.post("/api/log-entries", { data: { mediaItemId: id, rating } });
    expect(response.status(), `rating ${rating}`).toBe(400);
  }
  expect(await theLog(request)).toHaveLength(3);
});

test("a date before 1900 or after today where the User is, is refused", async ({ request }) => {
  await logInNewUser(request);
  const { id } = await addAlien(request);
  // 22:30 UTC on 19 October 2026 is already the 20th in Kyiv.
  const now = at("2026-10-19T22:30:00Z");
  const post = (date: string, timeZone?: string) =>
    request.post("/api/log-entries", {
      data: { mediaItemId: id, rating: 3, date, timeZone },
      headers: now,
    });

  expect((await post("1900-01-01", "Europe/Kyiv")).status()).toBe(201);
  expect((await post("2026-10-20", "Europe/Kyiv")).status()).toBe(201);
  for (const [date, timeZone, error] of [
    ["1899-12-31", "Europe/Kyiv", "date_too_early"],
    ["2026-10-21", "Europe/Kyiv", "date_in_future"],
    ["2026-10-20", "America/Los_Angeles", "date_in_future"],
    ["2026-02-30", "Europe/Kyiv", "invalid_date"],
  ] as const) {
    const response = await post(date, timeZone);
    expect(response.status(), date).toBe(400);
    expect(await response.json()).toEqual({ error });
  }
});

test("without a time zone, a date may be up to tomorrow in UTC", async ({ request }) => {
  await logInNewUser(request);
  const { id } = await addAlien(request);
  const now = at("2026-10-19T22:30:00Z");

  for (const timeZone of [undefined, "Nowhere/Special"]) {
    const ok = { mediaItemId: id, rating: 3, date: "2026-10-20", timeZone };
    expect((await request.post("/api/log-entries", { data: ok, headers: now })).status()).toBe(201);
    const late = { ...ok, date: "2026-10-21" };
    const refused = await request.post("/api/log-entries", { data: late, headers: now });
    expect(refused.status()).toBe(400);
    expect(await refused.json()).toEqual({ error: "date_in_future" });
  }
});

test("the Log lists undated entries first, then by date, then by creation time", async ({
  request,
}) => {
  await logInNewUser(request);
  const { id } = await addAlien(request);
  const entry = (name: string, date: string | null, createdAt: string) =>
    postLogEntry(request, { mediaItemId: id, rating: 3, date, review: name }, at(createdAt));
  await entry("2024, logged first", "2024-06-01", "2026-10-01T10:00:00Z");
  await entry("undated, logged later", null, "2026-10-03T10:00:00Z");
  await entry("2024 again, logged later", "2024-06-01", "2026-10-02T10:00:00Z");
  await entry("1999, logged last", "1999-03-31", "2026-10-04T10:00:00Z");
  await entry("undated, logged earlier", null, "2026-10-01T09:00:00Z");

  const reviews = (await theLog(request)).map((e: { review: string }) => e.review);

  expect(reviews).toEqual([
    "undated, logged earlier",
    "undated, logged later",
    "1999, logged last",
    "2024, logged first",
    "2024 again, logged later",
  ]);
});

test("a Log is the User's own", async ({ request, playwright }) => {
  await logInNewUser(request);
  await postLogEntry(request, { mediaItemId: (await addAlien(request)).id, rating: 4 });
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);

  expect(await theLog(other)).toEqual([]);
  await other.dispose();
});

test("search marks the results already in the User's own Log", async ({ request, playwright }) => {
  await logInNewUser(request);
  expect((await searchResult(request, "alien", "348")).inLog).toBe(false);

  await postLogEntry(request, { mediaItemId: (await addAlien(request)).id, rating: 4 });

  expect((await searchResult(request, "alien", "348")).inLog).toBe(true);
  expect((await searchResult(request, "чужий", "348")).inLog).toBe(true);
  expect((await searchResult(request, "aliens", "679")).inLog).toBe(false);
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  expect((await searchResult(other, "alien", "348")).inLog).toBe(false);
  await other.dispose();
});

test("logging an unknown Media Item is a 400", async ({ request }) => {
  await logInNewUser(request);

  const response = await request.post("/api/log-entries", {
    data: { mediaItemId: 2_000_000_000, rating: 3 },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "unknown_media_item" });
});

test("without a session, adding, the Log and Item History are a 401", async ({ request }) => {
  expect((await request.post("/api/catalog/items", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/log-entries", { data: {} })).status()).toBe(401);
  expect((await request.get("/api/log-entries")).status()).toBe(401);
  expect((await request.patch("/api/log-entries/1", { data: {} })).status()).toBe(401);
  expect((await request.delete("/api/log-entries/1")).status()).toBe(401);
  expect((await request.get("/api/catalog/items/1/history")).status()).toBe(401);
});

test("the OpenAPI spec describes adding, the Log and Item History", async ({ request }) => {
  const spec = await (await request.get("/api/openapi.json")).json();

  expect(spec.paths["/api/catalog/items"].post.responses["201"]).toBeDefined();
  expect(spec.paths["/api/log-entries"].post.responses["400"]).toBeDefined();
  expect(spec.paths["/api/log-entries"].get.security).toEqual([{ session: [] }]);
  expect(spec.paths["/api/log-entries/{logEntryId}"].patch.responses["404"]).toBeDefined();
  expect(spec.paths["/api/log-entries/{logEntryId}"].delete.responses["204"]).toBeDefined();
  expect(spec.paths["/api/catalog/items/{mediaItemId}/history"].get.responses["200"]).toBeDefined();
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("the Log loads in the same number of queries for 1 entry as for 20", async ({
  request,
  playwright,
}) => {
  const queriesForLogOf = async (api: APIRequestContext, entries: number) => {
    await logInNewUser(api);
    const { id } = await addAlien(api);
    for (let i = 0; i < entries; i += 1) await postLogEntry(api, { mediaItemId: id, rating: 3 });
    const response = await api.get("/api/log-entries");
    expect(await response.json()).toMatchObject({ logEntries: { length: entries } });
    return response.headers()["x-d1-query-count"];
  };
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });

  const one = await queriesForLogOf(request, 1);
  const twenty = await queriesForLogOf(other, 20);
  await other.dispose();

  expect(one).toMatch(/^\d+$/);
  expect(twenty).toBe(one);
});

async function itemHistory(request: APIRequestContext, mediaItemId: number) {
  const response = await request.get(`/api/catalog/items/${mediaItemId}/history`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

async function addAliens(request: APIRequestContext) {
  return add(request, await searchResult(request, "aliens", "679"));
}

test("a film's Item History has its Log Entries in Log Order, and the last one's Rating is current", async ({
  request,
}) => {
  await logInNewUser(request);
  const alienItem = await addAlien(request);
  const aliensItem = await addAliens(request);
  const latest = await postLogEntry(
    request,
    { mediaItemId: alienItem.id, rating: 4, date: "2026-10-01", review: "Still terrifying." },
    at("2026-10-01T20:00:00Z"),
  );
  // Logged later, but backdated: it goes first and doesn't set the Current Rating.
  const backdated = await postLogEntry(
    request,
    { mediaItemId: alienItem.id, rating: 2, date: "1999-03-31" },
    at("2026-10-02T20:00:00Z"),
  );
  await postLogEntry(request, { mediaItemId: aliensItem.id, rating: 5 });

  expect(await itemHistory(request, alienItem.id)).toEqual({
    mediaItem: alienItem,
    logEntries: [backdated, latest],
    currentRating: 4,
    inBacklog: false,
  });
});

test("the Item History of a film the User hasn't logged is empty, with no Current Rating", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const mediaItem = await addAlien(request);
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  await postLogEntry(other, { mediaItemId: mediaItem.id, rating: 5 });
  await other.dispose();

  expect(await itemHistory(request, mediaItem.id)).toEqual({
    mediaItem,
    logEntries: [],
    currentRating: null,
    inBacklog: false,
  });
});

test("the Item History says whether the film is on the User's own Backlog", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const { id } = await addAlien(request);
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  expect((await other.post("/api/backlog/items", { data: { mediaItemId: id } })).status()).toBe(
    201,
  );
  expect((await itemHistory(other, id)).inBacklog).toBe(true);
  await other.dispose();
  expect((await itemHistory(request, id)).inBacklog).toBe(false);

  expect((await request.post("/api/backlog/items", { data: { mediaItemId: id } })).status()).toBe(
    201,
  );
  expect((await itemHistory(request, id)).inBacklog).toBe(true);

  expect((await request.delete(`/api/backlog/items/${id}`)).status()).toBe(204);
  expect((await itemHistory(request, id)).inBacklog).toBe(false);
});

test("the Item History of an unknown Media Item is a 404", async ({ request }) => {
  await logInNewUser(request);

  const response = await request.get("/api/catalog/items/2000000000/history");

  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: "unknown_media_item" });
});

async function patchLogEntry(
  request: APIRequestContext,
  id: number,
  data: object,
  headers?: object,
) {
  const response = await request.patch(`/api/log-entries/${id}`, { data, headers: { ...headers } });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).logEntry;
}

test("every field of a Log Entry can be edited, and its creation time stays", async ({
  request,
}) => {
  await logInNewUser(request);
  const { id: mediaItemId } = await addAlien(request);
  const logged = await postLogEntry(
    request,
    { mediaItemId, rating: 3, date: "2026-10-01", review: "Fine." },
    at("2026-10-01T10:00:00Z"),
  );

  const edited = await patchLogEntry(
    request,
    logged.id,
    { rating: 4.5, date: "1999-03-31", review: "  Still terrifying.  ", revisit: true },
    at("2026-10-02T10:00:00Z"),
  );

  expect(edited).toEqual({
    ...logged,
    rating: 4.5,
    date: "1999-03-31",
    review: "Still terrifying.",
    revisit: true,
  });
  // Clearing the date and the Review, and leaving out what doesn't change.
  const cleared = await patchLogEntry(request, logged.id, { date: null, review: "" });
  expect(cleared).toEqual({ ...edited, date: null, review: null });
  expect(await theLog(request)).toEqual([cleared]);
});

test("editing a date or Rating updates Log Order and the Current Rating at once", async ({
  request,
}) => {
  await logInNewUser(request);
  const { id: mediaItemId } = await addAlien(request);
  const entry = (review: string, rating: number, createdAt: string) =>
    postLogEntry(request, { mediaItemId, rating, date: "2026-10-01", review }, at(createdAt));
  const first = await entry("first", 2, "2026-10-01T10:00:00Z");
  await entry("second", 3, "2026-10-01T11:00:00Z");
  const third = await entry("third", 4, "2026-10-01T12:00:00Z");
  const reviews = async () => (await theLog(request)).map((e: { review: string }) => e.review);

  // Editing the Rating moves nothing among same-day entries, but the last entry's sets the
  // Current Rating.
  await patchLogEntry(request, first.id, { rating: 5 });
  await patchLogEntry(request, third.id, { rating: 1 });
  expect(await reviews()).toEqual(["first", "second", "third"]);
  expect((await itemHistory(request, mediaItemId)).currentRating).toBe(1);

  // Moving the first entry to a later day makes it last, and its Rating current.
  await patchLogEntry(request, first.id, { date: "2026-10-02" });
  expect(await reviews()).toEqual(["second", "third", "first"]);
  expect((await itemHistory(request, mediaItemId)).currentRating).toBe(5);

  // Moving it back puts it where it was: creation time still breaks the tie.
  await patchLogEntry(request, first.id, { date: "2026-10-01" });
  expect(await reviews()).toEqual(["first", "second", "third"]);
  expect((await itemHistory(request, mediaItemId)).currentRating).toBe(1);
});

test("an edit is held to the same rules as a new Log Entry", async ({ request }) => {
  await logInNewUser(request);
  const { id: mediaItemId } = await addAlien(request);
  const logged = await postLogEntry(request, { mediaItemId, rating: 3 });
  const now = at("2026-10-19T22:30:00Z");
  const patch = (data: object) =>
    request.patch(`/api/log-entries/${logged.id}`, { data, headers: now });

  expect((await patch({ date: "2026-10-20", timeZone: "Europe/Kyiv" })).status()).toBe(200);
  for (const [data, error] of [
    [{ date: "1899-12-31" }, "date_too_early"],
    [{ date: "2026-10-20", timeZone: "America/Los_Angeles" }, "date_in_future"],
    [{ date: "2026-02-30" }, "invalid_date"],
    [{ rating: 0 }, "invalid_request"],
    [{ rating: 3.7 }, "invalid_request"],
    [{ rating: null }, "invalid_request"],
    [{ revisit: "yes" }, "invalid_request"],
    [{ mediaItemId: 1 }, "invalid_request"],
  ] as const) {
    const response = await patch(data);
    expect(response.status(), JSON.stringify(data)).toBe(400);
    expect(await response.json()).toEqual({ error });
  }
  expect((await theLog(request))[0]).toMatchObject({ rating: 3, date: "2026-10-20" });
});

test("deleting a Log Entry removes it, and the Current Rating falls back to the last one left", async ({
  request,
}) => {
  await logInNewUser(request);
  const { id: mediaItemId } = await addAlien(request);
  const older = await postLogEntry(request, { mediaItemId, rating: 2, date: "1999-03-31" });
  const newer = await postLogEntry(request, { mediaItemId, rating: 5, date: "2026-10-01" });

  const response = await request.delete(`/api/log-entries/${newer.id}`);

  expect(response.status()).toBe(204);
  expect(await theLog(request)).toEqual([older]);
  expect(await itemHistory(request, mediaItemId)).toMatchObject({
    logEntries: [older],
    currentRating: 2,
  });
});

test("deleting a film's only Log Entry makes it not experienced, with no Current Rating", async ({
  request,
}) => {
  await logInNewUser(request);
  const { id: mediaItemId } = await addAlien(request);
  const only = await postLogEntry(request, { mediaItemId, rating: 4 });

  expect((await request.delete(`/api/log-entries/${only.id}`)).status()).toBe(204);

  expect(await theLog(request)).toEqual([]);
  expect(await itemHistory(request, mediaItemId)).toMatchObject({
    logEntries: [],
    currentRating: null,
  });
  expect((await searchResult(request, "alien", "348")).inLog).toBe(false);
});

test("another User's Log Entry, or one already deleted, can be neither edited nor deleted", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const { id: mediaItemId } = await addAlien(request);
  const mine = await postLogEntry(request, { mediaItemId, rating: 4 });
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  const theirs = await postLogEntry(other, { mediaItemId, rating: 1 });
  expect((await request.delete(`/api/log-entries/${mine.id}`)).status()).toBe(204);

  for (const id of [theirs.id, mine.id, 2_000_000_000]) {
    const edited = await request.patch(`/api/log-entries/${id}`, { data: { rating: 5 } });
    expect(edited.status(), `editing ${id}`).toBe(404);
    expect(await edited.json()).toEqual({ error: "unknown_log_entry" });
    const deleted = await request.delete(`/api/log-entries/${id}`);
    expect(deleted.status(), `deleting ${id}`).toBe(404);
    expect(await deleted.json()).toEqual({ error: "unknown_log_entry" });
  }
  expect(await theLog(other)).toEqual([theirs]);
  await other.dispose();
});

test("an Item History loads in the same number of queries for 1 entry as for 20", async ({
  request,
  playwright,
}) => {
  const queriesForHistoryOf = async (api: APIRequestContext, entries: number) => {
    await logInNewUser(api);
    const { id } = await addAlien(api);
    for (let i = 0; i < entries; i += 1) await postLogEntry(api, { mediaItemId: id, rating: 3 });
    const response = await api.get(`/api/catalog/items/${id}/history`);
    expect(await response.json()).toMatchObject({ logEntries: { length: entries } });
    return response.headers()["x-d1-query-count"];
  };
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });

  const one = await queriesForHistoryOf(request, 1);
  const twenty = await queriesForHistoryOf(other, 20);
  await other.dispose();

  expect(one).toMatch(/^\d+$/);
  expect(twenty).toBe(one);
});
