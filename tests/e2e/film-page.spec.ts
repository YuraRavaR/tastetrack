import type { Locator } from "@playwright/test";
import { alien, aliens, film, manualFilm, newFilm, noPosterFilm } from "../support/scenarios/films";
import { callsRealTmdb, holdImages } from "../support/scenarios/tmdb";
import { type Box, settledBoxOf as box } from "../support/ui/boxes";
import { expect, test } from "../support/ui/fixtures";
import type { FilmPage } from "../support/ui/pages/FilmPage";

async function openFilm(filmPage: FilmPage, mediaItemId: number): Promise<void> {
  await filmPage.goto(mediaItemId);
  await expect(filmPage.heading).toBeVisible();
}

// On a phone 402 px wide, the picture runs edge to edge at 16:9, and the poster climbs 72 px into
// it. Both take their space before the images load, so the page doesn't jump.
async function expectPhoneBanner(filmPage: FilmPage, poster: Locator): Promise<Box> {
  const picture = await box(filmPage.picture);
  expect([picture.x, picture.width]).toEqual([0, 402]);
  expect(picture.height).toBeCloseTo((402 * 9) / 16, 0);
  const drawnPoster = await box(poster);
  expect([drawnPoster.width, drawnPoster.height]).toEqual([104, 156]);
  expect(drawnPoster.y).toBeCloseTo(picture.y + picture.height - 72, 0);
  return picture;
}

// From sm, 1440 px wide, the picture fills the film page's column, 960 px of content, and the
// poster grows and climbs 172 px.
async function expectWebBanner(filmPage: FilmPage, poster: Locator): Promise<Box> {
  await expect.poll(async () => (await box(filmPage.picture)).width).toBe(960);
  const picture = await box(filmPage.picture);
  expect(picture.height).toBe(540);
  const drawnPoster = await box(poster);
  expect([drawnPoster.width, drawnPoster.height]).toEqual([176, 264]);
  expect(drawnPoster.y).toBeCloseTo(picture.y + picture.height - 172, 0);
  return picture;
}

test("a film's page opens with its whole backdrop, the poster over its bottom edge", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await holdImages(page);
  const { id, metadata } = await alien(api);
  const { filmPage } = ui;
  const poster = filmPage.posterImage(metadata.posterUrls.large);

  await page.setViewportSize({ width: 402, height: 874 });
  await openFilm(filmPage, id);

  await expect(filmPage.pictureImage).toHaveAttribute("src", metadata.backdropUrls.small);
  await expect(filmPage.pictureSource).toHaveAttribute("srcset", metadata.backdropUrls.large);
  await expectPhoneBanner(filmPage, poster);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectWebBanner(filmPage, poster);
});

test("a film without a backdrop opens with its poster, blurred, as the picture", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film without a backdrop");
  await holdImages(page);
  const { id, metadata } = await aliens(api);
  const { filmPage } = ui;
  const poster = filmPage.posterImage(metadata.posterUrls.large);

  // The same banner as with a backdrop. The picture is the poster's large image, a decoration.
  await page.setViewportSize({ width: 402, height: 874 });
  await openFilm(filmPage, id);

  await expect(filmPage.pictureImage).toHaveAttribute("src", metadata.posterUrls.large);
  await expect(filmPage.pictureImage).toHaveAttribute("alt", "");
  await expect(filmPage.pictureSource).toHaveCount(0);
  await expectToOverflow(filmPage.pictureImage, await expectPhoneBanner(filmPage, poster));

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectToOverflow(filmPage.pictureImage, await expectWebBanner(filmPage, poster));
});

// The blurred image is scaled past the picture's edges on every side, so the soft border the blur
// gives it falls outside the picture, which crops it.
async function expectToOverflow(image: Locator, picture: Box): Promise<void> {
  const drawn = await box(image);
  expect(drawn.x).toBeLessThan(picture.x);
  expect(drawn.y).toBeLessThan(picture.y);
  expect(drawn.x + drawn.width).toBeGreaterThan(picture.x + picture.width);
  expect(drawn.y + drawn.height).toBeGreaterThan(picture.y + picture.height);
}

test("a film with a backdrop and no poster shows the placeholder over it", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has this film");
  await holdImages(page);
  const { id } = await noPosterFilm(api);
  const { filmPage } = ui;

  // On a phone it is the poster's size, too small for the caption, so only its icon shows.
  await page.setViewportSize({ width: 402, height: 874 });
  await openFilm(filmPage, id);

  const backdrop = await box(filmPage.picture);
  const phonePlaceholder = await box(filmPage.noPosterPlaceholder);
  expect([phonePlaceholder.width, phonePlaceholder.height]).toEqual([104, 156]);
  expect(phonePlaceholder.y).toBeCloseTo(backdrop.y + backdrop.height - 72, 0);
  await expect(filmPage.noPosterPlaceholder).toHaveText("", { useInnerText: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(filmPage.noPosterPlaceholder).toHaveText(/\S/, { useInnerText: true });
  const webPlaceholder = await box(filmPage.noPosterPlaceholder);
  expect([webPlaceholder.width, webPlaceholder.height]).toEqual([176, 264]);
});

test("the Log Entry dialog shows the film's small poster", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await holdImages(page);
  const { id, metadata } = await alien(api);
  const { filmPage } = ui;
  await openFilm(filmPage, id);

  await filmPage.watchedButton.click();

  const dialog = filmPage.logEntryDialog("Alien");
  await expect(dialog.posterImage).toHaveAttribute("src", metadata.posterUrls.small);
});

test("a film with neither has no picture, the placeholder with its caption at the top", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  await holdImages(page);
  const { id, query } = newFilm();
  const added = await film(api, query, id);

  await openFilm(ui.filmPage, added.id);

  await expect(ui.filmPage.picture).toHaveCount(0);
  await expect(ui.filmPage.noPosterPlaceholder).toHaveText(/\S/, { useInnerText: true });
  const placeholder = await box(ui.filmPage.noPosterPlaceholder);
  expect([placeholder.width, placeholder.height]).toEqual([176, 264]);
  expect(placeholder.y).toBeGreaterThanOrEqual((await box(ui.filmPage.main)).y);
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

test("the Watched again dialog's hint leaves out the date of a Log Entry with none", async ({
  ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await alien(api);
  expect((await api.log.createLogEntry({ mediaItemId, rating: 3.5 })).status()).toBe(201);
  const { filmPage } = ui;
  await openFilm(filmPage, mediaItemId);

  await filmPage.watchedAgainButton.click();

  await expect(filmPage.logEntryDialog("Alien").lastTime).toHaveText("Last time 3.5");
});

test("a film's page shows its runtime and genres", async ({ ui, loggedInApi: api }) => {
  const { filmPage } = ui;

  await filmPage.goto((await alien(api)).id);

  await expect(filmPage.heading).toContainText("Alien (1979)");
  await expect(filmPage.text("117 min · Horror, Science Fiction")).toBeVisible();
});

test("the browser tab names the film and its year, or its title as typed when it has none", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const { filmPage } = ui;

  await openFilm(filmPage, (await alien(api)).id);
  await expect(page).toHaveTitle("Alien (1979) · TasteTrack");

  const title = `Tom & "Jerry" <home movie>`;
  await openFilm(filmPage, (await manualFilm(api, { title })).id);
  await expect(page).toHaveTitle(`${title} · TasteTrack`);
});
