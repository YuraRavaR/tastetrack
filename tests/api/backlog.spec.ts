import { BacklogResponse, ListItemResponse, type PlanRequest } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";
import { alien, aliens, amelie, searchResult, titlesOf } from "../support/scenarios/films";
import { createUser } from "../support/scenarios/users";

async function theBacklog(api: ApiClient) {
  return (await expectBody(api.backlog.getBacklog({ mediaType: "film" }))).backlog;
}

async function theLog(api: ApiClient) {
  return (await expectBody(api.log.getLogEntries())).logEntries;
}

test("a new User has an empty, private film Backlog from registration", async ({ loggedInApi }) => {
  const backlog = loggedInApi.backlog.getBacklog({ mediaType: "film" });
  expect((await expectBody(backlog, 200, BacklogResponse)).backlog).toEqual({
    id: expect.any(Number),
    mediaType: "film",
    visibility: "private",
    shareLink: null,
    items: [],
  });
});

// Marks a Media Item Planned: its List Item in the Backlog.
async function plan(api: ApiClient, data: PlanRequest) {
  return (await expectBody(api.backlog.addBacklogItem(data), 201)).listItem;
}

test("marking a film Planned adds it to the Backlog, without a Log Entry", async ({
  loggedInApi,
}) => {
  const mediaItem = await alien(loggedInApi);

  const { listItem } = await expectBody(
    loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }),
    201,
    ListItemResponse,
  );

  expect(listItem).toEqual({ id: expect.any(Number), mediaItem, position: 0, note: null });
  expect((await theBacklog(loggedInApi)).items).toEqual([listItem]);
  expect(await theLog(loggedInApi)).toEqual([]);
});

test("films join the Backlog at the end, and planning one again keeps its place", async ({
  loggedInApi,
}) => {
  const first = await plan(loggedInApi, { mediaItemId: (await alien(loggedInApi)).id });
  const second = await plan(loggedInApi, { mediaItemId: (await aliens(loggedInApi)).id });

  const again = await expectBody(
    loggedInApi.backlog.addBacklogItem({ mediaItemId: first.mediaItem.id }),
  );

  expect(again.listItem).toEqual(first);
  expect(second.position).toBe(1);
  expect((await theBacklog(loggedInApi)).items).toEqual([first, second]);
});

test("planning an unknown Media Item is a 400", async ({ loggedInApi }) => {
  const refused = await expectBody(
    loggedInApi.backlog.addBacklogItem({ mediaItemId: 2_000_000_000 }),
    400,
  );

  expect(refused).toEqual({ error: "unknown_media_item" });
});

async function backlogTitles(api: ApiClient) {
  return titlesOf((await theBacklog(api)).items);
}

test("the User reorders the Backlog by hand", async ({ loggedInApi }) => {
  await plan(loggedInApi, { mediaItemId: (await alien(loggedInApi)).id });
  await plan(loggedInApi, { mediaItemId: (await aliens(loggedInApi)).id });
  const third = await plan(loggedInApi, { mediaItemId: (await amelie(loggedInApi)).id });

  const moved = await expectBody(
    loggedInApi.listItems.updateListItem(third.id, { position: 0 }),
    200,
    ListItemResponse,
  );

  expect(moved.listItem).toEqual({ ...third, position: 0 });
  expect(await backlogTitles(loggedInApi)).toEqual(["Amélie", "Alien", "Aliens"]);
  await expectBody(loggedInApi.listItems.updateListItem(third.id, { position: 1 }));
  expect(await backlogTitles(loggedInApi)).toEqual(["Alien", "Amélie", "Aliens"]);
  // Past the end is last.
  const last = await expectBody(loggedInApi.listItems.updateListItem(third.id, { position: 99 }));
  expect(last.listItem.position).toBe(2);
  expect(await backlogTitles(loggedInApi)).toEqual(["Alien", "Aliens", "Amélie"]);
});

