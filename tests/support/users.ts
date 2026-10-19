import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect } from "@playwright/test";

export interface TestUser {
  username: string;
  password: string;
}

// A Username no other test uses, so tests run in parallel without sharing state.
export function uniqueUsername(): string {
  return `t_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

// Creates a User through the test-hook route, which stands in for registration until Invite
// Codes exist (issue #8). `passwordIterations` makes a hash below the current target.
export async function createUser(
  request: APIRequestContext,
  options: { passwordIterations?: number } = {},
): Promise<TestUser> {
  const user = { username: uniqueUsername(), password: "correct horse battery" };
  const response = await request.post("/api/test/users", { data: { ...user, ...options } });
  expect(response.status()).toBe(201);
  return user;
}
