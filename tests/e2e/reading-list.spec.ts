import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { at, minutesAgo } from "../support/clock";
import {
  harryPotter,
  holdCovers,
  hymn,
  kafkaOnTheShore,
  tyhrolovy,
} from "../support/scenarios/books";
import { alien } from "../support/scenarios/films";
import { expect, test } from "../support/ui/fixtures";

// Locally the Worker searches an Open Library fake, which mirrors real works; their covers are
// Open Library's own images, which these tests never load.
test.beforeEach(async ({ page }) => {
  await holdCovers(page);
});

// The film Backlog's words, which no book screen may say.
const filmWording = /Watchlist|Want to watch|Watched|to watch/;

async function plan(api: ApiClient, mediaItemId: number, time: string) {
  await expectBody(api.backlog.addBacklogItem({ mediaItemId }, at(time)), 201);
}

// Four books planned, the last added first: Himn demokratychnoï molodi, which has no cover, Kafka
// on the Shore, Harry Potter and Тигролови.
async function fillReadingList(api: ApiClient) {
  const tyhrolovyItem = await tyhrolovy(api);
  const harryPotterItem = await harryPotter(api);
  const kafkaItem = await kafkaOnTheShore(api);
  const hymnItem = await hymn(api);
  await plan(api, tyhrolovyItem.id, minutesAgo(90));
  await plan(api, harryPotterItem.id, minutesAgo(60));
  await plan(api, kafkaItem.id, minutesAgo(30));
  await plan(api, hymnItem.id, minutesAgo(10));
  return { tyhrolovyItem, harryPotterItem, kafkaItem, hymnItem };
}

// Besides its User, this journey writes the book's Backlog item, taken off again at the end, and
// the book's Media Item and cache entry where no one has added it yet (ADR-0006).
test("a User searches for a book, adds it to the Reading list from its page, finds it in Saved and takes it off", {
  tag: "@smoke",
}, async ({ page, loggedInUi: ui }) => {
  const { searchPage, filmPage, savedPage, libraryPage } = ui;
  await searchPage.goto(undefined, "book");
  await searchPage.search("Тигролови");
  await searchPage.openLibraryResults.result("Тигролови").clickPoster();
  await expect(filmPage.heading).toContainText("Тигролови");

  await filmPage.wantToReadButton.click();

  await expect(filmPage.onReadingListButton).toBeVisible();
  await expect(filmPage.toast.message("on your Reading list.")).toBeVisible();
  await expect(filmPage.main).not.toContainText(filmWording);
  const bookPath = new URL(page.url()).pathname;

  await filmPage.mainNav.link("Saved").click();
  const books = savedPage.tile("Books");
  await expect(books.link).toHaveAccessibleDescription("1 to read · 0 read");
  await expect(savedPage.tile("Films").root).toContainText("Nothing saved yet.");
  await books.link.click();
  await expect(page).toHaveURL(libraryPage.path("Reading list"));
  await expect(libraryPage.tab("Reading list")).toHaveAccessibleName("Reading list 1");
  await expect(libraryPage.posters("Reading list")).toHaveText([/Тигролови\s*Іван Багряний$/]);
  await expect(libraryPage.main).not.toContainText(filmWording);

  // The cover opens the book's page, where the bookmark takes it off again.
  await libraryPage.poster("Reading list", "Тигролови").link.click();
  await expect(page).toHaveURL(bookPath);
  await filmPage.onReadingListButton.click();
  await expect(filmPage.wantToReadButton).toBeVisible();
  await expect(filmPage.toast.message("off your Reading list.")).toBeVisible();

  await filmPage.mainNav.link("Saved").click();
  await expect(books.root).toContainText("Nothing saved yet.");
  await books.link.click();
  await expect(libraryPage.text("Nothing on your Reading list yet.")).toBeVisible();
});

