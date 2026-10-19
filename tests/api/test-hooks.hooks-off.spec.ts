import { expect, test } from "@playwright/test";

test("with test hooks off, API responses carry no D1 query count", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["x-d1-query-count"]).toBeUndefined();
});
