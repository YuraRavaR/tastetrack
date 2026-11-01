import { expectBody } from "../support/api/responses";
import { expect, test } from "../support/fixtures";

test("a User edits their Display Name, and their Share Links show it", async ({
  api,
  createApiClient,
  loggedInUser,
}) => {
  const { backlog } = await expectBody(api.backlog.getBacklog({ mediaType: "film" }));
  const { shareLink } = await expectBody(api.lists.createShareLink(backlog.id), 201);

  const updated = await expectBody(api.me.updateDisplayName({ displayName: "Олена К." }));

  const expected = { username: loggedInUser.username, displayName: "Олена К." };
  expect(updated).toEqual({ user: expected });
  expect(await expectBody(api.auth.getCurrentUser())).toEqual({ user: expected });
  const visitor = await createApiClient();
  const { sharedList } = await expectBody(visitor.sharedLists.getSharedList(shareLink.token));
  expect(sharedList.owner).toEqual({ displayName: "Олена К." });
  expect(sharedList.title).toBe("Олена К.'s Watchlist");
});

test("a Display Name is trimmed, and clearing it puts the Username back", async ({
  api,
  loggedInUser,
}) => {
  const trimmed = await expectBody(api.me.updateDisplayName({ displayName: "  Olena  " }));
  expect(trimmed.user.displayName).toBe("Olena");

  for (const cleared of ["   ", null]) {
    await expectBody(api.me.updateDisplayName({ displayName: "Olena" }));
    const updated = await expectBody(api.me.updateDisplayName({ displayName: cleared }));
    expect(updated.user.displayName).toBe(loggedInUser.username);
  }
});

test("a Display Name is at most 50 characters", async ({ api, loggedInUser }) => {
  await expectBody(api.me.updateDisplayName({ displayName: "я".repeat(50) }));

  const tooLong = await expectBody(api.me.updateDisplayName({ displayName: "я".repeat(51) }), 400);

  expect(tooLong).toEqual({ error: "invalid_request" });
  const { user: current } = await expectBody(api.auth.getCurrentUser());
  expect(current).toEqual({ username: loggedInUser.username, displayName: "я".repeat(50) });
});

test("changing the Display Name or password needs a session", async ({ api }) => {
  expect((await api.me.updateDisplayName({ displayName: "Olena" })).status()).toBe(401);
  const changed = await api.me.changePassword({
    currentPassword: "correct horse battery",
    newPassword: "x".repeat(10),
  });
  expect(changed.status()).toBe(401);
});

test("a User changes their password by giving their current one", async ({
  api,
  createApiClient,
  loggedInUser,
}) => {
  const { username, password } = loggedInUser;

  const changed = await api.me.changePassword({
    currentPassword: password,
    newPassword: "a brand new passphrase",
  });

  expect(changed.status()).toBe(204);
  const device = await createApiClient();
  expect((await device.auth.login(loggedInUser)).status()).toBe(401);
  const withNew = await device.auth.login({ username, password: "a brand new passphrase" });
  expect(withNew.status()).toBe(200);
});

test("a wrong current password changes nothing", async ({ api, createApiClient, loggedInUser }) => {
  const other = await createApiClient();
  await expectBody(other.auth.login(loggedInUser));

  const refused = await expectBody(
    api.me.changePassword({
      currentPassword: "not the password",
      newPassword: "a brand new passphrase",
    }),
    403,
  );

  expect(refused).toEqual({ error: "wrong_password" });
  expect((await other.auth.getCurrentUser()).status()).toBe(200);
  const device = await createApiClient();
  expect((await device.auth.login(loggedInUser)).status()).toBe(200);
});

test("the new password is 10–128 characters, like any password", async ({ api, loggedInUser }) => {
  const currentPassword = loggedInUser.password;

  for (const newPassword of ["x".repeat(9), "x".repeat(129)]) {
    const response = await api.me.changePassword({ currentPassword, newPassword });
    expect(response.status(), newPassword).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
  const shortest = "x".repeat(10);
  const changed = await api.me.changePassword({ currentPassword, newPassword: shortest });
  expect(changed.status()).toBe(204);
  const longest = await api.me.changePassword({
    currentPassword: shortest,
    newPassword: "x".repeat(128),
  });
  expect(longest.status()).toBe(204);
});

test("changing the password ends the User's other sessions, and the current one stays", async ({
  api,
  createApiClient,
  loggedInUser,
  otherUser,
}) => {
  const [phone, laptop] = [await createApiClient(), await createApiClient()];
  await expectBody(phone.auth.login(loggedInUser));
  await expectBody(laptop.auth.login(loggedInUser));

  const changed = await api.me.changePassword({
    currentPassword: loggedInUser.password,
    newPassword: "a brand new passphrase",
  });

  expect(changed.status()).toBe(204);
  expect((await api.auth.getCurrentUser()).status()).toBe(200);
  for (const device of [phone, laptop]) {
    expect((await device.auth.getCurrentUser()).status()).toBe(401);
  }
  expect((await otherUser.auth.getCurrentUser()).status()).toBe(200);
});
