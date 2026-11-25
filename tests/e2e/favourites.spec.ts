import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import {
  artist,
  kalushOrchestraId,
  okeanElzy,
  pinkFloydId,
  radiohead,
} from "../support/scenarios/artists";
import { expect, test } from "../support/ui/fixtures";

// Favourite artists (`docs/mockups/artists/`): the system List of the artists a User Likes,
// ranked by its order (ADR-0005). Locally the Worker searches and looks up artists on a
// MusicBrainz fake, and their photos on a Wikimedia fake.

// Likes each artist in turn, so they are ranked in this order.
async function likeAll(api: ApiClient, mediaItems: { id: number }[]) {
  for (const { id } of mediaItems) {
    await expectBody(api.favourites.like({ mediaItemId: id }), 201);
  }
}

async function favouritesId(api: ApiClient) {
  const { favourites } = await expectBody(api.favourites.getFavourites({ mediaType: "artist" }));
  return favourites.id as number;
}

const phone = { width: 390, height: 844 };

for (const [device, viewport] of [
  ["desktop", null],
  ["a phone", phone],
] as const) {
  test(`on ${device}, ♥ on an artist's search row likes them, the kept strip gives their place, and ♥ again takes the Like back`, async ({
    page,
    loggedInUi: ui,
    loggedInApi: api,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await likeAll(api, [await radiohead(api)]);
    const { searchPage } = ui;
    await searchPage.goto("Океан Ельзи", "artist");
    const result = searchPage.musicBrainzResults.result("Океан Ельзи", "Group · Ukraine");
    await expect(result.actionButtons).toHaveText(["Favourite", "Add to collection"]);

    await result.favouriteButton.click();

    await expect(result.inFavouritesButton).toBeVisible();
    // Kept artists load again once the query changes.
    await searchPage.search("Океан");
    await expect(searchPage.collectionsMatches.films).toHaveText([
      /^Океан Ельзи\s*Group\s*Favourites · 2nd$/,
    ]);
    await searchPage.search("Океан Ельзи");
    await searchPage.collectionsMatches.film("Океан Ельзи").link.click();
    await ui.filmPage.inFavouritesButton.click();
    await expect(ui.filmPage.favouriteButton).toBeVisible();
    await expect(ui.filmPage.notKeptMessage).toBeVisible();
  });
}

test("♥ on an artist's page likes them, and their Collections say their place in Favourite artists", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const radioheadItem = await radiohead(api);
  const okeanElzyItem = await okeanElzy(api);
  await likeAll(api, [radioheadItem]);
  const { filmPage, favouritesPage } = ui;
  await filmPage.goto(okeanElzyItem.id);
  await expect(filmPage.notKeptMessage).toBeVisible();

  await filmPage.favouriteButton.click();

  await expect(filmPage.inFavouritesButton).toBeVisible();
  await expect(filmPage.collectionRows).toHaveText([/^Favourite artists\s*2nd of 2$/]);
  await filmPage.collectionRows.getByRole("link", { name: /Favourite artists/ }).click();
  await expect(page).toHaveURL(favouritesPage.path());
  await expect(favouritesPage.rows).toHaveText([/^1Radiohead/, /^2Океан Ельзи/]);
});

test("Favourite artists come first on Collections, numbered, and the arrows and the ⋯ rank, note and take them out", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const okean = await okeanElzy(api);
  const pinkFloyd = await artist(api, "Pink Floyd", pinkFloydId);
  const kalush = await artist(api, "Kalush Orchestra", kalushOrchestraId);
  await likeAll(api, [okean, pinkFloyd, kalush]);
  await expectBody(
    api.lists.createList({ name: "Bands to show a friend", mediaType: "artist" }),
    201,
  );
  const { listsPage, favouritesPage } = ui;
  await listsPage.goto("artist");

  await expect(listsPage.lists).toHaveText([
    /^Favourite artists\s*3 artists\s*·\s*Ranked$/,
    /^Bands to show a friend\s*0 artists$/,
  ]);
  await listsPage.listLink("Favourite artists").click();

  await expect(page).toHaveURL(favouritesPage.path());
  await expect(page).toHaveTitle("Favourite artists · TasteTrack");
  await expect(favouritesPage.heading).toBeVisible();
  await expect(favouritesPage.text("3 artists")).toBeVisible();
  await expect(favouritesPage.rows).toHaveText([
    /^1Океан Ельзи\s*Group · Ukraine · 1994–/,
    /^2Pink Floyd\s*Group · United Kingdom · 1965–2014/,
    /^3Kalush Orchestra/,
  ]);
  // No Reorder mode: the arrows are always there, off past either end.
  await expect(favouritesPage.row("Океан Ельзи").moveUpButton).toBeDisabled();
  await expect(favouritesPage.row("Kalush Orchestra").moveDownButton).toBeDisabled();

  await favouritesPage.row("Kalush Orchestra").moveUpButton.click();
  await expect(favouritesPage.rows).toHaveText([/^1Океан/, /^2Kalush/, /^3Pink Floyd/]);
  await favouritesPage.row("Океан Ельзи").moveDownButton.click();
  await expect(favouritesPage.rows).toHaveText([/^1Kalush/, /^2Океан/, /^3Pink Floyd/]);

  await favouritesPage.chooseRowAction("Kalush Orchestra", "Add a Note");
  await favouritesPage.noteDialog("Kalush Orchestra").saveNote("Євробачення 2022.");
  await expect(favouritesPage.row("Kalush Orchestra").root).toContainText("Євробачення 2022.");

  await favouritesPage.chooseRowAction("Pink Floyd", "Remove from Favourites");
  await expect(favouritesPage.rows).toHaveText([/^1Kalush/, /^2Океан/]);
  await favouritesPage.undoButton.click();
  await expect(favouritesPage.rows).toHaveText([/^1Kalush/, /^2Океан/, /^3Pink Floyd/]);

  await page.reload();
  await expect(favouritesPage.rows).toHaveText([/^1Kalush/, /^2Океан/, /^3Pink Floyd/]);
});

