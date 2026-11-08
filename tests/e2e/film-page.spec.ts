import type { Page } from "@playwright/test";
import { alien, aliens, film, newFilm } from "../support/scenarios/films";
import { callsRealTmdb } from "../support/scenarios/tmdb";
import { expect, test } from "../support/ui/fixtures";
import type { FilmPage } from "../support/ui/pages/FilmPage";

// Leaves every TMDB image loading for good, so the tests see the page before any image arrives
// and depend on neither TMDB nor the network.
async function holdImages(page: Page): Promise<void> {
  await page.route("https://image.tmdb.org/**", () => {});
}

async function openFilm(filmPage: FilmPage, mediaItemId: number): Promise<void> {
  await filmPage.goto(mediaItemId);
  await expect(filmPage.heading).toBeVisible();
}

test("a film's page opens with its backdrop, sized for the screen", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await holdImages(page);
  const { id, metadata } = await alien(api);
  const { filmPage } = ui;

  await page.setViewportSize({ width: 402, height: 874 });
  await openFilm(filmPage, id);

  await expect(filmPage.backdropImage).toHaveAttribute("src", metadata.backdropUrls.small);
  await expect(filmPage.backdropSource).toHaveAttribute("srcset", metadata.backdropUrls.large);
  // The space is taken before the image loads, so the page doesn't jump.
  expect((await filmPage.backdrop.boundingBox())?.height).toBe(184);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => (await filmPage.backdrop.boundingBox())?.height).toBe(260);
});

test("a film without a backdrop shows its poster in the banner, larger than a thumbnail", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film without a backdrop");
  await holdImages(page);
  const { id, metadata } = await aliens(api);
  const { filmPage } = ui;

  await openFilm(filmPage, id);

  await expect(filmPage.backdrop).toHaveCount(0);
  const poster = filmPage.posterImage(metadata.posterUrl);
  await expect(poster).toHaveCSS("width", "112px");
  await expect(poster).toHaveCSS("height", "168px");
});

test("a film with neither shows the placeholder with its caption", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  await holdImages(page);
  const { id, query } = newFilm();
  const added = await film(api, query, id);

  await openFilm(ui.filmPage, added.id);

  await expect(ui.filmPage.noPosterPlaceholder).toHaveText(/\S/);
});

test("before a first viewing, a film's page offers the actions and explains its empty Viewings", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await holdImages(page);
  const { id } = await alien(api);
  const { filmPage } = ui;

  await openFilm(filmPage, id);

  await expect(filmPage.watchedButton).toBeVisible();
  await expect(filmPage.wantToWatchButton).toBeVisible();
  await expect(filmPage.addToListButton).toBeVisible();
  await expect(filmPage.viewingsHeading).toBeVisible();
  await expect(filmPage.noViewingsMessage).toBeVisible();
  await expect(filmPage.noViewingsHint).toBeVisible();
  await expect(filmPage.ratingStatName).toBeHidden();
});

test("the Watchlist toggles from a film's page, and stays as it was left", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await holdImages(page);
  const { id } = await alien(api);
  const { filmPage, libraryPage } = ui;
  await openFilm(filmPage, id);

  await filmPage.wantToWatchButton.click();

  await expect(filmPage.onWatchlistButton).toBeVisible();
  await expect(filmPage.toast.root).toHaveText(/Put Alien \(1979\) on your Watchlist\./);

  await page.reload();
  await expect(filmPage.onWatchlistButton).toBeVisible();

  await filmPage.onWatchlistButton.click();

  await expect(filmPage.wantToWatchButton).toBeVisible();
  await expect(filmPage.toast.root).toHaveText(/Took Alien \(1979\) off your Watchlist\./);
  await libraryPage.goto("Watchlist");
  await expect(libraryPage.text("Nothing on your Watchlist yet.")).toBeVisible();
});

test("logging a Revisit from a film's page updates its tiles and Viewings at once", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await holdImages(page);
  await page.clock.setFixedTime(new Date("2026-03-15T12:00:00"));
  const { id } = await alien(api);
  const first = await api.log.createLogEntry({
    mediaItemId: id,
    rating: 5,
    date: "2026-03-01",
    timeZone: "UTC",
  });
  expect(first.status(), await first.text()).toBe(201);
  const { filmPage } = ui;
  await openFilm(filmPage, id);
  await expect(filmPage.watchedStat).toHaveText("Once");
  await expect(filmPage.ratingStars("5 stars")).toBeVisible();

  await filmPage.watchedAgainButton.click();
  const dialog = filmPage.logEntryDialog("Alien");
  await expect(dialog.revisitSwitch).toBeChecked();
  await expect(dialog.kindLabel("Watched again")).toBeVisible();
  await expect(dialog.lastTime).toHaveText("Last time 5 · Mar 1, 2026");
  await dialog.rate("3 stars");
  await dialog.save();

  await expect(dialog.root).toBeHidden();
  await expect(filmPage.watchedStat).toHaveText("2 times");
  await expect(filmPage.ratingStars("3 stars")).toBeVisible();
  await expect(filmPage.viewings).toHaveCount(2);
  await expect(filmPage.viewing(0).revisitBadge).toBeVisible();
  await expect(filmPage.toast.root).toContainText("Added Alien (1979) to your Log.");
});

test("a first viewing from a film's page takes it off the Watchlist, with an undo", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await holdImages(page);
  await page.clock.setFixedTime(new Date("2026-03-15T12:00:00"));
  const { id } = await alien(api);
  const planned = await api.backlog.addBacklogItem({ mediaItemId: id });
  expect(planned.status(), await planned.text()).toBe(201);
  const { filmPage } = ui;
  await openFilm(filmPage, id);

  await filmPage.watchedButton.click();
  const dialog = filmPage.logEntryDialog("Alien");
  await expect(dialog.revisitSwitch).not.toBeChecked();
  await expect(dialog.watchlistNote).toBeVisible();
  await dialog.rate("3 stars");
  await dialog.save();

  await expect(filmPage.watchedAgainButton).toBeVisible();
  await expect(filmPage.viewings).toHaveCount(1);
  await expect(filmPage.wantToWatchButton).toBeVisible();

  await filmPage.toast.undo();

  await expect(filmPage.onWatchlistButton).toBeVisible();
  await expect(filmPage.toast.root).toHaveText(/Put Alien \(1979\) back on your Watchlist\./);
});
