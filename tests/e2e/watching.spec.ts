import type { Page } from "@playwright/test";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { breakingBad, chernobyl, manualSeries, newSeries } from "../support/scenarios/series";
import { holdImages } from "../support/scenarios/tmdb";
import { expect, test } from "../support/ui/fixtures";
import type { FilmPage } from "../support/ui/pages/FilmPage";

// Watching a series: started from its page, kept up with one tap at a time, then finished with a
// Rating or stopped. Locally the Worker reads a TMDB fake, whose series mirror TMDB as it was on
// 2026-11-15: Breaking Bad has seasons of 7, 13, 13, 13 and 16 episodes, 62 in all, and Chernobyl
// one of 5. Their posters are TMDB's own images, which these tests never load.
test.beforeEach(async ({ page }) => {
  await holdImages(page);
});

// Starts a series with no start date, at `last`, the last episode watched, or not started.
async function watch(
  api: ApiClient,
  mediaItemId: number,
  last?: [season: number, episode: number],
) {
  const progress = last && ({ mediaType: "series", season: last[0], episode: last[1] } as const);
  await expectBody(api.inProgress.start({ mediaItemId, startDate: null, progress }), 201);
}

// The requests that save a series' Progress.
function isProgressSave(request: { method(): string; url(): string }) {
  return request.method() === "PATCH" && /\/api\/in-progress\/\d+$/.test(request.url());
}

function progressSaves(page: Page) {
  const saves: string[] = [];
  page.on("request", (request) => {
    if (isProgressSave(request)) saves.push(request.postData() ?? "");
  });
  return saves;
}

const phone = { width: 390, height: 844 };

for (const [device, viewport] of [
  ["desktop", null],
  ["a phone", phone],
] as const) {
  test(`on ${device}, starting a series from the Watchlist moves it to Watching at its first episode, with undo offered`, async ({
    page,
    api,
    loggedInUi: ui,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    const series = await breakingBad(api);
    await expectBody(api.backlog.addBacklogItem({ mediaItemId: series.id }), 201);
    const { filmPage, libraryPage, savedPage } = ui;
    const { watchingCard, toast } = filmPage;
    await libraryPage.goto("Watchlist", "series");
    await libraryPage.poster("Watchlist", "Breaking Bad").link.click();

    await filmPage.startWatchingButton.click();

    // A series not yet rated starts with one tap: there is nothing to choose.
    await expect(filmPage.dialogs).toHaveCount(0);
    await expect(watchingCard.root).toContainText("NextS1 · E1Season 1, episode 1 of 7");
    await expect(watchingCard.bar).toHaveAccessibleName("0 of 62 episodes watched");
    await expect(filmPage.startWatchingButton).toBeHidden();
    await expect(filmPage.wantToWatchButton).toBeHidden();
    await expect(filmPage.onWatchlistButton).toBeHidden();
    await expect(filmPage.watchedButton).toBeHidden();
    await expect(filmPage.addToListButton).toBeVisible();
    await expect(toast.message("Started watching Breaking Bad (2008).")).toBeVisible();
    await expect(toast.undoButton).toBeVisible();

    await libraryPage.goto("Watching", "series");
    await expect(libraryPage.tabs).toHaveText([/^Watchlist/, /^Watching/, /^Watched/]);
    await expect(libraryPage.tab("Watchlist")).toHaveAccessibleName("Watchlist 0");
    await expect(libraryPage.tab("Watching")).toHaveAccessibleName("Watching 1");
    await expect(libraryPage.watchingRow("Breaking Bad").link).toContainText("Next: S1 · E1");
    // The Watching tab has its one order and no filters.
    await expect(libraryPage.chipsGroup).toHaveCount(0);

    await savedPage.goto();
    await expect(savedPage.tile("Series").root).toContainText(
      "0 to watch · 1 watching · 0 watched",
    );
    await expect(savedPage.watchingNowRows).toHaveCount(1);
    const row = savedPage.watchingNowRow("Breaking Bad");
    await expect(row.link).toContainText("Next: S1 · E1");
    await expect(row.bar).toHaveAccessibleName("0 of 62 episodes watched");
    await row.link.click();
    await expect(page).toHaveURL(filmPage.path(series.id));
  });
}

test("undoing a start stops watching the series and puts it back on the Watchlist", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await chernobyl(api);
  await expectBody(api.backlog.addBacklogItem({ mediaItemId: series.id }), 201);
  const { filmPage } = ui;
  await filmPage.goto(series.id);
  await filmPage.startWatchingButton.click();
  await expect(filmPage.watchingCard.root).toBeVisible();

  await filmPage.toast.undo();

  await expect(filmPage.watchingCard.root).toBeHidden();
  await expect(filmPage.onWatchlistButton).toBeVisible();
  await expect(filmPage.startWatchingButton).toBeVisible();
  await expect(
    filmPage.toast.message("Put Chernobyl (2019) back on your Watchlist."),
  ).toBeVisible();
});

