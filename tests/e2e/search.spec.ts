import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { alien, aliens, amelie, newFilm, searchResultRow } from "../support/films";
import { createList } from "../support/lists";
import { callsRealTmdb } from "../support/tmdb";
import { logInNewUser } from "../support/users";

// Locally the Worker searches a TMDB fake; on staging, the real TMDB. Both know these films.

function alienResult(page: Page) {
  return searchResultRow(page, "Alien (1979)");
}

async function createListHolding(api: APIRequestContext, name: string, mediaItemId: number) {
  const list = await createList(api, { name });
  const added = await api.post(`/api/lists/${list.id}/items`, { data: { mediaItemId } });
  expect(added.status(), await added.text()).toBe(201);
  return list;
}

test("a User searches films as they type, in English or Ukrainian", { tag: "@smoke" }, async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search films" });
  const results = page.getByRole("list", { name: "Search results" });

  await search.fill("alien");

  await expect(results.getByText("Alien (1979)", { exact: true })).toBeVisible();
  await search.fill("чужий");
  await expect(results.getByText("Чужий (Alien, 1979)", { exact: true })).toBeVisible();
  await expect(results.getByText("Alien (1979)", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^search/i })).toHaveCount(0);
});

test("a result without a poster is named No poster, and one with a poster isn't", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search films" });
  const results = page.getByRole("list", { name: "Search results" });

  await search.fill("matrix");
  const placeholder = results
    .getByRole("listitem")
    .filter({ hasText: "The Matrix" })
    .getByRole("img", { name: "No poster" });
  await expect(placeholder).toBeVisible();

  await search.fill("alien");
  await expect(results.getByText("Alien (1979)", { exact: true })).toBeVisible();
  await expect(results.getByRole("img", { name: "No poster" })).toHaveCount(0);
});

test("a User clears the search with one click and can type again", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search films" });
  const results = page.getByRole("list", { name: "Search results" });
  const clear = page.getByRole("button", { name: "Clear search" });

  await expect(clear).toHaveCount(0);
  await search.fill("alien");
  await expect(results.getByText("Alien (1979)", { exact: true })).toBeVisible();
  await clear.click();

  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(results).toHaveCount(0);
  await expect(clear).toHaveCount(0);
});

test("typing a title makes one search once the User pauses", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  const searched: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/catalog/search") searched.push(url.searchParams.get("query") ?? "");
  });

  await page.getByRole("searchbox", { name: "Search films" }).pressSequentially("alien", {
    delay: 100,
  });

  await expect(
    page.getByRole("list", { name: "Search results" }).getByText("Alien (1979)", { exact: true }),
  ).toBeVisible();
  expect(searched).toEqual(["alien"]);
});

