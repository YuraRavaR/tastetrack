import {
  type Favourites,
  FavouritesResponse,
  ListedMediaItemsResponse,
  ListItemResponse,
  ListsResponse,
  MediaItemListsResponse,
  SharedListResponse,
} from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { test as base, expect } from "../support/fixtures";
import { zemlya } from "../support/scenarios/albums";
import {
  artist,
  artistReference,
  artistSearchResult,
  kalushOrchestraId,
  manualArtist,
  okeanElzy,
  okeanElzyId,
  pinkFloydId,
  radiohead,
} from "../support/scenarios/artists";
import { alien } from "../support/scenarios/films";

// `visitor` is a client with no session, holding nothing but a Share Link.
const test = base.extend<{ visitor: ApiClient }>({
  visitor: async ({ createApiClient }, use) => {
    await use(await createApiClient());
  },
});

// The User's Favourite artists, which must exist.
async function favouriteArtists(api: ApiClient) {
  const favouritesRead = api.favourites.getFavourites({ mediaType: "artist" });
  const { favourites } = await expectBody(favouritesRead, 200, FavouritesResponse);
  if (!favourites) throw new Error("The User has no Favourite artists");
  return favourites;
}

// Likes each artist in turn, so they are ranked in this order.
async function likeAll(api: ApiClient, mediaItems: { id: number }[]) {
  for (const { id } of mediaItems) {
    await expectBody(api.favourites.like({ mediaItemId: id }), 201);
  }
}

function titlesOf(favourites: Favourites) {
  return favourites.items.map((item) => item.mediaItem.metadata?.title);
}

// Favourites: the system List of the Media Items a User Likes, one per Media Type, which for now
// only artists have (ADR-0005). Locally the Worker calls a MusicBrainz fake and a Wikimedia fake;
// these tests use only the artists the fakes mirror.

test("a Like puts the artist at the end of Favourite artists, which the first Like makes", async ({
  loggedInApi,
}) => {
  const [first, second] = [await okeanElzy(loggedInApi), await radiohead(loggedInApi)];
  const before = await expectBody(loggedInApi.favourites.getFavourites({ mediaType: "artist" }));
  expect(before).toEqual({ favourites: null });

  const liked = await expectBody(
    loggedInApi.favourites.like({ mediaItemId: first.id }),
    201,
    ListItemResponse,
  );
  await expectBody(loggedInApi.favourites.like({ mediaItemId: second.id }), 201);

  expect(liked.listItem).toEqual({
    id: expect.any(Number),
    mediaItem: first,
    position: 0,
    note: null,
  });
  const { favourites } = await expectBody(
    loggedInApi.favourites.getFavourites({ mediaType: "artist" }),
    200,
    FavouritesResponse,
  );
  expect(favourites).toEqual({
    id: expect.any(Number),
    mediaType: "artist",
    description: null,
    visibility: "private",
    shareLink: null,
    items: [
      { id: liked.listItem.id, mediaItem: first, position: 0, note: null },
      { id: expect.any(Number), mediaItem: second, position: 1, note: null },
    ],
  });
});

test("liking an artist again keeps their place, and taking a Like back moves the ones after up", async ({
  loggedInApi,
}) => {
  const okean = await okeanElzy(loggedInApi);
  const pinkFloyd = await artist(loggedInApi, "Pink Floyd", pinkFloydId);
  const kalush = await artist(loggedInApi, "Kalush Orchestra", kalushOrchestraId);
  await likeAll(loggedInApi, [okean, pinkFloyd, kalush]);

  const again = await expectBody(loggedInApi.favourites.like({ mediaItemId: okean.id }), 200);
  const unliked = await loggedInApi.favourites.unlike(pinkFloyd.id);

  expect(again.listItem).toMatchObject({ mediaItem: okean, position: 0 });
  expect(unliked.status()).toBe(204);
  const favourites = await favouriteArtists(loggedInApi);
  expect(favourites.items.map((item) => [item.mediaItem.id, item.position])).toEqual([
    [okean.id, 0],
    [kalush.id, 1],
  ]);
  const unlikedAgain = loggedInApi.favourites.unlike(pinkFloyd.id);
  expect(await expectBody(unlikedAgain, 404)).toEqual({ error: "unknown_list_item" });
});

