import type { MediaType } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { alien } from "../support/scenarios/films";
import {
  finalFantasy7,
  holdImages,
  manualGame,
  spiritGlaive,
  stalker,
  witcher3,
} from "../support/scenarios/games";
import { settledBoxOf as box } from "../support/ui/boxes";
import { expect, test } from "../support/ui/fixtures";

// Games in the UI (`docs/mockups/games/`). Locally the Worker searches an IGDB fake, whose games
// mirror IGDB as it was on 2026-11-19; their covers and art are IGDB's own images, which these
// tests never load.
test.beforeEach(async ({ page }) => {
  await holdImages(page);
});

// The words of a film, a book or a series no game screen may say.
const otherWording = /\bfilms?\b|\bbooks?\b|\bwatch|\bread/i;

async function plan(api: ApiClient, mediaItemId: number, time = minutesAgo(1)) {
  await expectBody(api.backlog.addBacklogItem({ mediaItemId }, at(time)), 201);
}

async function log(api: ApiClient, mediaItemId: number, rating: number, date: string) {
  await expectBody(api.log.createLogEntry({ mediaItemId, rating, date, revisit: false }), 201);
}

async function startPlaying(api: ApiClient, mediaItemId: number, startDate: string | null) {
  await expectBody(api.inProgress.start({ mediaItemId, startDate }), 201);
}

async function createList(api: ApiClient, name: string, mediaType: MediaType) {
  return (await expectBody(api.lists.createList({ name, mediaType }), 201)).list;
}

const phone = { width: 390, height: 844 };

for (const [device, viewport] of [
  ["desktop", null],
  ["a phone", phone],
] as const) {
  test(`on ${device}, the Games chip puts games in the address of Search and Collections, and a reload keeps it`, async ({
    page,
    loggedInUi: ui,
    loggedInApi: api,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await createList(api, "Space horror", "film");
    await createList(api, "Rainy weekend", "game");
    const { searchPage, listsPage } = ui;
    await searchPage.goto("witcher 3");

    await searchPage.mediaTypeChip("Games").click();

    await expect(page).toHaveURL(searchPage.path("witcher 3", "game"));
    await expect(searchPage.searchBox).toHaveAttribute("placeholder", "Title in English");
    await expect(searchPage.igdbHeading).toHaveText(/^From IGDB\s*\d+$/);
    await expect(searchPage.igdbResults.filmLabel("The Witcher 3: Wild Hunt")).toBeVisible();
    await page.reload();
    await expect(searchPage.currentChip("Games")).toBeVisible();
    await expect(searchPage.igdbResults.filmLabel("The Witcher 3: Wild Hunt")).toBeVisible();

    await listsPage.goto();
    await expect(listsPage.lists).toHaveText([/Space horror/]);
    await listsPage.gamesChip.click();
    await expect(page).toHaveURL(listsPage.path("game"));
    await expect(listsPage.lists).toHaveText([/Rainy weekend\s*0 games/]);
    await page.reload();
    await expect(listsPage.pressedChip).toHaveText("Games");
    await expect(listsPage.lists).toHaveText([/Rainy weekend/]);
  });
}

test("an empty field on Games asks for a game's English title", async ({ loggedInUi: ui }) => {
  const { searchPage } = ui;
  await searchPage.goto(undefined, "game");

  await expect(
    searchPage.text("Type a game's English title to search your Saved and IGDB."),
  ).toBeVisible();
  await expect(searchPage.currentChip("Games")).toBeVisible();
});

test("a game's row says its year and up to three platforms, PC first, then how many more", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;

  await searchPage.goto("witcher 3", "game");

  const witcher = searchPage.igdbResults.result("The Witcher 3: Wild Hunt");
  await expect(witcher.text("2015 · PC, PS4, PS5 +4")).toBeVisible();
  await expect(witcher.markPlayedButton).toBeVisible();
  await expect(witcher.wantToPlayButton).toBeVisible();
  await expect(witcher.addToListButton).toBeVisible();
  // One platform, written as IGDB abbreviates it.
  await searchPage.search("final fantasy vii");
  await expect(searchPage.igdbResults.resultWithText("2005 · famicom").root).toBeVisible();
  await expect(searchPage.igdbResults.resultWithText("1997 · PS1").root).toBeVisible();
  await expect(searchPage.main).not.toContainText(otherWording);
});

