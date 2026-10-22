import { expect, test } from "@playwright/test";
import { matrix, matrixId } from "../support/films";
import { fillList } from "../support/lists";
import { evict } from "../support/tmdb";
import { logInNewUser } from "../support/users";

test("a List shows films missing from the cache as placeholders, then fills them in", async ({
  page,
}) => {
  await logInNewUser(page.request);
  const created = await page.request.post("/api/lists", {
    data: { mediaType: "film", name: "Late nineties" },
  });
  const listId = (await created.json()).list.id;
  // Placeholders TMDB has never heard of come first, so the page fills them, or tries to, and
  // leaves the film to the client.
  await fillList(page.request, listId, 10);
  const added = await page.request.post(`/api/lists/${listId}/items`, {
    data: { mediaItemId: (await matrix(page.request)).id },
  });
  expect(added.status()).toBe(201);
  await evict(page.request, matrixId);

  await page.goto(`/lists/${listId}`);

  const items = page.getByRole("list", { name: "Late nineties" }).getByRole("listitem");
  await expect(items).toHaveCount(11);
  await expect(items.last()).toContainText("The Matrix (1999)");
  await expect(items.first()).toContainText("Film details unavailable");
});
