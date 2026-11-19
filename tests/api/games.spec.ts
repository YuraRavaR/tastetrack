import {
  BacklogResponse,
  CatalogSearchResponse,
  InProgressResponse,
  ItemHistoryResponse,
  LibraryResponse,
  ListItemResponse,
  type ManualMediaItemEditRequest,
  ManualMediaItemResponse,
  MediaItemResponse,
  NewInProgressResponse,
  NewLogEntryResponse,
  SharedListResponse,
  ThoughtResponse,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { test as base, expect } from "../support/fixtures";
import { alien } from "../support/scenarios/films";
import {
  callsRealIgdb,
  finalFantasy7,
  finalFantasy7Cancelled,
  finalFantasy7Famicom,
  finalFantasy7Id,
  finalFantasy7International,
  finalFantasy7Port,
  gameReference,
  gameSearchResult,
  gameSearchResults,
  igdbImage,
  manualGame,
  spiritGlaiveId,
  stalker,
  stalkerId,
  witcher3,
  witcher3Id,
} from "../support/scenarios/games";
import { testHooksHeaders } from "../support/test-hooks-secret";

// Locally the Worker calls an IGDB fake with fixed data; on staging, the real IGDB. So these tests
// use only the games the fake mirrors, and skip what only the fake can promise.

// `visitor` is a client with no session, holding nothing but a Share Link.
const test = base.extend<{ visitor: ApiClient }>({
  visitor: async ({ createApiClient }, use) => {
    await use(await createApiClient());
  },
});

// How many tokens the IGDB fake has granted.
async function tokensGranted(client: ApiClient): Promise<number> {
  return (await expectBody(client.testHooks.getIgdbFakeTokens())).granted;
}

test("searching games finds a game once, without its DLC, expansions, editions, bundles, updates or mods", async ({
  loggedInApi,
}) => {
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "game", query: "witcher 3" });

  const { results } = await expectBody(search, 200, CatalogSearchResponse);

  expect(results.map((result) => result.externalReference)).toEqual([gameReference(witcher3Id)]);
  expect(results[0]).toMatchObject({
    title: "The Witcher 3: Wild Hunt",
    originalTitle: "The Witcher 3: Wild Hunt",
    year: 2015,
    posterUrl: igdbImage("cover_big", "coaarl"),
    titleLanguage: "en",
    authors: [],
    platforms: ["Series X|S", "PS4", "Switch 2", "PC", "PS5", "XONE", "Switch"],
  });
});

test("of the games with one title, search shows the games of their own, not an edition, a port or a cancelled one", async ({
  loggedInApi,
}) => {
  const results = await gameSearchResults(loggedInApi, "final fantasy vii");

  const ids = results.map((result: { externalReference: { id: string } }) => {
    return result.externalReference.id;
  });
  expect(ids).toEqual(expect.arrayContaining([finalFantasy7Id, finalFantasy7Famicom]));
  for (const hidden of [finalFantasy7International, finalFantasy7Port, finalFantasy7Cancelled]) {
    expect(ids).not.toContain(hidden);
  }
  const famicom = results.find((r: { externalReference: { id: string } }) => {
    return r.externalReference.id === finalFantasy7Famicom;
  });
  expect(famicom).toMatchObject({ title: "Final Fantasy VII", year: 2005, platforms: ["famicom"] });
});

test("a Cyrillic query finds a game by its Russian name, titled in English, and none by a Ukrainian one", async ({
  loggedInApi,
}) => {
  const result = await gameSearchResult(loggedInApi, "сталкер", stalkerId);

  expect(result).toMatchObject({
    title: "S.T.A.L.K.E.R.: Shadow of Chernobyl",
    originalTitle: "S.T.A.L.K.E.R.: Shadow of Chernobyl",
    year: 2007,
    titleLanguage: "en",
  });
  expect(await gameSearchResults(loggedInApi, "відьмак")).toEqual([]);
});

