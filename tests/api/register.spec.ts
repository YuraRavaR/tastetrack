import { type APIRequestContext, test as base, expect } from "@playwright/test";
import { createUser, uniqueUsername } from "../support/users";

const day = 24 * 60 * 60 * 1000;

// With test hooks on, the Worker treats this header's time as now.
function at(time: number) {
  return { headers: { "X-Test-Now": new Date(time).toISOString() } };
}

// `request` is the issuer, logged in; `invitee` is a separate client with no session.
const test = base.extend<{ invitee: APIRequestContext }>({
  request: async ({ request }, use) => {
    const issuer = await createUser();
    expect((await request.post("/api/auth/login", { data: issuer })).status()).toBe(200);
    await use(request);
  },
  invitee: async ({ playwright, baseURL }, use) => {
    const invitee = await playwright.request.newContext({ baseURL });
    await use(invitee);
    await invitee.dispose();
  },
});

async function issueCode(request: APIRequestContext, options = {}): Promise<string> {
  const response = await request.post("/api/invite-codes", options);
  expect(response.status()).toBe(201);
  return (await response.json()).inviteCode.code;
}

function newInvitee(inviteCode: string) {
  return { inviteCode, username: uniqueUsername(), password: "a long enough password" };
}

test("an invitee registers with an Invite Code, is logged in, and the code becomes used", async ({
  request,
  invitee,
}) => {
  const registration = newInvitee(await issueCode(request));

  const response = await invitee.post("/api/auth/register", { data: registration });

  expect(response.status()).toBe(201);
  expect(await response.json()).toEqual({ user: { username: registration.username } });
  expect(await (await invitee.get("/api/auth/me")).json()).toEqual({
    user: { username: registration.username },
  });
  expect(await (await request.get("/api/invite-codes")).json()).toEqual({ inviteCodes: [] });
  await invitee.post("/api/auth/logout");
  const login = await invitee.post("/api/auth/login", {
    data: { username: registration.username, password: registration.password },
  });
  expect(login.status()).toBe(200);
});

test("a used Invite Code is refused", async ({ request, invitee }) => {
  const code = await issueCode(request);
  expect((await invitee.post("/api/auth/register", { data: newInvitee(code) })).status()).toBe(201);
  await invitee.post("/api/auth/logout");

  const second = await invitee.post("/api/auth/register", { data: newInvitee(code) });

  expect(second.status()).toBe(400);
  expect(await second.json()).toEqual({ error: "invite_code_used" });
  expect((await invitee.get("/api/auth/me")).status()).toBe(401);
});

test("an Invite Code is refused once 7 days have passed", async ({ request, invitee }) => {
  const issuedAt = Date.now();
  const code = await issueCode(request, at(issuedAt));

  const lastMoment = await invitee.post("/api/auth/register", {
    data: newInvitee(code),
    ...at(issuedAt + 7 * day),
  });

  expect(lastMoment.status()).toBe(400);
  expect(await lastMoment.json()).toEqual({ error: "invite_code_expired" });
  const justBefore = await invitee.post("/api/auth/register", {
    data: newInvitee(code),
    ...at(issuedAt + 7 * day - 1000),
  });
  expect(justBefore.status()).toBe(201);
});

test("an unknown Invite Code is refused", async ({ invitee }) => {
  const response = await invitee.post("/api/auth/register", {
    data: newInvitee("AAAA-BBBB-CCCC"),
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "invite_code_unknown" });
});

test("an Invite Code works typed in lower case, without dashes or with spaces around", async ({
  request,
  invitee,
}) => {
  const code = await issueCode(request);
  const typed = ` ${code.replaceAll("-", "").toLowerCase()} `;

  const response = await invitee.post("/api/auth/register", { data: newInvitee(typed) });

  expect(response.status()).toBe(201);
});

test("a Username taken in another letter case is refused and the code stays usable", async ({
  request,
  invitee,
}) => {
  const existing = await createUser();
  const code = await issueCode(request);

  const taken = await invitee.post("/api/auth/register", {
    data: { ...newInvitee(code), username: existing.username.toUpperCase() },
  });

  expect(taken.status()).toBe(409);
  expect(await taken.json()).toEqual({ error: "username_taken" });
  expect((await (await request.get("/api/invite-codes")).json()).inviteCodes).toHaveLength(1);
  expect((await invitee.post("/api/auth/register", { data: newInvitee(code) })).status()).toBe(201);
});

test("a Username is 3–30 letters, digits or underscores", async ({ request, invitee }) => {
  const code = await issueCode(request);

  for (const username of ["ab", "a".repeat(31), "has space", "ім_я", "dash-ed"]) {
    const response = await invitee.post("/api/auth/register", {
      data: { ...newInvitee(code), username },
    });
    expect(response.status(), username).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  }
  const longest = `${uniqueUsername()}_ABCDEFGHIJ`.slice(0, 30);
  const accepted = await invitee.post("/api/auth/register", {
    data: { ...newInvitee(code), username: longest },
  });
  expect(accepted.status()).toBe(201);
});

test("any password of 10–128 characters is accepted, with no composition rules", async ({
  request,
  invitee,
}) => {
  for (const password of ["x".repeat(9), "x".repeat(129)]) {
    const code = await issueCode(request);
    const response = await invitee.post("/api/auth/register", {
      data: { ...newInvitee(code), password },
    });
    expect(response.status(), `${password.length} characters`).toBe(400);
  }

  for (const password of ["aaaaaaaaaa", "x".repeat(128), "correct horse battery staple"]) {
    const code = await issueCode(request);
    const response = await invitee.post("/api/auth/register", {
      data: { ...newInvitee(code), password },
    });
    expect(response.status(), `${password.length} characters`).toBe(201);
    await invitee.post("/api/auth/logout");
  }
});

// Who invited whom isn't shown in the app yet, so a test hook reads it.
test("the new User records who invited them", async ({ request, invitee }) => {
  const issuer = (await (await request.get("/api/auth/me")).json()).user.username;
  const registration = newInvitee(await issueCode(request));

  await invitee.post("/api/auth/register", { data: registration });

  const invitedBy = await request.get(`/api/test/users/${registration.username}/invited-by`);
  expect(await invitedBy.json()).toEqual({ invitedBy: issuer });
});
