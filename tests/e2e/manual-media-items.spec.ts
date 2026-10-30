import { expect, type Page, test } from "@playwright/test";
import { logInNewUser } from "../support/users";

// A film neither the TMDB fake nor the real TMDB knows, so only the User's own copy is found.
const wedding = "Весілля Олени та Тараса";

function searchResult(page: Page, label: string) {
  return page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText(label, { exact: true }) });
}

test("a User adds a film search doesn't find, logs it, edits it, and deletes it with its Log Entry", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search films" });
  await search.fill("весілля олени");
  await expect(page.getByText("No films found.")).toBeVisible();

  // Adding it manually starts from the query.
  await page.getByRole("button", { name: "Add manually" }).click();
  const adding = page.getByRole("dialog", { name: "Add a film manually" });
  await expect(adding.getByLabel("Title", { exact: true })).toHaveValue("весілля олени");
  await adding.getByLabel("Title", { exact: true }).fill(wedding);
  await adding.getByLabel("Year").fill("2019");
  await adding.getByLabel("Minutes").fill("95");
  await adding.getByRole("checkbox", { name: "Documentary" }).check();
  await adding.getByRole("button", { name: "Add", exact: true }).click();

  await expect(adding).toBeHidden();
  await expect(page.getByText(`Added ${wedding} (2019). Only you can see it.`)).toBeVisible();
  const film = searchResult(page, `${wedding} (2019)`);
  await expect(film.getByText("Added by you")).toBeVisible();

  // It is planned and logged like any film.
  await film.getByRole("button", { name: "Want to watch" }).click();
  await expect(film.getByText("On your Watchlist")).toBeVisible();
  await film.getByRole("button", { name: "Watched" }).click();
  const logging = page.getByRole("dialog", { name: `Log ${wedding} (2019)` });
  await logging.getByRole("radio", { name: "5 stars", exact: true }).check();
  await logging.getByRole("button", { name: "Save" }).click();
  await expect(film.getByText("In your Log")).toBeVisible();

  // A later search lists it first.
  await page.reload();
  await search.fill("олени");
  const first = page.getByRole("list", { name: "Search results" }).getByRole("listitem").first();
  await expect(first).toContainText(`${wedding} (2019)`);
  await expect(first).toContainText("In your Log");

  // Its page, reached from the Log, edits it.
  await page.getByRole("link", { name: "Log", exact: true }).click();
  await page.getByRole("link", { name: `${wedding} (2019)` }).click();
  await expect(page.getByText("You added this film manually.")).toBeVisible();
  await expect(page.getByText("95 min · Documentary")).toBeVisible();
  await page.getByRole("button", { name: "Edit film" }).click();
  const editing = page.getByRole("dialog", { name: `Edit ${wedding} (2019)` });
  await expect(editing.getByLabel("Minutes")).toHaveValue("95");
  await expect(editing.getByRole("checkbox", { name: "Documentary" })).toBeChecked();
  await editing.getByLabel("Original Title").fill("Olena and Taras's wedding");
  await editing.getByRole("button", { name: "Save" }).click();
  const renamed = `${wedding} (Olena and Taras's wedding, 2019)`;
  await expect(page.getByRole("heading", { name: renamed })).toBeVisible();

  // Deleting it says what goes with it, then empties the Log.
  await page.getByRole("button", { name: "Delete film" }).click();
  const confirm = page.getByRole("alertdialog", { name: `Delete ${renamed}?` });
  await expect(confirm).toContainText("Your Log Entry for it will be deleted.");
  await expect(confirm).toContainText("It isn't on your Watchlist or in any of your Lists.");
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Your Log is empty.")).toBeVisible();
});

test("adding a film with the same title and year again warns first, then adds it anyway", async ({
  page,
}) => {
  await logInNewUser(page.request);
  const created = await page.request.post("/api/catalog/manual-items", {
    data: { mediaType: "film", title: wedding, year: 2019 },
  });
  expect(created.status()).toBe(201);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("весілля олени");
  await expect(searchResult(page, `${wedding} (2019)`)).toHaveCount(1);

  await page.getByRole("button", { name: "Add manually" }).click();
  const adding = page.getByRole("dialog", { name: "Add a film manually" });
  await adding.getByLabel("Title", { exact: true }).fill(wedding);
  await adding.getByLabel("Year").fill("2019");
  await adding.getByRole("button", { name: "Add", exact: true }).click();

  await expect(adding.getByRole("alert")).toHaveText(
    "You've already added a film with this title and year. Add another one anyway?",
  );
  await adding.getByRole("button", { name: "Add anyway" }).click();
  await expect(adding).toBeHidden();
  await expect(searchResult(page, `${wedding} (2019)`)).toHaveCount(2);
});

test("a thumbnail without a poster is named No poster and shows no caption", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("весілля олени");
  await page.getByRole("button", { name: "Add manually" }).click();
  const adding = page.getByRole("dialog", { name: "Add a film manually" });
  await adding.getByLabel("Title", { exact: true }).fill(wedding);
  await adding.getByRole("button", { name: "Add", exact: true }).click();

  await expect(searchResult(page, wedding).getByRole("img", { name: "No poster" })).toHaveText("");
  await searchResult(page, wedding).getByRole("link", { name: wedding }).click();

  await expect(page.getByRole("main").getByRole("img", { name: "No poster" })).toHaveText("");
});

test("a film added manually but never logged or planned is still reached from search, to delete it", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("весілля олени");
  await page.getByRole("button", { name: "Add manually" }).click();
  const adding = page.getByRole("dialog", { name: "Add a film manually" });
  await adding.getByLabel("Title", { exact: true }).fill(wedding);
  await adding.getByRole("button", { name: "Add", exact: true }).click();

  await searchResult(page, wedding).getByRole("link", { name: wedding }).click();

  await expect(page.getByText("Not watched yet")).toBeVisible();
  await page.getByRole("button", { name: "Delete film" }).click();
  const confirm = page.getByRole("alertdialog", { name: `Delete ${wedding}?` });
  await expect(confirm).toContainText("You have no Log Entries for it.");
  await confirm.getByRole("button", { name: "Delete" }).click();
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("весілля олени");
  await expect(page.getByText("No films found.")).toBeVisible();
});
