import {
  type ManualMediaItemEditRequest,
  ManualMediaItemResponse,
  MediaItemResponse,
  type NewManualMediaItemRequest,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import type { RequestOptions } from "../support/api/controllers/BaseController";
import { expectBody } from "../support/api/responses";
import { at } from "../support/clock";
import { expect, test } from "../support/fixtures";
import { alien } from "../support/scenarios/films";
import { createUser } from "../support/scenarios/users";

// Makes a film Manual Media Item: the Media Item, as the Worker answers.
async function createManual(api: ApiClient, data: Omit<NewManualMediaItemRequest, "mediaType">) {
  const created = api.catalog.addManualMediaItem({ mediaType: "film", ...data });
  return (await expectBody(created, 201)).mediaItem;
}

test("a User adds a film by hand, with its Original Title, year, runtime and genres", async ({
  loggedInApi,
}) => {
  const { mediaItem } = await expectBody(
    loggedInApi.catalog.addManualMediaItem({
      mediaType: "film",
      title: "  Тіні забутих предків ",
      originalTitle: " Shadows of Forgotten Ancestors ",
      year: 1965,
      runtime: 97,
      genres: ["Drama", "Romance"],
    }),
    201,
    MediaItemResponse,
  );

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
      backdropUrls: null,
      runtime: 97,
      genres: ["Drama", "Romance"],
    },
  });
  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItem.id));
  expect(history.mediaItem).toEqual(mediaItem);
});

test("only a title is needed, and the Original Title is then the title", async ({
  loggedInApi,
}) => {
  const mediaItem = await createManual(loggedInApi, { title: "Home movie", originalTitle: "  " });

  expect(mediaItem.metadata).toEqual({
    title: "Home movie",
    originalTitle: "Home movie",
    ukrainianTitle: null,
    year: null,
    posterUrl: null,
    backdropUrls: null,
    runtime: null,
    genres: [],
  });
});

test("implausible values are refused: a title of 1–200 characters, a year from 1888 to five years on, a runtime of 1–1000 minutes, TMDB's genres once each", async ({
  loggedInApi,
}) => {
  // The latest year is five years on, in UTC: 2030.
  const clock = at("2025-12-31T23:30:00Z");

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
    const response = await loggedInApi.catalog.addManualMediaItem(
      { mediaType: "film", ...data } as never,
      clock,
    );
    expect(response.status(), JSON.stringify(data)).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }

  for (const data of [
    { title: "x".repeat(200), originalTitle: "y".repeat(200) },
    { title: "Roundhay Garden Scene", year: 1888, runtime: 1 },
    { title: "Announced", year: 2030, runtime: 1000 },
  ]) {
    const response = await loggedInApi.catalog.addManualMediaItem(
      { mediaType: "film", ...data },
      clock,
    );
    expect(response.status(), JSON.stringify(data)).toBe(201);
  }
});

test("the same title and year as another of the User's is refused as a possible duplicate, unless allowed", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const first = await createManual(loggedInApi, { title: "Тіні забутих предків", year: 1965 });
  const post = (data: Omit<NewManualMediaItemRequest, "mediaType">) => {
    return loggedInApi.catalog.addManualMediaItem({ mediaType: "film", ...data });
  };

  const again = await expectBody(post({ title: " ТІНІ ЗАБУТИХ ПРЕДКІВ ", year: 1965 }), 409);

  expect(again).toEqual({ error: "possible_duplicate" });
  const allowed = await expectBody(
    post({ title: "Тіні забутих предків", year: 1965, allowDuplicate: true }),
    201,
  );
  expect(allowed.mediaItem.id).not.toBe(first.id);
  // Another year, or none, is another film.
  expect((await post({ title: "Тіні забутих предків", year: 2025 })).status()).toBe(201);
  expect((await post({ title: "Тіні забутих предків" })).status()).toBe(201);
  expect((await post({ title: "Тіні забутих предків" })).status()).toBe(409);
  // Another User's films don't count.
  expect(
    (await createManual(otherUserClient, { title: "Тіні забутих предків", year: 1965 })).id,
  ).toEqual(expect.any(Number));
});

test("at 1,000 Manual Media Items the User can add no more", async ({ api, loggedInUser }) => {
  const filled = await api.testHooks.fillManualMediaItems(loggedInUser.username, 999);
  expect(filled.status()).toBe(204);
  const thousandth = await createManual(api, { title: "The thousandth" });

  const refused = await expectBody(
    api.catalog.addManualMediaItem({ mediaType: "film", title: "One too many" }),
    409,
  );

  expect(refused).toEqual({ error: "too_many_manual_media_items" });
  // At the limit, a duplicate is refused for the limit.
  const again = await api.catalog.addManualMediaItem({
    mediaType: "film",
    title: "The thousandth",
    allowDuplicate: true,
  });
  expect(await again.json()).toEqual({ error: "too_many_manual_media_items" });
  // Deleting one makes room.
  expect((await api.catalog.deleteManualMediaItem(thousandth.id)).status()).toBe(204);
  expect((await createManual(api, { title: "One too many" })).id).toEqual(expect.any(Number));
});