test("a Cyrillic query finds a game by IGDB's Russian name for it, and one that finds nothing suggests the English title", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  await searchPage.goto("сталкер", "game");

  await expect(
    searchPage.igdbResults.filmLabel("S.T.A.L.K.E.R.: Shadow of Chernobyl"),
  ).toBeVisible();

  await searchPage.search("відьмак");
  await expect(searchPage.noGamesMessage).toHaveText("No games found for “відьмак”.");
  await expect(searchPage.englishTitleHint).toBeVisible();
  await expect(searchPage.addManuallyButton).toBeVisible();
});

test("a game found in Search opens its page, with its art, its facts, About and the link to IGDB", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const game = await witcher3(api);
  const { searchPage, filmPage } = ui;
  await searchPage.goto("witcher 3", "game");

  await searchPage.igdbResults.link("The Witcher 3: Wild Hunt").click();

  await expect(page).toHaveURL(filmPage.path(game.id));
  // Its title has no year, which leads the facts line.
  await expect(filmPage.heading).toHaveText("The Witcher 3: Wild Hunt");
  await expect(filmPage.text("2015 · CD Projekt RED · PC, PS4, PS5 +4")).toBeVisible();
  await expect(page).toHaveTitle("The Witcher 3: Wild Hunt (2015) · TasteTrack");
  await expect(filmPage.pictureSource).toHaveAttribute("srcset", game.metadata.backdropUrls.large);
  await expect(filmPage.posterImage(game.metadata.coverUrls.large)).toBeVisible();
  await expect(filmPage.about.text(/^The Witcher 3: Wild Hunt is/)).toBeVisible();
  await expect(filmPage.about.creditLabels).toHaveText(["Genres"]);
  await expect(filmPage.about.creditNames).toHaveText(["Role-playing (RPG), Adventure"]);
  await expect(filmPage.igdbLink).toHaveAttribute("href", game.metadata.url);
  await expect(filmPage.igdbLink).toHaveAttribute("target", "_blank");
  // Before a first Played: Played, Want to play, Start playing and Add to collection, and an
  // empty History with Add a thought.
  await expect(filmPage.buttons).toHaveText([
    "More",
    "Played",
    "Want to play",
    "Start playing",
    "Add to collection",
    "Add a thought",
  ]);
  await expect(
    filmPage.text(
      "Mark it Played to keep the date, Rating and Review here, or add a thought at any time, even before you play.",
    ),
  ).toBeVisible();
  await expect(filmPage.main).not.toContainText(otherWording);
});

test("a game without art shows its cover blurred, and one without a cover a cover set in type with its developer", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const noArt = await finalFantasy7(api);
  const noCover = await spiritGlaive(api);
  const { filmPage } = ui;

  await filmPage.goto(noArt.id);
  await expect(filmPage.heading).toHaveText("Final Fantasy VII");
  await expect(filmPage.pictureSource).toHaveCount(0);
  await expect(filmPage.pictureImage).toHaveAttribute("src", noArt.metadata.coverUrls.large);

  await filmPage.goto(noCover.id);
  await expect(filmPage.heading).toHaveText("Spirit Glaive");
  await expect(filmPage.picture).toHaveCount(0);
  await expect(filmPage.noCoverPlaceholder).toHaveText("Spirit GlaiveAdamKruschwitz");
  await expect(filmPage.text("2017 · AdamKruschwitz · PC")).toBeVisible();
});

