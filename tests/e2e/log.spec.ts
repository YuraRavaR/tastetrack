import type { Page } from "@playwright/test";
import type { NewLogEntryRequest } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { alien } from "../support/scenarios/films";
import type { LogEntryDialog } from "../support/ui/components/LogEntryDialog";
import { expect, test } from "../support/ui/fixtures";
import type { Ui } from "../support/ui/Ui";

// Locally the Worker calls a TMDB fake; on staging, the real TMDB. Both know Alien.

test("a User marks a search result Watched, rates it and finds it in their Log", {
  tag: "@smoke",
}, async ({ loggedInUi: ui }) => {
  const { homePage, logPage } = ui;
  await homePage.goto();
  await homePage.search("alien");
  const alien = homePage.searchResults.result("Alien (1979)");

  await alien.markWatchedButton.click();
  const dialog = homePage.logEntryDialog("Alien");
  await dialog.rate("4.5 stars");
  await dialog.reviewInput.fill("Still terrifying.");
  await dialog.save();

  await expect(dialog.root).toBeHidden();
  await expect(alien.itemHistoryLink("4.5 · 1 viewing")).toBeVisible();
  await homePage.mainNav.link("Log").click();
  await expect(logPage.entries).toHaveCount(1);
  const entry = logPage.entry(0);
  await expect(entry.text("Alien (1979)", { exact: true })).toBeVisible();
  await expect(entry.text("Чужий", { exact: true })).toBeVisible();
  await expect(entry.ratingStars("4.5 stars")).toBeVisible();
  await expect(entry.text("Still terrifying.")).toBeVisible();
});

// Opens the dialog for Alien from search, with the browser's clock on a day the Worker accepts.
async function openWatchedDialog(page: Page, { homePage }: Ui) {
  await page.clock.setFixedTime(new Date("2026-03-15T12:00:00"));
  await homePage.goto();
  await homePage.search("alien");
  await homePage.searchResults.result("Alien (1979)").markWatchedButton.click();
  return homePage.logEntryDialog("Alien");
}

async function saveRatedEntry({ homePage, logPage }: Ui, dialog: LogEntryDialog) {
  await dialog.rate("3 stars");
  await dialog.save();
  await expect(dialog.root).toBeHidden();
  await homePage.mainNav.link("Log").click();
  return logPage.entry(0);
}

test("a new Log Entry is dated today unless the User says otherwise", async ({
  page,
  loggedInUi: ui,
}) => {
  const dialog = await openWatchedDialog(page, ui);

  await expect(dialog.dateChip("Today")).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.dateInput).toHaveCount(0);

  const entry = await saveRatedEntry(ui, dialog);
  await expect(entry.text("Mar 15, 2026")).toBeVisible();
});

test("Yesterday dates a Log Entry the day before", async ({ page, loggedInUi: ui }) => {
  const dialog = await openWatchedDialog(page, ui);

  await dialog.dateChip("Yesterday").click();

  const entry = await saveRatedEntry(ui, dialog);
  await expect(entry.text("Mar 14, 2026")).toBeVisible();
});

test("Other date saves the date in its field, bounded by 1900 and today", async ({
  page,
  loggedInUi: ui,
}) => {
  const dialog = await openWatchedDialog(page, ui);

  await dialog.dateChip("Other date").click();
  await expect(dialog.dateInput).toHaveAttribute("min", "1900-01-01");
  await expect(dialog.dateInput).toHaveAttribute("max", "2026-03-15");
  await dialog.dateInput.fill("2001-09-15");

  const entry = await saveRatedEntry(ui, dialog);
  await expect(entry.text("Sep 15, 2001")).toBeVisible();
});

test("Other date with an empty field asks for a date", async ({ page, loggedInUi: ui }) => {
  const dialog = await openWatchedDialog(page, ui);

  await dialog.rate("3 stars");
  await dialog.dateChip("Other date").click();
  await dialog.save();
  await expect(dialog.dateError).toBeVisible();

  await dialog.dateChip("Today").click();
  await expect(dialog.dateError).toBeHidden();
});

test("No date saves an undated Log Entry", async ({ page, loggedInUi: ui }) => {
  const dialog = await openWatchedDialog(page, ui);

  await dialog.dateChip("No date").click();

  const entry = await saveRatedEntry(ui, dialog);
  await expect(entry.text("No date")).toBeVisible();
});

test("a Rating is required, and Rewatch is kept", async ({ page, loggedInUi: ui }) => {
  const dialog = await openWatchedDialog(page, ui);

  await dialog.rewatchSwitch.check();
  await dialog.save();
  await expect(dialog.errorMessage).toHaveText("Choose a Rating.");

  const entry = await saveRatedEntry(ui, dialog);
  await expect(entry.ratingStars("3 stars")).toBeVisible();
  await expect(entry.text("Rewatch", { exact: true })).toBeVisible();
});

