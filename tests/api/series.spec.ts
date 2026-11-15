import {
  BacklogResponse,
  CatalogSearchResponse,
  ItemHistoryResponse,
  LibraryResponse,
  ListItemResponse,
  type ManualMediaItemEditRequest,
  ManualMediaItemResponse,
  MediaItemResponse,
  type NewLogEntryRequest,
  NewLogEntryResponse,
  SharedListResponse,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { test as base, expect } from "../support/fixtures";
import { alien } from "../support/scenarios/films";
import {
  breakingBad,
  breakingBadId,
  chernobyl,
  chernobylId,
  manualSeries,
  mobLand,
  mobLandId,
  noPosterSeries,
  posterUrl,
  seriesReference,
  seriesSearchResult,
} from "../support/scenarios/series";
import { callsRealTmdb } from "../support/scenarios/tmdb";

// Locally the Worker calls a TMDB fake with fixed data; on staging, the real TMDB. So these tests
// use only the series the fake mirrors, and skip what only the fake can promise.

// `visitor` is a client with no session, holding nothing but a Share Link.
const test = base.extend<{ visitor: ApiClient }>({
  visitor: async ({ createApiClient }, use) => {
    await use(await createApiClient());
  },
});

test("searching series finds them by title, each with its poster and the year it first aired", async ({
  loggedInApi,
}) => {
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "series", query: "chernobyl" });

  const { results } = await expectBody(search, 200, CatalogSearchResponse);

  expect(results.find((r) => r.externalReference.id === chernobylId)).toMatchObject({
    externalReference: seriesReference(chernobylId),
    title: "Chernobyl",
    originalTitle: "Chernobyl",
    year: 2019,
    posterUrl: expect.stringMatching(/^https:\/\/image\.tmdb\.org\/t\/p\/w92\/\w+\.jpg$/),
    titleLanguage: "en",
    authors: [],
  });
});

test("a Cyrillic query finds a series by its Ukrainian title, and titles it in Ukrainian", async ({
  loggedInApi,
}) => {
  const result = await seriesSearchResult(loggedInApi, "Чорнобиль", chernobylId);

  expect(result).toMatchObject({
    title: "Чорнобиль",
    originalTitle: "Chernobyl",
    year: 2019,
    titleLanguage: "uk",
  });
});

test("a series search finds no films, and a film search no series", async ({ loggedInApi }) => {
  const films = loggedInApi.catalog.searchCatalog({ mediaType: "film", query: "chernobyl" });

  const { results } = await expectBody(films);

  expect(
    results.map((r: { externalReference: unknown }) => r.externalReference),
  ).not.toContainEqual(seriesReference(chernobylId));
  for (const r of results) expect(r.externalReference.mediaType).toBe("film");
});

// Breaking Bad and MobLand are taken out of the cache by these tests alone, and used from the
// catalog by this file's tests alone, which run one after another. Out of the cache, adding them
// makes the details call, whatever earlier runs left in local D1.
test("adding a series stores its three titles, its years and status, and its seasons without the specials", async ({
  loggedInApi,
}) => {
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(seriesReference(breakingBadId));
  expect(evicted.status()).toBe(204);
  const result = await seriesSearchResult(loggedInApi, "Пуститися берега", breakingBadId);
  const added = await loggedInApi.catalog.addCatalogItem(result);
  expect([200, 201]).toContain(added.status());

  expect(MediaItemResponse.parse(await added.json()).mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "series",
    externalReference: seriesReference(breakingBadId),
    metadata: {
      title: "Breaking Bad",
      originalTitle: "Breaking Bad",
      ukrainianTitle: "Пуститися берега",
      year: 2008,
      posterUrls: {
        small: posterUrl("/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg", "w92"),
        large: posterUrl("/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg", "w500"),
      },
      backdropUrls: {
        small: "https://image.tmdb.org/t/p/w780/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
        large: "https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
      },
      firstAirYear: 2008,
      lastAirYear: 2013,
      status: "ended",
      seasons: [
        { season: 1, episodeCount: 7 },
        { season: 2, episodeCount: 13 },
        { season: 3, episodeCount: 13 },
        { season: 4, episodeCount: 13 },
        { season: 5, episodeCount: 16 },
      ],
      lastAiredEpisode: { season: 5, episode: 16 },
      nextAirDate: null,
    },
  });
});

