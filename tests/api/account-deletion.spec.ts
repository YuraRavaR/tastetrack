import { type APIRequestContext, expect, request as requests, test } from "@playwright/test";
import { alien, amelie } from "../support/films";
import { createUser, logInNewUser, type TestUser, uniqueUsername } from "../support/users";

async function deleteUser(request: APIRequestContext, password: string) {
  return request.delete("/api/me", { data: { password } });
}

// A request context of its own, as another device or someone else; dispose of it when done.
function newDevice() {
  return requests.newContext({ baseURL: test.info().project.use.baseURL });
}

// The login's status code: 200 when the User could log in.
async function logInStatus(api: APIRequestContext, user: TestUser) {
  return (await api.post("/api/auth/login", { data: user })).status();
}

async function created<T>(response: Promise<{ status(): number; json(): Promise<T> }>) {
  const done = await response;
  expect(done.status()).toBe(201);
  return done.json();
}

// Which of these records the database still holds, each kind in id order, through a test hook:
// the API shows a User's records only to them.
async function storedRecords(request: APIRequestContext, ids: Record<string, number[]>) {
  const response = await request.post("/api/test/records", { data: ids });
  expect(response.status()).toBe(200);
  return response.json();
}

test("deleting the account needs a session", async () => {
  const anonymous = await newDevice();

  expect((await deleteUser(anonymous, "correct horse battery")).status()).toBe(401);
  await anonymous.dispose();
});

test("a wrong password deletes nothing", async ({ request }) => {
  const user = await logInNewUser(request);

  const response = await deleteUser(request, "not the password");

  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "wrong_password" });
  expect((await request.get("/api/auth/me")).status()).toBe(200);
  const device = await newDevice();
  expect(await logInStatus(device, user)).toBe(200);
  await device.dispose();
});

test("deleting the account needs the password in the body", async ({ request }) => {
  await logInNewUser(request);

  for (const data of [{}, { password: "" }]) {
    const response = await request.delete("/api/me", { data });
    expect(response.status(), JSON.stringify(data)).toBe(400);
  }
  expect((await request.get("/api/auth/me")).status()).toBe(200);
});

test("deleting the account removes everything the User owns, and ends their sessions", async ({
  request,
}) => {
  const user = await logInNewUser(request);
  const film = await alien(request);
  const { logEntry } = await created(
    request.post("/api/log-entries", { data: { mediaItemId: film.id, rating: 4 } }),
  );
  const { mediaItem: manual } = await created(
    request.post("/api/catalog/manual-items", { data: { mediaType: "film", title: "Home video" } }),
  );
  const { listItem: planned } = await created(
    request.post("/api/backlog/items", { data: { mediaItemId: manual.id } }),
  );
  const { backlog } = await (await request.get("/api/backlog?mediaType=film")).json();
  const { list } = await created(
    request.post("/api/lists", { data: { name: "Horror nights", mediaType: "film" } }),
  );
  const { listItem } = await created(
    request.post(`/api/lists/${list.id}/items`, { data: { mediaItemId: film.id } }),
  );
  const { shareLink } = await created(request.post(`/api/lists/${list.id}/share-link`));
  expect((await request.get(`/api/shared-lists/${shareLink.token}`)).status()).toBe(200);
  const { inviteCode } = await created(request.post("/api/invite-codes"));
  const records = {
    logEntries: [logEntry.id],
    lists: [backlog.id, list.id],
    listItems: [planned.id, listItem.id],
    mediaItems: [film.id, manual.id].sort((a, b) => a - b),
  };
  expect(await storedRecords(request, records)).toEqual(records);
  const phone = await newDevice();
  expect(await logInStatus(phone, user)).toBe(200);

  const response = await deleteUser(request, user.password);

  expect(response.status()).toBe(204);
  expect(response.headers()["set-cookie"]).toMatch(/session=;.*Max-Age=0/);
  expect((await request.get("/api/auth/me")).status()).toBe(401);
  expect((await phone.get("/api/auth/me")).status()).toBe(401);
  await phone.dispose();

  const anyone = await newDevice();
  expect(await logInStatus(anyone, user)).toBe(401);
  expect((await anyone.get(`/api/shared-lists/${shareLink.token}`)).status()).toBe(404);
  expect((await anyone.get(`/s/${shareLink.token}`)).status()).toBe(404);
  const registration = await anyone.post("/api/auth/register", {
    data: { inviteCode: inviteCode.code, username: uniqueUsername(), password: user.password },
  });
  expect(await registration.json()).toEqual({ error: "invite_code_unknown" });
  await anyone.dispose();

  // The catalog film stays: it has no owner.
  expect(await storedRecords(request, records)).toEqual({
    logEntries: [],
    lists: [],
    listItems: [],
    mediaItems: [film.id],
  });
});

test("people the User invited keep their accounts, and their inviter is cleared", async ({
  request,
}) => {
  const inviter = await logInNewUser(request);
  const { inviteCode } = await created(request.post("/api/invite-codes"));
  const invitee = await newDevice();
  const registration = { username: uniqueUsername(), password: "a long enough password" };
  await created(
    invitee.post("/api/auth/register", { data: { ...registration, inviteCode: inviteCode.code } }),
  );
  const invited = await amelie(invitee);
  await created(invitee.post("/api/log-entries", { data: { mediaItemId: invited.id, rating: 5 } }));

  expect((await deleteUser(request, inviter.password)).status()).toBe(204);

  const invitedBy = await request.get(`/api/test/users/${registration.username}/invited-by`);
  expect(await invitedBy.json()).toEqual({ invitedBy: null });
  expect(await (await invitee.get("/api/auth/me")).json()).toEqual({
    user: { username: registration.username, displayName: registration.username },
  });
  const { logEntries } = await (await invitee.get("/api/log-entries")).json();
  expect(logEntries.map((entry: { mediaItem: { id: number } }) => entry.mediaItem.id)).toEqual([
    invited.id,
  ]);
  await invitee.dispose();
});

test("other Users' records of the same catalog film stay", async ({ request }) => {
  const leaving = await logInNewUser(request);
  const film = await alien(request);
  await created(request.post("/api/log-entries", { data: { mediaItemId: film.id, rating: 2 } }));
  const staying = await newDevice();
  await logInStatus(staying, await createUser());
  const { logEntry } = await created(
    staying.post("/api/log-entries", {
      data: { mediaItemId: (await alien(staying)).id, rating: 5 },
    }),
  );
  const { listItem } = await created(
    staying.post("/api/backlog/items", { data: { mediaItemId: film.id } }),
  );

  expect((await deleteUser(request, leaving.password)).status()).toBe(204);

  const { logEntries } = await (await staying.get("/api/log-entries")).json();
  expect(logEntries).toEqual([logEntry]);
  expect(logEntry.mediaItem.id).toBe(film.id);
  const { backlog } = await (await staying.get("/api/backlog?mediaType=film")).json();
  expect(backlog.items).toEqual([listItem]);
  await staying.dispose();
});

test("the OpenAPI spec describes deleting the account", async ({ request }) => {
  const spec = await (await request.get("/api/openapi.json")).json();

  const deletion = spec.paths["/api/me"].delete;
  expect(deletion.security).toEqual([{ session: [] }]);
  expect(Object.keys(deletion.responses)).toEqual(["204", "400", "401", "403"]);
  expect(spec.components.schemas.UserDeletionRequest.required).toEqual(["password"]);
});
