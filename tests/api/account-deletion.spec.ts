import { expectBody } from "../support/api/responses";
import { alien, amelie } from "../support/films";
import { expect, test } from "../support/fixtures";
import { uniqueUsername } from "../support/users";

test("deleting the account needs a session", async ({ api }) => {
  const deleted = await api.me.deleteAccount({ password: "correct horse battery" });

  expect(deleted.status()).toBe(401);
});

test("a wrong password deletes nothing", async ({ api, createApiClient, loggedInUser }) => {
  const refused = await expectBody(api.me.deleteAccount({ password: "not the password" }), 403);

  expect(refused).toEqual({ error: "wrong_password" });
  expect((await api.auth.getCurrentUser()).status()).toBe(200);
  const device = await createApiClient();
  expect((await device.auth.login(loggedInUser)).status()).toBe(200);
});

test("deleting the account needs the password in the body", async ({ loggedInApi }) => {
  for (const data of [{}, { password: "" }]) {
    const response = await loggedInApi.me.deleteAccount(data as never);
    expect(response.status(), JSON.stringify(data)).toBe(400);
  }
  expect((await loggedInApi.auth.getCurrentUser()).status()).toBe(200);
});

test("deleting the account removes everything the User owns, and ends their sessions", async ({
  api,
  createApiClient,
  loggedInUser,
}) => {
  const film = await alien(api);
  const { logEntry } = await expectBody(
    api.log.createLogEntry({ mediaItemId: film.id, rating: 4 }),
    201,
  );
  const { mediaItem: manual } = await expectBody(
    api.catalog.addManualMediaItem({ mediaType: "film", title: "Home video" }),
    201,
  );
  const { listItem: planned } = await expectBody(
    api.backlog.addBacklogItem({ mediaItemId: manual.id }),
    201,
  );
  const { backlog } = await expectBody(api.backlog.getBacklog({ mediaType: "film" }));
  const { list } = await expectBody(
    api.lists.createList({ name: "Horror nights", mediaType: "film" }),
    201,
  );
  const { listItem } = await expectBody(
    api.lists.addListItem(list.id, { mediaItemId: film.id }),
    201,
  );
  const { shareLink } = await expectBody(api.lists.createShareLink(list.id), 201);
  expect((await api.sharedLists.getSharedList(shareLink.token)).status()).toBe(200);
  const { inviteCode } = await expectBody(api.inviteCodes.issueInviteCode(), 201);
  const records = {
    logEntries: [logEntry.id],
    lists: [backlog.id, list.id],
    listItems: [planned.id, listItem.id],
    mediaItems: [film.id, manual.id].sort((a, b) => a - b),
  };
  expect(await expectBody(api.testHooks.getStoredRecords(records))).toEqual(records);
  const phone = await createApiClient();
  expect((await phone.auth.login(loggedInUser)).status()).toBe(200);

  const deleted = await api.me.deleteAccount({ password: loggedInUser.password });

  expect(deleted.status()).toBe(204);
  expect(deleted.headers()["set-cookie"]).toMatch(/session=;.*Max-Age=0/);
  expect((await api.auth.getCurrentUser()).status()).toBe(401);
  expect((await phone.auth.getCurrentUser()).status()).toBe(401);

  const anyone = await createApiClient();
  expect((await anyone.auth.login(loggedInUser)).status()).toBe(401);
  expect((await anyone.sharedLists.getSharedList(shareLink.token)).status()).toBe(404);
  expect((await anyone.sharedLists.getSharedListPage(shareLink.token)).status()).toBe(404);
  const registration = await anyone.auth.register({
    inviteCode: inviteCode.code,
    username: uniqueUsername(),
    password: loggedInUser.password,
  });
  expect(await registration.json()).toEqual({ error: "invite_code_unknown" });

  // The catalog film stays: it has no owner.
  expect(await expectBody(api.testHooks.getStoredRecords(records))).toEqual({
    logEntries: [],
    lists: [],
    listItems: [],
    mediaItems: [film.id],
  });
});

test("people the User invited keep their accounts, and their inviter is cleared", async ({
  api,
  createApiClient,
  loggedInUser,
}) => {
  const { inviteCode } = await expectBody(api.inviteCodes.issueInviteCode(), 201);
  const invitee = await createApiClient();
  const registration = { username: uniqueUsername(), password: "a long enough password" };
  await expectBody(invitee.auth.register({ ...registration, inviteCode: inviteCode.code }), 201);
  const invited = await amelie(invitee);
  await expectBody(invitee.log.createLogEntry({ mediaItemId: invited.id, rating: 5 }), 201);

  const deleted = await api.me.deleteAccount({ password: loggedInUser.password });

  expect(deleted.status()).toBe(204);
  const invitedBy = api.testHooks.getInvitedBy(registration.username);
  expect(await expectBody(invitedBy)).toEqual({ invitedBy: null });
  expect(await expectBody(invitee.auth.getCurrentUser())).toEqual({
    user: { username: registration.username, displayName: registration.username },
  });
  const { logEntries } = await expectBody(invitee.log.getLogEntries());
  expect(logEntries.map((entry: { mediaItem: { id: number } }) => entry.mediaItem.id)).toEqual([
    invited.id,
  ]);
});

test("other Users' records of the same catalog film stay", async ({
  api,
  loggedInUser,
  otherUser,
}) => {
  const film = await alien(api);
  await expectBody(api.log.createLogEntry({ mediaItemId: film.id, rating: 2 }), 201);
  const { logEntry } = await expectBody(
    otherUser.log.createLogEntry({ mediaItemId: (await alien(otherUser)).id, rating: 5 }),
    201,
  );
  const { listItem } = await expectBody(
    otherUser.backlog.addBacklogItem({ mediaItemId: film.id }),
    201,
  );

  const deleted = await api.me.deleteAccount({ password: loggedInUser.password });

  expect(deleted.status()).toBe(204);
  const { logEntries } = await expectBody(otherUser.log.getLogEntries());
  expect(logEntries).toEqual([logEntry]);
  expect(logEntry.mediaItem.id).toBe(film.id);
  const { backlog } = await expectBody(otherUser.backlog.getBacklog({ mediaType: "film" }));
  expect(backlog.items).toEqual([listItem]);
});
