import { expectBody } from "../support/api/responses";
import {
  coverUrl,
  harryPotter,
  holdCovers,
  hymn,
  kafkaOnTheShore,
  newBook,
  tyhrolovy,
} from "../support/scenarios/books";
import { settledBoxOf as box } from "../support/ui/boxes";
import { expect, test } from "../support/ui/fixtures";

// Locally the Worker searches an Open Library fake, which mirrors real works; their covers are
// Open Library's own images, which these tests never load.
test.beforeEach(async ({ page }) => {
  await holdCovers(page);
});

const harryPotterTitle = "Harry Potter and the Philosopher's Stone";

test("choosing Books puts the Media Type in the address, and a reload and Back keep it", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage, filmPage } = ui;
  const { openLibraryResults } = searchPage;
  await searchPage.goto("harry potter");
  await expect(searchPage.currentChip("Films")).toBeVisible();
  await expect(searchPage.noResultsMessage).toBeVisible();

  await searchPage.mediaTypeChip("Books").click();

  await expect(page).toHaveURL(searchPage.path("harry potter", "book"));
  await expect(searchPage.currentChip("Books")).toBeVisible();
  await expect(searchPage.searchBox).toHaveValue("harry potter");
  await expect(searchPage.searchBox).toHaveAttribute("placeholder", "Title or author");
  await expect(searchPage.openLibraryHeading).toHaveText(/^From Open Library\s*1$/);
  await expect(openLibraryResults.filmLabel(harryPotterTitle)).toBeVisible();
  await expect(searchPage.tmdbHeading).toHaveCount(0);
  await expect(searchPage.noResultsMessage).toHaveCount(0);

  await page.reload();
  await expect(searchPage.currentChip("Books")).toBeVisible();
  await expect(openLibraryResults.filmLabel(harryPotterTitle)).toBeVisible();

  // The result opens the book's page, and Back comes back to Books and the same results.
  await openLibraryResults.result(harryPotterTitle).clickPoster();
  await expect(page).toHaveURL(filmPage.anyPath);
  await page.goBack();
  await expect(page).toHaveURL(searchPage.path("harry potter", "book"));
  await expect(searchPage.currentChip("Books")).toBeVisible();
  await expect(openLibraryResults.filmLabel(harryPotterTitle)).toBeVisible();

  // Films leaves the address without a type, as it was.
  await searchPage.mediaTypeChip("Films").click();
  await expect(page).toHaveURL(searchPage.path("harry potter"));
  await expect(searchPage.noResultsMessage).toBeVisible();
  await expect(searchPage.openLibraryHeading).toHaveCount(0);
});

test("an address with a Media Type Search doesn't have opens on Films", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;

  await ui.goto("/search?q=alien&type=series");

  await expect(searchPage.currentChip("Films")).toBeVisible();
  await expect(searchPage.searchResults.filmLabel("Alien (1979)")).toBeVisible();
});

test("a book result shows its cover, title, authors and first-published year", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  await searchPage.goto(undefined, "book");
  await expect(
    searchPage.text("Type a title or author to search your Saved and Open Library."),
  ).toBeVisible();

  // A Cyrillic query finds the Ukrainian novel first.
  await searchPage.search("Тигролови");
  const first = searchPage.openLibraryResults.rows.first();
  await expect(first).toContainText("Тигролови");
  await expect(first).toContainText("Іван Багряний · 1946");
  await expect(first.locator("img")).toHaveAttribute("src", coverUrl(12648826, "M"));

  // And still finds a Ukrainian novel held only in translation. Its author's name loses its
  // stress marks, and its translators beyond the second name are counted.
  await searchPage.search("Ворошиловград");
  const translated = searchPage.openLibraryResults.result("Voroshilovgrad");
  await expect(translated.root).toContainText(
    "Сергій Вікторович Жадан, Reilly Costigan-Humes +1 · 2012",
  );
  // A book can only be opened so far.
  await expect(translated.actionButtons).toHaveCount(0);
});

