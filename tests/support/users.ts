import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, request, test } from "@playwright/test";
import { ApiClient } from "./api/ApiClient";
import { TestHooksController } from "./api/controllers/TestHooksController";
import { expectBody } from "./api/responses";

export interface TestUser {
  username: string;
  password: string;
}

const password = "correct horse battery";

function randomTail(): string {
  return randomUUID().replaceAll("-", "").slice(0, 20);
}

// A Username no other test uses, so tests run in parallel without sharing state.
export function uniqueUsername(): string {
  return `t_${randomTail()}`;
}

// Creates a User without an Invite Code through the test-hook route, which exists only where test
// hooks are on (local and staging), so such seed Users never exist in production.
async function createSeedUser(api: APIRequestContext): Promise<TestUser> {
  const user = { username: `seed_${randomTail()}`, password };
  await expectBody(new TestHooksController(api).createSeedUser(user), 201);
  return user;
}

// One seed User per worker process and base URL issues the Invite Codes for that worker's tests.
// A worker runs one test at a time, so it never holds more than one active code, well within
// the limit of 5, and a worker that restarts after a failure starts with a fresh seed.
const seeds = new Map<string, Promise<TestUser>>();

function seedFor(api: APIRequestContext, baseURL: string): Promise<TestUser> {
  let seed = seeds.get(baseURL);
  if (!seed) {
    seed = createSeedUser(api);
    seeds.set(baseURL, seed);
  }
  return seed;
}

// Creates a fresh User and logs them in on `api`, a request context or a page's `request`.
export async function logInNewUser(api: APIRequestContext): Promise<TestUser> {
  const user = await createUser();
  expect((await api.post("/api/auth/login", { data: user })).status()).toBe(200);
  return user;
}

// Creates a fresh User the way a real one arrives: a seed User issues an Invite Code and the new
// User registers with it through the public API. It runs in its own API context, so neither
// session ends up in the calling test's browser or request context; log in to use the User.
export async function createUser(): Promise<TestUser> {
  const { baseURL } = test.info().project.use;
  if (!baseURL) throw new Error("createUser needs the project's baseURL");
  const api = await request.newContext({ baseURL });
  try {
    const { auth, inviteCodes } = new ApiClient(api);
    await expectBody(auth.login(await seedFor(api, baseURL)));
    const { inviteCode } = await expectBody(inviteCodes.issueInviteCode(), 201);
    const user = { username: uniqueUsername(), password };
    await expectBody(auth.register({ ...user, inviteCode: inviteCode.code }), 201);
    return user;
  } finally {
    await api.dispose();
  }
}

// Resets the User's password as the Operator does, through the test-hook route, and returns the
// Temporary Password. Every session of theirs ends.
export async function resetPassword(api: APIRequestContext, username: string): Promise<string> {
  const reset = new TestHooksController(api).resetPassword(username);
  return (await expectBody(reset)).temporaryPassword;
}
