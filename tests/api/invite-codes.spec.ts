import { type APIRequestContext, expect, test } from "@playwright/test";
import { createUser } from "../support/users";

const day = 24 * 60 * 60 * 1000;

// With test hooks on, the Worker treats this header's time as now.
function at(time: number) {
  return { headers: { "X-Test-Now": new Date(time).toISOString() } };
}

async function logIn(request: APIRequestContext) {
  const user = await createUser();
  const login = await request.post("/api/auth/login", { data: user });
  expect(login.status()).toBe(200);
  return user;
}

test("a User generates an Invite Code valid for 7 days and sees it as active", async ({
  request,
}) => {
  await logIn(request);
  const now = Date.now();

  const created = await request.post("/api/invite-codes", at(now));

  expect(created.status()).toBe(201);
  const { inviteCode } = await created.json();
  expect(inviteCode.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  expect(inviteCode.expiresAt).toBe(new Date(now + 7 * day).toISOString());
  const active = await request.get("/api/invite-codes", at(now));
  expect(active.status()).toBe(200);
  expect(await active.json()).toEqual({ inviteCodes: [inviteCode] });
});

test("a sixth active Invite Code is refused until one of the five expires", async ({ request }) => {
  await logIn(request);
  const now = Date.now();
  for (let i = 0; i < 5; i += 1) {
    expect((await request.post("/api/invite-codes", at(now))).status()).toBe(201);
  }

  const sixth = await request.post("/api/invite-codes", at(now));

  expect(sixth.status()).toBe(409);
  expect(await sixth.json()).toEqual({ error: "invite_code_limit" });
  const active = await (await request.get("/api/invite-codes", at(now))).json();
  expect(active.inviteCodes).toHaveLength(5);
  // Once the five expire they no longer count.
  expect((await request.post("/api/invite-codes", at(now + 7 * day))).status()).toBe(201);
});

test("without a session, Invite Codes are a 401", async ({ request }) => {
  expect((await request.post("/api/invite-codes")).status()).toBe(401);
  expect((await request.get("/api/invite-codes")).status()).toBe(401);
});

test("the OpenAPI spec describes Invite Codes and registration", async ({ request }) => {
  const spec = await (await request.get("/api/openapi.json")).json();

  expect(spec.paths["/api/invite-codes"].post.responses["409"]).toBeDefined();
  expect(spec.paths["/api/invite-codes"].get.security).toEqual([{ session: [] }]);
  expect(spec.paths["/api/auth/register"].post.responses["201"]).toBeDefined();
  expect(spec.paths["/api/auth/register"].post.responses["409"]).toBeDefined();
});
