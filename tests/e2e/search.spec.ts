import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { alien, aliens, amelie, newFilm } from "../support/scenarios/films";
import { callsRealTmdb } from "../support/scenarios/tmdb";
import { expect, test } from "../support/ui/fixtures";

// Locally the Worker searches a TMDB fake; on staging, the real TMDB. Both know these films.
//
// A film in the User's Library or on their Lists shows in "In your Saved", never among TMDB's
// results. So a test of what a TMDB result's row does with a film the User has logged or listed
// sets that up from the row itself, not through `api`: the film stays in TMDB's results until the
// query changes.

const hint = "Type a title to search your Saved and TMDB.";

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

test("Search finds the User's own films first, In your Saved, and TMDB's without them", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await alien(api);
  await expectBody(api.log.createLogEntry({ mediaItemId, rating: 5 }), 201);
  await expectBody(api.backlog.addBacklogItem({ mediaItemId }), 201);
  const { searchPage, filmPage } = ui;
  await searchPage.goto();

  await searchPage.search("alien");

  const saved = searchPage.userMediaItems.film("Alien");
  await expect(searchPage.userMediaItemsHeading).toHaveText(/^In your Saved\s*1$/);
  await expect(saved.root).toContainText("5 · Watchlist");
  await expect(searchPage.tmdbHeading).toBeVisible();
  await expect(searchPage.searchResults.rows.first()).toBeVisible();
  await expect(searchPage.searchResults.filmLabel("Alien (1979)")).toHaveCount(0);

  // Its cover opens the film's page, and Back comes back to the same results.
  await saved.link.click();
  await expect(page).toHaveURL(filmPage.path(mediaItemId));
  await page.goBack();
  await expect(page).toHaveURL(searchPage.path("alien"));
  await expect(searchPage.searchBox).toHaveValue("alien");
  await expect(saved.root).toContainText("5 · Watchlist");
});

test("each saved film shows one status line: its Rating, the Watchlist, or its oldest Collection", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const planned = await aliens(api);
  await expectBody(api.backlog.addBacklogItem({ mediaItemId: planned.id }), 201);
  const logged = await amelie(api);
  await expectBody(api.log.createLogEntry({ mediaItemId: logged.id, rating: 4.5 }), 201);
  const listed = await alien(api);
  await createListHolding(api, "Road movies", listed.id);
  await createListHolding(api, "Horror nights", listed.id);
  const { searchPage } = ui;
  const { userMediaItems } = searchPage;
  await page.setViewportSize({ width: 402, height: 874 });
  await searchPage.goto();

  await searchPage.search("a");

  await expect(userMediaItems.film("Aliens").root).toContainText("Watchlist");
  await expect(userMediaItems.film("Amélie").root).toContainText("4.5 · Watched");
  await expect(userMediaItems.film("Alien").root).toContainText("Road movies");
  await expect(userMediaItems.film("Alien").root).not.toContainText("Horror nights");
  await expect(userMediaItems.ratingIcons).toHaveCount(1);
  // A strip of covers 104px wide on a phone.
  expect((await userMediaItems.film("Alien").root.boundingBox())?.width).toBe(104);
});

test("In your Saved follows each keystroke, without waiting for TMDB, which never repeats it", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await alien(api);
  await expectBody(api.backlog.addBacklogItem({ mediaItemId }), 201);
  const { searchPage } = ui;
  const { userMediaItems, searchResults } = searchPage;
  await searchPage.goto();
  await searchPage.search("alien");
  await expect(searchResults.rows.first()).toBeVisible();
  // From now on TMDB never answers, so its results for "alien" stay on the page.
  await page.route("**/api/catalog/search?**", () => {});

  await searchPage.search("alienx");
  await expect(userMediaItems.films).toHaveCount(0);
  await expect(searchResults.rows.first()).toBeVisible();
  await expect(searchResults.filmLabel("Alien (1979)")).toHaveCount(0);

  await searchPage.search("ali");
  await expect(userMediaItems.film("Alien").root).toBeVisible();
});

test("a film planned from TMDB's results moves to In your Saved once the query changes", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  await searchPage.goto("alien");
  const result = searchPage.searchResults.result("Alien (1979)");

  await result.wantToWatchButton.click();
  await expect(result.onWatchlistButton).toBeVisible();
  await expect(searchPage.userMediaItems.films).toHaveCount(0);

  await searchPage.search("alie");
  await expect(searchPage.userMediaItems.film("Alien").root).toContainText("Watchlist");
  await expect(searchPage.searchResults.filmLabel("Alien (1979)")).toHaveCount(0);
});

test("an empty field shows the hint and the Media Type chips, on Films, Series still to come", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  await searchPage.goto();

  await expect(searchPage.text(hint)).toBeVisible();
  await expect(searchPage.searchBox).toHaveAttribute(
    "placeholder",
    "Title in English or Ukrainian",
  );
  await expect(searchPage.currentChip("Films")).toBeVisible();
  await expect(searchPage.mediaTypeChip("Books")).toBeEnabled();
  await expect(searchPage.mediaTypeChip("Series")).toBeDisabled();
  await expect(searchPage.mediaTypeChip("Series")).toHaveAccessibleDescription("Coming soon");
  await expect(searchPage.mediaTypeChips.getByRole("button")).toHaveCount(3);

  await searchPage.search("alien");
  await expect(searchPage.text(hint)).toHaveCount(0);
  await searchPage.clearSearchButton.click();
  await expect(searchPage.text(hint)).toBeVisible();
});

