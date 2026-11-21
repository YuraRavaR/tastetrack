import type { MediaType } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import {
  abbeyRoad,
  abbeyRoadRemixId,
  album,
  callsRealMusicBrainz,
  jamala1944,
  manualAlbum,
  musicBrainzPage,
  zemlya,
  zemlyaId,
} from "../support/scenarios/albums";
import { alien } from "../support/scenarios/films";
import { withMusicBrainzBusy } from "../support/test-hooks-secret";
import { settledBoxOf as box } from "../support/ui/boxes";
import { expect, test } from "../support/ui/fixtures";

// Albums in the UI (`docs/mockups/albums/`). Locally the Worker searches a MusicBrainz fake, whose
// release groups mirror MusicBrainz as it was on 2026-11-21, and links covers from a Cover Art
// Archive fake, which answers 404 for an album without one, as the real archive does.

// The words of a film, a book, a series or a game no album screen may say.
const otherWording = /\bfilms?\b|\bbooks?\b|\bgames?\b|\bwatch|\bread|\bplay/i;

async function plan(api: ApiClient, mediaItemId: number, time = minutesAgo(1)) {
  await expectBody(api.backlog.addBacklogItem({ mediaItemId }, at(time)), 201);
}

async function log(api: ApiClient, mediaItemId: number, rating: number, date: string) {
  await expectBody(api.log.createLogEntry({ mediaItemId, rating, date, revisit: false }), 201);
}

async function createList(api: ApiClient, name: string, mediaType: MediaType) {
  return (await expectBody(api.lists.createList({ name, mediaType }), 201)).list;
}

// Abbey Road Remix, which the Cover Art Archive has no cover for.
const abbeyRoadRemix = (api: ApiClient) => album(api, "Abbey Road Beatles", abbeyRoadRemixId);

const phone = { width: 390, height: 844 };

for (const [device, viewport] of [
  ["desktop", null],
  ["a phone", phone],
] as const) {
  test(`on ${device}, the Albums chip puts albums in the address of Search and Collections, and a reload keeps it`, async ({
    page,
    loggedInUi: ui,
    loggedInApi: api,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await createList(api, "Space horror", "film");
    await createList(api, "Albums to start with Ukrainian rock", "album");
    const { searchPage, listsPage } = ui;
    await searchPage.goto("океан ельзи земля");

    await searchPage.mediaTypeChip("Albums").click();

    await expect(page).toHaveURL(searchPage.path("океан ельзи земля", "album"));
    await expect(searchPage.searchBox).toHaveAttribute("placeholder", "Album and artist");
    await expect(searchPage.musicBrainzHeading).toHaveText(/^From MusicBrainz\s*\d+$/);
    await expect(
      searchPage.musicBrainzResults.resultWithText("Океан Ельзи · 2013").root,
    ).toBeVisible();
    await page.reload();
    await expect(searchPage.currentChip("Albums")).toBeVisible();
    await expect(
      searchPage.musicBrainzResults.resultWithText("Океан Ельзи · 2013").root,
    ).toBeVisible();

    await listsPage.goto();
    await expect(listsPage.lists).toHaveText([/Space horror/]);
    await listsPage.albumsChip.click();
    await expect(page).toHaveURL(listsPage.path("album"));
    await expect(listsPage.lists).toHaveText([/Albums to start with Ukrainian rock\s*0 albums/]);
    await page.reload();
    await expect(listsPage.pressedChip).toHaveText("Albums");
    await expect(listsPage.lists).toHaveText([/Albums to start with Ukrainian rock/]);
  });
}

test("an empty field on Albums asks for an album and its artist", async ({ loggedInUi: ui }) => {
  const { searchPage } = ui;
  await searchPage.goto(undefined, "album");

  await expect(
    searchPage.text("Type an album and its artist to search your Saved and MusicBrainz."),
  ).toBeVisible();
  await expect(searchPage.currentChip("Albums")).toBeVisible();
});

test("an album's row says its artist, year and type, and one without a cover has its cover set in type", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;

  await searchPage.goto("beatles abbey road", "album");

  const results = searchPage.musicBrainzResults;
  // The plain studio album before the remix album, and the remix album's cover set in type.
  await expect(results.rows).toHaveText([/^Abbey Road\s*The Beatles · 1969/, /^Abbey Road Remix/]);
  const remix = results.result("Abbey Road Remix");
  await expect(remix.text("The Beatles · 2012 · Remix")).toBeVisible();
  await expect(remix.noCoverPlaceholder).toHaveText("Abbey Road RemixThe Beatles");
  const abbeyRoadRow = results.result("Abbey Road");
  await expect(abbeyRoadRow.poster).toHaveJSProperty("complete", true);
  await expect(abbeyRoadRow.markListenedButton).toBeVisible();
  await expect(abbeyRoadRow.wantToListenButton).toBeVisible();
  await expect(abbeyRoadRow.addToListButton).toBeVisible();
  // An EP, and an album as MusicBrainz credits two artists.
  await searchPage.search("1944 jamala");
  await expect(results.rows).toHaveText([
    /^1944\s*Jamala · 2016Mark/,
    /^1944\s*Jamala · 2016 · EPMark/,
  ]);
  await searchPage.search("dakhabrakha");
  await expect(
    results.result("The Bedouin Reworks Of Dakhabrakha").text("Bedouin, DakhaBrakha · 2022 · EP"),
  ).toBeVisible();
  await expect(searchPage.main).not.toContainText(otherWording);
});

