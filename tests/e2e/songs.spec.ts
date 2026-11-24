import type { MediaType } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { callsRealMusicBrainz, manualAlbum } from "../support/scenarios/albums";
import {
  karmaPolice,
  manualSong,
  obiimy,
  obiimyId,
  recordingPage,
  shum,
} from "../support/scenarios/songs";
import { settledBoxOf as box } from "../support/ui/boxes";
import { expect, test } from "../support/ui/fixtures";

// Songs in the UI (`docs/mockups/songs/`). A song lives only in Collections (ADR-0005). The
// browser searches MusicBrainz for songs, which locally the `musicBrainz` fixture sends to the
// Worker's MusicBrainz fake, whose recordings mirror MusicBrainz as it was on 2026-11-22, and
// covers to a Cover Art Archive fake, which answers 404 for a release group without one, as the
// real archive does.

// The words of the Library no song screen may say: a song is never Planned, logged or started.
const libraryWording = /want to|listened|listening list|history|add a thought|saved/i;

async function createList(api: ApiClient, name: string, mediaType: MediaType) {
  return (await expectBody(api.lists.createList({ name, mediaType }), 201)).list;
}

async function addToList(api: ApiClient, listId: number, mediaItemId: number, minutes = 1) {
  await expectBody(api.lists.addListItem(listId, { mediaItemId }, at(minutesAgo(minutes))), 201);
}

const phone = { width: 390, height: 844 };

for (const [device, viewport] of [
  ["desktop", null],
  ["a phone", phone],
] as const) {
  test(`on ${device}, the Songs chip puts songs in the address of Search and Collections, and Saved has no Songs tile`, async ({
    page,
    loggedInUi: ui,
    loggedInApi: api,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await createList(api, "Albums to start with", "album");
    await createList(api, "For the road", "song");
    const { searchPage, listsPage, savedPage } = ui;
    await searchPage.goto("Обійми Океан Ельзи");

    await searchPage.mediaTypeChip("Songs").click();

    await expect(page).toHaveURL(searchPage.path("Обійми Океан Ельзи", "song"));
    await expect(searchPage.searchBox).toHaveAttribute("placeholder", "Song and artist");
    await expect(searchPage.musicBrainzHeading).toHaveText(/^From MusicBrainz\s*\d+$/);
    await expect(
      searchPage.musicBrainzResults.result("Обійми", "Океан Ельзи · 2013 · from Земля").root,
    ).toBeVisible();
    await page.reload();
    await expect(searchPage.currentChip("Songs")).toBeVisible();

    await listsPage.goto();
    await listsPage.songsChip.click();
    await expect(page).toHaveURL(listsPage.path("song"));
    await expect(listsPage.lists).toHaveText([/For the road\s*0 songs/]);
    await page.reload();
    await expect(listsPage.pressedChip).toHaveText("Songs");

    await savedPage.goto();
    await expect(savedPage.tiles).toHaveText([/^Films/, /^Books/, /^Series/, /^Games/, /^Albums/]);
  });
}

test("an empty field on Songs asks for a song and its artist", async ({ loggedInUi: ui }) => {
  const { searchPage } = ui;
  await searchPage.goto(undefined, "song");

  await expect(
    searchPage.text("Type a song and its artist to search your Collections and MusicBrainz."),
  ).toBeVisible();
  await expect(searchPage.currentChip("Songs")).toBeVisible();
});

test("a song's row says its artist, year and album, its disambiguation quietly, and has one button", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;

  await searchPage.goto("Karma Police Radiohead", "song");

  const results = searchPage.musicBrainzResults;
  const karma = results.result("Karma Police", "Radiohead · 1997 · from OK Computer");
  await expect(karma.poster).toHaveJSProperty("complete", true);
  // One button: no Planned bookmark and no Mark listened, as a song is only collected.
  await expect(karma.actionButtons).toHaveText(["Add to collection"]);
  await expect(karma.wantToListenButton).toHaveCount(0);
  // A cover the Cover Art Archive doesn't have is the note.
  const cover = results.result("Karma Police (Radiohead cover)");
  await expect(cover.noCoverPlaceholder).toBeVisible();
  await expect(cover.noCoverPlaceholder).toHaveText("");

  await searchPage.search("Шум Go_A");
  const original = results.result("Шум");
  await expect(original.text("Go_A · 2021")).toBeVisible();
  await expect(original.text("original version")).toHaveCSS("font-style", "italic");
  await expect(searchPage.main).not.toContainText(libraryWording);
});