test("a game without a cover has none in search, and none once added", async ({ loggedInApi }) => {
  const result = await gameSearchResult(loggedInApi, "spirit glaive", spiritGlaiveId);
  expect(result).toMatchObject({ posterUrl: null, year: 2017, platforms: ["PC"] });

  const added = await loggedInApi.catalog.addCatalogItem(result);

  expect([200, 201]).toContain(added.status());
  expect((await added.json()).mediaItem.metadata).toMatchObject({
    title: "Spirit Glaive",
    coverUrls: null,
    backdropUrls: null,
    developer: "AdamKruschwitz",
  });
});

test("a game search finds no films, and a film search no games", async ({ loggedInApi }) => {
  const films = await expectBody(
    loggedInApi.catalog.searchCatalog({ mediaType: "film", query: "witcher" }),
  );

  for (const r of films.results) expect(r.externalReference.mediaType).toBe("film");
  for (const r of films.results) expect(r).not.toHaveProperty("platforms");
  for (const r of await gameSearchResults(loggedInApi, "witcher")) {
    expect(r.externalReference).toMatchObject({ source: "igdb", mediaType: "game" });
  }
});

// The Witcher 3 and Final Fantasy VII are taken out of the cache by these tests alone, and used
// from the catalog by this file's tests alone, which run one after another. Out of the cache,
// adding them makes the details call, whatever earlier runs left in local D1.
test("adding a game stores its title, year, developer, platforms, genres, summary, IGDB page and banner", async ({
  loggedInApi,
}) => {
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(gameReference(witcher3Id));
  expect(evicted.status()).toBe(204);
  const result = await gameSearchResult(loggedInApi, "witcher 3", witcher3Id);

  const added = await loggedInApi.catalog.addCatalogItem(result);

  expect([200, 201]).toContain(added.status());
  const { mediaItem } = MediaItemResponse.parse(await added.json());
  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "game",
    externalReference: gameReference(witcher3Id),
    metadata: {
      title: "The Witcher 3: Wild Hunt",
      originalTitle: "The Witcher 3: Wild Hunt",
      ukrainianTitle: null,
      year: 2015,
      coverUrls: {
        small: igdbImage("cover_big", "coaarl"),
        large: igdbImage("cover_big_2x", "coaarl"),
      },
      backdropUrls: { small: igdbImage("720p", "ar6ijr"), large: igdbImage("1080p", "ar6ijr") },
      developer: "CD Projekt RED",
      platforms: ["Series X|S", "PS4", "Switch 2", "PC", "PS5", "XONE", "Switch"],
      genres: ["Role-playing (RPG)", "Adventure"],
      url: "https://www.igdb.com/games/the-witcher-3-wild-hunt",
    },
  });
  const page = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect((await expectBody(page, 200, ItemHistoryResponse)).about).toEqual({
    mediaType: "game",
    summary: expect.stringMatching(/^The Witcher 3: Wild Hunt is an open-world action/),
    genres: ["Role-playing (RPG)", "Adventure"],
  });
});

test("a game with no artworks or screenshots has no banner, and its developer is the one IGDB credits as such", async ({
  loggedInApi,
}) => {
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(gameReference(finalFantasy7Id));
  expect(evicted.status()).toBe(204);

  const { metadata } = await finalFantasy7(loggedInApi);

  expect(metadata).toMatchObject({
    title: "Final Fantasy VII",
    year: 1997,
    coverUrls: { large: igdbImage("cover_big_2x", "cobny6") },
    backdropUrls: null,
    developer: "Square Product Development Division 1",
    platforms: ["PS1"],
  });
});

test("adding the same game again finds its Media Item", async ({ loggedInApi }) => {
  const first = await stalker(loggedInApi);
  const result = await gameSearchResult(loggedInApi, "stalker", stalkerId);

  expect(result.mediaItemId).toBe(first.id);
  const { mediaItem } = await expectBody(loggedInApi.catalog.addCatalogItem(result), 200);
  expect(mediaItem).toEqual(first);
  expect(mediaItem.metadata.developer).toBe("GSC Game World");
});

test("a game is added only under IGDB, with an IGDB id", async ({ loggedInApi }) => {
  const result = await gameSearchResult(loggedInApi, "stalker", stalkerId);

  for (const externalReference of [
    { source: "tmdb", mediaType: "game", id: stalkerId },
    { source: "igdb", mediaType: "game", id: "OL2094429W" },
    { source: "igdb", mediaType: "film", id: stalkerId },
  ]) {
    const response = await loggedInApi.catalog.addCatalogItem({
      ...result,
      externalReference,
    } as never);
    expect(response.status(), JSON.stringify(externalReference)).toBe(400);
  }
});

