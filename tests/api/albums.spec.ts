import {
  BacklogResponse,
  CatalogSearchResponse,
  type CatalogSearchResult,
  ItemHistoryResponse,
  LibraryResponse,
  ListItemResponse,
  type ManualMediaItemEditRequest,
  ManualMediaItemResponse,
  MediaItemResponse,
  NewLogEntryResponse,
  SharedListResponse,
  ThoughtResponse,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { test as base, expect } from "../support/fixtures";
import {
  abbeyRoad,
  abbeyRoadId,
  abbeyRoadRemixId,
  abbeyRoadSingleId,
  albumReference,
  albumSearchResult,
  albumSearchResults,
  beatlesStoryId,
  bedouinReworksId,
  callsRealMusicBrainz,
  coverArt,
  darkSideOfTheMoonId,
  darkSideTributeId,
  hollywoodBowlId,
  interstellarId,
  jamala1944,
  jamala1944AlbumId,
  jamala1944EpId,
  jamala1944SingleId,
  manualAlbum,
  mergedId,
  musicBrainzPage,
  troyAudiobookId,
  unpluggedInNewYorkId,
  unpluggedTributeId,
  zemlya,
  zemlyaId,
} from "../support/scenarios/albums";
import { alien } from "../support/scenarios/films";
import { withMusicBrainzBusy } from "../support/test-hooks-secret";

// Locally the Worker calls a MusicBrainz fake with fixed data; on staging, the real MusicBrainz.
// So these tests use only the release groups the fake mirrors, and skip what only the fake can
// promise.

// `visitor` is a client with no session, holding nothing but a Share Link.
const test = base.extend<{ visitor: ApiClient }>({
  visitor: async ({ createApiClient }, use) => {
    await use(await createApiClient());
  },
});

const ids = (results: CatalogSearchResult[]) => results.map((r) => r.externalReference.id);

// How many calls the MusicBrainz fake has refused for coming too soon.
async function callsRefused(client: ApiClient): Promise<number> {
  return (await expectBody(client.testHooks.getMusicBrainzFakeRateLimited())).refused;
}

test("searching albums finds the album before the EP of one title, with its cover, artist, year and type, and no single", async ({
  loggedInApi,
}) => {
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "album", query: "1944 Jamala" });

  const { results } = await expectBody(search, 200, CatalogSearchResponse);

  expect(results[0]).toMatchObject({
    externalReference: albumReference(jamala1944AlbumId),
    title: "1944",
    originalTitle: "1944",
    year: 2016,
    posterUrl: coverArt(jamala1944AlbumId, 250),
    titleLanguage: "en",
    authors: [],
    artistCredit: "Jamala",
    primaryType: "Album",
    secondaryTypes: [],
    inLog: false,
    inBacklog: false,
  });
  expect(ids(results)).toContain(jamala1944EpId);
  expect(
    results.find((r: CatalogSearchResult) => r.externalReference.id === jamala1944EpId),
  ).toMatchObject({
    year: 2016,
    artistCredit: "Jamala",
    primaryType: "EP",
  });
  expect(ids(results)).not.toContain(jamala1944SingleId);
});

test("album search ranks a plain album before a live album, a remix and the like of the same artist", async ({
  loggedInApi,
}) => {
  const results = await albumSearchResults(loggedInApi, "Abbey Road Beatles");

  expect(results[0]?.externalReference).toEqual(albumReference(abbeyRoadId));
  expect(results[0]).toMatchObject({ year: 1969, artistCredit: "The Beatles", secondaryTypes: [] });
  expect(ids(results)).toContain(abbeyRoadRemixId);
  expect(
    results.find((r: CatalogSearchResult) => r.externalReference.id === abbeyRoadRemixId),
  ).toMatchObject({
    primaryType: "Album",
    secondaryTypes: ["Remix"],
  });
  expect(ids(results).indexOf(abbeyRoadId)).toBeLessThan(ids(results).indexOf(abbeyRoadRemixId));
});

test("album search puts the album whose title and artist the query names before tributes to it", async ({
  loggedInApi,
}) => {
  const [darkSide, unplugged] = await Promise.all(
    ["Pink Floyd Dark Side of the Moon", "Nirvana MTV Unplugged in New York"].map((query) =>
      albumSearchResults(loggedInApi, query),
    ),
  );

  expect(darkSide[0]).toMatchObject({
    externalReference: albumReference(darkSideOfTheMoonId),
    artistCredit: "Pink Floyd",
  });
  expect(ids(darkSide)).toContain(darkSideTributeId);
  expect(unplugged[0]).toMatchObject({
    externalReference: albumReference(unpluggedInNewYorkId),
    artistCredit: "Nirvana",
    secondaryTypes: ["Live"],
  });
  expect(ids(unplugged)).toContain(unpluggedTributeId);
});

