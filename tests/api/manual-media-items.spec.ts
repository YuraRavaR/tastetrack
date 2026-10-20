import { type APIRequestContext, expect, test } from "@playwright/test";
import { alien } from "../support/films";
import { fillManualMediaItems } from "../support/manual-media-items";
import { logInNewUser } from "../support/users";

// Makes a Manual Media Item: the Media Item, as the Worker answers.
async function createManual(request: APIRequestContext, data: object) {
  const response = await request.post("/api/catalog/manual-items", {
    data: { mediaType: "film", ...data },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).mediaItem;
}

test("a User adds a film by hand, with its Original Title, year, runtime and genres", async ({
  request,
}) => {
  await logInNewUser(request);

  const response = await request.post("/api/catalog/manual-items", {
    data: {
      mediaType: "film",
      title: "  Тіні забутих предків ",
      originalTitle: " Shadows of Forgotten Ancestors ",
      year: 1965,
      runtime: 97,
      genres: ["Drama", "Romance"],
    },
  });

  expect(response.status()).toBe(201);
  const { mediaItem } = await response.json();
  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "film",
    externalReference: null,
    metadata: {
      title: "Тіні забутих предків",
      originalTitle: "Shadows of Forgotten Ancestors",
      ukrainianTitle: null,
      year: 1965,
      posterUrl: null,
      runtime: 97,
      genres: ["Drama", "Romance"],
    },
  });
  const history = await (await request.get(`/api/catalog/items/${mediaItem.id}/history`)).json();
  expect(history.mediaItem).toEqual(mediaItem);
});

test("only a title is needed, and the Original Title is then the title", async ({ request }) => {
  await logInNewUser(request);

  const mediaItem = await createManual(request, { title: "Home movie", originalTitle: "  " });

  expect(mediaItem.metadata).toEqual({
    title: "Home movie",
    originalTitle: "Home movie",
    ukrainianTitle: null,
    year: null,
    posterUrl: null,
    runtime: null,
    genres: [],
  });
});

// With test hooks on, the Worker treats this header's time as now.
function at(time: string) {
  return { "X-Test-Now": new Date(time).toISOString() };
}

test("implausible values are refused: a title of 1–200 characters, a year from 1888 to five years on, a runtime of 1–1000 minutes, TMDB's genres once each", async ({
  request,
}) => {
  await logInNewUser(request);
  // The latest year is five years on, in UTC: 2030.
  const now = at("2025-12-31T23:30:00Z");

  for (const data of [
    {},
    { title: "   " },
    { title: "x".repeat(201) },
    { title: "Film", originalTitle: "x".repeat(201) },
    { title: "Film", year: 1887 },
    { title: "Film", year: 2031 },
    { title: "Film", year: 1999.5 },
    { title: "Film", runtime: 0 },
    { title: "Film", runtime: 1001 },
    { title: "Film", genres: ["Drama", "Drama"] },
    { title: "Film", genres: ["Cooking"] },
    { title: "Film", mediaType: "book" },
  ]) {
    const response = await request.post("/api/catalog/manual-items", {
      data: { mediaType: "film", ...data },
      headers: now,
    });
    expect(response.status(), JSON.stringify(data)).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }

  for (const data of [
    { title: "x".repeat(200), originalTitle: "y".repeat(200) },
    { title: "Roundhay Garden Scene", year: 1888, runtime: 1 },
    { title: "Announced", year: 2030, runtime: 1000 },
  ]) {
    const response = await request.post("/api/catalog/manual-items", {
      data: { mediaType: "film", ...data },
      headers: now,
    });
    expect(response.status(), JSON.stringify(data)).toBe(201);
  }
});

test("the same title and year as another of the User's is refused as a possible duplicate, unless allowed", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const first = await createManual(request, { title: "Тіні забутих предків", year: 1965 });
  const post = (data: object) =>
    request.post("/api/catalog/manual-items", { data: { mediaType: "film", ...data } });

  const again = await post({ title: " ТІНІ ЗАБУТИХ ПРЕДКІВ ", year: 1965 });

  expect(again.status()).toBe(409);
  expect(await again.json()).toEqual({ error: "possible_duplicate" });
  const allowed = await post({ title: "Тіні забутих предків", year: 1965, allowDuplicate: true });
  expect(allowed.status()).toBe(201);
  expect((await allowed.json()).mediaItem.id).not.toBe(first.id);
  // Another year, or none, is another film.
  expect((await post({ title: "Тіні забутих предків", year: 2025 })).status()).toBe(201);
  expect((await post({ title: "Тіні забутих предків" })).status()).toBe(201);
  expect((await post({ title: "Тіні забутих предків" })).status()).toBe(409);
  // Another User's films don't count.
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  expect((await createManual(other, { title: "Тіні забутих предків", year: 1965 })).id).toEqual(
    expect.any(Number),
  );
  await other.dispose();
});

