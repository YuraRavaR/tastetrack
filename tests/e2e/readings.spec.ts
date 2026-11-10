import type { NewLogEntryRequest } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import { harryPotter, holdCovers, kafkaOnTheShore, tyhrolovy } from "../support/scenarios/books";
import { expect, test } from "../support/ui/fixtures";

// Locally the Worker searches an Open Library fake, which mirrors real works; their covers are
// Open Library's own images, which these tests never load.
test.beforeEach(async ({ page }) => {
  await holdCovers(page);
});

// The film Log's words, which no book screen may say.
const filmWording = /Watch|Viewing|Rewatch/;

async function logBook(
  api: ApiClient,
  mediaItemId: number,
  entry: Omit<NewLogEntryRequest, "mediaItemId">,
  time: string,
) {
  await expectBody(api.log.createLogEntry({ mediaItemId, ...entry }, at(time)), 201);
}

// Logging and rereading a book is the one key journey of books no other smoke test covers; its
// edit and delete go through the film Log's smoke test's code. Besides its User, it writes the
// book's Backlog item, two Log Entries, and the book's Media Item and cache entry where no one has
// added it yet (ADR-0006).
test("a User reads a book from the Reading list, finds it Read, and rereads it", {
  tag: "@smoke",
}, async ({ page, api, loggedInUi: ui }) => {
  const book = await tyhrolovy(api);
  await expectBody(api.backlog.addBacklogItem({ mediaItemId: book.id }), 201);
  const { filmPage, libraryPage } = ui;
  const { readings, stats, toast } = filmPage;
  await filmPage.goto(book.id);
  await expect(filmPage.notReadYetMessage).toBeVisible();

  // Read takes it off the Reading list, and the toast offers to put it back.
  await filmPage.readButton.click();
  const first = filmPage.logEntryDialog("Тигролови");
  await expect(first.kindLabel("Read")).toBeVisible();
  await expect(first.readingListNote).toBeVisible();
  await expect(first.bookRevisitSwitch).not.toBeChecked();
  await first.dateChip("No date").click();
  await first.rate("4 stars");
  await first.save();

  await expect(first.root).toBeHidden();
  await expect(filmPage.readAgainButton).toBeVisible();
  await expect(filmPage.wantToReadButton).toBeVisible();
  await expect(stats).toHaveText(["Once", "4", "–"]);
  await expect(readings).toHaveCount(1);
  await expect(toast.message("Added Тигролови (1946) to your Log.")).toBeVisible();
  await expect(toast.message("Took Тигролови (1946) off your Reading list.")).toBeVisible();
  await expect(toast.undoButton).toBeVisible();
  await expect(filmPage.main).not.toContainText(filmWording);

  await toast.goToReadLink.click();
  await expect(page).toHaveURL(libraryPage.path("Read"));
  await expect(libraryPage.tab("Reading list")).toHaveAccessibleName("Reading list 0");
  await expect(libraryPage.tab("Read")).toHaveAccessibleName("Read 1");
  await expect(libraryPage.poster("Read", "Тигролови").rating("4 stars")).toBeVisible();

  // A Reread is a second Reading, which sets the Current Rating.
  await libraryPage.poster("Read", "Тигролови").link.click();
  await filmPage.readAgainButton.click();
  const revisit = filmPage.logEntryDialog("Тигролови");
  await expect(revisit.kindLabel("Read again")).toBeVisible();
  await expect(revisit.bookRevisitSwitch).toBeChecked();
  await revisit.dateChip("No date").click();
  await revisit.rate("5 stars");
  await revisit.save();

  await expect(revisit.root).toBeHidden();
  await expect(readings).toHaveCount(2);
  await expect(filmPage.reading(0).bookRevisitBadge).toBeVisible();
  await expect(filmPage.reading(1).bookRevisitBadge).toHaveCount(0);
  await expect(stats).toHaveText(["Twice", "5", "–"]);
  await expect(filmPage.main).not.toContainText(filmWording);
  await libraryPage.goto("Read");
  await expect(libraryPage.poster("Read", "Тигролови").rating("5 stars")).toBeVisible();
});

