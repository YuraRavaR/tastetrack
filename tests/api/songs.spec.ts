import {
  CatalogSearchResponse,
  type CatalogSearchResult,
  type ManualMediaItemEditRequest,
  ManualMediaItemResponse,
  MediaItemListsResponse,
  MediaItemResponse,
  SharedListResponse,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { test as base, expect } from "../support/fixtures";
import { callsRealMusicBrainz, coverArt, zemlya } from "../support/scenarios/albums";
import {
  brookeCoverGroupId,
  brookeCoverId,
  karmaPolice,
  karmaPoliceCompilationId,
  karmaPoliceId,
  karmaPoliceLiveIds,
  karmaPoliceSingleId,
  karmaPoliceWithStipeId,
  manualSong,
  mergedSongId,
  obiimy,
  obiimyBonusTrackId,
  obiimyId,
  obiimyRemixId,
  okComputerId,
  recordingPage,
  runningUpThatHillRemixId,
  shumId,
  shumRadioEditId,
  shumSingleId,
  shumVideoIds,
  songReference,
  songSearchResult,
  songSearchResults,
  stefaniaEpId,
  stefaniaId,
  stefaniaKaraokeId,
  stefaniaRemixId,
  zemlyaGroupId,
} from "../support/scenarios/songs";
import { withMusicBrainzBusy } from "../support/test-hooks-secret";

// Locally the Worker calls a MusicBrainz fake with fixed data; on staging, the real MusicBrainz.
// So these tests use only the recordings the fake mirrors, and skip what only the fake can promise.

// `visitor` is a client with no session, holding nothing but a Share Link.
const test = base.extend<{ visitor: ApiClient }>({
  visitor: async ({ createApiClient }, use) => {
    await use(await createApiClient());
  },
});

const ids = (results: CatalogSearchResult[]) => results.map((r) => r.externalReference.id);

async function createList(api: ApiClient, name: string, mediaType: "song" | "album" | "film") {
  return (await expectBody(api.lists.createList({ name, mediaType }), 201)).list;
}

test("searching songs finds Karma Police first, once, with its artist, year, album and cover, and no live recording", async ({
  loggedInApi,
}) => {
  const search = loggedInApi.catalog.searchCatalog({
    mediaType: "song",
    query: "Karma Police Radiohead",
  });

  const { results } = await expectBody(search, 200, CatalogSearchResponse);

  expect(results[0]).toEqual({
    externalReference: songReference(karmaPoliceId),
    title: "Karma Police",
    originalTitle: "Karma Police",
    year: 1997,
    posterUrl: coverArt(okComputerId, 250),
    titleLanguage: "en",
    authors: [],
    artistCredit: "Radiohead",
    album: "OK Computer",
    disambiguation: null,
    // Null until a test adds it to the catalog.
    mediaItemId: results[0]?.mediaItemId,
    inLog: false,
    inBacklog: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  });
  // Radiohead's other recordings of it, on a compilation and its single, are the same song.
  expect(ids(results)).not.toContain(karmaPoliceCompilationId);
  expect(ids(results)).not.toContain(karmaPoliceSingleId);
  for (const live of karmaPoliceLiveIds) expect(ids(results)).not.toContain(live);
  // With another artist credited, or as a cover, it is a song of its own.
  expect(ids(results)).toEqual(expect.arrayContaining([karmaPoliceWithStipeId, brookeCoverId]));
  for (const r of results) {
    expect(r).not.toHaveProperty("primaryType");
    expect(r).not.toHaveProperty("platforms");
  }
});

test("a Cyrillic song search finds Обійми from Земля first, and its bonus track and remix as songs of their own", async ({
  loggedInApi,
}) => {
  const results = await songSearchResults(loggedInApi, "Обійми Океан Ельзи");

  expect(results[0]).toMatchObject({
    externalReference: songReference(obiimyId),
    title: "Обійми",
    year: 2013,
    artistCredit: "Океан Ельзи",
    album: "Земля",
    posterUrl: coverArt(zemlyaGroupId, 250),
    titleLanguage: "uk",
  });
  expect(ids(results)).toEqual(expect.arrayContaining([obiimyBonusTrackId, obiimyRemixId]));
  expect(new Set(ids(results)).size).toBe(results.length);
});

test("a song search shows the disambiguation, and no music video", async ({ loggedInApi }) => {
  const results = await songSearchResults(loggedInApi, "Шум Go_A");

  expect(results[0]).toMatchObject({
    externalReference: songReference(shumId),
    title: "Шум",
    year: 2021,
    artistCredit: "Go_A",
    disambiguation: "original version",
    // A single is no album, but its cover is the song's.
    album: null,
    posterUrl: coverArt(shumSingleId, 250),
  });
  expect(ids(results)).toContain(shumRadioEditId);
  for (const video of shumVideoIds) expect(ids(results)).not.toContain(video);
});

test("a song search hides a karaoke version, and a remix on no Official release has no album or cover", async ({
  loggedInApi,
}) => {
  const results = await songSearchResults(loggedInApi, "Stefania Kalush");

  expect(results[0]).toMatchObject({
    externalReference: songReference(stefaniaId),
    artistCredit: "Kalush Orchestra",
    disambiguation: "Ukraine, Eurovision 2022 entry",
    album: null,
    posterUrl: coverArt(stefaniaEpId, 250),
  });
  expect(ids(results)).not.toContain(stefaniaKaraokeId);
  expect(
    results.find((r: CatalogSearchResult) => r.externalReference.id === stefaniaRemixId),
  ).toMatchObject({
    album: null,
    posterUrl: null,
  });
});

test("a song search finds no albums, and an album search no songs", async ({ loggedInApi }) => {
  const songs = await songSearchResults(loggedInApi, "Обійми Океан Ельзи");
  const albums = await expectBody(
    loggedInApi.catalog.searchCatalog({ mediaType: "album", query: "Земля Океан Ельзи" }),
  );

  expect(songs.every((r: CatalogSearchResult) => r.externalReference.mediaType === "song")).toBe(
    true,
  );
  expect(
    albums.results.every((r: CatalogSearchResult) => r.externalReference.mediaType === "album"),
  ).toBe(true);
});

test("a song's cover comes from the Cover Art Archive, which has none for some", async ({
  loggedInApi,
  request,
}) => {
  test.skip(callsRealMusicBrainz(), "The Cover Art Archive fake stands in for the real one");
  const withCover = await songSearchResult(loggedInApi, "Karma Police Radiohead", karmaPoliceId);
  const without = await songSearchResult(loggedInApi, "Karma Police Radiohead", brookeCoverId);

  expect(without.posterUrl).toEqual(coverArt(brookeCoverGroupId, 250));
  expect((await request.get(withCover.posterUrl ?? "")).status()).toBe(200);
  expect((await request.get(without.posterUrl ?? "")).status()).toBe(404);
});

test("a song search MusicBrainz answers 503 is asked again once, and finds its songs", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");

  const search = loggedInApi.catalog.searchCatalog(
    { mediaType: "song", query: "Шум Go_A" },
    withMusicBrainzBusy(1),
  );

  const { results } = await expectBody(search, 200);
  expect(results[0].externalReference).toEqual(songReference(shumId));
});

