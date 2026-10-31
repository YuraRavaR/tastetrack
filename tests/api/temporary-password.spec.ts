import { type APIRequestContext, expect, test } from "@playwright/test";
import { createUser, resetPassword, type TestUser } from "../support/users";

const passwordChangeRequired = { error: "password_change_required" };

// Resets a fresh User's password and logs them in on `api` with the temporary one.
async function logInWithTemporaryPassword(
  api: APIRequestContext,
): Promise<TestUser & { temporaryPassword: string }> {
  const user = await createUser();
  const temporaryPassword = await resetPassword(api, user.username);
  const login = await api.post("/api/auth/login", {
    data: { username: user.username, password: temporaryPassword },
  });
  expect(login.status()).toBe(200);
  expect(await login.json()).toEqual({
    user: { username: user.username, displayName: user.username },
    passwordChangeRequired: true,
  });
  return { ...user, temporaryPassword };
}

test("a session from a Temporary Password is refused everything but setting a new one", async ({
  request,
}) => {
  const user = await logInWithTemporaryPassword(request);

  const refused = [
    await request.get("/api/auth/me"),
    await request.get("/api/log-entries"),
    await request.get("/api/backlog?mediaType=film"),
    await request.get("/api/lists"),
    await request.get("/api/invite-codes"),
    await request.get("/api/catalog/search?mediaType=film&query=alien"),
    await request.put("/api/me/display-name", { data: { displayName: "Olena" } }),
    await request.post("/api/me/password", {
      data: { currentPassword: user.temporaryPassword, newPassword: "a brand new passphrase" },
    }),
  ];

  for (const response of refused) {
    expect(response.status(), response.url()).toBe(403);
    expect(await response.json()).toEqual(passwordChangeRequired);
  }
});

async function setNewPassword(request: APIRequestContext, newPassword: string) {
  return request.post("/api/me/new-password", { data: { newPassword } });
}

test("setting a new password lifts the restriction, and the User uses the app as normal", async ({
  request,
  playwright,
  baseURL,
}) => {
  const user = await logInWithTemporaryPassword(request);

  const response = await setNewPassword(request, "my very own passphrase");

  expect(response.status()).toBe(200);
  const expected = { user: { username: user.username, displayName: user.username } };
  expect(await response.json()).toEqual(expected);
  expect(await (await request.get("/api/auth/me")).json()).toEqual(expected);
  expect((await request.get("/api/lists")).status()).toBe(200);
  const device = await playwright.request.newContext({ baseURL });
  const withTemporary = await device.post("/api/auth/login", {
    data: { username: user.username, password: user.temporaryPassword },
  });
  expect(withTemporary.status()).toBe(401);
  const withNew = await device.post("/api/auth/login", {
    data: { username: user.username, password: "my very own passphrase" },
  });
  expect(withNew.status()).toBe(200);
  expect((await withNew.json()).passwordChangeRequired).toBe(false);
  await device.dispose();
});

test("the new password follows the rules and can't be the temporary one", async ({ request }) => {
  const user = await logInWithTemporaryPassword(request);

  for (const newPassword of ["x".repeat(9), "x".repeat(129)]) {
    const response = await setNewPassword(request, newPassword);
    expect(response.status(), newPassword).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
  const reused = await setNewPassword(request, user.temporaryPassword);
  expect(reused.status()).toBe(400);
  expect(await reused.json()).toEqual({ error: "temporary_password_reused" });

  expect(await (await request.get("/api/auth/me")).json()).toEqual(passwordChangeRequired);
  expect((await setNewPassword(request, "x".repeat(10))).status()).toBe(200);
});

test("setting the new password ends the User's other sessions, and this one stays", async ({
  request,
  playwright,
  baseURL,
}) => {
  const user = await logInWithTemporaryPassword(request);
  const other = await playwright.request.newContext({ baseURL });
  await other.post("/api/auth/login", {
    data: { username: user.username, password: user.temporaryPassword },
  });

  expect((await setNewPassword(request, "my very own passphrase")).status()).toBe(200);

  expect((await request.get("/api/auth/me")).status()).toBe(200);
  expect((await other.get("/api/auth/me")).status()).toBe(401);
  expect((await setNewPassword(other, "another passphrase")).status()).toBe(401);
  await other.dispose();
});

test("a User without a Temporary Password can't set one this way", async ({ request }) => {
  const user = await createUser();
  await request.post("/api/auth/login", { data: user });

  const response = await setNewPassword(request, "a brand new passphrase");

  expect(response.status()).toBe(409);
  expect(await response.json()).toEqual({ error: "password_change_not_required" });
  await request.post("/api/auth/logout");
  expect((await request.post("/api/auth/login", { data: user })).status()).toBe(200);
});

test("setting a new password needs a session", async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL });

  const response = await setNewPassword(anonymous, "a brand new passphrase");

  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthenticated" });
  await anonymous.dispose();
});

test("a session from a Temporary Password can still log out", async ({ request }) => {
  await logInWithTemporaryPassword(request);

  expect((await request.post("/api/auth/logout")).status()).toBe(204);

  expect(await (await request.get("/api/auth/me")).json()).toEqual({ error: "unauthenticated" });
});
