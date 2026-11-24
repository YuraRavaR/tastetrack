import {
  type AddCatalogItemRequest,
  CatalogSearchResponse,
  type CatalogSearchResult,
  type ManualMediaItemEditRequest,
  ManualMediaItemResponse,
  MediaItemResponse,
  SharedListResponse,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { test as base, expect } from "../support/fixtures";
import { callsRealMusicBrainz, coverArt, zemlya, zemlyaId } from "../support/scenarios/albums";
import {
  aliceCooperBandId,
  aliceCooperId,
  artistPage,
  artistReference,
  artistSearchResult,
  artistSearchResults,
  celticPinkFloydId,
  commonsPhoto,
  kalushId,
  kalushOrchestraId,
  manualArtist,
  mergedArtistId,
  nirvanaUkId,
  okeanElzy,
  okeanElzyId,
  pinkFloydId,
  radiohead,
  radioheadId,
  taylorDeeId,
  unknownId,
  variousArtistsBristolId,
  variousArtistsId,
  variousArtistsTechnoId,
} from "../support/scenarios/artists";
import { withMusicBrainzBusy } from "../support/test-hooks-secret";

// Locally the Worker calls a MusicBrainz fake and a Wikimedia fake with fixed data; on staging,
// the real ones. So these tests use only the artists the fakes mirror, and skip what only the
// fakes can promise.

// `visitor` is a client with no session, holding nothing but a Share Link.
const test = base.extend<{ visitor: ApiClient }>({
  visitor: async ({ createApiClient }, use) => {
    await use(await createApiClient());
  },
});

async function createList(api: ApiClient, name: string, mediaType: "artist" | "album") {
  return (await expectBody(api.lists.createList({ name, mediaType }), 201)).list;
}

// Adds a search result's artist, whose Media Item earlier runs may have made already.
async function add(api: ApiClient, result: AddCatalogItemRequest) {
  const response = await api.catalog.addCatalogItem(result);
  expect([200, 201]).toContain(response.status());
  const body = await response.json();
  MediaItemResponse.parse(body);
  return body.mediaItem;
}

// Takes an artist out of the catalog cache, so that adding them makes the details calls. Only
// these tests take these artists out, one after another, whatever earlier runs left in local D1.
async function evict(api: ApiClient, id: string) {
  expect((await api.testHooks.evictFromCatalogCache(artistReference(id))).status()).toBe(204);
}

test("searching artists finds Океан Ельзи in Cyrillic and by a Latin alias, with their facts and no photo", async ({
  loggedInApi,
}) => {
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "artist", query: "Океан Ельзи" });

  const { results } = await expectBody(search, 200, CatalogSearchResponse);

  const { mediaItemId: _mediaItemId, ...first } = results[0] ?? {};
  expect(first).toEqual({
    externalReference: artistReference(okeanElzyId),
    title: "Океан Ельзи",
    originalTitle: "Океан Ельзи",
    year: 1994,
    posterUrl: null,
    titleLanguage: "uk",
    authors: [],
    artistType: "Group",
    country: "UA",
    endYear: null,
    disambiguation: null,
    inLog: false,
    inBacklog: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  });
  const latin = await artistSearchResults(loggedInApi, "Okean Elzy");
  expect(latin[0]).toMatchObject({ title: "Океан Ельзи", titleLanguage: "en" });
});

test("artist search hides Various Artists and [unknown], and keeps real artists of those names", async ({
  loggedInApi,
}) => {
  const various = await artistSearchResults(loggedInApi, "Various Artists");
  const unknown = await artistSearchResults(loggedInApi, "[unknown]");

  const ids = various.map((result: CatalogSearchResult) => result.externalReference.id);
  expect(ids).not.toContain(variousArtistsId);
  expect(ids).toEqual(expect.arrayContaining([variousArtistsTechnoId, variousArtistsBristolId]));
  expect(unknown.map((result: CatalogSearchResult) => result.externalReference.id)).not.toContain(
    unknownId,
  );
});

