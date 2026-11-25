import type { MediaType } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import {
  album,
  bedouinReworksId,
  callsRealMusicBrainz,
  manualAlbum,
  zemlya,
} from "../support/scenarios/albums";
import {
  artist,
  artistPage,
  manualArtist,
  nirvanaUkId,
  okeanElzy,
  okeanElzyId,
  radiohead,
} from "../support/scenarios/artists";
import { obiimy } from "../support/scenarios/songs";
import { withMusicBrainzBusy } from "../support/test-hooks-secret";
import { settledBoxOf as box } from "../support/ui/boxes";
import { expect, test } from "../support/ui/fixtures";

// Artists in the UI (`docs/mockups/artists/`). An artist lives only in Collections (ADR-0005).
// Locally the Worker searches and looks up artists on a MusicBrainz fake, and their photos on a
// Wikimedia fake, both mirroring the real answers of 2026-11-24; the fake's Commons serves each
// photo as a grey image wider than it is tall, as groups' photos are.

// The words of the Library no artist screen may say: an artist is never Planned, logged or
// started, and has no History.
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
  test(`on ${device}, the Artists chip puts artists in the address of Search and Collections, and Saved has no Artists tile`, async ({
    page,
    loggedInUi: ui,
    loggedInApi: api,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await createList(api, "For the road", "song");
    await createList(api, "Bands to show a friend", "artist");
    const { searchPage, listsPage, savedPage } = ui;
    await searchPage.goto("Океан Ельзи");

    await searchPage.mediaTypeChip("Artists").click();

    await expect(page).toHaveURL(searchPage.path("Океан Ельзи", "artist"));
    await expect(searchPage.mediaTypeChipButtons).toHaveText([
      "Films",
      "Books",
      "Series",
      "Games",
      "Albums",
      "Songs",
      "Artists",
    ]);
    await expect(searchPage.searchBox).toHaveAttribute("placeholder", "Artist or band");
    await expect(searchPage.musicBrainzHeading).toHaveText(/^From MusicBrainz\s*\d+$/);
    await expect(
      searchPage.musicBrainzResults.result("Океан Ельзи", "Group · Ukraine · 1994–").root,
    ).toBeVisible();
    await page.reload();
    await expect(searchPage.currentChip("Artists")).toBeVisible();

    await listsPage.goto();
    await listsPage.artistsChip.click();
    await expect(page).toHaveURL(listsPage.path("artist"));
    await expect(listsPage.lists).toHaveText([/Bands to show a friend\s*0 artists/]);
    await page.reload();
    await expect(listsPage.pressedChip).toHaveText("Artists");

    await savedPage.goto();
    await expect(savedPage.tiles).toHaveText([/^Films/, /^Books/, /^Series/, /^Games/, /^Albums/]);
  });
}

test("an empty field on Artists asks for an artist or a band", async ({ loggedInUi: ui }) => {
  const { searchPage } = ui;
  await searchPage.goto(undefined, "artist");

  await expect(
    searchPage.text("Type an artist or band to search your Collections and MusicBrainz."),
  ).toBeVisible();
  await expect(searchPage.currentChip("Artists")).toBeVisible();
});

test("an artist's row shows their initials, type, country and years, their disambiguation quietly, ♥ and Add to collection", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;

  await searchPage.goto("Alice Cooper", "artist");

  const results = searchPage.musicBrainzResults;
  const singer = results.result("Alice Cooper", "the singer");
  await expect(singer.initials("Alice Cooper")).toHaveText("AC");
  // No photo in Search, even for an artist who has one (#298, story 6).
  await expect(singer.poster).toHaveCount(0);
  await expect(singer.text("Person · United States · 1948–")).toBeVisible();
  await expect(singer.text("the singer, active as a solo artist 1975–present")).toHaveCSS(
    "font-style",
    "italic",
  );
  // An artist is only liked or collected.
  await expect(singer.actionButtons).toHaveText(["Favourite", "Add to collection"]);
  const band = results.result("Alice Cooper", "the band");
  await expect(band.text("Group · United States · 1964–1975")).toBeVisible();
  await expect(searchPage.main).not.toContainText(libraryWording);
});

test("an artist search that finds nothing says to spell the name as on the album, with Add manually", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;

  await searchPage.goto("Сусіди знизу", "artist");

  await expect(searchPage.noArtistsMessage).toHaveText("No artists found for “Сусіди знизу”.");
  await expect(searchPage.artistNameHint).toBeVisible();
  await expect(searchPage.addManuallyButton).toBeVisible();
});