test("the check on Saved moves to the next episode and the bar grows, and after a season's last episode to the next season's first", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const series = await breakingBad(api);
  await watch(api, series.id, [1, 5]);
  const { savedPage } = ui;
  await savedPage.goto();
  const row = savedPage.watchingNowRow("Breaking Bad");
  await expect(row.link).toContainText("Next: S1 · E6");
  await expect(row.bar).toHaveAccessibleName("5 of 62 episodes watched");
  await expect(row.checkButton).toHaveAccessibleName("Mark S1 · E6 of Breaking Bad watched");

  await row.checkButton.click();

  await expect(row.link).toContainText("Next: S1 · E7");
  await expect(row.bar).toHaveAccessibleName("6 of 62 episodes watched");

  await row.checkButton.click();

  await expect(row.link).toContainText("Next: S2 · E1");
  await expect(row.bar).toHaveAccessibleName("7 of 62 episodes watched");
  // The check is no link: the tab is still on Saved, with no toast.
  await expect(page).toHaveURL(savedPage.path());
  await expect(savedPage.toast.root).toBeHidden();

  await page.reload();
  await expect(row.link).toContainText("Next: S2 · E1");
  await expect(row.bar).toHaveAccessibleName("7 of 62 episodes watched");
});

test("a double tap on the check marks one episode watched", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const series = await breakingBad(api);
  await watch(api, series.id);
  const saves = progressSaves(page);
  // The save answers only after both taps, however fast the Worker is.
  let answer = () => {};
  const tapped = new Promise<void>((resolve) => {
    answer = resolve;
  });
  await page.route("**/api/in-progress/*", async (route) => {
    await tapped;
    await route.continue();
  });
  const { savedPage } = ui;
  await savedPage.goto();
  const row = savedPage.watchingNowRow("Breaking Bad");
  await expect(row.link).toContainText("Next: S1 · E1");

  await row.checkButton.dblclick();
  answer();

  await expect(row.link).toContainText("Next: S1 · E2");
  await page.reload();
  await expect(row.link).toContainText("Next: S1 · E2");
  expect(saves).toEqual(['{"progress":{"mediaType":"series","season":1,"episode":1}}']);
});

test("the check works on the Watching tab and on the series' page, without opening the page", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const series = await chernobyl(api);
  await watch(api, series.id);
  const { filmPage, libraryPage } = ui;
  await libraryPage.goto("Watching", "series");
  const row = libraryPage.watchingRow("Chernobyl");
  await expect(row.link).toContainText("Next: S1 · E1");

  await row.checkButton.click();

  await expect(row.link).toContainText("Next: S1 · E2");
  await expect(row.bar).toHaveAccessibleName("1 of 5 episodes watched");
  await expect(page).toHaveURL(libraryPage.path("Watching", "series"));

  await row.link.click();
  const { watchingCard } = filmPage;
  await expect(watchingCard.root).toContainText("NextS1 · E2Season 1, episode 2 of 5");
  await expect(watchingCard.checkButton).toHaveAccessibleName("Mark S1 · E2 watched");

  await watchingCard.checkButton.click();

  await expect(watchingCard.root).toContainText("NextS1 · E3Season 1, episode 3 of 5");
  await expect(watchingCard.bar).toHaveAccessibleName("2 of 5 episodes watched");
  await expect(watchingCard.episode).toHaveText("2");
  await page.reload();
  await expect(watchingCard.root).toContainText("NextS1 · E3Season 1, episode 3 of 5");
});

