import type { Locator } from "@playwright/test";
import {
  alien,
  film,
  manualFilm,
  noCountryForOldMen,
  noPosterFilm,
  tampopo,
} from "../support/scenarios/films";
import { callsRealTmdb, holdImages } from "../support/scenarios/tmdb";
import { expect, test } from "../support/ui/fixtures";

const alienOverview = /^During its return to the earth, commercial spaceship Nostromo/;
const alienUkrainianOverview = /^У далекому майбутньому вантажний космічний корабель/;

function heightOf(element: Locator) {
  return element.evaluate((node: HTMLElement) => node.offsetHeight);
}

test.beforeEach(async ({ page }) => {
  await holdImages(page);
});

for (const [device, viewport] of [
  ["a phone", { width: 402, height: 874 }],
  ["a larger screen", { width: 1440, height: 900 }],
] as const) {
  test.describe(`on ${device}`, () => {
    test.use({ viewport });

    test("a film's page says what it is about: its tagline, overview, director and cast", async ({
      loggedInApi: api,
      ui,
    }) => {
      const { id } = await alien(api);
      const { filmPage } = ui;
      const { about } = filmPage;

      await filmPage.goto(id);

      await expect(about.text("In space no one can hear you scream.")).toBeVisible();
      await expect(about.text(alienOverview)).toBeVisible();
      await expect(about.creditLabels).toHaveText(["Director", "Cast"]);
      await expect(about.creditNames).toHaveText([
        "Ridley Scott",
        "Tom Skerritt, Sigourney Weaver, Veronica Cartwright, Harry Dean Stanton, John Hurt",
      ]);
      await expect(about.text("From TMDB")).toBeVisible();
    });

    test("a long overview is cut, and More and Less open and cut it", async ({
      loggedInApi: api,
      ui,
    }) => {
      const { id } = await alien(api);
      const { filmPage } = ui;
      const { about } = filmPage;
      await filmPage.goto(id);
      const overview = about.text(alienOverview);

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
      test.skip(callsRealTmdb(), "Only the TMDB fake has a film with an overview this short");
      const { id } = await noPosterFilm(api);
      const { filmPage } = ui;

      await filmPage.goto(id);

      await expect(filmPage.about.text("A film with no poster.")).toBeVisible();
      await expect(filmPage.about.moreButton).toHaveCount(0);
      await expect(filmPage.about.lessButton).toHaveCount(0);
    });
  });
}

test("Українською swaps the tagline and the overview, and In English swaps them back", async ({
  loggedInApi: api,
  ui,
}) => {
  const { id } = await alien(api);
  const { filmPage } = ui;
  const { about } = filmPage;
  await filmPage.goto(id);

  await about.ukrainianButton.click();

  await expect(about.text("В космосі ніхто твій крик не почує.")).toBeVisible();
  await expect(about.text(alienUkrainianOverview)).toBeVisible();
  await expect(about.text(alienOverview)).toHaveCount(0);
  await expect(about.ukrainianButton).toHaveCount(0);

  await about.englishButton.click();

  await expect(about.text("In space no one can hear you scream.")).toBeVisible();
  await expect(about.text(alienOverview)).toBeVisible();
  await expect(about.englishButton).toHaveCount(0);
});

test("a film with no Ukrainian overview has no Українською", async ({ loggedInApi: api, ui }) => {
  const { id } = await tampopo(api);
  const { filmPage } = ui;

  await filmPage.goto(id);

  await expect(filmPage.about.text("The first Japanese Noodle Western.")).toBeVisible();
  await expect(filmPage.about.ukrainianButton).toHaveCount(0);
});

test("a film directed by two names them as Directors", async ({ loggedInApi: api, ui }) => {
  const { id } = await noCountryForOldMen(api);
  const { filmPage } = ui;

  await filmPage.goto(id);

  await expect(filmPage.about.creditLabels).toHaveText(["Directors", "Cast"]);
  await expect(filmPage.about.creditNames.first()).toHaveText("Joel Coen, Ethan Coen");
});

test("a Manual Media Item shows no About block", async ({ loggedInApi: api, ui }) => {
  const { id } = await manualFilm(api, { title: "Olena's wedding" });
  const { filmPage } = ui;

  await filmPage.goto(id);

  await expect(filmPage.heading).toBeVisible();
  await expect(filmPage.about.root).toHaveCount(0);
});

test("a film TMDB knows nothing about shows no About block", async ({ loggedInApi: api, ui }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film it knows nothing about");
  const { id } = await film(api, "tmdb fake nothing known", "999000003");
  const { filmPage } = ui;

  await filmPage.goto(id);

  await expect(filmPage.heading).toBeVisible();
  await expect(filmPage.about.root).toHaveCount(0);
});
