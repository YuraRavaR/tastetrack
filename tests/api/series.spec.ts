import {
  BacklogResponse,
  CatalogSearchResponse,
  InProgressResponse,
  ItemHistoryResponse,
  type LibraryItem,
  LibraryResponse,
  ListItemResponse,
  type ManualMediaItemEditRequest,
  ManualMediaItemResponse,
  MediaItemResponse,
  NewInProgressResponse,
  type NewLogEntryRequest,
  NewLogEntryResponse,
  SharedListResponse,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { test as base, expect } from "../support/fixtures";
import { tyhrolovy } from "../support/scenarios/books";
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

// Progress: how far a User has got in a series they are watching ("Watching" in the UI), the last
// episode they watched.

test("a series can be started with or without the last episode watched, and its In Progress carries it", async ({
  loggedInApi,
}) => {
  const [fresh, resumed] = [await chernobyl(loggedInApi), await breakingBad(loggedInApi)];
  const startedAt = minutesAgo(5);

  const started = loggedInApi.inProgress.start({ mediaItemId: fresh.id }, at(startedAt));
  const startedMidway = loggedInApi.inProgress.start({
    mediaItemId: resumed.id,
    progress: { mediaType: "series", season: 3, episode: 0 },
  });

  expect(await expectBody(started, 201, NewInProgressResponse)).toEqual({
    inProgress: {
      startDate: null,
      createdAt: startedAt,
      progress: null,
      // Chernobyl has one season of five episodes.
      outlook: {
        nextEpisode: { season: 1, episode: 1 },
        watchedEpisodes: 0,
        episodeCount: 5,
        caughtUp: false,
      },
    },
    removedFromBacklog: null,
  });
  expect((await expectBody(startedMidway, 201, NewInProgressResponse)).inProgress).toMatchObject({
    progress: { mediaType: "series", season: 3, episode: 0 },
  });
});

test("a series' Progress can be changed and cleared, and changing only the start date keeps it", async ({
  loggedInApi,
}) => {
  const mediaItem = await breakingBad(loggedInApi);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id }), 201);
  const progressOnPage = async () => {
    const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
    return (await expectBody(history, 200, ItemHistoryResponse)).inProgress?.progress;
  };
  const seasonTwoEpisodeFive = { mediaType: "series", season: 2, episode: 5 } as const;

  const changed = loggedInApi.inProgress.update(mediaItem.id, { progress: seasonTwoEpisodeFive });

  expect((await expectBody(changed, 200, InProgressResponse)).inProgress).toMatchObject({
    startDate: null,
    progress: seasonTwoEpisodeFive,
  });
  expect(await progressOnPage()).toEqual(seasonTwoEpisodeFive);

  const dated = loggedInApi.inProgress.update(mediaItem.id, { startDate: "2026-10-12" });

  expect((await expectBody(dated)).inProgress).toMatchObject({
    startDate: "2026-10-12",
    progress: seasonTwoEpisodeFive,
  });

  const cleared = loggedInApi.inProgress.update(mediaItem.id, { progress: null });

  expect((await expectBody(cleared)).inProgress).toMatchObject({
    startDate: "2026-10-12",
    progress: null,
  });
  expect(await progressOnPage()).toBeNull();
});

test("a Progress out of range, or sent for a book, is refused, and an episode beyond what TMDB lists is kept", async ({
  loggedInApi,
}) => {
  const [mediaItem, book] = [await chernobyl(loggedInApi), await tyhrolovy(loggedInApi)];
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id }), 201);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: book.id }), 201);
  const progress = (season: number, episode: number) => {
    return { mediaType: "series", season, episode } as const;
  };

  for (const [refused, error] of [
    [progress(0, 3), "invalid_progress"],
    [progress(1, -1), "invalid_progress"],
    [progress(1.5, 2), "invalid_progress"],
    [progress(1, 2.5), "invalid_progress"],
    [{ mediaType: "book", page: 12 }, "invalid_request"],
    [{ season: 1, episode: 2 }, "invalid_request"],
  ] as const) {
    const changed = loggedInApi.inProgress.update(mediaItem.id, { progress: refused as never });
    expect(await expectBody(changed, 400), JSON.stringify(refused)).toEqual({ error });
  }
  const forBook = loggedInApi.inProgress.update(book.id, { progress: progress(1, 2) });
  expect(await expectBody(forBook, 400)).toEqual({ error: "progress_mismatch" });
  const nothing = loggedInApi.inProgress.update(mediaItem.id, {} as never);
  expect(await expectBody(nothing, 400)).toEqual({ error: "invalid_request" });

  // Chernobyl has one season of five episodes.
  const beyond = loggedInApi.inProgress.update(mediaItem.id, { progress: progress(2, 9) });

  expect((await expectBody(beyond)).inProgress.progress).toEqual(progress(2, 9));
});