test("editing and deleting a book's Readings updates its page and the Read tab", async ({
  api,
  loggedInUi: ui,
}) => {
  const book = await tyhrolovy(api);
  await logBook(api, book.id, { rating: 4, date: "2026-03-14" }, minutesAgo(20));
  await logBook(api, book.id, { rating: 5, date: "2026-03-15", revisit: true }, minutesAgo(10));
  const { filmPage, libraryPage } = ui;
  const { readings, stats, deleteEntryDialog: confirm } = filmPage;
  await filmPage.goto(book.id);
  await expect(stats).toHaveText(["Twice", "5", "Mar 14, 2026"]);

  // Editing the Reread changes the Current Rating, on the page and on the Read tab.
  await filmPage.chooseEntryAction("Mar 15, 2026", "Edit");
  const editing = filmPage.logEntryDialog("Edit your entry for Тигролови");
  await expect(editing.bookRevisitSwitch).toBeChecked();
  await editing.rate("2.5 stars");
  await editing.save();
  await expect(editing.root).toBeHidden();
  await expect(stats).toHaveText(["Twice", "2.5", "Mar 14, 2026"]);
  await libraryPage.goto("Read");
  await expect(libraryPage.poster("Read", "Тигролови").rating("2.5 stars")).toBeVisible();

  // Deleting the Reread leaves the first Reading's Rating current; deleting that one, nothing read.
  await libraryPage.poster("Read", "Тигролови").link.click();
  await filmPage.chooseEntryAction("Mar 15, 2026", "Delete");
  await confirm.confirm("Delete");
  await expect(readings).toHaveCount(1);
  await expect(stats).toHaveText(["Once", "4", "Mar 14, 2026"]);
  await filmPage.chooseEntryAction("Mar 14, 2026", "Delete");
  await confirm.confirm("Delete");
  await expect(filmPage.notReadYetMessage).toBeVisible();
  await expect(stats).toHaveCount(0);
  await expect(filmPage.readButton).toBeVisible();

  await libraryPage.goto("Read");
  await expect(libraryPage.text("Books you mark Read show up here.")).toBeVisible();
});

test("undoing a Reading's toast puts the book back on the Reading list, marked Read before", async ({
  api,
  loggedInUi: ui,
}) => {
  const tyhrolovyItem = await tyhrolovy(api);
  const kafkaItem = await kafkaOnTheShore(api);
  for (const [item, time] of [
    [tyhrolovyItem, minutesAgo(20)],
    [kafkaItem, minutesAgo(10)],
  ] as const) {
    await expectBody(api.backlog.addBacklogItem({ mediaItemId: item.id }, at(time)), 201);
  }
  const { filmPage, libraryPage } = ui;
  await filmPage.goto(tyhrolovyItem.id);

  await filmPage.readButton.click();
  const dialog = filmPage.logEntryDialog("Тигролови");
  await dialog.rate("3 stars");
  await dialog.save();
  await expect(filmPage.wantToReadButton).toBeVisible();
  await filmPage.toast.undo();

  await expect(filmPage.onReadingListButton).toBeVisible();
  await expect(filmPage.toast.root).toHaveText(
    /Put Тигролови \(1946\) back on your Reading list\./,
  );
  await libraryPage.goto("Reading list");
  await expect(libraryPage.posters("Reading list")).toHaveCount(2);
  await expect(libraryPage.poster("Reading list", "Тигролови").readBeforeMark).toBeVisible();
  await expect(libraryPage.tab("Read")).toHaveAccessibleName("Read 1");
});