test("album search shows albums and EPs alone: no singles, interviews or audiobooks", async ({
  loggedInApi,
}) => {
  const searches = await Promise.all(
    ["Abbey Road", "Beatles Story", "Troy Stephen Fry"].map((query) =>
      albumSearchResults(loggedInApi, query),
    ),
  );

  const shown = searches.flatMap(ids);
  for (const hidden of [abbeyRoadSingleId, beatlesStoryId, troyAudiobookId]) {
    expect(shown).not.toContain(hidden);
  }
  for (const result of searches.flat()) {
    expect(["Album", "EP"]).toContain(result.primaryType);
    expect(result.secondaryTypes).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/Interview|Audiobook|Spokenword/)]),
    );
  }
});

test("a live album and a soundtrack are albums of their own in search", async ({ loggedInApi }) => {
  const live = await albumSearchResult(loggedInApi, "Hollywood Bowl Beatles", hollywoodBowlId);
  const soundtrack = await albumSearchResult(
    loggedInApi,
    "Interstellar Hans Zimmer",
    interstellarId,
  );

  expect(live).toMatchObject({
    title: "The Beatles at the Hollywood Bowl",
    year: 1977,
    primaryType: "Album",
    secondaryTypes: ["Live"],
  });
  expect(soundtrack).toMatchObject({
    title: "Interstellar: Original Motion Picture Soundtrack",
    artistCredit: "Hans Zimmer",
    secondaryTypes: ["Soundtrack"],
  });
});

test("a Cyrillic query finds Земля by Океан Ельзи, titled in its original script", async ({
  loggedInApi,
}) => {
  const results = await albumSearchResults(loggedInApi, "Океан Ельзи Земля");

  expect(results[0]).toMatchObject({
    externalReference: albumReference(zemlyaId),
    title: "Земля",
    originalTitle: "Земля",
    year: 2013,
    artistCredit: "Океан Ельзи",
    primaryType: "Album",
    titleLanguage: "uk",
  });
});

test("an album credited to two artists shows the credit as MusicBrainz joins it", async ({
  loggedInApi,
}) => {
  const result = await albumSearchResult(
    loggedInApi,
    "Bedouin Reworks Dakhabrakha",
    bedouinReworksId,
  );

  expect(result).toMatchObject({ artistCredit: "Bedouin, DakhaBrakha", primaryType: "EP" });
});

test("an album search finds no films, and a film search no albums", async ({ loggedInApi }) => {
  const films = await expectBody(
    loggedInApi.catalog.searchCatalog({ mediaType: "film", query: "interstellar" }),
  );

  for (const r of films.results as CatalogSearchResult[]) {
    expect(r.externalReference.mediaType).toBe("film");
    expect(r).not.toHaveProperty("artistCredit");
    expect(r).not.toHaveProperty("primaryType");
  }
  for (const r of (await albumSearchResults(
    loggedInApi,
    "Interstellar Hans Zimmer",
  )) as CatalogSearchResult[]) {
    expect(r.externalReference).toMatchObject({ source: "musicbrainz", mediaType: "album" });
    expect(r).not.toHaveProperty("platforms");
  }
});

test("the Worker makes its MusicBrainz calls one at a time, so the fake refuses none", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake counts the calls it refused");
  const refused = await callsRefused(loggedInApi);
  const queries = ["1944 Jamala", "Abbey Road", "Океан Ельзи Земля", "Interstellar", "Troy"];

  const searches = await Promise.all(
    queries.map((query) =>
      loggedInApi.catalog.searchCatalog({ mediaType: "album", query }).then((r) => r.status()),
    ),
  );
  const added = await Promise.all([zemlya(loggedInApi), abbeyRoad(loggedInApi)]);

  expect(searches).toEqual(queries.map(() => 200));
  expect(added.map((item) => item.metadata.title)).toEqual(["Земля", "Abbey Road"]);
  expect(await callsRefused(loggedInApi)).toBe(refused);
});