test("the User adds a Note to a Backlog item, changes it and clears it", async ({
  loggedInApi,
}) => {
  const planned = await plan(loggedInApi, { mediaItemId: (await alien(loggedInApi)).id });

  const noted = await expectBody(
    loggedInApi.listItems.updateListItem(planned.id, { note: "  Olena's favourite.  " }),
  );

  expect(noted.listItem).toEqual({ ...planned, note: "Olena's favourite." });
  expect((await theBacklog(loggedInApi)).items).toEqual([noted.listItem]);
  // An empty Note is none, and moving an item keeps its Note.
  const moved = await expectBody(loggedInApi.listItems.updateListItem(planned.id, { position: 0 }));
  expect(moved).toEqual(noted);
  const blank = await expectBody(loggedInApi.listItems.updateListItem(planned.id, { note: "  " }));
  expect(blank.listItem.note).toBeNull();
  await expectBody(loggedInApi.listItems.updateListItem(planned.id, { note: "Again." }));
  const cleared = await expectBody(
    loggedInApi.listItems.updateListItem(planned.id, { note: null }),
  );
  expect(cleared.listItem.note).toBeNull();
  const tooLong = await expectBody(
    loggedInApi.listItems.updateListItem(planned.id, { note: "x".repeat(1001) }),
    400,
  );
  expect(tooLong).toEqual({ error: "invalid_request" });
});

async function logFilm(api: ApiClient, mediaItemId: number) {
  return expectBody(api.log.createLogEntry({ mediaItemId, rating: 4 }), 201);
}

test("logging a film takes it off the Backlog, and planning it back where it was undoes that", async ({
  loggedInApi,
}) => {
  await plan(loggedInApi, { mediaItemId: (await alien(loggedInApi)).id });
  const noted = await plan(loggedInApi, {
    mediaItemId: (await aliens(loggedInApi)).id,
    note: "Olena's favourite.",
  });
  await plan(loggedInApi, { mediaItemId: (await amelie(loggedInApi)).id });

  const logged = await logFilm(loggedInApi, noted.mediaItem.id);

  expect(logged.removedFromBacklog).toEqual({ position: 1, note: "Olena's favourite." });
  expect(await backlogTitles(loggedInApi)).toEqual(["Alien", "Amélie"]);
  const undone = await plan(loggedInApi, {
    mediaItemId: noted.mediaItem.id,
    ...logged.removedFromBacklog,
  });
  expect(undone).toEqual({ ...noted, id: expect.any(Number) });
  expect(await backlogTitles(loggedInApi)).toEqual(["Alien", "Aliens", "Amélie"]);
});

test("logging a film that isn't in the Backlog takes nothing off it", async ({ loggedInApi }) => {
  const planned = await plan(loggedInApi, { mediaItemId: (await alien(loggedInApi)).id });

  const logged = await logFilm(loggedInApi, (await aliens(loggedInApi)).id);

  expect(logged.removedFromBacklog).toBeNull();
  expect((await theBacklog(loggedInApi)).items).toEqual([planned]);
});

test("a film already experienced can be planned again, and keeps its Log", async ({
  loggedInApi,
}) => {
  const mediaItem = await alien(loggedInApi);
  const { logEntry } = await logFilm(loggedInApi, mediaItem.id);

  const planned = await plan(loggedInApi, { mediaItemId: mediaItem.id });

  expect((await theBacklog(loggedInApi)).items).toEqual([planned]);
  expect(await theLog(loggedInApi)).toEqual([logEntry]);
});

test("deleting a Log Entry leaves the Backlog untouched", async ({ loggedInApi }) => {
  // Logging takes Alien off the Backlog; deleting the entry doesn't bring it back.
  const alienItem = await alien(loggedInApi);
  await plan(loggedInApi, { mediaItemId: alienItem.id });
  const alienEntry = (await logFilm(loggedInApi, alienItem.id)).logEntry;
  // Aliens was planned again after logging; deleting the entry doesn't take it off.
  const aliensItem = await aliens(loggedInApi);
  const aliensEntry = (await logFilm(loggedInApi, aliensItem.id)).logEntry;
  const replanned = await plan(loggedInApi, { mediaItemId: aliensItem.id });

  for (const { id } of [alienEntry, aliensEntry]) {
    expect((await loggedInApi.log.deleteLogEntry(id)).status()).toBe(204);
  }

  expect((await theBacklog(loggedInApi)).items).toEqual([replanned]);
});

