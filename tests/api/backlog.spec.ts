import { type APIRequestContext, expect, test } from "@playwright/test";
import { fillBacklog } from "../support/backlog";
import { alien, aliens, amelie, searchResult, titlesOf } from "../support/films";
import { logInNewUser } from "../support/users";

async function theBacklog(request: APIRequestContext) {
  const response = await request.get("/api/backlog", { params: { mediaType: "film" } });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).backlog;
}

test("a new User has an empty, private film Backlog from registration", async ({ request }) => {
  await logInNewUser(request);

  expect(await theBacklog(request)).toEqual({
    id: expect.any(Number),
    mediaType: "film",
    visibility: "private",
    shareLink: null,
    items: [],
  });
});

// Marks a Media Item Planned: its List Item in the Backlog.
async function plan(request: APIRequestContext, data: object) {
  const response = await request.post("/api/backlog/items", { data });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).listItem;
}

test("marking a film Planned adds it to the Backlog, without a Log Entry", async ({ request }) => {
  await logInNewUser(request);
  const mediaItem = await alien(request);

  const response = await request.post("/api/backlog/items", {
    data: { mediaItemId: mediaItem.id },
  });

  expect(response.status()).toBe(201);
  const { listItem } = await response.json();
  expect(listItem).toEqual({ id: expect.any(Number), mediaItem, position: 0, note: null });
  expect((await theBacklog(request)).items).toEqual([listItem]);
  expect((await (await request.get("/api/log-entries")).json()).logEntries).toEqual([]);
});

test("films join the Backlog at the end, and planning one again keeps its place", async ({
  request,
}) => {
  await logInNewUser(request);
  const first = await plan(request, { mediaItemId: (await alien(request)).id });
  const second = await plan(request, { mediaItemId: (await aliens(request)).id });

  const again = await request.post("/api/backlog/items", {
    data: { mediaItemId: first.mediaItem.id },
  });

  expect(again.status()).toBe(200);
  expect((await again.json()).listItem).toEqual(first);
  expect(second.position).toBe(1);
  expect((await theBacklog(request)).items).toEqual([first, second]);
});

test("planning an unknown Media Item is a 400", async ({ request }) => {
  await logInNewUser(request);

  const response = await request.post("/api/backlog/items", {
    data: { mediaItemId: 2_000_000_000 },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "unknown_media_item" });
});

async function patchListItem(request: APIRequestContext, id: number, data: object) {
  const response = await request.patch(`/api/list-items/${id}`, { data });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).listItem;
}

async function backlogTitles(request: APIRequestContext) {
  return titlesOf((await theBacklog(request)).items);
}

test("the User reorders the Backlog by hand", async ({ request }) => {
  await logInNewUser(request);
  await plan(request, { mediaItemId: (await alien(request)).id });
  await plan(request, { mediaItemId: (await aliens(request)).id });
  const third = await plan(request, { mediaItemId: (await amelie(request)).id });

  const moved = await patchListItem(request, third.id, { position: 0 });

  expect(moved).toEqual({ ...third, position: 0 });
  expect(await backlogTitles(request)).toEqual(["Amélie", "Alien", "Aliens"]);
  await patchListItem(request, third.id, { position: 1 });
  expect(await backlogTitles(request)).toEqual(["Alien", "Amélie", "Aliens"]);
  // Past the end is last.
  expect((await patchListItem(request, third.id, { position: 99 })).position).toBe(2);
  expect(await backlogTitles(request)).toEqual(["Alien", "Aliens", "Amélie"]);
});

test("the User adds a Note to a Backlog item, changes it and clears it", async ({ request }) => {
  await logInNewUser(request);
  const planned = await plan(request, { mediaItemId: (await alien(request)).id });

  const noted = await patchListItem(request, planned.id, { note: "  Olena's favourite.  " });

  expect(noted).toEqual({ ...planned, note: "Olena's favourite." });
  expect((await theBacklog(request)).items).toEqual([noted]);
  // An empty Note is none, and moving an item keeps its Note.
  expect(await patchListItem(request, planned.id, { position: 0 })).toEqual(noted);
  expect((await patchListItem(request, planned.id, { note: "  " })).note).toBeNull();
  await patchListItem(request, planned.id, { note: "Again." });
  expect((await patchListItem(request, planned.id, { note: null })).note).toBeNull();
  const tooLong = await request.patch(`/api/list-items/${planned.id}`, {
    data: { note: "x".repeat(1001) },
  });
  expect(tooLong.status()).toBe(400);
  expect(await tooLong.json()).toEqual({ error: "invalid_request" });
});