test("the picker sets the season and episode in one save, and the row follows", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const series = await breakingBad(api);
  await watch(api, series.id);
  const saves = progressSaves(page);
  const { filmPage, savedPage } = ui;
  const { watchingCard } = filmPage;
  await filmPage.goto(series.id);
  // Not started: season 1 with none of it watched, and nothing before either.
  await expect(watchingCard.season).toHaveText("1");
  await expect(watchingCard.episode).toHaveText("0");
  await expect(watchingCard.previousSeasonButton).toBeDisabled();
  await expect(watchingCard.previousEpisodeButton).toBeDisabled();

  const saved = page.waitForResponse((response) => isProgressSave(response.request()));
  await watchingCard.nextSeasonButton.click();
  await watchingCard.nextEpisodeButton.click();
  await watchingCard.nextEpisodeButton.click();
  await watchingCard.nextEpisodeButton.click();
  await watchingCard.nextEpisodeButton.click();
  await watchingCard.previousEpisodeButton.click();

  await expect(watchingCard.season).toHaveText("2");
  await expect(watchingCard.episode).toHaveText("3");
  await expect(watchingCard.root).toContainText("NextS2 · E4Season 2, episode 4 of 13");
  await expect(watchingCard.bar).toHaveAccessibleName("10 of 62 episodes watched");
  expect((await saved).ok()).toBe(true);
  expect(saves).toEqual(['{"progress":{"mediaType":"series","season":2,"episode":3}}']);

  await savedPage.goto();
  const row = savedPage.watchingNowRow("Breaking Bad");
  await expect(row.link).toContainText("Next: S2 · E4");
  await expect(row.bar).toHaveAccessibleName("10 of 62 episodes watched");
});

test("leaving the page before the picker's pause is over saves the episode, and Saved shows it", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const series = await chernobyl(api);
  await watch(api, series.id, [1, 1]);
  // A slow save, which Saved's own request for the Library would overtake.
  await page.route("**/api/in-progress/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  const { filmPage, savedPage } = ui;
  const { watchingCard } = filmPage;
  await filmPage.goto(series.id);
  await expect(watchingCard.episode).toHaveText("1");

  await watchingCard.nextEpisodeButton.click();
  await expect(watchingCard.episode).toHaveText("2");
  await filmPage.mainNav.link("Saved").click();

  const row = savedPage.watchingNowRow("Chernobyl");
  await expect(row.link).toContainText("Next: S1 · E3");
  await expect(savedPage.toast.root).toBeHidden();
  const history = await expectBody(api.catalog.getMediaItemHistory(series.id));
  expect(history.inProgress.progress).toEqual({ mediaType: "series", season: 1, episode: 2 });
});

test("the picker sets an episode the series doesn't list yet, and the day the next one airs goes with that one alone", async ({
  api,
  loggedInUi: ui,
}) => {
  // The second season's first 2 episodes have aired, and its third airs in 2099.
  const { mediaItem, title } = await newSeries(api);
  await watch(api, mediaItem.id, [2, 2]);
  const { filmPage, savedPage } = ui;
  const { watchingCard } = filmPage;
  await filmPage.goto(mediaItem.id);
  await expect(watchingCard.root).toContainText("Caught upS2 · E3 airs Jul 8, 2099");

  // Ahead of what has aired, as when TMDB lags, and then past all the series lists.
  await watchingCard.nextEpisodeButton.click();
  await expect(watchingCard.root).toContainText("Caught up");
  await expect(watchingCard.root).not.toContainText("airs");
  await watchingCard.nextEpisodeButton.click();
  await watchingCard.nextEpisodeButton.click();
  await watchingCard.nextEpisodeButton.click();
  await expect(watchingCard.episode).toHaveText("6");
  await expect(watchingCard.root).toContainText("Caught up");
  await filmPage.mainNav.link("Saved").click();

  const row = savedPage.watchingNowRow(title);
  await expect(row.link).toContainText("Caught up");
  await expect(row.link).not.toContainText(" on ");
  await expect(row.bar).toHaveAccessibleName("7 of 7 episodes watched");
});

test("stopping a series right after a step of the picker shows no error", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await chernobyl(api);
  await watch(api, series.id, [1, 1]);
  const { filmPage } = ui;
  await filmPage.goto(series.id);

  await filmPage.watchingCard.nextEpisodeButton.click();
  await filmPage.watchingCard.stopWatchingButton.click();

  await expect(filmPage.toast.message("Stopped watching Chernobyl (2019).")).toBeVisible();
  await expect(filmPage.startWatchingButton).toBeVisible();
  await expect(filmPage.errorMessage).toHaveCount(0);
});

