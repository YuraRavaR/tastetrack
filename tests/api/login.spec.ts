import { LoginResponse, UserResponse } from "@shared/api";
import { expectBody } from "../support/api/responses";
import { at, day } from "../support/clock";
import { expect, test } from "../support/fixtures";
import { uniqueUsername } from "../support/scenarios/users";

function sessionCookieOf(setCookie: string | undefined): string {
  const match = setCookie?.match(/(?:^|\n)session=([^;]+)/);
  if (!match?.[1]) throw new Error(`No session cookie in: ${setCookie}`);
  return match[1];
}

test("a User logs in with their Username and password", async ({ api, registeredUser }) => {
  const login = await expectBody(api.auth.login(registeredUser), 200, LoginResponse);

  expect(login).toEqual({
    user: { username: registeredUser.username, displayName: registeredUser.username },
    passwordChangeRequired: false,
  });
  expect(await expectBody(api.auth.getCurrentUser(), 200, UserResponse)).toEqual({
    user: { username: registeredUser.username, displayName: registeredUser.username },
  });
});

test("the Username matches in any letter case", async ({ api, registeredUser }) => {
  const login = await expectBody(
    api.auth.login({ ...registeredUser, username: registeredUser.username.toUpperCase() }),
  );

  expect(login).toEqual({
    user: { username: registeredUser.username, displayName: registeredUser.username },
    passwordChangeRequired: false,
  });
});

test("an unknown Username and a wrong password get the same error", async ({
  api,
  registeredUser,
}) => {
  const wrongPassword = await expectBody(
    api.auth.login({ ...registeredUser, password: "not the password" }),
    401,
  );
  const unknownUsername = await expectBody(
    api.auth.login({ ...registeredUser, username: uniqueUsername() }),
    401,
  );

  expect(wrongPassword).toEqual({ error: "invalid_credentials" });
  expect(unknownUsername).toEqual({ error: "invalid_credentials" });
  expect((await api.auth.getCurrentUser()).status()).toBe(401);
});

test("without a session, the current User is a 401", async ({ api }) => {
  expect(await expectBody(api.auth.getCurrentUser(), 401)).toEqual({ error: "unauthenticated" });
});

test("a session stays valid for 30 days from the last activity", async ({
  api,
  registeredUser,
}) => {
  const start = Date.now();
  await api.auth.login(registeredUser, at(start));

  expect((await api.auth.getCurrentUser(at(start + 29 * day))).status()).toBe(200);
  // 58 days after login, but only 29 after the last activity.
  expect((await api.auth.getCurrentUser(at(start + 58 * day))).status()).toBe(200);
  expect((await api.auth.getCurrentUser(at(start + 88 * day))).status()).toBe(401);
});

test("a session ends to the second 30 days after the last activity", async ({
  api,
  registeredUser,
}) => {
  const start = Date.now();
  await api.auth.login(registeredUser, at(start));

  expect((await api.auth.getCurrentUser(at(start + 30 * day - 1000))).status()).toBe(200);
  expect((await api.auth.getCurrentUser(at(start + 60 * day))).status()).toBe(401);
});

test("logging out ends the session on the server", async ({ api, registeredUser }) => {
  const login = await api.auth.login(registeredUser);
  const token = sessionCookieOf(login.headers()["set-cookie"]);

  const logout = await api.auth.logout();

  expect(logout.status()).toBe(204);
  expect((await api.auth.getCurrentUser()).status()).toBe(401);
  // A copy of the cookie taken before logout no longer works.
  const replayed = await api.auth.getCurrentUser({ headers: { cookie: `session=${token}` } });
  expect(replayed.status()).toBe(401);
});

test("logging out ends only that session", async ({ api, loggedInUser, createApiClient }) => {
  const otherDevice = await createApiClient();
  await otherDevice.auth.login(loggedInUser);

  await api.auth.logout();

  expect((await otherDevice.auth.getCurrentUser()).status()).toBe(200);
});

test("a login re-hashes a password hash below the iteration target", async ({ api }) => {
  const user = { username: uniqueUsername(), password: "correct horse battery" };
  await expectBody(api.testHooks.createSeedUser({ ...user, passwordIterations: 1000 }), 201);
  const iterations = () => expectBody(api.testHooks.getPasswordIterations(user.username));
  expect(await iterations()).toEqual({ iterations: 1000 });

  const login = await api.auth.login(user);

  expect(login.status()).toBe(200);
  expect(await iterations()).toEqual({ iterations: 20_000 });
  // The new hash still checks the same password.
  await api.auth.logout();
  expect((await api.auth.login(user)).status()).toBe(200);
});