test("a search MusicBrainz answers 503 is asked again once, and finds its albums", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");

  const search = loggedInApi.catalog.searchCatalog(
    { mediaType: "album", query: "1944 Jamala" },
    withMusicBrainzBusy(1),
  );

  const { results } = await expectBody(search, 200);
  expect(results[0].externalReference).toEqual(albumReference(jamala1944AlbumId));
});

test("a search MusicBrainz answers 503 twice is a 503 that says MusicBrainz is busy", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");

  const search = loggedInApi.catalog.searchCatalog(
    { mediaType: "album", query: "1944 Jamala" },
    withMusicBrainzBusy(2),
  );

  expect(await expectBody(search, 503)).toEqual({ error: "catalog_busy" });
});

test("MusicBrainz is made busy only by a request with the test hooks secret, once or twice", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");
  const query = { mediaType: "album", query: "1944 Jamala" } as const;

  const unopened = loggedInApi.catalog.searchCatalog(query, {
    headers: { "X-Test-MusicBrainz-Busy": "2" },
  });
  const thrice = loggedInApi.catalog.searchCatalog(query, {
    headers: { ...withMusicBrainzBusy(2).headers, "X-Test-MusicBrainz-Busy": "3" },
  });

  expect((await unopened).status()).toBe(200);
  expect(await expectBody(thrice, 400)).toEqual({ error: "invalid_test_musicbrainz_busy" });
});

// Земля, 1944 and the merged release group are taken out of the cache by these tests alone, and
// used from the catalog by this file's tests alone, which run one after another. Out of the cache,
// adding them makes the details call, whatever earlier runs left in local D1.
test("adding an album stores its title, year, artist credit, types and MusicBrainz page", async ({
  loggedInApi,
}) => {
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(albumReference(zemlyaId));
  expect(evicted.status()).toBe(204);
  const result = await albumSearchResult(loggedInApi, "Океан Ельзи Земля", zemlyaId);

  const added = await loggedInApi.catalog.addCatalogItem(result);

  expect([200, 201]).toContain(added.status());
  const { mediaItem } = MediaItemResponse.parse(await added.json());
  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "album",
    externalReference: albumReference(zemlyaId),
    metadata: {
      title: "Земля",
      originalTitle: "Земля",
      ukrainianTitle: null,
      year: 2013,
      coverUrls: { small: coverArt(zemlyaId, 250), large: coverArt(zemlyaId, 500) },
      artistCredit: "Океан Ельзи",
      artists: ["Океан Ельзи"],
      primaryType: "Album",
      secondaryTypes: [],
      url: musicBrainzPage(zemlyaId),
    },
  });
  const page = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect((await expectBody(page, 200, ItemHistoryResponse)).about).toBeNull();
});

test("adding an album while MusicBrainz is busy keeps it as search found it", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(
    albumReference(jamala1944AlbumId),
  );
  expect(evicted.status()).toBe(204);
  const result = await albumSearchResult(loggedInApi, "1944 Jamala", jamala1944AlbumId);

  const added = await loggedInApi.catalog.addCatalogItem(result, withMusicBrainzBusy(2));

  expect([200, 201]).toContain(added.status());
  const { mediaItem } = await added.json();
  expect(mediaItem.metadata).toMatchObject({
    title: "1944",
    year: 2016,
    coverUrls: { small: coverArt(jamala1944AlbumId, 250) },
    artistCredit: null,
  });
  // The next add fills in the rest.
  const again = await expectBody(loggedInApi.catalog.addCatalogItem(result), 200);
  expect(again.mediaItem.metadata).toMatchObject({ artistCredit: "Jamala", primaryType: "Album" });
});

test("a merged release group is added through MusicBrainz's redirect, under the MBID asked for", async ({
  loggedInApi,
}) => {
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(albumReference(mergedId));
  expect(evicted.status()).toBe(204);

  const added = loggedInApi.catalog.addCatalogItem({
    externalReference: albumReference(mergedId),
    title: "Bye Bye Birdie",
    originalTitle: "Bye Bye Birdie",
    year: null,
    posterUrl: null,
    titleLanguage: "en",
  });

  const { mediaItem } = MediaItemResponse.parse(await (await added).json());
  expect(mediaItem).toMatchObject({
    externalReference: albumReference(mergedId),
    metadata: {
      title: "Bye Bye Birdie",
      year: 1963,
      artistCredit: "Charles Strouse",
      secondaryTypes: ["Soundtrack"],
      url: musicBrainzPage("9cd2811d-a999-326e-8945-a8b6b44b9e92"),
    },
  });
});

