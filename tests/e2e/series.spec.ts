import type { MediaType } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { alien } from "../support/scenarios/films";
import {
  breakingBad,
  chernobyl,
  manualSeries,
  mobLand,
  noPosterSeries,
  posterUrl,
} from "../support/scenarios/series";
import { holdImages } from "../support/scenarios/tmdb";
import { expect, test } from "../support/ui/fixtures";

// Locally the Worker searches a TMDB fake, whose series mirror TMDB as it was on 2026-11-15; their
// posters are TMDB's own images, which these tests never load.
test.beforeEach(async ({ page }) => {
  await holdImages(page);
});

// The words of a film or a book no series screen may say.
const otherWording = /\bfilms?\b|\bbooks?\b|\bread/i;

async function plan(api: ApiClient, mediaItemId: number, time = minutesAgo(1)) {
  await expectBody(api.backlog.addBacklogItem({ mediaItemId }, at(time)), 201);
}

async function log(api: ApiClient, mediaItemId: number, rating: number, date: string) {
  await expectBody(api.log.createLogEntry({ mediaItemId, rating, date, revisit: false }), 201);
}

async function createList(api: ApiClient, name: string, mediaType: MediaType) {
  return (await expectBody(api.lists.createList({ name, mediaType }), 201)).list;
}

const phone = { width: 390, height: 844 };

for (const [device, viewport] of [
  ["desktop", null],
  ["a phone", phone],
] as const) {
  test(`on ${device}, the Series chip puts series in the address of Search and Collections, and a reload keeps it`, async ({
    page,
    loggedInUi: ui,
    loggedInApi: api,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await createList(api, "Space horror", "film");
    await createList(api, "Miniseries", "series");
    const { searchPage, listsPage } = ui;
    await searchPage.goto("chernobyl");

    await searchPage.mediaTypeChip("Series").click();

    await expect(page).toHaveURL(searchPage.path("chernobyl", "series"));
    await expect(searchPage.searchBox).toHaveAttribute(
      "placeholder",
      "Title in English or Ukrainian",
    );
    await expect(searchPage.tmdbHeading).toHaveText(/^From TMDB\s*1$/);
    await expect(searchPage.searchResults.filmLabel("Chernobyl (2019)")).toBeVisible();
    await page.reload();
    await expect(searchPage.currentChip("Series")).toBeVisible();
    await expect(searchPage.searchResults.filmLabel("Chernobyl (2019)")).toBeVisible();

    await listsPage.goto();
    await expect(listsPage.lists).toHaveText([/Space horror/]);
    await listsPage.seriesChip.click();
    await expect(page).toHaveURL(listsPage.path("series"));
    await expect(listsPage.lists).toHaveText([/Miniseries\s*0 series/]);
    await page.reload();
    await expect(listsPage.pressedChip).toHaveText("Series");
    await expect(listsPage.lists).toHaveText([/Miniseries/]);
  });
}

test("a series found in Search opens its page, with its titles, years, seasons and status over its backdrop", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await breakingBad(api);
  const { searchPage, filmPage } = ui;
  await searchPage.goto("breaking bad", "series");

  await searchPage.searchResults.link("Breaking Bad (2008)").click();

  await expect(page).toHaveURL(filmPage.path(mediaItemId));
  await expect(filmPage.heading).toHaveText("Breaking Bad (2008)Пуститися берега");
  await expect(filmPage.text("2008–2013 · 5 seasons · Ended")).toBeVisible();
  await expect(page).toHaveTitle("Breaking Bad (2008) · TasteTrack");
  await expect(filmPage.pictureSource).toHaveAttribute(
    "srcset",
    "https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
  );
  await expect(
    filmPage.posterImage(posterUrl("/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg", "w500")),
  ).toBeVisible();
  // Before a first Viewing: the About block's More and Українською, then Watched, Want to watch,
  // Start watching and Add to collection, and an empty History with Add a thought.
  await expect(filmPage.buttons).toHaveText([
    "More",
    "Українською",
    "Watched",
    "Want to watch",
    "Start watching",
    "Add to collection",
    "Add a thought",
  ]);
  await expect(filmPage.sectionHeadings).toHaveText(["History"]);
  await expect(filmPage.main).not.toContainText(otherWording);
});

