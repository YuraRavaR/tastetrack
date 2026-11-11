import {
  type ListEditRequest,
  ListItemResponse,
  ListResponse,
  ListSummaryResponse,
  ListsResponse,
  MediaItemListsResponse,
  type MediaType,
  type NewListItemRequest,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";
import { harryPotter, tyhrolovy } from "../support/scenarios/books";
import { alien, aliens, amelie, manualFilm, titlesOf } from "../support/scenarios/films";

// Makes a List, of films unless it says otherwise: its summary, as the Worker answers.
async function createList(
  api: ApiClient,
  data: { name: string; description?: string; mediaType?: MediaType },
) {
  return (await expectBody(api.lists.createList({ mediaType: "film", ...data }), 201)).list;
}

// Adds a Media Item to a List: its new List Item.
async function addToList(api: ApiClient, listId: number, data: NewListItemRequest) {
  return (await expectBody(api.lists.addListItem(listId, data), 201)).listItem;
}

async function theList(api: ApiClient, id: number) {
  return (await expectBody(api.lists.getList(id))).list;
}

async function theLists(api: ApiClient) {
  return (await expectBody(api.lists.getLists())).lists;
}

test("a User creates a film List with a name and a description, private and empty", async ({
  loggedInApi,
}) => {
  const { list } = await expectBody(
    loggedInApi.lists.createList({
      name: "  Horror nights ",
      description: " For October. ",
      mediaType: "film",
    }),
    201,
    ListSummaryResponse,
  );

  expect(list).toEqual({
    id: expect.any(Number),
    name: "Horror nights",
    description: "For October.",
    mediaType: "film",
    visibility: "private",
    itemCount: 0,
  });
  const created = await expectBody(loggedInApi.lists.getList(list.id), 200, ListResponse);
  expect(created.list).toEqual({
    id: list.id,
    name: "Horror nights",
    description: "For October.",
    mediaType: "film",
    visibility: "private",
    shareLink: null,
    items: [],
  });
  const { lists } = await expectBody(loggedInApi.lists.getLists(), 200, ListsResponse);
  expect(lists).toEqual([{ ...list, covers: [], shared: false }]);
});

test("each List comes with its first four films in order, its count and whether it's shared", async ({
  loggedInApi,
}) => {
  const horror = await createList(loggedInApi, { name: "Horror" });
  const empty = await createList(loggedInApi, { name: "Empty" });
  const films = [];
  for (const title of ["One", "Two", "Three", "Four", "Five"]) {
    const mediaItem = await manualFilm(loggedInApi, { title });
    await addToList(loggedInApi, horror.id, { mediaItemId: mediaItem.id });
    films.push(mediaItem);
  }
  const [one, two, three, , five] = films;
  // Five moves to the top, so it leads the covers and Four drops out of them.
  const fifth = (await theList(loggedInApi, horror.id)).items[4];
  await expectBody(loggedInApi.listItems.updateListItem(fifth.id, { position: 0 }));
  await expectBody(loggedInApi.lists.createShareLink(horror.id), 201);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: one.id }), 201);

  const { lists } = await expectBody(loggedInApi.lists.getLists(), 200, ListsResponse);
  expect(lists).toEqual([
    {
      ...horror,
      visibility: "link",
      itemCount: 5,
      covers: [five, one, two, three],
      shared: true,
    },
    { ...empty, covers: [], shared: false },
  ]);

  // Stopping the Share Link takes the mark off.
  expect((await loggedInApi.lists.revokeShareLink(horror.id)).status()).toBe(204);
  expect((await theLists(loggedInApi))[0]).toMatchObject({ visibility: "private", shared: false });
});

test("the description is optional, and an empty one is none", async ({ loggedInApi }) => {
  const withoutOne = await createList(loggedInApi, { name: "Horror" });
  const emptyOne = await createList(loggedInApi, { name: "Comedy", description: "  " });

  expect(withoutOne.description).toBeNull();
  expect(emptyOne.description).toBeNull();
});

test("a User's List names are unique regardless of case, but not across Users", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const horror = await createList(loggedInApi, { name: "Жахи" });

  for (const name of ["Жахи", "  жахи ", "ЖАХИ"]) {
    const response = await loggedInApi.lists.createList({ name, mediaType: "film" });
    expect(response.status(), name).toBe(409);
    expect(await response.json()).toEqual({ error: "list_name_taken" });
  }

  expect(await theLists(loggedInApi)).toEqual([{ ...horror, covers: [], shared: false }]);
  expect((await createList(otherUserClient, { name: "Жахи" })).name).toBe("Жахи");
});