test("a query nothing matches says so, quietly, with Add manually", async ({ loggedInUi: ui }) => {
  const { searchPage } = ui;
  await searchPage.goto();

  await searchPage.search("zzqx no such film");

  await expect(searchPage.text("No films found for “zzqx no such film”.")).toBeVisible();
  await expect(searchPage.addManuallyButton).toBeVisible();
  await expect(searchPage.userMediaItemsHeading).toHaveCount(0);
  await expect(searchPage.tmdbHeading).toHaveCount(0);
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

test("a film not in the catalog opens its page from its title, and links there from then on", async ({
  page,
  loggedInUi: ui,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  const film = newFilm();
  const { searchPage, filmPage } = ui;
  const { searchResults } = searchPage;
  await searchPage.goto();
  await searchPage.search(film.query);
  await expect(searchResults.link(film.label)).toHaveCount(0);

  await searchResults.result(film.label).filmButton(film.label).click();

  await expect(page).toHaveURL(filmPage.anyPath);
  await expect(filmPage.heading).toContainText(`New film ${film.id}`);

  await page.goBack();

  await expect(searchResults.link(film.label)).toBeVisible();
});

test("a result's poster opens its film's page, as its title does, in the catalog or not yet", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  const catalogued = await alien(api);
  const film = newFilm();
  const { searchPage, filmPage } = ui;
  const { searchResults } = searchPage;
  await searchPage.goto("alien");

  await searchResults.result("Alien (1979)").clickPoster();

  await expect(page).toHaveURL(filmPage.path(catalogued.id));

  await searchPage.goto(film.query);
  await expect(searchResults.result(film.label).filmButton(film.label)).toBeVisible();

  await searchResults.result(film.label).clickPoster();

  await expect(page).toHaveURL(filmPage.anyPath);
  await expect(filmPage.heading).toContainText(`New film ${film.id}`);
});

test("a film that can't join the catalog stays on Search, which says so", async ({
  page,
  loggedInUi: ui,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  const film = newFilm();
  const { searchPage } = ui;
  const { searchResults } = searchPage;
  await page.route("**/api/catalog/items", (route) => route.fulfill({ status: 500 }));
  await searchPage.goto();
  await searchPage.search(film.query);

  await searchResults.result(film.label).filmButton(film.label).click();

  await expect(searchPage.errorMessage).toHaveText(
    `Couldn't open ${film.label}. Please try again.`,
  );
  await expect(page).toHaveURL(searchPage.path(film.query));
  await expect(searchResults.result(film.label).filmButton(film.label)).toBeEnabled();

  // The message is about that search, so a new one goes without it.
  await searchPage.search("alien");

  await expect(searchPage.errorMessage).toHaveCount(0);
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

test("the browser tab names Search, then the query as the User types it", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  await searchPage.goto();
  await expect(page).toHaveTitle("Search · TasteTrack");

  await searchPage.searchBox.pressSequentially("tom & <jerry>");
  await expect(page).toHaveTitle("“tom & <jerry>” · Search · TasteTrack");

  await searchPage.clearSearchButton.click();
  await expect(page).toHaveTitle("Search · TasteTrack");
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
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  await searchPage.goto("alien");
  const result = searchPage.searchResults.result("Alien (1979)");
  const dialog = searchPage.logEntryDialog("Alien");
  await result.markWatchedButton.click();
  await dialog.rate("4 stars");
  await dialog.dateChip("Other date").click();
  await dialog.dateInput.fill("2024-03-12");
  await dialog.save();
  await expect(dialog.root).toBeHidden();

  await result.watchedAgainButton.click();
  await expect(dialog.lastTime).toHaveText("Last time 4 · Mar 12, 2024");
  await dialog.rate("1 star");
  await dialog.dateChip("Other date").click();
  await dialog.dateInput.fill("2020-01-01");
  await dialog.save();
  await expect(dialog.root).toBeHidden();

  await expect(result.itemHistoryLink("4 · 2 viewings")).toBeVisible();
});

test("a result shows two of its Lists, then how many more, each linking to its List", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const createList = async (name: string) => {
    return (await expectBody(api.lists.createList({ name, mediaType: "film" }), 201)).list;
  };
  const first = await createList("First");
  await createList("Second");
  await createList("Third");
  const { searchPage, listPage } = ui;
  await searchPage.goto("alien");
  const result = searchPage.searchResults.result("Alien (1979)");
  const dialog = searchPage.filmListsDialog("Alien (1979)");
  await result.addToListButton.click();
  for (const name of ["First", "Second", "Third"]) {
    await dialog.checkbox(name).click();
    await expect(dialog.checkbox(name)).toBeChecked();
  }
  await dialog.done();

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
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  await searchPage.goto("alien");
  const result = searchPage.searchResults.result("Alien (1979)");
  await result.markWatchedButton.click();
  const dialog = searchPage.logEntryDialog("Alien");
  await dialog.rate("4 stars");
  await dialog.save();
  await expect(dialog.root).toBeHidden();
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