test("when IGDB fails, searching games is a 502", async ({ loggedInApi }) => {
  test.skip(callsRealIgdb(), "Only the IGDB fake can be made to fail");

  const search = loggedInApi.catalog.searchCatalog({
    mediaType: "game",
    query: "igdb fake failure",
  });

  expect(await expectBody(search, 502)).toEqual({ error: "catalog_unavailable" });
});

test("without the Twitch secrets, game search and add are a 502, and films still work", async ({
  loggedInApi,
}) => {
  test.skip(callsRealIgdb(), "Only a local Worker can be run without its secrets");
  const result = await gameSearchResult(loggedInApi, "stalker", stalkerId);
  const withoutTwitch = {
    headers: {
      ...testHooksHeaders(),
      "X-Test-Without-Secrets": "TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET",
    },
  };

  const search = loggedInApi.catalog.searchCatalog(
    { mediaType: "game", query: "stalker" },
    withoutTwitch,
  );
  const added = loggedInApi.catalog.addCatalogItem(result, withoutTwitch);

  expect(await expectBody(search, 502)).toEqual({ error: "catalog_unavailable" });
  expect(await expectBody(added, 502)).toEqual({ error: "catalog_unavailable" });
  const films = loggedInApi.catalog.searchCatalog(
    { mediaType: "film", query: "alien" },
    withoutTwitch,
  );
  expect((await expectBody(films, 200)).results.length).toBeGreaterThan(0);
  const filmAdded = loggedInApi.catalog.addCatalogItem(
    (await expectBody(films)).results[0],
    withoutTwitch,
  );
  expect([200, 201]).toContain((await filmAdded).status());
});

test("the Worker reuses its IGDB token across calls, and gets a new one when IGDB refuses it", async ({
  loggedInApi,
}) => {
  test.skip(callsRealIgdb(), "Only the IGDB fake can be made to refuse a token");
  await gameSearchResults(loggedInApi, "stalker");
  const granted = await tokensGranted(loggedInApi);
  await gameSearchResults(loggedInApi, "witcher 3");
  await gameSearchResult(loggedInApi, "final fantasy vii", finalFantasy7Id);
  expect(await tokensGranted(loggedInApi)).toBe(granted);
  expect((await loggedInApi.testHooks.refuseIgdbFakeTokens()).status()).toBe(204);

  const result = await gameSearchResult(loggedInApi, "stalker", stalkerId);

  expect(result.title).toBe("S.T.A.L.K.E.R.: Shadow of Chernobyl");
  expect(await tokensGranted(loggedInApi)).toBe(granted + 1);
  await gameSearchResults(loggedInApi, "witcher 3");
  expect(await tokensGranted(loggedInApi)).toBe(granted + 1);
});

test("a game marked Planned is in the Backlog and the Library of games, and in no film's", async ({
  loggedInApi,
}) => {
  const mediaItem = await stalker(loggedInApi);
  const film = await alien(loggedInApi);
  const addedAt = minutesAgo(30);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: film.id }), 201);

  const { listItem } = await expectBody(
    loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }, at(addedAt)),
    201,
    ListItemResponse,
  );

  expect(listItem).toEqual({ id: expect.any(Number), mediaItem, position: 0, note: null });
  const { backlog } = await expectBody(
    loggedInApi.backlog.getBacklog({ mediaType: "game" }),
    200,
    BacklogResponse,
  );
  expect(backlog).toEqual({
    id: expect.any(Number),
    mediaType: "game",
    visibility: "private",
    shareLink: null,
    items: [listItem],
  });
  const library = loggedInApi.library.getLibrary({ mediaType: "game" });
  expect((await expectBody(library, 200, LibraryResponse)).items).toEqual([
    { mediaItem, backlog: { addedAt }, inProgress: null, log: null },
  ]);
  const films = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "film" }));
  expect(films.backlog.items.map((item: { mediaItem: unknown }) => item.mediaItem)).toEqual([film]);
  const removed = await loggedInApi.backlog.deleteBacklogItem(mediaItem.id);
  expect(removed.status()).toBe(204);
  const after = await expectBody(loggedInApi.library.getLibrary({ mediaType: "game" }));
  expect(after.items).toEqual([]);
});