test("a song search that finds nothing suggests adding the artist, with Add manually", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;

  await searchPage.goto("Стефанія", "song");

  await expect(searchPage.noSongsMessage).toHaveText("No songs found for “Стефанія”.");
  await expect(searchPage.songArtistHint).toBeVisible();
  await expect(searchPage.addManuallyButton).toBeVisible();
});

test("a song search is made on MusicBrainz from the browser, never on the Worker", async ({
  page,
  loggedInUi: ui,
}) => {
  const asked: string[] = [];
  page.on("request", (request) => asked.push(new URL(request.url()).pathname));
  const { searchPage } = ui;

  await searchPage.goto("Karma Police Radiohead", "song");

  await expect(
    searchPage.musicBrainzResults.result("Karma Police", "Radiohead · 1997 · from OK Computer")
      .root,
  ).toBeVisible();
  expect(asked).toContain("/ws/2/recording/");
  expect(asked).toContain("/api/catalog/search/marks");
  expect(asked).not.toContain("/api/catalog/search");
});

test("a song search MusicBrainz answers 503 is asked again a second later, and finds its songs", async ({
  loggedInUi: ui,
  musicBrainz,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");
  musicBrainz.busy(1);
  const { searchPage } = ui;

  await searchPage.goto("Шум Go_A", "song");

  await expect(searchPage.musicBrainzResults.result("Шум").root).toBeVisible();
  await expect(searchPage.musicBrainzBusy).toHaveCount(0);
});

test("when MusicBrainz is busy, a song search says so and names Collections", async ({
  loggedInUi: ui,
  musicBrainz,
}) => {
  test.skip(callsRealMusicBrainz(), "Only the MusicBrainz fake can be made busy");
  musicBrainz.busy(2);
  const { searchPage } = ui;

  await searchPage.goto("Шум Go_A", "song");

  await expect(searchPage.musicBrainzBusy).toContainText(
    "Nothing in your Collections matches “Шум Go_A”.",
  );
  // The fake's two 503s are spent, so asking again finds the song.
  await searchPage.tryAgainButton.click();
  await expect(searchPage.musicBrainzResults.result("Шум").root).toBeVisible();
});

test("a song another User added links to its page from Search, and one in the User's Collection comes under In your Collections", async ({
  loggedInUi: ui,
  loggedInApi: api,
  otherUserClient,
}) => {
  const shumItem = await shum(otherUserClient);
  const karmaPoliceItem = await karmaPolice(api);
  const road = await createList(api, "For the road", "song");
  await addToList(api, road.id, karmaPoliceItem.id);
  const { searchPage, filmPage } = ui;

  await searchPage.goto("Шум Go_A", "song");

  // In the catalog already, so its row opens its page as it is.
  await expect(searchPage.musicBrainzResults.link("Шум")).toHaveAttribute(
    "href",
    filmPage.path(shumItem.id),
  );
  await searchPage.search("Karma Police Radiohead");
  await expect(searchPage.collectionsMatches.films).toHaveText([
    /^Karma Police\s*Radiohead\s*For the road$/,
  ]);
});

test("a song search shows the User's own manual songs for the query before MusicBrainz's", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await manualSong(api, { title: "Обійми (демо)", authors: ["Сусідський Квас"] });
  const { searchPage } = ui;

  await searchPage.goto("Обійми", "song");

  const results = searchPage.musicBrainzResults;
  await expect(results.result("Обійми (демо)").addedByYouLabel).toBeVisible();
  await expect(results.result("Обійми", "Океан Ельзи · 2013 · from Земля").root).toBeVisible();
  await expect(results.rows.first()).toContainText("Обійми (демо)");
});

