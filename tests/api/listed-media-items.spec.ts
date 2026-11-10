import { ListedMediaItemsResponse } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";
import { alien, aliens } from "../support/scenarios/films";
import { createUser } from "../support/scenarios/users";

// The films on the User's own Lists, as Search's "In your Saved" reads them.
async function theListedFilms(api: ApiClient) {
  const listed = api.lists.getListedMediaItems({ mediaType: "film" });
  return (await expectBody(listed, 200, ListedMediaItemsResponse)).items;
}

async function createList(api: ApiClient, name: string) {
  return (await expectBody(api.lists.createList({ name, mediaType: "film" }), 201)).list;
}

async function addToList(api: ApiClient, listId: number, mediaItemId: number) {
  await expectBody(api.lists.addListItem(listId, { mediaItemId }), 201);
}

test("a new User has no films on Lists", async ({ loggedInApi }) => {
  const listed = loggedInApi.lists.getListedMediaItems({ mediaType: "film" });

  expect(await expectBody(listed, 200, ListedMediaItemsResponse)).toEqual({ items: [] });
});

test("a film on two Lists comes once, with both Lists oldest first", async ({ loggedInApi }) => {
  const mediaItem = await alien(loggedInApi);
  const horror = await createList(loggedInApi, "Horror nights");
  const scifi = await createList(loggedInApi, "Sci-fi");
  await addToList(loggedInApi, scifi.id, mediaItem.id);
  await addToList(loggedInApi, horror.id, mediaItem.id);

  expect(await theListedFilms(loggedInApi)).toEqual([
    {
      mediaItem,
      lists: [
        { id: horror.id, name: "Horror nights" },
        { id: scifi.id, name: "Sci-fi" },
      ],
    },
  ]);
});

test("a film only on the Backlog isn't on a List", async ({ loggedInApi }) => {
  const mediaItem = await alien(loggedInApi);

  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }), 201);

  expect(await theListedFilms(loggedInApi)).toEqual([]);
});

test("another User's Lists never appear", async ({ loggedInApi, otherUserClient }) => {
  const mine = await alien(loggedInApi);
  const theirs = await aliens(otherUserClient);
  const myList = await createList(loggedInApi, "Horror nights");
  const theirList = await createList(otherUserClient, "Horror nights");
  await addToList(loggedInApi, myList.id, mine.id);
  await addToList(otherUserClient, theirList.id, theirs.id);
  // The same film on both Users' Lists: each sees only their own List holding it.
  await addToList(otherUserClient, theirList.id, mine.id);

  expect(await theListedFilms(loggedInApi)).toEqual([
    { mediaItem: mine, lists: [{ id: myList.id, name: "Horror nights" }] },
  ]);
});

test("the films on Lists of an unknown Media Type are a 400", async ({ loggedInApi }) => {
  const refused = loggedInApi.lists.getListedMediaItems({ mediaType: "series" as never });

  expect(await expectBody(refused, 400)).toEqual({ error: "invalid_request" });
});

test("without a session, the films on Lists are a 401", async ({ api }) => {
  expect((await api.lists.getListedMediaItems({ mediaType: "film" })).status()).toBe(401);
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("the films on Lists load in the same number of queries for 1 film as for 1,000", async ({
  api,
  createApiClient,
}) => {
  const queriesForListedFilmsOf = async (client: ApiClient, films: number) => {
    const user = await createUser();
    await expectBody(client.auth.login(user));
    const list = await createList(client, `${films} films`);
    expect((await client.testHooks.fillList(list.id, films)).status()).toBe(204);
    const response = await client.lists.getListedMediaItems({ mediaType: "film" });
    expect(await response.json()).toMatchObject({ items: { length: films } });
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForListedFilmsOf(api, 1);
  const thousand = await queriesForListedFilmsOf(await createApiClient(), 1000);

  expect(one).toMatch(/^\d+$/);
  expect(thousand).toBe(one);
});
