import { type APIRequestContext, expect, test } from "@playwright/test";
import { logInNewUser } from "../support/users";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien.

test("a User marks a search result Watched, rates it and finds it in their Log", {
  tag: "@smoke",
}, async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");
  const alien = page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Alien (1979)", { exact: true }) });

  await alien.getByRole("button", { name: "Watched" }).click();
  const dialog = page.getByRole("dialog", { name: "Log Alien (1979)" });
  await dialog.getByRole("radio", { name: "4.5 stars" }).check();
  await dialog.getByLabel("Review").fill("Still terrifying.");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  await expect(alien.getByText("In your Log")).toBeVisible();
  await page.getByRole("link", { name: "Log", exact: true }).click();
  const entry = page.getByRole("list", { name: "Log Entries" }).getByRole("listitem");
  await expect(entry).toHaveCount(1);
  await expect(entry.getByText("Alien (1979)", { exact: true })).toBeVisible();
  await expect(entry.getByText("Чужий", { exact: true })).toBeVisible();
  await expect(entry.getByRole("img", { name: "4.5 stars" })).toBeVisible();
  await expect(entry.getByText("Still terrifying.")).toBeVisible();
});

test("a Rating is required, and a date and Rewatch are kept", async ({ page }) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");
  await page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Alien (1979)", { exact: true }) })
    .getByRole("button", { name: "Watched" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Log Alien (1979)" });

  await dialog.getByLabel("Date").fill("2001-09-15");
  await dialog.getByRole("checkbox", { name: "Rewatch" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "3 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: "Log", exact: true }).click();
  const entry = page.getByRole("list", { name: "Log Entries" }).getByRole("listitem");
  await expect(entry.getByRole("img", { name: "3 stars" })).toBeVisible();
  await expect(entry.getByText("15 Sep 2001")).toBeVisible();
  await expect(entry.getByText("Rewatch", { exact: true })).toBeVisible();
});

// Logs Alien through the API, which is quicker than the dialog and not what these tests are about.
async function logAlien(api: APIRequestContext, entries: object[]) {
  const search = await api.get("/api/catalog/search", {
    params: { mediaType: "film", query: "alien" },
  });
  const { results } = await search.json();
  const result = results.find((r: { externalReference: { id: string } }) => {
    return r.externalReference.id === "348";
  });
  const { mediaItem } = await (await api.post("/api/catalog/items", { data: result })).json();
  for (const entry of entries) {
    const response = await api.post("/api/log-entries", {
      data: { mediaItemId: mediaItem.id, ...entry },
    });
    expect(response.status()).toBe(201);
  }
}

test("a User opens a film's Item History from the Log, edits an entry and deletes entries", {
  tag: "@smoke",
}, async ({ page }) => {
  await logInNewUser(page.request);
  await logAlien(page.request, [
    { rating: 3, date: "2001-09-15", review: "First time." },
    { rating: 4.5, date: "2026-10-01" },
  ]);
  await page.goto("/log");
  await page
    .getByRole("link", { name: /^Alien \(1979\)/ })
    .first()
    .click();

  await expect(page.getByRole("heading", { name: /^Alien \(1979\)/ })).toBeVisible();
  await expect(page.getByText("Watched 2 times")).toBeVisible();
  const currentRating = page.getByRole("definition");
  await expect(currentRating.getByRole("img", { name: "4.5 stars" })).toBeVisible();
  const entries = page.getByRole("list", { name: "Item History" }).getByRole("listitem");
  await expect(entries.first()).toContainText("15 Sep 2001");

  // Moving the 2001 entry after the other makes it last, and its Rating current.
  await entries.filter({ hasText: "15 Sep 2001" }).getByRole("button", { name: "Edit" }).click();
  const editing = page.getByRole("dialog", { name: "Edit your entry for Alien (1979)" });
  await expect(editing.getByRole("radio", { name: "3 stars" })).toBeChecked();
  await expect(editing.getByLabel("Review")).toHaveValue("First time.");
  await editing.getByLabel("Date").fill("2026-10-02");
  await editing.getByRole("button", { name: "Save" }).click();
  await expect(editing).toBeHidden();
  await expect(entries.first()).toContainText("1 Oct 2026");
  await expect(entries.last()).toContainText("2 Oct 2026");
  await expect(currentRating.getByRole("img", { name: "3 stars" })).toBeVisible();

  // Deleting asks first, and cancelling keeps the entry.
  const deleteLast = entries
    .filter({ hasText: "2 Oct 2026" })
    .getByRole("button", { name: "Delete" });
  await deleteLast.click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this entry?" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await expect(entries).toHaveCount(2);
  await deleteLast.click();
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(confirm).toBeHidden();
  await expect(entries).toHaveCount(1);
  await expect(page.getByText("Watched once")).toBeVisible();
  await expect(currentRating.getByRole("img", { name: "4.5 stars" })).toBeVisible();

  // Deleting the only entry leaves the film not watched, with no Current Rating.
  await entries.getByRole("button", { name: "Delete" }).click();
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Not watched yet")).toBeVisible();
  await expect(entries).toHaveCount(0);
  await expect(currentRating).toHaveCount(0);
});

test("Rewatch is ticked when the film is already in the Log, and can be unticked", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");
  const alien = page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Alien (1979)", { exact: true }) });
  const dialog = page.getByRole("dialog", { name: "Log Alien (1979)" });
  const rewatch = dialog.getByRole("checkbox", { name: "Rewatch" });

  await alien.getByRole("button", { name: "Watched" }).click();
  await expect(rewatch).not.toBeChecked();
  await dialog.getByRole("radio", { name: "4 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await alien.getByRole("button", { name: "Watched" }).click();
  await expect(rewatch).toBeChecked();
  await rewatch.uncheck();
  await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("link", { name: "Log", exact: true }).click();
  const entries = page.getByRole("list", { name: "Log Entries" }).getByRole("listitem");
  await expect(entries).toHaveCount(2);
  await expect(entries.getByText("Rewatch", { exact: true })).toHaveCount(0);
});