test("a running series' years stay open, and a series of one year and one season says so once", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const running = await mobLand(api);
  const miniseries = await chernobyl(api);
  const { filmPage } = ui;

  await filmPage.goto(running.id);
  await expect(filmPage.heading).toHaveText("MobLand (2025)Земля Гангстерів");
  await expect(filmPage.text("2025– · 2 seasons · Returning")).toBeVisible();

  await filmPage.goto(miniseries.id);
  await expect(filmPage.heading).toHaveText("Chernobyl (2019)Чорнобиль");
  await expect(filmPage.text("2019 · 1 season · Ended")).toBeVisible();
});

test("a series without a poster shows a placeholder in Search and on its page, over its backdrop", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await noPosterSeries(api);
  const { searchPage, filmPage } = ui;
  await searchPage.goto("tmdb fake no poster series", "series");

  await expect(
    searchPage.searchResults.result("TMDB Fake No Poster Series (2021)").noPosterPlaceholder,
  ).toBeVisible();
  await filmPage.goto(mediaItemId);
  await expect(filmPage.noPosterPlaceholder).toBeVisible();
  await expect(filmPage.text("2021 · 1 season · Canceled")).toBeVisible();
  await expect(filmPage.pictureSource).toHaveCount(1);
});

test("Want to watch puts a series on the Watchlist of series, apart from the films', and Watched takes it off, with Undo", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await plan(api, (await alien(api)).id);
  const { searchPage, savedPage, libraryPage } = ui;
  const { toast } = searchPage;
  await searchPage.goto("breaking bad", "series");
  const result = searchPage.searchResults.result("Breaking Bad (2008)");

  await result.wantToWatchButton.click();

  await expect(toast.message("Put Breaking Bad (2008) on your Watchlist.")).toBeVisible();
  await expect(result.onWatchlistButton).toBeVisible();
  await result.markWatchedButton.click();
  const dialog = searchPage.logEntryDialog("Breaking Bad");
  await expect(dialog.watchlistNote).toBeVisible();
  await dialog.rate("4.5 stars");
  await dialog.save();
  await expect(toast.message("Took Breaking Bad (2008) off your Watchlist.")).toBeVisible();
  await expect(result.onWatchlistButton).toHaveCount(0);
  await toast.undo();
  await expect(toast.message("Put Breaking Bad (2008) back on your Watchlist.")).toBeVisible();
  // Once the query changes, it is In your Saved, with its Current Rating, and TMDB's leave it out.
  await searchPage.search("breaking");
  await expect(searchPage.userMediaItemsHeading).toHaveText(/^In your Saved\s*1$/);
  await expect(searchPage.userMediaItems.film("Breaking Bad").root).toContainText("4.5");
  await expect(searchPage.searchResults.filmLabel("Breaking Bad (2008)")).toHaveCount(0);

  // Each Media Type has a Watchlist of its own.
  await searchPage.mainNav.link("Saved").click();
  await expect(savedPage.tile("Series").link).toHaveAccessibleDescription("1 to watch · 1 watched");
  await expect(savedPage.tile("Films").link).toHaveAccessibleDescription("1 to watch · 0 watched");
  await libraryPage.goto("Watchlist", "series");
  await expect(libraryPage.posters("Watchlist")).toHaveText([/^Breaking Bad\s*2008$/]);
  await expect(libraryPage.poster("Watchlist", "Breaking Bad").watchedBeforeMark).toBeVisible();
  await libraryPage.goto("Watchlist");
  await expect(libraryPage.posters("Watchlist")).toHaveText([/^Alien\s*1979$/]);
});

test("a series' second Log Entry starts as no Rewatch, as a new season isn't one, and a film's still starts as one", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const series = await mobLand(api);
  const film = await alien(api);
  await log(api, series.id, 4, "2025-05-01");
  await log(api, film.id, 4, "2025-05-01");
  const { filmPage } = ui;
  await filmPage.goto(series.id);

  await filmPage.watchedAgainButton.click();

  const dialog = filmPage.logEntryDialog("MobLand");
  await expect(dialog.kindLabel("Watched again")).toBeVisible();
  await expect(dialog.revisitSwitch).not.toBeChecked();
  await expect(dialog.seriesRevisitHint).toBeVisible();
  await dialog.rate("5 stars");
  await dialog.save();
  await expect(filmPage.historyRows).toHaveCount(2);
  await expect(filmPage.historyRow(0).revisitBadge).toHaveCount(0);
  await expect(filmPage.historyRow(1).revisitBadge).toHaveCount(0);

  await filmPage.goto(film.id);
  await filmPage.watchedAgainButton.click();
  await expect(filmPage.logEntryDialog("Alien").revisitSwitch).toBeChecked();
});