test("an album's cover comes from the Cover Art Archive, which has none for some", async ({
  loggedInApi,
  request,
}) => {
  test.skip(callsRealMusicBrainz(), "The Cover Art Archive fake stands in for the real one");
  const withCover = await albumSearchResult(loggedInApi, "Abbey Road Beatles", abbeyRoadId);
  const without = await albumSearchResult(loggedInApi, "Abbey Road Beatles", abbeyRoadRemixId);

  expect(without.posterUrl).toEqual(coverArt(abbeyRoadRemixId, 250));
  const cover = await request.get(withCover.posterUrl ?? "");
  expect(cover.status()).toBe(200);
  expect(cover.headers()["content-type"]).toBe("image/svg+xml");
  expect((await request.get(without.posterUrl ?? "")).status()).toBe(404);
});

test("an album is added only under MusicBrainz, with a release group's MBID", async ({
  loggedInApi,
}) => {
  const result = await albumSearchResult(loggedInApi, "1944 Jamala", jamala1944AlbumId);

  for (const externalReference of [
    { source: "tmdb", mediaType: "album", id: jamala1944AlbumId },
    { source: "musicbrainz", mediaType: "album", id: "1944" },
    { source: "musicbrainz", mediaType: "album", id: jamala1944AlbumId.toUpperCase() },
    { source: "musicbrainz", mediaType: "film", id: jamala1944AlbumId },
  ]) {
    const response = await loggedInApi.catalog.addCatalogItem({
      ...result,
      externalReference,
    } as never);
    expect(response.status(), JSON.stringify(externalReference)).toBe(400);
  }
});

test("an album marked Planned is in the Listening list and the Library of albums, and in no film's", async ({
  loggedInApi,
}) => {
  const mediaItem = await zemlya(loggedInApi);
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
    loggedInApi.backlog.getBacklog({ mediaType: "album" }),
    200,
    BacklogResponse,
  );
  expect(backlog).toEqual({
    id: expect.any(Number),
    mediaType: "album",
    visibility: "private",
    shareLink: null,
    items: [listItem],
  });
  const library = loggedInApi.library.getLibrary({ mediaType: "album" });
  expect((await expectBody(library, 200, LibraryResponse)).items).toEqual([
    { mediaItem, backlog: { addedAt }, inProgress: null, log: null },
  ]);
  const films = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "film" }));
  expect(films.backlog.items.map((item: { mediaItem: unknown }) => item.mediaItem)).toEqual([film]);
});

test("marking an album Listened takes it off the Listening list, and a Relisten is a second Log Entry", async ({
  loggedInApi,
}) => {
  const mediaItem = await jamala1944(loggedInApi);
  await expectBody(
    loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id, note: "From Olena." }),
    201,
  );
  const log = (rating: number, revisit: boolean, time: string) =>
    expectBody(
      loggedInApi.log.createLogEntry({ mediaItemId: mediaItem.id, rating, revisit }, at(time)),
      201,
      NewLogEntryResponse,
    );

  const first = await log(4, false, minutesAgo(20));
  const relisten = await log(4.5, true, minutesAgo(10));

  expect(first).toMatchObject({
    logEntry: { mediaItem, rating: 4, revisit: false },
    removedFromBacklog: { position: 0, note: "From Olena." },
  });
  expect(relisten).toMatchObject({
    logEntry: { revisit: true },
    removedFromBacklog: null,
    currentRating: 4.5,
    logEntryCount: 2,
  });
  const { items } = await expectBody(loggedInApi.library.getLibrary({ mediaType: "album" }));
  expect(items).toEqual([expect.objectContaining({ mediaItem, backlog: null })]);
  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItem.id));
  expect(history.logEntries.map((entry: { revisit: boolean }) => entry.revisit)).toEqual([
    false,
    true,
  ]);
});

test("an album keeps a Thought, but can't be started and takes no Progress", async ({
  loggedInApi,
}) => {
  const mediaItem = await abbeyRoad(loggedInApi);

  const thought = loggedInApi.thoughts.createThought(mediaItem.id, {
    text: "Here comes the sun.",
    date: "2026-11-21",
    quote: true,
  });

  expect((await expectBody(thought, 201, ThoughtResponse)).thought).toMatchObject({
    text: "Here comes the sun.",
    quote: true,
    progress: null,
  });
  const started = loggedInApi.inProgress.start({ mediaItemId: mediaItem.id });
  expect(await expectBody(started, 400)).toEqual({ error: "not_progressable" });
  for (const progress of [
    { mediaType: "series", season: 1, episode: 2 },
    { mediaType: "book", page: 12 },
  ] as const) {
    const refused = loggedInApi.thoughts.createThought(mediaItem.id, {
      text: "Side B.",
      date: "2026-11-21",
      progress,
    });
    expect(await expectBody(refused, 400), JSON.stringify(progress)).toEqual({
      error: "progress_mismatch",
    });
  }
  const history = loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(await expectBody(history, 200, ItemHistoryResponse)).toMatchObject({
    inProgress: null,
    thoughts: [{ text: "Here comes the sun." }],
  });
});

