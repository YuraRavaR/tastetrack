import type { Locator } from "@playwright/test";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { alien, aliens, amelie, manualFilm } from "../support/scenarios/films";
import { expect, test } from "../support/ui/fixtures";

async function plan(api: ApiClient, mediaItemId: number, time: string) {
  await expectBody(api.backlog.addBacklogItem({ mediaItemId }, at(time)), 201);
}

// A film made by hand has no poster. Planned first, before three films with posters, it is the
// one the fan leaves out. Aliens was watched before it was planned again, so it counts in both.
async function fillLibrary(api: ApiClient) {
  const homeMovie = await manualFilm(api, { title: "Home movie", year: 2024 });
  const alienItem = await alien(api);
  const aliensItem = await aliens(api);
  const amelieItem = await amelie(api);
  await plan(api, homeMovie.id, minutesAgo(90));
  await plan(api, alienItem.id, minutesAgo(60));
  const logged = api.log.createLogEntry({ mediaItemId: aliensItem.id, rating: 5, date: null });
  await expectBody(logged, 201);
  await plan(api, aliensItem.id, minutesAgo(30));
  await plan(api, amelieItem.id, minutesAgo(10));
  return { alienItem, aliensItem, amelieItem };
}

function topOf(element: Locator) {
  return element.evaluate((node) => Math.round(node.getBoundingClientRect().top));
}

test("Saved shows a tile per Media Type, and the Films tile counts its tabs and fans out the Watchlist", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const { alienItem, aliensItem, amelieItem } = await fillLibrary(api);
  const { savedPage, libraryPage } = ui;

  await savedPage.goto();

  await expect(savedPage.heading).toHaveText("Saved");
  await expect(savedPage.tiles).toHaveCount(2);
  const films = savedPage.tile("Films");
  await expect(films.root).toContainText("4 to watch · 1 watched");
  await expect(films.link).toHaveAccessibleDescription("4 to watch · 1 watched");
  // The three added last, the latest in front; the film made by hand, planned first, is left out.
  const largePosterUrls = [amelieItem, aliensItem, alienItem].map(
    (item) => item.metadata.posterUrls.large,
  );
  await expect(films.coverImages).toHaveCount(3);
  for (const [index, url] of largePosterUrls.entries()) {
    await expect(films.coverImages.nth(index)).toHaveAttribute("src", url);
  }
  await expect(films.coverPlaceholders).toHaveCount(0);
  await expect(films.findFilmLink).toHaveCount(0);

  // Films planned don't count as books.
  await expect(savedPage.tile("Books").root).toContainText("Nothing saved yet.");

  await films.link.click();
  await expect(page).toHaveURL(libraryPage.path("Watchlist"));
  await expect(libraryPage.posters("Watchlist")).toHaveCount(4);

  // Saved in the nav comes back up to the tiles.
  await libraryPage.mainNav.link("Saved").click();
  await expect(page).toHaveURL(savedPage.path());
  await expect(savedPage.tiles).toHaveCount(2);
});

test("a new User's Films tile has empty slots and a way to find a film, and still opens its empty tabs", async ({
  page,
  loggedInUi: ui,
}) => {
  const { savedPage, libraryPage, searchPage } = ui;
  await savedPage.goto();
  const films = savedPage.tile("Films");

  await expect(films.root).toContainText("Nothing saved yet.");
  await expect(films.coverImages).toHaveCount(0);
  await expect(films.coverPlaceholders).toHaveCount(0);
  await films.findFilmLink.click();
  await expect(page).toHaveURL(searchPage.path());
  await expect(searchPage.searchBox).toBeEmpty();

  await page.goBack();
  await films.link.click();
  await expect(page).toHaveURL(libraryPage.path("Watchlist"));
  await expect(libraryPage.tab("Watchlist")).toHaveAccessibleName("Watchlist 0");
  await expect(libraryPage.tab("Watched")).toHaveAccessibleName("Watched 0");
});

test("the tiles stack on a phone and sit side by side from md", async ({
  page,
  loggedInUi: ui,
}) => {
  const { savedPage } = ui;
  await page.setViewportSize({ width: 402, height: 874 });
  await savedPage.goto();
  const [films, books] = [savedPage.tiles.first(), savedPage.tiles.last()];
  await expect(savedPage.tile("Films").root).toContainText("Nothing saved yet.");

  expect(await topOf(books)).toBeGreaterThan(await topOf(films));
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBe(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await topOf(books)).toBe(await topOf(films));
});
