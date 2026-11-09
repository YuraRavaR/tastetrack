import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { alien, aliens, amelie } from "../support/scenarios/films";
import { holdImages } from "../support/scenarios/tmdb";
import { expect, test } from "../support/ui/fixtures";

async function plan(api: ApiClient, mediaItemId: number, time: string) {
  await expectBody(api.backlog.addBacklogItem({ mediaItemId }, at(time)), 201);
}

async function logFilm(api: ApiClient, mediaItemId: number, rating: number, date: string) {
  await expectBody(api.log.createLogEntry({ mediaItemId, rating, date }), 201);
}

// Alien is only planned. Aliens was watched and planned again later, for a rewatch. Amélie was
// watched twice, so it has one Current Rating, the later viewing's.
async function fillLibrary(api: ApiClient) {
  const alienItem = await alien(api);
  const aliensItem = await aliens(api);
  const amelieItem = await amelie(api);
  await plan(api, alienItem.id, minutesAgo(60));
  await logFilm(api, amelieItem.id, 3, "2026-09-01");
  await logFilm(api, amelieItem.id, 4.5, "2026-10-01");
  await logFilm(api, aliensItem.id, 5, "2026-10-05");
  await plan(api, aliensItem.id, minutesAgo(30));
  return { alienItem, aliensItem, amelieItem };
}

test("Saved shows the Watchlist and Watched as posters, with their counts", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  await fillLibrary(api);
  const { libraryPage } = ui;

  await libraryPage.goto();

  await expect(libraryPage.heading).toHaveText("Films");
  await expect(libraryPage.tab("Watchlist")).toHaveAccessibleName("Watchlist 2");
  await expect(libraryPage.tab("Watched")).toHaveAccessibleName("Watched 2");
  await expect(libraryPage.tab("Watchlist")).toHaveAttribute("aria-current", "page");
  // The latest added first, each with its year.
  await expect(libraryPage.posters("Watchlist")).toHaveText([/Aliens\s*1986$/, /Alien\s*1979$/]);
  // Aliens was watched before it was planned again; Alien never was.
  await expect(libraryPage.poster("Watchlist", "Aliens").watchedBeforeMark).toBeVisible();
  await expect(libraryPage.poster("Watchlist", "Alien").watchedBeforeMark).toHaveCount(0);

  await libraryPage.tab("Watched").click();

  await expect(page).toHaveURL(libraryPage.path("Watched"));
  await expect(libraryPage.tab("Watched")).toHaveAttribute("aria-current", "page");
  // Each film once, the last watched first, with its Current Rating.
  await expect(libraryPage.posters("Watched")).toHaveText([/Aliens/, /Amélie/]);
  await expect(libraryPage.poster("Watched", "Aliens").rating("5 stars")).toBeVisible();
  await expect(libraryPage.poster("Watched", "Amélie").rating("4.5 stars")).toBeVisible();

  await page.goBack();
  await expect(libraryPage.posters("Watchlist")).toHaveCount(2);
});

test("the grid's posters load the large image", async ({ page, api, loggedInUi: ui }) => {
  await holdImages(page);
  const { alienItem } = await fillLibrary(api);
  const { libraryPage } = ui;

  await libraryPage.goto();

  await expect(libraryPage.poster("Watchlist", "Alien").posterImage).toHaveAttribute(
    "src",
    alienItem.metadata.posterUrls.large,
  );
});

test("tapping a poster opens the film's page", async ({ page, api, loggedInUi: ui }) => {
  const { amelieItem } = await fillLibrary(api);
  const { libraryPage, filmPage } = ui;
  await libraryPage.goto("Watched");

  await libraryPage.poster("Watched", "Amélie").link.click();

  await expect(page).toHaveURL(filmPage.path(amelieItem.id));
  await expect(filmPage.heading).toContainText("Amélie");
});

test("a new User's tabs are empty, and each says how to fill it", async ({
  page,
  loggedInUi: ui,
}) => {
  const { libraryPage } = ui;
  await libraryPage.goto("Watched");

  await expect(libraryPage.tab("Watchlist")).toHaveAccessibleName("Watchlist 0");
  await expect(libraryPage.tab("Watched")).toHaveAccessibleName("Watched 0");
  await expect(libraryPage.text("Films you mark Watched show up here.")).toBeVisible();
  await libraryPage.goToWatchlistLink.click();

  await expect(page).toHaveURL(libraryPage.path("Watchlist"));
  await expect(libraryPage.text("Nothing on your Watchlist yet.")).toBeVisible();
  await libraryPage.findFilmLink.click();
  await expect(page).toHaveURL(ui.searchPage.path());
  await expect(ui.searchPage.searchBox).toBeVisible();
});

test("on a phone the posters sit 3 a row under a link back to Saved", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const alienItem = await alien(api);
  const aliensItem = await aliens(api);
  const amelieItem = await amelie(api);
  for (const [index, item] of [alienItem, aliensItem, amelieItem].entries()) {
    await logFilm(api, item.id, 4, `2026-10-0${index + 1}`);
  }
  await plan(api, alienItem.id, minutesAgo(30));
  const { libraryPage } = ui;
  await page.setViewportSize({ width: 402, height: 874 });

  await libraryPage.goto("Watched");

  await expect(libraryPage.breadcrumb).toBeHidden();
  await expect(libraryPage.backToSavedLink).toBeVisible();
  await expect(libraryPage.posters("Watched")).toHaveCount(3);
  const tops = await libraryPage.posters("Watched").evaluateAll((items) => {
    return items.map((item) => Math.round(item.getBoundingClientRect().top));
  });
  expect(new Set(tops).size).toBe(1);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(libraryPage.breadcrumb).toBeVisible();
  await expect(libraryPage.breadcrumb).toHaveText(/Saved\s*Films/);
  await libraryPage.backToSavedLink.click();
  await expect(page).toHaveURL(ui.savedPage.path());
});