test("a List of albums holds albums and refuses a film, and a List of films refuses an album", async ({
  loggedInApi,
}) => {
  const album = await zemlya(loggedInApi);
  const film = await alien(loggedInApi);
  const createList = async (name: string, mediaType: "film" | "album") => {
    return (await expectBody(loggedInApi.lists.createList({ name, mediaType }), 201)).list;
  };
  const albums = await createList("Albums to start with Ukrainian rock", "album");
  const films = await createList("Space films", "film");

  const added = loggedInApi.lists.addListItem(albums.id, {
    mediaItemId: album.id,
    note: "Start with «Обійми».",
  });

  expect((await expectBody(added, 201)).listItem).toEqual({
    id: expect.any(Number),
    mediaItem: album,
    position: 0,
    note: "Start with «Обійми».",
  });
  const filmInAlbums = loggedInApi.lists.addListItem(albums.id, { mediaItemId: film.id });
  expect(await expectBody(filmInAlbums, 400)).toEqual({ error: "wrong_media_type" });
  const albumInFilms = loggedInApi.lists.addListItem(films.id, { mediaItemId: album.id });
  expect(await expectBody(albumInFilms, 400)).toEqual({ error: "wrong_media_type" });
  const { list } = await expectBody(loggedInApi.lists.getList(albums.id));
  expect(list).toMatchObject({ mediaType: "album", items: [{ mediaItem: album }] });
});

test("a List can't be named Listening list, the albums' Backlog's name", async ({
  loggedInApi,
}) => {
  const created = loggedInApi.lists.createList({ name: "listening list", mediaType: "album" });

  expect(await expectBody(created, 400)).toEqual({ error: "list_name_reserved" });
});

test("anyone with the link sees a List of albums: covers, titles, artists and Notes", async ({
  loggedInApi,
  loggedInUser,
  visitor,
}) => {
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "For the road", mediaType: "album" }),
    201,
  );
  const [first, second] = [await zemlya(loggedInApi), await abbeyRoad(loggedInApi)];
  await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: first.id, note: "Loud." }),
    201,
  );
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: second.id }), 201);
  const { shareLink } = await expectBody(loggedInApi.lists.createShareLink(list.id), 201);

  const { sharedList } = await expectBody(
    visitor.sharedLists.getSharedList(shareLink.token),
    200,
    SharedListResponse,
  );

  expect(sharedList).toEqual({
    title: "For the road",
    description: null,
    mediaType: "album",
    owner: { displayName: loggedInUser.username },
    items: [
      { mediaItem: first, position: 0, note: "Loud." },
      { mediaItem: second, position: 1, note: null },
    ],
  });
  expect(sharedList.items[0]?.mediaItem.metadata).toMatchObject({
    title: "Земля",
    artistCredit: "Океан Ельзи",
    coverUrls: { large: coverArt(zemlyaId, 500) },
  });
});

// A User made by code from before albums had a Backlog, such as the Operator CLI run from an older
// checkout, has none, as every User made before this release does.
test("a User with no Listening list yet can still mark their first album Planned", async ({
  loggedInApi,
  loggedInUser,
}) => {
  const mediaItem = await zemlya(loggedInApi);
  const removed = await loggedInApi.testHooks.removeBacklog(loggedInUser.username, "album");
  expect(removed.status()).toBe(204);

  const planned = loggedInApi.backlog.addBacklogItem({ mediaItemId: mediaItem.id });

  expect((await expectBody(planned, 201, ListItemResponse)).listItem.mediaItem).toEqual(mediaItem);
  const { backlog } = await expectBody(loggedInApi.backlog.getBacklog({ mediaType: "album" }));
  expect(backlog).toMatchObject({ mediaType: "album", visibility: "private" });
  expect(backlog.items.map((item: { mediaItem: unknown }) => item.mediaItem)).toEqual([mediaItem]);
});