test("the dialog shows the film, and its Rating as a number", async ({ page, loggedInUi: ui }) => {
  const dialog = await openWatchedDialog(page, ui);

  await expect(dialog.root).toHaveAccessibleDescription("1979");
  await expect(dialog.shownRating("–")).toBeVisible();
  await dialog.rate("4.5 stars");
  await expect(dialog.shownRating("4.5")).toBeVisible();
  await expect(dialog.watchlistNote).toHaveCount(0);
});

test("Close, Cancel and Esc close the dialog without saving", async ({ page, loggedInUi: ui }) => {
  const dialog = await openWatchedDialog(page, ui);
  const alien = ui.homePage.searchResults.result("Alien (1979)");

  await dialog.rate("3 stars");
  await dialog.closeButton.click();
  await expect(dialog.root).toBeHidden();

  await alien.markWatchedButton.click();
  await dialog.cancelButton.click();
  await expect(dialog.root).toBeHidden();

  await alien.markWatchedButton.click();
  await page.keyboard.press("Escape");
  await expect(dialog.root).toBeHidden();
  await expect(alien.watchedAgainButton).toHaveCount(0);
});

// Logs Alien through the API, which is quicker than the dialog and not what these tests are about.
async function logAlien(api: ApiClient, entries: Omit<NewLogEntryRequest, "mediaItemId">[]) {
  const { id: mediaItemId } = await alien(api);
  for (const entry of entries) {
    const response = await api.log.createLogEntry({ mediaItemId, ...entry });
    expect(response.status()).toBe(201);
  }
  return mediaItemId;
}

// Opens the Item History of the film logAlien logged, from the Log.
async function openAlienFromLog({ logPage, filmPage }: Ui) {
  await logPage.goto();
  await logPage
    .filmLink(/^Alien \(1979\)/)
    .first()
    .click();
  await expect(filmPage.heading).toHaveText(/^Alien \(1979\)/);
}

test("a User opens a film's Item History from the Log, edits an entry and deletes entries", {
  tag: "@smoke",
}, async ({ ui, loggedInApi: api }) => {
  await logAlien(api, [
    { rating: 3, date: "2001-09-15", review: "First time." },
    { rating: 4.5, date: "2026-10-01" },
  ]);
  await openAlienFromLog(ui);
  const { filmPage } = ui;
  const { stats, viewings, deleteEntryDialog: confirm } = filmPage;

  await expect(stats).toHaveText(["2 times", "4.5", "Sep 15, 2001"]);
  await expect(viewings.first()).toContainText("Oct 1, 2026");

  // Moving the 2001 entry after the other makes it newest, and its Rating current.
  await filmPage.chooseEntryAction("Sep 15, 2001", "Edit");
  const editing = filmPage.logEntryDialog("Edit your entry for Alien");
  await expect(editing.ratingRadio("3 stars")).toBeChecked();
  await expect(editing.reviewInput).toHaveValue("First time.");
  await editing.dateInput.fill("2026-10-02");
  await editing.save();
  await expect(editing.root).toBeHidden();
  await expect(viewings.first()).toContainText("Oct 2, 2026");
  await expect(viewings.last()).toContainText("Oct 1, 2026");
  await expect(stats).toHaveText(["2 times", "3", "Oct 1, 2026"]);

  // Deleting asks first, and cancelling keeps the entry.
  await filmPage.chooseEntryAction("Oct 2, 2026", "Delete");
  await confirm.cancel();
  await expect(confirm.root).toBeHidden();
  await expect(viewings).toHaveCount(2);
  await filmPage.chooseEntryAction("Oct 2, 2026", "Delete");
  await confirm.confirm("Delete");
  await expect(confirm.root).toBeHidden();
  await expect(viewings).toHaveCount(1);
  await expect(stats).toHaveText(["Once", "4.5", "Oct 1, 2026"]);

  // Deleting the only entry leaves the film not watched, with no tiles.
  await filmPage.chooseEntryAction("Oct 1, 2026", "Delete");
  await confirm.confirm("Delete");
  await expect(filmPage.noViewingsMessage).toBeVisible();
  await expect(viewings).toHaveCount(0);
  await expect(stats).toHaveCount(0);
});

test("the tiles name a film watched once, and a dash stands in for a date none has", async ({
  ui,
  loggedInApi: api,
}) => {
  await logAlien(api, [{ rating: 3.5 }]);
  await openAlienFromLog(ui);
  const { filmPage } = ui;

  await expect(filmPage.statNames).toHaveText(["Watched", "Your rating", "First watched"]);
  await expect(filmPage.stats).toHaveText(["Once", "3.5", "–"]);
  await expect(filmPage.statImage("3.5 stars")).toBeVisible();
  await expect(filmPage.statImage("No date")).toBeVisible();
});