test("at 1,000 Manual Media Items the User can add no more", async ({ request }) => {
  const user = await logInNewUser(request);
  await fillManualMediaItems(request, user, 999);
  const thousandth = await createManual(request, { title: "The thousandth" });

  const response = await request.post("/api/catalog/manual-items", {
    data: { mediaType: "film", title: "One too many" },
  });

  expect(response.status()).toBe(409);
  expect(await response.json()).toEqual({ error: "too_many_manual_media_items" });
  // At the limit, a duplicate is refused for the limit.
  const again = await request.post("/api/catalog/manual-items", {
    data: { mediaType: "film", title: "The thousandth", allowDuplicate: true },
  });
  expect(await again.json()).toEqual({ error: "too_many_manual_media_items" });
  // Deleting one makes room.
  expect((await request.delete(`/api/catalog/manual-items/${thousandth.id}`)).status()).toBe(204);
  expect((await createManual(request, { title: "One too many" })).id).toEqual(expect.any(Number));
});

test("a Manual Media Item is logged, planned and added to Lists like any film", async ({
  request,
}) => {
  await logInNewUser(request);
  const mediaItem = await createManual(request, { title: "Home movie", year: 2019 });
  const list = await request.post("/api/lists", { data: { name: "Family", mediaType: "film" } });
  const listId = (await list.json()).list.id;

  const planned = await request.post("/api/backlog/items", {
    data: { mediaItemId: mediaItem.id },
  });
  const added = await request.post(`/api/lists/${listId}/items`, {
    data: { mediaItemId: mediaItem.id },
  });
  const logged = await request.post("/api/log-entries", {
    data: { mediaItemId: mediaItem.id, rating: 4.5 },
  });

  expect(planned.status()).toBe(201);
  expect(added.status()).toBe(201);
  expect((await added.json()).listItem.mediaItem).toEqual(mediaItem);
  expect(logged.status()).toBe(201);
  expect(await logged.json()).toMatchObject({
    logEntry: { mediaItem, rating: 4.5 },
    removedFromBacklog: { position: 0, note: null },
  });
  const log = await (await request.get("/api/log-entries")).json();
  expect(log.logEntries.map((entry: { mediaItem: object }) => entry.mediaItem)).toEqual([
    mediaItem,
  ]);
  const history = await (await request.get(`/api/catalog/items/${mediaItem.id}/history`)).json();
  expect(history).toMatchObject({ mediaItem, currentRating: 4.5 });
  const theList = await (await request.get(`/api/lists/${listId}`)).json();
  expect(theList.list.items).toEqual([expect.objectContaining({ mediaItem })]);
});

test("another User's Manual Media Item is unknown: no Item History, and it can't be logged, planned or listed", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const list = await request.post("/api/lists", { data: { name: "Mine", mediaType: "film" } });
  const listId = (await list.json()).list.id;
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  const theirs = await createManual(other, { title: "Their home movie" });
  const data = { mediaItemId: theirs.id, rating: 3 };

  const history = await request.get(`/api/catalog/items/${theirs.id}/history`);
  expect(history.status()).toBe(404);
  expect(await history.json()).toEqual({ error: "unknown_media_item" });
  for (const response of [
    await request.post("/api/log-entries", { data }),
    await request.post("/api/backlog/items", { data: { mediaItemId: theirs.id } }),
    await request.post(`/api/lists/${listId}/items`, { data: { mediaItemId: theirs.id } }),
  ]) {
    expect(response.status(), response.url()).toBe(400);
    expect(await response.json()).toEqual({ error: "unknown_media_item" });
  }
  expect((await (await request.get("/api/log-entries")).json()).logEntries).toEqual([]);
  const { backlog } = await (await request.get("/api/backlog?mediaType=film")).json();
  expect(backlog.items).toEqual([]);
  // Its owner still sees it.
  const own = await other.get(`/api/catalog/items/${theirs.id}/history`);
  expect((await own.json()).mediaItem).toEqual(theirs);
  await other.dispose();
});