async function logFilm(request: APIRequestContext, mediaItemId: number) {
  const response = await request.post("/api/log-entries", { data: { mediaItemId, rating: 4 } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

test("logging a film takes it off the Backlog, and planning it back where it was undoes that", async ({
  request,
}) => {
  await logInNewUser(request);
  await plan(request, { mediaItemId: (await alien(request)).id });
  const planned = await plan(request, { mediaItemId: (await aliens(request)).id });
  const noted = await patchListItem(request, planned.id, { note: "Olena's favourite." });
  await plan(request, { mediaItemId: (await amelie(request)).id });

  const logged = await logFilm(request, noted.mediaItem.id);

  expect(logged.removedFromBacklog).toEqual({ position: 1, note: "Olena's favourite." });
  expect(await backlogTitles(request)).toEqual(["Alien", "Amélie"]);
  const undone = await plan(request, {
    mediaItemId: noted.mediaItem.id,
    ...logged.removedFromBacklog,
  });
  expect(undone).toEqual({ ...noted, id: expect.any(Number) });
  expect(await backlogTitles(request)).toEqual(["Alien", "Aliens", "Amélie"]);
});

test("logging a film that isn't in the Backlog takes nothing off it", async ({ request }) => {
  await logInNewUser(request);
  const planned = await plan(request, { mediaItemId: (await alien(request)).id });

  const logged = await logFilm(request, (await aliens(request)).id);

  expect(logged.removedFromBacklog).toBeNull();
  expect((await theBacklog(request)).items).toEqual([planned]);
});

test("a film already experienced can be planned again, and keeps its Log", async ({ request }) => {
  await logInNewUser(request);
  const mediaItem = await alien(request);
  const { logEntry } = await logFilm(request, mediaItem.id);

  const planned = await plan(request, { mediaItemId: mediaItem.id });

  expect((await theBacklog(request)).items).toEqual([planned]);
  expect((await (await request.get("/api/log-entries")).json()).logEntries).toEqual([logEntry]);
});

test("deleting a Log Entry leaves the Backlog untouched", async ({ request }) => {
  await logInNewUser(request);
  // Logging takes Alien off the Backlog; deleting the entry doesn't bring it back.
  const alienItem = await alien(request);
  await plan(request, { mediaItemId: alienItem.id });
  const alienEntry = (await logFilm(request, alienItem.id)).logEntry;
  // Aliens was planned again after logging; deleting the entry doesn't take it off.
  const aliensItem = await aliens(request);
  const aliensEntry = (await logFilm(request, aliensItem.id)).logEntry;
  const replanned = await plan(request, { mediaItemId: aliensItem.id });

  for (const { id } of [alienEntry, aliensEntry]) {
    expect((await request.delete(`/api/log-entries/${id}`)).status()).toBe(204);
  }

  expect((await theBacklog(request)).items).toEqual([replanned]);
});

test("the User removes a film from the Backlog, and the rest keep their order", async ({
  request,
}) => {
  await logInNewUser(request);
  const first = await plan(request, { mediaItemId: (await alien(request)).id });
  const second = await plan(request, { mediaItemId: (await aliens(request)).id });
  const third = await plan(request, { mediaItemId: (await amelie(request)).id });

  const response = await request.delete(`/api/list-items/${second.id}`);

  expect(response.status()).toBe(204);
  expect((await theBacklog(request)).items).toEqual([first, { ...third, position: 1 }]);
  // Moving still counts places among the items left.
  expect((await patchListItem(request, third.id, { position: 0 })).position).toBe(0);
  expect(await backlogTitles(request)).toEqual(["Amélie", "Alien"]);
});

test("another User's Backlog item, or one already removed, can be neither edited nor removed", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const mediaItemId = (await alien(request)).id;
  const mine = await plan(request, { mediaItemId });
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  const theirs = await plan(other, { mediaItemId });
  expect((await request.delete(`/api/list-items/${mine.id}`)).status()).toBe(204);

  for (const id of [theirs.id, mine.id, 2_000_000_000]) {
    const edited = await request.patch(`/api/list-items/${id}`, { data: { note: "Mine now." } });
    expect(edited.status(), `editing ${id}`).toBe(404);
    expect(await edited.json()).toEqual({ error: "unknown_list_item" });
    const removed = await request.delete(`/api/list-items/${id}`);
    expect(removed.status(), `removing ${id}`).toBe(404);
    expect(await removed.json()).toEqual({ error: "unknown_list_item" });
  }
  expect((await theBacklog(other)).items).toEqual([theirs]);
  expect((await theBacklog(request)).items).toEqual([]);
  await other.dispose();
});

test("the User takes a film off the Backlog by its Media Item, and the rest keep their order", async ({
  request,
}) => {
  await logInNewUser(request);
  const first = await plan(request, { mediaItemId: (await alien(request)).id });
  const second = await plan(request, { mediaItemId: (await aliens(request)).id });
  const third = await plan(request, { mediaItemId: (await amelie(request)).id });

  const response = await request.delete(`/api/backlog/items/${second.mediaItem.id}`);

  expect(response.status()).toBe(204);
  expect((await theBacklog(request)).items).toEqual([first, { ...third, position: 1 }]);
});

test("taking a film off keeps it on the User's Lists and in their Log", async ({ request }) => {
  await logInNewUser(request);
  const mediaItem = await alien(request);
  const { logEntry } = await logFilm(request, mediaItem.id);
  await plan(request, { mediaItemId: mediaItem.id });
  const list = await (
    await request.post("/api/lists", { data: { name: "Horror", mediaType: "film" } })
  ).json();
  const added = await request.post(`/api/lists/${list.list.id}/items`, {
    data: { mediaItemId: mediaItem.id },
  });
  expect(added.status(), await added.text()).toBe(201);

  const response = await request.delete(`/api/backlog/items/${mediaItem.id}`);

  expect(response.status()).toBe(204);
  expect((await theBacklog(request)).items).toEqual([]);
  const kept = await (await request.get(`/api/lists/${list.list.id}`)).json();
  expect(titlesOf(kept.list.items)).toEqual(["Alien"]);
  expect((await (await request.get("/api/log-entries")).json()).logEntries).toEqual([logEntry]);
});

test("taking off a film that isn't on the Backlog is a 404", async ({ request }) => {
  await logInNewUser(request);
  const planned = await plan(request, { mediaItemId: (await alien(request)).id });
  const neverPlanned = await aliens(request);
  expect((await request.delete(`/api/backlog/items/${planned.mediaItem.id}`)).status()).toBe(204);

  for (const id of [planned.mediaItem.id, neverPlanned.id, 2_000_000_000]) {
    const response = await request.delete(`/api/backlog/items/${id}`);
    expect(response.status(), `taking off ${id}`).toBe(404);
    expect(await response.json()).toEqual({ error: "unknown_list_item" });
  }
});

test("taking off a Media Item id that isn't a positive integer is a 400", async ({ request }) => {
  await logInNewUser(request);

  const response = await request.delete("/api/backlog/items/nope");

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid_request" });
});

test("taking a film off never touches another User's Backlog", async ({ request, playwright }) => {
  await logInNewUser(request);
  const mediaItemId = (await alien(request)).id;
  await plan(request, { mediaItemId });
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  const theirs = await plan(other, { mediaItemId });

  expect((await request.delete(`/api/backlog/items/${mediaItemId}`)).status()).toBe(204);
  // Now only the other User has it, and that doesn't count as this User's.
  expect((await request.delete(`/api/backlog/items/${mediaItemId}`)).status()).toBe(404);

  expect((await theBacklog(other)).items).toEqual([theirs]);
  expect((await theBacklog(request)).items).toEqual([]);
  await other.dispose();
});

test("at 1,000 films the Backlog is full, until the User removes one", async ({ request }) => {
  const user = await logInNewUser(request);
  await fillBacklog(request, user, 999);
  const thousandth = await plan(request, { mediaItemId: (await alien(request)).id });
  const aliensItem = await aliens(request);

  const full = await request.post("/api/backlog/items", { data: { mediaItemId: aliensItem.id } });

  expect(full.status()).toBe(409);
  expect(await full.json()).toEqual({ error: "backlog_full" });
  expect(thousandth.position).toBe(999);
  // A film already there is still there.
  const again = await request.post("/api/backlog/items", {
    data: { mediaItemId: thousandth.mediaItem.id },
  });
  expect(again.status()).toBe(200);
  expect((await request.delete(`/api/list-items/${thousandth.id}`)).status()).toBe(204);
  expect((await plan(request, { mediaItemId: aliensItem.id })).position).toBe(999);
});

test("search marks the results already in the User's own Backlog", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  expect((await searchResult(request, "alien", "348")).inBacklog).toBe(false);

  const planned = await plan(request, { mediaItemId: (await alien(request)).id });

  expect((await searchResult(request, "alien", "348")).inBacklog).toBe(true);
  expect((await searchResult(request, "чужий", "348")).inBacklog).toBe(true);
  expect((await searchResult(request, "aliens", "679")).inBacklog).toBe(false);
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  expect((await searchResult(other, "alien", "348")).inBacklog).toBe(false);
  await other.dispose();
  await request.delete(`/api/list-items/${planned.id}`);
  expect((await searchResult(request, "alien", "348")).inBacklog).toBe(false);
});

test("without a session, the Backlog and its items are a 401", async ({ request }) => {
  expect((await request.get("/api/backlog", { params: { mediaType: "film" } })).status()).toBe(401);
  expect((await request.post("/api/backlog/items", { data: {} })).status()).toBe(401);
  expect((await request.delete("/api/backlog/items/1")).status()).toBe(401);
  expect((await request.patch("/api/list-items/1", { data: {} })).status()).toBe(401);
  expect((await request.delete("/api/list-items/1")).status()).toBe(401);
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("the Backlog loads in the same number of queries for 1 film as for 1,000", async ({
  request,
  playwright,
}) => {
  const queriesForBacklogOf = async (api: APIRequestContext, films: number) => {
    await fillBacklog(api, await logInNewUser(api), films);
    const response = await api.get("/api/backlog", { params: { mediaType: "film" } });
    expect(await response.json()).toMatchObject({ backlog: { items: { length: films } } });
    return response.headers()["x-d1-query-count"];
  };
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });

  const one = await queriesForBacklogOf(request, 1);
  const thousand = await queriesForBacklogOf(other, 1000);
  await other.dispose();

  expect(one).toMatch(/^\d+$/);
  expect(thousand).toBe(one);
});