test("starting a game takes it off the Backlog, and finishing it records a Log Entry", async ({
  loggedInApi,
}) => {
  const mediaItem = await witcher3(loggedInApi);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }), 201);

  const started = await expectBody(
    loggedInApi.inProgress.start({ mediaItemId: mediaItem.id, startDate: "2026-11-01" }),
    201,
    NewInProgressResponse,
  );

  expect(started).toMatchObject({
    inProgress: { startDate: "2026-11-01" },
    removedFromBacklog: { position: 0, note: null },
  });
  expect(started.inProgress.progress ?? null).toBeNull();
  const { items } = await expectBody(loggedInApi.library.getLibrary({ mediaType: "game" }));
  expect(items).toEqual([{ mediaItem, backlog: null, inProgress: started.inProgress, log: null }]);
  const finished = await expectBody(
    loggedInApi.inProgress.finish(mediaItem.id, { rating: 5, date: "2026-11-15" }),
    201,
    NewLogEntryResponse,
  );
  expect(finished).toMatchObject({
    logEntry: { mediaItem, rating: 5, date: "2026-11-15", revisit: false },
    currentRating: 5,
    logEntryCount: 1,
  });
  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(await expectBody(history, 200, ItemHistoryResponse)).toMatchObject({
    inProgress: null,
    currentRating: 5,
    logEntries: [{ rating: 5 }],
  });
});

test("stopping a game leaves no trace, and a Progress for a game is refused", async ({
  loggedInApi,
}) => {
  const mediaItem = await finalFantasy7(loggedInApi);

  for (const progress of [
    { mediaType: "series", season: 1, episode: 2 },
    { mediaType: "book", page: 12 },
  ] as const) {
    const start = loggedInApi.inProgress.start({ mediaItemId: mediaItem.id, progress });
    expect(await expectBody(start, 400), JSON.stringify(progress)).toEqual({
      error: "progress_mismatch",
    });
  }
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id }), 201);
  const update = loggedInApi.inProgress.update(mediaItem.id, {
    progress: { mediaType: "book", page: 12 },
  });
  expect(await expectBody(update, 400)).toEqual({ error: "progress_mismatch" });
  const dated = loggedInApi.inProgress.update(mediaItem.id, { startDate: "2026-11-02" });
  const { inProgress } = await expectBody(dated, 200, InProgressResponse);
  expect(inProgress.startDate).toBe("2026-11-02");
  expect(inProgress.progress ?? null).toBeNull();

  expect((await loggedInApi.inProgress.stop(mediaItem.id)).status()).toBe(204);

  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(await expectBody(history, 200, ItemHistoryResponse)).toMatchObject({
    inProgress: null,
    logEntries: [],
  });
});

test("a game is logged, logged again as a Replay, and keeps a Thought", async ({ loggedInApi }) => {
  const mediaItem = await stalker(loggedInApi);
  const log = (rating: number, revisit: boolean, time: string) =>
    expectBody(
      loggedInApi.log.createLogEntry({ mediaItemId: mediaItem.id, rating, revisit }, at(time)),
      201,
      NewLogEntryResponse,
    );

  const first = await log(4, false, minutesAgo(20));
  const replay = await log(4.5, true, minutesAgo(10));
  const thought = loggedInApi.thoughts.createThought(mediaItem.id, {
    text: "Played on PC, with the Anomaly mod.",
    date: "2026-11-18",
  });

  expect(first.logEntry).toMatchObject({ mediaItem, revisit: false });
  expect(replay).toMatchObject({
    logEntry: { revisit: true },
    currentRating: 4.5,
    logEntryCount: 2,
  });
  expect((await expectBody(thought, 201, ThoughtResponse)).thought).toMatchObject({
    text: "Played on PC, with the Anomaly mod.",
    progress: null,
    state: "experienced",
  });
  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItem.id));
  expect(history.logEntries.map((entry: { revisit: boolean }) => entry.revisit)).toEqual([
    false,
    true,
  ]);
  expect(history.thoughts).toHaveLength(1);
});