test("when MusicBrainz is busy, an artist search says so and names Collections", async ({
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

  await searchPage.goto("Radiohead", "artist");

  await expect(searchPage.musicBrainzBusy).toContainText(
    "Nothing in your Collections matches “Radiohead”.",
  );
  await page.unroute("**/api/catalog/search?**");
  await searchPage.tryAgainButton.click();
  await expect(searchPage.musicBrainzResults.result("Radiohead").root).toBeVisible();
});

test("Add to collection from Search puts an artist in a Collection of artists, the last used first, and a kept artist comes first with their photo", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const radioheadItem = await radiohead(api);
  await createList(api, "For the road", "song");
  const ukrainian = await createList(api, "Ukrainian bands", "artist");
  const friend = await createList(api, "Bands to show a friend", "artist");
  await addToList(api, ukrainian.id, radioheadItem.id, 30);
  await addToList(api, friend.id, radioheadItem.id, 10);
  const { searchPage } = ui;
  await searchPage.goto("Океан Ельзи", "artist");

  await searchPage.musicBrainzResults.result("Океан Ельзи").addToListButton.click();

  // Only Collections of artists, the one added to last first, and the artist named without a year.
  const dialog = searchPage.filmListsDialog("Океан Ельзи");
  await expect(dialog.root).toContainText(
    "Tick a Collection to add the artist, untick it to take the artist off.",
  );
  await expect(dialog.rows).toHaveText(["Bands to show a friend", "Ukrainian bands"]);
  await dialog.text("Ukrainian bands").click();
  await expect(dialog.checkbox("Ukrainian bands")).toBeChecked();
  await dialog.done();

  // Kept artists load again once the query changes.
  await searchPage.search("Океан");
  await expect(searchPage.collectionsMatches.films).toHaveText([
    /^Океан Ельзи\s*Group\s*Ukrainian bands$/,
  ]);
  const photo = await box(searchPage.collectionsMatches.film("Океан Ельзи").posterImage);
  expect(photo.width).toBe(photo.height);
});

test("the picker makes a Collection of artists in place, with the artist in it, and offers it at once when there is none", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await createList(api, "Favourite songs", "song");
  const okeanElzyItem = await okeanElzy(api);
  const { filmPage } = ui;
  await filmPage.goto(okeanElzyItem.id);

  await filmPage.addToListButton.click();

  const dialog = filmPage.filmListsDialog("Океан Ельзи");
  await expect(
    dialog.text("You have no Collections of artists yet. Make one, and this artist goes into it."),
  ).toBeVisible();
  await expect(dialog.nameInput).toHaveAttribute("placeholder", "Bands to show a friend");
  await dialog.createAndAdd("Bands to show a friend");
  await expect(dialog.checkbox("Bands to show a friend")).toBeChecked();
  await dialog.done();
  await expect(filmPage.collectionRows).toHaveText([/^Bands to show a friend\s*1 artist$/]);
});

test("an artist's page has their whole photo over a blurred copy, its credit, their facts, the link to MusicBrainz, their Collections and their albums, and no History", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const okeanElzyItem = await okeanElzy(api);
  const friend = await createList(api, "Bands to show a friend", "artist");
  await addToList(api, friend.id, okeanElzyItem.id);
  const { filmPage } = ui;

  await filmPage.goto(okeanElzyItem.id);

  await expect(filmPage.heading).toHaveText("Океан Ельзи");
  await expect(filmPage.text("Group · Ukraine · 1994–")).toBeVisible();
  await expect(page).toHaveTitle("Океан Ельзи · TasteTrack");
  // The whole photo, as wide as it is, not cropped round or square.
  await expect(filmPage.artistPhoto).toHaveAttribute("src", okeanElzyItem.metadata.photoUrls.large);
  await expect(filmPage.artistPhoto).toHaveJSProperty("complete", true);
  const photo = await box(filmPage.artistPhoto);
  expect(photo.width / photo.height).toBeCloseTo(5 / 3, 1);
  await expect(filmPage.artistPhotoCopy).toHaveCSS("filter", /blur/);
  await expect(filmPage.photoCreditLink).toHaveText(
    "Photo: Alexander Khanin · CC BY-SA 4.0 · Wikimedia Commons",
  );
  await expect(filmPage.photoCreditLink).toHaveAttribute(
    "href",
    "https://commons.wikimedia.org/wiki/File:OkeanElzi25.jpg",
  );
  await expect(filmPage.photoCreditLink).toHaveAttribute("target", "_blank");
  await expect(filmPage.musicBrainzLink).toHaveAttribute("href", artistPage(okeanElzyId));
  await expect(filmPage.collectionRows).toHaveText([/^Bands to show a friend\s*1 artist$/]);
  // Oldest first, an album's year under its title.
  await expect(filmPage.albumsHeading).toHaveText(/^Albums and EPs\s*11$/);
  // The fake's Cover Art Archive has covers for few, so the rest are set in type.
  await expect(filmPage.albums.first()).toHaveText(/Там, де нас нема\s*1998$/);
  await expect(filmPage.albums.last()).toHaveText(/Lighthouse\s*2024$/);
  await expect(filmPage.historyHeading).toHaveCount(0);
  await expect(filmPage.addThoughtButton).toHaveCount(0);
  await expect(filmPage.main).not.toContainText(libraryWording);

  await filmPage.album("Земля").click();

  await expect(page).toHaveURL(filmPage.anyPath);
  await expect(filmPage.heading).toHaveText("Земля");
  await expect(filmPage.text("2013 · Океан Ельзи")).toBeVisible();
});