test("a running series' last aired episode is the last that has aired, not its season's last, with the next one's date", async ({
  loggedInApi,
}) => {
  test.skip(callsRealTmdb(), "A running series moves on every week on real TMDB");
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(seriesReference(mobLandId));
  expect(evicted.status()).toBe(204);

  const { metadata } = await mobLand(loggedInApi);

  expect(metadata).toMatchObject({
    title: "MobLand",
    ukrainianTitle: "Земля Гангстерів",
    year: 2025,
    firstAirYear: 2025,
    lastAirYear: 2026,
    status: "returning",
    seasons: [
      { season: 1, episodeCount: 10 },
      { season: 2, episodeCount: 10 },
    ],
    lastAiredEpisode: { season: 2, episode: 9 },
    nextAirDate: "2026-11-20",
  });
});

test("a series without a poster has none, and keeps its backdrop", async ({ loggedInApi }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a series without a poster");

  const { metadata } = await noPosterSeries(loggedInApi);

  expect(metadata).toMatchObject({
    title: "TMDB Fake No Poster Series",
    ukrainianTitle: null,
    posterUrls: null,
    backdropUrls: { small: expect.stringContaining("/w780/") },
    status: "canceled",
  });
});

test("adding the same series again finds its Media Item, and its page shows it", async ({
  loggedInApi,
}) => {
  const first = await chernobyl(loggedInApi);
  const result = await seriesSearchResult(loggedInApi, "chernobyl", chernobylId);

  expect(result.mediaItemId).toBe(first.id);
  const { mediaItem } = await expectBody(loggedInApi.catalog.addCatalogItem(result), 200);
  expect(mediaItem).toEqual(first);
  const page = loggedInApi.catalog.getMediaItemHistory(first.id);
  expect(await expectBody(page, 200, ItemHistoryResponse)).toEqual({
    mediaItem: first,
    logEntries: [],
    currentRating: null,
    inBacklog: false,
    inProgress: null,
  });
});

test("a series is added only under TMDB, with a TMDB id", async ({ loggedInApi }) => {
  const result = await seriesSearchResult(loggedInApi, "chernobyl", chernobylId);

  for (const externalReference of [
    { source: "openlibrary", mediaType: "series", id: chernobylId },
    { source: "tmdb", mediaType: "series", id: "OL2094429W" },
  ]) {
    const response = await loggedInApi.catalog.addCatalogItem({
      ...result,
      externalReference,
    } as never);
    expect(response.status(), JSON.stringify(externalReference)).toBe(400);
  }
});

test("a series marked Planned is in the Backlog and the Library of series, and in no film's", async ({
  loggedInApi,
}) => {
  const mediaItem = await chernobyl(loggedInApi);
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
    loggedInApi.backlog.getBacklog({ mediaType: "series" }),
    200,
    BacklogResponse,
  );
  expect(backlog).toEqual({
    id: expect.any(Number),
    mediaType: "series",
    visibility: "private",
    shareLink: null,
    items: [listItem],
  });
  const library = loggedInApi.library.getLibrary({ mediaType: "series" });
  expect((await expectBody(library, 200, LibraryResponse)).items).toEqual([
    { mediaItem, backlog: { addedAt }, inProgress: null, log: null },
  ]);
  const films = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "film" }));
  expect(films.backlog.items.map((item: { mediaItem: unknown }) => item.mediaItem)).toEqual([film]);
  const removed = await loggedInApi.backlog.deleteBacklogItem(mediaItem.id);
  expect(removed.status()).toBe(204);
  const after = await expectBody(loggedInApi.library.getLibrary({ mediaType: "series" }));
  expect(after.items).toEqual([]);
});

test("logging a series takes it off the Watchlist, and the Library of series shows it Watched", async ({
  loggedInApi,
}) => {
  const mediaItem = await chernobyl(loggedInApi);
  await expectBody(loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id }), 201);
  const loggedAt = minutesAgo(10);

  const created = loggedInApi.log.createLogEntry(
    { mediaItemId: mediaItem.id, rating: 5, date: "2026-10-01", review: "Haunting." },
    at(loggedAt),
  );

  expect(await expectBody(created, 201, NewLogEntryResponse)).toEqual({
    logEntry: {
      id: expect.any(Number),
      mediaItem,
      rating: 5,
      date: "2026-10-01",
      review: "Haunting.",
      revisit: false,
      createdAt: loggedAt,
    },
    removedFromBacklog: { position: 0, note: null },
    currentRating: 5,
    logEntryCount: 1,
  });
  const { items } = await expectBody(loggedInApi.library.getLibrary({ mediaType: "series" }));
  expect(items).toEqual([
    {
      mediaItem,
      backlog: null,
      inProgress: null,
      log: { currentRating: 5, lastLogEntry: { date: "2026-10-01", createdAt: loggedAt } },
    },
  ]);
  const films = await expectBody(loggedInApi.library.getLibrary({ mediaType: "film" }));
  expect(films.items).toEqual([]);
});