test("a List of games holds games and refuses a film, and a List of films refuses a game", async ({
  loggedInApi,
}) => {
  const game = await witcher3(loggedInApi);
  const film = await alien(loggedInApi);
  const createList = async (name: string, mediaType: "film" | "game") => {
    return (await expectBody(loggedInApi.lists.createList({ name, mediaType }), 201)).list;
  };
  const games = await createList("Open worlds", "game");
  const films = await createList("Fantasy films", "film");

  const added = loggedInApi.lists.addListItem(games.id, {
    mediaItemId: game.id,
    note: "Play Hearts of Stone too.",
  });

  expect((await expectBody(added, 201)).listItem).toEqual({
    id: expect.any(Number),
    mediaItem: game,
    position: 0,
    note: "Play Hearts of Stone too.",
  });
  const filmInGames = loggedInApi.lists.addListItem(games.id, { mediaItemId: film.id });
  expect(await expectBody(filmInGames, 400)).toEqual({ error: "wrong_media_type" });
  const gameInFilms = loggedInApi.lists.addListItem(films.id, { mediaItemId: game.id });
  expect(await expectBody(gameInFilms, 400)).toEqual({ error: "wrong_media_type" });
  const { list } = await expectBody(loggedInApi.lists.getList(games.id));
  expect(list).toMatchObject({ mediaType: "game", items: [{ mediaItem: game }] });
});

test("a List can't be named Backlog, the games' Backlog's name", async ({ loggedInApi }) => {
  const created = loggedInApi.lists.createList({ name: "backlog", mediaType: "film" });

  expect(await expectBody(created, 400)).toEqual({ error: "list_name_reserved" });
});

test("anyone with the link sees a List of games: covers, titles, years and Notes", async ({
  loggedInApi,
  loggedInUser,
  visitor,
}) => {
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Zone and the Path", mediaType: "game" }),
    201,
  );
  const [first, second] = [await stalker(loggedInApi), await witcher3(loggedInApi)];
  await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: first.id, note: "Start here." }),
    201,
  );
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: second.id }), 201);
  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: first.id, rating: 5 }), 201);
  const { shareLink } = await expectBody(loggedInApi.lists.createShareLink(list.id), 201);

  const { sharedList } = await expectBody(
    visitor.sharedLists.getSharedList(shareLink.token),
    200,
    SharedListResponse,
  );

  expect(sharedList).toEqual({
    title: "Zone and the Path",
    description: null,
    mediaType: "game",
    owner: { displayName: loggedInUser.username },
    items: [
      { mediaItem: first, position: 0, note: "Start here." },
      { mediaItem: second, position: 1, note: null },
    ],
  });
  expect(sharedList.items[0]?.mediaItem.metadata).toMatchObject({
    title: "S.T.A.L.K.E.R.: Shadow of Chernobyl",
    year: 2007,
    coverUrls: { large: igdbImage("cover_big_2x", "coa4s4") },
  });
});

// A User made by code from before games had a Backlog, such as the Operator CLI run from an older
// checkout, has none, as every User made before this release does.
test("a User with no Backlog of games yet can still mark their first game Planned", async ({
  loggedInApi,
  loggedInUser,
}) => {
  const mediaItem = await stalker(loggedInApi);
  const removed = await loggedInApi.testHooks.removeBacklog(loggedInUser.username, "game");
  expect(removed.status()).toBe(204);

  const planned = loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id });

  expect((await expectBody(planned, 201, ListItemResponse)).listItem.mediaItem).toEqual(mediaItem);
  const { backlog } = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "game" }));
  expect(backlog).toMatchObject({ mediaType: "game", visibility: "private" });
  expect(backlog.items.map((item: { mediaItem: unknown }) => item.mediaItem)).toEqual([mediaItem]);
});