test("the User ranks Favourite artists by moving them, and notes why one is there", async ({
  loggedInApi,
}) => {
  const okean = await okeanElzy(loggedInApi);
  const pinkFloyd = await artist(loggedInApi, "Pink Floyd", pinkFloydId);
  const kalush = await artist(loggedInApi, "Kalush Orchestra", kalushOrchestraId);
  await likeAll(loggedInApi, [okean, pinkFloyd, kalush]);
  const last = (await favouriteArtists(loggedInApi)).items[2];
  if (!last) throw new Error("Kalush Orchestra isn't third");

  const moved = loggedInApi.listItems.updateListItem(last.id, {
    position: 0,
    note: "Євробачення 2022.",
  });

  expect((await expectBody(moved)).listItem).toMatchObject({
    position: 0,
    note: "Євробачення 2022.",
  });
  expect(titlesOf(await favouriteArtists(loggedInApi))).toEqual([
    "Kalush Orchestra",
    "Океан Ельзи",
    "Pink Floyd",
  ]);
});

test("Favourite artists hold 100, and a 101st Like is refused until one is taken out", async ({
  loggedInApi,
}) => {
  const okean = await okeanElzy(loggedInApi);
  const radioheadItem = await radiohead(loggedInApi);
  await likeAll(loggedInApi, [okean]);
  const favourites = await favouriteArtists(loggedInApi);
  expect((await loggedInApi.testHooks.fillList(favourites.id, 99)).status()).toBe(204);

  const full = loggedInApi.favourites.like({ mediaItemId: radioheadItem.id });

  expect(await expectBody(full, 409)).toEqual({ error: "favourites_full" });
  expect((await loggedInApi.favourites.unlike(okean.id)).status()).toBe(204);
  const liked = loggedInApi.favourites.like({ mediaItemId: radioheadItem.id });
  expect((await expectBody(liked, 201)).listItem).toMatchObject({ position: 99 });
});

test("only an artist can be liked: another Media Type is refused as a mismatch", async ({
  loggedInApi,
}) => {
  const filmItem = await alien(loggedInApi);
  const albumItem = await zemlya(loggedInApi);

  const film = loggedInApi.favourites.like({ mediaItemId: filmItem.id });
  const album = loggedInApi.favourites.like({ mediaItemId: albumItem.id });
  const unknown = loggedInApi.favourites.like({ mediaItemId: 2_000_000_000 });
  const ofFilms = loggedInApi.favourites.getFavourites({ mediaType: "film" } as never);

  expect(await expectBody(film, 400)).toEqual({ error: "wrong_media_type" });
  expect(await expectBody(album, 400)).toEqual({ error: "wrong_media_type" });
  expect(await expectBody(unknown, 400)).toEqual({ error: "unknown_media_item" });
  expect(await expectBody(ofFilms, 400)).toEqual({ error: "invalid_request" });
});

test("a manual artist can be liked by their User alone", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const mediaItem = await manualArtist(loggedInApi, { title: "Сусіди знизу" });

  const liked = loggedInApi.favourites.like({ mediaItemId: mediaItem.id });
  const byOther = otherUserClient.favourites.like({ mediaItemId: mediaItem.id });

  expect((await expectBody(liked, 201)).listItem).toMatchObject({ mediaItem, position: 0 });
  expect(await expectBody(byOther, 400)).toEqual({ error: "unknown_media_item" });
});