// The choices Watch more offers, in order.
async function expectChoices(dialog: FilmPage["watchMoreDialog"], names: string[]) {
  await expect(dialog.choices).toHaveCount(names.length);
  for (const [index, name] of names.entries()) {
    await expect(dialog.choices.nth(index)).toHaveAccessibleName(name);
  }
}

// Gives a series a Log Entry, so its page offers Watch more.
async function rate(api: ApiClient, mediaItemId: number) {
  const entry = { mediaItemId, rating: 4, date: null, revisit: false };
  await expectBody(api.log.createLogEntry(entry), 201);
}

for (const [device, viewport] of [
  ["desktop", null],
  ["a phone", phone],
] as const) {
  test(`on ${device}, Watch more on a series already rated starts it from its latest season by default, with undo offered`, async ({
    page,
    api,
    loggedInUi: ui,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    // Five regular seasons, the last of 16 episodes, and a season 0 of specials.
    const series = await breakingBad(api);
    await rate(api, series.id);
    await expectBody(api.backlog.addBacklogItem({ mediaItemId: series.id }), 201);
    const { filmPage, savedPage } = ui;
    const { watchMoreDialog: dialog, watchingCard, toast } = filmPage;
    await filmPage.goto(series.id);
    await expect(filmPage.watchedAgainButton).toBeVisible();
    await expect(filmPage.startWatchingButton).toBeHidden();

    await filmPage.watchMoreButton.click();

    await expectChoices(dialog, ["From season 5", "From the start", "Choose where you are"]);
    await expect(dialog.choice("From season 5")).toBeChecked();
    await expect(dialog.choice("From season 5")).toHaveAccessibleDescription("Next: S5 · E1");
    await expect(dialog.choice("From the start")).toHaveAccessibleDescription("Next: S1 · E1");
    await expect(dialog.choice("Choose where you are")).toHaveAccessibleDescription(
      "Set the last episode you watched",
    );
    await expect(dialog.lastWatched).toBeHidden();

    await dialog.startWatchingButton.click();

    await expect(dialog.root).toBeHidden();
    await expect(watchingCard.root).toContainText("NextS5 · E1Season 5, episode 1 of 16");
    await expect(watchingCard.bar).toHaveAccessibleName("46 of 62 episodes watched");
    await expect(watchingCard.season).toHaveText("5");
    await expect(watchingCard.episode).toHaveText("0");
    await expect(filmPage.onWatchlistButton).toBeHidden();
    await expect(filmPage.historyRows).toHaveCount(1);
    await expect(toast.message("Started watching Breaking Bad (2008).")).toBeVisible();
    await expect(toast.undoButton).toBeVisible();

    await savedPage.goto();
    await expect(savedPage.watchingNowRow("Breaking Bad").link).toContainText("Next: S5 · E1");
    await expect(savedPage.tile("Series").root).toContainText(
      "0 to watch · 1 watching · 1 watched",
    );
  });
}

test("Watch more from the start starts a series already rated at its first episode, and undo puts it back on the Watchlist", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await breakingBad(api);
  await rate(api, series.id);
  await expectBody(api.backlog.addBacklogItem({ mediaItemId: series.id }), 201);
  const { filmPage } = ui;
  const { watchMoreDialog: dialog, watchingCard, toast } = filmPage;
  await filmPage.goto(series.id);
  await filmPage.watchMoreButton.click();

  await dialog.choice("From the start").click();
  await dialog.startWatchingButton.click();

  await expect(watchingCard.root).toContainText("NextS1 · E1Season 1, episode 1 of 7");
  await expect(watchingCard.bar).toHaveAccessibleName("0 of 62 episodes watched");

  await toast.undo();

  await expect(watchingCard.root).toBeHidden();
  await expect(filmPage.onWatchlistButton).toBeVisible();
  await expect(filmPage.watchMoreButton).toBeVisible();
  await expect(toast.message("Put Breaking Bad (2008) back on your Watchlist.")).toBeVisible();
});