test("the Games tile counts its tabs and fans out the Backlog, and the tabs say Backlog, Playing and Played", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const witcher = await witcher3(api);
  const finalFantasy = await finalFantasy7(api);
  const stalkerItem = await stalker(api);
  await plan(api, finalFantasy.id, minutesAgo(30));
  await plan(api, witcher.id, minutesAgo(10));
  await log(api, stalkerItem.id, 4, "2008-03-20");
  await plan(api, (await alien(api)).id);
  const { savedPage, libraryPage } = ui;
  await savedPage.goto();

  await expect(savedPage.tiles).toHaveText([/^Films/, /^Books/, /^Series/, /^Games/]);
  const tile = savedPage.tile("Games");
  // Nothing is being played, so the tile says nothing of it.
  await expect(tile.link).toHaveAccessibleDescription("2 to play · 1 played");
  await expect(tile.coverImages).toHaveCount(2);
  await expect(tile.coverImages.first()).toHaveAttribute("src", witcher.metadata.coverUrls.large);
  await tile.link.click();

  await expect(page).toHaveURL(libraryPage.path("Backlog"));
  await expect(page).toHaveTitle("Backlog · Games · TasteTrack");
  await expect(libraryPage.heading).toHaveText("Games");
  await expect(libraryPage.tabs).toHaveText(["Backlog2", "Playing0", "Played1"]);
  // The latest added first.
  await expect(libraryPage.posters("Backlog")).toHaveText([
    /^The Witcher 3: Wild Hunt\s*2015$/,
    /^Final Fantasy VII\s*1997$/,
  ]);
  await libraryPage.tab("Played").click();
  await expect(page).toHaveURL(libraryPage.path("Played"));
  await expect(
    libraryPage.poster("Played", "S.T.A.L.K.E.R.: Shadow of Chernobyl").rating("4 stars"),
  ).toBeVisible();
  await libraryPage.tab("Playing").click();
  await expect(page).toHaveURL(libraryPage.path("Playing"));
  await expect(libraryPage.text("Games you start playing show up here.")).toBeVisible();
  await expect(libraryPage.main).not.toContainText(otherWording);
});

test("Start playing makes a game Playing, which Saved lists under Playing now, and Stop playing takes it off with no Log Entry", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const witcher = await witcher3(api);
  const stalkerItem = await stalker(api);
  await startPlaying(api, stalkerItem.id, "2026-11-03");
  await plan(api, witcher.id);
  const { filmPage, savedPage, libraryPage } = ui;
  await filmPage.goto(witcher.id);

  await filmPage.startPlayingButton.click();

  const card = filmPage.playingCard;
  await expect(card.root).toBeVisible();
  await expect(
    filmPage.toast.message("Started playing The Witcher 3: Wild Hunt (2015)."),
  ).toBeVisible();
  // While Playing, only Add to collection stays under the card.
  await expect(card.finishedButton).toBeVisible();
  await expect(filmPage.playedButton).toHaveCount(0);
  await expect(filmPage.onBacklogButton).toHaveCount(0);
  await expect(filmPage.startPlayingButton).toHaveCount(0);
  await expect(filmPage.addToListButton).toBeVisible();

  await savedPage.goto();
  await expect(savedPage.tile("Games").link).toHaveAccessibleDescription(
    "0 to play · 2 playing · 0 played",
  );
  await expect(savedPage.playingNowRows).toHaveText([
    /^The Witcher 3: Wild Hunt\s*CD Projekt RED · since /,
    /^S\.T\.A\.L\.K\.E\.R\.: Shadow of Chernobyl\s*GSC Game World · since Nov 3$/,
  ]);
  await savedPage.playingNowRows.first().getByRole("link").click();
  await expect(page).toHaveURL(filmPage.path(witcher.id));

  await card.stopPlayingButton.click();
  await expect(
    filmPage.toast.message("Stopped playing The Witcher 3: Wild Hunt (2015)."),
  ).toBeVisible();
  await expect(filmPage.startPlayingButton).toBeVisible();
  await expect(filmPage.historyRows).toHaveCount(0);

  await filmPage.goto(stalkerItem.id);
  await filmPage.playingCard.stopPlayingButton.click();
  await expect(filmPage.startPlayingButton).toBeVisible();
  await savedPage.goto();
  // With nothing left in the Library, the tile says so.
  await expect(savedPage.tile("Games").link).toHaveAccessibleDescription("Nothing saved yet.");
  await expect(savedPage.playingNow).toHaveCount(0);
  await libraryPage.goto("Playing");
  await expect(libraryPage.tabs).toHaveText(["Backlog0", "Playing0", "Played0"]);
});

