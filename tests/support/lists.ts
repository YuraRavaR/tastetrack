import { type APIRequestContext, expect } from "@playwright/test";

// Makes a List: its summary, as the Worker answers.
export async function createList(
  api: APIRequestContext,
  data: { name: string; description?: string },
) {
  const response = await api.post("/api/lists", { data: { mediaType: "film", ...data } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).list;
}

// Adds `count` placeholder films to one of the logged-in User's Lists through the test-hook
// route, which exists only where test hooks are on (local and staging): far quicker than adding
// that many through search. The placeholders have no metadata, so they show as films whose
// details are unavailable.
export async function fillList(
  api: APIRequestContext,
  listId: number,
  count: number,
): Promise<void> {
  const response = await api.post(`/api/test/lists/${listId}/items`, { data: { count } });
  expect(response.status(), await response.text()).toBe(204);
}