test("Watch more from where the User is follows their own season and episode", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await breakingBad(api);
  await rate(api, series.id);
  const { filmPage, savedPage } = ui;
  const { watchMoreDialog: dialog } = filmPage;
  await filmPage.goto(series.id);
  await filmPage.watchMoreButton.click();

  await dialog.choice("Choose where you are").click();

  await expect(dialog.choice("Choose where you are")).toBeChecked();
  await expect(dialog.season).toHaveText("1");
  await expect(dialog.episode).toHaveText("0");
  await expect(dialog.choice("Choose where you are")).toHaveAccessibleDescription("Next: S1 · E1");

  await dialog.nextSeasonButton.click();
  await dialog.nextSeasonButton.click();
  for (let tap = 0; tap < 4; tap++) await dialog.nextEpisodeButton.click();

  await expect(dialog.season).toHaveText("3");
  await expect(dialog.episode).toHaveText("4");
  await expect(dialog.choice("Choose where you are")).toHaveAccessibleDescription("Next: S3 · E5");

  await dialog.startWatchingButton.click();

  await expect(dialog.root).toBeHidden();
  await expect(filmPage.watchingCard.root).toContainText("NextS3 · E5Season 3, episode 5 of 13");
  // 7 and 13 episodes of the first two seasons, and 4 of the third.
  await expect(filmPage.watchingCard.bar).toHaveAccessibleName("24 of 62 episodes watched");
  await savedPage.goto();
  await expect(savedPage.watchingNowRow("Breaking Bad").link).toContainText("Next: S3 · E5");
});

test("a series added by hand and already rated offers Watch more from the start or from where the User is", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await manualSeries(api, { title: "Леся + Рома", year: 2005 });
  await rate(api, series.id);
  const { filmPage } = ui;
  const { watchMoreDialog: dialog } = filmPage;
  await filmPage.goto(series.id);

  await filmPage.watchMoreButton.click();

  await expectChoices(dialog, ["From the start", "Choose where you are"]);
  await expect(dialog.choice("From the start")).toBeChecked();
  await expect(dialog.choice("From the start")).toHaveAccessibleDescription("Next: S1 · E1");

  // Closing it starts nothing.
  await dialog.closeButton.click();
  await expect(dialog.root).toBeHidden();
  await expect(filmPage.watchingCard.root).toBeHidden();

  await filmPage.watchMoreButton.click();
  await dialog.choice("Choose where you are").click();
  await dialog.nextSeasonButton.click();
  await expect(dialog.choice("Choose where you are")).toHaveAccessibleDescription("Next: S2 · E1");
  await dialog.startWatchingButton.click();

  await expect(filmPage.watchingCard.root).toContainText("NextS2 · E1Season 2, episode 1");
  await expect(filmPage.watchingCard.bar).toHaveCount(0);
});

test("a series with one season offers Watch more from the start or from where the User is", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await chernobyl(api);
  await rate(api, series.id);
  const { filmPage } = ui;
  await filmPage.goto(series.id);

  await filmPage.watchMoreButton.click();

  // "From season 1" would be the start again.
  await expectChoices(filmPage.watchMoreDialog, ["From the start", "Choose where you are"]);
  await expect(filmPage.watchMoreDialog.choice("From the start")).toBeChecked();
});

test("Finished after Watch more adds a second Viewing, not a Rewatch unless the User says so", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await breakingBad(api);
  await rate(api, series.id);
  const { filmPage } = ui;
  await filmPage.goto(series.id);
  await filmPage.watchMoreButton.click();
  await filmPage.watchMoreDialog.startWatchingButton.click();
  await expect(filmPage.watchingCard.root).toContainText("NextS5 · E1");

  await filmPage.watchingCard.finishedButton.click();
  const dialog = filmPage.logEntryDialog("Breaking Bad");
  await expect(dialog.revisitSwitch).not.toBeChecked();
  await dialog.dateChip("No date").click();
  await dialog.rate("5 stars");
  await dialog.save();

  await expect(dialog.root).toBeHidden();
  await expect(filmPage.watchingCard.root).toBeHidden();
  await expect(filmPage.historyRows).toHaveCount(2);
  await expect(filmPage.historyRow(0).revisitBadge).toBeHidden();
  await expect(filmPage.historyRow(1).revisitBadge).toBeHidden();
  await expect(filmPage.ratingStars("5 stars")).toBeVisible();
  // Another season later, it offers Watch more again.
  await expect(filmPage.watchMoreButton).toBeVisible();
});

