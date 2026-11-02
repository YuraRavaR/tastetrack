import { alien, aliens, amelie } from "../support/scenarios/films";
import { expect, test } from "../support/ui/fixtures";

test("a new User's home leads with the search, an empty Log and an empty Watchlist", async ({
  page,
  loggedInUi: ui,
}) => {
  const { homePage } = ui;
  const { logSection, watchlistSection } = homePage;

  await homePage.goto();

  await expect(page).toHaveTitle("TasteTrack");
  await expect(homePage.searchHeading).toBeVisible();
  await expect(homePage.searchBox).toBeVisible();
  await expect(
    logSection.text("Your Log is empty. Search for a film you've watched and mark it Watched."),
  ).toBeVisible();
  await expect(logSection.links).toHaveCount(0);
  await expect(
    watchlistSection.text("Your Watchlist is empty. Search for a film and mark it Want to watch."),
  ).toBeVisible();
  await expect(watchlistSection.links).toHaveCount(0);
});

test("home shows the latest five Log Entries, latest first, and links to the whole Log", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const films = {
    alien: await alien(api),
    aliens: await aliens(api),
    amelie: await amelie(api),
  };
  // Created out of date order: the Log's order is by date.
  for (const [film, date, rating, revisit, review] of [
    ["aliens", "2024-05-06", 5, true, "Better than I remembered."],
    ["alien", "2020-01-01", 3, false, undefined],
    ["amelie", "2025-06-07", 2.5, true, undefined],
    ["aliens", "2021-02-03", 3.5, false, undefined],
    ["alien", "2023-04-05", 4.5, true, undefined],
    ["amelie", "2022-03-04", 4, false, undefined],
  ] as const) {
    const response = await api.log.createLogEntry({
      mediaItemId: films[film].id,
      date,
      rating,
      revisit,
      review,
    });
    expect(response.status()).toBe(201);
  }
  const { homePage, filmPage } = ui;

  await homePage.goto();

  const log = homePage.logSection;
  const entries = log.items;
  await expect(entries).toHaveCount(5);
  await expect(entries.nth(0)).toContainText("Amélie");
  await expect(entries.nth(0)).toContainText("Jun 7, 2025");
  await expect(log.item(0).ratingStars("2.5 stars")).toBeVisible();
  await expect(log.item(0).rewatchBadge).toBeVisible();
  await expect(entries.nth(1)).toContainText("Aliens (1986)");
  await expect(entries.nth(1)).toContainText("May 6, 2024");
  await expect(entries.nth(1)).not.toContainText("Better than I remembered.");
  await expect(entries.nth(2)).toContainText("Alien (1979)");
  await expect(entries.nth(2)).toContainText("Apr 5, 2023");
  await expect(entries.nth(3)).toContainText("Mar 4, 2022");
  await expect(log.item(3).rewatchBadge).toHaveCount(0);
  await expect(entries.nth(4)).toContainText("Feb 3, 2021");
  await expect(log.root).not.toContainText("Jan 1, 2020");
  await expect(log.buttons).toHaveCount(0);

  await expect(log.link("All 6 in your Log")).toHaveAttribute("href", "/log");
  await log.item(1).filmLink("Aliens (1986)").click();
  await expect(page).toHaveURL(filmPage.path(films.aliens.id));
});

test("home shows the Watchlist in its saved order with each film's facts and Note", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const films = {
    alien: await alien(api),
    aliens: await aliens(api),
    amelie: await amelie(api),
  };
  // Planned out of the order they end up in: the Watchlist's order is the User's.
  for (const planned of [
    { mediaItemId: films.alien.id, note: "Watch with Olena." },
    { mediaItemId: films.amelie.id },
    { mediaItemId: films.aliens.id, position: 0 },
  ]) {
    const response = await api.backlog.addBacklogItem(planned);
    expect(response.status()).toBe(201);
  }
  const { homePage, filmPage } = ui;

  await homePage.goto();

  const watchlist = homePage.watchlistSection;
  const { items } = watchlist;
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Aliens (1986)");
  await expect(items.nth(1)).toContainText("Alien (1979)");
  await expect(items.nth(1)).toContainText("117 min · Horror, Science Fiction");
  await expect(watchlist.item(1).text("Watch with Olena.")).toBeVisible();
  await expect(items.nth(2)).toContainText("Amélie");
  await expect(watchlist.buttons).toHaveCount(0);

  await expect(watchlist.link("All 3 on your Watchlist")).toHaveAttribute("href", "/watchlist");
  await watchlist.item(1).filmLink("Alien (1979)").click();
  await expect(page).toHaveURL(filmPage.path(films.alien.id));
});