test("a User adds a game by hand with a title, an Original Title and a year", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const created = loggedInApi.catalog.addManualMediaItem({
    mediaType: "game",
    title: " Козаки: Європейські війни ",
    originalTitle: "Cossacks: European Wars",
    year: 2001,
  });

  const { mediaItem } = await expectBody(created, 201, MediaItemResponse);

  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "game",
    externalReference: null,
    metadata: {
      title: "Козаки: Європейські війни",
      originalTitle: "Cossacks: European Wars",
      ukrainianTitle: null,
      year: 2001,
      coverUrls: null,
      backdropUrls: null,
      developer: null,
      platforms: [],
      genres: [],
      url: null,
    },
  });
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "game", query: "козаки" });
  expect((await expectBody(search)).manualResults).toEqual([
    {
      mediaItem,
      inLog: false,
      inBacklog: false,
      currentRating: null,
      logEntryCount: 0,
      lists: [],
    },
  ]);
  const films = loggedInApi.catalog.searchCatalog({ mediaType: "film", query: "козаки" });
  expect((await expectBody(films)).manualResults).toEqual([]);
  const theirs = otherUserClient.catalog.getMediaItemHistory(mediaItem.id);
  expect((await theirs).status()).toBe(404);
});

test("a manual game with the title and year of another of the User's games is a possible duplicate", async ({
  loggedInApi,
}) => {
  await manualGame(loggedInApi, { title: "Козаки", year: 2001 });
  const post = (mediaType: "film" | "game", title: string, year: number) => {
    return loggedInApi.catalog.addManualMediaItem({ mediaType, title, year });
  };

  const again = post("game", " козаки ", 2001);

  expect(await expectBody(again, 409)).toEqual({ error: "possible_duplicate" });
  // A film of that title and year, or the game in another year, is another work.
  expect((await post("film", "Козаки", 2001)).status()).toBe(201);
  expect((await post("game", "Козаки", 2005)).status()).toBe(201);
  const anyway = loggedInApi.catalog.addManualMediaItem({
    mediaType: "game",
    title: "Козаки",
    year: 2001,
    allowDuplicate: true,
  });
  expect((await anyway).status()).toBe(201);
});

test("a manual game takes no film's or book's details, and no year before films", async ({
  loggedInApi,
}) => {
  for (const details of [{ runtime: 45 }, { genres: ["Drama"] }, { authors: ["Me"] }]) {
    const created = loggedInApi.catalog.addManualMediaItem({
      mediaType: "game",
      title: "Home game",
      ...details,
    } as never);
    expect((await created).status(), JSON.stringify(details)).toBe(400);
  }
  const ancient = loggedInApi.catalog.addManualMediaItem({
    mediaType: "game",
    title: "Home game",
    year: 1700,
  });
  expect((await ancient).status()).toBe(400);
  const mediaItem = await manualGame(loggedInApi, { title: "Home game" });
  for (const changes of [
    { runtime: 45 },
    { genres: ["Drama"] },
    { authors: ["Me"] },
    { year: 1700 },
  ]) {
    const patch = loggedInApi.catalog.updateManualMediaItem(mediaItem.id, changes as never);
    expect(await expectBody(patch, 400), JSON.stringify(changes)).toEqual({
      error: "invalid_request",
    });
  }
});

test("the User edits a manual game, and deleting it deletes their Log Entries for it", async ({
  loggedInApi,
}) => {
  const mediaItem = await manualGame(loggedInApi, { title: "Cossacks", year: 2000 });
  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: mediaItem.id, rating: 4 }), 201);
  const patch = (changes: ManualMediaItemEditRequest) => {
    return loggedInApi.catalog.updateManualMediaItem(mediaItem.id, changes);
  };

  const edited = await expectBody(
    patch({ title: "Козаки", originalTitle: "Cossacks: European Wars", year: 2001 }),
    200,
    MediaItemResponse,
  );

  expect(edited.mediaItem.metadata).toMatchObject({
    title: "Козаки",
    originalTitle: "Cossacks: European Wars",
    year: 2001,
  });
  const manual = loggedInApi.catalog.getManualMediaItem(mediaItem.id);
  expect(await expectBody(manual, 200, ManualMediaItemResponse)).toEqual({
    mediaItem: edited.mediaItem,
    usage: { logEntries: 1, listItems: 0 },
  });
  expect((await loggedInApi.catalog.deleteManualMediaItem(mediaItem.id)).status()).toBe(204);
  const gone = await loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(gone.status()).toBe(404);
  const { items } = await expectBody(loggedInApi.library.getLibrary({ mediaType: "game" }));
  expect(items).toEqual([]);
});
