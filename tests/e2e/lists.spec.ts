import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { alien, aliens } from "../support/films";
import { logInNewUser } from "../support/users";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien and Aliens, but
// TMDB matches whole words, so Aliens is searched for as "aliens": "alien" doesn't find it there.

function searchResult(page: Page, label: string) {
  return page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText(label, { exact: true }) });
}

test("a User builds a List: names it, adds films, orders and notes them, then deletes it", {
  tag: "@smoke",
}, async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await page.getByRole("link", { name: "Lists" }).click();
  await expect(page.getByText("You have no Lists yet.")).toBeVisible();

  // A reserved name is refused, then a free one makes the List.
  await page.getByRole("button", { name: "New List" }).click();
  const newList = page.getByRole("dialog", { name: "New List" });
  await newList.getByLabel("Name").fill("Watchlist");
  await newList.getByRole("button", { name: "Create" }).click();
  await expect(newList.getByRole("alert")).toHaveText("This name is reserved");
  await newList.getByLabel("Name").fill("Space horror");
  await newList.getByLabel("Description").fill("Films to watch with the lights off.");
  await newList.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("heading", { name: "Space horror" })).toBeVisible();
  await expect(page.getByText("Films to watch with the lights off.")).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search films" });
  await search.fill("alien");
  const alien = searchResult(page, "Alien (1979)");
  await alien.getByRole("button", { name: "Add" }).click();
  await expect(alien.getByText("In this List")).toBeVisible();
  await expect(alien.getByRole("button", { name: "Add" })).toHaveCount(0);
  await search.fill("aliens");
  await searchResult(page, "Aliens (1986)").getByRole("button", { name: "Add" }).click();
  const items = page.getByRole("list", { name: "Space horror" }).getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(page.getByText("2 films")).toBeVisible();

  // Moving Aliens up puts it first, and a Note says why it's there.
  await items.last().getByRole("button", { name: "Move up" }).click();
  await expect(items.first()).toContainText("Aliens (1986)");
  await items.first().getByRole("button", { name: "Add a Note" }).click();
  const noteDialog = page.getByRole("dialog", { name: "Note for Aliens (1986)" });
  await noteDialog.getByLabel("Note").fill("The sequel is the scarier one.");
  await noteDialog.getByRole("button", { name: "Save" }).click();
  await expect(items.first()).toContainText("The sequel is the scarier one.");

  // Renamed, and the Lists page shows it with its films.
  await page.getByRole("button", { name: "Edit List" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit List" });
  await expect(editDialog.getByLabel("Name")).toHaveValue("Space horror");
  await editDialog.getByLabel("Name").fill("Horror in space");
  await editDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Horror in space" })).toBeVisible();
  await page.reload();
  const renamed = page.getByRole("list", { name: "Horror in space" }).getByRole("listitem");
  await expect(renamed.first()).toContainText("Aliens (1986)");
  await page.getByRole("link", { name: "Lists", exact: true }).click();
  const lists = page.getByRole("list", { name: "Your Lists" }).getByRole("listitem");
  await expect(lists).toHaveCount(1);
  await expect(lists).toContainText("Horror in space");
  await expect(lists).toContainText("2 films");

  // Deleting it asks first, and the Lists page is empty again.
  await lists.getByRole("link", { name: "Horror in space" }).click();
  await page.getByRole("button", { name: "Delete List" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete Horror in space?" });
  await expect(confirm).toContainText("Your Log stays as it is.");
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("You have no Lists yet.")).toBeVisible();
});

test("a name the User already has is refused", async ({ page }) => {
  await logInNewUser(page.request);
  await page.request.post("/api/lists", { data: { name: "Horror", mediaType: "film" } });
  await page.goto("/lists");

  await page.getByRole("button", { name: "New List" }).click();
  const dialog = page.getByRole("dialog", { name: "New List" });
  await dialog.getByLabel("Name").fill("horror");
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(dialog.getByRole("alert")).toHaveText("You already have a List with this name.");
});

// Makes a List through the API: its id.
async function createList(request: APIRequestContext, name: string): Promise<number> {
  const response = await request.post("/api/lists", { data: { name, mediaType: "film" } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).list.id;
}

async function listItemsOf(request: APIRequestContext, listId: number) {
  return (await (await request.get(`/api/lists/${listId}`)).json()).list.items;
}

test("a User puts a search result on Lists and takes it off again, from home", async ({ page }) => {
  await logInNewUser(page.request);
  const horror = await createList(page.request, "Horror");
  const comfort = await createList(page.request, "Comfort");
  await page.goto("/");

  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");
  await searchResult(page, "Alien (1979)").getByRole("button", { name: "Add to list" }).click();
  const dialog = page.getByRole("dialog", { name: "Lists for Alien (1979)" });
  await dialog.getByRole("checkbox", { name: "Horror" }).click();
  await dialog.getByRole("checkbox", { name: "Comfort" }).click();
  await expect(dialog.getByRole("checkbox", { name: "Comfort" })).toBeChecked();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  expect(await listItemsOf(page.request, horror)).toHaveLength(1);
  expect(await listItemsOf(page.request, comfort)).toHaveLength(1);

  // Opened again, it shows where the film is, and unticking takes it off.
  await searchResult(page, "Alien (1979)").getByRole("button", { name: "Add to list" }).click();
  await expect(dialog.getByRole("checkbox", { name: "Horror" })).toBeChecked();
  await dialog.getByRole("checkbox", { name: "Comfort" }).click();
  await expect(dialog.getByRole("checkbox", { name: "Comfort" })).not.toBeChecked();
  await dialog.getByRole("button", { name: "Done" }).click();
  expect(await listItemsOf(page.request, horror)).toHaveLength(1);
  expect(await listItemsOf(page.request, comfort)).toHaveLength(0);
});

test("a List unticked and ticked again gets the film back where it was, with its Note", async ({
  page,
}) => {
  await logInNewUser(page.request);
  const horror = await createList(page.request, "Horror");
  const alienId = (await alien(page.request)).id;
  for (const data of [
    { mediaItemId: alienId, note: "Watch it first." },
    { mediaItemId: (await aliens(page.request)).id },
  ]) {
    expect((await page.request.post(`/api/lists/${horror}/items`, { data })).status()).toBe(201);
  }
  await page.goto(`/items/${alienId}`);

  await page.getByRole("button", { name: "Add to list" }).click();
  const dialog = page.getByRole("dialog", { name: "Lists for Alien (1979)" });
  const box = dialog.getByRole("checkbox", { name: "Horror" });
  await box.click();
  await expect(box).not.toBeChecked();
  await box.click();
  await expect(box).toBeChecked();

  const items = await listItemsOf(page.request, horror);
  expect(items.map((item: { mediaItem: { id: number } }) => item.mediaItem.id)[0]).toBe(alienId);
  expect(items[0].note).toBe("Watch it first.");
});

test("a User with no Lists is pointed to the Lists page", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto(`/items/${(await alien(page.request)).id}`);

  await page.getByRole("button", { name: "Add to list" }).click();
  const dialog = page.getByRole("dialog", { name: "Lists for Alien (1979)" });
  await expect(dialog).toContainText("You have no Lists yet.");
  await dialog.getByRole("link", { name: "Make a List" }).click();

  await expect(page).toHaveURL(/\/lists$/);
});