test("Favourite artists can't be renamed or deleted, and keep a description", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await likeAll(api, [await okeanElzy(api)]);
  const { favouritesPage } = ui;
  await favouritesPage.goto();

  await favouritesPage.actionsButton.click();

  await expect(favouritesPage.menu.getByRole("menuitem")).toHaveText(["Share", "Edit description"]);
  await expect(favouritesPage.menu).toContainText(
    "Favourite artists can’t be renamed or deleted. Take an artist out with ♥ on their page.",
  );
  await favouritesPage.actionItem("Edit description").click();
  await favouritesPage.descriptionInput.fill("The ones I'd see live again.");
  await favouritesPage.saveDescriptionButton.click();
  await expect(favouritesPage.text("The ones I'd see live again.")).toBeVisible();
});

test("a full Favourite artists refuses a 101st ♥ with the reason under it, and says so on its page", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  await likeAll(api, [await radiohead(api)]);
  expect((await api.testHooks.fillList(await favouritesId(api), 99)).status()).toBe(204);
  const { searchPage, favouritesPage } = ui;
  await searchPage.goto("Океан Ельзи", "artist");
  const result = searchPage.musicBrainzResults.result("Океан Ельзи", "Group · Ukraine");

  await result.favouriteButton.click();

  await expect(result.errorMessage).toHaveText(
    "Favourite artists is full (100). Remove one first.",
  );
  await expect(result.favouriteButton).toHaveAccessibleDescription(
    "Favourite artists is full (100). Remove one first.",
  );
  await favouritesPage.goto();
  await expect(
    favouritesPage.text(
      "Favourite artists is full (100). Remove one first, then ♥ another artist.",
    ),
  ).toBeVisible();
});

test("anyone with the link sees Favourite artists ranked, with their numbers and Notes", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
  loggedInUser,
}) => {
  const okean = await okeanElzy(api);
  const radioheadItem = await radiohead(api);
  await likeAll(api, [okean, radioheadItem]);
  const { favouritesPage, sharedPage } = ui;
  await favouritesPage.goto();
  await favouritesPage.chooseRowAction("Radiohead", "Add a Note");
  await favouritesPage.noteDialog("Radiohead").saveNote("In Rainbows, on repeat.");
  await favouritesPage.chooseAction("Share");
  const dialog = favouritesPage.shareLinkDialog();
  await dialog.share();
  const link = await dialog.readLink();
  await dialog.closeButton.click();
  await expect(favouritesPage.text("Shared by link")).toBeVisible();
  await page.context().clearCookies();

  await page.goto(link);

  const title = `${loggedInUser.username}'s Favourite artists`;
  await expect(sharedPage.heading(title)).toBeVisible();
  await expect(sharedPage.text("Artist collection")).toBeVisible();
  await expect(sharedPage.items(title)).toHaveText([
    /^1Океан Ельзи\s*Group · Ukraine · 1994–$/,
    /^2Radiohead\s*Group · United Kingdom · 1991–\s*In Rainbows, on repeat\.$/,
  ]);
});

test("with no artists kept, Collections on Artists offers Find artists and New collection", async ({
  page,
  loggedInUi: ui,
}) => {
  const { listsPage, searchPage } = ui;
  await listsPage.goto("artist");

  await expect(
    listsPage.text(
      "Rank your Favourite artists, or gather them into Collections, like Bands to show a friend",
    ),
  ).toBeVisible();
  await expect(listsPage.emptyStateNewListButton).toBeVisible();
  await listsPage.findArtistsLink.click();

  await expect(page).toHaveURL(searchPage.path(undefined, "artist"));
});
