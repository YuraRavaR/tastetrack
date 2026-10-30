import { type APIRequestContext, expect, test } from "@playwright/test";
import { alien, amelie, newFilm, searchResult } from "../support/films";
import { callsRealTmdb } from "../support/tmdb";
import { logInNewUser } from "../support/users";

// Locally the Worker searches a TMDB fake with fixed data; on staging, the real TMDB. So these
// tests look only for well-known films, and check that they are among the results.

async function search(request: APIRequestContext, query: string) {
  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).results;
}

test("an English query finds the film with its title, Original Title, year and poster", async ({
  request,
}) => {
  await logInNewUser(request);

  const results = await search(request, "alien");

  expect(results).toContainEqual(
    expect.objectContaining({
      externalReference: { source: "tmdb", mediaType: "film", id: "348" },
      title: "Alien",
      originalTitle: "Alien",
      year: 1979,
      posterUrl: expect.stringMatching(/^https:\/\/image\.tmdb\.org\/t\/p\/w92\/\w+\.jpg$/),
      titleLanguage: "en",
      inLog: false,
      inBacklog: false,
    }),
  );
});

test("a result names its Media Item once the film is in the catalog, and null until then", async ({
  request,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  await logInNewUser(request);
  const { id, query } = newFilm();

  const before = await searchResult(request, query, id);
  expect(before.mediaItemId).toBeNull();

  const added = await request.post("/api/catalog/items", { data: before });
  expect(added.status(), await added.text()).toBe(201);
  const { mediaItem } = await added.json();

  expect((await searchResult(request, query, id)).mediaItemId).toBe(mediaItem.id);
});

// ADR-0009: a search takes a fixed number of D1 queries, however many results it brings.
test("a search with 1 result and one with many take the same number of queries", async ({
  request,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a query with exactly 1 result");
  await logInNewUser(request);
  await Promise.all([alien(request), amelie(request)]);
  const queriesFor = async (query: string) => {
    const response = await request.get("/api/catalog/search", {
      params: { mediaType: "film", query },
    });
    const { results } = await response.json();
    return { results, queries: response.headers()["x-d1-query-count"] };
  };

  const one = await queriesFor("amelie");
  const many = await queriesFor("a");

  expect(one.results).toHaveLength(1);
  expect(many.results.length).toBeGreaterThan(1);
  expect(one.queries).toMatch(/^\d+$/);
  expect(many.queries).toBe(one.queries);
});

test("a Ukrainian query is answered in Ukrainian, with the Original Title alongside", async ({
  request,
}) => {
  await logInNewUser(request);

  const results = await search(request, "чужий");

  expect(results).toContainEqual(
    expect.objectContaining({
      title: "Чужий",
      originalTitle: "Alien",
      year: 1979,
      titleLanguage: "uk",
    }),
  );
  expect(results).not.toContainEqual(expect.objectContaining({ title: "Alien" }));
});

test("searching by the Original Title finds the film, titled in English", async ({ request }) => {
  await logInNewUser(request);

  const results = await search(request, "Le Fabuleux Destin d'Amélie Poulain");

  expect(results).toContainEqual(
    expect.objectContaining({
      title: "Amélie",
      originalTitle: "Le Fabuleux Destin d'Amélie Poulain",
      year: 2001,
    }),
  );
});

test("an empty or overlong query, or an unknown Media Type, is a 400", async ({ request }) => {
  await logInNewUser(request);

  for (const params of <Record<string, string>[]>[
    { mediaType: "film", query: "   " },
    { mediaType: "film", query: "a".repeat(101) },
    { mediaType: "book", query: "alien" },
    { mediaType: "film" },
  ]) {
    const response = await request.get("/api/catalog/search", { params });
    expect(response.status(), JSON.stringify(params)).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
});

test("without a session, searching is a 401", async ({ request }) => {
  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query: "alien" },
  });

  expect(response.status()).toBe(401);
});

test("when TMDB fails, searching is a 502", async ({ request }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake can be made to fail");
  await logInNewUser(request);

  // The fake answers this query with a 503.
  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query: "tmdb fake failure" },
  });

  expect(response.status()).toBe(502);
  expect(await response.json()).toEqual({ error: "catalog_unavailable" });
});
