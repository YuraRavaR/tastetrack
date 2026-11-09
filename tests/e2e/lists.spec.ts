import type { Locator } from "@playwright/test";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { alien, aliens, manualFilm } from "../support/scenarios/films";
import { settledBoxOf } from "../support/ui/boxes";
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

  // Moving Aliens earlier puts it first, and a Note says why it's there.
  await listPage.act("Reorder films");
  await listPage.poster("Space horror", "Aliens").moveEarlierButton.click();
  await expect(items.first()).toContainText("Aliens");
  await listPage.doneButton.click();
  await listPage.choose("Space horror", "Aliens", "Add a Note");
  await listPage.noteDialog("Aliens (1986)").saveNote("The sequel is the scarier one.");
  await expect(items.first()).toContainText("The sequel is the scarier one.");

  // Renamed, and the Lists page shows it with its films.
  // Edit opens the New collection form, filled in.
  await listPage.act("Edit collection");
  const editList = listPage.editListDialog;
  await expect(editList.nameInput).toHaveValue("Space horror");
  await expect(editList.descriptionInput).toHaveValue("Films to watch with the lights off.");
  await editList.nameInput.fill("Horror in space");
  await editList.saveButton.click();
  await expect(listPage.heading("Horror in space")).toBeVisible();
  await page.reload();
  await expect(listPage.items("Horror in space").first()).toContainText("Aliens");
  await listPage.mainNav.link("Collections").click();
  const { lists } = listsPage;
  await expect(lists).toHaveCount(1);
  await expect(lists).toContainText("Horror in space");
  await expect(lists).toContainText("2 films");

  // Deleting it asks first, and the Lists page is empty again.
  await listsPage.listLink("Horror in space").click();
  await listPage.act("Delete collection");
  const confirm = listPage.deleteListDialog("Horror in space");
  await expect(confirm.root).toContainText("Your Log stays as it is.");
  await confirm.confirm("Delete");
  await expect(page).toHaveURL(listsPage.path());
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
  await expect(listsPage.filmsChip).toHaveAttribute("aria-pressed", "true");
  await expect(listsPage.booksChip).toBeDisabled();
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

test("the ⋯ by a List's heading holds its actions, as a sheet on a phone like their dialogs", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const list = await createList(api, "Space horror");
  const { listPage } = ui;
  await listPage.goto(list.id);
  const dialogs = {
    "Edit collection": listPage.editListDialog.root,
    Share: listPage.shareLinkDialog("Space horror").root,
    "Delete collection": listPage.deleteListDialog("Space horror").root,
  } as const;

  // Reordering needs two films at least.
  await listPage.actionsButton.click();
  const menuItems = listPage.actionsMenu.getByRole("menuitem");
  await expect(menuItems).toHaveText([
    "Edit collection",
    "Reorder films",
    "Share",
    "Delete collection",
  ]);
  await expect(listPage.actionItem("Reorder films")).toBeDisabled();
  await page.keyboard.press("Escape");
  // From md each dialog sits 72px from the top.
  for (const [action, dialog] of Object.entries(dialogs)) {
    await listPage.act(action as keyof typeof dialogs);
    expect((await settledBoxOf(dialog)).y).toBe(72);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }

  // On a phone the menu and each dialog sit on the bottom edge, full width.
  const screen = { width: 402, height: 874 };
  await page.setViewportSize(screen);
  for (const [action, dialog] of Object.entries(dialogs)) {
    await listPage.actionsButton.click();
    await expectOnBottomEdge(listPage.actionsMenu, screen);
    await listPage.actionItem(action as keyof typeof dialogs).click();
    await expectOnBottomEdge(dialog, screen);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});

async function expectOnBottomEdge(sheet: Locator, screen: { width: number; height: number }) {
  const box = await settledBoxOf(sheet);
  expect(box.x).toBe(0);
  expect(box.width).toBe(screen.width);
  expect(box.y + box.height).toBeCloseTo(screen.height, 0);
}

