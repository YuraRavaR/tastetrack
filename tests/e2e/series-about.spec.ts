import type { Locator } from "@playwright/test";
import { breakingBad, manualSeries, newSeries, noPosterSeries } from "../support/scenarios/series";
import { callsRealTmdb, holdImages } from "../support/scenarios/tmdb";
import { expect, test } from "../support/ui/fixtures";

const breakingBadOverview = /^Walter White, a New Mexico chemistry teacher/;
const breakingBadUkrainianOverview = /^Шкільний учитель хімії Волтер Вайт/;

// How tall an element is drawn, to tell a cut overview from an open one.
function heightOf(element: Locator) {
  return element.evaluate((node: HTMLElement) => node.offsetHeight);
}

test.beforeEach(async ({ page }) => {
  await holdImages(page);
});

for (const [device, viewport] of [
  ["a phone", { width: 390, height: 844 }],
  ["a larger screen", { width: 1440, height: 900 }],
] as const) {
  test.describe(`on ${device}`, () => {
    test.use({ viewport });

    test("a series' page says what it is about: its tagline, overview, creators and cast", async ({
      loggedInApi: api,
      ui,
    }) => {
      const { id } = await breakingBad(api);
      const { filmPage } = ui;
      const { about } = filmPage;

      await filmPage.goto(id);

      await expect(about.text("Change the equation.")).toBeVisible();
      await expect(about.text(breakingBadOverview)).toBeVisible();
      await expect(about.creditLabels).toHaveText(["Created by", "Cast"]);
      await expect(about.creditNames).toHaveText([
        "Vince Gilligan",
        "Bryan Cranston, Aaron Paul, Anna Gunn, RJ Mitte, Dean Norris",
      ]);
      await expect(about.text("From TMDB")).toBeVisible();
    });

    test("a long overview is cut, and More and Less open and cut it", async ({
      loggedInApi: api,
      ui,
    }) => {
      const { id } = await breakingBad(api);
      const { filmPage } = ui;
      const { about } = filmPage;
      await filmPage.goto(id);
      const overview = about.text(breakingBadOverview);

      await expect(about.moreButton).toBeVisible();
      const cutHeight = await heightOf(overview);
      await about.moreButton.click();
      await expect(about.lessButton).toBeVisible();
      expect(await heightOf(overview)).toBeGreaterThan(cutHeight);

      await about.lessButton.click();
      await expect(about.moreButton).toBeVisible();
      expect(await heightOf(overview)).toBe(cutHeight);
    });

    test("a short overview shows whole, with no More", async ({ loggedInApi: api, ui }) => {
      test.skip(callsRealTmdb(), "Only the TMDB fake has a series with an overview this short");
      const { id } = await noPosterSeries(api);
      const { filmPage } = ui;

      await filmPage.goto(id);

      await expect(filmPage.about.text("A series with no poster.")).toBeVisible();
      await expect(filmPage.about.moreButton).toHaveCount(0);
      await expect(filmPage.about.lessButton).toHaveCount(0);
    });
  });
}

test("Українською swaps the tagline and the overview, and In English swaps them back", async ({
  loggedInApi: api,
  ui,
}) => {
  const { id } = await breakingBad(api);
  const { filmPage } = ui;
  const { about } = filmPage;
  await filmPage.goto(id);

  await about.ukrainianButton.click();

  await expect(about.text("Як далеко ти готовий зайти заради родини?")).toBeVisible();
  await expect(about.text(breakingBadUkrainianOverview)).toBeVisible();
  await expect(about.text(breakingBadOverview)).toHaveCount(0);
  await expect(about.ukrainianButton).toHaveCount(0);

  await about.englishButton.click();

  await expect(about.text("Change the equation.")).toBeVisible();
  await expect(about.text(breakingBadOverview)).toBeVisible();
  await expect(about.englishButton).toHaveCount(0);
});

test("a series with no Ukrainian overview has no Українською, and no credits", async ({
  loggedInApi: api,
  ui,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a series with only an English overview");
  const { id } = await noPosterSeries(api);
  const { filmPage } = ui;

  await filmPage.goto(id);

  await expect(filmPage.about.text("A series with no poster.")).toBeVisible();
  await expect(filmPage.about.ukrainianButton).toHaveCount(0);
  await expect(filmPage.about.creditLabels).toHaveCount(0);
});

test("a manual series shows no About block", async ({ loggedInApi: api, ui }) => {
  const { id } = await manualSeries(api, { title: "Спіймати Кайдаша", year: 2020 });
  const { filmPage } = ui;

  await filmPage.goto(id);

  await expect(filmPage.heading).toBeVisible();
  await expect(filmPage.about.root).toHaveCount(0);
});

test("a series TMDB knows nothing about shows no About block", async ({ loggedInApi: api, ui }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a series it knows nothing about");
  const { mediaItem } = await newSeries(api);
  const { filmPage } = ui;

  await filmPage.goto(mediaItem.id);

  await expect(filmPage.heading).toBeVisible();
  await expect(filmPage.about.root).toHaveCount(0);
});
