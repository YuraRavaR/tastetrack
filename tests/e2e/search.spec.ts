import { expect, test } from "@playwright/test";
import { alien, aliens, amelie, newFilm } from "../support/films";
import { callsRealTmdb } from "../support/tmdb";
import { logInNewUser } from "../support/users";

// Locally the Worker searches a TMDB fake; on staging, the real TMDB. Both know these films.

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

test("TMDB is credited with its logo and notice", { tag: "@smoke" }, async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("img", { name: "TMDB" })).toBeVisible();
  await expect(
    page.getByText(
      "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
    ),
  ).toBeVisible();
});
