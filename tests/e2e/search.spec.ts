import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { alien, aliens, amelie, newFilm } from "../support/scenarios/films";
import { callsRealTmdb } from "../support/scenarios/tmdb";
import { expect, test } from "../support/ui/fixtures";

// Locally the Worker searches a TMDB fake; on staging, the real TMDB. Both know these films.

async function createListHolding(api: ApiClient, name: string, mediaItemId: number) {
  const { list } = await expectBody(api.lists.createList({ name, mediaType: "film" }), 201);
  const added = await api.lists.addListItem(list.id, { mediaItemId });
  expect(added.status(), await added.text()).toBe(201);
  return list;
}

test("a User searches films as they type, in English or Ukrainian", { tag: "@smoke" }, async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  const { searchResults } = searchPage;
  await searchPage.goto();

  await searchPage.search("alien");

  await expect(searchResults.filmLabel("Alien (1979)")).toBeVisible();
  await searchPage.search("чужий");
  await expect(searchResults.filmLabel("Чужий (Alien, 1979)")).toBeVisible();
  await expect(searchResults.filmLabel("Alien (1979)")).toHaveCount(0);
  await expect(searchPage.searchButton).toHaveCount(0);
});

test("a result without a poster is named No poster, and one with a poster isn't", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  const { searchResults } = searchPage;
  await searchPage.goto();

  await searchPage.search("matrix");
  await expect(searchResults.resultWithText("The Matrix").noPosterPlaceholder).toBeVisible();

  await searchPage.search("alien");
  await expect(searchResults.filmLabel("Alien (1979)")).toBeVisible();
  await expect(searchResults.noPosterPlaceholders).toHaveCount(0);
});

test("a User clears the search with one click and can type again", async ({ loggedInUi: ui }) => {
  const { searchPage } = ui;
  const { searchBox, searchResults, clearSearchButton } = searchPage;
  await searchPage.goto();

  await expect(clearSearchButton).toHaveCount(0);
  await searchPage.search("alien");
  await expect(searchResults.filmLabel("Alien (1979)")).toBeVisible();
  await clearSearchButton.click();

  await expect(searchBox).toHaveValue("");
  await expect(searchBox).toBeFocused();
  await expect(searchResults.root).toHaveCount(0);
  await expect(clearSearchButton).toHaveCount(0);
});

test("typing a title makes one search once the User pauses", async ({ page, loggedInUi: ui }) => {
  const { searchPage } = ui;
  await searchPage.goto();
  const searched: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/catalog/search") searched.push(url.searchParams.get("query") ?? "");
  });

  await searchPage.searchBox.pressSequentially("alien", { delay: 100 });

  await expect(searchPage.searchResults.filmLabel("Alien (1979)")).toBeVisible();
  expect(searched).toEqual(["alien"]);
});

test("a User opens a result's film page and goes Back to the same results", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const film = await alien(api);
  const { searchPage, filmPage } = ui;
  await searchPage.goto();
  await searchPage.search("alien");

  await searchPage.searchResults.link("Alien (1979)").click();

  await expect(page).toHaveURL(filmPage.path(film.id));
  await expect(filmPage.heading).toContainText("Alien");

  await page.goBack();

  await expect(page).toHaveURL(searchPage.path("alien"));
  await expect(searchPage.searchBox).toHaveValue("alien");
  await expect(searchPage.searchResults.link("Alien (1979)")).toBeVisible();
});

test("going Back from a film's page returns to where the User was in the results", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await Promise.all([alien(api), aliens(api), amelie(api)]);
  const { searchPage, filmPage } = ui;
  await page.setViewportSize({ width: 390, height: 420 });
  await searchPage.goto("a");
  const film = searchPage.searchResults.link(/^Amélie/);
  // In the middle of the screen, clear of the tab bar, so clicking it doesn't scroll the page.
  await film.evaluate((link) => link.scrollIntoView({ block: "center" }));
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);

  await film.click();
  await expect(page).toHaveURL(filmPage.anyPath);
  await page.goBack();

  await expect(film).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrolled);
});

