import { MediaItemsResponse } from "@shared/api";
import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";
import { shadows, shadowsId } from "../support/scenarios/films";

interface Item {
  mediaItem: { id: number; metadata: { title: string } | null };
}

function titles(items: Item[]) {
  return items.map((item) => item.mediaItem.metadata?.title ?? null);
}

test("a page fills a film missing from the cache with TMDB's details", async ({ loggedInApi }) => {
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Ukrainian classics", mediaType: "film" }),
    201,
  );
  const mediaItemId = (await shadows(loggedInApi)).id;
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId }), 201);
  expect((await loggedInApi.testHooks.evictFromTmdbCache(shadowsId)).status()).toBe(204);

  const page = await expectBody(loggedInApi.lists.getList(list.id));

  expect(titles(page.list.items)).toEqual(["Shadows of Forgotten Ancestors"]);
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds, and filling
// what the cache is missing writes it back in one.
test("a List with 1 film and one with 500 load in the same number of queries, on a cold cache", async ({
  loggedInApi,
}) => {
  const mediaItemId = (await shadows(loggedInApi)).id;
  const queriesForListOf = async (films: number) => {
    const { list } = await expectBody(
      loggedInApi.lists.createList({ name: `${films} films`, mediaType: "film" }),
      201,
    );
    await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId }), 201);
    if (films > 1) {
      expect((await loggedInApi.testHooks.fillList(list.id, films - 1)).status()).toBe(204);
    }
    expect((await loggedInApi.testHooks.evictFromTmdbCache(shadowsId)).status()).toBe(204);
    const response = await loggedInApi.lists.getList(list.id);
    const { items } = (await response.json()).list;
    expect(items).toHaveLength(films);
    expect(titles(items)[0]).toBe("Shadows of Forgotten Ancestors");
    return response.headers()["x-d1-query-count"];
  };

  const one = await queriesForListOf(1);
  const fiveHundred = await queriesForListOf(500);

  expect(one).toMatch(/^\d+$/);
  expect(fiveHundred).toBe(one);
});

test("a page fills at most 10 missing films; the client loads the rest by id", async ({
  loggedInApi,
}) => {
  const { list } = await expectBody(
    loggedInApi.lists.createList({ name: "Mostly missing", mediaType: "film" }),
    201,
  );
  // Placeholders TMDB has never heard of come first, so the page tries them and not the film.
  expect((await loggedInApi.testHooks.fillList(list.id, 10)).status()).toBe(204);
  const mediaItemId = (await shadows(loggedInApi)).id;
  await expectBody(loggedInApi.lists.addListItem(list.id, { mediaItemId }), 201);
  expect((await loggedInApi.testHooks.evictFromTmdbCache(shadowsId)).status()).toBe(204);

  const page = await expectBody(loggedInApi.lists.getList(list.id));
  expect(titles(page.list.items).at(-1)).toBeNull();

  const { mediaItems } = await expectBody(
    loggedInApi.catalog.getMediaItems(String(mediaItemId)),
    200,
    MediaItemsResponse,
  );
  expect(titles(mediaItems.map((mediaItem: Item["mediaItem"]) => ({ mediaItem })))).toEqual([
    "Shadows of Forgotten Ancestors",
  ]);

  const again = await expectBody(loggedInApi.lists.getList(list.id));
  expect(titles(again.list.items).at(-1)).toBe("Shadows of Forgotten Ancestors");
});

test("loading films by id needs no login, and shows no Manual Media Item", async ({
  loggedInApi,
  createApiClient,
}) => {
  const shadowsItem = await shadows(loggedInApi);
  const { mediaItem: manual } = await expectBody(
    loggedInApi.catalog.addManualMediaItem({ mediaType: "film", title: "Olena's wedding" }),
    201,
  );
  const anonymous = await createApiClient();

  const { mediaItems } = await expectBody(
    anonymous.catalog.getMediaItems(`${shadowsItem.id},${manual.id}`),
  );

  expect(mediaItems.map((item: { id: number }) => item.id)).toEqual([shadowsItem.id]);
});

test("loading films by id takes 1 to 10 ids", async ({ api }) => {
  const tooMany = Array.from({ length: 11 }, (_, i) => i + 1).join(",");
  for (const ids of ["", "abc", "1,,2", tooMany]) {
    const response = await api.catalog.getMediaItems(ids);
    expect(response.status(), `ids=${ids}`).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
});
