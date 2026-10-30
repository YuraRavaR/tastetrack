import { type APIRequestContext, expect, type Locator, type Page, test } from "@playwright/test";
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
  const dialog = page.getByRole("dialog", { name: "Alien", exact: true });
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

// Opens the dialog for Alien from search, with the browser's clock on a day the Worker accepts.
async function openWatchedDialog(page: Page) {
  await page.clock.setFixedTime(new Date("2026-03-15T12:00:00"));
  await logInNewUser(page.request);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");
  await page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Alien (1979)", { exact: true }) })
    .getByRole("button", { name: "Watched" })
    .click();
  return page.getByRole("dialog", { name: "Alien", exact: true });
}

async function saveRatedEntry(page: Page, dialog: Locator) {
  await dialog.getByRole("radio", { name: "3 stars" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: "Log", exact: true }).click();
  return page.getByRole("list", { name: "Log Entries" }).getByRole("listitem");
}

test("a new Log Entry is dated today unless the User says otherwise", async ({ page }) => {
  const dialog = await openWatchedDialog(page);

  await expect(dialog.getByRole("button", { name: "Today" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dialog.getByLabel("Date watched")).toHaveCount(0);

  const entry = await saveRatedEntry(page, dialog);
  await expect(entry.getByText("Mar 15, 2026")).toBeVisible();
});

test("Yesterday dates a Log Entry the day before", async ({ page }) => {
  const dialog = await openWatchedDialog(page);

  await dialog.getByRole("button", { name: "Yesterday" }).click();

  const entry = await saveRatedEntry(page, dialog);
  await expect(entry.getByText("Mar 14, 2026")).toBeVisible();
});

test("Other date saves the date in its field, bounded by 1900 and today", async ({ page }) => {
  const dialog = await openWatchedDialog(page);

  await dialog.getByRole("button", { name: "Other date" }).click();
  const date = dialog.getByLabel("Date watched");
  await expect(date).toHaveAttribute("min", "1900-01-01");
  await expect(date).toHaveAttribute("max", "2026-03-15");
  await date.fill("2001-09-15");

  const entry = await saveRatedEntry(page, dialog);
  await expect(entry.getByText("Sep 15, 2001")).toBeVisible();
});

test("Other date with an empty field asks for a date", async ({ page }) => {
  const dialog = await openWatchedDialog(page);

  await dialog.getByRole("radio", { name: "3 stars" }).check();
  await dialog.getByRole("button", { name: "Other date" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("That isn't a valid date.")).toBeVisible();

  await dialog.getByRole("button", { name: "Today" }).click();
  await expect(dialog.getByText("That isn't a valid date.")).toBeHidden();
});

test("No date saves an undated Log Entry", async ({ page }) => {
  const dialog = await openWatchedDialog(page);

  await dialog.getByRole("button", { name: "No date" }).click();

  const entry = await saveRatedEntry(page, dialog);
  await expect(entry.getByText("No date")).toBeVisible();
});

test("a Rating is required, and Rewatch is kept", async ({ page }) => {
  const dialog = await openWatchedDialog(page);

  await dialog.getByRole("switch", { name: "Rewatch" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Choose a Rating.");

  const entry = await saveRatedEntry(page, dialog);
  await expect(entry.getByRole("img", { name: "3 stars" })).toBeVisible();
  await expect(entry.getByText("Rewatch", { exact: true })).toBeVisible();
});

test("the dialog shows the film, and its Rating as a number", async ({ page }) => {
  const dialog = await openWatchedDialog(page);

  await expect(dialog).toHaveAccessibleDescription("1979");
  await expect(dialog.getByText("–", { exact: true })).toBeVisible();
  await dialog.getByRole("radio", { name: "4.5 stars" }).check();
  await expect(dialog.getByText("4.5", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Saving takes it off your Watchlist")).toHaveCount(0);
});

test("Close, Cancel and Esc close the dialog without saving", async ({ page }) => {
  const dialog = await openWatchedDialog(page);
  const alien = page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Alien (1979)", { exact: true }) });

  await dialog.getByRole("radio", { name: "3 stars" }).check();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();

  await alien.getByRole("button", { name: "Watched" }).click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await alien.getByRole("button", { name: "Watched" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(alien.getByText("In your Log")).toHaveCount(0);
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
  return mediaItem.id;
}

// Opens the Item History of the film logAlien logged, from the Log.
async function openAlienFromLog(page: Page) {
  await page.goto("/log");
  await page
    .getByRole("link", { name: /^Alien \(1979\)/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /^Alien \(1979\)/ })).toBeVisible();
}

test("a User opens a film's Item History from the Log, edits an entry and deletes entries", {
  tag: "@smoke",
}, async ({ page }) => {
  await logInNewUser(page.request);
  await logAlien(page.request, [
    { rating: 3, date: "2001-09-15", review: "First time." },
    { rating: 4.5, date: "2026-10-01" },
  ]);
  await openAlienFromLog(page);

  const stats = page.getByRole("definition");
  await expect(stats).toHaveText(["2 times", "4.5", "Sep 15, 2001"]);
  const entries = page.getByRole("list", { name: "Viewings" }).getByRole("listitem");
  await expect(entries.first()).toContainText("Oct 1, 2026");

  // Moving the 2001 entry after the other makes it newest, and its Rating current.
  await page.getByRole("button", { name: "Actions for Sep 15, 2001" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editing = page.getByRole("dialog", { name: "Edit your entry for Alien" });
  await expect(editing.getByRole("radio", { name: "3 stars" })).toBeChecked();
  await expect(editing.getByLabel("Review")).toHaveValue("First time.");
  await editing.getByLabel("Date watched").fill("2026-10-02");
  await editing.getByRole("button", { name: "Save" }).click();
  await expect(editing).toBeHidden();
  await expect(entries.first()).toContainText("Oct 2, 2026");
  await expect(entries.last()).toContainText("Oct 1, 2026");
  await expect(stats).toHaveText(["2 times", "3", "Oct 1, 2026"]);

  // Deleting asks first, and cancelling keeps the entry.
  const actionsForNewest = page.getByRole("button", { name: "Actions for Oct 2, 2026" });
  await actionsForNewest.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this entry?" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await expect(entries).toHaveCount(2);
  await actionsForNewest.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(confirm).toBeHidden();
  await expect(entries).toHaveCount(1);
  await expect(stats).toHaveText(["Once", "4.5", "Oct 1, 2026"]);

  // Deleting the only entry leaves the film not watched, with no tiles.
  await page.getByRole("button", { name: "Actions for Oct 1, 2026" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No viewings yet")).toBeVisible();
  await expect(entries).toHaveCount(0);
  await expect(stats).toHaveCount(0);
});

test("the tiles name a film watched once, and a dash stands in for a date none has", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await logAlien(page.request, [{ rating: 3.5 }]);
  await openAlienFromLog(page);

  await expect(page.getByRole("term")).toHaveText(["Watched", "Your rating", "First watched"]);
  const stats = page.getByRole("definition");
  await expect(stats).toHaveText(["Once", "3.5", "–"]);
  await expect(stats.getByRole("img", { name: "3.5 stars" })).toBeVisible();
  await expect(stats.getByRole("img", { name: "No date" })).toBeVisible();
});

test("Viewings lists the newest first, with undated entries at the bottom", async ({ page }) => {
  await logInNewUser(page.request);
  await logAlien(page.request, [
    { rating: 2, date: "2019-03-02", review: "Too slow for me." },
    { rating: 3 },
    { rating: 4, date: "2026-10-11", revisit: true },
  ]);
  await openAlienFromLog(page);

  await expect(page.getByRole("heading", { name: "Viewings", level: 2 })).toBeVisible();
  const entries = page.getByRole("list", { name: "Viewings" }).getByRole("listitem");
  await expect(entries).toHaveCount(3);
  await expect(entries.nth(0)).toContainText("Oct 11, 2026");
  await expect(entries.nth(0).getByText("Rewatch", { exact: true })).toBeVisible();
  await expect(entries.nth(1)).toContainText("Mar 2, 2019");
  await expect(entries.nth(1).getByRole("img", { name: "2 stars" })).toBeVisible();
  await expect(entries.nth(1).getByText("Too slow for me.")).toBeVisible();
  await expect(entries.nth(2)).toContainText("No date");
  await expect(entries.nth(2).getByRole("button", { name: "Actions for No date" })).toBeVisible();

  // The display order changes nothing else: the Current Rating is still the last in Log Order.
  await expect(page.getByRole("definition")).toHaveText(["3 times", "4", "Mar 2, 2019"]);
});

test('the "⋯" menu holds Edit, a separator and Delete, and the page works after it', async ({
  page,
}) => {
  await logInNewUser(page.request);
  await logAlien(page.request, [{ rating: 3, date: "2001-09-15" }]);
  await openAlienFromLog(page);

  await page.getByRole("button", { name: "Actions for Sep 15, 2001" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText(["Edit", "Delete"]);
  await expect(menu.getByRole("separator")).toBeVisible();

  // A dialog opened from the menu hands the page back when it closes.
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editing = page.getByRole("dialog", { name: "Edit your entry for Alien" });
  await editing.getByRole("button", { name: "Cancel" }).click();
  await expect(editing).toBeHidden();
  await page.getByRole("button", { name: "Add to list" }).click();
  await expect(page.getByRole("dialog", { name: "Lists for Alien (1979)" })).toBeVisible();
});

test("Rewatch is on when the film is already in the Log, and can be turned off", async ({
  page,
}) => {
  await logInNewUser(page.request);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("alien");
  const alien = page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText("Alien (1979)", { exact: true }) });
  const dialog = page.getByRole("dialog", { name: "Alien", exact: true });
  const rewatch = dialog.getByRole("switch", { name: "Rewatch" });

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

test("editing opens on the chip that matches the entry's date", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-03-15T12:00:00"));
  await logInNewUser(page.request);
  const id = await logAlien(page.request, [
    { rating: 1, date: "2026-03-15" },
    { rating: 2, date: "2026-03-14" },
    { rating: 3 },
    { rating: 4, date: "2001-09-15" },
  ]);
  await page.goto(`/items/${id}`);
  const editing = page.getByRole("dialog", { name: "Edit your entry for Alien" });

  for (const [row, chip] of [
    ["Mar 15, 2026", "Today"],
    ["Mar 14, 2026", "Yesterday"],
    ["No date", "No date"],
    ["Sep 15, 2001", "Other date"],
  ] as const) {
    await page.getByRole("button", { name: `Actions for ${row}` }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(editing.getByRole("button", { name: chip })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(editing.getByRole("button", { pressed: true })).toHaveCount(1);
    if (chip === "Other date") {
      await expect(editing.getByLabel("Date watched")).toHaveValue("2001-09-15");
    }
    await editing.getByRole("button", { name: "Cancel" }).click();
    await expect(editing).toBeHidden();
  }
});

test("Delete in the edit dialog asks first, then removes the entry", async ({ page }) => {
  await logInNewUser(page.request);
  const id = await logAlien(page.request, [
    { rating: 3, date: "2001-09-15" },
    { rating: 4, date: "2019-03-02" },
  ]);
  await page.goto(`/items/${id}`);

  await page.getByRole("button", { name: "Actions for Sep 15, 2001" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editing = page.getByRole("dialog", { name: "Edit your entry for Alien" });
  await editing.getByRole("button", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this entry?" });
  await expect(editing).toBeHidden();
  await confirm.getByRole("button", { name: "Delete" }).click();

  await expect(confirm).toBeHidden();
  await expect(page.getByRole("button", { name: "Actions for Sep 15, 2001" })).toHaveCount(0);
  // The page is usable again once both dialogs have closed.
  await page.getByRole("button", { name: "Actions for Mar 2, 2019" }).click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
});