test("a film not in the catalog has a plain title, until the User adds it", async ({
  loggedInUi: ui,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  const film = newFilm();
  const { searchPage } = ui;
  const { searchResults } = searchPage;
  await searchPage.goto();

  await searchPage.search(film.query);

  await expect(searchResults.filmLabel(film.label)).toBeVisible();
  await expect(searchResults.link(film.label)).toHaveCount(0);

  await searchResults.result(film.label).wantToWatchButton.click();

  await expect(searchResults.link(film.label)).toBeVisible();
});

test("typing keeps the query in the URL as one history entry, and clearing removes it", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage, listsPage } = ui;
  await listsPage.goto();
  await listsPage.mainNav.link("Search").click();
  const { searchBox } = searchPage;

  await searchBox.pressSequentially("alien");
  await expect(page).toHaveURL(searchPage.path("alien"));

  await searchPage.clearSearchButton.click();
  await expect(page).toHaveURL(searchPage.path());
  await page.reload();
  await expect(searchBox).toHaveValue("");

  await searchPage.search("alien");
  await expect(page).toHaveURL(searchPage.path("alien"));
  await page.goBack();
  await expect(page).toHaveURL(listsPage.path());
});

test("a URL with a query runs that search, and Search in the nav clears it", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;

  await searchPage.goto("alien");

  await expect(searchPage.searchBox).toHaveValue("alien");
  await expect(searchPage.searchResults.filmLabel("Alien (1979)")).toBeVisible();

  await searchPage.mainNav.link("Search").click();

  await expect(page).toHaveURL(searchPage.path());
  await expect(searchPage.searchBox).toHaveValue("");
  await expect(searchPage.searchResults.root).toHaveCount(0);
});

test("a User marks a film watched, then logs a rewatch with a new Rating", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage, filmPage } = ui;
  await searchPage.goto("alien");
  const result = searchPage.searchResults.result("Alien (1979)");
  const dialog = searchPage.logEntryDialog("Alien");
  await expect(result.markWatchedButton).toBeVisible();
  let searches = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/catalog/search") searches += 1;
  });

  await result.markWatchedButton.click();
  await expect(dialog.kindLabel("Watched")).toBeVisible();
  await expect(dialog.revisitSwitch).not.toBeChecked();
  await expect(dialog.lastTime).toHaveCount(0);
  await dialog.rate("4 stars");
  await dialog.save();
  await expect(dialog.root).toBeHidden();

  await expect(result.markWatchedButton).toHaveCount(0);
  await expect(result.itemHistoryLink("4 · 1 viewing")).toBeVisible();

  await result.watchedAgainButton.click();
  await expect(dialog.kindLabel("Watched again")).toBeVisible();
  await expect(dialog.revisitSwitch).toBeChecked();
  await expect(dialog.lastTime).toContainText("Last time 4 ·");
  await expect(dialog.checkedRatingRadios).toHaveCount(0);
  await dialog.rate("2.5 stars");
  await dialog.save();
  await expect(dialog.root).toBeHidden();

  await expect(result.itemHistoryLink("2.5 · 2 viewings")).toBeVisible();
  expect(searches).toBe(0);
  await result.itemHistoryLink("2.5 · 2 viewings").click();
  await expect(page).toHaveURL(filmPage.anyPath);
});

