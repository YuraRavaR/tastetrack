import { type APIRequestContext, expect } from "@playwright/test";
import { ListsController } from "../api/controllers/ListsController";
import { TestHooksController } from "../api/controllers/TestHooksController";
import { expectBody } from "../api/responses";

// Makes a List: its summary, as the Worker answers.
export async function createList(
  api: APIRequestContext,
  data: { name: string; description?: string },
) {
  const created = new ListsController(api).createList({ mediaType: "film", ...data });
  return (await expectBody(created, 201)).list;
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
  const response = await new TestHooksController(api).fillList(listId, count);
  expect(response.status(), await response.text()).toBe(204);
}
