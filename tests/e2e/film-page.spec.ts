import { expect, type Page, test } from "@playwright/test";
import { alien, aliens, film, newFilm } from "../support/films";
import { callsRealTmdb } from "../support/tmdb";
import { logInNewUser } from "../support/users";

// Leaves every TMDB image loading for good, so the tests see the page before any image arrives
// and depend on neither TMDB nor the network.
async function holdImages(page: Page): Promise<void> {
  await page.route("https://image.tmdb.org/**", () => {});
}

async function openFilm(page: Page, mediaItemId: number): Promise<void> {
  await page.goto(`/items/${mediaItemId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("a film's page opens with its backdrop, sized for the screen", async ({ page }) => {
  await holdImages(page);
  await logInNewUser(page.request);
  const { id, metadata } = await alien(page.request);

  await page.setViewportSize({ width: 402, height: 874 });
  await openFilm(page, id);

  const backdrop = page.getByRole("main").locator("picture");
  await expect(backdrop.locator("img")).toHaveAttribute("src", metadata.backdropUrls.small);
  await expect(backdrop.locator("source")).toHaveAttribute("srcset", metadata.backdropUrls.large);
  // The space is taken before the image loads, so the page doesn't jump.
  expect((await backdrop.boundingBox())?.height).toBe(184);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => (await backdrop.boundingBox())?.height).toBe(260);
});

test("a film without a backdrop shows its poster in the banner, larger than a thumbnail", async ({
  page,
}) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film without a backdrop");
  await holdImages(page);
  await logInNewUser(page.request);
  const { id, metadata } = await aliens(page.request);

  await openFilm(page, id);

  const main = page.getByRole("main");
  await expect(main.locator("picture")).toHaveCount(0);
  const poster = main.locator(`img[src="${metadata.posterUrl}"]`);
  await expect(poster).toHaveCSS("width", "112px");
  await expect(poster).toHaveCSS("height", "168px");
});

test("a film with neither shows the placeholder with its caption", async ({ page }) => {
  test.skip(callsRealTmdb(), "Only the TMDB fake has a film no one has added");
  await holdImages(page);
  await logInNewUser(page.request);
  const { id, query } = newFilm();
  const added = await film(page.request, query, id);

  await openFilm(page, added.id);

  await expect(page.getByRole("main").getByRole("img", { name: "No poster" })).toHaveText(/\S/);
});