test("a Manual Media Item is logged, planned and added to Lists like any film", async ({
  loggedInApi,
}) => {
  const mediaItem = await createManual(loggedInApi, { title: "Home movie", year: 2019 });
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Family", mediaType: "film" }),
    201,
  );

  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }), 201);
  const added = await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: mediaItem.id }),
    201,
  );
  const logged = await expectBody(
    loggedInApi.log.createLogEntry({ mediaItemId: mediaItem.id, rating: 4.5 }),
    201,
  );

  expect(added.listItem.mediaItem).toEqual(mediaItem);
  expect(logged).toMatchObject({
    logEntry: { mediaItem, rating: 4.5 },
    removedFromBacklog: { position: 0, note: null },
  });
  const { logEntries } = await expectBody(loggedInApi.log.getLogEntries());
  expect(logEntries.map((entry: { mediaItem: object }) => entry.mediaItem)).toEqual([mediaItem]);
  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItem.id));
  expect(history).toMatchObject({ mediaItem, currentRating: 4.5 });
  const theList = await expectBody(loggedInApi.lists.getList(list.id));
  expect(theList.list.items).toEqual([expect.objectContaining({ mediaItem })]);
});

test("another User's Manual Media Item is unknown: no Item History, and it can't be logged, planned or listed", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Mine", mediaType: "film" }),
    201,
  );
  const theirs = await createManual(otherUserClient, { title: "Their home movie" });
  const mediaItemId = theirs.id;

  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItemId), 404);
  expect(history).toEqual({ error: "unknown_media_item" });
  for (const response of [
    await loggedInApi.log.createLogEntry({ mediaItemId, rating: 3 }),
    await loggedInApi.backlog.addBacklogItem({ mediaItemId }),
    await loggedInApi.lists.addListItem(list.id, { mediaItemId }),
  ]) {
    expect(response.status(), response.url()).toBe(400);
    expect(await response.json()).toEqual({ error: "unknown_media_item" });
  }
  expect((await expectBody(loggedInApi.log.getLogEntries())).logEntries).toEqual([]);
  const { backlog } = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "film" }));
  expect(backlog.items).toEqual([]);
  // Its owner still sees it.
  const own = await expectBody(otherUserClient.catalog.getMediaItemHistory(mediaItemId));
  expect(own.mediaItem).toEqual(theirs);
});

test("the User edits a Manual Media Item, by the same rules, and their Log shows the change", async ({
  loggedInApi,
}) => {
  const mediaItem = await createManual(loggedInApi, {
    title: "Tini zabutykh predkiv",
    originalTitle: "Shadows",
    year: 1964,
    runtime: 90,
    genres: ["Drama"],
  });
  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: mediaItem.id, rating: 5 }), 201);
  const patch = (changes: ManualMediaItemEditRequest, options?: RequestOptions) => {
    return loggedInApi.catalog.updateManualMediaItem(mediaItem.id, changes, options);
  };

  const edited = await expectBody(
    patch({ title: " Тіні забутих предків ", year: 1965, genres: [] }),
    200,
    MediaItemResponse,
  );

  const expected = {
    ...mediaItem,
    metadata: {
      ...mediaItem.metadata,
      title: "Тіні забутих предків",
      year: 1965,
      genres: [],
    },
  };
  expect(edited.mediaItem).toEqual(expected);
  const { logEntries } = await expectBody(loggedInApi.log.getLogEntries());
  expect(logEntries[0].mediaItem).toEqual(expected);
  // A null clears a field, and an empty Original Title counts as none.
  const cleared = await expectBody(patch({ originalTitle: "", year: null, runtime: null }));
  expect(cleared.mediaItem.metadata).toMatchObject({
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
    const refused = await patch(data as never, at("2025-12-31T23:30:00Z"));
    expect(refused.status(), JSON.stringify(data)).toBe(400);
    expect(await refused.json()).toEqual({ error: "invalid_request" });
  }
});

test("only the owner's Manual Media Items can be edited: another User's, or a catalog-backed one, is unknown", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const catalogBacked = await alien(loggedInApi);
  const theirs = await createManual(otherUserClient, { title: "Their home movie" });

  for (const id of [theirs.id, catalogBacked.id, 2_000_000_000]) {
    const response = await loggedInApi.catalog.updateManualMediaItem(id, { title: "Mine now" });
    expect(response.status(), String(id)).toBe(404);
    expect(await response.json()).toEqual({ error: "unknown_media_item" });
  }
  const own = await expectBody(otherUserClient.catalog.getMediaItemHistory(theirs.id));
  expect(own.mediaItem).toEqual(theirs);
});