test("a series can't be started with a Progress out of range, nor a book with any, and neither is started", async ({
  loggedInApi,
}) => {
  const [mediaItem, book] = [await chernobyl(loggedInApi), await tyhrolovy(loggedInApi)];
  const progress = { mediaType: "series", season: 0, episode: 1 } as const;

  const series = loggedInApi.inProgress.start({ mediaItemId: mediaItem.id, progress });
  const started = loggedInApi.inProgress.start({
    mediaItemId: book.id,
    progress: { ...progress, season: 1 },
  });

  expect(await expectBody(series, 400)).toEqual({ error: "invalid_progress" });
  expect(await expectBody(started, 400)).toEqual({ error: "progress_mismatch" });
  for (const { id } of [mediaItem, book]) {
    const history = loggedInApi.catalog.getMediaItemHistory(id);
    expect((await expectBody(history, 200, ItemHistoryResponse)).inProgress).toBeNull();
  }
});

test("finishing a series returns its Log Entry, and it is no longer In Progress, its Progress gone", async ({
  loggedInApi,
}) => {
  const mediaItem = await chernobyl(loggedInApi);
  const progress = { mediaType: "series", season: 1, episode: 5 } as const;
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id, progress }), 201);

  const finished = loggedInApi.inProgress.finish(mediaItem.id, { rating: 5 });

  const { logEntry } = await expectBody(finished, 201, NewLogEntryResponse);
  expect(logEntry).toMatchObject({ mediaItem, rating: 5, revisit: false });
  expect(Object.keys(logEntry)).not.toContain("progress");
  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(await expectBody(history, 200, ItemHistoryResponse)).toMatchObject({
    logEntries: [logEntry],
    inProgress: null,
  });
  const again = loggedInApi.inProgress.start({ mediaItemId: mediaItem.id });
  expect((await expectBody(again, 201)).inProgress.progress).toBeNull();
});

test("stopping a series leaves no Log Entry, and starting it again starts with no Progress", async ({
  loggedInApi,
}) => {
  const mediaItem = await chernobyl(loggedInApi);
  const progress = { mediaType: "series", season: 1, episode: 3 } as const;
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id, progress }), 201);

  const stopped = await loggedInApi.inProgress.stop(mediaItem.id);

  expect(stopped.status()).toBe(204);
  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(await expectBody(history, 200, ItemHistoryResponse)).toMatchObject({
    logEntries: [],
    inProgress: null,
  });
  const { items } = await expectBody(loggedInApi.library.getLibrary({ mediaType: "series" }));
  expect(items).toEqual([]);
  const again = loggedInApi.inProgress.start({ mediaItemId: mediaItem.id });
  expect((await expectBody(again, 201)).inProgress.progress).toBeNull();
});

test("the Library of series shows each series In Progress with its Progress, and a Share Link shows none", async ({
  loggedInApi,
  visitor,
}) => {
  const [watching, notStarted] = [await chernobyl(loggedInApi), await breakingBad(loggedInApi)];
  const progress = { mediaType: "series", season: 1, episode: 2 } as const;
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: watching.id, progress }), 201);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: notStarted.id }), 201);
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "On now", mediaType: "series" }),
    201,
  );
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: watching.id }), 201);
  const { shareLink } = await expectBody(loggedInApi.lists.createShareLink(list.id), 201);

  const library = loggedInApi.library.getLibrary({ mediaType: "series" });
  const shared = visitor.sharedLists.getSharedList(shareLink.token);

  const { items } = await expectBody(library, 200, LibraryResponse);
  const progressOf = (id: number) => {
    return items.find((item: LibraryItem) => item.mediaItem.id === id)?.inProgress?.progress;
  };
  expect(progressOf(watching.id)).toEqual(progress);
  expect(progressOf(notStarted.id)).toBeNull();
  const body = JSON.stringify(await expectBody(shared, 200, SharedListResponse));
  expect(body).not.toContain("progress");
  expect(body).not.toContain("inProgress");
});

