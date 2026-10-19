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
      runtime: 117,
      genres: expect.arrayContaining(["Horror", "Science Fiction"]),
    },
  });
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

test("without a session, adding and the Log are a 401", async ({ request }) => {
  expect((await request.post("/api/catalog/items", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/log-entries", { data: {} })).status()).toBe(401);
  expect((await request.get("/api/log-entries")).status()).toBe(401);
});

test("the OpenAPI spec describes adding and the Log", async ({ request }) => {
  const spec = await (await request.get("/api/openapi.json")).json();

  expect(spec.paths["/api/catalog/items"].post.responses["201"]).toBeDefined();
  expect(spec.paths["/api/log-entries"].post.responses["400"]).toBeDefined();
  expect(spec.paths["/api/log-entries"].get.security).toEqual([{ session: [] }]);
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
