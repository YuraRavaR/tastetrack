import { endpoints } from "../support/api/endpoints";
import { expect, test } from "../support/fixtures";
import { callsRealOpenLibrary } from "../support/scenarios/books";
import { callsRealTmdb } from "../support/scenarios/tmdb";
import { uniqueUsername } from "../support/scenarios/users";
import { testHooksHeaders } from "../support/test-hooks-secret";

// Raw requests: the test hooks controller always sends the secret. A wrong secret is refused the
// same way, which src/worker/env.test.ts covers. Refused requests write nothing, so these tests are
// safe against staging (ADR-0006).

test("without the secret the seed User route is a 404 and creates nobody", {
  tag: "@smoke",
}, async ({ request, api }) => {
  const username = uniqueUsername();

  const refused = await request.post(endpoints.testHooks.users, {
    data: { username, password: "a long enough password" },
  });

  expect(refused.status()).toBe(404);
  expect(await refused.json()).toEqual({ error: "not_found" });
  expect((await api.testHooks.getPasswordIterations(username)).status()).toBe(404);
});

// An unparseable test clock is a 400 for a request allowed to set one.
test("only a request with the secret can set the test clock", { tag: "@smoke" }, async ({
  request,
}) => {
  const clock = { "X-Test-Now": "not a time" };

  const ignored = await request.get("/api/health", { headers: clock });
  const read = await request.get("/api/health", {
    headers: { ...testHooksHeaders(), ...clock },
  });

  expect(ignored.status()).toBe(200);
  expect(read.status()).toBe(400);
});

test("the TMDB fake is a 404 where the Worker searches real TMDB", { tag: "@smoke" }, async ({
  request,
}) => {
  test.skip(!callsRealTmdb(), "Only the Worker that searches the fake serves it");

  const response = await request.get(endpoints.testHooks.tmdbFakeSearch, {
    headers: { ...testHooksHeaders(), Authorization: "Bearer any-token" },
  });

  expect(response.status()).toBe(404);
});

test("the Open Library fake is a 404 where the Worker searches real Open Library", {
  tag: "@smoke",
}, async ({ request }) => {
  test.skip(!callsRealOpenLibrary(), "Only the Worker that searches the fake serves it");

  const response = await request.get(endpoints.testHooks.openLibraryFakeSearch, {
    headers: { ...testHooksHeaders(), "User-Agent": "TasteTrack (a test)" },
  });

  expect(response.status()).toBe(404);
});
