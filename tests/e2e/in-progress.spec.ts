import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { holdCovers, tyhrolovy } from "../support/scenarios/books";
import { alien } from "../support/scenarios/films";
import { expect, test } from "../support/ui/fixtures";

// In Progress, "Reading" for books: started from a book's page, then finished with a Rating or
// stopped. Locally the Worker searches an Open Library fake, which mirrors real works; their covers
// are Open Library's own images, which these tests never load.
test.beforeEach(async ({ page }) => {
  await holdCovers(page);
});

// The film Log's words, which no book screen may say.
const filmWording = /Watch|Viewing|Rewatch/;

// A day as the app writes it, with the year ("Since Oct 12, 2026") or without it ("Since Oct 12").
const sinceWithYear = /^Since [A-Z][a-z]{2} \d{1,2}, \d{4}$/;
const sinceWithoutYear = /^Since [A-Z][a-z]{2} \d{1,2}$/;

async function startReading(api: ApiClient, mediaItemId: number, startDate: string | null) {
  await expectBody(api.inProgress.start({ mediaItemId, startDate }), 201);
}

const phone = { width: 390, height: 844 };

for (const [device, viewport] of [
  ["desktop", null],
  ["a phone", phone],
] as const) {
  test(`on ${device}, starting a book from the Reading list moves it to Reading, with undo offered`, async ({
    page,
    api,
    loggedInUi: ui,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    const book = await tyhrolovy(api);
    await expectBody(api.backlog.addBacklogItem({ mediaItemId: book.id }), 201);
    const { filmPage, libraryPage, savedPage } = ui;
    const { readingCard, toast } = filmPage;
    await libraryPage.goto("Reading list");
    await libraryPage.poster("Reading list", "Тигролови").link.click();

    await filmPage.startReadingButton.click();

    await expect(readingCard.root).toBeVisible();
    await expect(readingCard.text(sinceWithYear)).toBeVisible();
    await expect(filmPage.startReadingButton).toBeHidden();
    await expect(filmPage.wantToReadButton).toBeHidden();
    await expect(filmPage.onReadingListButton).toBeHidden();
    await expect(filmPage.readButton).toBeHidden();
    await expect(filmPage.addToListButton).toBeVisible();
    await expect(toast.message("Started reading Тигролови (1946).")).toBeVisible();
    await expect(toast.message("Took Тигролови (1946) off your Reading list.")).toBeVisible();
    await expect(toast.undoButton).toBeVisible();
    await expect(filmPage.main).not.toContainText(filmWording);

    await toast.goToReadingLink.click();
    await expect(page).toHaveURL(libraryPage.path("Reading"));
    await expect(libraryPage.tabs).toHaveText([
      /^Reading list/,
      /^Reading(?! list)/,
      /^Read(?!ing)/,
    ]);
    await expect(libraryPage.tab("Reading list")).toHaveAccessibleName("Reading list 0");
    await expect(libraryPage.tab("Reading")).toHaveAccessibleName("Reading 1");
    const poster = libraryPage.poster("Reading", "Тигролови");
    await expect(poster.root.getByText(sinceWithoutYear)).toBeVisible();
    // The Reading tab has its one order and no filters.
    await expect(libraryPage.chipsGroup).toHaveCount(0);

    await savedPage.goto();
    await expect(savedPage.tile("Books").root).toContainText("0 to read · 1 reading · 0 read");
    await expect(savedPage.readingNowRows).toHaveCount(1);
    await expect(savedPage.readingNowRow("Тигролови")).toContainText(
      /Іван Багряний · since [A-Z][a-z]{2} \d{1,2}$/,
    );
    await savedPage.readingNowRow("Тигролови").click();
    await expect(page).toHaveURL(filmPage.path(book.id));
  });

  test(`on ${device}, finishing a book moves it from Reading to Read with its Rating`, async ({
    page,
    api,
    loggedInUi: ui,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    const book = await tyhrolovy(api);
    await startReading(api, book.id, "2026-10-12");
    const { filmPage, libraryPage } = ui;
    const { readingCard } = filmPage;
    await filmPage.goto(book.id);
    await expect(readingCard.text("Since Oct 12, 2026")).toBeVisible();

    await readingCard.finishedButton.click();
    const dialog = filmPage.logEntryDialog("Тигролови");
    await expect(dialog.kindLabel("Read")).toBeVisible();
    await dialog.dateChip("No date").click();
    await dialog.rate("4 stars");
    await dialog.save();

    await expect(dialog.root).toBeHidden();
    await expect(readingCard.root).toBeHidden();
    await expect(filmPage.readings).toHaveCount(1);
    await expect(filmPage.stats).toHaveText(["Once", "4", "–"]);
    await expect(filmPage.startRereadingButton).toBeVisible();
    await expect(filmPage.toast.message("Added Тигролови (1946) to your Log.")).toBeVisible();

    await filmPage.toast.goToReadLink.click();
    await expect(libraryPage.tab("Reading")).toHaveAccessibleName("Reading 0");
    await expect(libraryPage.poster("Read", "Тигролови").rating("4 stars")).toBeVisible();
  });

  test(`on ${device}, stopping a book removes it from Reading and leaves no Reading`, async ({
    page,
    api,
    loggedInUi: ui,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    const book = await tyhrolovy(api);
    await startReading(api, book.id, "2026-10-12");
    const { filmPage, libraryPage, savedPage } = ui;
    await savedPage.goto();
    await savedPage.readingNowRow("Тигролови").click();

    await filmPage.readingCard.stopReadingButton.click();

    await expect(filmPage.readingCard.root).toBeHidden();
    await expect(filmPage.startReadingButton).toBeVisible();
    await expect(filmPage.wantToReadButton).toBeVisible();
    await expect(filmPage.notReadYetMessage).toBeVisible();
    await expect(filmPage.toast.message("Stopped reading Тигролови (1946).")).toBeVisible();
    await libraryPage.goto("Reading");
    await expect(libraryPage.tab("Reading")).toHaveAccessibleName("Reading 0");
    await expect(libraryPage.text("Books you start reading show up here.")).toBeVisible();
    await expect(libraryPage.tab("Read")).toHaveAccessibleName("Read 0");
    await savedPage.goto();
    await expect(savedPage.tile("Books").root).toContainText("Nothing saved yet.");
    await expect(savedPage.readingNow).toHaveCount(0);
  });
}

test("undoing a start puts the book back on the Reading list, and it stays Reading", async ({
  api,
  loggedInUi: ui,
}) => {
  const book = await tyhrolovy(api);
  await expectBody(api.backlog.addBacklogItem({ mediaItemId: book.id }), 201);
  const { filmPage, libraryPage } = ui;
  await filmPage.goto(book.id);
  await filmPage.startReadingButton.click();
  await expect(filmPage.readingCard.root).toBeVisible();

  await filmPage.toast.undo();

  await expect(
    filmPage.toast.message("Put Тигролови (1946) back on your Reading list."),
  ).toBeVisible();
  await libraryPage.goto("Reading list");
  await expect(libraryPage.tab("Reading list")).toHaveAccessibleName("Reading list 1");
  await expect(libraryPage.tab("Reading")).toHaveAccessibleName("Reading 1");
});

test("the start date can be changed, and the book shows Reading in Search", async ({
  api,
  loggedInUi: ui,
}) => {
  const book = await tyhrolovy(api);
  await startReading(api, book.id, null);
  const { filmPage, searchPage } = ui;
  const { readingCard, startDateDialog } = filmPage;
  await filmPage.goto(book.id);
  await expect(readingCard.root).toBeVisible();
  await expect(readingCard.text(/Since/)).toHaveCount(0);

  await readingCard.changeStartDateButton.click();
  await startDateDialog.dateChip("Other date").click();
  await startDateDialog.dateInput.fill("2026-10-12");
  await startDateDialog.saveButton.click();

  await expect(startDateDialog.root).toBeHidden();
  await expect(readingCard.text("Since Oct 12, 2026")).toBeVisible();

  await searchPage.goto("Тигролови", "book");
  await expect(searchPage.userMediaItems.film("Тигролови").root).toContainText("Reading");
});

test("a film's page and Saved offer nothing In Progress", async ({ api, loggedInUi: ui }) => {
  const film = await alien(api);
  const { filmPage, libraryPage } = ui;
  await filmPage.goto(film.id);
  await expect(filmPage.watchedButton).toBeVisible();

  await expect(filmPage.startButtons).toHaveCount(0);
  await libraryPage.goto("Watchlist");
  await expect(libraryPage.tabs).toHaveText([/^Watchlist/, /^Watched/]);
});