test("a song search MusicBrainz answers 503 twice is a 503 that says MusicBrainz is busy", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");

  const search = loggedInApi.catalog.searchCatalog(
    { mediaType: "song", query: "Шум Go_A" },
    withMusicBrainzBusy(2),
  );

  expect(await expectBody(search, 503)).toEqual({ error: "catalog_busy" });
});

// Обійми and the merged recording are taken out of the cache by these tests alone, which run one
// after another. Out of the cache, adding them makes the details call, whatever earlier runs left
// in local D1.
test("adding a song stores its title, year, artists, album, disambiguation and MusicBrainz page", async ({
  loggedInApi,
}) => {
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(songReference(obiimyId));
  expect(evicted.status()).toBe(204);
  const result = await songSearchResult(loggedInApi, "Обійми Океан Ельзи", obiimyId);

  const added = await loggedInApi.catalog.addCatalogItem(result);

  expect([200, 201]).toContain(added.status());
  const { mediaItem } = MediaItemResponse.parse(await added.json());
  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "song",
    externalReference: songReference(obiimyId),
    metadata: {
      title: "Обійми",
      originalTitle: "Обійми",
      ukrainianTitle: null,
      year: 2013,
      coverUrls: { small: coverArt(zemlyaGroupId, 250), large: coverArt(zemlyaGroupId, 500) },
      artistCredit: "Океан Ельзи",
      artists: ["Океан Ельзи"],
      album: "Земля",
      disambiguation: null,
      url: recordingPage(obiimyId),
    },
  });
  const page = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItem.id));
  expect(page).toMatchObject({ about: null, logEntries: [], thoughts: [], inProgress: null });
});