test("Add to collection from Search puts a song in a Collection of songs, the last used first, and a song kept comes first in Search", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const karmaPoliceItem = await karmaPolice(api);
  await createList(api, "Albums to start with", "album");
  const favourites = await createList(api, "Favourite songs", "song");
  const road = await createList(api, "For the road", "song");
  await addToList(api, favourites.id, karmaPoliceItem.id, 30);
  await addToList(api, road.id, karmaPoliceItem.id, 10);
  const { searchPage } = ui;
  await searchPage.goto("Обійми Океан Ельзи", "song");

  await searchPage.musicBrainzResults.result("Обійми", "from Земля").addToListButton.click();

  // Only Collections of songs, For the road first, as it was added to last.
  const dialog = searchPage.filmListsDialog("Обійми (2013)");
  await expect(dialog.root).toContainText(
    "Tick a Collection to add the song, untick it to take the song off.",
  );
  await expect(dialog.checkboxes).toHaveCount(2);
  await expect(dialog.rows).toHaveText(["For the road", "Favourite songs"]);
  await expect(dialog.newListButton).toBeVisible();
  // The whole row toggles.
  await dialog.text("Favourite songs").click();
  await expect(dialog.checkbox("Favourite songs")).toBeChecked();
  // The order doesn't move as the User ticks.
  await expect(dialog.rows).toHaveText(["For the road", "Favourite songs"]);
  await dialog.done();

  // Kept songs load again once the query changes.
  await searchPage.search("Обійми");
  await expect(searchPage.collectionsMatches.films).toHaveText([
    /^Обійми\s*Океан Ельзи\s*Favourite songs$/,
  ]);
});

test("the picker makes a Collection of songs in place, with the song in it, and says which type has a taken name", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await createList(api, "Ukrainian rock", "album");
  const road = await createList(api, "For the road", "song");
  await shum(api);
  const { searchPage, listsPage } = ui;
  await searchPage.goto("Шум Go_A", "song");
  await searchPage.musicBrainzResults.result("Шум").addToListButton.click();
  const dialog = searchPage.filmListsDialog("Шум (2021)");

  await dialog.newListButton.click();
  await expect(dialog.root).toHaveAccessibleName("New collection");
  await expect(dialog.nameInput).toHaveAttribute("placeholder", "Favourite songs");
  await dialog.nameInput.fill("Ukrainian rock");
  await dialog.createAndAddButton.click();
  await expect(dialog.errorMessage).toHaveText(
    "You already have a Collection of albums with this name.",
  );
  await dialog.backButton.click();
  await expect(dialog.checkboxes).toHaveCount(1);
  await dialog.newListButton.click();
  await dialog.createAndAdd("Late night");

  // The new one first and ticked, the other as it was.
  await expect(dialog.rows).toHaveText(["Late night", "For the road"]);
  await expect(dialog.checkbox("Late night")).toBeChecked();
  await expect(dialog.checkbox("For the road")).not.toBeChecked();
  await dialog.done();
  await listsPage.goto("song");
  await expect(listsPage.card("Late night").root).toContainText("1 song");
  await expect(listsPage.card(road.name).root).toContainText("0 songs");
});

test("with no Collection of songs, the picker offers to make one at once", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await createList(api, "Albums to start with", "album");
  const obiimyItem = await obiimy(api);
  const { filmPage } = ui;
  await filmPage.goto(obiimyItem.id);

  await filmPage.addToListButton.click();

  const dialog = filmPage.filmListsDialog("Обійми (2013)");
  await expect(
    dialog.text("You have no Collections of songs yet. Make one, and this song goes into it."),
  ).toBeVisible();
  await expect(dialog.backButton).toHaveCount(0);
  await dialog.createAndAdd("Favourite songs");
  await expect(dialog.checkbox("Favourite songs")).toBeChecked();
  await dialog.done();
  await expect(filmPage.collectionRows).toHaveText([/^Favourite songs\s*1 song$/]);
});