test("artist search keeps MusicBrainz's order, so the artist a query names in full comes first", async ({
  loggedInApi,
}) => {
  const kalush = await artistSearchResults(loggedInApi, "Kalush");
  const orchestra = await artistSearchResults(loggedInApi, "kalush orchestra");
  const aliceCooper = await artistSearchResults(loggedInApi, "Alice Cooper");

  expect(
    kalush.slice(0, 2).map((result: CatalogSearchResult) => result.externalReference.id),
  ).toEqual([kalushId, kalushOrchestraId]);
  // Every word must match, so no other orchestra comes up.
  expect(orchestra.map((result: CatalogSearchResult) => result.externalReference.id)).toEqual([
    kalushOrchestraId,
  ]);
  expect(aliceCooper.slice(0, 2)).toMatchObject([
    {
      externalReference: artistReference(aliceCooperId),
      artistType: "Person",
      year: 1948,
      endYear: null,
      disambiguation: "the singer, active as a solo artist 1975–present",
    },
    {
      externalReference: artistReference(aliceCooperBandId),
      artistType: "Group",
      year: 1964,
      endYear: 1975,
      disambiguation: "the band, active 1964–1974/5",
    },
  ]);
});

test("an artist search with no letter or digit finds nothing", async ({ loggedInApi }) => {
  expect(await artistSearchResults(loggedInApi, "!!! & ?")).toEqual([]);
});

test("an artist search MusicBrainz answers 503 is asked again once, and 503 twice says MusicBrainz is busy", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");
  const query = { mediaType: "artist", query: "Radiohead" } as const;

  const once = loggedInApi.catalog.searchCatalog(query, withMusicBrainzBusy(1));
  const twice = loggedInApi.catalog.searchCatalog(query, withMusicBrainzBusy(2));

  expect((await expectBody(once)).results[0]).toMatchObject({ title: "Radiohead" });
  expect(await expectBody(twice, 503)).toEqual({ error: "catalog_busy" });
});

test("adding an artist stores their facts, photo with its credit, MusicBrainz page and albums, oldest first", async ({
  loggedInApi,
}) => {
  await evict(loggedInApi, okeanElzyId);
  const result = await artistSearchResult(loggedInApi, "Океан Ельзи", okeanElzyId);

  const mediaItem = await add(loggedInApi, result);

  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "artist",
    externalReference: artistReference(okeanElzyId),
    metadata: {
      title: "Океан Ельзи",
      originalTitle: "Океан Ельзи",
      ukrainianTitle: null,
      year: 1994,
      endYear: null,
      artistType: "Group",
      country: "UA",
      disambiguation: null,
      photoUrls: {
        small: commonsPhoto("OkeanElzi25.jpg", 250),
        large: commonsPhoto("OkeanElzi25.jpg", 500),
      },
      photoCredit: {
        author: "Alexander Khanin",
        licence: "CC BY-SA 4.0",
        url: "https://commons.wikimedia.org/wiki/File:OkeanElzi25.jpg",
      },
      url: artistPage(okeanElzyId),
    },
  });
  const page = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItem.id));
  expect(page).toMatchObject({ logEntries: [], thoughts: [], inProgress: null });
  const { albums } = page.about;
  expect(albums.slice(0, 3)).toEqual([
    {
      mbid: "09973323-973e-3b4c-af61-a579f2c201d0",
      title: "Там, де нас нема",
      year: 1998,
      primaryType: "Album",
      coverUrls: {
        small: coverArt("09973323-973e-3b4c-af61-a579f2c201d0", 250),
        large: coverArt("09973323-973e-3b4c-af61-a579f2c201d0", 500),
      },
    },
    expect.objectContaining({ title: "Янанебібув", year: 2000 }),
    expect.objectContaining({ title: "Модель", year: 2001 }),
  ]);
  expect(albums.find((album: { mbid: string }) => album.mbid === zemlyaId)).toMatchObject({
    title: "Земля",
    year: 2013,
  });
});

