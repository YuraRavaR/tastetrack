import type { APIRequestContext } from "@playwright/test";
import { ListsController } from "../api/controllers/ListsController";
import { expectBody } from "../api/responses";

// Makes a List: its summary, as the Worker answers.
export async function createList(
  api: APIRequestContext,
  data: { name: string; description?: string },
) {
  const created = new ListsController(api).createList({ mediaType: "film", ...data });
  return (await expectBody(created, 201)).list;
}
