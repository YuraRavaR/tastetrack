import { expect, test } from "@playwright/test";

// The PBKDF2 spike endpoint (issue #6, ADR-0007) runs one simulated login per request, so
// `wrangler tail` on staging can report its CPU time for a given iteration count.

test("the PBKDF2 spike derives the RFC 7914 test vector key", async ({ request }) => {
  // PBKDF2-HMAC-SHA256, P = "passwd", S = "salt", c = 1, dkLen = 64, from RFC 7914 section 11,
  // truncated to the first 32 bytes the endpoint derives.
  const response = await request.get("/api/test/pbkdf2?iterations=1");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    iterations: 1,
    derivedKey: "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc",
  });
});

// Staging is public, so the spike refuses counts that would burn far past any CPU budget.
test("the PBKDF2 spike refuses more than a million iterations", async ({ request }) => {
  const response = await request.get("/api/test/pbkdf2?iterations=1000001");

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid_iterations" });
});