test("an artist with no photo shows their initials and no blurred copy, and one in no Collection says so", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const nirvana = await artist(api, "Nirvana", nirvanaUkId);
  const { filmPage } = ui;

  await filmPage.goto(nirvana.id);

  await expect(filmPage.initials("Nirvana")).toHaveText("N");
  const initials = await box(filmPage.initials("Nirvana"));
  expect([initials.width, initials.height]).toEqual([176, 176]);
  await expect(filmPage.artistPhoto).toHaveCount(0);
  await expect(filmPage.photoCreditLink).toHaveCount(0);
  await expect(filmPage.text("Group · United Kingdom · 1967–")).toBeVisible();
  await expect(filmPage.text("60s band from the UK")).toHaveCSS("font-style", "italic");
  await expect(filmPage.notKeptMessage).toBeVisible();
  await expect(filmPage.noAlbumsMessage).toBeVisible();
});

test("on a phone an artist's photo sits whole under Back, the facts centred under it, and seven chips fit a 320 px phone", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await page.setViewportSize(phone);
  const okeanElzyItem = await okeanElzy(api);
  const { filmPage, searchPage } = ui;

  await filmPage.goto(okeanElzyItem.id);

  const [photo, heading, main] = await Promise.all([
    box(filmPage.artistPhoto),
    box(filmPage.heading),
    box(filmPage.main),
  ]);
  expect(photo.x + photo.width / 2).toBeCloseTo(main.x + main.width / 2, 0);
  expect(heading.x + heading.width / 2).toBeCloseTo(main.x + main.width / 2, 0);
  expect(photo.width).toBeLessThanOrEqual(main.width);
  const add = await box(filmPage.addToListButton);
  expect(add.height).toBe(48);
  // Three covers a row.
  const tops = await Promise.all(
    [0, 1, 2, 3].map(async (index) => (await box(filmPage.albums.nth(index))).y),
  );
  expect(tops.slice(0, 3)).toEqual([tops[0], tops[0], tops[0]]);
  expect(tops[3]).toBeGreaterThan(tops[0] ?? 0);
  await expect(filmPage.backLink).toHaveAttribute("href", "/collections?type=artist");

  await searchPage.goto("Океан Ельзи", "artist");
  const row = searchPage.musicBrainzResults.result("Океан Ельзи");
  const initials = await box(row.initials("Океан Ельзи"));
  expect([initials.width, initials.height]).toEqual([56, 56]);

  await page.setViewportSize({ width: 320, height: 640 });
  await expect(searchPage.mediaTypeChip("Artists")).toHaveCSS("font-size", "11px");
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBe(0);
});

test("an album's and a song's page link each credited artist to their page, and a manual album's artists stay text", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const [zemlyaItem, obiimyItem] = [await zemlya(api), await obiimy(api)];
  const bedouin = await album(api, "Bedouin Reworks Dakhabrakha", bedouinReworksId);
  const garage = await manualAlbum(api, {
    title: "Записи з гаража",
    year: 2009,
    authors: ["Сусідський Квас"],
  });
  const { filmPage } = ui;

  await filmPage.goto(bedouin.id);
  // Each artist a link, the joining phrase text.
  await expect(filmPage.creditedArtist("Bedouin")).toBeVisible();
  await expect(filmPage.creditedArtist("DakhaBrakha")).toBeVisible();
  await expect(filmPage.text("2022 · Bedouin, DakhaBrakha · EP")).toBeVisible();

  await filmPage.goto(garage.id);
  await expect(filmPage.text("2009 · Сусідський Квас")).toBeVisible();
  await expect(filmPage.creditedArtist("Сусідський Квас")).toHaveCount(0);

  await filmPage.goto(obiimyItem.id);
  await filmPage.creditedArtist("Океан Ельзи").click();
  await expect(page).toHaveURL(filmPage.anyPath);
  await expect(filmPage.heading).toHaveText("Океан Ельзи");
  await expect(filmPage.text("Group · Ukraine · 1994–")).toBeVisible();
  const okeanElzyPage = page.url();

  await filmPage.goto(zemlyaItem.id);
  await expect(filmPage.creditedArtist("Океан Ельзи")).toHaveCSS(
    "text-decoration-line",
    "underline",
  );
  await filmPage.creditedArtist("Океан Ельзи").click();
  // The same artist's page, already in the catalog.
  await expect(page).toHaveURL(okeanElzyPage);
});