test("an ended group's page has their years, their country from MusicBrainz's code, a public-domain photo and their soundtracks", async ({
  loggedInApi,
}) => {
  await evict(loggedInApi, pinkFloydId);
  const result = await artistSearchResult(loggedInApi, "Pink Floyd", pinkFloydId);

  const mediaItem = await add(loggedInApi, result);

  expect(mediaItem.metadata).toMatchObject({
    year: 1965,
    endYear: 2014,
    country: "GB",
    photoCredit: { author: "Capitol Records", licence: "Public domain" },
  });
  const { about } = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItem.id));
  const titles = about.albums.map((album: { title: string }) => album.title);
  expect(titles.slice(0, 4)).toEqual([
    "The Piper at the Gates of Dawn",
    "A Saucerful of Secrets",
    "More",
    "Ummagumma",
  ]);
  expect(about.albums).toContainEqual(
    expect.objectContaining({ title: "London 1966/1967", year: 1995, primaryType: "EP" }),
  );
});

test("an artist's photo is their Wikidata entity's preferred image before one of normal rank", async ({
  loggedInApi,
}) => {
  await evict(loggedInApi, kalushOrchestraId);
  const result = await artistSearchResult(loggedInApi, "Kalush Orchestra", kalushOrchestraId);

  const mediaItem = await add(loggedInApi, result);

  const file =
    "- EU2024BE Informal meeting of EU Affairs Ministers BOZAR JNZT 0103 (53687141247).jpg";
  expect(mediaItem.metadata.photoUrls).toEqual({
    small: commonsPhoto(file, 250),
    large: commonsPhoto(file, 500),
  });
  expect(mediaItem.metadata.photoCredit).toEqual({
    author: "Belgian Presidency of the Council of the EU 2024 from Belgium",
    licence: "CC BY 2.0",
    url: expect.stringContaining("commons.wikimedia.org/wiki/File:-_EU2024BE"),
  });
});

test("an artist with no Wikidata link, or none with an image, has no photo, and the rest of their details", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the fakes promise which artists have no photo");
  await evict(loggedInApi, celticPinkFloydId);
  await evict(loggedInApi, nirvanaUkId);

  for (const [query, id] of [
    ["Celtic Pink Floyd", celticPinkFloydId],
    ["Nirvana", nirvanaUkId],
  ] as const) {
    const result = await artistSearchResult(loggedInApi, query, id);
    const mediaItem = await add(loggedInApi, result);
    expect(mediaItem.metadata, query).toMatchObject({
      photoUrls: null,
      photoCredit: null,
      url: artistPage(id),
    });
  }
});

test("Wikimedia failing leaves the initials, and the add keeps every other detail, as one that worked", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the Wikimedia fake fails");
  await evict(loggedInApi, aliceCooperId);
  const result = await artistSearchResult(loggedInApi, "Alice Cooper", aliceCooperId);

  const added = { mediaItem: await add(loggedInApi, result) };

  expect(added.mediaItem.metadata).toMatchObject({
    photoUrls: null,
    photoCredit: null,
    artistType: "Person",
    country: "US",
    url: artistPage(aliceCooperId),
  });
  const page = await expectBody(loggedInApi.catalog.getMediaItemHistory(added.mediaItem.id));
  expect(page.about).toEqual({ mediaType: "artist", albums: [] });
  // The details are in, so adding again makes no call and changes nothing.
  const again = await expectBody(loggedInApi.catalog.addCatalogItem(result), 200);
  expect(again.mediaItem).toEqual(added.mediaItem);
});