test("home shows the first five films of a longer Watchlist and counts them all", async ({
  ui,
  api,
  loggedInUser,
}) => {
  const filled = await api.testHooks.fillBacklog(loggedInUser.username, 5);
  expect(filled.status(), await filled.text()).toBe(204);
  const sixth = await api.backlog.addBacklogItem({ mediaItemId: (await alien(api)).id });
  expect(sixth.status()).toBe(201);
  const { homePage } = ui;

  await homePage.goto();

  const watchlist = homePage.watchlistSection;
  await expect(watchlist.items).toHaveCount(5);
  await expect(watchlist.root).not.toContainText("Alien (1979)");
  await expect(watchlist.link("All 6 on your Watchlist")).toBeVisible();
});

test("a long Note on home stays on one line, without scrolling a phone sideways", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const planned = await api.backlog.addBacklogItem({
    mediaItemId: (await alien(api)).id,
    note: "Watch with Olena. ".repeat(10),
  });
  expect(planned.status()).toBe(201);
  await page.setViewportSize({ width: 390, height: 844 });
  const { homePage } = ui;

  await homePage.goto();

  const note = homePage.watchlistSection.text("Watch with Olena.");
  await expect(note).toBeVisible();
  expect((await note.boundingBox())?.height).toBeLessThan(30);
  const scrollsSideways = await page.evaluate(() => {
    const { scrollWidth, clientWidth } = document.documentElement;
    return scrollWidth > clientWidth;
  });
  expect(scrollsSideways).toBe(false);
});

test("searching hides the Log and the Watchlist, and a film marked Watched from search moves between them once the search is cleared", async ({
  ui,
  loggedInApi: api,
}) => {
  const film = await alien(api);
  const planned = await api.backlog.addBacklogItem({ mediaItemId: film.id });
  expect(planned.status()).toBe(201);
  const { homePage } = ui;
  await homePage.goto();
  const log = homePage.logSection;
  const watchlist = homePage.watchlistSection;
  await expect(log.text(/Your Log is empty/)).toBeVisible();
  await expect(watchlist.items).toContainText("Alien (1979)");
  await expect(watchlist.link("See your Watchlist")).toBeVisible();

  await homePage.search("alien");
  await expect(log.root).toBeHidden();
  await expect(watchlist.root).toBeHidden();
  await homePage.searchResults.result("Alien (1979)").markWatchedButton.click();
  const dialog = homePage.logEntryDialog("Alien");
  await dialog.rate("4 stars");
  await dialog.save();
  await expect(dialog.root).toBeHidden();
  await expect(log.root).toBeHidden();
  await homePage.search("");

  await expect(log.items).toHaveCount(1);
  await expect(log.items).toContainText("Alien (1979)");
  await expect(log.link("See your Log")).toBeVisible();
  await expect(watchlist.text(/Your Watchlist is empty/)).toBeVisible();
  await expect(watchlist.items).toHaveCount(0);
});

test("a Watchlist that fails to load says so under its heading, and the Log still shows", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const logged = await api.log.createLogEntry({ mediaItemId: (await alien(api)).id, rating: 4 });
  expect(logged.status()).toBe(201);
  await page.route("**/api/backlog?*", (route) => route.fulfill({ status: 500 }));
  const { homePage } = ui;

  await homePage.goto();

  const watchlist = homePage.watchlistSection;
  await expect(watchlist.heading).toHaveText("Next on your Watchlist");
  await expect(watchlist.errorMessage).toHaveText(
    "Couldn't load your Watchlist. Please try again.",
  );
  await expect(homePage.logSection.items).toContainText("Alien (1979)");
});

test("a Log that fails to load says so under its heading, and the Watchlist and the search still work", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const planned = await api.backlog.addBacklogItem({ mediaItemId: (await alien(api)).id });
  expect(planned.status()).toBe(201);
  await page.route("**/api/log-entries", (route) => route.fulfill({ status: 500 }));
  const { homePage } = ui;

  await homePage.goto();

  const log = homePage.logSection;
  await expect(log.heading).toHaveText("Latest in your Log");
  await expect(log.errorMessage).toHaveText("Couldn't load your Log. Please try again.");
  await expect(homePage.watchlistSection.items).toContainText("Alien (1979)");
  await homePage.search("alien");
  await expect(homePage.searchResults.title("Alien (1979)")).toBeVisible();
});

test("a deep link loads the app, not a 404", async ({ ui }) => {
  const response = await ui.goto("/some/client/route");

  expect(response?.status()).toBe(200);
  await expect(ui.loginPage.header.appNameLink).toBeVisible();
});
