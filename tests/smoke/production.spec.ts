import { expect, test } from "@playwright/test";

// Runs after every production deploy, and locally against the top level of wrangler.jsonc, which
// is what production deploys. It proves the deploy is up and exposes no test-only surface.

test("health reports ok, with no D1 query count", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
  expect(response.headers()["x-d1-query-count"]).toBeUndefined();
});

// The test-only manual cron trigger lives at this path when test hooks are on.
test("the manual cron trigger is a 404, with no D1 query count", async ({ request }) => {
  const response = await request.post("/api/test/cron");

  expect(response.status()).toBe(404);
  expect(response.headers()["x-d1-query-count"]).toBeUndefined();
});

// The PBKDF2 spike endpoint (issue #6) lives at this path when test hooks are on.
test("the PBKDF2 spike endpoint is a 404, with no D1 query count", async ({ request }) => {
  const response = await request.get("/api/test/pbkdf2?iterations=1");

  expect(response.status()).toBe(404);
  expect(response.headers()["x-d1-query-count"]).toBeUndefined();
});

// Creates Users without an Invite Code for API and E2E tests when test hooks are on.
test("the test User factory is a 404, with no D1 query count", async ({ request }) => {
  const response = await request.post("/api/test/users", {
    data: { username: "smoke_test", password: "a long enough password" },
  });

  expect(response.status()).toBe(404);
  expect(response.headers()["x-d1-query-count"]).toBeUndefined();
});

// With test hooks on, an unparseable test clock is a 400; with them off the header is ignored, so
// no request can move the server's clock.
test("the X-Test-Now header is ignored", async ({ request }) => {
  const response = await request.get("/api/health", { headers: { "X-Test-Now": "not a time" } });

  expect(response.status()).toBe(200);
});

test("the app is served", async ({ request }) => {
  const response = await request.get("/");

  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("<title>TasteTrack</title>");
});
