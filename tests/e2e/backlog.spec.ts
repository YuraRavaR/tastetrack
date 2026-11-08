import { expect, test } from "../support/ui/fixtures";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien and Aliens, but
// TMDB matches whole words, so Aliens is searched for as "aliens": "alien" doesn't find it there.

test("a User plans a film in Search, finds it on the Watchlist, logs it and finds it in Watched", {
  tag: "@smoke",
}, async ({ loggedInUi: ui }) => {
  const { searchPage, savedPage, libraryPage, filmPage } = ui;
  await searchPage.goto();
  await searchPage.search("alien");
  const alien = searchPage.searchResults.result("Alien (1979)");
  await alien.wantToWatchButton.click();
  await expect(alien.onWatchlistButton).toBeVisible();

  await searchPage.mainNav.link("Saved").click();
  const films = savedPage.tile("Films");
  await expect(films.link).toHaveAccessibleDescription("1 to watch · 0 watched");
  await films.link.click();
  await expect(libraryPage.posters("Watchlist")).toHaveText([/Alien\s*1979$/]);
  await expect(libraryPage.tab("Watched")).toHaveAccessibleName("Watched 0");

  // Now it is in Saved, so Search finds it there first, and it is logged from its page.
  await libraryPage.mainNav.link("Search").click();
  await searchPage.search("alien");
  const savedAlien = searchPage.userMediaItems.film("Alien");
  await expect(savedAlien.root).toContainText("Watchlist");
  await expect(alien.root).toHaveCount(0);
  await savedAlien.link.click();
  await filmPage.watchedButton.click();
  const dialog = filmPage.logEntryDialog("Alien");
  await dialog.rate("4 stars");
  await dialog.save();
  await expect(dialog.root).toBeHidden();

  await filmPage.toast.goToWatchedLink.click();
  await expect(libraryPage.posters("Watched")).toHaveText([/Alien/]);
  await expect(libraryPage.poster("Watched", "Alien").rating("4 stars")).toBeVisible();
  await expect(libraryPage.tab("Watchlist")).toHaveAccessibleName("Watchlist 0");
});

test("the bookmark in search puts a film on the Watchlist and takes it off again", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage, libraryPage } = ui;
  const { toast } = searchPage;
  await searchPage.goto();
  await searchPage.search("alien");
  const alien = searchPage.searchResults.result("Alien (1979)");
  const bookmark = alien.wantToWatchButton;
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");

  await bookmark.click();

  await expect(toast.message("Put Alien (1979) on your Watchlist.")).toBeVisible();
  await expect(bookmark).toHaveAttribute("aria-pressed", "true");
  await expect(alien.onWatchlistButton).toBeVisible();

  await bookmark.click();

  await expect(toast.message("Took Alien (1979) off your Watchlist.")).toBeVisible();
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");
  await expect(alien.onWatchlistButton).toHaveCount(0);
  await toast.dismiss();
  await expect(searchPage.text("Took Alien (1979) off your Watchlist.")).toHaveCount(0);

  // It is off for good, not only on this screen.
  await page.reload();
  await searchPage.search("alien");
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");
  await searchPage.mainNav.link("Saved").click();
  await ui.savedPage.tile("Films").link.click();
  await expect(libraryPage.text("Nothing on your Watchlist yet.")).toBeVisible();
});

test("logging a planned film takes it off the Watchlist, and Undo puts it back", async ({
  loggedInUi: ui,
}) => {
  const { searchPage, libraryPage } = ui;
  const { toast } = searchPage;
  await searchPage.goto();
  await searchPage.search("aliens");
  const aliens = searchPage.searchResults.result("Aliens (1986)");
  await aliens.wantToWatchButton.click();
  await expect(aliens.onWatchlistButton).toBeVisible();
  // A film planned here stays in TMDB's results until the query changes.
  await searchPage.search("alien");
  await expect(searchPage.userMediaItems.film("Aliens").root).toBeVisible();
  const alien = searchPage.searchResults.result("Alien (1979)");
  await alien.wantToWatchButton.click();
  await expect(alien.onWatchlistButton).toBeVisible();

  await alien.markWatchedButton.click();
  const dialog = searchPage.logEntryDialog("Alien");
  await expect(dialog.watchlistNote).toBeVisible();
  await dialog.rate("4 stars");
  await dialog.save();

  await expect(dialog.root).toBeHidden();
  await expect(toast.message("Took Alien (1979) off your Watchlist.")).toBeVisible();
  await expect(alien.onWatchlistButton).toHaveCount(0);
  await toast.undo();
  await expect(toast.message("Put Alien (1979) back on your Watchlist.")).toBeVisible();
  await expect(alien.watchedAgainButton).toBeVisible();
  await expect(alien.wantToWatchButton).toHaveAttribute("aria-pressed", "true");
  await searchPage.mainNav.link("Saved").click();
  await ui.savedPage.tile("Films").link.click();
  await expect(libraryPage.posters("Watchlist")).toHaveCount(2);
  await expect(libraryPage.poster("Watchlist", "Alien").watchedBeforeMark).toBeVisible();
  await expect(libraryPage.poster("Watchlist", "Aliens").watchedBeforeMark).toHaveCount(0);
});

test("a full Watchlist says to remove or log some films", async ({ ui, api, loggedInUser }) => {
  const filled = await api.testHooks.fillBacklog(loggedInUser.username, 1000);
  expect(filled.status(), await filled.text()).toBe(204);
  const { searchPage } = ui;
  await searchPage.goto();
  await searchPage.search("alien");

  await searchPage.searchResults.result("Alien (1979)").wantToWatchButton.click();

  await expect(searchPage.errorMessage).toHaveText(
    "Your Watchlist is full: it holds up to 1,000 films. Remove or log some to make room.",
  );
});
