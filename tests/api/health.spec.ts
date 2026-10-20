import { expect, test } from "@playwright/test";

test("health reports the Worker and its database as ok", { tag: "@smoke" }, async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});

test("the OpenAPI spec describes the health route", async ({ request }) => {
  const response = await request.get("/api/openapi.json");

  expect(response.status()).toBe(200);
  const spec = await response.json();
  expect(spec.openapi).toMatch(/^3\.1/);
  expect(spec.paths["/api/health"].get.responses["200"]).toBeDefined();
});

test("with test hooks on, API responses carry the D1 query count", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.headers()["x-d1-query-count"]).toBe("1");
});

test("an unknown API route is a JSON 404, not the app", async ({ request }) => {
  const response = await request.get("/api/does-not-exist");

  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("application/json");
});