// What follows from Progress: the next episode, how many are watched and listed, and whether the
// User is caught up.
function seriesProgress(season: number, episode: number) {
  return { mediaType: "series", season, episode } as const;
}

async function outlookAt(
  client: ApiClient,
  mediaItemId: number,
  progress: ReturnType<typeof seriesProgress>,
) {
  const changed = client.inProgress.update(mediaItemId, { progress });
  return (await expectBody(changed, 200, InProgressResponse)).inProgress.outlook;
}

test("a series' next episode rolls over to the next season, and the User is caught up after its last", async ({
  loggedInApi,
}) => {
  const mediaItem = await breakingBad(loggedInApi);

  const started = loggedInApi.inProgress.start({ mediaItemId: mediaItem.id });

  expect((await expectBody(started, 201, NewInProgressResponse)).inProgress.outlook).toEqual({
    nextEpisode: { season: 1, episode: 1 },
    watchedEpisodes: 0,
    episodeCount: 62,
    caughtUp: false,
  });
  expect(await outlookAt(loggedInApi, mediaItem.id, seriesProgress(1, 6))).toEqual({
    nextEpisode: { season: 1, episode: 7 },
    watchedEpisodes: 6,
    episodeCount: 62,
    caughtUp: false,
  });
  expect(await outlookAt(loggedInApi, mediaItem.id, seriesProgress(1, 7))).toMatchObject({
    nextEpisode: { season: 2, episode: 1 },
    watchedEpisodes: 7,
  });
  expect(await outlookAt(loggedInApi, mediaItem.id, seriesProgress(3, 0))).toMatchObject({
    nextEpisode: { season: 3, episode: 1 },
    watchedEpisodes: 20,
  });
  expect(await outlookAt(loggedInApi, mediaItem.id, seriesProgress(5, 16))).toEqual({
    nextEpisode: null,
    watchedEpisodes: 62,
    episodeCount: 62,
    caughtUp: true,
  });
  const { items } = await expectBody(loggedInApi.library.getLibrary({ mediaType: "series" }));
  expect(items[0].inProgress.outlook).toMatchObject({ nextEpisode: null, caughtUp: true });
});

test("a running series is caught up at its last aired episode, though its season lists one more", async ({
  loggedInApi,
}) => {
  test.skip(callsRealTmdb(), "A running series moves on every week on real TMDB");
  // MobLand's second season lists 10 episodes, of which 9 have aired.
  const mediaItem = await mobLand(loggedInApi);
  await expectBody(loggedInApi.inProgress.start({ mediaItemId: mediaItem.id }), 201);

  expect(await outlookAt(loggedInApi, mediaItem.id, seriesProgress(2, 8))).toEqual({
    nextEpisode: { season: 2, episode: 9 },
    watchedEpisodes: 18,
    episodeCount: 20,
    caughtUp: false,
  });
  expect(await outlookAt(loggedInApi, mediaItem.id, seriesProgress(2, 9))).toEqual({
    nextEpisode: { season: 2, episode: 10 },
    watchedEpisodes: 19,
    episodeCount: 20,
    caughtUp: true,
  });
  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect((await expectBody(history, 200, ItemHistoryResponse)).inProgress?.outlook).toMatchObject({
    nextEpisode: { season: 2, episode: 10 },
    caughtUp: true,
  });
});

test("a manual series' next episode is the next number in the same season, with no count and never caught up", async ({
  loggedInApi,
}) => {
  const mediaItem = await manualSeries(loggedInApi, { title: "Спіймати Кайдаша", year: 2020 });

  const started = loggedInApi.inProgress.start({ mediaItemId: mediaItem.id });

  const noCount = { watchedEpisodes: null, episodeCount: null, caughtUp: false };
  expect((await expectBody(started, 201)).inProgress.outlook).toEqual({
    nextEpisode: { season: 1, episode: 1 },
    ...noCount,
  });
  expect(await outlookAt(loggedInApi, mediaItem.id, seriesProgress(1, 12))).toEqual({
    nextEpisode: { season: 1, episode: 13 },
    ...noCount,
  });
  expect(await outlookAt(loggedInApi, mediaItem.id, seriesProgress(2, 0))).toEqual({
    nextEpisode: { season: 2, episode: 1 },
    ...noCount,
  });
});