test("a result titled by its English edition names the work's own title alongside", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;

  await searchPage.goto("kafka on the shore", "book");

  const result = searchPage.openLibraryResults.result("Kafka on the Shore (海辺のカフカ)");
  await expect(result.root).toContainText("村上春樹 · 2001");
});

test("a result opens the book's page, with its cover over a blurred copy, its titles and its authors", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await harryPotter(api);
  const { searchPage, filmPage } = ui;
  await searchPage.goto("Гаррі Поттер", "book");

  // In the query's language, the Ukrainian edition's title leads.
  const label = `Гаррі Поттер і філософський камінь (${harryPotterTitle})`;
  await searchPage.openLibraryResults.link(label).click();

  await expect(page).toHaveURL(filmPage.path(mediaItemId));
  await expect(filmPage.heading).toHaveText(
    `${harryPotterTitle} (1997)Гаррі Поттер і філософський камінь`,
  );
  await expect(filmPage.text("J. K. Rowling")).toBeVisible();
  await expect(page).toHaveTitle(`${harryPotterTitle} (1997) · TasteTrack`);
  // A book has no backdrop: the picture is its cover, blurred, with the sharp one over it.
  const cover = coverUrl(15155833, "L");
  await expect(filmPage.pictureImage).toHaveAttribute("src", cover);
  await expect(filmPage.pictureImage).toHaveCSS("filter", /blur/);
  await expect(filmPage.posterImage(cover)).toBeVisible();
  // Nothing can be done with a book yet.
  await expect(filmPage.buttons).toHaveCount(0);
  await expect(filmPage.sectionHeadings).toHaveCount(0);
});

test("a book's page names its Original Title beside its English one", async ({
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await kafkaOnTheShore(api);
  const { filmPage } = ui;

  await filmPage.goto(mediaItemId);

  await expect(filmPage.heading).toHaveText("Kafka on the Shore (海辺のカフカ, 2001)");
  await expect(filmPage.text("村上春樹")).toBeVisible();
});

test("a book without a cover shows a cover set in type, in Search and on its page", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await hymn(api);
  const { searchPage, filmPage } = ui;
  await searchPage.goto("Himn demokratychnoï molodi", "book");
  const result = searchPage.openLibraryResults.result("Himn demokratychnoï molodi");

  await expect(result.noCoverPlaceholder).toBeVisible();
  await expect(result.noCoverPlaceholder).toContainText("Himn demokratychnoï molodi");
  await expect(result.poster).toHaveCount(0);

  await result.clickPoster();
  await expect(page).toHaveURL(filmPage.path(mediaItemId));
  await expect(filmPage.noCoverPlaceholder).toBeVisible();
  await expect(filmPage.noCoverPlaceholder).toContainText("Сергій Вікторович Жадан");
  // No cover, so no picture either.
  await expect(filmPage.picture).toHaveCount(0);
});

test("opening a book no one has added puts it in the catalog first", async ({
  page,
  loggedInUi: ui,
}) => {
  const { id, query, title } = newBook();
  const { searchPage, filmPage } = ui;
  await searchPage.goto(query, "book");
  const result = searchPage.openLibraryResults.result(title);

  await result.filmButton(title).click();

  await expect(page).toHaveURL(filmPage.anyPath);
  await expect(filmPage.heading).toHaveText(`${title} (2020)`);
  // Back in Search, the result is in the catalog, so its title is a link.
  await page.goBack();
  await expect(result.filmLink(title)).toBeVisible();
  expect(id).toMatch(/^OL\d+W$/);
});

