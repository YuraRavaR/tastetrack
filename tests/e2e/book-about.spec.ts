import type { Locator } from "@playwright/test";
import {
  harryPotter,
  holdCovers,
  hymn,
  kafkaOnTheShore,
  manualBook,
} from "../support/scenarios/books";
import { expect, test } from "../support/ui/fixtures";

const harryPotterDescription = /^Turning the envelope over, his hand trembling/;
const kafkaOnTheShoreDescription =
  "A boy trying to escape a gruesome oedipedal prophecy, a simple man who can talk to cats, " +
  "a mysterious librarian, and a woman waiting for a long-dead lover.";

// How tall an element is drawn, to tell a cut description from an open one.
function heightOf(element: Locator) {
  return element.evaluate((node: HTMLElement) => node.offsetHeight);
}

test.beforeEach(async ({ page }) => {
  await holdCovers(page);
});

for (const [device, viewport] of [
  ["a phone", { width: 390, height: 844 }],
  ["a larger screen", { width: 1440, height: 900 }],
] as const) {
  test.describe(`on ${device}`, () => {
    test.use({ viewport });

    test("a book's page shows its description from Open Library, with no language switch or credits", async ({
      loggedInApi: api,
      ui,
    }) => {
      const { id } = await harryPotter(api);
      const { filmPage } = ui;
      const { about } = filmPage;

      await filmPage.goto(id);

      await expect(about.text(harryPotterDescription)).toBeVisible();
      await expect(about.text("From Open Library")).toBeVisible();
      await expect(about.ukrainianButton).toHaveCount(0);
      await expect(about.creditLabels).toHaveCount(0);
    });

    test("a long description is cut, and More and Less open it, in paragraphs, and cut it", async ({
      loggedInApi: api,
      ui,
    }) => {
      const { id } = await harryPotter(api);
      const { filmPage } = ui;
      const { about } = filmPage;
      await filmPage.goto(id);
      const description = about.text(harryPotterDescription);

      await expect(about.moreButton).toBeVisible();
      const cutHeight = await heightOf(description);
      await about.moreButton.click();
      await expect(about.lessButton).toBeVisible();
      expect(await heightOf(description)).toBeGreaterThan(cutHeight);
      // Its first paragraph ends with a line of its own.
      expect(await description.innerText()).toMatch(/letter 'H'\.\n+HARRY POTTER has never/);

      await about.lessButton.click();
      await expect(about.moreButton).toBeVisible();
      expect(await heightOf(description)).toBe(cutHeight);
    });

    test("a short description shows whole, with no More", async ({ loggedInApi: api, ui }) => {
      const { id } = await kafkaOnTheShore(api);
      const { filmPage } = ui;

      await filmPage.goto(id);

      await expect(filmPage.about.text(kafkaOnTheShoreDescription)).toBeVisible();
      await expect(filmPage.about.moreButton).toHaveCount(0);
      await expect(filmPage.about.lessButton).toHaveCount(0);
    });
  });
}

test("a book with no description shows no About block", async ({ loggedInApi: api, ui }) => {
  const { id } = await hymn(api);
  const { filmPage } = ui;

  await filmPage.goto(id);

  await expect(filmPage.heading).toBeVisible();
  await expect(filmPage.about.root).toHaveCount(0);
});

test("a manual book shows no About block", async ({ loggedInApi: api, ui }) => {
  const { id } = await manualBook(api, { title: "Доця", year: 2004 });
  const { filmPage } = ui;

  await filmPage.goto(id);

  await expect(filmPage.heading).toBeVisible();
  await expect(filmPage.about.root).toHaveCount(0);
});