test("a song's page has its cover over a blurred copy, its facts, the link to MusicBrainz and its Collections, and no History, Thoughts or Planned", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const [obiimyItem, karmaPoliceItem] = [await obiimy(api), await karmaPolice(api)];
  const favourites = await createList(api, "Favourite songs", "song");
  const road = await createList(api, "For the road", "song");
  await addToList(api, road.id, karmaPoliceItem.id, 30);
  await addToList(api, favourites.id, obiimyItem.id, 20);
  await addToList(api, road.id, obiimyItem.id, 10);
  const { filmPage, listPage } = ui;

  await filmPage.goto(obiimyItem.id);

  await expect(filmPage.heading).toHaveText("Обійми");
  await expect(filmPage.text("2013 · Океан Ельзи · from Земля")).toBeVisible();
  await expect(page).toHaveTitle("Обійми (2013) · TasteTrack");
  await expect(filmPage.pictureImage).toHaveCSS("filter", /blur/);
  const cover = await box(filmPage.posterImage(obiimyItem.metadata.coverUrls.large));
  const main = await box(filmPage.main);
  expect(cover.width).toBe(cover.height);
  // Centred from sm.
  expect(cover.x + cover.width / 2).toBeCloseTo(main.x + main.width / 2, 0);
  await expect(filmPage.musicBrainzLink).toHaveAttribute("href", recordingPage(obiimyId));
  await expect(filmPage.musicBrainzLink).toHaveAttribute("target", "_blank");
  // The artist in the facts line opens their page (`docs/mockups/artists/`).
  await expect(filmPage.buttons).toHaveText(["Океан Ельзи", "Add to collection"]);
  await expect(filmPage.historyHeading).toHaveCount(0);
  await expect(filmPage.about.root).toHaveCount(0);
  // The Collection last added to first, each with its first cover and its count.
  await expect(filmPage.collectionRows).toHaveText([
    /^For the road\s*2 songs$/,
    /^Favourite songs\s*1 song$/,
  ]);
  await expect(filmPage.collectionCover("For the road")).toHaveAttribute(
    "src",
    karmaPoliceItem.metadata.coverUrls.small,
  );
  await expect(filmPage.main).not.toContainText(libraryWording);
  await filmPage.collectionRows.first().click();
  await expect(page).toHaveURL(listPage.path(road.id));
});

test("a song in no Collection says so, and one without a cover shows the note", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const garage = await manualSong(api, { title: "Пісня з гаража", authors: ["Сусідський Квас"] });
  const { filmPage } = ui;

  await filmPage.goto(garage.id);

  await expect(filmPage.notInCollectionsMessage).toBeVisible();
  await expect(filmPage.picture).toHaveCount(0);
  const note = await box(filmPage.noCoverPlaceholder);
  expect([note.width, note.height]).toEqual([176, 176]);
});

test("on a phone a song's row has a square cover and its button under the words, and its page the cover edge to edge with no blur", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await page.setViewportSize(phone);
  const { searchPage, filmPage } = ui;
  await searchPage.goto("Обійми Океан Ельзи", "song");

  const row = searchPage.musicBrainzResults.result("Обійми", "from Земля");
  const [thumbnail, button] = await Promise.all([box(row.poster), box(row.addToListButton)]);
  expect([thumbnail.width, thumbnail.height]).toEqual([72, 72]);
  expect(button.height).toBe(44);
  const obiimyItem = await obiimy(api);

  await filmPage.goto(obiimyItem.id);
  const picture = await box(filmPage.picture);
  expect([picture.x, picture.width, picture.height]).toEqual([0, phone.width, phone.width]);
  await expect(filmPage.pictureImage).not.toHaveCSS("filter", /blur/);
  await expect(filmPage.posterImage(obiimyItem.metadata.coverUrls.large)).toBeHidden();
  const add = await box(filmPage.addToListButton);
  expect(add.height).toBe(48);
  await expect(filmPage.backLink).toHaveAttribute("href", "/collections?type=song");

  // Seven chips fit a 320 px phone without a sideways scroll (`docs/mockups/artists/`).
  await page.setViewportSize({ width: 320, height: 640 });
  await searchPage.goto(undefined, "song");
  await expect(searchPage.mediaTypeChip("Songs")).toHaveCSS("font-size", "11px");
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBe(0);
});

test("a song MusicBrainz doesn't have is added by hand with its artists and no year, and put in a Collection", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await manualAlbum(api, { title: "Записи з гаража", year: 2009, authors: ["Сусідський Квас"] });
  const { searchPage, filmPage, listsPage } = ui;
  await searchPage.goto("Пісня з гаража", "song");

  await searchPage.addManuallyButton.click();
  const adding = searchPage.addSongManuallyDialog;
  await expect(adding.root).toContainText("For a song search doesn't find.");
  await expect(adding.titleInput).toHaveValue("Пісня з гаража");
  await adding.artistsInput.fill("Сусідський Квас");
  await adding.addButton.click();

  await expect(adding.root).toBeHidden();
  const added = searchPage.musicBrainzResults.result("Пісня з гаража");
  await expect(added.addedByYouLabel).toBeVisible();
  await expect(added.text("Сусідський Квас")).toBeVisible();
  await searchPage.musicBrainzResults.link("Пісня з гаража").click();
  await expect(page).toHaveURL(filmPage.anyPath);
  await expect(filmPage.text("You added this song manually. Only you can see it.")).toBeVisible();
  await expect(filmPage.musicBrainzLink).toHaveCount(0);
  await expect(filmPage.editSongButton).toBeVisible();
  await expect(filmPage.deleteSongButton).toBeVisible();

  await filmPage.addToListButton.click();
  const dialog = filmPage.filmListsDialog("Пісня з гаража");
  await dialog.createAndAdd("Songs to show a friend");
  await dialog.done();
  await expect(filmPage.collectionRows).toHaveText([/^Songs to show a friend\s*1 song$/]);

  await filmPage.deleteSongButton.click();
  const confirm = filmPage.deleteFilmDialog("Пісня з гаража");
  await expect(confirm.root).toContainText("It will be removed from 1 Collection.");
  await expect(confirm.root).not.toContainText(/Log Entr|list/);
  await confirm.confirm("Delete");
  await expect(page).toHaveURL(listsPage.path("song"));
});