test("the bookmark in Search puts a book on the Reading list and takes it off again", async ({
  page,
  loggedInUi: ui,
}) => {
  const { searchPage, libraryPage } = ui;
  const { toast } = searchPage;
  await searchPage.goto("Тигролови", "book");
  const result = searchPage.openLibraryResults.result("Тигролови");
  const bookmark = result.wantToReadButton;
  await expect(bookmark).toHaveAttribute("aria-pressed", "false");

  await bookmark.click();

  await expect(toast.message("Put Тигролови (1946) on your Reading list.")).toBeVisible();
  await expect(result.onReadingListButton).toBeVisible();
  // Planned here, it stays among Open Library's results until the query changes, and then is In
  // your Saved, under its own status line.
  await searchPage.search("тигро");
  const saved = searchPage.userMediaItems.film("Тигролови");
  await expect(saved.root).toContainText("Reading list");
  await libraryPage.goto("Reading list");
  await expect(libraryPage.posters("Reading list")).toHaveCount(1);

  await page.goBack();
  await searchPage.search("Тигролови");
  await expect(saved.root).toBeVisible();
  await saved.link.click();
  await ui.filmPage.onReadingListButton.click();
  await expect(
    ui.filmPage.toast.message("Took Тигролови (1946) off your Reading list."),
  ).toBeVisible();
  await libraryPage.goto("Reading list");
  await expect(libraryPage.text("Nothing on your Reading list yet.")).toBeVisible();
});

test("the Books tile counts the Reading list and fans out its latest covers, one set in type", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const { harryPotterItem, kafkaItem } = await fillReadingList(api);
  // A planned film is no book.
  await plan(api, (await alien(api)).id, minutesAgo(5));
  const { savedPage, libraryPage } = ui;

  await savedPage.goto();

  await expect(savedPage.tiles).toHaveCount(2);
  const books = savedPage.tile("Books");
  await expect(books.root).toContainText("4 to read · 0 read");
  await expect(books.link).toHaveAccessibleDescription("4 to read · 0 read");
  await expect(savedPage.tile("Films").link).toHaveAccessibleDescription("1 to watch · 0 watched");
  // The three added last, the latest in front: the book with no cover, set in type, then two
  // covers; Тигролови, planned first, is left out.
  await expect(books.typesetCovers).toHaveCount(1);
  await expect(books.typesetCovers).toContainText("Himn demokratychnoï molodi");
  await expect(books.coverImages).toHaveCount(2);
  for (const [index, item] of [kafkaItem, harryPotterItem].entries()) {
    await expect(books.coverImages.nth(index)).toHaveAttribute(
      "src",
      item.metadata.coverUrls.large,
    );
  }
  await expect(books.findBookLink).toHaveCount(0);
  await expect(books.root).not.toContainText(filmWording);

  await books.link.click();
  await expect(page).toHaveURL(libraryPage.path("Reading list"));
  await expect(libraryPage.posters("Reading list")).toHaveCount(4);
});

test("a new User's Books tile offers to find a book, which opens Search on Books", async ({
  page,
  loggedInUi: ui,
}) => {
  const { savedPage, searchPage, libraryPage } = ui;
  await savedPage.goto();
  const books = savedPage.tile("Books");

  await expect(books.root).toContainText("Nothing saved yet.");
  await expect(books.coverImages).toHaveCount(0);
  await books.findBookLink.click();
  await expect(page).toHaveURL(searchPage.path(undefined, "book"));
  await expect(searchPage.currentChip("Books")).toBeVisible();

  // The empty Reading list offers the same.
  await page.goBack();
  await books.link.click();
  await expect(page).toHaveURL(libraryPage.path("Reading list"));
  await expect(libraryPage.text("Nothing on your Reading list yet.")).toBeVisible();
  await expect(libraryPage.chipsGroup).toHaveCount(0);
  await libraryPage.findBookLink.click();
  await expect(page).toHaveURL(searchPage.path(undefined, "book"));
});