test("adding an artist while MusicBrainz is busy keeps them as search found them, until the next add", async ({
  loggedInApi,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");
  // Only this test adds KALUSH.
  await evict(loggedInApi, kalushId);
  const result = await artistSearchResult(loggedInApi, "Kalush", kalushId);

  const busy = await loggedInApi.catalog.addCatalogItem(result, withMusicBrainzBusy(2));

  expect([200, 201]).toContain(busy.status());
  expect((await busy.json()).mediaItem.metadata).toEqual({
    title: "KALUSH",
    originalTitle: "KALUSH",
    ukrainianTitle: null,
    year: 2019,
    endYear: null,
    artistType: null,
    country: null,
    disambiguation: null,
    photoUrls: null,
    photoCredit: null,
    url: null,
  });
  const again = await expectBody(loggedInApi.catalog.addCatalogItem(result), 200);
  expect(again.mediaItem.metadata).toMatchObject({
    artistType: "Group",
    country: "UA",
    url: artistPage(kalushId),
  });
});

test("a merged artist is added through MusicBrainz's redirect, under the MBID asked for", async ({
  loggedInApi,
}) => {
  await evict(loggedInApi, mergedArtistId);

  const added = loggedInApi.catalog.addCatalogItem({
    externalReference: artistReference(mergedArtistId),
    title: "Taylor Dee",
    originalTitle: "Taylor Dee",
    year: null,
    posterUrl: null,
    titleLanguage: "en",
  });

  const { mediaItem } = MediaItemResponse.parse(await (await added).json());
  expect(mediaItem).toMatchObject({
    externalReference: artistReference(mergedArtistId),
    metadata: { title: "Taylor Dee", year: 1987, endYear: 2021, url: artistPage(taylorDeeId) },
  });
});

test("an artist is added only under MusicBrainz, with an artist's MBID", async ({
  loggedInApi,
}) => {
  const result = await artistSearchResult(loggedInApi, "Radiohead", radioheadId);

  for (const externalReference of [
    { source: "tmdb", mediaType: "artist", id: result.externalReference.id },
    { source: "musicbrainz", mediaType: "artist", id: "radiohead" },
    { source: "musicbrainz", mediaType: "artist", id: result.externalReference.id.toUpperCase() },
  ]) {
    const response = await loggedInApi.catalog.addCatalogItem({
      ...result,
      externalReference,
    } as never);
    expect(response.status(), JSON.stringify(externalReference)).toBe(400);
  }
});

test("a Collection of artists holds artists and refuses an album, and a Collection of albums refuses an artist", async ({
  loggedInApi,
}) => {
  const artistItem = await okeanElzy(loggedInApi);
  const albumItem = await zemlya(loggedInApi);
  const artists = await createList(loggedInApi, "Bands to show a friend", "artist");
  const albums = await createList(loggedInApi, "Ukrainian rock", "album");

  const added = loggedInApi.lists.addListItem(artists.id, {
    mediaItemId: artistItem.id,
    note: "Live, always.",
  });

  expect((await expectBody(added, 201)).listItem).toEqual({
    id: expect.any(Number),
    mediaItem: artistItem,
    position: 0,
    note: "Live, always.",
  });
  const albumInArtists = loggedInApi.lists.addListItem(artists.id, { mediaItemId: albumItem.id });
  expect(await expectBody(albumInArtists, 400)).toEqual({ error: "wrong_media_type" });
  const artistInAlbums = loggedInApi.lists.addListItem(albums.id, { mediaItemId: artistItem.id });
  expect(await expectBody(artistInAlbums, 400)).toEqual({ error: "wrong_media_type" });
  const { list } = await expectBody(loggedInApi.lists.getList(artists.id));
  expect(list).toMatchObject({ mediaType: "artist", items: [{ mediaItem: artistItem }] });
  const marks = await artistSearchResult(loggedInApi, "Океан Ельзи", okeanElzyId);
  expect(marks).toMatchObject({
    mediaItemId: artistItem.id,
    lists: [{ id: artists.id, name: "Bands to show a friend" }],
  });
});

test("anyone with the link sees a Collection of artists, in its order, with its Notes", async ({
  loggedInApi,
  loggedInUser,
  visitor,
}) => {
  const list = await createList(loggedInApi, "Bands to show a friend", "artist");
  const [first, second] = [await okeanElzy(loggedInApi), await radiohead(loggedInApi)];
  await expectBody(
    loggedInApi.lists.addListItem(list.id, { mediaItemId: first.id, note: "Start here." }),
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
    title: "Bands to show a friend",
    description: null,
    mediaType: "artist",
    owner: { displayName: loggedInUser.username },
    items: [
      { mediaItem: second, position: 0, note: null },
      { mediaItem: first, position: 1, note: "Start here." },
    ],
  });
});

