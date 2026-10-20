import { type APIRequestContext, expect } from "@playwright/test";
import type { TestUser } from "./users";

// Adds `count` placeholder Manual Media Items for the User through the test-hook route, which
// exists only where test hooks are on (local and staging): far quicker than making that many one
// by one. They are titled "Placeholder 1", "Placeholder 2" and so on, with no year.
export async function fillManualMediaItems(
  api: APIRequestContext,
  user: TestUser,
  count: number,
): Promise<void> {
  const response = await api.post(`/api/test/users/${user.username}/manual-items`, {
    data: { count },
  });
  expect(response.status(), await response.text()).toBe(204);
}
