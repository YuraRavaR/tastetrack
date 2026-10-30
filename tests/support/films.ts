import { type APIRequestContext, expect } from "@playwright/test";

// Locally the Worker calls a TMDB fake with fixed data; on staging, the real TMDB. So tests use
// only well-known films, and check only what both answer alike.

export async function searchResult(request: APIRequestContext, query: string, id: string) {
  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query },
  });
  expect(response.status()).toBe(200);
  const { results } = await response.json();
  const result = results.find((r: { externalReference: { id: string } }) => {
    return r.externalReference.id === id;
  });
  expect(result, `TMDB film ${id} among the results for "${query}"`).toBeDefined();
  return result;
}

// A film's Media Item, as adding it from search makes or finds it.
export async function film(request: APIRequestContext, query: string, id: string) {
  const response = await request.post("/api/catalog/items", {
    data: await searchResult(request, query, id),
  });
  expect([200, 201]).toContain(response.status());
  return (await response.json()).mediaItem;
}

export const alien = (request: APIRequestContext) => film(request, "alien", "348");
export const aliens = (request: APIRequestContext) => film(request, "aliens", "679");
export const amelie = (request: APIRequestContext) => film(request, "amelie", "194");

// A query the TMDB fake answers with one film no one has added yet, whatever earlier test runs left
// in local D1, and that film's label. Only the fake knows it, so skip the test on real TMDB.
export function newFilm() {
  const id = String(Math.floor(Math.random() * 1e12));
  return { id, query: `tmdb fake new film ${id}`, label: `New film ${id} (2020)` };
}

// Films the TMDB cache tests take out of the cache. Each is used from the catalog by the tests of
// one file alone, which run one after another, so no other test meets it on a cold cache: Shadows
// by the API tests and The Matrix by the end-to-end one.
export const shadowsId = "26782";
export const shadows = (request: APIRequestContext) => {
  return film(request, "shadows of forgotten", shadowsId);
};
export const matrixId = "603";
export const matrix = (request: APIRequestContext) => film(request, "the matrix", matrixId);

// The film titles of List Items, by the TMDB ids of the films above.
export function titlesOf(items: { mediaItem: { externalReference: { id: string } } }[]) {
  return items.map((item) => {
    return { "348": "Alien", "679": "Aliens", "194": "Amélie" }[
      item.mediaItem.externalReference.id
    ];
  });
}
