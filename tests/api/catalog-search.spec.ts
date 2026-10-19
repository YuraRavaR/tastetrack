import { type APIRequestContext, expect, test } from "@playwright/test";
import { createUser } from "../support/users";

// Locally the Worker searches a TMDB fake with fixed data; on staging, the real TMDB. So these
// tests look only for well-known films, and check that they are among the results.

async function logIn(request: APIRequestContext) {
  const user = await createUser();
  expect((await request.post("/api/auth/login", { data: user })).status()).toBe(200);
}

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
  await logIn(request);

  const results = await search(request, "alien");

  expect(results).toContainEqual({
    externalReference: { source: "tmdb", mediaType: "film", id: "348" },
    title: "Alien",
    originalTitle: "Alien",
    year: 1979,
    posterUrl: expect.stringMatching(/^https:\/\/image\.tmdb\.org\/t\/p\/w92\/\w+\.jpg$/),
  });
});

test("a Ukrainian query is answered in Ukrainian, with the Original Title alongside", async ({
  request,
}) => {
  await logIn(request);

  const results = await search(request, "чужий");

  expect(results).toContainEqual(
    expect.objectContaining({ title: "Чужий", originalTitle: "Alien", year: 1979 }),
  );
  expect(results).not.toContainEqual(expect.objectContaining({ title: "Alien" }));
});

test("searching by the Original Title finds the film, titled in English", async ({ request }) => {
  await logIn(request);

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
  await logIn(request);

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
  test.skip(!!process.env.BASE_URL, "Only the local TMDB fake can be made to fail");
  await logIn(request);

  // The fake answers this query with a 503.
  const response = await request.get("/api/catalog/search", {
    params: { mediaType: "film", query: "tmdb fake failure" },
  });

  expect(response.status()).toBe(502);
  expect(await response.json()).toEqual({ error: "catalog_unavailable" });
});