test("the User removes a film from the Backlog, and the rest keep their order", async ({
  loggedInApi,
}) => {
  const first = await plan(loggedInApi, { mediaItemId: (await alien(loggedInApi)).id });
  const second = await plan(loggedInApi, { mediaItemId: (await aliens(loggedInApi)).id });
  const third = await plan(loggedInApi, { mediaItemId: (await amelie(loggedInApi)).id });

  const response = await loggedInApi.listItems.deleteListItem(second.id);

  expect(response.status()).toBe(204);
  expect((await theBacklog(loggedInApi)).items).toEqual([first, { ...third, position: 1 }]);
  // Moving still counts places among the items left.
  const moved = await expectBody(loggedInApi.listItems.updateListItem(third.id, { position: 0 }));
  expect(moved.listItem.position).toBe(0);
  expect(await backlogTitles(loggedInApi)).toEqual(["Amélie", "Alien"]);
});

test("another User's Backlog item, or one already removed, can be neither edited nor removed", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const mediaItemId = (await alien(loggedInApi)).id;
  const mine = await plan(loggedInApi, { mediaItemId });
  const theirs = await plan(otherUserClient, { mediaItemId });
  expect((await loggedInApi.listItems.deleteListItem(mine.id)).status()).toBe(204);

  for (const id of [theirs.id, mine.id, 2_000_000_000]) {
    const edited = loggedInApi.listItems.updateListItem(id, { note: "Mine now." });
    expect(await expectBody(edited, 404)).toEqual({ error: "unknown_list_item" });
    const removed = loggedInApi.listItems.deleteListItem(id);
    expect(await expectBody(removed, 404)).toEqual({ error: "unknown_list_item" });
  }
  expect((await theBacklog(otherUserClient)).items).toEqual([theirs]);
  expect((await theBacklog(loggedInApi)).items).toEqual([]);
});

test("the User takes a film off the Backlog by its Media Item, and the rest keep their order", async ({
  loggedInApi,
}) => {
  const first = await plan(loggedInApi, { mediaItemId: (await alien(loggedInApi)).id });
  const second = await plan(loggedInApi, { mediaItemId: (await aliens(loggedInApi)).id });
  const third = await plan(loggedInApi, { mediaItemId: (await amelie(loggedInApi)).id });

  const response = await loggedInApi.backlog.deleteBacklogItem(second.mediaItem.id);

  expect(response.status()).toBe(204);
  expect((await theBacklog(loggedInApi)).items).toEqual([first, { ...third, position: 1 }]);
});

test("taking a film off keeps it on the User's Lists and in their Log", async ({ loggedInApi }) => {
  const mediaItem = await alien(loggedInApi);
  const { logEntry } = await logFilm(loggedInApi, mediaItem.id);
  await plan(loggedInApi, { mediaItemId: mediaItem.id });
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Horror", mediaType: "film" }),
    201,
  );
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: mediaItem.id }), 201);

  const response = await loggedInApi.backlog.deleteBacklogItem(mediaItem.id);

  expect(response.status()).toBe(204);
  expect((await theBacklog(loggedInApi)).items).toEqual([]);
  const kept = await expectBody(loggedInApi.lists.getList(list.id));
  expect(titlesOf(kept.list.items)).toEqual(["Alien"]);
  expect(await theLog(loggedInApi)).toEqual([logEntry]);
});

test("taking off a film that isn't on the Backlog is a 404", async ({ loggedInApi }) => {
  const planned = await plan(loggedInApi, { mediaItemId: (await alien(loggedInApi)).id });
  const neverPlanned = await aliens(loggedInApi);
  expect((await loggedInApi.backlog.deleteBacklogItem(planned.mediaItem.id)).status()).toBe(204);

  for (const id of [planned.mediaItem.id, neverPlanned.id, 2_000_000_000]) {
    const response = loggedInApi.backlog.deleteBacklogItem(id);
    expect(await expectBody(response, 404)).toEqual({ error: "unknown_list_item" });
  }
});

