import { expectBody } from "../support/api/responses";
import { matrix, matrixReference } from "../support/scenarios/films";
import { expect, test } from "../support/ui/fixtures";

test("a List shows films missing from the cache as placeholders, then fills them in", async ({
  ui,
  loggedInApi: api,
}) => {
  const created = api.lists.createList({ mediaType: "film", name: "Late nineties" });
  const { list } = await expectBody(created, 201);
  // Placeholders TMDB has never heard of come first, so the page fills them, or tries to, and
  // leaves the film to the client.
  expect((await api.testHooks.fillList(list.id, 10)).status()).toBe(204);
  const added = await api.lists.addListItem(list.id, { mediaItemId: (await matrix(api)).id });
  expect(added.status()).toBe(201);
  expect((await api.testHooks.evictFromCatalogCache(matrixReference)).status()).toBe(204);

  await ui.listPage.goto(list.id);

  const items = ui.listPage.items("Late nineties");
  await expect(items).toHaveCount(11);
  await expect(items.last()).toContainText("The Matrix");
  await expect(items.first()).toContainText("Film details unavailable");
});
