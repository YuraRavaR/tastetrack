import { bodyOf } from "../support/api/responses";
import { at, day } from "../support/clock";
import { expect, test } from "../support/fixtures";

test("a User generates an Invite Code valid for 7 days and sees it as active", async ({
  loggedInApi,
}) => {
  const now = Date.now();

  const { inviteCode } = await bodyOf(loggedInApi.inviteCodes.issueInviteCode(at(now)), 201);

  expect(inviteCode.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  expect(inviteCode.expiresAt).toBe(new Date(now + 7 * day).toISOString());
  expect(await bodyOf(loggedInApi.inviteCodes.listActiveInviteCodes(at(now)))).toEqual({
    inviteCodes: [inviteCode],
  });
});

test("a sixth active Invite Code is refused until one of the five expires", async ({
  loggedInApi,
}) => {
  const now = Date.now();
  for (let i = 0; i < 5; i += 1) {
    expect((await loggedInApi.inviteCodes.issueInviteCode(at(now))).status()).toBe(201);
  }

  const sixth = await bodyOf(loggedInApi.inviteCodes.issueInviteCode(at(now)), 409);

  expect(sixth).toEqual({ error: "invite_code_limit" });
  const active = await bodyOf(loggedInApi.inviteCodes.listActiveInviteCodes(at(now)));
  expect(active.inviteCodes).toHaveLength(5);
  // Once the five expire they no longer count.
  expect((await loggedInApi.inviteCodes.issueInviteCode(at(now + 7 * day))).status()).toBe(201);
});

test("without a session, Invite Codes are a 401", async ({ api }) => {
  expect((await api.inviteCodes.issueInviteCode()).status()).toBe(401);
  expect((await api.inviteCodes.listActiveInviteCodes()).status()).toBe(401);
});
