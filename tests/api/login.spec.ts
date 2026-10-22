import { type APIRequestContext, expect, test } from "@playwright/test";
import { createSeedUser, createUser, uniqueUsername } from "../support/users";

const day = 24 * 60 * 60 * 1000;

// With test hooks on, the Worker treats this header's time as now.
function at(time: number) {
  return { headers: { "X-Test-Now": new Date(time).toISOString() } };
}

function sessionCookieOf(setCookie: string | undefined): string {
  const match = setCookie?.match(/(?:^|\n)session=([^;]+)/);
  if (!match?.[1]) throw new Error(`No session cookie in: ${setCookie}`);
  return match[1];
}

async function me(request: APIRequestContext, options = {}) {
  return request.get("/api/auth/me", options);
}

test("a User logs in with their Username and password", async ({ request }) => {
  const user = await createUser();

  const login = await request.post("/api/auth/login", { data: user });

  expect(login.status()).toBe(200);
  expect(await login.json()).toEqual({
    user: { username: user.username, displayName: user.username },
    passwordChangeRequired: false,
  });
  const current = await me(request);
  expect(current.status()).toBe(200);
  expect(await current.json()).toEqual({
    user: { username: user.username, displayName: user.username },
  });
});

test("the Username matches in any letter case", async ({ request }) => {
  const user = await createUser();

  const login = await request.post("/api/auth/login", {
    data: { username: user.username.toUpperCase(), password: user.password },
  });

  expect(login.status()).toBe(200);
  expect(await login.json()).toEqual({
    user: { username: user.username, displayName: user.username },
    passwordChangeRequired: false,
  });
});

test("an unknown Username and a wrong password get the same error", async ({ request }) => {
  const user = await createUser();

  const wrongPassword = await request.post("/api/auth/login", {
    data: { username: user.username, password: "not the password" },
  });
  const unknownUsername = await request.post("/api/auth/login", {
    data: { username: uniqueUsername(), password: user.password },
  });

  expect(wrongPassword.status()).toBe(401);
  expect(unknownUsername.status()).toBe(401);
  expect(await wrongPassword.json()).toEqual({ error: "invalid_credentials" });
  expect(await unknownUsername.json()).toEqual({ error: "invalid_credentials" });
  expect((await me(request)).status()).toBe(401);
});

test("without a session, the current User is a 401", async ({ request }) => {
  const response = await me(request);

  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthenticated" });
});

test("a session stays valid for 30 days from the last activity", async ({ request }) => {
  const user = await createUser();
  const start = Date.now();
  await request.post("/api/auth/login", { data: user, ...at(start) });

  expect((await me(request, at(start + 29 * day))).status()).toBe(200);
  // 58 days after login, but only 29 after the last activity.
  expect((await me(request, at(start + 58 * day))).status()).toBe(200);
  expect((await me(request, at(start + 88 * day))).status()).toBe(401);
});

test("a session with no activity ends 30 days after login", async ({ request }) => {
  const user = await createUser();
  const start = Date.now();
  await request.post("/api/auth/login", { data: user, ...at(start) });

  expect((await me(request, at(start + 30 * day - 1000))).status()).toBe(200);
  expect((await me(request, at(start + 60 * day))).status()).toBe(401);
});

test("logging out ends the session on the server", async ({ request }) => {
  const user = await createUser();
  const login = await request.post("/api/auth/login", { data: user });
  const token = sessionCookieOf(login.headers()["set-cookie"]);

  const logout = await request.post("/api/auth/logout");

  expect(logout.status()).toBe(204);
  expect((await me(request)).status()).toBe(401);
  // A copy of the cookie taken before logout no longer works.
  const replayed = await me(request, { headers: { cookie: `session=${token}` } });
  expect(replayed.status()).toBe(401);
});

test("logging out ends only that session", async ({ request, playwright, baseURL }) => {
  const user = await createUser();
  const otherDevice = await playwright.request.newContext({ baseURL });
  await request.post("/api/auth/login", { data: user });
  await otherDevice.post("/api/auth/login", { data: user });

  await request.post("/api/auth/logout");

  expect((await me(otherDevice)).status()).toBe(200);
  await otherDevice.dispose();
});

test("a login re-hashes a password hash below the iteration target", async ({ request }) => {
  const user = await createSeedUser(request, { passwordIterations: 1000 });
  const iterations = `/api/test/users/${user.username}/password-iterations`;
  expect(await (await request.get(iterations)).json()).toEqual({ iterations: 1000 });

  const login = await request.post("/api/auth/login", { data: user });

  expect(login.status()).toBe(200);
  expect(await (await request.get(iterations)).json()).toEqual({ iterations: 20_000 });
  // The new hash still checks the same password.
  await request.post("/api/auth/logout");
  expect((await request.post("/api/auth/login", { data: user })).status()).toBe(200);
});

test("the OpenAPI spec describes login, logout and the current User", async ({ request }) => {
  const spec = await (await request.get("/api/openapi.json")).json();

  expect(spec.paths["/api/auth/login"].post.responses["401"]).toBeDefined();
  expect(spec.paths["/api/auth/logout"].post.responses["204"]).toBeDefined();
  expect(spec.paths["/api/auth/me"].get.security).toEqual([{ session: [] }]);
});
