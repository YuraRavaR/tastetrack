import { type APIRequestContext, expect } from "@playwright/test";
import type { TestUser } from "./users";

// Plans `count` placeholder films for the User through the test-hook route, which exists only
// where test hooks are on (local and staging): far quicker than adding that many through search.
// The placeholders have no metadata, so they show as films whose details are unavailable.
export async function fillBacklog(
  api: APIRequestContext,
  user: TestUser,
  count: number,
): Promise<void> {
  const response = await api.post(`/api/test/users/${user.username}/backlog`, { data: { count } });
  expect(response.status(), await response.text()).toBe(204);
}
