import type { NewInProgressRequest } from "@shared/api";
import type { ApiClient } from "../support/api/ApiClient";
import { expectBody } from "../support/api/responses";
import {
  bookProgress,
  holdCovers,
  kafkaOnTheShore,
  manualBook,
  tyhrolovy,
} from "../support/scenarios/books";
import { expect, test } from "../support/ui/fixtures";

// A book's Progress (`docs/mockups/book-progress/`): the page the User is on and, if they give
// it, how many pages their edition has, set in the Reading card on the book's page and shown on
// Saved's "Reading now" row. Covers are Open Library's own images, which these tests never load.
test.beforeEach(async ({ page }) => {
  await holdCovers(page);
});

async function startReading(
  api: ApiClient,
  mediaItemId: number,
  progress: NewInProgressRequest["progress"] = null,
) {
  await expectBody(api.inProgress.start({ mediaItemId, progress }), 201);
}

const phone = { width: 390, height: 844 };

for (const [device, viewport] of [
  ["desktop", null],
  ["a phone", phone],
] as const) {
  test(`on ${device}, the User sets the page and the page count of a book they started, changes them and clears them`, async ({
    page,
    api,
    loggedInUi: ui,
  }) => {
    if (viewport) await page.setViewportSize(viewport);
    const book = await tyhrolovy(api);
    const { filmPage } = ui;
    const card = filmPage.readingCard;
    await filmPage.goto(book.id);

    // Start reading asks for no page.
    await filmPage.startReadingButton.click();

    await expect(filmPage.dialogs).toHaveCount(0);
    await expect(card.text("Which page are you on?")).toBeVisible();
    await expect(card.pageBar).toBeHidden();

    await card.addPageButton.click();

    await expect(card.pageInput).toBeFocused();
    await expect(card.pageInput).toHaveValue("");
    await expect(card.pageCountInput).toHaveAttribute("placeholder", "Optional");
    await expect(card.clearButton).toBeHidden();
    await expect(card.saveButton).toBeDisabled();

    await card.savePage("142", "380");

    await expect(card.text(/^142$/)).toBeVisible();
    await expect(card.text("238 pages to go")).toBeVisible();
    await expect(card.pageBar).toHaveAccessibleName("Page 142 of 380");
    await expect(card.text("142 of 380")).toBeVisible();
    await expect(card.pageInput).toBeHidden();
    await expect(card.changePageButton).toBeFocused();
    await page.reload();
    await expect(card.pageBar).toHaveAccessibleName("Page 142 of 380");

    await card.changePageButton.click();

    await expect(card.pageInput).toHaveValue("142");
    await expect(card.pageCountInput).toHaveValue("380");
    await card.savePage("150", "");

    await expect(card.text(/^150$/)).toBeVisible();
    await expect(card.pageBar).toBeHidden();
    await expect(card.text(/pages? to go/)).toBeHidden();

    await card.changePageButton.click();
    await card.clearButton.click();

    await expect(card.text("Which page are you on?")).toBeVisible();
    await expect(card.addPageButton).toBeFocused();
    await page.reload();
    await expect(card.text("Which page are you on?")).toBeVisible();
  });
}

test("a page past the page count is refused under the fields, and the last page itself finishes nothing", async ({
  api,
  loggedInUi: ui,
}) => {
  const book = await tyhrolovy(api);
  await startReading(api, book.id);
  const { filmPage } = ui;
  const card = filmPage.readingCard;
  await filmPage.goto(book.id);
  await card.addPageButton.click();

  await card.savePage("312", "272");

  await expect(card.pageProblem).toHaveText("Page 312 is past the last page, 272.");
  await expect(card.pageInput).toHaveAttribute("aria-invalid", "true");
  await expect(card.pageInput).toHaveAccessibleDescription("Page 312 is past the last page, 272.");
  await expect(card.saveButton).toBeDisabled();

  await card.pageInput.fill("272");

  await expect(card.pageProblem).toBeHidden();
  await expect(card.pageInput).not.toHaveAttribute("aria-invalid");
  await card.saveButton.click();
  await expect(card.text("On the last page")).toBeVisible();
  await expect(card.pageBar).toHaveAccessibleName("Page 272 of 272");
  await expect(card.finishedButton).toBeVisible();
  await expect(filmPage.dialogs).toHaveCount(0);

  await card.changePageButton.click();
  await card.savePage("1", "0");

  await expect(card.pageProblem).toHaveText("An edition has from 1 to 100,000 pages.");
  await expect(card.pageCountInput).toHaveAttribute("aria-invalid", "true");

  await card.savePage("100001", "");

  await expect(card.pageProblem).toHaveText("A page goes up to 100,000.");
});

test("Cancel and Escape close the editor and change nothing, and Enter saves", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const book = await tyhrolovy(api);
  await startReading(api, book.id, bookProgress(88, 272));
  const { filmPage } = ui;
  const card = filmPage.readingCard;
  await filmPage.goto(book.id);

  await card.changePageButton.click();
  await card.pageInput.fill("99");
  await card.cancelButton.click();

  await expect(card.pageBar).toHaveAccessibleName("Page 88 of 272");

  await card.changePageButton.click();
  await card.pageInput.fill("99");
  await page.keyboard.press("Escape");

  await expect(card.pageBar).toHaveAccessibleName("Page 88 of 272");

  await card.changePageButton.click();
  // Only digits go in.
  await card.pageInput.fill("1o1");
  await expect(card.pageInput).toHaveValue("11");
  await card.pageInput.press("Enter");

  await expect(card.pageBar).toHaveAccessibleName("Page 11 of 272");
});

test("a page that can't be saved keeps the editor open with what was typed", async ({
  page,
  api,
  loggedInUi: ui,
}) => {
  const book = await tyhrolovy(api);
  await startReading(api, book.id);
  const { filmPage } = ui;
  const card = filmPage.readingCard;
  await filmPage.goto(book.id);
  await page.route("**/api/in-progress/*", (route) => {
    return route.request().method() === "PATCH" ? route.abort() : route.continue();
  });
  await card.addPageButton.click();

  await card.savePage("142", "380");

  await expect(card.pageProblem).toHaveText(
    "Couldn't save your page of Тигролови. Please try again.",
  );
  await expect(card.pageInput).toHaveValue("142");
  await expect(card.pageCountInput).toHaveValue("380");
  await expect(card.saveButton).toBeEnabled();
});

test("Reading now shows the bar with a page count, the page alone without one, and nothing new without Progress", async ({
  api,
  loggedInUi: ui,
}) => {
  const [counted, pageOnly, none] = [
    await tyhrolovy(api),
    await kafkaOnTheShore(api),
    await manualBook(api, { title: "Доця", year: 2019 }),
  ];
  await startReading(api, counted.id, bookProgress(142, 380));
  await startReading(api, pageOnly.id, bookProgress(88));
  await startReading(api, none.id);
  const { savedPage } = ui;

  await savedPage.goto();

  await expect(savedPage.readingNowRows).toHaveCount(3);
  await expect(savedPage.readingNowPageBar("Тигролови")).toHaveAccessibleName("Page 142 of 380");
  await expect(savedPage.readingNowRow("Тигролови")).toContainText("142 of 380");
  await expect(savedPage.readingNowPageBar("Kafka on the Shore")).toBeHidden();
  await expect(savedPage.readingNowRow("Kafka on the Shore")).toContainText("p. 88");
  await expect(savedPage.readingNowPageBar("Доця")).toBeHidden();
  await expect(savedPage.readingNowRow("Доця")).not.toContainText(/p\. \d|\d+ of \d+/);
});