test("Finished records a Log Entry and ends Playing, and a second Played starts as a Replay", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const witcher = await witcher3(api);
  await startPlaying(api, witcher.id, "2026-11-03");
  const { filmPage } = ui;
  await filmPage.goto(witcher.id);

  await filmPage.playingCard.finishedButton.click();
  const dialog = filmPage.logEntryDialog("The Witcher 3: Wild Hunt");
  await dialog.rate("5 stars");
  await dialog.save();

  await expect(filmPage.playingCard.root).toHaveCount(0);
  await expect(filmPage.historyRows).toHaveCount(1);
  await expect(filmPage.watchedStat).toHaveText("Once");
  await expect(filmPage.statNames).toHaveText(["Played", "Your rating", "First played"]);
  await expect(filmPage.startReplayingButton).toBeVisible();

  await filmPage.playedAgainButton.click();
  await expect(dialog.kindLabel("Played again")).toBeVisible();
  await expect(dialog.gameRevisitSwitch).toBeChecked();
  await dialog.rate("4.5 stars");
  await dialog.save();
  await expect(filmPage.historyRows).toHaveCount(2);
  await expect(filmPage.historyRow(0).gameRevisitBadge).toBeVisible();
  await expect(filmPage.historyRow(1).gameRevisitBadge).toHaveCount(0);
  await expect(filmPage.watchedStat).toHaveText("Twice");
});

test("a User picks Games in Collections, makes a Collection of games, fills it and shares it", async ({
  ui,
  loggedInUser: owner,
  loggedInApi: api,
  visitorPage,
  visitorUi,
}) => {
  await holdImages(visitorPage);
  await manualGame(api, { title: "Козаки 3", year: 2016 });
  const { listsPage, listPage } = ui;
  await listsPage.goto("game");

  await listsPage.newListButton.click();
  await expect(listsPage.newListDialog.root).toContainText(
    "Collect games around a theme, in the order you choose.",
  );
  await listsPage.newListDialog.nameInput.fill("Rainy weekend");
  await listsPage.newListDialog.createButton.click();
  await expect(listPage.heading("Rainy weekend")).toBeVisible();
  await listPage.addGamesButton.click();
  const addGames = listPage.addGamesDialog("Rainy weekend");
  await expect(addGames.searchBox).toHaveAttribute("placeholder", "Title in English");
  await addGames.add("witcher 3", "The Witcher 3: Wild Hunt");
  await addGames.add("сталкер", "S.T.A.L.K.E.R.: Shadow of Chernobyl");
  // The User's own games come up too.
  await addGames.add("козаки", "Козаки 3");
  await addGames.doneButton.click();
  await expect(listPage.items("Rainy weekend")).toHaveCount(3);
  await expect(listPage.text("3 games")).toBeVisible();

  await listPage.act("Share");
  const shareLinkDialog = listPage.shareLinkDialog("Rainy weekend");
  await shareLinkDialog.share();
  const url = await shareLinkDialog.readLink();
  const { sharedPage } = visitorUi;
  await visitorUi.goto(url);
  await expect(sharedPage.text("Game collection")).toBeVisible();
  await expect(sharedPage.text(`Shared by ${owner.username} · 3 games`)).toBeVisible();
  await expect(sharedPage.film("Rainy weekend", "The Witcher 3: Wild Hunt").root).toContainText(
    "2015",
  );
  await expect(sharedPage.main).not.toContainText(otherWording);
});

