import { expect, test } from "../support/ui/fixtures";
import type { Ui } from "../support/ui/Ui";

// A film neither the TMDB fake nor the real TMDB knows, so only the User's own copy is found.
const wedding = "Весілля Олени та Тараса";

// Adds the wedding from home's search with its title alone.
async function addWeddingByTitle({ homePage }: Ui) {
  await homePage.goto();
  await homePage.search("весілля олени");
  await homePage.addManuallyButton.click();
  const adding = homePage.addManuallyDialog;
  await adding.titleInput.fill(wedding);
  await adding.addButton.click();
}

test("a User adds a film search doesn't find, logs it, edits it, and deletes it with its Log Entry", async ({
  page,
  loggedInUi: ui,
}) => {
  const { homePage, logPage, filmPage } = ui;
  await homePage.goto();
  await homePage.search("весілля олени");
  await expect(homePage.noResultsMessage).toBeVisible();

  // Adding it manually starts from the query.
  await homePage.addManuallyButton.click();
  const adding = homePage.addManuallyDialog;
  await expect(adding.titleInput).toHaveValue("весілля олени");
  await adding.titleInput.fill(wedding);
  await adding.yearInput.fill("2019");
  await adding.minutesInput.fill("95");
  await adding.genreCheckbox("Documentary").check();
  await adding.addButton.click();

  await expect(adding.root).toBeHidden();
  await expect(
    homePage.toast.message(`Added ${wedding} (2019). Only you can see it.`),
  ).toBeVisible();
  const film = homePage.searchResults.result(`${wedding} (2019)`);
  await expect(film.addedByYouLabel).toBeVisible();

  // It is planned and logged like any film.
  await film.wantToWatchButton.click();
  await expect(film.onWatchlistButton).toBeVisible();
  await film.markWatchedButton.click();
  const logging = homePage.logEntryDialog(wedding);
  await logging.rate("5 stars");
  await logging.save();
  await expect(film.itemHistoryLink("5 · 1 viewing")).toBeVisible();

  // A later search lists it first.
  await page.reload();
  await homePage.search("олени");
  const first = homePage.searchResults.rows.first();
  await expect(first).toContainText(`${wedding} (2019)`);
  await expect(first).toContainText("5 · 1 viewing");

  // Its page, reached from the Log, edits it.
  await homePage.mainNav.link("Log").click();
  await logPage.filmLink(`${wedding} (2019)`).click();
  await expect(filmPage.text("You added this film manually.")).toBeVisible();
  await expect(filmPage.text("95 min · Documentary")).toBeVisible();
  await filmPage.editFilmButton.click();
  const editing = filmPage.editFilmDialog(`${wedding} (2019)`);
  await expect(editing.minutesInput).toHaveValue("95");
  await expect(editing.genreCheckbox("Documentary")).toBeChecked();
  await editing.originalTitleInput.fill("Olena and Taras's wedding");
  await editing.saveButton.click();
  const renamed = `${wedding} (Olena and Taras's wedding, 2019)`;
  await expect(filmPage.heading).toContainText(renamed);

  // Deleting it says what goes with it, then empties the Log.
  await filmPage.deleteFilmButton.click();
  const confirm = filmPage.deleteFilmDialog(renamed);
  await expect(confirm.root).toContainText("Your Log Entry for it will be deleted.");
  await expect(confirm.root).toContainText(
    "It isn't on your Watchlist or in any of your Collections.",
  );
  await confirm.confirm("Delete");
  await expect(logPage.emptyMessage).toBeVisible();
});

test("adding a film with the same title and year again warns first, then adds it anyway", async ({
  ui,
  loggedInApi: api,
}) => {
  const created = await api.catalog.addManualMediaItem({
    mediaType: "film",
    title: wedding,
    year: 2019,
  });
  expect(created.status()).toBe(201);
  const { homePage } = ui;
  const result = homePage.searchResults.result(`${wedding} (2019)`);
  await homePage.goto();
  await homePage.search("весілля олени");
  await expect(result.root).toHaveCount(1);

  await homePage.addManuallyButton.click();
  const adding = homePage.addManuallyDialog;
  await adding.titleInput.fill(wedding);
  await adding.yearInput.fill("2019");
  await adding.addButton.click();

  await expect(adding.errorMessage).toHaveText(
    "You've already added a film with this title and year. Add another one anyway?",
  );
  await adding.addAnywayButton.click();
  await expect(adding.root).toBeHidden();
  await expect(result.root).toHaveCount(2);
});

test("a thumbnail without a poster shows no caption, and the film's banner does", async ({
  loggedInUi: ui,
}) => {
  await addWeddingByTitle(ui);
  const result = ui.homePage.searchResults.result(wedding);

  await expect(result.noPosterPlaceholder).toHaveText("");
  await result.filmLink(wedding).click();

  await expect(ui.filmPage.noPosterPlaceholder).toHaveText(/\S/);
});

test("a film added manually but never logged or planned is still reached from search, to delete it", async ({
  loggedInUi: ui,
}) => {
  await addWeddingByTitle(ui);
  const { homePage, filmPage } = ui;

  await homePage.searchResults.result(wedding).filmLink(wedding).click();

  await expect(filmPage.noViewingsMessage).toBeVisible();
  await filmPage.deleteFilmButton.click();
  const confirm = filmPage.deleteFilmDialog(wedding);
  await expect(confirm.root).toContainText("You have no Log Entries for it.");
  await confirm.confirm("Delete");
  await homePage.goto();
  await homePage.search("весілля олени");
  await expect(homePage.noResultsMessage).toBeVisible();
});
