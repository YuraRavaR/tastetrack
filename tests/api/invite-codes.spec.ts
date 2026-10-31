import { expect, test } from "@playwright/test";
import { at } from "../support/clock";
import { logInNewUser } from "../support/users";

const day = 24 * 60 * 60 * 1000;

test("a User generates an Invite Code valid for 7 days and sees it as active", async ({
  request,
}) => {
  await logInNewUser(request);
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
  await logInNewUser(request);
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