test("the Series tile counts its tabs and fans out the Watchlist, and the tabs show each series once", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const chernobylItem = await chernobyl(api);
  const breakingBadItem = await breakingBad(api);
  const mobLandItem = await mobLand(api);
  await plan(api, mobLandItem.id, minutesAgo(30));
  await plan(api, chernobylItem.id, minutesAgo(10));
  await log(api, breakingBadItem.id, 3.5, "2013-09-30");
  await log(api, breakingBadItem.id, 5, "2024-01-15");
  const { savedPage, libraryPage } = ui;
  await savedPage.goto();

  // In the order Films, Books, Series, Games.
  await expect(savedPage.tiles).toHaveText([/^Films/, /^Books/, /^Series/, /^Games/, /^Albums/]);
  const tile = savedPage.tile("Series");
  await expect(tile.link).toHaveAccessibleDescription("2 to watch · 1 watched");
  await expect(tile.coverImages).toHaveCount(2);
  await tile.link.click();

  await expect(page).toHaveURL(libraryPage.path("Watchlist", "series"));
  await expect(page).toHaveTitle("Watchlist · Series · TasteTrack");
  await expect(libraryPage.heading).toHaveText("Series");
  await expect(libraryPage.tabs).toHaveText(["Watchlist2", "Watching0", "Watched1"]);
  // The latest added first, until sorted by the year each first aired, the latest first.
  await expect(libraryPage.posters("Watchlist")).toHaveText([
    /^Chernobyl\s*2019$/,
    /^MobLand\s*2025$/,
  ]);
  await libraryPage.choose("Sort", "First aired");
  await expect(libraryPage.posters("Watchlist")).toHaveText([/^MobLand/, /^Chernobyl/]);
  // No Genre chip: a series' genres aren't kept.
  await expect(libraryPage.chips).toHaveText(["First aired", "Decade"]);

  await libraryPage.tab("Watched").click();
  await expect(page).toHaveTitle("Watched · Series · TasteTrack");
  await expect(libraryPage.posters("Watched")).toHaveCount(1);
  await expect(libraryPage.poster("Watched", "Breaking Bad").rating("5 stars")).toBeVisible();
  await expect(libraryPage.chips).toHaveText(["Last watched", "Decade", "Rating"]);
  await expect(libraryPage.main).not.toContainText(otherWording);
});

test("a User picks Series in Collections, makes a Collection of series, fills, reorders, notes and shares it", async ({
  page,
  ui,
  loggedInUser: owner,
  loggedInApi: api,
  visitorPage,
  visitorUi,
}) => {
  await holdImages(visitorPage);
  await manualSeries(api, { title: "Спіймати Кайдаша", year: 2020 });
  const { listsPage, listPage } = ui;
  await listsPage.goto("series");

  await listsPage.newListButton.click();
  await expect(listsPage.newListDialog.root).toContainText(
    "Collect series around a theme, in the order you choose.",
  );
  await listsPage.newListDialog.nameInput.fill("Slow burners");
  await listsPage.newListDialog.createButton.click();
  await expect(listPage.heading("Slow burners")).toBeVisible();
  await listPage.addSeriesButton.click();
  const addSeries = listPage.addSeriesDialog("Slow burners");
  await expect(addSeries.searchBox).toHaveAttribute("placeholder", "Title in English or Ukrainian");
  await addSeries.add("Чорнобиль", "Чорнобиль (Chernobyl, 2019)");
  await addSeries.add("breaking bad", "Breaking Bad (2008)");
  // The User's own series come up too.
  await addSeries.add("кайдаш", "Спіймати Кайдаша (2020)");
  await addSeries.search("zzqx no such series");
  await expect(addSeries.root).toContainText("No series found for “zzqx no such series”.");
  await addSeries.doneButton.click();
  const items = listPage.items("Slow burners");
  await expect(items).toHaveCount(3);
  await expect(listPage.text("3 series")).toBeVisible();

  await listPage.act("Reorder series");
  await listPage.poster("Slow burners", "Breaking Bad").moveToTopButton.click();
  await listPage.doneButton.click();
  await listPage.choose("Slow burners", "Chernobyl", "Add a Note");
  await listPage.noteDialog("Chernobyl (2019)").saveNote("Five hours, no filler.");
  await page.reload();
  await expect(items).toHaveText([
    /Breaking Bad/,
    /Chernobyl.*Five hours, no filler\./,
    /Спіймати Кайдаша/,
  ]);

  await listPage.act("Share");
  const shareLinkDialog = listPage.shareLinkDialog("Slow burners");
  await shareLinkDialog.share();
  const url = await shareLinkDialog.readLink();
  const { sharedPage } = visitorUi;
  await visitorUi.goto(url);
  await expect(sharedPage.text("Series collection")).toBeVisible();
  await expect(sharedPage.text(`Shared by ${owner.username} · 3 series`)).toBeVisible();
  const chernobylItem = sharedPage.film("Slow burners", "Chernobyl");
  await expect(chernobylItem.root).toContainText("2019");
  await expect(chernobylItem.note("Five hours, no filler.")).toBeVisible();
  await expect(chernobylItem.root.locator("img")).toHaveAttribute(
    "src",
    posterUrl("/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg", "w500"),
  );
  await expect(sharedPage.main).not.toContainText(otherWording);
  await expect(sharedPage.inviteLine).toBeVisible();
});