test('reserved names such as "Watchlist" are refused', async ({ loggedInApi }) => {
  for (const name of ["Watchlist", "watchlist", " WATCHLIST "]) {
    const response = await loggedInApi.lists.createList({ name, mediaType: "film" });
    expect(response.status(), name).toBe(400);
    expect(await response.json()).toEqual({ error: "list_name_reserved" });
  }

  expect((await createList(loggedInApi, { name: "My Watchlist" })).name).toBe("My Watchlist");
});

test("a List needs a name of up to 100 characters, a known Media Type and a short description", async ({
  loggedInApi,
}) => {
  for (const data of [
    { mediaType: "film" },
    { name: "   ", mediaType: "film" },
    { name: "x".repeat(101), mediaType: "film" },
    { name: "Horror" },
    { name: "Horror", mediaType: "series" },
    { name: "Horror", mediaType: "film", description: "x".repeat(1001) },
  ]) {
    const response = await loggedInApi.lists.createList(data as never);
    expect(response.status(), JSON.stringify(data)).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }

  expect((await createList(loggedInApi, { name: "x".repeat(100) })).name).toHaveLength(100);
  expect(await theLists(loggedInApi)).toHaveLength(1);
});

test("at 100 Lists the User can make no more, and the Backlog doesn't count", async ({
  loggedInApi,
}) => {
  await Promise.all(
    Array.from({ length: 100 }, (_, i) => createList(loggedInApi, { name: `List ${i + 1}` })),
  );

  const refused = await expectBody(
    loggedInApi.lists.createList({ name: "One too many", mediaType: "film" }),
    409,
  );

  expect(refused).toEqual({ error: "too_many_lists" });
  expect(await theLists(loggedInApi)).toHaveLength(100);
  // A taken name is still that, whatever the count.
  const taken = await loggedInApi.lists.createList({ name: "list 1", mediaType: "film" });
  expect(await taken.json()).toEqual({ error: "list_name_taken" });
});

test("films join a List at the end, and the User reorders and notes them", async ({
  loggedInApi,
}) => {
  const list = await createList(loggedInApi, { name: "Space" });
  const { listItem: first } = await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: (await alien(loggedInApi)).id }),
    201,
    ListItemResponse,
  );
  const second = await addToList(loggedInApi, list.id, {
    mediaItemId: (await aliens(loggedInApi)).id,
    note: "  The sequel. ",
  });
  const third = await addToList(loggedInApi, list.id, {
    mediaItemId: (await amelie(loggedInApi)).id,
  });

  expect(first).toEqual({
    id: expect.any(Number),
    mediaItem: expect.objectContaining({ id: expect.any(Number) }),
    position: 0,
    note: null,
  });
  expect(second).toMatchObject({ position: 1, note: "The sequel." });
  expect((await theList(loggedInApi, list.id)).items).toEqual([first, second, third]);
  expect(await theLists(loggedInApi)).toEqual([
    {
      ...list,
      itemCount: 3,
      covers: [first, second, third].map(({ mediaItem }) => mediaItem),
      shared: false,
    },
  ]);

  await expectBody(loggedInApi.listItems.updateListItem(third.id, { position: 0 }));
  const noted = await expectBody(
    loggedInApi.listItems.updateListItem(first.id, { note: "Watch first." }),
  );

  expect(noted.listItem.note).toBe("Watch first.");
  expect(titlesOf((await theList(loggedInApi, list.id)).items)).toEqual([
    "Amélie",
    "Alien",
    "Aliens",
  ]);
});

test("adding a film already in the List is refused, and it keeps its place", async ({
  loggedInApi,
}) => {
  const list = await createList(loggedInApi, { name: "Space" });
  const mediaItemId = (await alien(loggedInApi)).id;
  const added = await addToList(loggedInApi, list.id, { mediaItemId, note: "Mine." });

  const again = await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId, note: "Replaced?" }),
    409,
  );

  expect(again).toEqual({ error: "already_in_list" });
  expect((await theList(loggedInApi, list.id)).items).toEqual([added]);
});

test("the same film can be in several Lists and the Backlog at once", async ({ loggedInApi }) => {
  const mediaItemId = (await alien(loggedInApi)).id;
  const space = await createList(loggedInApi, { name: "Space" });
  const horror = await createList(loggedInApi, { name: "Horror" });
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId }), 201);

  await addToList(loggedInApi, space.id, { mediaItemId });
  await addToList(loggedInApi, horror.id, { mediaItemId });

  expect((await theList(loggedInApi, space.id)).items).toHaveLength(1);
  expect((await theList(loggedInApi, horror.id)).items).toHaveLength(1);
  const { backlog } = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "film" }));
  expect(backlog.items).toHaveLength(1);
});