test("Reorder films moves each poster earlier, later or to the top, and the order stays", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const list = await createList(api, "Trees");
  for (const title of ["Ash", "Birch", "Cedar"]) {
    const mediaItemId = (await manualFilm(api, { title })).id;
    await expectBody(api.lists.addListItem(list.id, { mediaItemId }), 201);
  }
  const { listPage } = ui;
  await listPage.goto(list.id);
  const items = listPage.items("Trees");
  const ash = listPage.poster("Trees", "Ash");
  const birch = listPage.poster("Trees", "Birch");
  const cedar = listPage.poster("Trees", "Cedar");
  await expect(items).toContainText(["Ash", "Birch", "Cedar"]);

  // The mode hides the search and each poster's ⋯ and link, and the placeholder's own caption.
  await listPage.act("Reorder films");
  const reorderHint = listPage.text(
    "Use the arrows on each poster to move it earlier or later, or to the top.",
  );
  await expect(reorderHint).toBeVisible();
  await expect(listPage.searchBox).toHaveCount(0);
  await expect(ash.moreButton).toHaveCount(0);
  await expect(ash.link).toHaveCount(0);
  await expect(ash.noPoster).toHaveText("");
  // The arrows that would go past either end are off.
  await expect(ash.moveToTopButton).toBeDisabled();
  await expect(ash.moveEarlierButton).toBeDisabled();
  await expect(cedar.moveLaterButton).toBeDisabled();

  // Each move saves at once. The arrow keeps the keyboard's focus, and one that reaches an end
  // hands it to the arrow that moves the other way.
  await ash.moveLaterButton.focus();
  await page.keyboard.press("Enter");
  await expect(items).toContainText(["Birch", "Ash", "Cedar"]);
  await expect(ash.moveLaterButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(items).toContainText(["Birch", "Cedar", "Ash"]);
  await expect(ash.moveLaterButton).toBeDisabled();
  await expect(ash.moveEarlierButton).toBeFocused();
  await cedar.moveToTopButton.click();
  await expect(items).toContainText(["Cedar", "Birch", "Ash"]);
  await birch.moveEarlierButton.click();
  await expect(items).toContainText(["Birch", "Cedar", "Ash"]);

  // Done brings back the search and the ⋯; the order outlives a reload.
  await listPage.doneButton.click();
  await expect(reorderHint).toHaveCount(0);
  await expect(listPage.searchBox).toBeVisible();
  await expect(ash.moreButton).toBeVisible();
  await page.reload();
  await expect(items).toContainText(["Birch", "Cedar", "Ash"]);

  // Move to top is in each poster's ⋯ too, off for the first film.
  await birch.moreButton.click();
  await expect(listPage.posterMenuItem("Move to top")).toBeDisabled();
  await page.keyboard.press("Escape");
  await listPage.choose("Trees", "Ash", "Move to top");
  await expect(items).toContainText(["Ash", "Birch", "Cedar"]);

  // A newly added film goes to the end.
  await listPage.search("alien");
  await listPage.searchResults.result("Alien (1979)").addButton.click();
  await expect(items).toHaveCount(4);
  await page.reload();
  await expect(items).toContainText(["Ash", "Birch", "Cedar", "Alien"]);
});

test("a Collection is a grid of posters, each with its Note, which the User writes and clears", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const list = await createList(api, "Space horror");
  const alienId = (await alien(api)).id;
  for (const mediaItemId of [alienId, (await aliens(api)).id]) {
    await expectBody(api.lists.addListItem(list.id, { mediaItemId }), 201);
  }
  const { listPage, filmPage } = ui;
  await listPage.goto(list.id);

  const items = listPage.items("Space horror");
  await expect(items).toHaveCount(2);
  const alienPoster = listPage.poster("Space horror", "Alien");
  await expect(alienPoster.root).toContainText("1979");
  await expect(alienPoster.noteButton).toHaveCount(0);

  // A Note from the poster's menu shows under the poster.
  await listPage.choose("Space horror", "Alien", "Add a Note");
  await listPage.noteDialog("Alien (1979)").saveNote("Watch it first.");
  await expect(alienPoster.noteButton).toHaveText("Watch it first.");

  // Tapping the Note opens it to edit; emptied from the menu, it's gone.
  await alienPoster.noteButton.click();
  const noteDialog = listPage.noteDialog("Alien (1979)");
  await expect(noteDialog.noteInput).toHaveValue("Watch it first.");
  await noteDialog.saveNote("Watch it first, alone.");
  await expect(alienPoster.noteButton).toHaveText("Watch it first, alone.");
  await listPage.choose("Space horror", "Alien", "Edit Note");
  await noteDialog.saveNote("");
  await expect(alienPoster.noteButton).toHaveCount(0);
  await expect(listPage.text("Watch it first, alone.")).toHaveCount(0);

  // The poster opens the film's page.
  await alienPoster.link.click();
  await expect(page).toHaveURL(filmPage.path(alienId));
});

test("a film removed from a Collection comes back where it was, with its Note, on Undo", async ({
  ui,
  loggedInApi: api,
}) => {
  const list = await createList(api, "Space horror");
  for (const listItem of [
    { mediaItemId: (await alien(api)).id, note: "Watch it first." },
    { mediaItemId: (await aliens(api)).id },
  ]) {
    await expectBody(api.lists.addListItem(list.id, listItem), 201);
  }
  const { listPage } = ui;
  await listPage.goto(list.id);

  await listPage.choose("Space horror", "Alien", "Remove from collection");
  const items = listPage.items("Space horror");
  await expect(items).toHaveCount(1);
  await expect(listPage.text("Removed Alien (1979) from this Collection.")).toBeVisible();
  await expect(listPage.text("1 film")).toBeVisible();

  await listPage.undoButton.click();
  await expect(items).toHaveCount(2);
  await expect(items.first().getByText("Alien", { exact: true })).toBeVisible();
  await expect(listPage.poster("Space horror", "Alien").noteButton).toHaveText("Watch it first.");
  await expect(listPage.undoButton).toHaveCount(0);
});

test("an empty Collection says so, with a button to add films", async ({
  ui,
  loggedInApi: api,
}) => {
  const list = await createList(api, "Space horror");
  const { listPage } = ui;
  await listPage.goto(list.id);

  await expect(listPage.text("This Collection is empty.")).toBeVisible();
  await expect(listPage.items("Space horror")).toHaveCount(0);
  await listPage.addFilmsButton.click();
  await expect(listPage.searchBox).toBeFocused();
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