test("deleting a Manual Media Item says first how many Log Entries and List Items go with it", async ({
  loggedInApi,
}) => {
  const mediaItem = await createManual(loggedInApi, { title: "Home movie" });
  const kept = await alien(loggedInApi);
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Family", mediaType: "film" }),
    201,
  );
  for (const mediaItemId of [mediaItem.id, kept.id]) {
    await expectBody(loggedInApi.log.createLogEntry({ mediaItemId, rating: 4 }), 201);
    await expectBody(loggedInApi.log.createLogEntry({ mediaItemId, rating: 3 }), 201);
    await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId }), 201);
  }
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }), 201);

  const before = await expectBody(
    loggedInApi.catalog.getManualMediaItem(mediaItem.id),
    200,
    ManualMediaItemResponse,
  );

  expect(before).toEqual({ mediaItem, usage: { logEntries: 2, listItems: 2 } });
  expect((await loggedInApi.catalog.deleteManualMediaItem(mediaItem.id)).status()).toBe(204);
  for (const gone of [
    await loggedInApi.catalog.getManualMediaItem(mediaItem.id),
    await loggedInApi.catalog.getMediaItemHistory(mediaItem.id),
    await loggedInApi.catalog.deleteManualMediaItem(mediaItem.id),
  ]) {
    expect(gone.status(), gone.url()).toBe(404);
    expect(await gone.json()).toEqual({ error: "unknown_media_item" });
  }
  const { logEntries } = await expectBody(loggedInApi.log.getLogEntries());
  expect(logEntries.map((entry: { mediaItem: object }) => entry.mediaItem)).toEqual([kept, kept]);
  const theList = await expectBody(loggedInApi.lists.getList(list.id));
  expect(theList.list.items).toEqual([expect.objectContaining({ mediaItem: kept, position: 0 })]);
  const { backlog } = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "film" }));
  expect(backlog.items).toEqual([]);
});

test("another User's Manual Media Item, or a catalog-backed one, can be neither read nor deleted", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const catalogBacked = await alien(loggedInApi);
  const theirs = await createManual(otherUserClient, { title: "Their home movie" });

  for (const id of [theirs.id, catalogBacked.id]) {
    for (const response of [
      await loggedInApi.catalog.getManualMediaItem(id),
      await loggedInApi.catalog.deleteManualMediaItem(id),
    ]) {
      expect(response.status(), `${response.url()}`).toBe(404);
      expect(await response.json()).toEqual({ error: "unknown_media_item" });
    }
  }
  const own = await expectBody(otherUserClient.catalog.getManualMediaItem(theirs.id));
  expect(own.mediaItem).toEqual(theirs);
});

async function search(api: ApiClient, query: string) {
  return expectBody(api.catalog.searchCatalog({ mediaType: "film", query }));
}

test("search lists the User's own matching Manual Media Items first, by either title, in any case, marked if logged or planned", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const homeVideo = await createManual(loggedInApi, {
    title: "Чужий: домашнє відео",
    originalTitle: "Alien home video",
  });
  const sequel = await createManual(loggedInApi, { title: "Чужий 2", year: 2020 });
  await createManual(loggedInApi, { title: "Something else" });
  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: sequel.id, rating: 2 }), 201);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: homeVideo.id }), 201);
  await createManual(otherUserClient, { title: "Чужий у них" });

  const byTitle = await search(loggedInApi, "ЧУЖИЙ");
  const byOriginalTitle = await search(loggedInApi, "home VIDEO");

  expect(byTitle.manualResults).toMatchObject([
    { mediaItem: sequel, inLog: true, inBacklog: false },
    { mediaItem: homeVideo, inLog: false, inBacklog: true },
  ]);
  expect(byTitle.results).toContainEqual(expect.objectContaining({ originalTitle: "Alien" }));
  expect(byOriginalTitle.manualResults).toMatchObject([
    { mediaItem: homeVideo, inLog: false, inBacklog: true },
  ]);
  expect((await search(loggedInApi, "alien")).results).toContainEqual(
    expect.objectContaining({ title: "Alien" }),
  );
});

test("without a session, Manual Media Items are a 401", async ({ api }) => {
  for (const response of [
    await api.catalog.addManualMediaItem({} as never),
    await api.catalog.getManualMediaItem(1),
    await api.catalog.updateManualMediaItem(1, {}),
    await api.catalog.deleteManualMediaItem(1),
  ]) {
    expect(response.status(), response.url()).toBe(401);
  }
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("search takes the same number of queries for 1 matching Manual Media Item as for 25, and lists 20", async ({
  api,
  createApiClient,
}) => {
  const queriesFor = async (client: ApiClient, count: number) => {
    const user = await createUser();
    await expectBody(client.auth.login(user));
    const filled = await client.testHooks.fillManualMediaItems(user.username, count);
    expect(filled.status()).toBe(204);
    const response = await client.catalog.searchCatalog({
      mediaType: "film",
      query: "placeholder",
    });
    const { manualResults } = await response.json();
    expect(manualResults).toHaveLength(Math.min(count, 20));
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesFor(api, 1);
  const many = await queriesFor(await createApiClient(), 25);

  expect(one).toMatch(/^\d+$/);
  expect(many).toBe(one);
});