test("adding a song while MusicBrainz is busy keeps it as search found it", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(songReference(obiimyId));
  expect(evicted.status()).toBe(204);
  const result = await songSearchResult(loggedInApi, "Обійми Океан Ельзи", obiimyId);

  const added = await loggedInApi.catalog.addCatalogItem(result, withMusicBrainzBusy(2));

  expect([200, 201]).toContain(added.status());
  const { mediaItem } = await added.json();
  expect(mediaItem.metadata).toMatchObject({
    title: "Обійми",
    year: 2013,
    coverUrls: { small: coverArt(zemlyaGroupId, 250) },
    artistCredit: null,
    album: null,
  });
  // The next add fills in the rest.
  const again = await expectBody(loggedInApi.catalog.addCatalogItem(result), 200);
  expect(again.mediaItem.metadata).toMatchObject({ artistCredit: "Океан Ельзи", album: "Земля" });
});

test("a merged recording is added through MusicBrainz's redirect, under the MBID asked for", async ({
  loggedInApi,
}) => {
  const evicted = await loggedInApi.testHooks.evictFromCatalogCache(songReference(mergedSongId));
  expect(evicted.status()).toBe(204);

  const added = loggedInApi.catalog.addCatalogItem({
    externalReference: songReference(mergedSongId),
    title: "Running Up That Hill",
    originalTitle: "Running Up That Hill",
    year: null,
    posterUrl: null,
    titleLanguage: "en",
  });

  const { mediaItem } = MediaItemResponse.parse(await (await added).json());
  expect(mediaItem).toMatchObject({
    externalReference: songReference(mergedSongId),
    metadata: {
      title: "Running up That Hill (A Deal With God) (2012 remix)",
      year: 2012,
      artistCredit: "Kate Bush",
      url: recordingPage(runningUpThatHillRemixId),
    },
  });
});

test("a song is added only under MusicBrainz, with a recording's MBID", async ({ loggedInApi }) => {
  const result = await songSearchResult(loggedInApi, "Шум Go_A", shumId);

  for (const externalReference of [
    { source: "tmdb", mediaType: "song", id: shumId },
    { source: "musicbrainz", mediaType: "song", id: "shum" },
    { source: "musicbrainz", mediaType: "song", id: shumId.toUpperCase() },
  ]) {
    const response = await loggedInApi.catalog.addCatalogItem({
      ...result,
      externalReference,
    } as never);
    expect(response.status(), JSON.stringify(externalReference)).toBe(400);
  }
});

test("a List of songs holds songs and refuses an album, and a List of albums refuses a song", async ({
  loggedInApi,
}) => {
  const songItem = await obiimy(loggedInApi);
  const albumItem = await zemlya(loggedInApi);
  const songs = await createList(loggedInApi, "Favourite songs", "song");
  const albums = await createList(loggedInApi, "Ukrainian rock", "album");

  const added = loggedInApi.lists.addListItem(songs.id, {
    mediaItemId: songItem.id,
    note: "The chorus.",
  });

  expect((await expectBody(added, 201)).listItem).toEqual({
    id: expect.any(Number),
    mediaItem: songItem,
    position: 0,
    note: "The chorus.",
  });
  const albumInSongs = loggedInApi.lists.addListItem(songs.id, { mediaItemId: albumItem.id });
  expect(await expectBody(albumInSongs, 400)).toEqual({ error: "wrong_media_type" });
  const songInAlbums = loggedInApi.lists.addListItem(albums.id, { mediaItemId: songItem.id });
  expect(await expectBody(songInAlbums, 400)).toEqual({ error: "wrong_media_type" });
  const { list } = await expectBody(loggedInApi.lists.getList(songs.id));
  expect(list).toMatchObject({ mediaType: "song", items: [{ mediaItem: songItem }] });
});

test("anyone with the link sees a List of songs, in its order, with its Notes", async ({
  loggedInApi,
  loggedInUser,
  visitor,
}) => {
  const list = await createList(loggedInApi, "For the road", "song");
  const [first, second] = [await obiimy(loggedInApi), await karmaPolice(loggedInApi)];
  await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: first.id, note: "Loud." }),
    201,
  );
  const moved = await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: second.id }),
    201,
  );
  await expectBody(loggedInApi.listItems.updateListItem(moved.listItem.id, { position: 0 }));
  const { shareLink } = await expectBody(loggedInApi.lists.createShareLink(list.id), 201);

  const { sharedList } = await expectBody(
    visitor.sharedLists.getSharedList(shareLink.token),
    200,
    SharedListResponse,
  );

  expect(sharedList).toEqual({
    title: "For the road",
    description: null,
    mediaType: "song",
    owner: { displayName: loggedInUser.username },
    items: [
      { mediaItem: second, position: 0, note: null },
      { mediaItem: first, position: 1, note: "Loud." },
    ],
  });
  expect(sharedList.items[0]?.mediaItem.metadata).toMatchObject({
    title: "Karma Police",
    artistCredit: "Radiohead",
    album: "OK Computer",
  });
});