test("Favourite artists can't be renamed or deleted, and keep a description of their own", async ({
  loggedInApi,
}) => {
  await likeAll(loggedInApi, [await okeanElzy(loggedInApi)]);
  const { id } = await favouriteArtists(loggedInApi);

  const renamed = loggedInApi.lists.updateList(id, { name: "My top" });
  const deleted = loggedInApi.lists.deleteList(id);
  const renamedHere = loggedInApi.favourites.updateFavourites({ mediaType: "artist" }, {
    name: "My top",
    description: null,
  } as never);
  const described = loggedInApi.favourites.updateFavourites(
    { mediaType: "artist" },
    { description: "  The ones I'd see live again.  " },
  );
  const reserved = loggedInApi.lists.createList({ name: "favourite ARTISTS", mediaType: "artist" });

  expect(await expectBody(renamed, 404)).toEqual({ error: "unknown_list" });
  expect(await expectBody(deleted, 404)).toEqual({ error: "unknown_list" });
  expect(await expectBody(renamedHere, 400)).toEqual({ error: "invalid_request" });
  expect((await expectBody(described, 200, FavouritesResponse)).favourites).toMatchObject({
    id,
    description: "The ones I'd see live again.",
  });
  expect(await expectBody(reserved, 400)).toEqual({ error: "list_name_reserved" });
  expect(await favouriteArtists(loggedInApi)).toMatchObject({ id, items: [{ position: 0 }] });
});

test("a User with no Favourite artists has no description to change", async ({ loggedInApi }) => {
  const described = loggedInApi.favourites.updateFavourites(
    { mediaType: "artist" },
    { description: "Soon." },
  );

  expect(await expectBody(described, 404)).toEqual({ error: "unknown_list" });
});

test("anyone with the link sees Favourite artists in their order, with their Notes, as Favourites", async ({
  loggedInApi,
  loggedInUser,
  visitor,
}) => {
  const okean = await okeanElzy(loggedInApi);
  const radioheadItem = await radiohead(loggedInApi);
  await likeAll(loggedInApi, [okean, radioheadItem]);
  const favourites = await favouriteArtists(loggedInApi);
  const [first, second] = favourites.items;
  if (!first || !second) throw new Error("Two artists weren't liked");
  await expectBody(loggedInApi.listItems.updateListItem(second.id, { position: 0, note: "Live." }));
  const { shareLink } = await expectBody(loggedInApi.lists.createShareLink(favourites.id), 201);

  const { sharedList } = await expectBody(
    visitor.sharedLists.getSharedList(shareLink.token),
    200,
    SharedListResponse,
  );

  expect(sharedList).toEqual({
    title: `${loggedInUser.username}'s Favourite artists`,
    description: null,
    mediaType: "artist",
    favourites: true,
    owner: { displayName: loggedInUser.username },
    items: [
      { mediaItem: radioheadItem, position: 0, note: "Live." },
      { mediaItem: okean, position: 1, note: null },
    ],
  });
  expect(await favouriteArtists(loggedInApi)).toMatchObject({
    visibility: "link",
    shareLink: { token: shareLink.token },
  });
});

test("Collections show Favourite artists apart from the User's Lists, with their first four and whether shared", async ({
  loggedInApi,
}) => {
  const artists = [
    await okeanElzy(loggedInApi),
    await radiohead(loggedInApi),
    await artist(loggedInApi, "Pink Floyd", pinkFloydId),
    await artist(loggedInApi, "Kalush Orchestra", kalushOrchestraId),
    await manualArtist(loggedInApi, { title: "Сусіди знизу" }),
  ];
  const bands = await expectBody(
    loggedInApi.lists.createList({ name: "Bands to show a friend", mediaType: "artist" }),
    201,
  );
  const before = await expectBody(loggedInApi.lists.getLists(), 200, ListsResponse);
  await likeAll(loggedInApi, artists);
  const favourites = await favouriteArtists(loggedInApi);
  await expectBody(loggedInApi.lists.createShareLink(favourites.id), 201);

  const { lists, favourites: previews } = await expectBody(
    loggedInApi.lists.getLists(),
    200,
    ListsResponse,
  );

  expect(before.favourites).toEqual([]);
  expect(lists.map((list) => list.id)).toEqual([bands.list.id]);
  expect(previews).toEqual([
    {
      id: favourites.id,
      mediaType: "artist",
      itemCount: 5,
      covers: artists.slice(0, 4),
      shared: true,
    },
  ]);
});