test("Search on Books finds the User's own books first, In your Saved, and Open Library's without them", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await tyhrolovy(api);
  const { list } = await expectBody(
    api.lists.createList({ name: "Ukrainian classics", mediaType: "book" }),
    201,
  );
  await expectBody(api.lists.addListItem(list.id, { mediaItemId }), 201);
  const { searchPage, filmPage } = ui;

  await searchPage.goto("тигро", "book");

  const saved = searchPage.userMediaItems.film("Тигролови");
  await expect(searchPage.userMediaItemsHeading).toHaveText(/^In your Saved\s*1$/);
  await expect(saved.root).toContainText("Ukrainian classics");
  await expect(searchPage.openLibraryHeading).toHaveCount(0);
  // A film search doesn't show it.
  await searchPage.mediaTypeChip("Films").click();
  await expect(searchPage.noResultsMessage).toBeVisible();
  await expect(searchPage.userMediaItems.films).toHaveCount(0);

  await searchPage.mediaTypeChip("Books").click();
  await saved.link.click();
  await expect(page).toHaveURL(filmPage.path(mediaItemId));
});

test("a query no book matches says so, without offering to add one by hand", async ({
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;

  await searchPage.goto("zzqx no such book", "book");

  await expect(searchPage.noBooksMessage).toHaveText("No books found for “zzqx no such book”.");
  await expect(searchPage.addManuallyButton).toHaveCount(0);
});

test("the chips are one control the width of the field, with equal thumb-sized segments", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage } = ui;
  await page.setViewportSize({ width: 402, height: 874 });
  await searchPage.goto(undefined, "book");
  const chips = ["Films", "Books", "Series"] as const;

  const [field, control] = await Promise.all([
    box(searchPage.searchBox),
    box(searchPage.mediaTypeChips),
  ]);
  const segments = await Promise.all(chips.map((name) => box(searchPage.mediaTypeChip(name))));

  expect([control.x, control.width]).toEqual([field.x, field.width]);
  for (const segment of segments) {
    expect(segment.height).toBe(56);
    expect(segment.width).toBeCloseTo(segments[0]?.width ?? 0, 0);
  }
  // Series says "Soon" on a phone, "Coming soon" where there is room.
  // The first of the two is the one on show; the other is the chip's description.
  const series = searchPage.mediaTypeChip("Series");
  const comingSoon = series.getByText("Coming soon").first();
  await expect(series.getByText("Soon", { exact: true })).toBeVisible();
  await expect(comingSoon).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(comingSoon).toBeVisible();
  await expect(series.getByText("Soon", { exact: true })).toBeHidden();
  expect((await box(searchPage.mediaTypeChips)).width).toBe(
    (await box(searchPage.searchBox)).width,
  );
});

test("on a phone a book's row has a larger cover, and its page the cover over the picture", async ({
  page,
  loggedInUi: ui,
  loggedInApi: api,
}) => {
  const { id: mediaItemId } = await harryPotter(api);
  const { searchPage, filmPage } = ui;
  await page.setViewportSize({ width: 402, height: 874 });
  await searchPage.goto("harry potter", "book");
  const result = searchPage.openLibraryResults.result(harryPotterTitle);

  const thumbnail = await box(result.poster);
  expect([thumbnail.width, thumbnail.height]).toEqual([72, 108]);

  await filmPage.goto(mediaItemId);
  const [picture, cover] = await Promise.all([
    box(filmPage.picture),
    box(filmPage.posterImage(coverUrl(15155833, "L"))),
  ]);
  // The picture runs edge to edge at 16:9, and the cover climbs 72 px into it.
  expect([picture.x, picture.width]).toEqual([0, 402]);
  expect([cover.width, cover.height]).toEqual([104, 156]);
  expect(cover.y).toBeCloseTo(picture.y + picture.height - 72, 0);
});

test("Open Library is credited with a link, under the TMDB notice", async ({ ui }) => {
  const { loginPage } = ui;
  await loginPage.goto();

  await expect(loginPage.footer.text("Book data and covers from Open Library.")).toBeVisible();
  await expect(loginPage.footer.openLibraryLink).toHaveAttribute(
    "href",
    "https://openlibrary.org/",
  );
});