test("Mark read in Search logs a book, which then shows its Current Rating in Search", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage, filmPage } = ui;
  await searchPage.goto("Himn demokratychnoï molodi", "book");
  const result = searchPage.openLibraryResults.result("Himn demokratychnoï molodi");

  await result.markReadButton.click();
  const dialog = searchPage.logEntryDialog("Himn demokratychnoï molodi");
  await expect(dialog.kindLabel("Read")).toBeVisible();
  await dialog.rate("4.5 stars");
  await dialog.reviewInput.fill("Loud and young.");
  await dialog.save();

  await expect(dialog.root).toBeHidden();
  await expect(result.readAgainButton).toBeVisible();
  await result.itemHistoryLink("4.5 · 1 reading").click();
  await expect(filmPage.heading).toContainText("Himn demokratychnoï molodi");
  await expect(filmPage.readings).toHaveCount(1);
  await expect(filmPage.reading(0).ratingStars("4.5 stars")).toBeVisible();
  await expect(filmPage.reading(0).text("Loud and young.")).toBeVisible();

  // The next search finds it In your Saved, with its Current Rating, and leaves it out of Open
  // Library's results.
  await page.goBack();
  await searchPage.search("Himn");
  const saved = searchPage.userMediaItems.film("Himn demokratychnoï molodi");
  await expect(saved.root).toContainText("4.5 · Read");
  await expect(result.root).toHaveCount(0);
});

test("the Read tab shows each book once with its Current Rating, the last read first, and the tile counts it", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const tyhrolovyItem = await tyhrolovy(api);
  const kafkaItem = await kafkaOnTheShore(api);
  const harryPotterItem = await harryPotter(api);
  await logBook(api, tyhrolovyItem.id, { rating: 3, date: "2025-01-10" }, minutesAgo(40));
  await logBook(api, kafkaItem.id, { rating: 4.5, date: "2025-06-01" }, minutesAgo(30));
  await logBook(
    api,
    tyhrolovyItem.id,
    { rating: 5, date: "2026-02-01", revisit: true },
    minutesAgo(20),
  );
  await expectBody(api.backlog.addBacklogItem({ mediaItemId: harryPotterItem.id }), 201);
  const { libraryPage, savedPage } = ui;

  await savedPage.goto();
  const books = savedPage.tile("Books");
  await expect(books.link).toHaveAccessibleDescription("1 to read · 2 read");

  await libraryPage.goto("Read");

  await expect(page).toHaveTitle("Read · Books · TasteTrack");
  await expect(libraryPage.tabs).toHaveText([/^Reading list/, /^Read/]);
  await expect(libraryPage.tab("Read")).toHaveAccessibleName("Read 2");
  await expect(libraryPage.tab("Read")).toHaveAttribute("aria-current", "page");
  await expect(libraryPage.posters("Read")).toHaveText([/^Тигролови/, /^Kafka on the Shore/]);
  await expect(libraryPage.poster("Read", "Тигролови").rating("5 stars")).toBeVisible();
  await expect(libraryPage.poster("Read", "Kafka on the Shore").rating("4.5 stars")).toBeVisible();
  await expect(libraryPage.main).not.toContainText(filmWording);

  // Sort and filter as for films, with no Genre: books have none.
  await expect(libraryPage.chips).toHaveText([/Last read/, /Decade/, /Rating/]);
  await libraryPage.chip("Sort").click();
  await expect(libraryPage.choices).toHaveText(["Last read", "Rating", "Title", "First published"]);
  await libraryPage.choice("Title").click();
  await expect(libraryPage.posters("Read")).toHaveText([/^Kafka on the Shore/, /^Тигролови/]);
  await libraryPage.choose("Sort", "Last read");
  await expect(page).toHaveURL(`${libraryPage.path("Read")}?sort=read`);
  await libraryPage.choose("Rating", "5★ only");
  await expect(libraryPage.posters("Read")).toHaveText([/^Тигролови/]);
});

test("on a phone a book's page has Read and Want to read side by side, and Readings below", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const book = await tyhrolovy(api);
  await logBook(api, book.id, { rating: 4, date: "2025-01-10" }, minutesAgo(10));
  const { filmPage } = ui;
  await page.setViewportSize({ width: 390, height: 844 });

  await filmPage.goto(book.id);

  const read = await filmPage.readAgainButton.boundingBox();
  const plan = await filmPage.wantToReadButton.boundingBox();
  expect([read?.x, read?.height, plan?.height]).toEqual([16, 48, 48]);
  expect(plan?.y).toBe(read?.y);
  await expect(filmPage.statNames).toHaveText(["Read", "Your rating", "First read"]);
  await expect(filmPage.readingsHeading).toBeVisible();
  await expect(filmPage.readings).toHaveCount(1);
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBe(0);
});