test("a User makes a Collection of songs with square covers, fills it and shares it", async ({
  ui,
  loggedInUser: owner,
  loggedInApi: api,
  visitorUi,
}) => {
  await manualSong(api, { title: "Пісня з гаража", year: 2009, authors: ["Сусідський Квас"] });
  const { listsPage, listPage } = ui;
  await listsPage.goto("song");

  await expect(
    listsPage.text("Gather songs into Collections, like Favourite songs or For the road"),
  ).toBeVisible();
  await listsPage.emptyStateNewListButton.click();
  await listsPage.newListDialog.nameInput.fill("For the road");
  await listsPage.newListDialog.createButton.click();
  await expect(listPage.heading("For the road")).toBeVisible();
  await expect(listPage.text("This Collection is empty.")).toBeVisible();
  await listPage.addSongsButton.click();
  const addSongs = listPage.addSongsDialog("For the road");
  await expect(addSongs.searchBox).toHaveAttribute("placeholder", "Song and artist");
  await addSongs.add("Обійми Океан Ельзи", "Обійми");
  await addSongs.add("гаража", "Пісня з гаража");
  await addSongs.doneButton.click();
  await expect(listPage.items("For the road")).toHaveCount(2);
  await expect(listPage.text("2 songs")).toBeVisible();
  await expect(listPage.items("For the road").first()).toContainText("Океан Ельзи");
  const cover = await box(listPage.poster("For the road", "Обійми").posterImage);
  expect(cover.width).toBe(cover.height);
  await expect(listPage.poster("For the road", "Пісня з гаража").typesetCover).toBeVisible();

  await listPage.act("Share");
  const shareLinkDialog = listPage.shareLinkDialog("For the road");
  await shareLinkDialog.share();
  const url = await shareLinkDialog.readLink();
  const { sharedPage } = visitorUi;
  await visitorUi.goto(url);
  await expect(sharedPage.text("Song collection")).toBeVisible();
  await expect(sharedPage.text(`Shared by ${owner.username} · 2 songs`)).toBeVisible();
  await expect(sharedPage.film("For the road", "Обійми").root).toContainText("Океан Ельзи2013");
});

// Besides its User, this journey writes one List and one List Item, and the song's Media Item and
// cache entry where no one has added it yet (ADR-0006). On staging it searches the real
// MusicBrainz: no other smoke test covers the recording search.
test("search for a song and add it to a Collection", {
  tag: "@smoke",
}, async ({ page, loggedInUi: ui }) => {
  const { searchPage, listsPage, listPage } = ui;
  await searchPage.goto();
  await searchPage.mediaTypeChip("Songs").click();
  await searchPage.search("Обійми Океан Ельзи");
  // By its title and artist alone: real MusicBrainz may change a year or an album.
  const result = searchPage.musicBrainzResults.result("Обійми", "Океан Ельзи");

  await result.addToListButton.click();
  await searchPage.filmListsDialog("Обійми (2013)").createAndAdd("Favourite songs");

  await expect(
    searchPage.filmListsDialog("Обійми (2013)").checkbox("Favourite songs"),
  ).toBeChecked();
  await searchPage.filmListsDialog("Обійми (2013)").done();
  await searchPage.mainNav.link("Collections").click();
  await listsPage.songsChip.click();
  await listsPage.listLink("Favourite songs").click();
  await expect(page).toHaveURL(/\/collections\/\d+$/);
  await expect(listPage.items("Favourite songs")).toHaveText([/^1?Обійми\s*Океан Ельзи/]);
});