test("a series whose aired episodes are all watched says Caught up and offers Finished, and shows Next again once a newer episode has aired", async ({
  api,
  loggedInUi: ui,
}) => {
  // Two seasons of 3 and 4 episodes; the second's first 2 have aired, and its third airs in 2099.
  const { mediaItem, reference, title } = await newSeries(api);
  await watch(api, mediaItem.id, [2, 1]);
  const { filmPage, savedPage } = ui;
  await savedPage.goto();
  const row = savedPage.watchingNowRow(title);
  await expect(row.link).toContainText("Next: S2 · E2");
  await expect(row.finishedButton).toBeHidden();

  await row.checkButton.click();

  await expect(row.link).toContainText("Caught up · S2 · E3 on Jul 8, 2099");
  await expect(row.link).not.toContainText("Next");
  // The bar counts what the series lists, aired or not.
  await expect(row.bar).toHaveAccessibleName("5 of 7 episodes watched");
  await expect(row.checkButton).toBeHidden();
  await expect(row.finishedButton).toBeVisible();

  await row.link.click();
  const { watchingCard } = filmPage;
  await expect(watchingCard.root).toContainText("Caught upS2 · E3 airs Jul 8, 2099");
  await expect(watchingCard.bar).toHaveAccessibleName("5 of 7 episodes watched");
  await expect(watchingCard.checkButton).toBeHidden();
  await expect(watchingCard.finishedButton).toBeVisible();
  // The steppers still work, to put a wrong tap right.
  await expect(watchingCard.episode).toHaveText("2");
  await expect(watchingCard.nextEpisodeButton).toBeEnabled();

  const aired = await api.testHooks.airEpisode(reference, { season: 2, episode: 3 });
  expect(aired.status()).toBe(204);

  await savedPage.goto();
  await expect(row.link).toContainText("Next: S2 · E3");
  await expect(row.link).not.toContainText("Caught up");
  await expect(row.checkButton).toBeVisible();
  await expect(row.finishedButton).toBeHidden();
  await row.link.click();
  await expect(watchingCard.root).toContainText("NextS2 · E3Season 2, episode 3 of 4");
});

test("Finished on a caught-up series records a Viewing with its Rating and moves the series to Watched", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await chernobyl(api);
  await watch(api, series.id, [1, 5]);
  const { filmPage, libraryPage } = ui;
  await libraryPage.goto("Watching", "series");
  const row = libraryPage.watchingRow("Chernobyl");
  // An ended series has no next episode to wait for.
  await expect(row.link).toHaveText("ChernobylCaught up5 of 5");
  await expect(row.bar).toHaveAccessibleName("5 of 5 episodes watched");

  await row.finishedButton.click();
  const dialog = libraryPage.logEntryDialog("Chernobyl");
  await expect(dialog.kindLabel("Watched")).toBeVisible();
  await dialog.dateChip("No date").click();
  await dialog.rate("4 stars");
  await dialog.save();

  await expect(dialog.root).toBeHidden();
  await expect(libraryPage.tab("Watching")).toHaveAccessibleName("Watching 0");
  await expect(libraryPage.tab("Watched")).toHaveAccessibleName("Watched 1");
  await expect(libraryPage.text("Series you start watching show up here.")).toBeVisible();
  await expect(libraryPage.toast.message("Added Chernobyl (2019) to your Log.")).toBeVisible();

  await libraryPage.toast.goToWatchedLink.click();
  await expect(libraryPage.poster("Watched", "Chernobyl").rating("4 stars")).toBeVisible();
  await filmPage.goto(series.id);
  await expect(filmPage.historyRows).toHaveCount(1);
  await expect(filmPage.watchingCard.root).toBeHidden();
  await expect(filmPage.watchMoreButton).toBeVisible();
});

test("Finished on Saved takes the series out of Watching now and counts it as watched", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await chernobyl(api);
  await watch(api, series.id, [1, 5]);
  const { savedPage } = ui;
  await savedPage.goto();

  await savedPage.watchingNowRow("Chernobyl").finishedButton.click();
  const dialog = savedPage.logEntryDialog("Chernobyl");
  await dialog.rate("5 stars");
  await dialog.save();

  await expect(dialog.root).toBeHidden();
  await expect(savedPage.watchingNow).toHaveCount(0);
  await expect(savedPage.tile("Series").root).toContainText("0 to watch · 1 watched");
  await expect(savedPage.toast.message("Added Chernobyl (2019) to your Log.")).toBeVisible();
});