test("a later Log Entry for a series, as after a new season, is a Revisit only when the request says so", async ({
  loggedInApi,
}) => {
  const mediaItem = await breakingBad(loggedInApi);
  const log = (data: Omit<NewLogEntryRequest, "mediaItemId">, time: string) =>
    expectBody(
      loggedInApi.log.createLogEntry({ mediaItemId: mediaItem.id, ...data }, at(time)),
      201,
      NewLogEntryResponse,
    );
  await log({ rating: 4, date: "2010-06-01" }, minutesAgo(30));

  const newSeason = await log({ rating: 4.5, date: "2011-10-10" }, minutesAgo(20));
  const rewatch = await log({ rating: 5, date: "2026-03-02", revisit: true }, minutesAgo(10));

  expect(newSeason.logEntry.revisit).toBe(false);
  expect(newSeason).toMatchObject({ currentRating: 4.5, logEntryCount: 2 });
  expect(rewatch.logEntry.revisit).toBe(true);
  expect(rewatch).toMatchObject({ currentRating: 5, logEntryCount: 3 });
  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItem.id));
  expect(history.logEntries.map((entry: { revisit: boolean }) => entry.revisit)).toEqual([
    false,
    false,
    true,
  ]);
});

test("a List of series holds series and refuses a film, and a List of films refuses a series", async ({
  loggedInApi,
}) => {
  const series = await breakingBad(loggedInApi);
  const film = await alien(loggedInApi);
  const createList = async (name: string, mediaType: "film" | "series") => {
    return (await expectBody(loggedInApi.lists.createList({ name, mediaType }), 201)).list;
  };
  const shows = await createList("Crime shows", "series");
  const films = await createList("Crime films", "film");

  const added = loggedInApi.lists.addListItem(shows.id, {
    mediaItemId: series.id,
    note: "Start with season 2.",
  });

  expect((await expectBody(added, 201)).listItem).toEqual({
    id: expect.any(Number),
    mediaItem: series,
    position: 0,
    note: "Start with season 2.",
  });
  const filmInShows = loggedInApi.lists.addListItem(shows.id, { mediaItemId: film.id });
  expect(await expectBody(filmInShows, 400)).toEqual({ error: "wrong_media_type" });
  const seriesInFilms = loggedInApi.lists.addListItem(films.id, { mediaItemId: series.id });
  expect(await expectBody(seriesInFilms, 400)).toEqual({ error: "wrong_media_type" });
  const { list } = await expectBody(loggedInApi.lists.getList(shows.id));
  expect(list).toMatchObject({ mediaType: "series", items: [{ mediaItem: series }] });
});

test("anyone with the link sees a List of series: posters, titles, years and Notes", async ({
  loggedInApi,
  loggedInUser,
  visitor,
}) => {
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Slow burns", mediaType: "series" }),
    201,
  );
  const [first, second] = [await chernobyl(loggedInApi), await breakingBad(loggedInApi)];
  await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: first.id, note: "Five episodes." }),
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
    title: "Slow burns",
    description: null,
    mediaType: "series",
    owner: { displayName: loggedInUser.username },
    items: [
      { mediaItem: first, position: 0, note: "Five episodes." },
      { mediaItem: second, position: 1, note: null },
    ],
  });
  expect(sharedList.items[0]?.mediaItem.metadata).toMatchObject({
    title: "Chernobyl",
    year: 2019,
    posterUrls: { large: expect.stringContaining("/w500/") },
  });
});

// A User made by code from before series had a Backlog, such as the Operator CLI run from an older
// checkout, has none.
test("a User with no Backlog of series yet can still mark their first series Planned", async ({
  loggedInApi,
  loggedInUser,
}) => {
  const mediaItem = await chernobyl(loggedInApi);
  const removed = await loggedInApi.testHooks.removeBacklog(loggedInUser.username, "series");
  expect(removed.status()).toBe(204);

  const planned = loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id });

  expect((await expectBody(planned, 201, ListItemResponse)).listItem.mediaItem).toEqual(mediaItem);
  const { backlog } = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "series" }));
  expect(backlog).toMatchObject({ mediaType: "series", visibility: "private" });
  expect(backlog.items.map((item: { mediaItem: unknown }) => item.mediaItem)).toEqual([mediaItem]);
});

