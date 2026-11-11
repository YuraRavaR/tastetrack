import type { Page } from "@playwright/test";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import { harryPotter, holdCovers, manualBook, tyhrolovy } from "../support/scenarios/books";
import { test as base, expect } from "../support/ui/fixtures";
import { Ui } from "../support/ui/Ui";

// Locally the Worker searches an Open Library fake, which mirrors real works; their covers are
// Open Library's own images, which these tests never load.

const test = base.extend<{ visitorPage: Page; visitorUi: Ui }>({
  // Someone with no session: a browser of their own.
  visitorPage: async ({ browser }, use) => {
    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    await holdCovers(page);
    await use(page);
    await visitor.close();
  },
  visitorUi: async ({ visitorPage }, use) => {
    await use(new Ui(visitorPage));
  },
});

test.beforeEach(async ({ page }) => {
  await holdCovers(page);
});

// The film words no book screen may say.
const filmWording = /\bfilms?\b|poster/i;

async function createList(api: ApiClient, name: string, mediaType: "film" | "book") {
  return (await expectBody(api.lists.createList({ name, mediaType }), 201)).list;
}

async function addToList(api: ApiClient, listId: number, mediaItemId: number, note?: string) {
  await expectBody(api.lists.addListItem(listId, { mediaItemId, note }), 201);
}

const phone = { width: 390, height: 844 };

for (const [device, viewport] of [
  ["desktop", null],
  ["a phone", phone],
] as const) {
  test(`on ${device}, a User picks Books in Collections, makes a Collection of books and adds, reorders, notes and removes books`, async ({
    page,
    loggedInUi: ui,
    loggedInApi: api,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    await createList(api, "Space horror", "film");
    await manualBook(api, { title: "Доця", year: 2019, authors: ["Тамара Горіха Зерня"] });
    const { listsPage, listPage } = ui;
    await listsPage.goto();
    await expect(listsPage.lists).toHaveCount(1);

    // Books puts the type in the address and shows only book Collections: none yet.
    await listsPage.booksChip.click();
    await expect(page).toHaveURL(listsPage.path("book"));
    await expect(listsPage.pressedChip).toHaveText("Books");
    await expect(listsPage.emptyMessage).toBeVisible();
    await expect(listsPage.lists).toHaveCount(0);

    // A Collection made there is one of books.
    await listsPage.newListButton.click();
    await listsPage.newListDialog.nameInput.fill("Ukrainian prose");
    await listsPage.newListDialog.createButton.click();
    await expect(listPage.heading("Ukrainian prose")).toBeVisible();
    await listPage.addBooksButton.click();
    const addBooks = listPage.addBooksDialog("Ukrainian prose");
    await addBooks.add("Тигролови", "Тигролови");
    await expect(addBooks.searchResults.result("Тигролови").root).toContainText("Іван Багряний");
    // The User's own books come up too.
    await addBooks.add("Доця", "Доця");
    await addBooks.add("Harry Potter", "Harry Potter and the Philosopher's Stone");
    await addBooks.doneButton.click();
    const items = listPage.items("Ukrainian prose");
    await expect(items).toHaveCount(3);
    await expect(listPage.text("3 books")).toBeVisible();
    await expect(listPage.poster("Ukrainian prose", "Тигролови").root).toContainText(
      "Іван Багряний",
    );
    await expect(listPage.main).not.toContainText(filmWording);

    // Reordered, noted and one removed, which Undo would bring back.
    await listPage.act("Reorder books");
    await listPage.poster("Ukrainian prose", "Доця").moveToTopButton.click();
    await expect(items.first()).toContainText("Доця");
    await listPage.doneButton.click();
    await listPage.choose("Ukrainian prose", "Тигролови", "Add a Note");
    await listPage.noteDialog("Тигролови (1946)").saveNote("An adventure first.");
    await expect(listPage.poster("Ukrainian prose", "Тигролови").root).toContainText(
      "An adventure first.",
    );
    await listPage.choose(
      "Ukrainian prose",
      "Harry Potter and the Philosopher's Stone",
      "Remove from collection",
    );
    await expect(listPage.undoButton).toBeVisible();
    await expect(items).toHaveCount(2);
    await page.reload();
    await expect(items).toHaveText([/Доця/, /Тигролови.*An adventure first\./]);

    // Back on Collections, still on Books, with the new Collection's card.
    await listPage.backLink.click();
    await expect(page).toHaveURL(listsPage.path("book"));
    await expect(listsPage.lists).toHaveCount(1);
    await expect(listsPage.card("Ukrainian prose").root).toContainText("2 books");
  });
}

test("Collections opens on Films without a type, and a reload keeps Books", async ({
  page,
  ui,
  loggedInApi: api,
}) => {
  await createList(api, "Space horror", "film");
  await createList(api, "Ukrainian prose", "book");
  const { listsPage } = ui;

  await listsPage.goto();
  await expect(listsPage.pressedChip).toHaveText("Films");
  await expect(listsPage.lists).toHaveText([/Space horror/]);

  await listsPage.goto("book");
  await page.reload();
  await expect(listsPage.pressedChip).toHaveText("Books");
  await expect(listsPage.lists).toHaveText([/Ukrainian prose/]);

  await listsPage.filmsChip.click();
  await expect(page).toHaveURL(listsPage.path());
  await expect(listsPage.lists).toHaveText([/Space horror/]);
});

test("someone logged out opens a Collection of books by its Share Link: covers, titles, authors and Notes", async ({
  ui,
  loggedInUser: owner,
  loggedInApi: api,
  visitorUi,
}) => {
  const list = await createList(api, "Ukrainian prose", "book");
  await addToList(api, list.id, (await tyhrolovy(api)).id, "An adventure first.");
  await addToList(api, list.id, (await harryPotter(api)).id);
  const { listPage } = ui;
  await listPage.goto(list.id);
  await listPage.act("Share");
  const shareLinkDialog = listPage.shareLinkDialog("Ukrainian prose");
  await shareLinkDialog.share();
  const url = await shareLinkDialog.readLink();

  const { sharedPage } = visitorUi;
  await visitorUi.goto(url);

  await expect(sharedPage.text("Book collection")).toBeVisible();
  await expect(sharedPage.heading("Ukrainian prose")).toBeVisible();
  await expect(sharedPage.text(`Shared by ${owner.username} · 2 books`)).toBeVisible();
  const items = sharedPage.items("Ukrainian prose");
  await expect(items).toHaveCount(2);
  const tyhrolovyItem = sharedPage.film("Ukrainian prose", "Тигролови");
  await expect(tyhrolovyItem.root).toContainText("Іван Багряний · 1946");
  await expect(tyhrolovyItem.note("An adventure first.")).toBeVisible();
  await expect(tyhrolovyItem.root.locator("img")).toHaveAttribute(
    "src",
    /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-L\.jpg$/,
  );
  await expect(items.nth(1)).toContainText("J. K. Rowling · 1997");
  await expect(sharedPage.main).not.toContainText(filmWording);
  await expect(sharedPage.inviteLine).toBeVisible();
});