test("the Books page shows the Reading list as covers with their authors, the latest first", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const { tyhrolovyItem, kafkaItem } = await fillReadingList(api);
  const { libraryPage, filmPage } = ui;

  await libraryPage.goto("Reading list");

  await expect(page).toHaveTitle("Reading list · Books · TasteTrack");
  await expect(libraryPage.heading).toHaveText("Books");
  await expect(libraryPage.breadcrumb).toHaveText("SavedBooks");
  await expect(libraryPage.tabs).toHaveCount(2);
  await expect(libraryPage.tab("Reading list")).toHaveAccessibleName("Reading list 4");
  await expect(libraryPage.tab("Read")).toHaveAccessibleName("Read 0");
  await expect(libraryPage.tab("Reading list")).toHaveAttribute("aria-current", "page");
  await expect(libraryPage.posters("Reading list")).toHaveText([
    /Himn demokratychnoï molodi\s*Сергій Вікторович Жадан$/,
    /Kafka on the Shore\s*村上春樹$/,
    /Harry Potter and the Philosopher's Stone\s*J\. K\. Rowling$/,
    /Тигролови\s*Іван Багряний$/,
  ]);
  const kafka = libraryPage.poster("Reading list", "Kafka on the Shore");
  await expect(kafka.posterImage).toHaveAttribute("src", kafkaItem.metadata.coverUrls.large);
  const coverless = libraryPage.poster("Reading list", "Himn demokratychnoï molodi");
  await expect(coverless.typesetCover).toBeVisible();
  await expect(coverless.posterImage).toHaveCount(0);
  await expect(libraryPage.main).not.toContainText(filmWording);

  await libraryPage.poster("Reading list", "Тигролови").link.click();
  await expect(page).toHaveURL(filmPage.path(tyhrolovyItem.id));
  await expect(filmPage.onReadingListButton).toBeVisible();
});

test("the Reading list sorts by Date added, Title or First published, and filters by Decade alone", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  await fillReadingList(api);
  const { libraryPage } = ui;
  const titles = (expected: string[]) => expected.map((title) => new RegExp(`^${title}`));
  await libraryPage.goto("Reading list");

  // No Genre: books have none.
  await expect(libraryPage.chips).toHaveCount(2);
  await expect(libraryPage.chip("Sort")).toHaveAccessibleName("Sort: Date added");
  await expect(libraryPage.chip("Decade")).toHaveAccessibleName("Decade: Any decade");
  await libraryPage.chip("Sort").click();
  await expect(libraryPage.choices).toHaveText(["Date added", "Title", "First published"]);
  await libraryPage.choice("Title").click();

  await expect(page).toHaveURL(`${libraryPage.path("Reading list")}?sort=title`);
  await expect(libraryPage.posters("Reading list")).toHaveText(
    titles(["Harry Potter", "Himn", "Kafka on the Shore", "Тигролови"]),
  );

  // The newest first; Тигролови is from 1946.
  await libraryPage.choose("Sort", "First published");
  await expect(libraryPage.posters("Reading list").last()).toContainText("Тигролови");
  await libraryPage.choose("Decade", "1940s");
  await expect(libraryPage.posters("Reading list")).toHaveText(titles(["Тигролови"]));

  // A genre in the address, as a film's tab would leave it, filters nothing here.
  await ui.goto(`${libraryPage.path("Reading list")}?genre=Horror`);
  await expect(libraryPage.posters("Reading list")).toHaveCount(4);
});

test("an address with a film's tab opens the Reading list, and one with Read the Read tab", async ({
  page,
  loggedInUi: ui,
}) => {
  const { libraryPage } = ui;

  for (const address of ["/saved/books", "/saved/books/watchlist", "/saved/books/watched"]) {
    await ui.goto(address);

    await expect(page, address).toHaveURL(libraryPage.path("Reading list"));
    await expect(libraryPage.heading).toHaveText("Books");
  }
  await ui.goto("/saved/books/read");
  await expect(page).toHaveURL(libraryPage.path("Read"));

  // A Media Type Saved doesn't have opens the films' Watchlist, whatever tab it names.
  await ui.goto("/saved/series/watched");
  await expect(page).toHaveURL(libraryPage.path("Watchlist"));
});

test("on a phone the Reading list shows three covers a row", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  await fillReadingList(api);
  const { libraryPage } = ui;
  await page.setViewportSize({ width: 390, height: 844 });

  await libraryPage.goto("Reading list");
  await expect(libraryPage.posters("Reading list")).toHaveCount(4);
  const tops = await libraryPage
    .posters("Reading list")
    .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
  expect(new Set(tops.slice(0, 3)).size).toBe(1);
  expect(tops[3]).toBeGreaterThan(tops[0] ?? 0);
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBe(0);
});