test("an album in Saved comes first in Search, found by its title and artist together", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await log(api, (await abbeyRoad(api)).id, 5, "2024-05-12");
  const { searchPage } = ui;

  await searchPage.goto("beatles abbey road", "album");

  await expect(searchPage.userMediaItems.films).toHaveText([/^Abbey Road\s*5 · Listened$/]);
  await expect(searchPage.musicBrainzResults.rows).toHaveText([/^Abbey Road Remix/]);
});

test("a Cyrillic query finds an album in its own script, and one that finds nothing suggests adding the artist", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  await searchPage.goto("океан ельзи земля", "album");

  await expect(
    searchPage.musicBrainzResults.result("Земля").text("Океан Ельзи · 2013"),
  ).toBeVisible();

  await searchPage.search("Тиждень Вовчика");
  await expect(searchPage.noAlbumsMessage).toHaveText("No albums found for “Тиждень Вовчика”.");
  await expect(searchPage.artistHint).toBeVisible();
  await expect(searchPage.addManuallyButton).toBeVisible();
});

test("when MusicBrainz is busy, Search says so in place of its results, and Try again searches again", async ({
  page,
  loggedInUi: ui,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");
  const { searchPage } = ui;
  // Each search the page makes, until Try again, has MusicBrainz answer 503 twice: once, and
  // once more after the Worker's retry.
  const busy = withMusicBrainzBusy(2).headers;
  await page.route("**/api/catalog/search?**", (route) =>
    route.continue({ headers: { ...route.request().headers(), ...busy } }),
  );

  await searchPage.goto("1944 jamala", "album");

  await expect(searchPage.musicBrainzBusy).toBeVisible();
  await expect(searchPage.musicBrainzBusy).toContainText(
    "Nothing in your Saved matches “1944 jamala”.",
  );
  await expect(searchPage.musicBrainzResults.root).toHaveCount(0);
  await expect(searchPage.addManuallyButton).toBeVisible();

  await page.unroute("**/api/catalog/search?**");
  await searchPage.tryAgainButton.click();
  await expect(searchPage.musicBrainzBusy).toHaveCount(0);
  await expect(searchPage.musicBrainzResults.rows).toHaveCount(2);
});

test("an album found in Search opens its page, with its cover over a blurred copy, its facts and the link to MusicBrainz", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const zemlyaItem = await zemlya(api);
  const { searchPage, filmPage } = ui;
  await searchPage.goto("океан ельзи земля", "album");

  await searchPage.musicBrainzResults.link("Земля").click();

  await expect(page).toHaveURL(filmPage.path(zemlyaItem.id));
  // Its title has no year, which leads the facts line.
  await expect(filmPage.heading).toHaveText("Земля");
  await expect(filmPage.text("2013 · Океан Ельзи")).toBeVisible();
  await expect(page).toHaveTitle("Земля (2013) · TasteTrack");
  await expect(filmPage.pictureImage).toHaveAttribute("src", zemlyaItem.metadata.coverUrls.large);
  await expect(filmPage.pictureImage).toHaveCSS("filter", /blur/);
  const cover = filmPage.posterImage(zemlyaItem.metadata.coverUrls.large);
  const coverBox = await box(cover);
  expect(coverBox.width).toBe(coverBox.height);
  await expect(filmPage.musicBrainzLink).toHaveAttribute("href", musicBrainzPage(zemlyaId));
  await expect(filmPage.musicBrainzLink).toHaveAttribute("target", "_blank");
  await expect(filmPage.about.root).toHaveCount(0);
  // Before a first Listened: Listened, Want to listen and Add to collection, and an empty History
  // with Add a thought. An album is never In Progress.
  await expect(filmPage.buttons).toHaveText([
    "Listened",
    "Want to listen",
    "Add to collection",
    "Add a thought",
  ]);
  await expect(
    filmPage.text(
      "Mark it Listened to keep the date, Rating and Review here, or add a thought at any time, even before you listen.",
    ),
  ).toBeVisible();
  await expect(filmPage.main).not.toContainText(otherWording);
});