test("a User adds an album by hand with a title, an Original Title, its artists and a year", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const created = loggedInApi.catalog.addManualMediaItem({
    mediaType: "album",
    title: " Демо в гаражі ",
    originalTitle: "Garage Demo",
    authors: ["Сусіди", " ", "Друзі сусідів"],
    year: 2024,
  });

  const { mediaItem } = await expectBody(created, 201, MediaItemResponse);

  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "album",
    externalReference: null,
    metadata: {
      title: "Демо в гаражі",
      originalTitle: "Garage Demo",
      ukrainianTitle: null,
      year: 2024,
      coverUrls: null,
      artistCredit: "Сусіди, Друзі сусідів",
      artists: ["Сусіди", "Друзі сусідів"],
      primaryType: null,
      secondaryTypes: [],
      url: null,
    },
  });
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "album", query: "гаражі" });
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
  const films = loggedInApi.catalog.searchCatalog({ mediaType: "film", query: "гаражі" });
  expect((await expectBody(films)).manualResults).toEqual([]);
  const theirs = otherUserClient.catalog.getMediaItemHistory(mediaItem.id);
  expect((await theirs).status()).toBe(404);
});

test("a manual album with the title and year of another of the User's albums is a possible duplicate", async ({
  loggedInApi,
}) => {
  await manualAlbum(loggedInApi, { title: "Демо", year: 2024 });
  const post = (mediaType: "film" | "album", title: string, year: number) => {
    return loggedInApi.catalog.addManualMediaItem({ mediaType, title, year });
  };

  const again = post("album", " демо ", 2024);

  expect(await expectBody(again, 409)).toEqual({ error: "possible_duplicate" });
  // A film of that title and year, or the album in another year, is another work.
  expect((await post("film", "Демо", 2024)).status()).toBe(201);
  expect((await post("album", "Демо", 2025)).status()).toBe(201);
  const anyway = loggedInApi.catalog.addManualMediaItem({
    mediaType: "album",
    title: "Демо",
    year: 2024,
    allowDuplicate: true,
  });
  expect((await anyway).status()).toBe(201);
});

test("a manual album takes no film's details, and no year before recordings", async ({
  loggedInApi,
}) => {
  for (const details of [{ runtime: 45 }, { genres: ["Drama"] }, { year: 1700 }]) {
    const created = loggedInApi.catalog.addManualMediaItem({
      mediaType: "album",
      title: "Demo",
      ...details,
    } as never);
    expect((await created).status(), JSON.stringify(details)).toBe(400);
  }
  const mediaItem = await manualAlbum(loggedInApi, { title: "Demo" });
  for (const changes of [{ runtime: 45 }, { genres: ["Drama"] }, { year: 1700 }]) {
    const patch = loggedInApi.catalog.updateManualMediaItem(mediaItem.id, changes as never);
    expect(await expectBody(patch, 400), JSON.stringify(changes)).toEqual({
      error: "invalid_request",
    });
  }
});

test("the User edits a manual album, its artists among it, and deleting it deletes their Log Entries for it", async ({
  loggedInApi,
}) => {
  const mediaItem = await manualAlbum(loggedInApi, { title: "Demo", year: 2023 });
  await expectBody(loggedInApi.log.createLogEntry({ mediaItemId: mediaItem.id, rating: 4 }), 201);
  const patch = (changes: ManualMediaItemEditRequest) => {
    return loggedInApi.catalog.updateManualMediaItem(mediaItem.id, changes);
  };

  const edited = await expectBody(
    patch({ title: "Демо", originalTitle: "Demo", year: 2024, authors: ["Сусіди"] }),
    200,
    MediaItemResponse,
  );

  expect(edited.mediaItem.metadata).toMatchObject({
    title: "Демо",
    originalTitle: "Demo",
    year: 2024,
    artistCredit: "Сусіди",
    artists: ["Сусіди"],
  });
  const manual = loggedInApi.catalog.getManualMediaItem(mediaItem.id);
  expect(await expectBody(manual, 200, ManualMediaItemResponse)).toEqual({
    mediaItem: edited.mediaItem,
    usage: { logEntries: 1, listItems: 0 },
  });
  expect((await loggedInApi.catalog.deleteManualMediaItem(mediaItem.id)).status()).toBe(204);
  const gone = await loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(gone.status()).toBe(404);
  const { items } = await expectBody(loggedInApi.library.getLibrary({ mediaType: "album" }));
  expect(items).toEqual([]);
});