test("a List of books takes only books, and a List of films only films", async ({
  loggedInApi,
}) => {
  const books = await createList(loggedInApi, { name: "To start with", mediaType: "book" });
  const films = await createList(loggedInApi, { name: "Space" });
  const [book, film] = [await tyhrolovy(loggedInApi), await alien(loggedInApi)];

  const filmInBooks = loggedInApi.lists.addListItem(books.id, { mediaItemId: film.id });
  const bookInFilms = loggedInApi.lists.addListItem(films.id, { mediaItemId: book.id });
  const added = await addToList(loggedInApi, books.id, { mediaItemId: book.id });

  expect(await expectBody(filmInBooks, 400)).toEqual({ error: "wrong_media_type" });
  expect(await expectBody(bookInFilms, 400)).toEqual({ error: "wrong_media_type" });
  expect(added).toMatchObject({ mediaItem: { id: book.id, mediaType: "book" }, position: 0 });
  expect((await theList(loggedInApi, films.id)).items).toEqual([]);
});

test("a List of books shows each book's cover, titles and authors, and so does its preview", async ({
  loggedInApi,
}) => {
  const list = await createList(loggedInApi, { name: "Ukrainian prose", mediaType: "book" });
  const [first, second] = [await harryPotter(loggedInApi), await tyhrolovy(loggedInApi)];
  await addToList(loggedInApi, list.id, { mediaItemId: first.id, note: "Start here." });
  await addToList(loggedInApi, list.id, { mediaItemId: second.id });

  const { items } = await theList(loggedInApi, list.id);

  expect(items.map(({ mediaItem }: { mediaItem: unknown }) => mediaItem)).toEqual([first, second]);
  expect(items[0].mediaItem.metadata).toEqual({
    title: "Harry Potter and the Philosopher's Stone",
    originalTitle: "Harry Potter and the Philosopher's Stone",
    ukrainianTitle: "Гаррі Поттер і філософський камінь",
    year: 1997,
    coverUrls: {
      small: "https://covers.openlibrary.org/b/id/15155833-M.jpg",
      large: "https://covers.openlibrary.org/b/id/15155833-L.jpg",
    },
    authors: ["J. K. Rowling"],
  });
  expect(items[0].note).toBe("Start here.");
  expect(await theLists(loggedInApi)).toEqual([
    { ...list, itemCount: 2, covers: [first, second], shared: false },
  ]);
});

test("adding an unknown Media Item is a 400", async ({ loggedInApi }) => {
  const list = await createList(loggedInApi, { name: "Space" });

  const refused = await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: 2_000_000_000 }),
    400,
  );

  expect(refused).toEqual({ error: "unknown_media_item" });
});