test("a song can't be Planned, logged, started or given a Thought, and no Library or Backlog holds songs", async ({
  loggedInApi,
}) => {
  const mediaItem = await obiimy(loggedInApi);
  const list = await createList(loggedInApi, "Favourite songs", "song");
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: mediaItem.id }), 201);
  const mediaItemId = mediaItem.id;

  const planned = loggedInApi.backlog.addBacklogItem({ mediaItemId });
  const logged = loggedInApi.log.createLogEntry({ mediaItemId, rating: 5 });
  const started = loggedInApi.inProgress.start({ mediaItemId });
  const thought = loggedInApi.thoughts.createThought(mediaItemId, {
    text: "Обійми мене.",
    date: "2026-11-22",
  });

  expect(await expectBody(planned, 400)).toEqual({ error: "wrong_media_type" });
  expect(await expectBody(logged, 400)).toEqual({ error: "wrong_media_type" });
  expect(await expectBody(started, 400)).toEqual({ error: "not_progressable" });
  expect(await expectBody(thought, 400)).toEqual({ error: "wrong_media_type" });
  const backlog = loggedInApi.backlog.getBacklog({ mediaType: "song" } as never);
  expect(await expectBody(backlog, 400)).toEqual({ error: "invalid_request" });
  const library = await expectBody(loggedInApi.library.getLibrary({ mediaType: "song" }));
  expect(library.items).toEqual([]);
  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItemId));
  expect(history).toMatchObject({ logEntries: [], thoughts: [], inProgress: null });
});

test("a song's Lists come with the one last added to first, then the empty ones oldest first, each with its first song", async ({
  loggedInApi,
}) => {
  const [obiimyItem, karmaPoliceItem] = [await obiimy(loggedInApi), await karmaPolice(loggedInApi)];
  const empty = await createList(loggedInApi, "Empty", "song");
  const road = await createList(loggedInApi, "For the road", "song");
  const favourites = await createList(loggedInApi, "Favourite songs", "song");
  const later = await createList(loggedInApi, "Later", "song");
  const add = (listId: number, mediaItemId: number, minutes: number) =>
    expectBody(
      loggedInApi.lists.addListItem(listId, { mediaItemId }, at(minutesAgo(minutes))),
      201,
    );
  await add(road.id, karmaPoliceItem.id, 30);
  await add(favourites.id, karmaPoliceItem.id, 20);
  // For the road was added to last, though Karma Police came first in it.
  const held = await add(road.id, obiimyItem.id, 10);

  const { lists } = await expectBody(
    loggedInApi.catalog.getMediaItemLists(obiimyItem.id),
    200,
    MediaItemListsResponse,
  );

  expect(lists.map((list: { name: string }) => list.name)).toEqual([
    "For the road",
    "Favourite songs",
    "Empty",
    "Later",
  ]);
  expect(lists[0]).toEqual({
    ...road,
    itemCount: 2,
    listItem: { id: held.listItem.id, position: 1, note: null },
    firstMediaItem: karmaPoliceItem,
  });
  expect(lists[1]).toMatchObject({ listItem: null, firstMediaItem: karmaPoliceItem });
  expect(lists[2]).toEqual({ ...empty, listItem: null, firstMediaItem: null });
  expect(lists[3]).toEqual({ ...later, listItem: null, firstMediaItem: null });
});

test("a taken List name says the Media Type of the List that has it, on making and on renaming", async ({
  loggedInApi,
}) => {
  await createList(loggedInApi, "For the road", "album");
  const songs = await createList(loggedInApi, "Favourite songs", "song");

  const made = loggedInApi.lists.createList({ name: "for the road", mediaType: "song" });
  const renamed = loggedInApi.lists.updateList(songs.id, { name: "FOR THE ROAD" });

  expect(await expectBody(made, 409)).toEqual({ error: "list_name_taken", mediaType: "album" });
  expect(await expectBody(renamed, 409)).toEqual({ error: "list_name_taken", mediaType: "album" });
  const again = loggedInApi.lists.createList({ name: "Favourite songs", mediaType: "film" });
  expect(await expectBody(again, 409)).toEqual({ error: "list_name_taken", mediaType: "song" });
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds, and filling what
// the cache is missing writes it back in one.
test("a List with 1 song and one with 500 load in the same number of queries, on a cold cache", async ({
  loggedInApi,
}) => {
  const mediaItemId = (await obiimy(loggedInApi)).id;
  const queriesForListOf = async (songs: number) => {
    const list = await createList(loggedInApi, `${songs} songs`, "song");
    await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId }), 201);
    if (songs > 1) {
      expect((await loggedInApi.testHooks.fillList(list.id, songs - 1)).status()).toBe(204);
    }
    const evicted = await loggedInApi.testHooks.evictFromCatalogCache(songReference(obiimyId));
    expect(evicted.status()).toBe(204);
    const response = await loggedInApi.lists.getList(list.id);
    const { items } = (await response.json()).list;
    expect(items).toHaveLength(songs);
    expect(items[0].mediaItem.metadata?.title).toBe("Обійми");
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForListOf(1);
  const fiveHundred = await queriesForListOf(500);

  expect(one).toMatch(/^\d+$/);
  expect(fiveHundred).toBe(one);
});