test("an album without a cover has no picture, and its cover set in type with its artist", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const remix = await abbeyRoadRemix(api);
  const { filmPage } = ui;

  await filmPage.goto(remix.id);

  await expect(filmPage.heading).toHaveText("Abbey Road Remix");
  await expect(filmPage.text("2012 · The Beatles · Remix")).toBeVisible();
  await expect(filmPage.noCoverPlaceholder).toHaveText("Abbey Road RemixThe Beatles");
  await expect(filmPage.picture).toHaveCount(0);
  const cover = await box(filmPage.noCoverPlaceholder);
  expect([cover.width, cover.height]).toEqual([176, 176]);
});

test("the Albums tile counts its tabs and fans out the Listening list, and the tabs say Listening list and Listened, with square covers", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const zemlyaItem = await zemlya(api);
  const jamalaItem = await jamala1944(api);
  const abbeyRoadItem = await abbeyRoad(api);
  await plan(api, zemlyaItem.id, minutesAgo(30));
  await plan(api, jamalaItem.id, minutesAgo(10));
  await log(api, abbeyRoadItem.id, 4.5, "2024-05-12");
  await plan(api, (await alien(api)).id);
  const { savedPage, libraryPage } = ui;
  await savedPage.goto();

  const tile = savedPage.tile("Albums");
  await expect(tile.link).toHaveAccessibleDescription("2 to listen · 1 listened");
  await expect(tile.coverImages).toHaveCount(2);
  await expect(tile.coverImages.first()).toHaveAttribute(
    "src",
    jamalaItem.metadata.coverUrls.large,
  );
  await tile.link.click();

  await expect(page).toHaveURL(libraryPage.path("Listening list"));
  await expect(page).toHaveTitle("Listening list · Albums · TasteTrack");
  await expect(libraryPage.heading).toHaveText("Albums");
  await expect(libraryPage.tabs).toHaveText(["Listening list2", "Listened1"]);
  // The latest added first, each with its artist.
  await expect(libraryPage.posters("Listening list")).toHaveText([
    /^1944\s*Jamala$/,
    /^Земля\s*Океан Ельзи$/,
  ]);
  const cover = await box(libraryPage.poster("Listening list", "Земля").posterImage);
  expect(cover.width).toBe(cover.height);
  await libraryPage.tab("Listened").click();
  await expect(page).toHaveURL(libraryPage.path("Listened"));
  const listened = libraryPage.poster("Listened", "Abbey Road");
  await expect(listened.root).toContainText("The Beatles");
  await expect(listened.rating("4.5 stars")).toBeVisible();
  await expect(libraryPage.main).not.toContainText(otherWording);
});

