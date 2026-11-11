import { holdCovers, manualBook } from "../support/scenarios/books";
import { expect, test } from "../support/ui/fixtures";

// A Ukrainian novel Open Library doesn't have, nor its fake.
const dotsia = "Доця";
const author = "Тамара Горіха Зерня";
// No word of a film's, as a book's page must not say: "film", "watch", "Watchlist", "viewing".
const filmWords = /film|watch|viewing/i;

test.beforeEach(async ({ page }) => {
  await holdCovers(page);
});

for (const { device, viewport } of [
  { device: "desktop", viewport: { width: 1440, height: 900 } },
  { device: "phone", viewport: { width: 390, height: 844 } },
]) {
  test(`a User adds a book search doesn't find, and its page shows its authors (${device})`, async ({
    page,
    loggedInUi: ui,
  }) => {
    await page.setViewportSize(viewport);
    const { searchPage, filmPage } = ui;
    await searchPage.goto("доця", "book");
    await expect(searchPage.noBooksMessage).toHaveText("No books found for “доця”.");

    // Adding it manually starts from the query.
    await searchPage.addManuallyButton.click();
    const adding = searchPage.addBookManuallyDialog;
    await expect(adding.titleInput).toHaveValue("доця");
    await expect(adding.root).toContainText("For a book search doesn't find.");
    await expect(adding.root).not.toContainText(filmWords);
    await expect(adding.minutesInput).toHaveCount(0);
    await adding.titleInput.fill(dotsia);
    await adding.yearInput.fill("2019");
    await adding.authorsInput.fill(` ${author}, , Translator Name `);
    await adding.addButton.click();

    await expect(adding.root).toBeHidden();
    await expect(
      searchPage.toast.message(`Added ${dotsia} (2019). Only you can see it.`),
    ).toBeVisible();
    const book = searchPage.openLibraryResults.result(dotsia);
    await expect(book.root).toContainText(`${author}, Translator Name · 2019`);
    await expect(book.addedByYouLabel).toBeVisible();

    await searchPage.openLibraryResults.link(dotsia).click();

    await expect(page).toHaveURL(filmPage.anyPath);
    await expect(filmPage.heading).toHaveText(`${dotsia} (2019)`);
    await expect(filmPage.text(`${author}, Translator Name`)).toBeVisible();
    await expect(filmPage.text("You added this book manually. Only you can see it.")).toBeVisible();
    await expect(filmPage.noCoverPlaceholder.first()).toBeVisible();
    await expect(filmPage.main).not.toContainText(filmWords);
  });
}

test("adding a book with the title and year of one already added warns first, then adds it anyway", async ({
  ui,
  loggedInApi: api,
}) => {
  await manualBook(api, { title: dotsia, year: 2019, authors: [author] });
  const { searchPage } = ui;
  const result = searchPage.openLibraryResults.result(dotsia);
  await searchPage.goto("доця", "book");
  await expect(searchPage.userMediaItems.film(dotsia).root).toHaveCount(0);
  await expect(result.root).toHaveCount(1);

  await searchPage.addManuallyButton.click();
  const adding = searchPage.addBookManuallyDialog;
  await adding.titleInput.fill(dotsia);
  await adding.yearInput.fill("2019");
  await adding.addButton.click();

  await expect(adding.errorMessage).toHaveText(
    "You've already added a book with this title and year. Add another one anyway?",
  );
  await adding.addAnywayButton.click();
  await expect(adding.root).toBeHidden();
  await expect(result.root).toHaveCount(2);
});

test("a manual book's page edits its authors, and deletes it in a book's words", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const book = await manualBook(api, { title: dotsia, year: 2019, authors: [author] });
  const { filmPage, libraryPage } = ui;
  await filmPage.goto(book.id);

  await filmPage.editBookButton.click();
  const editing = filmPage.editFilmDialog(`${dotsia} (2019)`);
  await expect(editing.authorsInput).toHaveValue(author);
  await expect(editing.root).toContainText("Change the details you gave for this book.");
  await editing.authorsInput.fill(`${author}, Someone Else`);
  await editing.saveButton.click();
  await expect(editing.root).toBeHidden();
  await expect(filmPage.text(`${author}, Someone Else`)).toBeVisible();

  await filmPage.deleteBookButton.click();
  const confirm = filmPage.deleteFilmDialog(`${dotsia} (2019)`);
  await expect(confirm.root).toContainText(
    "It isn't on your Reading list or in any of your Collections.",
  );
  await expect(confirm.root).not.toContainText(filmWords);
  await confirm.confirm("Delete");
  await expect(page).toHaveURL(libraryPage.path("Read"));
});

test("a page with no such Media Item, and one that fails to load, say so without film words", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const { filmPage } = ui;

  await filmPage.goto(2_000_000_000);

  await expect(filmPage.errorMessage).toHaveText("There's nothing here. It may have been deleted.");

  const book = await manualBook(api, { title: dotsia });
  await page.route(`**/api/catalog/items/${book.id}/history`, (route) => {
    return route.fulfill({ status: 500, json: { error: "internal_error" } });
  });
  await filmPage.goto(book.id);

  await expect(filmPage.errorMessage).toHaveText("Couldn't load this page. Please try again.");
});
