import { expect, type Page, test } from "@playwright/test";
import { logInNewUser } from "../support/users";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien and Aliens.

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
  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");
  const alien = searchResult(page, "Alien (1979)");
  const aliens = searchResult(page, "Aliens (1986)");
  await alien.getByRole("button", { name: "Add" }).click();
  await expect(alien.getByText("In this List")).toBeVisible();
  await expect(alien.getByRole("button", { name: "Add" })).toHaveCount(0);
  await aliens.getByRole("button", { name: "Add" }).click();
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
