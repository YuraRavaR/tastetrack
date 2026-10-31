import { type APIRequestContext, expect, test } from "@playwright/test";
import { alien, aliens, amelie, titlesOf } from "../support/films";
import { createList, fillList } from "../support/lists";
import { logInNewUser } from "../support/users";

// Adds a Media Item to a List: its new List Item.
async function addToList(request: APIRequestContext, listId: number, data: object) {
  const response = await request.post(`/api/lists/${listId}/items`, { data });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).listItem;
}

async function patchListItem(request: APIRequestContext, id: number, data: object) {
  const response = await request.patch(`/api/list-items/${id}`, { data });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).listItem;
}

async function theList(request: APIRequestContext, id: number) {
  const response = await request.get(`/api/lists/${id}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).list;
}

test("a User creates a film List with a name and a description, private and empty", async ({
  request,
}) => {
  await logInNewUser(request);

  const response = await request.post("/api/lists", {
    data: { name: "  Horror nights ", description: " For October. ", mediaType: "film" },
  });

  expect(response.status()).toBe(201);
  const { list } = await response.json();
  expect(list).toEqual({
    id: expect.any(Number),
    name: "Horror nights",
    description: "For October.",
    mediaType: "film",
    visibility: "private",
    itemCount: 0,
  });
  expect(await theList(request, list.id)).toEqual({
    id: list.id,
    name: "Horror nights",
    description: "For October.",
    mediaType: "film",
    visibility: "private",
    shareLink: null,
    items: [],
  });
  const lists = await (await request.get("/api/lists")).json();
  expect(lists).toEqual({ lists: [list] });
});

test("the description is optional, and an empty one is none", async ({ request }) => {
  await logInNewUser(request);

  const withoutOne = await createList(request, { name: "Horror" });
  const emptyOne = await createList(request, { name: "Comedy", description: "  " });

  expect(withoutOne.description).toBeNull();
  expect(emptyOne.description).toBeNull();
});

test("a User's List names are unique regardless of case, but not across Users", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const horror = await createList(request, { name: "Жахи" });

  for (const name of ["Жахи", "  жахи ", "ЖАХИ"]) {
    const response = await request.post("/api/lists", { data: { name, mediaType: "film" } });
    expect(response.status(), name).toBe(409);
    expect(await response.json()).toEqual({ error: "list_name_taken" });
  }

  expect((await (await request.get("/api/lists")).json()).lists).toEqual([horror]);
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  expect((await createList(other, { name: "Жахи" })).name).toBe("Жахи");
  await other.dispose();
});

test('reserved names such as "Watchlist" are refused', async ({ request }) => {
  await logInNewUser(request);

  for (const name of ["Watchlist", "watchlist", " WATCHLIST "]) {
    const response = await request.post("/api/lists", { data: { name, mediaType: "film" } });
    expect(response.status(), name).toBe(400);
    expect(await response.json()).toEqual({ error: "list_name_reserved" });
  }

  expect((await createList(request, { name: "My Watchlist" })).name).toBe("My Watchlist");
});

test("a List needs a name of up to 100 characters, a known Media Type and a short description", async ({
  request,
}) => {
  await logInNewUser(request);

  for (const data of [
    { mediaType: "film" },
    { name: "   ", mediaType: "film" },
    { name: "x".repeat(101), mediaType: "film" },
    { name: "Horror" },
    { name: "Horror", mediaType: "book" },
    { name: "Horror", mediaType: "film", description: "x".repeat(1001) },
  ]) {
    const response = await request.post("/api/lists", { data });
    expect(response.status(), JSON.stringify(data)).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }

  expect((await createList(request, { name: "x".repeat(100) })).name).toHaveLength(100);
  expect((await (await request.get("/api/lists")).json()).lists).toHaveLength(1);
});

test("at 100 Lists the User can make no more, and the Backlog doesn't count", async ({
  request,
}) => {
  await logInNewUser(request);
  await Promise.all(
    Array.from({ length: 100 }, (_, i) => createList(request, { name: `List ${i + 1}` })),
  );

  const response = await request.post("/api/lists", {
    data: { name: "One too many", mediaType: "film" },
  });

  expect(response.status()).toBe(409);
  expect(await response.json()).toEqual({ error: "too_many_lists" });
  expect((await (await request.get("/api/lists")).json()).lists).toHaveLength(100);
  // A taken name is still that, whatever the count.
  const taken = await request.post("/api/lists", { data: { name: "list 1", mediaType: "film" } });
  expect(await taken.json()).toEqual({ error: "list_name_taken" });
});

test("films join a List at the end, and the User reorders and notes them", async ({ request }) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Space" });
  const first = await addToList(request, list.id, { mediaItemId: (await alien(request)).id });
  const second = await addToList(request, list.id, {
    mediaItemId: (await aliens(request)).id,
    note: "  The sequel. ",
  });
  const third = await addToList(request, list.id, { mediaItemId: (await amelie(request)).id });

  expect(first).toEqual({
    id: expect.any(Number),
    mediaItem: expect.objectContaining({ id: expect.any(Number) }),
    position: 0,
    note: null,
  });
  expect(second).toMatchObject({ position: 1, note: "The sequel." });
  expect((await theList(request, list.id)).items).toEqual([first, second, third]);
  expect((await (await request.get("/api/lists")).json()).lists).toEqual([
    { ...list, itemCount: 3 },
  ]);

  await patchListItem(request, third.id, { position: 0 });
  const noted = await patchListItem(request, first.id, { note: "Watch first." });

  expect(noted.note).toBe("Watch first.");
  expect(titlesOf((await theList(request, list.id)).items)).toEqual(["Amélie", "Alien", "Aliens"]);
});

test("adding a film already in the List is refused, and it keeps its place", async ({
  request,
}) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Space" });
  const mediaItemId = (await alien(request)).id;
  const added = await addToList(request, list.id, { mediaItemId, note: "Mine." });

  const again = await request.post(`/api/lists/${list.id}/items`, {
    data: { mediaItemId, note: "Replaced?" },
  });

  expect(again.status()).toBe(409);
  expect(await again.json()).toEqual({ error: "already_in_list" });
  expect((await theList(request, list.id)).items).toEqual([added]);
});

test("the same film can be in several Lists and the Backlog at once", async ({ request }) => {
  await logInNewUser(request);
  const mediaItemId = (await alien(request)).id;
  const space = await createList(request, { name: "Space" });
  const horror = await createList(request, { name: "Horror" });
  const planned = await request.post("/api/backlog/items", { data: { mediaItemId } });
  expect(planned.status()).toBe(201);

  await addToList(request, space.id, { mediaItemId });
  await addToList(request, horror.id, { mediaItemId });

  expect((await theList(request, space.id)).items).toHaveLength(1);
  expect((await theList(request, horror.id)).items).toHaveLength(1);
  const { backlog } = await (await request.get("/api/backlog?mediaType=film")).json();
  expect(backlog.items).toHaveLength(1);
});

test("adding an unknown Media Item is a 400", async ({ request }) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Space" });

  const response = await request.post(`/api/lists/${list.id}/items`, {
    data: { mediaItemId: 2_000_000_000 },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "unknown_media_item" });
});

test("at 1,000 films a List is full, until the User removes one", async ({ request }) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Everything" });
  await fillList(request, list.id, 999);
  const thousandth = await addToList(request, list.id, { mediaItemId: (await alien(request)).id });
  const aliensItem = await aliens(request);

  const full = await request.post(`/api/lists/${list.id}/items`, {
    data: { mediaItemId: aliensItem.id },
  });

  expect(full.status()).toBe(409);
  expect(await full.json()).toEqual({ error: "list_full" });
  expect(thousandth.position).toBe(999);
  // A film already there is refused for that, not for the limit.
  const again = await request.post(`/api/lists/${list.id}/items`, {
    data: { mediaItemId: thousandth.mediaItem.id },
  });
  expect(await again.json()).toEqual({ error: "already_in_list" });
  expect((await request.delete(`/api/list-items/${thousandth.id}`)).status()).toBe(204);
  expect((await addToList(request, list.id, { mediaItemId: aliensItem.id })).position).toBe(999);
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("a List loads in the same number of queries for 1 film as for 1,000", async ({ request }) => {
  await logInNewUser(request);
  const queriesForListOf = async (films: number) => {
    const list = await createList(request, { name: `${films} films` });
    await fillList(request, list.id, films);
    const response = await request.get(`/api/lists/${list.id}`);
    expect(await response.json()).toMatchObject({ list: { items: { length: films } } });
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForListOf(1);
  const thousand = await queriesForListOf(1000);

  expect(one).toMatch(/^\d+$/);
  expect(thousand).toBe(one);
});

test("the Lists page loads in the same number of queries for 1 List as for 100", async ({
  request,
  playwright,
}) => {
  const queriesForListsOf = async (api: APIRequestContext, count: number) => {
    await logInNewUser(api);
    const lists = await Promise.all(
      Array.from({ length: count }, (_, i) => createList(api, { name: `List ${i + 1}` })),
    );
    await Promise.all(lists.map((list) => fillList(api, list.id, 3)));
    const response = await api.get("/api/lists");
    const body = await response.json();
    expect(body.lists).toHaveLength(count);
    expect(body.lists.every((list: { itemCount: number }) => list.itemCount === 3)).toBe(true);
    return response.headers()["x-d1-query-count"];
  };
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });

  const one = await queriesForListsOf(request, 1);
  const hundred = await queriesForListsOf(other, 100);
  await other.dispose();

  expect(one).toMatch(/^\d+$/);
  expect(hundred).toBe(one);
});

// The User's film Lists as the picker on a film sees them: each with the film's List Item, or null.
async function listsOf(request: APIRequestContext, mediaItemId: number) {
  const response = await request.get(`/api/catalog/items/${mediaItemId}/lists`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).lists;
}

test("a film's Lists say which hold it, where, and with what Note", async ({ request }) => {
  await logInNewUser(request);
  const mediaItemId = (await alien(request)).id;
  const space = await createList(request, { name: "Space" });
  const horror = await createList(request, { name: "Horror" });
  const comfort = await createList(request, { name: "Comfort" });
  await addToList(request, horror.id, { mediaItemId: (await aliens(request)).id });
  const held = await addToList(request, horror.id, { mediaItemId, note: "Olena's favourite." });

  expect(await listsOf(request, mediaItemId)).toEqual([
    { ...space, listItem: null },
    {
      ...horror,
      itemCount: 2,
      listItem: { id: held.id, position: 1, note: "Olena's favourite." },
    },
    { ...comfort, listItem: null },
  ]);
});

test("a film's Lists leave out the Backlog and other Users' Lists", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const mediaItemId = (await alien(request)).id;
  const planned = await request.post("/api/backlog/items", { data: { mediaItemId } });
  expect(planned.status()).toBe(201);
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  await addToList(other, (await createList(other, { name: "Theirs" })).id, { mediaItemId });
  await other.dispose();

  expect(await listsOf(request, mediaItemId)).toEqual([]);
});

test("the Lists of an unknown Media Item are a 404", async ({ request }) => {
  await logInNewUser(request);

  const response = await request.get("/api/catalog/items/2000000000/lists");

  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: "unknown_media_item" });
});

test("a film's Lists load in the same number of queries for 1 List as for 100", async ({
  request,
  playwright,
}) => {
  const queriesForListsOf = async (api: APIRequestContext, count: number) => {
    await logInNewUser(api);
    const mediaItemId = (await alien(api)).id;
    const lists = await Promise.all(
      Array.from({ length: count }, (_, i) => createList(api, { name: `List ${i + 1}` })),
    );
    await Promise.all(lists.map((list) => addToList(api, list.id, { mediaItemId })));
    const response = await api.get(`/api/catalog/items/${mediaItemId}/lists`);
    const body = await response.json();
    expect(body.lists).toHaveLength(count);
    expect(body.lists.every((list: { listItem: unknown }) => list.listItem !== null)).toBe(true);
    return response.headers()["x-d1-query-count"];
  };
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });

  const one = await queriesForListsOf(request, 1);
  const hundred = await queriesForListsOf(other, 100);
  await other.dispose();

  expect(one).toMatch(/^\d+$/);
  expect(hundred).toBe(one);
});

async function logFilm(request: APIRequestContext, mediaItemId: number) {
  const response = await request.post("/api/log-entries", { data: { mediaItemId, rating: 4 } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).logEntry;
}

async function theLog(request: APIRequestContext) {
  return (await (await request.get("/api/log-entries")).json()).logEntries;
}

test("removing a List Item or deleting a List leaves the Log untouched", async ({ request }) => {
  await logInNewUser(request);
  const alienItem = await alien(request);
  const aliensItem = await aliens(request);
  const logEntries = [await logFilm(request, alienItem.id), await logFilm(request, aliensItem.id)];
  const list = await createList(request, { name: "Space" });
  const first = await addToList(request, list.id, { mediaItemId: alienItem.id });
  const second = await addToList(request, list.id, { mediaItemId: aliensItem.id });

  expect((await request.delete(`/api/list-items/${first.id}`)).status()).toBe(204);
  expect((await theList(request, list.id)).items).toEqual([{ ...second, position: 0 }]);
  const deleted = await request.delete(`/api/lists/${list.id}`);

  expect(deleted.status()).toBe(204);
  expect((await request.get(`/api/lists/${list.id}`)).status()).toBe(404);
  expect((await (await request.get("/api/lists")).json()).lists).toEqual([]);
  expect(await theLog(request)).toEqual(logEntries);
  // Its items went with it.
  const edited = await request.patch(`/api/list-items/${second.id}`, { data: { note: "Gone?" } });
  expect(edited.status()).toBe(404);
});

test("deleting a List frees its name and its place among the 100", async ({ request }) => {
  await logInNewUser(request);
  const lists = await Promise.all(
    Array.from({ length: 100 }, (_, i) => createList(request, { name: `List ${i + 1}` })),
  );

  expect((await request.delete(`/api/lists/${lists[0].id}`)).status()).toBe(204);

  expect((await createList(request, { name: "list 1" })).name).toBe("list 1");
});

test("the User renames a List and changes its description, within the same name rules", async ({
  request,
}) => {
  await logInNewUser(request);
  const list = await createList(request, { name: "Space", description: "Films in space." });
  await createList(request, { name: "Horror" });
  const patch = (data: object) => request.patch(`/api/lists/${list.id}`, { data });

  const renamed = await patch({ name: " Space horror " });

  expect(renamed.status()).toBe(200);
  expect((await renamed.json()).list).toEqual({ ...list, name: "Space horror" });
  // Only the case changes: it is still its own name.
  expect((await (await patch({ name: "SPACE HORROR" })).json()).list.name).toBe("SPACE HORROR");
  const described = await patch({ description: "  " });
  expect((await described.json()).list).toMatchObject({ name: "SPACE HORROR", description: null });
  const taken = await patch({ name: "horror" });
  expect(taken.status()).toBe(409);
  expect(await taken.json()).toEqual({ error: "list_name_taken" });
  const reserved = await patch({ name: "Watchlist" });
  expect(reserved.status()).toBe(400);
  expect(await reserved.json()).toEqual({ error: "list_name_reserved" });
  for (const data of [{ name: "  " }, { mediaType: "film" }, { visibility: "link" }]) {
    const refused = await patch(data);
    expect(refused.status(), JSON.stringify(data)).toBe(400);
    expect(await refused.json()).toEqual({ error: "invalid_request" });
  }
  expect(await theList(request, list.id)).toMatchObject({
    name: "SPACE HORROR",
    description: null,
    mediaType: "film",
    visibility: "private",
  });
});

test("another User's List, the Backlog, or a deleted List can't be read, changed or added to", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const mediaItemId = (await alien(request)).id;
  const { backlog } = await (await request.get("/api/backlog?mediaType=film")).json();
  const deleted = await createList(request, { name: "Gone" });
  expect((await request.delete(`/api/lists/${deleted.id}`)).status()).toBe(204);
  const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(other);
  const theirs = await createList(other, { name: "Theirs" });

  for (const id of [theirs.id, backlog.id, deleted.id, 2_000_000_000]) {
    for (const response of [
      await request.get(`/api/lists/${id}`),
      await request.patch(`/api/lists/${id}`, { data: { name: "Mine now" } }),
      await request.delete(`/api/lists/${id}`),
      await request.post(`/api/lists/${id}/items`, { data: { mediaItemId } }),
    ]) {
      expect(response.status(), `${response.url()} for List ${id}`).toBe(404);
      expect(await response.json()).toEqual({ error: "unknown_list" });
    }
  }
  expect(await theList(other, theirs.id)).toMatchObject({ name: "Theirs", items: [] });
  await other.dispose();
});

test("without a session, Lists are a 401", async ({ request }) => {
  for (const response of [
    await request.get("/api/lists"),
    await request.post("/api/lists", { data: {} }),
    await request.get("/api/lists/1"),
    await request.patch("/api/lists/1", { data: {} }),
    await request.delete("/api/lists/1"),
    await request.post("/api/lists/1/items", { data: {} }),
    await request.get("/api/catalog/items/1/lists"),
  ]) {
    expect(response.status(), response.url()).toBe(401);
  }
});