test("Want to listen puts an album on the Listening list, Listened takes it off, and a second Listened starts as a Relisten", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const zemlyaItem = await zemlya(api);
  const { filmPage } = ui;
  await filmPage.goto(zemlyaItem.id);

  await filmPage.wantToListenButton.click();
  await expect(filmPage.onListeningListButton).toBeVisible();

  await filmPage.listenedButton.click();
  const dialog = filmPage.logEntryDialog("Земля");
  await expect(dialog.root).toContainText("Saving takes it off your Listening list");
  await dialog.rate("4.5 stars");
  await dialog.save();

  await expect(filmPage.historyRows).toHaveCount(1);
  await expect(filmPage.wantToListenButton).toBeVisible();
  await expect(filmPage.watchedStat).toHaveText("Once");
  await expect(filmPage.statNames).toHaveText(["Listened", "Your rating", "First listened"]);

  await filmPage.listenedAgainButton.click();
  await expect(dialog.kindLabel("Listened again")).toBeVisible();
  await expect(dialog.albumRevisitSwitch).toBeChecked();
  await dialog.rate("5 stars");
  await dialog.save();
  await expect(filmPage.historyRows).toHaveCount(2);
  await expect(filmPage.historyRow(0).albumRevisitBadge).toBeVisible();
  await expect(filmPage.historyRow(1).albumRevisitBadge).toHaveCount(0);
  await expect(filmPage.watchedStat).toHaveText("Twice");
});

test("a User picks Albums in Collections, makes a Collection of albums with square covers, fills it and shares it", async ({
  ui,
  loggedInUser: owner,
  loggedInApi: api,
  visitorUi,
}) => {
  await manualAlbum(api, { title: "Тиждень Вовчика", year: 2024, authors: ["Вовчик"] });
  const { listsPage, listPage } = ui;
  await listsPage.goto("album");

  await listsPage.newListButton.click();
  await expect(listsPage.newListDialog.root).toContainText(
    "Collect albums around a theme, in the order you choose.",
  );
  await listsPage.newListDialog.nameInput.fill("Albums to start with Ukrainian rock");
  await listsPage.newListDialog.createButton.click();
  const listName = "Albums to start with Ukrainian rock";
  await expect(listPage.heading(listName)).toBeVisible();
  await listPage.addAlbumsButton.click();
  const addAlbums = listPage.addAlbumsDialog(listName);
  await expect(addAlbums.searchBox).toHaveAttribute("placeholder", "Album and artist");
  await addAlbums.add("океан ельзи земля", "Земля");
  await addAlbums.add("hollywood bowl", "The Beatles at the Hollywood Bowl");
  // The User's own albums come up too.
  await addAlbums.add("тиждень", "Тиждень Вовчика");
  await addAlbums.doneButton.click();
  await expect(listPage.items(listName)).toHaveCount(3);
  await expect(listPage.text("3 albums")).toBeVisible();
  await expect(listPage.items(listName).first()).toContainText("Океан Ельзи");
  const cover = await box(listPage.items(listName).first().locator("img"));
  expect(cover.width).toBe(cover.height);

  await listPage.act("Share");
  const shareLinkDialog = listPage.shareLinkDialog(listName);
  await shareLinkDialog.share();
  const url = await shareLinkDialog.readLink();
  const { sharedPage } = visitorUi;
  await visitorUi.goto(url);
  await expect(sharedPage.text("Album collection")).toBeVisible();
  await expect(sharedPage.text(`Shared by ${owner.username} · 3 albums`)).toBeVisible();
  await expect(sharedPage.film(listName, "Земля").root).toContainText("Океан Ельзи2013");
  await expect(sharedPage.main).not.toContainText(otherWording);
});

test("an album MusicBrainz doesn't have is added by hand with a title, a year and its artists", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage, filmPage } = ui;
  await searchPage.goto("Тиждень Вовчика", "album");

  await searchPage.addManuallyButton.click();
  const adding = searchPage.addAlbumManuallyDialog;
  await expect(adding.root).toContainText("For an album search doesn't find.");
  await expect(adding.minutesInput).toHaveCount(0);
  await expect(adding.authorsInput).toHaveCount(0);
  await expect(adding.titleInput).toHaveValue("Тиждень Вовчика");
  await adding.yearInput.fill("2024");
  await adding.artistsInput.fill("Вовчик, Сірко");
  await adding.addButton.click();

  await expect(adding.root).toBeHidden();
  const added = searchPage.musicBrainzResults.result("Тиждень Вовчика");
  await expect(added.addedByYouLabel).toBeVisible();
  await expect(added.text("Вовчик, Сірко · 2024")).toBeVisible();
  await searchPage.musicBrainzResults.link("Тиждень Вовчика").click();
  await expect(page).toHaveURL(filmPage.anyPath);
  await expect(filmPage.heading).toHaveText("Тиждень Вовчика");
  await expect(filmPage.text("2024 · Вовчик, Сірко")).toBeVisible();
  await expect(filmPage.text("You added this album manually. Only you can see it.")).toBeVisible();
  await expect(filmPage.musicBrainzLink).toHaveCount(0);
  await expect(filmPage.noCoverPlaceholder).toHaveText("Тиждень ВовчикаВовчик, Сірко");

  await filmPage.editAlbumButton.click();
  await expect(filmPage.editFilmDialog("Тиждень Вовчика").artistsInput).toHaveValue(
    "Вовчик, Сірко",
  );
});

