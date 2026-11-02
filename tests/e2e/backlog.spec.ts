import { expect, test } from "../support/ui/fixtures";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien and Aliens, but
// TMDB matches whole words, so Aliens is searched for as "aliens": "alien" doesn't find it there.

test("a User plans films from search, then orders and notes their Watchlist", {
  tag: "@smoke",
}, async ({ page, loggedInUi: ui }) => {
  const { homePage, watchlistPage } = ui;
  await homePage.goto();
  await homePage.search("alien");
  const alien = homePage.searchResults.result("Alien (1979)");
  await alien.wantToWatchButton.click();
  await expect(alien.onWatchlistButton).toBeVisible();
  await expect(alien.wantToWatchButton).toHaveAttribute("aria-pressed", "true");
  await homePage.search("aliens");
  const aliens = homePage.searchResults.result("Aliens (1986)");
  await aliens.wantToWatchButton.click();
  await expect(aliens.onWatchlistButton).toBeVisible();

  await homePage.mainNav.link("Watchlist").click();
  const { items } = watchlistPage;
  await expect(items).toHaveCount(2);
  await expect(watchlistPage.text("2 films")).toBeVisible();
  await expect(items.first()).toContainText("Alien (1979)");

  // Moving Aliens up puts it first.
  await watchlistPage.lastItem().moveUpButton.click();
  await expect(items.first()).toContainText("Aliens (1986)");
  await expect(watchlistPage.firstItem().moveUpButton).toBeDisabled();

  // A Note, added and then changed.
  await watchlistPage.lastItem().addNoteButton.click();
  const noteDialog = watchlistPage.noteDialog("Alien (1979)");
  await noteDialog.saveNote("Olena's favourite.");
  await expect(noteDialog.root).toBeHidden();
  await expect(items.last()).toContainText("Olena's favourite.");
  await watchlistPage.lastItem().editNoteButton.click();
  await expect(noteDialog.noteInput).toHaveValue("Olena's favourite.");
  await noteDialog.saveNote("Watch with Olena.");
  await expect(items.last()).toContainText("Watch with Olena.");

  // The order and the Note are kept.
  await page.reload();
  await expect(items.first()).toContainText("Aliens (1986)");
  await expect(items.last()).toContainText("Watch with Olena.");
});

test("the bookmark in search puts a film on the Watchlist and takes it off again", async ({
  page,
  loggedInUi: ui,
}) => {
  const { homePage, watchlistPage } = ui;
  const { toast } = homePage;
  await homePage.goto();
  await homePage.search("alien");
  const alien = homePage.searchResults.result("Alien (1979)");
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
  await expect(homePage.text("Took Alien (1979) off your Watchlist.")).toHaveCount(0);

  // It is off for good, not only on this screen.
  await page.reload();
  await homePage.search("alien");
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");
  await homePage.mainNav.link("Watchlist").click();
  await expect(watchlistPage.emptyMessage).toBeVisible();
});

test("logging a planned film takes it off the Watchlist, and Undo puts it back", async ({
  loggedInUi: ui,
}) => {
  const { homePage, watchlistPage } = ui;
  const { toast } = homePage;
  await homePage.goto();
  await homePage.search("alien");
  const alien = homePage.searchResults.result("Alien (1979)");
  await alien.wantToWatchButton.click();
  await expect(alien.onWatchlistButton).toBeVisible();
  await homePage.search("aliens");
  const aliens = homePage.searchResults.result("Aliens (1986)");
  await aliens.wantToWatchButton.click();
  await expect(aliens.onWatchlistButton).toBeVisible();
  await homePage.search("alien");

  await alien.markWatchedButton.click();
  const dialog = homePage.logEntryDialog("Alien");
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
  await homePage.mainNav.link("Watchlist").click();
  await expect(watchlistPage.items.first()).toContainText("Alien (1979)");
  await expect(watchlistPage.items.last()).toContainText("Aliens (1986)");
});

test("removing a film from the Watchlist can be undone", async ({ loggedInUi: ui }) => {
  const { homePage, watchlistPage } = ui;
  await homePage.goto();
  await homePage.search("alien");
  const alien = homePage.searchResults.result("Alien (1979)");
  await alien.wantToWatchButton.click();
  await expect(alien.onWatchlistButton).toBeVisible();
  await homePage.mainNav.link("Watchlist").click();
  const { items } = watchlistPage;

  await watchlistPage.firstItem().removeButton.click();

  await expect(items).toHaveCount(0);
  await expect(watchlistPage.text("Removed Alien (1979) from your Watchlist.")).toBeVisible();
  await watchlistPage.undoButton.click();
  await expect(items).toHaveCount(1);
  await expect(items).toContainText("Alien (1979)");
});

test("a full Watchlist says to remove or log some films", async ({ ui, api, loggedInUser }) => {
  const filled = await api.testHooks.fillBacklog(loggedInUser.username, 1000);
  expect(filled.status(), await filled.text()).toBe(204);
  const { homePage } = ui;
  await homePage.goto();
  await homePage.search("alien");

  await homePage.searchResults.result("Alien (1979)").wantToWatchButton.click();

  await expect(homePage.errorMessage).toHaveText(
    "Your Watchlist is full: it holds up to 1,000 films. Remove or log some to make room.",
  );
});

test("the Watchlist and a film's page show its runtime and genres", async ({ loggedInUi: ui }) => {
  const { homePage, watchlistPage, filmPage } = ui;
  await homePage.goto();
  await homePage.search("alien");
  const alien = homePage.searchResults.result("Alien (1979)");
  await alien.wantToWatchButton.click();
  await expect(alien.onWatchlistButton).toBeVisible();

  await homePage.mainNav.link("Watchlist").click();
  await expect(watchlistPage.items).toContainText("117 min · Horror, Science Fiction");
  await watchlistPage.firstItem().filmLink("Alien (1979)").click();
  await expect(filmPage.heading).toContainText("Alien (1979)");
  await expect(filmPage.text("117 min · Horror, Science Fiction")).toBeVisible();
});
