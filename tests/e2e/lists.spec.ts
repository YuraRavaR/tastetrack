import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { alien, aliens, manualFilm } from "../support/scenarios/films";
import { expect, test } from "../support/ui/fixtures";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien and Aliens, but
// TMDB matches whole words, so Aliens is searched for as "aliens": "alien" doesn't find it there.

async function createList(api: ApiClient, name: string) {
  return (await expectBody(api.lists.createList({ name, mediaType: "film" }), 201)).list;
}

async function listItemsOf(api: ApiClient, listId: number) {
  return (await expectBody(api.lists.getList(listId))).list.items;
}

test("a User builds a List: names it, adds films, orders and notes them, then deletes it", {
  tag: "@smoke",
}, async ({ page, loggedInUi: ui }) => {
  const { searchPage, listsPage, listPage } = ui;
  await searchPage.goto();
  await searchPage.mainNav.link("Collections").click();
  await expect(listsPage.emptyMessage).toBeVisible();

  // A reserved name is refused, then a free one makes the List.
  await listsPage.emptyStateNewListButton.click();
  const newList = listsPage.newListDialog;
  await newList.nameInput.fill("Watchlist");
  await newList.createButton.click();
  await expect(newList.errorMessage).toHaveText("This name is reserved");
  await newList.nameInput.fill("Space horror");
  await newList.descriptionInput.fill("Films to watch with the lights off.");
  await newList.createButton.click();

  await expect(listPage.heading("Space horror")).toBeVisible();
  await expect(listPage.text("Films to watch with the lights off.")).toBeVisible();
  await listPage.search("alien");
  const alien = listPage.searchResults.result("Alien (1979)");
  await alien.addButton.click();
  await expect(alien.inThisListLabel).toBeVisible();
  await expect(alien.addButton).toHaveCount(0);
  await listPage.search("aliens");
  await listPage.searchResults.result("Aliens (1986)").addButton.click();
  const items = listPage.items("Space horror");
  await expect(items).toHaveCount(2);
  await expect(listPage.text("2 films")).toBeVisible();

  // Moving Aliens up puts it first, and a Note says why it's there.
  await listPage.lastItem("Space horror").moveEarlierButton.click();
  await expect(items.first()).toContainText("Aliens (1986)");
  await listPage.firstItem("Space horror").addNoteButton.click();
  await listPage.noteDialog("Aliens (1986)").saveNote("The sequel is the scarier one.");
  await expect(items.first()).toContainText("The sequel is the scarier one.");

  // Renamed, and the Lists page shows it with its films.
  await listPage.editListButton.click();
  const editList = listPage.editListDialog;
  await expect(editList.nameInput).toHaveValue("Space horror");
  await editList.nameInput.fill("Horror in space");
  await editList.saveButton.click();
  await expect(listPage.heading("Horror in space")).toBeVisible();
  await page.reload();
  await expect(listPage.items("Horror in space").first()).toContainText("Aliens (1986)");
  await listPage.mainNav.link("Collections").click();
  const { lists } = listsPage;
  await expect(lists).toHaveCount(1);
  await expect(lists).toContainText("Horror in space");
  await expect(lists).toContainText("2 films");

  // Deleting it asks first, and the Lists page is empty again.
  await listsPage.listLink("Horror in space").click();
  await listPage.deleteListButton.click();
  const confirm = listPage.deleteListDialog("Horror in space");
  await expect(confirm.root).toContainText("Your Log stays as it is.");
  await confirm.confirm("Delete");
  await expect(listsPage.emptyMessage).toBeVisible();
});