test("a series TMDB doesn't have is added by hand with a title, an Original Title and a year", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage, filmPage } = ui;
  await searchPage.goto("кайдаш", "series");
  await expect(searchPage.noSeriesMessage).toHaveText("No series found for “кайдаш”.");

  await searchPage.addManuallyButton.click();
  const adding = searchPage.addSeriesManuallyDialog;
  await expect(adding.root).toContainText("For a series search doesn't find.");
  await expect(adding.minutesInput).toHaveCount(0);
  await expect(adding.authorsInput).toHaveCount(0);
  await adding.titleInput.fill("Спіймати Кайдаша");
  await adding.originalTitleInput.fill("Catch Kaidash");
  await adding.yearInput.fill("2020");
  await adding.addButton.click();

  await expect(adding.root).toBeHidden();
  const added = searchPage.searchResults.result("Спіймати Кайдаша (Catch Kaidash, 2020)");
  await expect(added.addedByYouLabel).toBeVisible();
  await searchPage.searchResults.link("Спіймати Кайдаша (Catch Kaidash, 2020)").click();
  await expect(page).toHaveURL(filmPage.anyPath);
  await expect(filmPage.heading).toHaveText("Спіймати Кайдаша (Catch Kaidash, 2020)");
  await expect(filmPage.text("You added this series manually. Only you can see it.")).toBeVisible();
  await expect(filmPage.editSeriesButton).toBeVisible();
  // Only the titles and year, which its heading says: no seasons or status.
  await expect(filmPage.main).not.toContainText(/season|Returning|Ended/);
  await expect(filmPage.main).not.toContainText(otherWording);

  // The same title and year again is warned of first.
  await searchPage.goto("кайдаш", "series");
  await searchPage.addManuallyButton.click();
  await adding.titleInput.fill("Спіймати Кайдаша");
  await adding.yearInput.fill("2020");
  await adding.addButton.click();
  await expect(adding.errorMessage).toHaveText(
    "You've already added a series with this title and year. Add another one anyway?",
  );
});

// Besides its User, this journey writes the series' Backlog item, and its Media Item and cache
// entry where no one has added it yet (ADR-0006).
test("search for a series and add it to the Watchlist", {
  tag: "@smoke",
}, async ({ page, loggedInUi: ui }) => {
  const { searchPage, savedPage, libraryPage } = ui;
  await searchPage.goto();
  await searchPage.mediaTypeChip("Series").click();
  await searchPage.search("Chernobyl");
  const result = searchPage.searchResults.result("Chernobyl (2019)");

  await result.wantToWatchButton.click();

  await expect(result.onWatchlistButton).toBeVisible();
  await searchPage.mainNav.link("Saved").click();
  const tile = savedPage.tile("Series");
  await expect(tile.link).toHaveAccessibleDescription("1 to watch · 0 watched");
  await tile.link.click();
  await expect(page).toHaveURL(libraryPage.path("Watchlist", "series"));
  await expect(libraryPage.posters("Watchlist")).toHaveText([/^Chernobyl\s*2019$/]);
});