test("on a phone an album's row has a square cover, its page the cover edge to edge with no blur, and Saved Albums in a wide tile under the 2×2 grid", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const { searchPage, filmPage, savedPage } = ui;
  await page.setViewportSize(phone);
  await searchPage.goto("океан ельзи земля", "album");

  const thumbnail = await box(searchPage.musicBrainzResults.result("Земля").poster);
  expect([thumbnail.width, thumbnail.height]).toEqual([72, 72]);
  const zemlyaItem = await zemlya(api);
  await plan(api, zemlyaItem.id);

  await filmPage.goto(zemlyaItem.id);
  const picture = await box(filmPage.picture);
  expect([picture.x, picture.width, picture.height]).toEqual([0, phone.width, phone.width]);
  await expect(filmPage.pictureImage).not.toHaveCSS("filter", /blur/);
  // The picture is the cover, so it isn't shown again beside the title.
  await expect(filmPage.posterImage(zemlyaItem.metadata.coverUrls.large)).toBeHidden();
  await expect(filmPage.musicBrainzLink).toBeVisible();

  await savedPage.goto();
  const [films, games, albums] = await Promise.all([
    box(savedPage.tile("Films").root),
    box(savedPage.tile("Games").root),
    box(savedPage.tile("Albums").root),
  ]);
  expect(albums.y).toBeGreaterThan(games.y);
  expect(albums.x).toBe(films.x);
  expect(albums.x + albums.width).toBe(games.x + games.width);
  await expect(savedPage.tile("Albums").coverImages).toHaveCount(1);
  await searchPage.goto(undefined, "album");
  const chips = await Promise.all(
    (["Films", "Books", "Series", "Games", "Albums"] as const).map((name) =>
      box(searchPage.mediaTypeChip(name)),
    ),
  );
  for (const chip of chips) expect(chip.width).toBeCloseTo(chips[0]?.width ?? 0, 0);
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBe(0);
});

test("MusicBrainz is credited with a link, under IGDB's credit", async ({ ui }) => {
  const { loginPage } = ui;
  await loginPage.goto();

  await expect(loginPage.footer.text("Album data from MusicBrainz.")).toBeVisible();
  await expect(loginPage.footer.musicBrainzLink).toHaveAttribute(
    "href",
    "https://musicbrainz.org/",
  );
});

// Besides its User, this journey writes the album's Backlog item, and its Media Item and cache
// entry where no one has added it yet (ADR-0006). On staging it searches the real MusicBrainz.
test("search for an album and add it to the Listening list", {
  tag: "@smoke",
}, async ({ page, loggedInUi: ui }) => {
  const { searchPage, savedPage, libraryPage } = ui;
  await searchPage.goto();
  await searchPage.mediaTypeChip("Albums").click();
  await searchPage.search("Океан Ельзи Земля");
  const result = searchPage.musicBrainzResults.resultWithText("Океан Ельзи · 2013");

  await result.wantToListenButton.click();

  await expect(result.onListeningListButton).toBeVisible();
  await searchPage.mainNav.link("Saved").click();
  const tile = savedPage.tile("Albums");
  await expect(tile.link).toHaveAccessibleDescription("1 to listen · 0 listened");
  await tile.link.click();
  await expect(page).toHaveURL(libraryPage.path("Listening list"));
  await expect(libraryPage.posters("Listening list")).toHaveText([/^Земля\s*Океан Ельзи$/]);
});