test("the User edits a Manual Media Item, by the same rules, and their Log shows the change", async ({
  request,
}) => {
  await logInNewUser(request);
  const mediaItem = await createManual(request, {
    title: "Tini zabutykh predkiv",
    originalTitle: "Shadows",
    year: 1964,
    runtime: 90,
    genres: ["Drama"],
  });
  await request.post("/api/log-entries", { data: { mediaItemId: mediaItem.id, rating: 5 } });
  const patch = (data: object, headers?: Record<string, string>) =>
    request.patch(`/api/catalog/manual-items/${mediaItem.id}`, { data, headers });

  const edited = await patch({ title: " Тіні забутих предків ", year: 1965, genres: [] });

  expect(edited.status()).toBe(200);
  const expected = {
    ...mediaItem,
    metadata: {
      ...mediaItem.metadata,
      title: "Тіні забутих предків",
      year: 1965,
      genres: [],
    },
  };
  expect((await edited.json()).mediaItem).toEqual(expected);
  const log = await (await request.get("/api/log-entries")).json();
  expect(log.logEntries[0].mediaItem).toEqual(expected);
  // A null clears a field, and an empty Original Title counts as none.
  const cleared = await patch({ originalTitle: "", year: null, runtime: null });
  expect((await cleared.json()).mediaItem.metadata).toMatchObject({
    originalTitle: "Тіні забутих предків",
    year: null,
    runtime: null,
  });
  for (const data of [
    { title: "  " },
    { title: null },
    { year: 1887 },
    { year: 2031 },
    { runtime: 1001 },
    { genres: ["Cooking"] },
    { mediaType: "film" },
  ]) {
    const refused = await patch(data, at("2025-12-31T23:30:00Z"));
    expect(refused.status(), JSON.stringify(data)).toBe(400);
    expect(await refused.json()).toEqual({ error: "invalid_request" });
  }
});

test("only the owner's Manual Media Items can be edited: another User's, or a catalog-backed one, is unknown", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const catalogBacked = await alien(request);
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  const theirs = await createManual(other, { title: "Their home movie" });

  for (const id of [theirs.id, catalogBacked.id, 2_000_000_000]) {
    const response = await request.patch(`/api/catalog/manual-items/${id}`, {
      data: { title: "Mine now" },
    });
    expect(response.status(), String(id)).toBe(404);
    expect(await response.json()).toEqual({ error: "unknown_media_item" });
  }
  const own = await other.get(`/api/catalog/items/${theirs.id}/history`);
  expect((await own.json()).mediaItem).toEqual(theirs);
  await other.dispose();
});

test("deleting a Manual Media Item says first how many Log Entries and List Items go with it", async ({
  request,
}) => {
  await logInNewUser(request);
  const mediaItem = await createManual(request, { title: "Home movie" });
  const kept = await alien(request);
  const list = await request.post("/api/lists", { data: { name: "Family", mediaType: "film" } });
  const listId = (await list.json()).list.id;
  for (const mediaItemId of [mediaItem.id, kept.id]) {
    await request.post("/api/log-entries", { data: { mediaItemId, rating: 4 } });
    await request.post("/api/log-entries", { data: { mediaItemId, rating: 3 } });
    await request.post(`/api/lists/${listId}/items`, { data: { mediaItemId } });
  }
  await request.post("/api/backlog/items", { data: { mediaItemId: mediaItem.id } });
  const url = `/api/catalog/manual-items/${mediaItem.id}`;

  const before = await request.get(url);

  expect(before.status()).toBe(200);
  expect(await before.json()).toEqual({ mediaItem, usage: { logEntries: 2, listItems: 2 } });
  expect((await request.delete(url)).status()).toBe(204);
  for (const gone of [
    await request.get(url),
    await request.get(`/api/catalog/items/${mediaItem.id}/history`),
    await request.delete(url),
  ]) {
    expect(gone.status(), gone.url()).toBe(404);
    expect(await gone.json()).toEqual({ error: "unknown_media_item" });
  }
  const log = await (await request.get("/api/log-entries")).json();
  expect(log.logEntries.map((entry: { mediaItem: object }) => entry.mediaItem)).toEqual([
    kept,
    kept,
  ]);
  const theList = await (await request.get(`/api/lists/${listId}`)).json();
  expect(theList.list.items).toEqual([expect.objectContaining({ mediaItem: kept, position: 0 })]);
  const { backlog } = await (await request.get("/api/backlog?mediaType=film")).json();
  expect(backlog.items).toEqual([]);
});