test("a backdated rewatch leaves the row's Current Rating as it was", async ({
  ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await alien(api);
  const logged = await api.log.createLogEntry({ mediaItemId, rating: 4, date: "2024-03-12" });
  expect(logged.status()).toBe(201);
  const { searchPage } = ui;
  await searchPage.goto("alien");
  const result = searchPage.searchResults.result("Alien (1979)");
  const dialog = searchPage.logEntryDialog("Alien");

  await result.watchedAgainButton.click();
  await expect(dialog.lastTime).toHaveText("Last time 4 · Mar 12, 2024");
  await dialog.rate("1 star");
  await dialog.dateChip("Other date").click();
  await dialog.dateInput.fill("2020-01-01");
  await dialog.save();
  await expect(dialog.root).toBeHidden();

  await expect(result.itemHistoryLink("4 · 2 viewings")).toBeVisible();
});

test("the hint leaves out the date of a Log Entry with none", async ({ ui, loggedInApi: api }) => {
  const { id: mediaItemId } = await alien(api);
  expect((await api.log.createLogEntry({ mediaItemId, rating: 3.5 })).status()).toBe(201);
  const { searchPage } = ui;
  await searchPage.goto("alien");

  await searchPage.searchResults.result("Alien (1979)").watchedAgainButton.click();

  await expect(searchPage.logEntryDialog("Alien").lastTime).toHaveText("Last time 3.5");
});

test("a result shows two of its Lists, then how many more, each linking to its List", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await alien(api);
  const first = await createListHolding(api, "First", mediaItemId);
  await createListHolding(api, "Second", mediaItemId);
  await createListHolding(api, "Third", mediaItemId);
  const { searchPage, listPage } = ui;
  await searchPage.goto("alien");
  const result = searchPage.searchResults.result("Alien (1979)");

  await expect(result.listsIcon).toBeVisible();
  await expect(result.listChip("First")).toBeVisible();
  await expect(result.listChip("Second")).toBeVisible();
  await expect(result.listChip("Third")).toHaveCount(0);
  await expect(result.moreLists(1)).toBeVisible();

  await result.listChip("First").click();
  await expect(page).toHaveURL(listPage.path(first.id));
});

test("a result's List chips follow Add to collection, without a new search", async ({
  ui,
  loggedInApi: api,
}) => {
  await expectBody(api.lists.createList({ name: "Horror", mediaType: "film" }), 201);
  const { searchPage } = ui;
  await searchPage.goto("alien");
  const result = searchPage.searchResults.result("Alien (1979)");
  const dialog = searchPage.filmListsDialog("Alien (1979)");
  const horror = dialog.checkbox("Horror");
  const chip = result.listChip("Horror");
  await expect(result.listsIcon).toHaveCount(0);

  await result.addToListButton.click();
  await horror.click();
  await expect(horror).toBeChecked();
  await dialog.done();
  await expect(chip).toBeVisible();

  await result.addToListButton.click();
  await horror.click();
  await expect(horror).not.toBeChecked();
  await dialog.done();
  await expect(chip).toHaveCount(0);
  await expect(result.listsIcon).toHaveCount(0);
});

test("a result's List chips follow a change still saving when the dialog closes", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await expectBody(api.lists.createList({ name: "Horror", mediaType: "film" }), 201);
  const { searchPage } = ui;
  await searchPage.goto("alien");
  const result = searchPage.searchResults.result("Alien (1979)");
  await page.route("**/api/lists/*/items", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });

  await result.addToListButton.click();
  const dialog = searchPage.filmListsDialog("Alien (1979)");
  await dialog.checkbox("Horror").click();
  await dialog.done();

  await expect(result.listChip("Horror")).toBeVisible();
});

test("a result's actions keep one order, and fit a 360px phone", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await alien(api);
  expect((await api.log.createLogEntry({ mediaItemId, rating: 4 })).status()).toBe(201);
  const { searchPage } = ui;
  await searchPage.goto("alien");
  const result = searchPage.searchResults.result("Alien (1979)");
  const { poster, watchedAgainButton: again, wantToWatchButton: bookmark } = result;
  const { addToListButton: addToList, watchedAgainIcon } = result;

  await page.setViewportSize({ width: 360, height: 740 });
  await expect(again).toBeVisible();
  await expect(watchedAgainIcon).toBeHidden();
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
  await expect(watchedAgainIcon).toBeVisible();

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

test("TMDB is credited with its logo and notice", { tag: "@smoke" }, async ({ ui }) => {
  const { loginPage } = ui;
  await loginPage.goto();

  await expect(loginPage.footer.tmdbLogo).toBeVisible();
  await expect(
    loginPage.footer.text(
      "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
    ),
  ).toBeVisible();
});