test("at 1,000 films a List is full, until the User removes one", async ({ loggedInApi }) => {
  const list = await createList(loggedInApi, { name: "Everything" });
  expect((await loggedInApi.testHooks.fillList(list.id, 999)).status()).toBe(204);
  const thousandth = await addToList(loggedInApi, list.id, {
    mediaItemId: (await alien(loggedInApi)).id,
  });
  const aliensItem = await aliens(loggedInApi);

  const full = await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: aliensItem.id }),
    409,
  );

  expect(full).toEqual({ error: "list_full" });
  expect(thousandth.position).toBe(999);
  // A film already there is refused for that, not for the limit.
  const again = await loggedInApi.lists.addListItem(list.id, {
    mediaItemId: thousandth.mediaItem.id,
  });
  expect(await again.json()).toEqual({ error: "already_in_list" });
  expect((await loggedInApi.listItems.deleteListItem(thousandth.id)).status()).toBe(204);
  const freed = await addToList(loggedInApi, list.id, { mediaItemId: aliensItem.id });
  expect(freed.position).toBe(999);
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("a List loads in the same number of queries for 1 film as for 1,000", async ({
  loggedInApi,
}) => {
  const queriesForListOf = async (films: number) => {
    const list = await createList(loggedInApi, { name: `${films} films` });
    expect((await loggedInApi.testHooks.fillList(list.id, films)).status()).toBe(204);
    const response = await loggedInApi.lists.getList(list.id);
    expect(await response.json()).toMatchObject({ list: { items: { length: films } } });
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForListOf(1);
  const thousand = await queriesForListOf(1000);

  expect(one).toMatch(/^\d+$/);
  expect(thousand).toBe(one);
});

test("a List loads in the same number of queries for 1 book as for 500, on a cold cache", async ({
  loggedInApi,
}) => {
  // The placeholders have no cache entry, so the page fetches what it may from Open Library.
  const queriesForListOf = async (books: number) => {
    const list = await createList(loggedInApi, { name: `${books} books`, mediaType: "book" });
    expect((await loggedInApi.testHooks.fillList(list.id, books)).status()).toBe(204);
    const response = await loggedInApi.lists.getList(list.id);
    expect(await response.json()).toMatchObject({
      list: { mediaType: "book", items: { length: books } },
    });
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForListOf(1);
  const fiveHundred = await queriesForListOf(500);

  expect(one).toMatch(/^\d+$/);
  expect(fiveHundred).toBe(one);
});

test("the Lists page loads in the same number of queries for 1 List as for 100", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const queriesForListsOf = async (api: ApiClient, count: number) => {
    const lists = await Promise.all(
      Array.from({ length: count }, (_, i) => createList(api, { name: `List ${i + 1}` })),
    );
    await Promise.all(lists.map((list) => api.testHooks.fillList(list.id, 3)));
    const response = await api.lists.getLists();
    const body = await response.json();
    expect(body.lists).toHaveLength(count);
    expect(body.lists.every((list: { itemCount: number }) => list.itemCount === 3)).toBe(true);
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForListsOf(loggedInApi, 1);
  const hundred = await queriesForListsOf(otherUserClient, 100);

  expect(one).toMatch(/^\d+$/);
  expect(hundred).toBe(one);
});

// The User's film Lists as the picker on a film sees them: each with the film's List Item, or null.
async function listsOf(api: ApiClient, mediaItemId: number) {
  return (await expectBody(api.catalog.getMediaItemLists(mediaItemId))).lists;
}

test("a film's Lists say which hold it, where, and with what Note", async ({ loggedInApi }) => {
  const mediaItemId = (await alien(loggedInApi)).id;
  const space = await createList(loggedInApi, { name: "Space" });
  const horror = await createList(loggedInApi, { name: "Horror" });
  const comfort = await createList(loggedInApi, { name: "Comfort" });
  await addToList(loggedInApi, horror.id, { mediaItemId: (await aliens(loggedInApi)).id });
  const held = await addToList(loggedInApi, horror.id, { mediaItemId, note: "Olena's favourite." });

  const { lists } = await expectBody(
    loggedInApi.catalog.getMediaItemLists(mediaItemId),
    200,
    MediaItemListsResponse,
  );
  expect(lists).toEqual([
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
  loggedInApi,
  otherUserClient,
}) => {
  const mediaItemId = (await alien(loggedInApi)).id;
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId }), 201);
  await addToList(otherUserClient, (await createList(otherUserClient, { name: "Theirs" })).id, {
    mediaItemId,
  });

  expect(await listsOf(loggedInApi, mediaItemId)).toEqual([]);
});

test("the Lists of an unknown Media Item are a 404", async ({ loggedInApi }) => {
  const refused = await expectBody(loggedInApi.catalog.getMediaItemLists(2_000_000_000), 404);

  expect(refused).toEqual({ error: "unknown_media_item" });
});

test("a film's Lists load in the same number of queries for 1 List as for 100", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const queriesForListsOf = async (api: ApiClient, count: number) => {
    const mediaItemId = (await alien(api)).id;
    const lists = await Promise.all(
      Array.from({ length: count }, (_, i) => createList(api, { name: `List ${i + 1}` })),
    );
    await Promise.all(lists.map((list) => addToList(api, list.id, { mediaItemId })));
    const response = await api.catalog.getMediaItemLists(mediaItemId);
    const body = await response.json();
    expect(body.lists).toHaveLength(count);
    expect(body.lists.every((list: { listItem: unknown }) => list.listItem !== null)).toBe(true);
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForListsOf(loggedInApi, 1);
  const hundred = await queriesForListsOf(otherUserClient, 100);

  expect(one).toMatch(/^\d+$/);
  expect(hundred).toBe(one);
});

async function logFilm(api: ApiClient, mediaItemId: number) {
  return (await expectBody(api.log.createLogEntry({ mediaItemId, rating: 4 }), 201)).logEntry;
}