test("a User opens a result's film page and goes Back to the same results", async ({ page }) => {
  await logInNewUser(page.request);
  const film = await alien(page.request);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");

  await page.getByRole("link", { name: "Alien (1979)", exact: true }).click();

  await expect(page).toHaveURL(`/items/${film.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Alien" })).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL("/?q=alien");
  await expect(page.getByRole("searchbox", { name: "Search films" })).toHaveValue("alien");
  await expect(
    page
      .getByRole("list", { name: "Search results" })
      .getByRole("link", { name: "Alien (1979)", exact: true }),
  ).toBeVisible();
});

test("going Back from a film's page returns to where the User was in the results", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await Promise.all([alien(page.request), aliens(page.request), amelie(page.request)]);
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto("/?q=a");
  const film = page.getByRole("link", { name: /^Amélie/ });
  // In the middle of the screen, clear of the tab bar, so clicking it doesn't scroll the page.
  await film.evaluate((link) => link.scrollIntoView({ block: "center" }));
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);

  await film.click();
  await expect(page).toHaveURL(/\/items\/\d+$/);
  await page.goBack();

  await expect(film).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrolled);
});

test("a film not in the catalog has a plain title, until the User adds it", async ({ page }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  await logInNewUser(page.request);
  const film = newFilm();
  await page.goto("/");
  const results = page.getByRole("list", { name: "Search results" });

  await page.getByRole("searchbox", { name: "Search films" }).fill(film.query);

  await expect(results.getByText(film.label, { exact: true })).toBeVisible();
  await expect(results.getByRole("link", { name: film.label, exact: true })).toHaveCount(0);

  await results.getByRole("button", { name: "Want to watch" }).click();

  await expect(results.getByRole("link", { name: film.label, exact: true })).toBeVisible();
});

test("typing keeps the query in the URL as one history entry, and clearing removes it", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/log");
  await page.getByRole("link", { name: "Home", exact: true }).first().click();
  const search = page.getByRole("searchbox", { name: "Search films" });

  await search.pressSequentially("alien");
  await expect(page).toHaveURL("/?q=alien");

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page).toHaveURL("/");
  await page.reload();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Latest in your Log" })).toBeVisible();

  await search.fill("alien");
  await expect(page).toHaveURL("/?q=alien");
  await page.goBack();
  await expect(page).toHaveURL("/log");
});

test("a URL with a query runs that search, and Home leaves it", async ({ page }) => {
  await logInNewUser(page.request);

  await page.goto("/?q=alien");

  await expect(page.getByRole("searchbox", { name: "Search films" })).toHaveValue("alien");
  await expect(
    page.getByRole("list", { name: "Search results" }).getByText("Alien (1979)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest in your Log" })).toHaveCount(0);

  await page.getByRole("link", { name: "Home", exact: true }).first().click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("searchbox", { name: "Search films" })).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Latest in your Log" })).toBeVisible();
});

test("a User marks a film watched, then logs a rewatch with a new Rating", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/?q=alien");
  const result = alienResult(page);
  const dialog = page.getByRole("dialog", { name: "Alien", exact: true });
  const again = result.getByRole("button", { name: "Watched again" });
  await expect(result.getByRole("button", { name: "Mark watched" })).toBeVisible();
  let searches = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/catalog/search") searches += 1;
  });

  await result.getByRole("button", { name: "Mark watched" }).click();
  await expect(dialog.getByText("Watched", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("switch", { name: "Rewatch" })).not.toBeChecked();
  await expect(dialog.getByText("Last time")).toHaveCount(0);
  await dialog.getByRole("radio", { name: "4 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(result.getByRole("button", { name: "Mark watched" })).toHaveCount(0);
  await expect(result.getByRole("link", { name: "4 · 1 viewing" })).toBeVisible();

  await again.click();
  await expect(dialog.getByText("Watched again", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("switch", { name: "Rewatch" })).toBeChecked();
  await expect(dialog.getByText("Last time")).toContainText("Last time 4 ·");
  await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(0);
  await dialog.getByRole("radio", { name: "2.5 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(result.getByRole("link", { name: "2.5 · 2 viewings" })).toBeVisible();
  expect(searches).toBe(0);
  await result.getByRole("link", { name: "2.5 · 2 viewings" }).click();
  await expect(page).toHaveURL(/\/items\/\d+$/);
});

test("a backdated rewatch leaves the row's Current Rating as it was", async ({ page }) => {
  await logInNewUser(page.request);
  const { id: mediaItemId } = await alien(page.request);
  await page.request.post("/api/log-entries", {
    data: { mediaItemId, rating: 4, date: "2024-03-12" },
  });
  await page.goto("/?q=alien");
  const result = alienResult(page);
  const dialog = page.getByRole("dialog", { name: "Alien", exact: true });

  await result.getByRole("button", { name: "Watched again" }).click();
  await expect(dialog.getByText("Last time")).toHaveText("Last time 4 · Mar 12, 2024");
  await dialog.getByRole("radio", { name: "1 star", exact: true }).check();
  await dialog.getByRole("button", { name: "Other date" }).click();
  await dialog.getByLabel("Date watched").fill("2020-01-01");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(result.getByRole("link", { name: "4 · 2 viewings" })).toBeVisible();
});

test("the hint leaves out the date of a Log Entry with none", async ({ page }) => {
  await logInNewUser(page.request);
  const { id: mediaItemId } = await alien(page.request);
  await page.request.post("/api/log-entries", { data: { mediaItemId, rating: 3.5 } });
  await page.goto("/?q=alien");

  await alienResult(page).getByRole("button", { name: "Watched again" }).click();

  await expect(page.getByRole("dialog").getByText("Last time")).toHaveText("Last time 3.5");
});

test("a result shows two of its Lists, then how many more, each linking to its List", async ({
  page,
}) => {
  await logInNewUser(page.request);
  const { id: mediaItemId } = await alien(page.request);
  const first = await createListHolding(page.request, "First", mediaItemId);
  await createListHolding(page.request, "Second", mediaItemId);
  await createListHolding(page.request, "Third", mediaItemId);
  await page.goto("/?q=alien");
  const result = alienResult(page);

  await expect(result.getByRole("img", { name: "Lists" })).toBeVisible();
  await expect(result.getByRole("link", { name: "First", exact: true })).toBeVisible();
  await expect(result.getByRole("link", { name: "Second", exact: true })).toBeVisible();
  await expect(result.getByRole("link", { name: "Third", exact: true })).toHaveCount(0);
  await expect(result.getByText("+1", { exact: true })).toBeVisible();

  await result.getByRole("link", { name: "First", exact: true }).click();
  await expect(page).toHaveURL(`/lists/${first.id}`);
});

test("a result's List chips follow Add to list, without a new search", async ({ page }) => {
  await logInNewUser(page.request);
  await createList(page.request, { name: "Horror" });
  await page.goto("/?q=alien");
  const result = alienResult(page);
  const dialog = page.getByRole("dialog", { name: "Lists for Alien (1979)" });
  const horror = dialog.getByRole("checkbox", { name: "Horror" });
  const chip = result.getByRole("link", { name: "Horror", exact: true });
  await expect(result.getByRole("img", { name: "Lists" })).toHaveCount(0);

  await result.getByRole("button", { name: "Add to list" }).click();
  await horror.click();
  await expect(horror).toBeChecked();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(chip).toBeVisible();

  await result.getByRole("button", { name: "Add to list" }).click();
  await horror.click();
  await expect(horror).not.toBeChecked();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(chip).toHaveCount(0);
  await expect(result.getByRole("img", { name: "Lists" })).toHaveCount(0);
});

test("a result's List chips follow a change still saving when the dialog closes", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await createList(page.request, { name: "Horror" });
  await page.goto("/?q=alien");
  const result = alienResult(page);
  await page.route("**/api/lists/*/items", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });

  await result.getByRole("button", { name: "Add to list" }).click();
  const dialog = page.getByRole("dialog", { name: "Lists for Alien (1979)" });
  await dialog.getByRole("checkbox", { name: "Horror" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();

  await expect(result.getByRole("link", { name: "Horror", exact: true })).toBeVisible();
});

test("a result's actions keep one order, and fit a 360px phone", async ({ page }) => {
  await logInNewUser(page.request);
  const { id: mediaItemId } = await alien(page.request);
  await page.request.post("/api/log-entries", { data: { mediaItemId, rating: 4 } });
  await page.goto("/?q=alien");
  const result = alienResult(page);
  const poster = result.locator("img");
  const again = result.getByRole("button", { name: "Watched again" });
  const bookmark = result.getByRole("button", { name: "Want to watch" });
  const addToList = result.getByRole("button", { name: "Add to list" });

  await page.setViewportSize({ width: 360, height: 740 });
  await expect(again).toBeVisible();
  await expect(again.locator("svg")).toBeHidden();
  await expect(poster).toHaveCSS("width", "72px");
  await expect(poster).toHaveCSS("height", "108px");
  await expect(again).toHaveCSS("height", "44px");
  await expect(bookmark).toHaveCSS("width", "44px");
  await expect(addToList).toHaveCSS("height", "44px");
  const fits = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  });
  expect(fits).toBe(true);
  const [left, middle, right] = await Promise.all(
    [again, bookmark, addToList].map(async (button) => (await button.boundingBox())?.x ?? 0),
  );
  expect(left).toBeLessThan(middle ?? 0);
  expect(middle).toBeLessThan(right ?? 0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(again.locator("svg")).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(again).toHaveCSS("width", "150px");
  await expect(again).toHaveCSS("height", "36px");
  await expect(addToList).toHaveCSS("width", "36px");
  await expect(poster).toHaveCSS("width", "48px");
  const [wideLeft, wideRight] = await Promise.all(
    [again, addToList].map(async (button) => (await button.boundingBox())?.x ?? 0),
  );
  expect(wideLeft).toBeLessThan(wideRight ?? 0);
});

test("TMDB is credited with its logo and notice", { tag: "@smoke" }, async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("img", { name: "TMDB" })).toBeVisible();
  await expect(
    page.getByText(
      "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
    ),
  ).toBeVisible();
});
