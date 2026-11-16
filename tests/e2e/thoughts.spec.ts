import type { NewInProgressRequest, NewThoughtRequest } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { bookProgress, holdCovers, tyhrolovy } from "../support/scenarios/books";
import { alien } from "../support/scenarios/films";
import { chernobyl } from "../support/scenarios/series";
import { expect, test } from "../support/ui/fixtures";

// Thoughts (`docs/mockups/thoughts/`): a User's own dated notes and quotes on a Media Item, in its
// History with its Log Entries, newest first. Covers are Open Library's own images, which these
// tests never load.
test.beforeEach(async ({ page }) => {
  await holdCovers(page);
});

const phone = { width: 390, height: 844 };

const devices = [
  ["desktop", null],
  ["a phone", phone],
] as const;

async function keepThought(api: ApiClient, mediaItemId: number, thought: NewThoughtRequest) {
  await expectBody(api.thoughts.createThought(mediaItemId, thought), 201);
}

async function startWith(
  api: ApiClient,
  mediaItemId: number,
  progress: NewInProgressRequest["progress"],
) {
  await expectBody(api.inProgress.start({ mediaItemId, progress }), 201);
}

for (const [device, viewport] of devices) {
  test(`on ${device}, the User writes a Thought on a film, makes it a quote and deletes it`, async ({
    page,
    api,
    loggedInUi: ui,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    const film = await alien(api);
    const { filmPage } = ui;
    const dialog = filmPage.thoughtDialog("Alien");
    await filmPage.goto(film.id);
    await expect(filmPage.historyHeading).toBeVisible();
    await expect(filmPage.emptyHistoryMessage).toBeVisible();

    await filmPage.addThoughtButton.click();

    await expect(dialog.kindLabel).toHaveText("New thought");
    await expect(dialog.textInput).toBeFocused();
    await expect(dialog.pressedDateChips).toHaveText(["Today"]);
    await expect(dialog.dateChip("No date")).toBeHidden();
    // A film has no Progress.
    await expect(dialog.progress).toBeHidden();
    await expect(dialog.saveButton).toBeDisabled();
    await dialog.write("   ");
    await expect(dialog.saveButton).toBeDisabled();

    await dialog.write("Olena says\nit's her favourite.");
    await dialog.dateChip("Other date").click();
    await dialog.dateInput.fill("2026-11-10");
    await dialog.save();

    await expect(dialog.root).toBeHidden();
    await expect(filmPage.emptyHistoryMessage).toBeHidden();
    await expect(filmPage.historyRows).toHaveCount(1);
    const row = filmPage.historyRow(0);
    await expect(row.image("Thought")).toBeVisible();
    await expect(row.text("Nov 10, 2026")).toBeVisible();
    await expect(row.root).toHaveText(/^Nov 10, 2026Olena says\nit's her favourite\.$/);

    await filmPage.chooseThoughtAction("Nov 10, 2026", "Edit");

    await expect(dialog.kindLabel).toHaveText("Edit thought");
    await expect(dialog.textInput).toHaveValue("Olena says\nit's her favourite.");
    await expect(dialog.pressedDateChips).toHaveText(["Other date"]);
    await expect(dialog.dateInput).toHaveValue("2026-11-10");
    await dialog.write("In space no one can hear you scream.");
    await dialog.quoteSwitch.click();
    await expect(dialog.textInput).toHaveCSS("font-style", "italic");
    await dialog.save();

    await expect(dialog.root).toBeHidden();
    await expect(row.image("Quote")).toBeVisible();
    await expect(row.text("“In space no one can hear you scream.”")).toHaveCSS(
      "font-style",
      "italic",
    );

    await filmPage.chooseThoughtAction("Nov 10, 2026", "Edit");
    await dialog.deleteButton.click();
    await expect(filmPage.deleteThoughtDialog.root).toContainText(
      "Your thought of Nov 10, 2026 about Alien will be removed for good.",
    );
    await filmPage.deleteThoughtDialog.confirm("Delete");

    await expect(filmPage.deleteThoughtDialog.root).toBeHidden();
    await expect(dialog.root).toBeHidden();
    await expect(filmPage.emptyHistoryMessage).toBeVisible();
    await page.reload();
    await expect(filmPage.emptyHistoryMessage).toBeVisible();
  });
}

test("a Thought's text holds up to 2,000 characters, with a counter from 1,800", async ({
  api,
  loggedInUi: ui,
}) => {
  const film = await alien(api);
  const { filmPage } = ui;
  const dialog = filmPage.thoughtDialog("Alien");
  await filmPage.goto(film.id);
  await filmPage.addThoughtButton.click();

  await dialog.write("a".repeat(1_799));
  await expect(dialog.text(/\/ 2,000$/)).toBeHidden();
  await dialog.write("a".repeat(1_962));
  await expect(dialog.text("1,962 / 2,000")).toBeVisible();
  await expect(dialog.saveButton).toBeEnabled();
  await dialog.write("a".repeat(2_014));

  await expect(dialog.text("2,014 / 2,000")).toBeVisible();
  await expect(dialog.text("A thought holds up to 2,000 characters.")).toBeVisible();
  await expect(dialog.textInput).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.saveButton).toBeDisabled();
});

test("a Thought on a series being watched carries its episode, which the User can remove", async ({
  api,
  loggedInUi: ui,
}) => {
  const series = await chernobyl(api);
  await startWith(api, series.id, { mediaType: "series", season: 1, episode: 3 });
  const { filmPage } = ui;
  const dialog = filmPage.thoughtDialog("Chernobyl");
  await filmPage.goto(series.id);

  await filmPage.addThoughtButton.click();

  await expect(dialog.progress).toBeVisible();
  await expect(dialog.text("S1 · E3")).toBeVisible();
  await expect(dialog.text("From Watching")).toBeVisible();
  await dialog.write("The control room scene.");
  await dialog.save();

  const first = filmPage.historyRow(0);
  await expect(first.text("while watching")).toBeVisible();
  await expect(first.text("S1 · E3", { exact: true })).toBeVisible();

  await filmPage.addThoughtButton.click();
  await dialog.removeEpisodeButton.click();

  await expect(dialog.text("None on this thought")).toBeVisible();
  await expect(dialog.addEpisodeButton).toBeVisible();
  await dialog.write("No episode on this one.");
  await dialog.save();

  await expect(filmPage.historyRows).toHaveCount(2);
  const second = filmPage.historyRow(0);
  await expect(second.text("No episode on this one.")).toBeVisible();
  await expect(second.text("while watching")).toBeVisible();
  await expect(second.text(/^S\d+ · E\d+$/)).toBeHidden();
});

test("a quote from a book being read keeps the page the User changes it to", async ({
  api,
  loggedInUi: ui,
}) => {
  const book = await tyhrolovy(api);
  await startWith(api, book.id, bookProgress(142, 272));
  const { filmPage } = ui;
  const dialog = filmPage.thoughtDialog("Тигролови");
  await filmPage.goto(book.id);

  await filmPage.addThoughtButton.click();

  await expect(dialog.text("p. 142")).toBeVisible();
  await expect(dialog.text("From Reading")).toBeVisible();
  await dialog.changeProgressButton.click();
  await expect(dialog.pageInput).toBeFocused();
  await expect(dialog.pageInput).toHaveValue("142");
  await expect(dialog.text("From Reading: 142 of 272")).toBeVisible();
  await dialog.pageInput.fill("300");
  await dialog.pageInput.press("Enter");
  await expect(dialog.errorMessage).toHaveText("Page 300 is past the last page, 272.");
  await dialog.pageInput.fill("150");
  await dialog.doneButton.click();
  await expect(dialog.text("p. 150")).toBeVisible();
  // No longer the In Progress's page.
  await expect(dialog.text("From Reading")).toBeHidden();
  await dialog.write("Words from the book.");
  await dialog.quoteSwitch.click();
  await dialog.save();

  const row = filmPage.historyRow(0);
  await expect(row.image("Quote")).toBeVisible();
  await expect(row.text("while reading")).toBeVisible();
  await expect(row.text("p. 150", { exact: true })).toBeVisible();
  await expect(row.text("“Words from the book.”")).toBeVisible();
});

for (const [device, viewport] of devices) {
  test(`on ${device}, History has Log Entries and Thoughts newest first, each Thought with the state it was written in`, async ({
    page,
    api,
    loggedInUi: ui,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    const book = await tyhrolovy(api);
    await expectBody(api.backlog.addBacklogItem({ mediaItemId: book.id }), 201);
    await keepThought(api, book.id, { text: "Marta: read it in one go.", date: "2024-01-10" });
    const logged = api.log.createLogEntry(
      { mediaItemId: book.id, rating: 5, date: "2024-02-02", review: "Strange and very good." },
      at(minutesAgo(30)),
    );
    await expectBody(logged, 201);
    await keepThought(api, book.id, { text: "Still thinking about it.", date: "2024-02-04" });
    const undated = api.log.createLogEntry({ mediaItemId: book.id, rating: 3 }, at(minutesAgo(20)));
    await expectBody(undated, 201);
    const { filmPage } = ui;

    await filmPage.goto(book.id);

    await expect(filmPage.historyRows).toHaveText([
      /^Feb 4, 2024after readingStill thinking about it\.$/,
      /^Feb 2, 2024.*Strange and very good\.$/,
      /^Jan 10, 2024while on your Reading listMarta: read it in one go\.$/,
      /^No date/,
    ]);
  });
}

test("History's empty state says a Thought can come before the first Reading", async ({
  api,
  loggedInUi: ui,
}) => {
  const book = await tyhrolovy(api);
  const { filmPage } = ui;

  await filmPage.goto(book.id);

  await expect(filmPage.emptyHistoryMessage).toBeVisible();
  await expect(
    filmPage.emptyHistoryHint(
      "Mark it Read to keep the date, Rating and Review here, or add a thought at any time, even before you read.",
    ),
  ).toBeVisible();
  await expect(filmPage.addThoughtButton).toBeVisible();
});