test("Stop watching removes the series from Watching and leaves no Viewing", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await chernobyl(api);
  await watch(api, series.id, [1, 2]);
  const { filmPage, libraryPage, savedPage } = ui;
  await savedPage.goto();
  await savedPage.watchingNowRow("Chernobyl").link.click();

  await filmPage.watchingCard.stopWatchingButton.click();

  await expect(filmPage.watchingCard.root).toBeHidden();
  await expect(filmPage.startWatchingButton).toBeVisible();
  await expect(filmPage.wantToWatchButton).toBeVisible();
  await expect(filmPage.emptyHistoryMessage).toBeVisible();
  await expect(filmPage.toast.message("Stopped watching Chernobyl (2019).")).toBeVisible();
  await libraryPage.goto("Watching", "series");
  await expect(libraryPage.tab("Watching")).toHaveAccessibleName("Watching 0");
  await expect(libraryPage.tab("Watched")).toHaveAccessibleName("Watched 0");
  await savedPage.goto();
  await expect(savedPage.tile("Series").root).toContainText("Nothing saved yet.");
  await expect(savedPage.watchingNow).toHaveCount(0);

  // Watching it again starts from its first episode: the Progress went with the stop.
  await filmPage.goto(series.id);
  await filmPage.startWatchingButton.click();
  await expect(filmPage.watchingCard.root).toContainText("NextS1 · E1");
});

test("a series added by hand counts episodes within its season, with no bar and no Caught up", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await manualSeries(api, { title: "Леся + Рома", year: 2005 });
  await watch(api, series.id, [1, 3]);
  const { filmPage, savedPage } = ui;
  await savedPage.goto();
  const row = savedPage.watchingNowRow("Леся + Рома");
  await expect(row.link).toContainText("Next: S1 · E4");
  await expect(row.bar).toHaveCount(0);

  await row.checkButton.click();

  await expect(row.link).toContainText("Next: S1 · E5");
  await expect(row.link).not.toContainText("Caught up");
  await expect(row.bar).toHaveCount(0);
  await expect(row.finishedButton).toBeHidden();

  await row.link.click();
  const { watchingCard } = filmPage;
  await expect(watchingCard.root).toContainText("NextS1 · E5Season 1, episode 5");
  await expect(watchingCard.root).not.toContainText("episode 5 of");
  await expect(watchingCard.bar).toHaveCount(0);
  await expect(watchingCard.finishedButton).toBeVisible();

  // The User moves on to the next season themselves.
  await watchingCard.nextSeasonButton.click();
  await expect(watchingCard.root).toContainText("NextS2 · E1Season 2, episode 1");
  await expect(watchingCard.episode).toHaveText("0");
});

test("a save that fails puts the row back and says so", async ({ page, api, loggedInUi: ui }) => {
  const series = await chernobyl(api);
  await watch(api, series.id, [1, 2]);
  await page.route("**/api/in-progress/*", (route) => {
    return route.request().method() === "PATCH" ? route.abort() : route.continue();
  });
  const { filmPage, savedPage } = ui;
  await savedPage.goto();
  const row = savedPage.watchingNowRow("Chernobyl");

  await row.checkButton.click();

  await expect(
    savedPage.toast.message("Couldn't save your episode of Chernobyl (2019). Please try again."),
  ).toBeVisible();
  await expect(row.link).toContainText("Next: S1 · E3");
  await expect(row.bar).toHaveAccessibleName("2 of 5 episodes watched");

  await row.link.click();
  const { watchingCard } = filmPage;
  await watchingCard.nextEpisodeButton.click();
  await expect(watchingCard.episode).toHaveText("3");

  await expect(filmPage.errorMessage).toHaveText(
    "Couldn't save your episode of Chernobyl (2019). Please try again.",
  );
  await expect(watchingCard.episode).toHaveText("2");
  await expect(watchingCard.root).toContainText("NextS1 · E3");
  // The next change takes the message away.
  await watchingCard.previousEpisodeButton.click();
  await expect(filmPage.errorMessage).toHaveCount(0);
  await expect(filmPage.errorMessage).toHaveCount(1);
  await expect(watchingCard.episode).toHaveText("2");
  const history = await expectBody(api.catalog.getMediaItemHistory(series.id));
  expect(history.inProgress.progress).toEqual({ mediaType: "series", season: 1, episode: 2 });
});
