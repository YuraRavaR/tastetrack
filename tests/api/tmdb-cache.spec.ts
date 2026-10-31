import { type APIRequestContext, expect, test } from "@playwright/test";
import { shadows, shadowsId } from "../support/films";
import { createList, fillList } from "../support/lists";
import { evict } from "../support/tmdb";
import { logInNewUser } from "../support/users";

async function addToList(request: APIRequestContext, listId: number, mediaItemId: number) {
  const response = await request.post(`/api/lists/${listId}/items`, { data: { mediaItemId } });
  expect(response.status(), await response.text()).toBe(201);
}

interface Item {
  mediaItem: { id: number; metadata: { title: string } | null };
}

function titles(items: Item[]) {
  return items.map((item) => item.mediaItem.metadata?.title ?? null);
}

test("a page fills a film missing from the cache with TMDB's details", async ({ request }) => {
  await logInNewUser(request);
  const listId = (await createList(request, { name: "Ukrainian classics" })).id;
  await addToList(request, listId, (await shadows(request)).id);
  await evict(request, shadowsId);

  const response = await request.get(`/api/lists/${listId}`);

  expect(response.status()).toBe(200);
  expect(titles((await response.json()).list.items)).toEqual(["Shadows of Forgotten Ancestors"]);
});

// ADR-0009: a page loads in a fixed number of D1 queries, however much it holds, and filling
// what the cache is missing writes it back in one.
test("a List with 1 film and one with 500 load in the same number of queries, on a cold cache", async ({
  request,
}) => {
  await logInNewUser(request);
  const shadowsItem = await shadows(request);
  const queriesForListOf = async (films: number) => {
    const listId = (await createList(request, { name: `${films} films` })).id;
    await addToList(request, listId, shadowsItem.id);
    if (films > 1) await fillList(request, listId, films - 1);
    await evict(request, shadowsId);
    const response = await request.get(`/api/lists/${listId}`);
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
  request,
}) => {
  await logInNewUser(request);
  const listId = (await createList(request, { name: "Mostly missing" })).id;
  // Placeholders TMDB has never heard of come first, so the page tries them and not the film.
  await fillList(request, listId, 10);
  const shadowsItem = await shadows(request);
  await addToList(request, listId, shadowsItem.id);
  await evict(request, shadowsId);

  const page = await request.get(`/api/lists/${listId}`);
  expect(titles((await page.json()).list.items).at(-1)).toBeNull();

  const followUp = await request.get("/api/catalog/items", {
    params: { ids: String(shadowsItem.id) },
  });
  expect(followUp.status()).toBe(200);
  const { mediaItems } = await followUp.json();
  expect(titles(mediaItems.map((mediaItem: Item["mediaItem"]) => ({ mediaItem })))).toEqual([
    "Shadows of Forgotten Ancestors",
  ]);

  const again = await request.get(`/api/lists/${listId}`);
  expect(titles((await again.json()).list.items).at(-1)).toBe("Shadows of Forgotten Ancestors");
});

test("loading films by id needs no login, and shows no Manual Media Item", async ({
  request,
  playwright,
}) => {
  await logInNewUser(request);
  const shadowsItem = await shadows(request);
  const manual = await request.post("/api/catalog/manual-items", {
    data: { mediaType: "film", title: "Olena's wedding" },
  });
  expect(manual.status()).toBe(201);
  const manualId = (await manual.json()).mediaItem.id;
  const anonymous = await playwright.request.newContext({
    baseURL: test.info().project.use.baseURL,
  });

  const response = await anonymous.get("/api/catalog/items", {
    params: { ids: `${shadowsItem.id},${manualId}` },
  });
  const { mediaItems } = await response.json();
  await anonymous.dispose();

  expect(response.status()).toBe(200);
  expect(mediaItems.map((item: { id: number }) => item.id)).toEqual([shadowsItem.id]);
});

test("loading films by id takes 1 to 10 ids", async ({ request }) => {
  const tooMany = Array.from({ length: 11 }, (_, i) => i + 1).join(",");
  for (const ids of ["", "abc", "1,,2", tooMany]) {
    const response = await request.get("/api/catalog/items", { params: { ids } });
    expect(response.status(), `ids=${ids}`).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
});