test("an artist can't be Planned, logged, started or given a Thought, and no Library or Backlog holds artists", async ({
  loggedInApi,
}) => {
  const mediaItem = await okeanElzy(loggedInApi);
  const list = await createList(loggedInApi, "Bands to show a friend", "artist");
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: mediaItem.id }), 201);
  const mediaItemId = mediaItem.id;

  const planned = loggedInApi.backlog.addBacklogItem({ mediaItemId });
  const logged = loggedInApi.log.createLogEntry({ mediaItemId, rating: 5 });
  const started = loggedInApi.inProgress.start({ mediaItemId });
  const thought = loggedInApi.thoughts.createThought(mediaItemId, {
    text: "Найкращий концерт.",
    date: "2026-11-24",
  });

  expect(await expectBody(planned, 400)).toEqual({ error: "wrong_media_type" });
  expect(await expectBody(logged, 400)).toEqual({ error: "wrong_media_type" });
  expect(await expectBody(started, 400)).toEqual({ error: "not_progressable" });
  expect(await expectBody(thought, 400)).toEqual({ error: "wrong_media_type" });
  const backlog = loggedInApi.backlog.getBacklog({ mediaType: "artist" } as never);
  expect(await expectBody(backlog, 400)).toEqual({ error: "invalid_request" });
  const library = await expectBody(loggedInApi.library.getLibrary({ mediaType: "artist" }));
  expect(library.items).toEqual([]);
  const history = await expectBody(loggedInApi.catalog.getMediaItemHistory(mediaItemId));
  expect(history).toMatchObject({ logEntries: [], thoughts: [], inProgress: null });
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds, and filling what
// the cache is missing writes it back in one.
test("a Collection with 1 artist and one with 500 load in the same number of queries, on a cold cache", async ({
  loggedInApi,
}) => {
  const mediaItemId = (await okeanElzy(loggedInApi)).id;
  const queriesForListOf = async (artists: number) => {
    const list = await createList(loggedInApi, `${artists} artists`, "artist");
    await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId }), 201);
    if (artists > 1) {
      expect((await loggedInApi.testHooks.fillList(list.id, artists - 1)).status()).toBe(204);
    }
    await evict(loggedInApi, okeanElzyId);
    const response = await loggedInApi.lists.getList(list.id);
    const { items } = (await response.json()).list;
    expect(items).toHaveLength(artists);
    expect(items[0].mediaItem.metadata?.title).toBe("Океан Ельзи");
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForListOf(1);
  const fiveHundred = await queriesForListOf(500);

  expect(one).toMatch(/^\d+$/);
  expect(fiveHundred).toBe(one);
});