test("Viewings lists the newest first, with undated entries at the bottom", async ({
  ui,
  loggedInApi: api,
}) => {
  await logAlien(api, [
    { rating: 2, date: "2019-03-02", review: "Too slow for me." },
    { rating: 3 },
    { rating: 4, date: "2026-10-11", revisit: true },
  ]);
  await openAlienFromLog(ui);
  const { filmPage } = ui;
  const { viewings } = filmPage;

  await expect(filmPage.viewingsHeading).toBeVisible();
  await expect(viewings).toHaveCount(3);
  await expect(viewings.nth(0)).toContainText("Oct 11, 2026");
  await expect(filmPage.viewing(0).rewatchBadge).toBeVisible();
  await expect(viewings.nth(1)).toContainText("Mar 2, 2019");
  await expect(filmPage.viewing(1).ratingStars("2 stars")).toBeVisible();
  await expect(filmPage.viewing(1).text("Too slow for me.")).toBeVisible();
  await expect(viewings.nth(2)).toContainText("No date");
  await expect(filmPage.viewing(2).actionsButton("No date")).toBeVisible();

  // The display order changes nothing else: the Current Rating is still the last in Log Order.
  await expect(filmPage.stats).toHaveText(["3 times", "4", "Mar 2, 2019"]);
});

test('the "⋯" menu holds Edit, a separator and Delete, and the page works after it', async ({
  ui,
  loggedInApi: api,
}) => {
  await logAlien(api, [{ rating: 3, date: "2001-09-15" }]);
  await openAlienFromLog(ui);
  const { filmPage } = ui;
  const menu = filmPage.entryActionsMenu;

  await filmPage.entryActionsButton("Sep 15, 2001").click();
  await expect(menu.items).toHaveText(["Edit", "Delete"]);
  await expect(menu.separator).toBeVisible();

  // A dialog opened from the menu hands the page back when it closes.
  await menu.item("Edit").click();
  const editing = filmPage.logEntryDialog("Edit your entry for Alien");
  await editing.cancelButton.click();
  await expect(editing.root).toBeHidden();
  await filmPage.addToListButton.click();
  await expect(filmPage.filmListsDialog("Alien (1979)").root).toBeVisible();
});

test("Rewatch is on when the film is already in the Log, and can be turned off", async ({
  loggedInUi: ui,
}) => {
  const { homePage, logPage } = ui;
  await homePage.goto();
  await homePage.search("alien");
  const alien = homePage.searchResults.result("Alien (1979)");
  const dialog = homePage.logEntryDialog("Alien");
  const rewatch = dialog.rewatchSwitch;

  await alien.markWatchedButton.click();
  await expect(rewatch).not.toBeChecked();
  await dialog.rate("4 stars");
  await dialog.save();
  await expect(dialog.root).toBeHidden();

  await alien.watchedAgainButton.click();
  await expect(rewatch).toBeChecked();
  await rewatch.uncheck();
  await dialog.rate("5 stars");
  await dialog.save();
  await expect(dialog.root).toBeHidden();

  await homePage.mainNav.link("Log").click();
  await expect(logPage.entries).toHaveCount(2);
  await expect(logPage.rewatchBadges).toHaveCount(0);
});

test("editing opens on the chip that matches the entry's date", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await page.clock.setFixedTime(new Date("2026-03-15T12:00:00"));
  const id = await logAlien(api, [
    { rating: 1, date: "2026-03-15" },
    { rating: 2, date: "2026-03-14" },
    { rating: 3 },
    { rating: 4, date: "2001-09-15" },
  ]);
  const { filmPage } = ui;
  await filmPage.goto(id);
  const editing = filmPage.logEntryDialog("Edit your entry for Alien");

  for (const [row, chip] of [
    ["Mar 15, 2026", "Today"],
    ["Mar 14, 2026", "Yesterday"],
    ["No date", "No date"],
    ["Sep 15, 2001", "Other date"],
  ] as const) {
    await filmPage.chooseEntryAction(row, "Edit");
    await expect(editing.dateChip(chip)).toHaveAttribute("aria-pressed", "true");
    await expect(editing.pressedDateChips).toHaveCount(1);
    if (chip === "Other date") {
      await expect(editing.dateInput).toHaveValue("2001-09-15");
    }
    await editing.cancelButton.click();
    await expect(editing.root).toBeHidden();
  }
});

test("Delete in the edit dialog asks first, then removes the entry", async ({
  ui,
  loggedInApi: api,
}) => {
  const id = await logAlien(api, [
    { rating: 3, date: "2001-09-15" },
    { rating: 4, date: "2019-03-02" },
  ]);
  const { filmPage } = ui;
  const confirm = filmPage.deleteEntryDialog;
  await filmPage.goto(id);

  await filmPage.chooseEntryAction("Sep 15, 2001", "Edit");
  const editing = filmPage.logEntryDialog("Edit your entry for Alien");
  await editing.deleteButton.click();
  await expect(editing.root).toBeHidden();
  await confirm.confirm("Delete");

  await expect(confirm.root).toBeHidden();
  await expect(filmPage.entryActionsButton("Sep 15, 2001")).toHaveCount(0);
  // The page is usable again once both dialogs have closed.
  await filmPage.entryActionsButton("Mar 2, 2019").click();
  await expect(filmPage.entryActionsMenu.item("Edit")).toBeVisible();
});
