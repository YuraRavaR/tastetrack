import { type APIRequestContext, expect, request as requests, test } from "@playwright/test";
import { logInNewUser } from "../support/users";

async function setDisplayName(request: APIRequestContext, displayName: string | null) {
  return request.put("/api/me/display-name", { data: { displayName } });
}

async function changePassword(
  request: APIRequestContext,
  currentPassword: string,
  newPassword: string,
) {
  return request.post("/api/me/password", { data: { currentPassword, newPassword } });
}

// Logs in on a request context of its own, as on another device; dispose of it when done.
async function logInElsewhere(username: string, password: string) {
  const device = await requests.newContext({ baseURL: test.info().project.use.baseURL });
  const login = await device.post("/api/auth/login", { data: { username, password } });
  return { device, status: login.status() };
}

test("a User's Display Name defaults to their Username", async ({ request }) => {
  const user = await logInNewUser(request);

  const current = await request.get("/api/auth/me");

  expect(await current.json()).toEqual({
    user: { username: user.username, displayName: user.username },
  });
});

test("a User edits their Display Name, and their Share Links show it", async ({ request }) => {
  const user = await logInNewUser(request);
  const backlog = (await (await request.get("/api/backlog?mediaType=film")).json()).backlog;
  const shared = await request.post(`/api/lists/${backlog.id}/share-link`);
  const { token } = (await shared.json()).shareLink;

  const response = await setDisplayName(request, "Олена К.");

  expect(response.status()).toBe(200);
  const expected = { username: user.username, displayName: "Олена К." };
  expect(await response.json()).toEqual({ user: expected });
  expect(await (await request.get("/api/auth/me")).json()).toEqual({ user: expected });
  const visitor = await requests.newContext({ baseURL: test.info().project.use.baseURL });
  const { sharedList } = await (await visitor.get(`/api/shared-lists/${token}`)).json();
  expect(sharedList.owner).toEqual({ displayName: "Олена К." });
  expect(sharedList.title).toBe("Олена К.'s Watchlist");
  await visitor.dispose();
});

test("a Display Name is trimmed, and clearing it puts the Username back", async ({ request }) => {
  const user = await logInNewUser(request);

  const trimmed = await setDisplayName(request, "  Olena  ");
  expect((await trimmed.json()).user.displayName).toBe("Olena");

  for (const cleared of ["   ", null]) {
    await setDisplayName(request, "Olena");
    const response = await setDisplayName(request, cleared);
    expect(response.status()).toBe(200);
    expect((await response.json()).user.displayName).toBe(user.username);
  }
});

test("a Display Name is at most 50 characters", async ({ request }) => {
  const user = await logInNewUser(request);

  expect((await setDisplayName(request, "я".repeat(50))).status()).toBe(200);
  const tooLong = await setDisplayName(request, "я".repeat(51));

  expect(tooLong.status()).toBe(400);
  expect(await tooLong.json()).toEqual({ error: "invalid_request" });
  const { user: current } = await (await request.get("/api/auth/me")).json();
  expect(current).toEqual({ username: user.username, displayName: "я".repeat(50) });
});

test("changing the Display Name or password needs a session", async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL });

  expect((await setDisplayName(anonymous, "Olena")).status()).toBe(401);
  expect((await changePassword(anonymous, "correct horse battery", "x".repeat(10))).status()).toBe(
    401,
  );
  await anonymous.dispose();
});

test("a User changes their password by giving their current one", async ({ request }) => {
  const user = await logInNewUser(request);

  const response = await changePassword(request, user.password, "a brand new passphrase");

  expect(response.status()).toBe(204);
  const withOld = await logInElsewhere(user.username, user.password);
  expect(withOld.status).toBe(401);
  await withOld.device.dispose();
  const withNew = await logInElsewhere(user.username, "a brand new passphrase");
  expect(withNew.status).toBe(200);
  await withNew.device.dispose();
});

test("a wrong current password changes nothing", async ({ request }) => {
  const user = await logInNewUser(request);
  const other = await logInElsewhere(user.username, user.password);

  const response = await changePassword(request, "not the password", "a brand new passphrase");

  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "wrong_password" });
  expect((await other.device.get("/api/auth/me")).status()).toBe(200);
  await other.device.dispose();
  const withOld = await logInElsewhere(user.username, user.password);
  expect(withOld.status).toBe(200);
  await withOld.device.dispose();
});

test("the new password is 10–128 characters, like any password", async ({ request }) => {
  const user = await logInNewUser(request);

  for (const newPassword of ["x".repeat(9), "x".repeat(129)]) {
    const response = await changePassword(request, user.password, newPassword);
    expect(response.status(), newPassword).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
  expect((await changePassword(request, user.password, "x".repeat(10))).status()).toBe(204);
  expect((await changePassword(request, "x".repeat(10), "x".repeat(128))).status()).toBe(204);
});

test("changing the password ends the User's other sessions, and the current one stays", async ({
  request,
}) => {
  const user = await logInNewUser(request);
  const [phone, laptop] = [
    await logInElsewhere(user.username, user.password),
    await logInElsewhere(user.username, user.password),
  ];
  const someoneElse = await requests.newContext({ baseURL: test.info().project.use.baseURL });
  await logInNewUser(someoneElse);

  const response = await changePassword(request, user.password, "a brand new passphrase");

  expect(response.status()).toBe(204);
  expect((await request.get("/api/auth/me")).status()).toBe(200);
  for (const { device } of [phone, laptop]) {
    expect((await device.get("/api/auth/me")).status()).toBe(401);
    await device.dispose();
  }
  expect((await someoneElse.get("/api/auth/me")).status()).toBe(200);
  await someoneElse.dispose();
});

test("the OpenAPI spec describes the Display Name and password routes", async ({ request }) => {
  const spec = await (await request.get("/api/openapi.json")).json();

  expect(spec.paths["/api/me/display-name"].put.security).toEqual([{ session: [] }]);
  expect(spec.paths["/api/me/password"].post.responses["403"]).toBeDefined();
  expect(spec.components.schemas.User.required).toContain("displayName");
});