test("a User adds an artist by hand with a name and an Original Title, and no year", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const created = loggedInApi.catalog.addManualMediaItem({
    mediaType: "artist",
    title: " Сусіди ",
    originalTitle: "Neighbours",
  });

  const { mediaItem } = await expectBody(created, 201, MediaItemResponse);

  expect(mediaItem).toEqual({
    id: expect.any(Number),
    mediaType: "artist",
    externalReference: null,
    metadata: {
      title: "Сусіди",
      originalTitle: "Neighbours",
      ukrainianTitle: null,
      year: null,
      endYear: null,
      artistType: null,
      country: null,
      disambiguation: null,
      photoUrls: null,
      photoCredit: null,
      url: null,
    },
  });
  const search = loggedInApi.catalog.searchCatalog({ mediaType: "artist", query: "сусід" });
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
  const songs = loggedInApi.catalog.getSearchMarks({ mediaType: "song", query: "сусід", ids: "" });
  expect((await expectBody(songs)).manualResults).toEqual([]);
  const theirs = otherUserClient.catalog.getMediaItemHistory(mediaItem.id);
  expect((await theirs).status()).toBe(404);
});

test("a manual artist with the name of another of the User's artists is a possible duplicate", async ({
  loggedInApi,
}) => {
  await manualArtist(loggedInApi, { title: "Сусіди" });
  const post = (mediaType: "artist" | "song", title: string) => {
    return loggedInApi.catalog.addManualMediaItem({ mediaType, title });
  };

  const again = post("artist", " сусіди ");
  const byOriginalTitle = loggedInApi.catalog.addManualMediaItem({
    mediaType: "artist",
    title: "Neighbours",
    originalTitle: "СУСІДИ",
  });

  expect(await expectBody(again, 409)).toEqual({ error: "possible_duplicate" });
  expect(await expectBody(byOriginalTitle, 409)).toEqual({ error: "possible_duplicate" });
  // A song of that title is another Media Item.
  expect((await post("song", "Сусіди")).status()).toBe(201);
  const anyway = loggedInApi.catalog.addManualMediaItem({
    mediaType: "artist",
    title: "Сусіди",
    allowDuplicate: true,
  });
  expect((await anyway).status()).toBe(201);
});

test("a manual artist takes no year, artists, runtime or genres, on adding or editing", async ({
  loggedInApi,
}) => {
  const details = [{ year: 2020 }, { authors: ["Сусіди"] }, { runtime: 4 }, { genres: ["Drama"] }];
  for (const detail of details) {
    const created = loggedInApi.catalog.addManualMediaItem({
      mediaType: "artist",
      title: "Garage band",
      ...detail,
    } as never);
    expect((await created).status(), JSON.stringify(detail)).toBe(400);
  }
  const mediaItem = await manualArtist(loggedInApi, { title: "Garage band" });
  for (const changes of details) {
    const patch = loggedInApi.catalog.updateManualMediaItem(mediaItem.id, changes as never);
    expect(await expectBody(patch, 400), JSON.stringify(changes)).toEqual({
      error: "invalid_request",
    });
  }
});

test("the User renames a manual artist, and deleting them takes them off their Collections", async ({
  loggedInApi,
}) => {
  const mediaItem = await manualArtist(loggedInApi, { title: "Garage band" });
  const list = await createList(loggedInApi, "Local bands", "artist");
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId: mediaItem.id }), 201);
  const patch = (changes: ManualMediaItemEditRequest) => {
    return loggedInApi.catalog.updateManualMediaItem(mediaItem.id, changes);
  };

  const edited = await expectBody(
    patch({ title: "Сусіди", originalTitle: "Neighbours" }),
    200,
    MediaItemResponse,
  );

  expect(edited.mediaItem.metadata).toMatchObject({
    title: "Сусіди",
    originalTitle: "Neighbours",
    year: null,
  });
  const manual = loggedInApi.catalog.getManualMediaItem(mediaItem.id);
  expect(await expectBody(manual, 200, ManualMediaItemResponse)).toEqual({
    mediaItem: edited.mediaItem,
    usage: { logEntries: 0, listItems: 1 },
  });
  expect((await loggedInApi.catalog.deleteManualMediaItem(mediaItem.id)).status()).toBe(204);
  expect((await expectBody(loggedInApi.lists.getList(list.id))).list.items).toEqual([]);
});