test("another User's Manual Media Item, or a catalog-backed one, can be neither read nor deleted", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const catalogBacked = await alien(request);
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  const theirs = await createManual(other, { title: "Their home movie" });

  for (const id of [theirs.id, catalogBacked.id]) {
    for (const response of [
      await request.get(`/api/catalog/manual-items/${id}`),
      await request.delete(`/api/catalog/manual-items/${id}`),
    ]) {
      expect(response.status(), `${response.url()}`).toBe(404);
      expect(await response.json()).toEqual({ error: "unknown_media_item" });
    }
  }
  const own = await other.get(`/api/catalog/manual-items/${theirs.id}`);
  expect((await own.json()).mediaItem).toEqual(theirs);
  await other.dispose();
});

async function search(request: APIRequestContext, query: string) {
  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

test("search lists the User's own matching Manual Media Items first, by either title, in any case, marked if logged or planned", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const homeVideo = await createManual(request, {
    title: "Чужий: домашнє відео",
    originalTitle: "Alien home video",
  });
  const sequel = await createManual(request, { title: "Чужий 2", year: 2020 });
  await createManual(request, { title: "Something else" });
  await request.post("/api/log-entries", { data: { mediaItemId: sequel.id, rating: 2 } });
  await request.post("/api/backlog/items", { data: { mediaItemId: homeVideo.id } });
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  await createManual(other, { title: "Чужий у них" });
  await other.dispose();

  const byTitle = await search(request, "ЧУЖИЙ");
  const byOriginalTitle = await search(request, "home VIDEO");

  expect(byTitle.manualResults).toEqual([
    { mediaItem: sequel, inLog: true, inBacklog: false },
    { mediaItem: homeVideo, inLog: false, inBacklog: true },
  ]);
  expect(byTitle.results).toContainEqual(expect.objectContaining({ originalTitle: "Alien" }));
  expect(byOriginalTitle.manualResults).toEqual([
    { mediaItem: homeVideo, inLog: false, inBacklog: true },
  ]);
  expect((await search(request, "alien")).results).toContainEqual(
    expect.objectContaining({ title: "Alien" }),
  );
});

test("without a session, Manual Media Items are a 401", async ({ request }) => {
  for (const response of [
    await request.post("/api/catalog/manual-items", { data: {} }),
    await request.get("/api/catalog/manual-items/1"),
    await request.patch("/api/catalog/manual-items/1", { data: {} }),
    await request.delete("/api/catalog/manual-items/1"),
  ]) {
    expect(response.status(), response.url()).toBe(401);
  }
});

test("the OpenAPI spec describes Manual Media Items", async ({ request }) => {
  const spec = await (await request.get("/api/openapi.json")).json();

  const items = spec.paths["/api/catalog/manual-items"];
  const item = spec.paths["/api/catalog/manual-items/{mediaItemId}"];
  expect(items.post.security).toEqual([{ session: [] }]);
  expect(items.post.responses["409"]).toBeDefined();
  expect(item.get.responses["404"]).toBeDefined();
  expect(item.patch.responses["404"]).toBeDefined();
  expect(item.delete.responses["204"]).toBeDefined();
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("search takes the same number of queries for 1 matching Manual Media Item as for 25, and lists 20", async ({
  request,
  playwright,
}) => {
  const queriesFor = async (api: APIRequestContext, count: number) => {
    const user = await logInNewUser(api);
    await fillManualMediaItems(api, user, count);
    const response = await api.get("/api/catalog/search", {
      params: { mediaType: "film", query: "placeholder" },
    });
    const { manualResults } = await response.json();
    expect(manualResults).toHaveLength(Math.min(count, 20));
    return response.headers()["x-d1-query-count"];
  };
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });

  const one = await queriesFor(request, 1);
  const many = await queriesFor(other, 25);
  await other.dispose();

  expect(one).toMatch(/^\d+$/);
  expect(many).toBe(one);
});