test("Collections shows each List as a card with its covers, its count and whether it's shared", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const space = await createList(api, "Space");
  await createList(api, "Comedy");
  for (const title of ["Home movie", "Another home movie"]) {
    const mediaItemId = (await manualFilm(api, { title })).id;
    await expectBody(api.lists.addListItem(space.id, { mediaItemId }), 201);
  }
  await expectBody(api.lists.createShareLink(space.id), 201);
  const { listsPage, listPage } = ui;
  await listsPage.goto();

  await expect(listsPage.heading).toBeVisible();
  await expect(listsPage.mediaTypeChips.getByRole("button", { name: "Films" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(listsPage.mediaTypeChips.getByRole("button", { name: "Books" })).toBeDisabled();
  await expect(listsPage.lists).toHaveCount(2);
  await expect(listsPage.lists.first()).toContainText("Space");
  const spaceCard = listsPage.card("Space");
  await expect(spaceCard.root).toContainText("2 films");
  await expect(spaceCard.coverPlaceholders).toHaveCount(2);
  await expect(spaceCard.sharedMark).toHaveText("Shared by link");
  const comedyCard = listsPage.card("Comedy");
  await expect(comedyCard.root).toContainText("0 films");
  await expect(comedyCard.coverPlaceholders).toHaveCount(0);
  await expect(comedyCard.sharedMark).toHaveCount(0);

  // On a phone the mark is shorter, and the whole card opens the List.
  await page.setViewportSize({ width: 402, height: 874 });
  await expect(spaceCard.sharedMark).toHaveText("Shared");
  await spaceCard.link.click();
  await expect(page).toHaveURL(listPage.path(space.id));
});

test("a name the User already has is refused", async ({ ui, loggedInApi: api }) => {
  await createList(api, "Horror");
  const { listsPage } = ui;
  await listsPage.goto();

  await listsPage.newListButton.click();
  const dialog = listsPage.newListDialog;
  await dialog.nameInput.fill("horror");
  await dialog.createButton.click();

  await expect(dialog.errorMessage).toHaveText("You already have a Collection with this name.");
});

test("a User puts a search result on Lists and takes it off again, from Search", async ({
  ui,
  loggedInApi: api,
}) => {
  const horror = (await createList(api, "Horror")).id;
  const comfort = (await createList(api, "Comfort")).id;
  const { searchPage } = ui;
  await searchPage.goto();

  await searchPage.search("alien");
  const result = searchPage.searchResults.result("Alien (1979)");
  await result.addToListButton.click();
  const dialog = searchPage.filmListsDialog("Alien (1979)");
  await dialog.checkbox("Horror").click();
  await dialog.checkbox("Comfort").click();
  await expect(dialog.checkbox("Comfort")).toBeChecked();
  await dialog.done();
  await expect(dialog.root).toBeHidden();
  expect(await listItemsOf(api, horror)).toHaveLength(1);
  expect(await listItemsOf(api, comfort)).toHaveLength(1);

  // Opened again, it shows where the film is, and unticking takes it off.
  await result.addToListButton.click();
  await expect(dialog.checkbox("Horror")).toBeChecked();
  await dialog.checkbox("Comfort").click();
  await expect(dialog.checkbox("Comfort")).not.toBeChecked();
  await dialog.done();
  expect(await listItemsOf(api, horror)).toHaveLength(1);
  expect(await listItemsOf(api, comfort)).toHaveLength(0);
});

test("a List unticked and ticked again gets the film back where it was, with its Note", async ({
  ui,
  loggedInApi: api,
}) => {
  const horror = (await createList(api, "Horror")).id;
  const alienId = (await alien(api)).id;
  for (const listItem of [
    { mediaItemId: alienId, note: "Watch it first." },
    { mediaItemId: (await aliens(api)).id },
  ]) {
    expect((await api.lists.addListItem(horror, listItem)).status()).toBe(201);
  }
  const { filmPage } = ui;
  await filmPage.goto(alienId);

  await filmPage.addToListButton.click();
  const box = filmPage.filmListsDialog("Alien (1979)").checkbox("Horror");
  await box.click();
  await expect(box).not.toBeChecked();
  await box.click();
  await expect(box).toBeChecked();

  const items = await listItemsOf(api, horror);
  expect(items.map((item: { mediaItem: { id: number } }) => item.mediaItem.id)[0]).toBe(alienId);
  expect(items[0].note).toBe("Watch it first.");
});

test("a User with no Lists is pointed to the Lists page", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const { filmPage, listsPage } = ui;
  await filmPage.goto((await alien(api)).id);

  await filmPage.addToListButton.click();
  const dialog = filmPage.filmListsDialog("Alien (1979)");
  await expect(dialog.root).toContainText("You have no Collections yet.");
  await dialog.makeListLink.click();

  await expect(page).toHaveURL(listsPage.path());
});