test("an artist MusicBrainz doesn't have is added by hand with a name and no year, put in a Collection and deleted", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage, filmPage, listsPage } = ui;
  await searchPage.goto("Сусіди знизу", "artist");

  await searchPage.addManuallyButton.click();
  const adding = searchPage.addArtistManuallyDialog;
  await expect(adding.root).toContainText("For an artist search doesn't find.");
  await expect(adding.nameInput).toHaveValue("Сусіди знизу");
  await expect(adding.yearInput).toHaveCount(0);
  await adding.addButton.click();

  await expect(adding.root).toBeHidden();
  const added = searchPage.musicBrainzResults.result("Сусіди знизу");
  await expect(added.addedByYouLabel).toBeVisible();
  await expect(added.initials("Сусіди знизу")).toHaveText("СЗ");
  await searchPage.musicBrainzResults.link("Сусіди знизу").click();
  await expect(page).toHaveURL(filmPage.anyPath);
  await expect(filmPage.initials("Сусіди знизу")).toBeVisible();
  await expect(filmPage.text("You added this artist manually. Only you can see it.")).toBeVisible();
  await expect(filmPage.musicBrainzLink).toHaveCount(0);
  await expect(filmPage.albumsHeading).toHaveCount(0);

  await filmPage.addToListButton.click();
  const dialog = filmPage.filmListsDialog("Сусіди знизу");
  await dialog.createAndAdd("Bands to show a friend");
  await dialog.done();
  // The row's cover is the artist's initials.
  await expect(filmPage.collectionRows).toHaveText([/^СЗ\s*Bands to show a friend\s*1 artist$/]);

  await filmPage.deleteArtistButton.click();
  const confirm = filmPage.deleteFilmDialog("Сусіди знизу");
  await expect(confirm.root).toContainText("It will be removed from 1 Collection.");
  await confirm.confirm("Delete");
  await expect(page).toHaveURL(listsPage.path("artist"));
});

test("a User makes a Collection of artists from its empty state and fills it, round photos and initials", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await manualArtist(api, { title: "Сусіди знизу" });
  const { listsPage, listPage } = ui;
  await listsPage.goto("artist");

  await expect(
    listsPage.text(
      "Rank your Favourite artists, or gather them into Collections, like Bands to show a friend",
    ),
  ).toBeVisible();
  await listsPage.emptyStateNewListButton.click();
  await listsPage.newListDialog.nameInput.fill("Bands to show a friend");
  await listsPage.newListDialog.createButton.click();
  await listPage.addArtistsButton.click();
  const addArtists = listPage.addArtistsDialog("Bands to show a friend");
  await expect(addArtists.searchBox).toHaveAttribute("placeholder", "Artist or band");
  await addArtists.add("Океан Ельзи", "Океан Ельзи");
  await addArtists.add("Сусіди", "Сусіди знизу");
  await addArtists.doneButton.click();

  await expect(listPage.items("Bands to show a friend")).toHaveCount(2);
  await expect(listPage.text("2 artists")).toBeVisible();
  const okean = listPage.poster("Bands to show a friend", "Океан Ельзи");
  const photo = await box(okean.posterImage);
  expect(photo.width).toBe(photo.height);
  await expect(okean.root).toContainText("Group");
  await expect(
    listPage.poster("Bands to show a friend", "Сусіди знизу").initials("Сусіди знизу"),
  ).toHaveText("СЗ");
});

// Besides its User, this journey writes one List, Favourite artists, and one List Item, and the
// artist's Media Item and cache entry where no one has added them yet (ADR-0006). On staging it
// searches the real MusicBrainz and Wikimedia: no other smoke test covers the artist search or
// Favourites.
test("search for an artist and add them to Favourites", {
  tag: "@smoke",
}, async ({ page, loggedInUi: ui }) => {
  const { searchPage, listsPage, favouritesPage } = ui;
  await searchPage.goto();
  await searchPage.mediaTypeChip("Artists").click();
  await searchPage.search("Океан Ельзи");
  // By their name and type alone: real MusicBrainz may change the rest.
  const result = searchPage.musicBrainzResults.result("Океан Ельзи", "Group");

  await result.favouriteButton.click();

  await expect(result.inFavouritesButton).toBeVisible();
  await searchPage.mainNav.link("Collections").click();
  await listsPage.artistsChip.click();
  await listsPage.listLink("Favourite artists").click();
  await expect(page).toHaveURL(favouritesPage.path());
  await expect(favouritesPage.rows).toHaveText([/^1Океан Ельзи\s*Group/]);
});