test("a User adds a song by hand with a title, an Original Title, its artists and a year", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const created = loggedInApi.catalog.addManualMediaItem({
    mediaType: "song",
    title: " Пісня з гаража ",
    originalTitle: "Garage Song",
    authors: ["Сусіди", " ", "Друзі сусідів"],
    year: 2024,
  });

  const { mediaItem } = await expectBody(created, 201, MediaItemResponse);

  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "song",
    externalReference: null,
    metadata: {
      title: "Пісня з гаража",
      originalTitle: "Garage Song",
      ukrainianTitle: null,
      year: 2024,
      coverUrls: null,
      artistCredit: "Сусіди, Друзі сусідів",
      artists: ["Сусіди", "Друзі сусідів"],
      album: null,
      disambiguation: null,
      url: null,
    },
  });
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "song", query: "гаража" });
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
  const albums = loggedInApi.catalog.searchCatalog({ mediaType: "album", query: "гаража" });
  expect((await expectBody(albums)).manualResults).toEqual([]);
  const theirs = otherUserClient.catalog.getMediaItemHistory(mediaItem.id);
  expect((await theirs).status()).toBe(404);
});

test("a manual song with the title and year of another of the User's songs is a possible duplicate", async ({
  loggedInApi,
}) => {
  await manualSong(loggedInApi, { title: "Демо", year: 2024 });
  const post = (mediaType: "album" | "song", title: string, year?: number) => {
    return loggedInApi.catalog.addManualMediaItem({ mediaType, title, year });
  };

  const again = post("song", " демо ", 2024);

  expect(await expectBody(again, 409)).toEqual({ error: "possible_duplicate" });
  // An album of that title and year, or the song in another year, is another work.
  expect((await post("album", "Демо", 2024)).status()).toBe(201);
  expect((await post("song", "Демо", 2025)).status()).toBe(201);
  const anyway = loggedInApi.catalog.addManualMediaItem({
    mediaType: "song",
    title: "Демо",
    year: 2024,
    allowDuplicate: true,
  });
  expect((await anyway).status()).toBe(201);
});

test("a manual song takes no film's details, and no year before recordings", async ({
  loggedInApi,
}) => {
  for (const details of [{ runtime: 4 }, { genres: ["Drama"] }, { year: 1700 }]) {
    const created = loggedInApi.catalog.addManualMediaItem({
      mediaType: "song",
      title: "Demo",
      ...details,
    } as never);
    expect((await created).status(), JSON.stringify(details)).toBe(400);
  }
  const mediaItem = await manualSong(loggedInApi, { title: "Demo" });
  expect(mediaItem.metadata).toMatchObject({ year: null, artists: [], artistCredit: null });
  for (const changes of [{ runtime: 4 }, { genres: ["Drama"] }, { year: 1700 }]) {
    const patch = loggedInApi.catalog.updateManualMediaItem(mediaItem.id, changes as never);
    expect(await expectBody(patch, 400), JSON.stringify(changes)).toEqual({
      error: "invalid_request",
    });
  }
});

test("the User edits a manual song, its artists among it, and deleting it takes it off their Lists", async ({
  loggedInApi,
}) => {
  const mediaItem = await manualSong(loggedInApi, { title: "Demo", year: 2023 });
  const list = await createList(loggedInApi, "Garage", "song");
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: mediaItem.id }), 201);
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
    usage: { logEntries: 0, listItems: 1 },
  });
  expect((await loggedInApi.catalog.deleteManualMediaItem(mediaItem.id)).status()).toBe(204);
  const gone = await loggedInApi.catalog.getMediaItemHistory(mediaItem.id);
  expect(gone.status()).toBe(404);
  expect((await expectBody(loggedInApi.lists.getList(list.id))).list.items).toEqual([]);
});