test("a game IGDB doesn't have is added by hand with a title, an Original Title and a year", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage, filmPage } = ui;
  await searchPage.goto("відьмак", "game");

  await searchPage.addManuallyButton.click();
  const adding = searchPage.addGameManuallyDialog;
  await expect(adding.root).toContainText("For a game search doesn't find.");
  await expect(adding.minutesInput).toHaveCount(0);
  await expect(adding.authorsInput).toHaveCount(0);
  await adding.titleInput.fill("Козаки 3");
  await adding.originalTitleInput.fill("Cossacks 3");
  await adding.yearInput.fill("2016");
  await adding.addButton.click();

  await expect(adding.root).toBeHidden();
  const added = searchPage.igdbResults.result("Козаки 3 (Cossacks 3)");
  await expect(added.addedByYouLabel).toBeVisible();
  await expect(added.text("2016")).toBeVisible();
  await searchPage.igdbResults.link("Козаки 3 (Cossacks 3)").click();
  await expect(page).toHaveURL(filmPage.anyPath);
  await expect(filmPage.heading).toHaveText("Козаки 3 (Cossacks 3)");
  await expect(filmPage.text("2016")).toBeVisible();
  await expect(filmPage.text("You added this game manually. Only you can see it.")).toBeVisible();
  await expect(filmPage.editGameButton).toBeVisible();
  await expect(filmPage.igdbLink).toHaveCount(0);
  await expect(filmPage.noCoverPlaceholder).toHaveText("Козаки 3");
});

test("on a phone a game's row has a larger cover, its page the art edge to edge, and Saved two tiles to a row", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const { searchPage, filmPage, savedPage } = ui;
  await page.setViewportSize(phone);
  await searchPage.goto("witcher 3", "game");

  const thumbnail = await box(searchPage.igdbResults.result("The Witcher 3: Wild Hunt").poster);
  expect([thumbnail.width, thumbnail.height]).toEqual([72, 108]);
  const witcher = await witcher3(api);
  await plan(api, witcher.id);
  // A long title in Playing now is cut, not widening the page.
  await startPlaying(api, (await stalker(api)).id, "2026-11-03");

  await filmPage.goto(witcher.id);
  const [picture, cover] = await Promise.all([
    box(filmPage.picture),
    box(filmPage.posterImage(witcher.metadata.coverUrls.large)),
  ]);
  expect([picture.x, picture.width]).toEqual([0, phone.width]);
  expect([cover.width, cover.height]).toEqual([104, 156]);

  await savedPage.goto();
  const [series, games] = await Promise.all([
    box(savedPage.tile("Series").root),
    box(savedPage.tile("Games").root),
  ]);
  expect(games.y).toBe(series.y);
  expect(games.x).toBeGreaterThan(series.x);
  await expect(savedPage.tile("Games").coverImages).toHaveCount(1);
  await expect(savedPage.playingNowRows).toHaveCount(1);
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBe(0);
});

test("IGDB is credited with a link, under Open Library's credit", async ({ ui }) => {
  const { loginPage } = ui;
  await loginPage.goto();

  await expect(loginPage.footer.text("Game data and covers from IGDB.")).toBeVisible();
  await expect(loginPage.footer.igdbLink).toHaveAttribute("href", "https://www.igdb.com/");
});

// Besides its User, this journey writes the game's Backlog item, and its Media Item and cache
// entry where no one has added it yet (ADR-0006). On staging it searches the real IGDB.
test("search for a game and add it to the Backlog", {
  tag: "@smoke",
}, async ({ page, loggedInUi: ui }) => {
  const { searchPage, savedPage, libraryPage } = ui;
  await searchPage.goto();
  await searchPage.mediaTypeChip("Games").click();
  await searchPage.search("The Witcher 3");
  const result = searchPage.igdbResults.result("The Witcher 3: Wild Hunt");

  await result.wantToPlayButton.click();

  await expect(result.onBacklogButton).toBeVisible();
  await searchPage.mainNav.link("Saved").click();
  const tile = savedPage.tile("Games");
  await expect(tile.link).toHaveAccessibleDescription("1 to play · 0 played");
  await tile.link.click();
  await expect(page).toHaveURL(libraryPage.path("Backlog"));
  await expect(libraryPage.posters("Backlog")).toHaveText([/^The Witcher 3: Wild Hunt\s*2015$/]);
});
