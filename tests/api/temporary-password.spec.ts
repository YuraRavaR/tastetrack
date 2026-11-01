import { expectBody } from "../support/api/responses";
import { test as base, expect } from "../support/fixtures";
import type { TestUser } from "../support/scenarios/users";

const passwordChangeRequired = { error: "password_change_required" };

// A fresh User whose password was reset, logged in on `api` with the Temporary Password.
const test = base.extend<{ userWithTemporaryPassword: TestUser & { temporaryPassword: string } }>({
  userWithTemporaryPassword: async ({ api, registeredUser }, use) => {
    const { username } = registeredUser;
    const { temporaryPassword } = await expectBody(api.testHooks.resetPassword(username));
    const login = await expectBody(api.auth.login({ username, password: temporaryPassword }));
    expect(login).toEqual({
      user: { username, displayName: username },
      passwordChangeRequired: true,
    });
    await use({ ...registeredUser, temporaryPassword });
  },
});

test("a session from a Temporary Password is refused everything but setting a new one", async ({
  api,
  userWithTemporaryPassword,
}) => {
  const refused = [
    await api.auth.getCurrentUser(),
    await api.log.getLogEntries(),
    await api.backlog.getBacklog({ mediaType: "film" }),
    await api.lists.getLists(),
    await api.inviteCodes.listActiveInviteCodes(),
    await api.catalog.searchCatalog({ mediaType: "film", query: "alien" }),
    await api.me.updateDisplayName({ displayName: "Olena" }),
    await api.me.changePassword({
      currentPassword: userWithTemporaryPassword.temporaryPassword,
      newPassword: "a brand new passphrase",
    }),
  ];

  for (const response of refused) {
    expect(response.status(), response.url()).toBe(403);
    expect(await response.json()).toEqual(passwordChangeRequired);
  }
});

test("setting a new password lifts the restriction, and the User uses the app as normal", async ({
  api,
  createApiClient,
  userWithTemporaryPassword,
}) => {
  const { username, temporaryPassword } = userWithTemporaryPassword;

  const updated = await expectBody(
    api.me.setNewPassword({ newPassword: "my very own passphrase" }),
  );

  const expected = { user: { username, displayName: username } };
  expect(updated).toEqual(expected);
  expect(await expectBody(api.auth.getCurrentUser())).toEqual(expected);
  expect((await api.lists.getLists()).status()).toBe(200);
  const device = await createApiClient();
  const withTemporary = await device.auth.login({ username, password: temporaryPassword });
  expect(withTemporary.status()).toBe(401);
  const withNew = await expectBody(
    device.auth.login({ username, password: "my very own passphrase" }),
  );
  expect(withNew.passwordChangeRequired).toBe(false);
});

test("the new password follows the rules and can't be the temporary one", async ({
  api,
  userWithTemporaryPassword,
}) => {
  for (const newPassword of ["x".repeat(9), "x".repeat(129)]) {
    const response = await api.me.setNewPassword({ newPassword });
    expect(response.status(), newPassword).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
  const reused = await expectBody(
    api.me.setNewPassword({ newPassword: userWithTemporaryPassword.temporaryPassword }),
    400,
  );
  expect(reused).toEqual({ error: "temporary_password_reused" });

  expect(await expectBody(api.auth.getCurrentUser(), 403)).toEqual(passwordChangeRequired);
  expect((await api.me.setNewPassword({ newPassword: "x".repeat(10) })).status()).toBe(200);
});

test("setting the new password ends the User's other sessions, and this one stays", async ({
  api,
  createApiClient,
  userWithTemporaryPassword,
}) => {
  const { username, temporaryPassword } = userWithTemporaryPassword;
  const other = await createApiClient();
  await expectBody(other.auth.login({ username, password: temporaryPassword }));

  await expectBody(api.me.setNewPassword({ newPassword: "my very own passphrase" }));

  expect((await api.auth.getCurrentUser()).status()).toBe(200);
  expect((await other.auth.getCurrentUser()).status()).toBe(401);
  expect((await other.me.setNewPassword({ newPassword: "another passphrase" })).status()).toBe(401);
});

test("a User without a Temporary Password can't set one this way", async ({
  api,
  loggedInUser,
}) => {
  const refused = await expectBody(
    api.me.setNewPassword({ newPassword: "a brand new passphrase" }),
    409,
  );

  expect(refused).toEqual({ error: "password_change_not_required" });
  await api.auth.logout();
  expect((await api.auth.login(loggedInUser)).status()).toBe(200);
});

test("setting a new password needs a session", async ({ api }) => {
  const refused = await expectBody(
    api.me.setNewPassword({ newPassword: "a brand new passphrase" }),
    401,
  );

  expect(refused).toEqual({ error: "unauthenticated" });
});

test("a session from a Temporary Password can still log out", async ({
  api,
  userWithTemporaryPassword: _userWithTemporaryPassword,
}) => {
  expect((await api.auth.logout()).status()).toBe(204);

  expect(await expectBody(api.auth.getCurrentUser(), 401)).toEqual({ error: "unauthenticated" });
});