test("taking off a Media Item id that isn't a positive integer is a 400", async ({
  loggedInApi,
}) => {
  const refused = await expectBody(loggedInApi.backlog.deleteBacklogItem("nope" as never), 400);

  expect(refused).toEqual({ error: "invalid_request" });
});

test("taking a film off never touches another User's Backlog", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const mediaItemId = (await alien(loggedInApi)).id;
  await plan(loggedInApi, { mediaItemId });
  const theirs = await plan(otherUserClient, { mediaItemId });

  expect((await loggedInApi.backlog.deleteBacklogItem(mediaItemId)).status()).toBe(204);
  // Now only the other User has it, and that doesn't count as this User's.
  expect((await loggedInApi.backlog.deleteBacklogItem(mediaItemId)).status()).toBe(404);

  expect((await theBacklog(otherUserClient)).items).toEqual([theirs]);
  expect((await theBacklog(loggedInApi)).items).toEqual([]);
});

test("at 1,000 films the Backlog is full, until the User removes one", async ({
  api,
  loggedInUser,
}) => {
  expect((await api.testHooks.fillBacklog(loggedInUser.username, 999)).status()).toBe(204);
  const thousandth = await plan(api, { mediaItemId: (await alien(api)).id });
  const aliensItem = await aliens(api);

  const full = await expectBody(api.backlog.addBacklogItem({ mediaItemId: aliensItem.id }), 409);

  expect(full).toEqual({ error: "backlog_full" });
  expect(thousandth.position).toBe(999);
  // A film already there is still there.
  await expectBody(api.backlog.addBacklogItem({ mediaItemId: thousandth.mediaItem.id }));
  expect((await api.listItems.deleteListItem(thousandth.id)).status()).toBe(204);
  expect((await plan(api, { mediaItemId: aliensItem.id })).position).toBe(999);
});

test("search marks the results already in the User's own Backlog", async ({
  loggedInApi,
  otherUserClient,
}) => {
  expect((await searchResult(loggedInApi, "alien", "348")).inBacklog).toBe(false);

  const planned = await plan(loggedInApi, { mediaItemId: (await alien(loggedInApi)).id });

  expect((await searchResult(loggedInApi, "alien", "348")).inBacklog).toBe(true);
  expect((await searchResult(loggedInApi, "чужий", "348")).inBacklog).toBe(true);
  expect((await searchResult(loggedInApi, "aliens", "679")).inBacklog).toBe(false);
  expect((await searchResult(otherUserClient, "alien", "348")).inBacklog).toBe(false);
  await loggedInApi.listItems.deleteListItem(planned.id);
  expect((await searchResult(loggedInApi, "alien", "348")).inBacklog).toBe(false);
});

test("without a session, the Backlog and its items are a 401", async ({ api }) => {
  expect((await api.backlog.getBacklog({ mediaType: "film" })).status()).toBe(401);
  expect((await api.backlog.addBacklogItem({} as never)).status()).toBe(401);
  expect((await api.backlog.deleteBacklogItem(1)).status()).toBe(401);
  expect((await api.listItems.updateListItem(1, {})).status()).toBe(401);
  expect((await api.listItems.deleteListItem(1)).status()).toBe(401);
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds.
test("the Backlog loads in the same number of queries for 1 film as for 1,000", async ({
  api,
  createApiClient,
}) => {
  const queriesForBacklogOf = async (client: ApiClient, films: number) => {
    const user = await createUser();
    await expectBody(client.auth.login(user));
    expect((await client.testHooks.fillBacklog(user.username, films)).status()).toBe(204);
    const response = await client.backlog.getBacklog({ mediaType: "film" });
    expect(await response.json()).toMatchObject({ backlog: { items: { length: films } } });
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForBacklogOf(api, 1);
  const thousand = await queriesForBacklogOf(await createApiClient(), 1000);

  expect(one).toMatch(/^\d+$/);
  expect(thousand).toBe(one);
});
