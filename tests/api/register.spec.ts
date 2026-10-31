import type { ApiClient } from "../support/api/ApiClient";
import type { RequestOptions } from "../support/api/controllers/BaseController";
import { endpoints } from "../support/api/endpoints";
import { bodyOf } from "../support/api/responses";
import { at, day } from "../support/clock";
import { test as base, expect } from "../support/fixtures";
import { createUser, uniqueUsername } from "../support/users";

// `issuer` is a logged-in client that issues the Invite Codes; `invitee` is a client with no session.
const test = base.extend<{ issuer: ApiClient; invitee: ApiClient }>({
  issuer: async ({ loggedInApi }, use) => {
    await use(loggedInApi);
  },
  invitee: async ({ createApiClient }, use) => {
    await use(await createApiClient());
  },
});

async function issueCode(issuer: ApiClient, options?: RequestOptions): Promise<string> {
  const { inviteCode } = await bodyOf(issuer.inviteCodes.issueInviteCode(options), 201);
  return inviteCode.code;
}

function newInvitee(inviteCode: string) {
  return { inviteCode, username: uniqueUsername(), password: "a long enough password" };
}

test("an invitee registers with an Invite Code, is logged in, and the code becomes used", async ({
  issuer,
  invitee,
}) => {
  const registration = newInvitee(await issueCode(issuer));

  const registered = await bodyOf(invitee.auth.register(registration), 201);

  expect(registered).toEqual({
    user: { username: registration.username, displayName: registration.username },
  });
  expect(await bodyOf(invitee.auth.getCurrentUser())).toEqual({
    user: { username: registration.username, displayName: registration.username },
  });
  expect(await bodyOf(issuer.inviteCodes.listActiveInviteCodes())).toEqual({ inviteCodes: [] });
  await invitee.auth.logout();
  const login = await invitee.auth.login({
    username: registration.username,
    password: registration.password,
  });
  expect(login.status()).toBe(200);
});

test("a used Invite Code is refused", async ({ issuer, invitee }) => {
  const code = await issueCode(issuer);
  expect((await invitee.auth.register(newInvitee(code))).status()).toBe(201);
  await invitee.auth.logout();

  const second = await bodyOf(invitee.auth.register(newInvitee(code)), 400);

  expect(second).toEqual({ error: "invite_code_used" });
  expect((await invitee.auth.getCurrentUser()).status()).toBe(401);
});

test("an Invite Code is refused once 7 days have passed", async ({ issuer, invitee }) => {
  const issuedAt = Date.now();
  const code = await issueCode(issuer, at(issuedAt));

  const lastMoment = await bodyOf(
    invitee.auth.register(newInvitee(code), at(issuedAt + 7 * day)),
    400,
  );

  expect(lastMoment).toEqual({ error: "invite_code_expired" });
  const justBefore = await invitee.auth.register(newInvitee(code), at(issuedAt + 7 * day - 1000));
  expect(justBefore.status()).toBe(201);
});

test("an unknown Invite Code is refused", async ({ invitee }) => {
  const unknown = await bodyOf(invitee.auth.register(newInvitee("AAAA-BBBB-CCCC")), 400);

  expect(unknown).toEqual({ error: "invite_code_unknown" });
});

test("an Invite Code works typed in lower case, without dashes or with spaces around", async ({
  issuer,
  invitee,
}) => {
  const code = await issueCode(issuer);
  const typed = ` ${code.replaceAll("-", "").toLowerCase()} `;

  const response = await invitee.auth.register(newInvitee(typed));

  expect(response.status()).toBe(201);
});

test("a Username taken in another letter case is refused and the code stays usable", async ({
  issuer,
  invitee,
}) => {
  const existing = await createUser();
  const code = await issueCode(issuer);

  const taken = await bodyOf(
    invitee.auth.register({ ...newInvitee(code), username: existing.username.toUpperCase() }),
    409,
  );

  expect(taken).toEqual({ error: "username_taken" });
  expect((await bodyOf(issuer.inviteCodes.listActiveInviteCodes())).inviteCodes).toHaveLength(1);
  expect((await invitee.auth.register(newInvitee(code))).status()).toBe(201);
});

test("a Username is 3–30 letters, digits or underscores", async ({ issuer, invitee }) => {
  const code = await issueCode(issuer);

  for (const username of ["ab", "a".repeat(31), "has space", "ім_я", "dash-ed"]) {
    const response = await invitee.auth.register({ ...newInvitee(code), username });
    expect(response.status(), username).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
  const longest = `${uniqueUsername()}_ABCDEFGHIJ`.slice(0, 30);
  const accepted = await invitee.auth.register({ ...newInvitee(code), username: longest });
  expect(accepted.status()).toBe(201);
});

test("any password of 10–128 characters is accepted, with no composition rules", async ({
  issuer,
  invitee,
}) => {
  for (const password of ["x".repeat(9), "x".repeat(129)]) {
    const code = await issueCode(issuer);
    const response = await invitee.auth.register({ ...newInvitee(code), password });
    expect(response.status(), `${password.length} characters`).toBe(400);
  }

  for (const password of ["aaaaaaaaaa", "x".repeat(128), "correct horse battery staple"]) {
    const code = await issueCode(issuer);
    const response = await invitee.auth.register({ ...newInvitee(code), password });
    expect(response.status(), `${password.length} characters`).toBe(201);
    await invitee.auth.logout();
  }
});

// Who invited whom isn't shown in the app yet, so a test hook reads it.
test("the new User records who invited them", async ({ issuer, invitee, request }) => {
  const { user } = await bodyOf(issuer.auth.getCurrentUser());
  const registration = newInvitee(await issueCode(issuer));

  await invitee.auth.register(registration);

  const invitedBy = endpoints.testHooks.invitedBy(registration.username);
  expect(await bodyOf(request.get(invitedBy))).toEqual({ invitedBy: user.username });
});