test("removing a List Item or deleting a List leaves the Log untouched", async ({
  loggedInApi,
}) => {
  const alienItem = await alien(loggedInApi);
  const aliensItem = await aliens(loggedInApi);
  const logEntries = [
    await logFilm(loggedInApi, alienItem.id),
    await logFilm(loggedInApi, aliensItem.id),
  ];
  const list = await createList(loggedInApi, { name: "Space" });
  const first = await addToList(loggedInApi, list.id, { mediaItemId: alienItem.id });
  const second = await addToList(loggedInApi, list.id, { mediaItemId: aliensItem.id });

  expect((await loggedInApi.listItems.deleteListItem(first.id)).status()).toBe(204);
  expect((await theList(loggedInApi, list.id)).items).toEqual([{ ...second, position: 0 }]);
  const deleted = await loggedInApi.lists.deleteList(list.id);

  expect(deleted.status()).toBe(204);
  expect((await loggedInApi.lists.getList(list.id)).status()).toBe(404);
  expect(await theLists(loggedInApi)).toEqual([]);
  expect((await expectBody(loggedInApi.log.getLogEntries())).logEntries).toEqual(logEntries);
  // Its items went with it.
  const edited = await loggedInApi.listItems.updateListItem(second.id, { note: "Gone?" });
  expect(edited.status()).toBe(404);
});

test("deleting a List frees its name and its place among the 100", async ({ loggedInApi }) => {
  const lists = await Promise.all(
    Array.from({ length: 100 }, (_, i) => createList(loggedInApi, { name: `List ${i + 1}` })),
  );

  expect((await loggedInApi.lists.deleteList(lists[0].id)).status()).toBe(204);

  expect((await createList(loggedInApi, { name: "list 1" })).name).toBe("list 1");
});

test("the User renames a List and changes its description, within the same name rules", async ({
  loggedInApi,
}) => {
  const list = await createList(loggedInApi, { name: "Space", description: "Films in space." });
  await createList(loggedInApi, { name: "Horror" });
  const patch = (changes: ListEditRequest) => loggedInApi.lists.updateList(list.id, changes);

  const renamed = await expectBody(patch({ name: " Space horror " }), 200, ListSummaryResponse);

  expect(renamed.list).toEqual({ ...list, name: "Space horror" });
  // Only the case changes: it is still its own name.
  expect((await expectBody(patch({ name: "SPACE HORROR" }))).list.name).toBe("SPACE HORROR");
  const described = await expectBody(patch({ description: "  " }));
  expect(described.list).toMatchObject({ name: "SPACE HORROR", description: null });
  const taken = await expectBody(patch({ name: "horror" }), 409);
  expect(taken).toEqual({ error: "list_name_taken" });
  const reserved = await expectBody(patch({ name: "Watchlist" }), 400);
  expect(reserved).toEqual({ error: "list_name_reserved" });
  for (const data of [{ name: "  " }, { mediaType: "film" }, { visibility: "link" }]) {
    const refused = await patch(data as never);
    expect(refused.status(), JSON.stringify(data)).toBe(400);
    expect(await refused.json()).toEqual({ error: "invalid_request" });
  }
  expect(await theList(loggedInApi, list.id)).toMatchObject({
    name: "SPACE HORROR",
    description: null,
    mediaType: "film",
    visibility: "private",
  });
});

test("another User's List, the Backlog, or a deleted List can't be read, changed or added to", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const mediaItemId = (await alien(loggedInApi)).id;
  const { backlog } = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "film" }));
  const deleted = await createList(loggedInApi, { name: "Gone" });
  expect((await loggedInApi.lists.deleteList(deleted.id)).status()).toBe(204);
  const theirs = await createList(otherUserClient, { name: "Theirs" });

  for (const id of [theirs.id, backlog.id, deleted.id, 2_000_000_000]) {
    for (const response of [
      await loggedInApi.lists.getList(id),
      await loggedInApi.lists.updateList(id, { name: "Mine now" }),
      await loggedInApi.lists.deleteList(id),
      await loggedInApi.lists.addListItem(id, { mediaItemId }),
    ]) {
      expect(response.status(), `${response.url()} for List ${id}`).toBe(404);
      expect(await response.json()).toEqual({ error: "unknown_list" });
    }
  }
  expect(await theList(otherUserClient, theirs.id)).toMatchObject({ name: "Theirs", items: [] });
});

test("without a session, Lists are a 401", async ({ api }) => {
  for (const response of [
    await api.lists.getLists(),
    await api.lists.createList({} as never),
    await api.lists.getList(1),
    await api.lists.updateList(1, {}),
    await api.lists.deleteList(1),
    await api.lists.addListItem(1, {} as never),
    await api.catalog.getMediaItemLists(1),
  ]) {
    expect(response.status(), response.url()).toBe(401);
  }
});