test("an artist's Lists say their place in Favourite artists, and the picker's Lists leave it out", async ({
  loggedInApi,
}) => {
  const okean = await okeanElzy(loggedInApi);
  const radioheadItem = await radiohead(loggedInApi);
  const bands = await expectBody(
    loggedInApi.lists.createList({ name: "Bands to show a friend", mediaType: "artist" }),
    201,
  );
  const notYet = await expectBody(
    loggedInApi.catalog.getMediaItemLists(okean.id),
    200,
    MediaItemListsResponse,
  );
  await likeAll(loggedInApi, [radioheadItem, okean]);
  const favourites = await favouriteArtists(loggedInApi);

  const liked = await expectBody(loggedInApi.catalog.getMediaItemLists(okean.id));
  expect((await loggedInApi.favourites.unlike(radioheadItem.id)).status()).toBe(204);
  const unliked = await expectBody(loggedInApi.catalog.getMediaItemLists(radioheadItem.id));

  expect(notYet.favourites).toBeNull();
  expect(liked.lists.map((list: { id: number }) => list.id)).toEqual([bands.list.id]);
  expect(liked.favourites).toEqual({
    id: favourites.id,
    itemCount: 2,
    listItem: { id: favourites.items[1]?.id, position: 1, note: null },
  });
  expect(unliked.favourites).toEqual({ id: favourites.id, itemCount: 1, listItem: null });
});

test("Search marks a liked artist, and counts them among the User's artists with their place", async ({
  loggedInApi,
}) => {
  const radioheadItem = await radiohead(loggedInApi);
  const okean = await okeanElzy(loggedInApi);
  const before = await artistSearchResult(loggedInApi, "Океан Ельзи", okeanElzyId);
  await likeAll(loggedInApi, [radioheadItem, okean]);

  const after = await artistSearchResult(loggedInApi, "Океан Ельзи", okeanElzyId);
  const listed = await expectBody(
    loggedInApi.lists.getListedMediaItems({ mediaType: "artist" }),
    200,
    ListedMediaItemsResponse,
  );

  expect(before).toMatchObject({ mediaItemId: okean.id, inFavourites: false });
  expect(after).toMatchObject({ mediaItemId: okean.id, inFavourites: true, lists: [] });
  expect(listed.items).toEqual(
    expect.arrayContaining([
      { mediaItem: radioheadItem, lists: [], favouritePosition: 0 },
      { mediaItem: okean, lists: [], favouritePosition: 1 },
    ]),
  );
  expect(listed.items).toHaveLength(2);
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds, and filling what
// the cache is missing writes it back in one. Each User has one Favourites, so each size has a User.
test("Favourite artists of 1 and of 100 load in the same number of queries, on a cold cache", async ({
  loggedInApi,
  otherUserClient,
}) => {
  const queriesForFavouritesOf = async (api: ApiClient, artists: number) => {
    await likeAll(api, [await okeanElzy(api)]);
    if (artists > 1) {
      const { id } = await favouriteArtists(api);
      expect((await api.testHooks.fillList(id, artists - 1)).status()).toBe(204);
    }
    const evicted = await api.testHooks.evictFromCatalogCache(artistReference(okeanElzyId));
    expect(evicted.status()).toBe(204);
    const response = await api.favourites.getFavourites({ mediaType: "artist" });
    const { items } = (await response.json()).favourites;
    expect(items).toHaveLength(artists);
    expect(items[0].mediaItem.metadata?.title).toBe("Океан Ельзи");
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForFavouritesOf(loggedInApi, 1);
  const hundred = await queriesForFavouritesOf(otherUserClient, 100);

  expect(one).toMatch(/^\d+$/);
  expect(hundred).toBe(one);
});