test("a User adds a series by hand with a title, an Original Title and a year", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const created = loggedInApi.catalog.addManualMediaItem({
    mediaType: "series",
    title: " Спіймати Кайдаша ",
    originalTitle: "Catching Kaidash",
    year: 2020,
  });

  const { mediaItem } = await expectBody(created, 201, MediaItemResponse);

  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "series",
    externalReference: null,
    metadata: {
      title: "Спіймати Кайдаша",
      originalTitle: "Catching Kaidash",
      ukrainianTitle: null,
      year: 2020,
      posterUrls: null,
      backdropUrls: null,
      firstAirYear: 2020,
      lastAirYear: null,
      status: null,
      seasons: [],
      lastAiredEpisode: null,
      nextAirDate: null,
    },
  });
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "series", query: "кайдаш" });
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
  const films = loggedInApi.catalog.searchCatalog({ mediaType: "film", query: "кайдаш" });
  expect((await expectBody(films)).manualResults).toEqual([]);
  const theirs = otherUserClient.catalog.getMediaItemHistory(mediaItem.id);
  expect((await theirs).status()).toBe(404);
});

test("a manual series with the title and year of another of the User's series is a possible duplicate", async ({
  loggedInApi,
}) => {
  await manualSeries(loggedInApi, { title: "Спіймати Кайдаша", year: 2020 });
  const post = (mediaType: "film" | "series", title: string, year: number) => {
    return loggedInApi.catalog.addManualMediaItem({ mediaType, title, year });
  };

  const again = post("series", " спіймати кайдаша ", 2020);

  expect(await expectBody(again, 409)).toEqual({ error: "possible_duplicate" });
  // A film of that title and year, or the series in another year, is another work.
  expect((await post("film", "Спіймати Кайдаша", 2020)).status()).toBe(201);
  expect((await post("series", "Спіймати Кайдаша", 2021)).status()).toBe(201);
  const anyway = loggedInApi.catalog.addManualMediaItem({
    mediaType: "series",
    title: "Спіймати Кайдаша",
    year: 2020,
    allowDuplicate: true,
  });
  expect((await anyway).status()).toBe(201);
});

test("a manual series takes no film's or book's details, and no year before films", async ({
  loggedInApi,
}) => {
  for (const details of [{ runtime: 45 }, { genres: ["Drama"] }, { authors: ["Me"] }]) {
    const created = loggedInApi.catalog.addManualMediaItem({
      mediaType: "series",
      title: "Home series",
      ...details,
    } as never);
    expect((await created).status(), JSON.stringify(details)).toBe(400);
  }
  const ancient = loggedInApi.catalog.addManualMediaItem({
    mediaType: "series",
    title: "Home series",
    year: 1700,
  });
  expect((await ancient).status()).toBe(400);
  const mediaItem = await manualSeries(loggedInApi, { title: "Home series" });
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

test("the User edits a manual series, and deleting it deletes their Log Entries for it", async ({
  loggedInApi,
}) => {
  const mediaItem = await manualSeries(loggedInApi, { title: "Kaidash", year: 2019 });
  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: mediaItem.id, rating: 4 }), 201);
  const patch = (changes: ManualMediaItemEditRequest) => {
    return loggedInApi.catalog.updateManualMediaItem(mediaItem.id, changes);
  };

  const edited = await expectBody(
    patch({ title: "Спіймати Кайдаша", originalTitle: "Catching Kaidash", year: 2020 }),
    200,
    MediaItemResponse,
  );

  expect(edited.mediaItem.metadata).toMatchObject({
    title: "Спіймати Кайдаша",
    originalTitle: "Catching Kaidash",
    year: 2020,
  });
  const manual = loggedInApi.catalog.getManualMediaItem(mediaItem.id);
  expect(await expectBody(manual, 200, ManualMediaItemResponse)).toEqual({
    mediaItem: edited.mediaItem,
    usage: { logEntries: 1, listItems: 0 },
  });
  expect((await loggedInApi.catalog.deleteManualMediaItem(mediaItem.id)).status()).toBe(204);
  const gone = await loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(gone.status()).toBe(404);
  const { items } = await expectBody(loggedInApi.library.getLibrary({ mediaType: "series" }));
  expect(items).toEqual([]);
});

test("a running series is found by its Ukrainian title", async ({ loggedInApi }) => {
  const result = await seriesSearchResult(loggedInApi, "Земля Гангстерів", mobLandId);

  expect(result).toMatchObject({ originalTitle: "MobLand", titleLanguage: "uk", year: 2025 });
});
